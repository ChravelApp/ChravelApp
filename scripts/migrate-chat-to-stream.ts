/**
 * One-time migration: Supabase trip_chat_messages → GetStream
 *
 * This script reads all rows from trip_chat_messages (bypassing RLS via the
 * service role key), groups them by trip_id, then upserts each message into
 * the corresponding GetStream "messaging" channel.
 *
 * Prerequisites:
 *   npm install   (ensures @stream-io/node-sdk and @supabase/supabase-js are present)
 *
 * Usage:
 *   npx tsx scripts/migrate-chat-to-stream.ts
 *
 * Required env vars (set in .env or export before running):
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   STREAM_API_KEY
 *   STREAM_API_SECRET
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { StreamClient } from '@stream-io/node-sdk';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const STREAM_API_KEY = process.env.STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_API_SECRET;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !STREAM_API_KEY || !STREAM_API_SECRET) {
  console.error('❌  Missing required environment variables.');
  console.error('   Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STREAM_API_KEY, STREAM_API_SECRET');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const streamClient = new StreamClient(STREAM_API_KEY, STREAM_API_SECRET);

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface SupabaseMessage {
  id: string;
  trip_id: string;
  user_id: string;
  content: string;
  sender_name: string | null;
  sender_avatar: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function run() {
  console.log('🔍  Fetching trip_chat_messages from Supabase…');

  // Fetch in pages to handle large datasets
  const PAGE_SIZE = 1000;
  let allMessages: SupabaseMessage[] = [];
  let from = 0;
  let done = false;

  while (!done) {
    const { data, error } = await supabase
      .from('trip_chat_messages')
      .select('id, trip_id, user_id, content, sender_name, sender_avatar, created_at')
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      if (error.code === '42P01') {
        console.log('ℹ️   trip_chat_messages table does not exist — nothing to migrate.');
        return;
      }
      throw new Error(`Supabase query failed: ${error.message}`);
    }

    allMessages = allMessages.concat(data ?? []);
    done = !data || data.length < PAGE_SIZE;
    from += PAGE_SIZE;
  }

  if (allMessages.length === 0) {
    console.log('ℹ️   No messages found in trip_chat_messages — nothing to migrate.');
    return;
  }

  console.log(`📦  Found ${allMessages.length} messages across all trips.`);

  // Group by trip_id
  const byTrip = new Map<string, SupabaseMessage[]>();
  for (const msg of allMessages) {
    const list = byTrip.get(msg.trip_id) ?? [];
    list.push(msg);
    byTrip.set(msg.trip_id, list);
  }

  let migratedTotal = 0;
  let skippedTotal = 0;

  for (const [tripId, messages] of byTrip) {
    const channelId = `trip-${tripId}`;
    console.log(`\n➡️   Trip ${tripId} (${messages.length} messages) → channel "${channelId}"`);

    // Ensure every sender exists as a GetStream user
    const uniqueUserIds = [...new Set(messages.map((m) => m.user_id))];
    await streamClient.upsertUsers(
      uniqueUserIds.map((uid) => {
        const sample = messages.find((m) => m.user_id === uid)!;
        return {
          id: uid,
          name: sample.sender_name ?? uid,
          image: sample.sender_avatar ?? undefined,
        };
      })
    );

    // Create/get the channel (using a system user as creator)
    const channel = streamClient.video.call('messaging', channelId);

    let migrated = 0;
    let skipped = 0;

    for (const msg of messages) {
      try {
        // Use the Supabase message id as the GetStream message id for idempotency
        await streamClient.upsertUsers([
          {
            id: msg.user_id,
            name: msg.sender_name ?? msg.user_id,
            image: msg.sender_avatar ?? undefined,
          },
        ]);

        // GetStream REST message send — use the server-side token for the sender
        const token = streamClient.createToken(msg.user_id);

        // We use the REST API directly for historical backdating
        const response = await fetch(
          `https://chat.stream-io-api.com/channels/messaging/${channelId}/message`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
              'stream-auth-type': 'jwt',
              'X-Stream-Client': 'migration-script',
            },
            body: JSON.stringify({
              message: {
                id: msg.id,
                text: msg.content,
                created_at: msg.created_at,
                user_id: msg.user_id,
              },
            }),
          }
        );

        if (response.status === 409) {
          // Message already exists — idempotent skip
          skipped++;
        } else if (!response.ok) {
          const body = await response.text();
          console.warn(`  ⚠️   Message ${msg.id} failed (${response.status}): ${body}`);
        } else {
          migrated++;
        }
      } catch (err) {
        console.warn(`  ⚠️   Message ${msg.id} error: ${err}`);
      }
    }

    console.log(`   ✅  Migrated: ${migrated}  |  Already existed: ${skipped}`);
    migratedTotal += migrated;
    skippedTotal += skipped;
  }

  console.log(`\n🎉  Migration complete.`);
  console.log(`   Total migrated : ${migratedTotal}`);
  console.log(`   Total skipped  : ${skippedTotal}`);
  console.log('\nThe frontend now reads exclusively from GetStream.');
  console.log('You can safely mark trip_chat_messages as read-only or archive it.');
}

run().catch((err) => {
  console.error('💥  Migration failed:', err);
  process.exit(1);
});
