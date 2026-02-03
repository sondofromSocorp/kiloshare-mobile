import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { fetchMessages, sendMessage, markAsRead } from '../lib/chat';
import type { MessageWithSender } from '../lib/types';

export function useChat(bookingRequestId: string, userId: string | undefined) {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadMessages = useCallback(async () => {
    if (!bookingRequestId || !userId) return;
    try {
      setError(null);
      const data = await fetchMessages(bookingRequestId);
      setMessages(data);
    } catch (err) {
      console.error('Error loading messages:', err);
      setError('Failed to load messages');
    } finally {
      setLoading(false);
    }
  }, [bookingRequestId, userId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    if (!bookingRequestId || !userId) return;

    const channel = supabase
      .channel(`messages:${bookingRequestId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `booking_request_id=eq.${bookingRequestId}`,
        },
        async (payload) => {
          const { data } = await supabase
            .from('messages')
            .select(`
              *,
              profiles:sender_id (
                first_name,
                last_name,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (data) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === data.id)) return prev;
              return [...prev, data as MessageWithSender];
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `booking_request_id=eq.${bookingRequestId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === payload.new.id ? { ...m, read_at: payload.new.read_at } : m
            )
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channel.unsubscribe();
    };
  }, [bookingRequestId, userId]);

  const send = useCallback(
    async (content: string) => {
      if (!userId) return;
      try {
        await sendMessage(bookingRequestId, userId, content);
      } catch (err) {
        console.error('Error sending message:', err);
        throw err;
      }
    },
    [bookingRequestId, userId]
  );

  const markRead = useCallback(async () => {
    if (!userId) return;
    try {
      await markAsRead(bookingRequestId, userId);
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  }, [bookingRequestId, userId]);

  return { messages, loading, error, send, markRead, reload: loadMessages };
}
