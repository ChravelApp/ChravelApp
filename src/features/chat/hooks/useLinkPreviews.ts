import { useState, useEffect, useRef } from 'react';
import { fetchOGMetadata, type OGMetadata } from '@/services/ogMetadataService';

interface LinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  domain?: string;
}

/** Extract the first URL from message text */
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/i;

function extractUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  if (!match) return null;
  let url = match[0];
  // The edge function's Zod schema only accepts HTTPS; auto-upgrade HTTP URLs
  if (url.startsWith('http://')) {
    url = url.replace('http://', 'https://');
  }
  return url;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Client-side link preview enrichment for messages.
 * Detects URLs in message content and fetches OG metadata via the
 * existing fetch-og-metadata edge function.
 *
 * Returns a map of messageId → LinkPreview for messages that have URLs
 * and whose previews have been fetched.
 */
export function useLinkPreviews(
  messages: Array<{ id: string; text: string; linkPreview?: unknown }>,
): Record<string, LinkPreview> {
  const [previews, setPreviews] = useState<Record<string, LinkPreview>>({});
  // Canonical cache keyed by URL so repeated links across messages share one fetch.
  const previewsByUrlRef = useRef<Map<string, LinkPreview>>(new Map());
  // Tracks URLs currently being fetched or successfully fetched (prevents concurrent dupes)
  const fetchedUrlsRef = useRef<Set<string>>(new Set());
  // Tracks URLs that failed, with retry count (allows one retry)
  const failedUrlsRef = useRef<Map<string, number>>(new Map());
  const MAX_RETRIES = 1;

  useEffect(() => {
    if (messages.length === 0) return;

    // Hydrate any new messages whose URL preview was already fetched previously.
    const hydratedFromCache: Record<string, LinkPreview> = {};
    for (const msg of messages) {
      if (msg.linkPreview || previews[msg.id]) continue;
      const url = extractUrl(msg.text);
      if (!url) continue;
      const cachedPreview = previewsByUrlRef.current.get(url);
      if (!cachedPreview) continue;
      hydratedFromCache[msg.id] = cachedPreview;
    }

    if (Object.keys(hydratedFromCache).length > 0) {
      setPreviews(prev => ({ ...prev, ...hydratedFromCache }));
    }

    // Find URLs to fetch that aren't already in URL cache.
    const urlsToFetch: string[] = [];

    for (const msg of messages) {
      // Skip if this message already has a DB-stored link preview
      if (msg.linkPreview) continue;
      // Skip if we already fetched for this message
      if (previews[msg.id]) continue;

      const url = extractUrl(msg.text);
      if (!url) continue;
      // Skip if we already have this URL in local cache
      if (previewsByUrlRef.current.has(url)) continue;
      // Skip if we already fetched this URL successfully (dedup across messages)
      if (fetchedUrlsRef.current.has(url)) continue;
      // Skip if this URL has exceeded max retries
      const failCount = failedUrlsRef.current.get(url) ?? 0;
      if (failCount > MAX_RETRIES) continue;

      urlsToFetch.push(url);
      // Mark as in-flight to prevent concurrent duplicate fetches
      fetchedUrlsRef.current.add(url);
    }

    if (urlsToFetch.length === 0) return;

    // Fetch OG metadata for new URLs (max 3 concurrent)
    const fetchAll = async () => {
      const fetchedUrlToPreview = new Map<string, LinkPreview>();
      const resultsByMessageId: Record<string, LinkPreview> = {};

      // Process in small batches to avoid overwhelming the edge function
      const BATCH_SIZE = 3;
      for (let i = 0; i < urlsToFetch.length; i += BATCH_SIZE) {
        const batch = urlsToFetch.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async url => {
          const metadata: OGMetadata = await fetchOGMetadata(url);
          if (!metadata.error) {
            const preview: LinkPreview = {
              url,
              title: metadata.title,
              description: metadata.description,
              image: metadata.image,
              domain: getDomain(url),
            };
            previewsByUrlRef.current.set(url, preview);
            fetchedUrlToPreview.set(url, preview);
          } else {
            // Remove from in-flight set so it can be retried on next render
            fetchedUrlsRef.current.delete(url);
            failedUrlsRef.current.set(url, (failedUrlsRef.current.get(url) ?? 0) + 1);
          }
        });
        await Promise.all(promises);
      }

      if (fetchedUrlToPreview.size > 0) {
        for (const msg of messages) {
          if (msg.linkPreview || previews[msg.id]) continue;
          const url = extractUrl(msg.text);
          if (!url) continue;
          const preview = fetchedUrlToPreview.get(url);
          if (preview) {
            resultsByMessageId[msg.id] = preview;
          }
        }
      }

      if (Object.keys(resultsByMessageId).length > 0) {
        setPreviews(prev => ({ ...prev, ...resultsByMessageId }));
      }
    };

    fetchAll();
  }, [messages, previews]);

  return previews;
}
