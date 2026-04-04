import { useState, useEffect, useCallback, useRef } from 'react';
import type { Channel, MessageResponse } from 'stream-chat';
import { getTripChannel, connectStreamUser, disconnectStreamUser } from '../services/streamChat';
import { Message } from '../types/messaging';

function toMessage(msg: MessageResponse, tripId: string): Message {
  return {
    id: msg.id,
    content: typeof msg.text === 'string' ? msg.text : '',
    senderId: msg.user?.id ?? 'unknown',
    senderName: msg.user?.name ?? msg.user?.id ?? 'Unknown',
    senderAvatar: msg.user?.image as string | undefined,
    timestamp: typeof msg.created_at === 'string' ? msg.created_at : new Date().toISOString(),
    isRead: true,
    tripId,
  };
}

interface UseMessagesOptions {
  tripId?: string;
  userId?: string;
  userName?: string;
  userAvatar?: string;
  streamToken?: string;
}

export const useMessages = (options?: UseMessagesOptions) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<Channel | null>(null);

  const tripId = options?.tripId ?? '';
  const userId = options?.userId;
  const userName = options?.userName;
  const userAvatar = options?.userAvatar;
  const streamToken = options?.streamToken;

  useEffect(() => {
    if (!tripId || !userId || !streamToken) return;

    let cancelled = false;

    async function init() {
      setLoading(true);
      try {
        await connectStreamUser(
          userId!,
          userName ?? userId!,
          userAvatar,
          streamToken!
        );

        const channel = getTripChannel(tripId);
        channelRef.current = channel;

        const state = await channel.watch();
        if (!cancelled) {
          setMessages((state.messages ?? []).map((m) => toMessage(m, tripId)));
        }

        channel.on('message.new', (event) => {
          if (!cancelled && event.message) {
            setMessages((prev) => [...prev, toMessage(event.message!, tripId)]);
          }
        });
      } catch (err) {
        if (!cancelled) setError(String(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();

    return () => {
      cancelled = true;
      channelRef.current?.stopWatching();
      channelRef.current = null;
      disconnectStreamUser();
    };
  }, [tripId, userId, userName, userAvatar, streamToken]);

  const addMessage = useCallback(
    async (content: string, _tripId?: string, _tourId?: string) => {
      if (channelRef.current) {
        try {
          await channelRef.current.sendMessage({ text: content });
        } catch (err) {
          setError(String(err));
        }
      }
    },
    []
  );

  const getMessagesForTrip = useCallback(
    (id: string) => messages.filter((m) => m.tripId === id),
    [messages]
  );

  // getMessagesForTour is kept for callers that haven't migrated yet;
  // returns empty since all history now lives in GetStream.
  const getMessagesForTour = useCallback((_tourId: string): Message[] => [], []);

  const searchMessages = useCallback((query: string) => {
    setSearchQuery(query);
  }, []);

  const markAsRead = useCallback((_messageId: string) => {}, []);

  const getTotalUnreadCount = useCallback((): number => 0, []);

  const getTripUnreadCount = useCallback((_tripId: string): number => 0, []);

  return {
    messages,
    searchQuery,
    loading,
    error,
    getMessagesForTour,
    getMessagesForTrip,
    addMessage,
    searchMessages,
    markAsRead,
    getTotalUnreadCount,
    getTripUnreadCount,
  };
};
