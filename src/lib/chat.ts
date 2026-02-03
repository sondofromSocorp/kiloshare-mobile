import { supabase } from './supabase';
import type { Message, MessageWithSender, ConversationSummary, HandoffStep, Rating } from './types';

export async function fetchMessages(bookingRequestId: string): Promise<MessageWithSender[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(`
      *,
      profiles:sender_id (
        first_name,
        last_name,
        avatar_url
      )
    `)
    .eq('booking_request_id', bookingRequestId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data as MessageWithSender[]) || [];
}

export async function sendMessage(
  bookingRequestId: string,
  senderId: string,
  content: string
): Promise<Message> {
  const trimmed = content.trim();
  if (!trimmed || trimmed.length > 2000) {
    throw new Error('Message must be between 1 and 2000 characters');
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      booking_request_id: bookingRequestId,
      sender_id: senderId,
      content: trimmed,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Message;
}

export async function markAsRead(bookingRequestId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('booking_request_id', bookingRequestId)
    .neq('sender_id', userId)
    .is('read_at', null);

  if (error) throw error;
}

export async function fetchConversations(userId: string): Promise<ConversationSummary[]> {
  const { data: bookings, error: bookingsError } = await supabase
    .from('booking_requests')
    .select('id, user_id, announcement_id')
    .not('status', 'in', '("pending","rejected","cancelled")');

  if (bookingsError) throw bookingsError;
  if (!bookings) return [];

  const conversations: ConversationSummary[] = [];

  for (const booking of bookings) {
    const { data: ann } = await supabase
      .from('announcements')
      .select('user_id, departure_city, destination_city, departure_date')
      .eq('id', booking.announcement_id)
      .single();

    if (!ann) continue;

    if (booking.user_id !== userId && ann.user_id !== userId) continue;

    const otherUserId = booking.user_id === userId ? ann.user_id : booking.user_id;

    const { data: otherProfile } = await supabase
      .from('profiles')
      .select('first_name, last_name, avatar_url, email, username')
      .eq('id', otherUserId)
      .maybeSingle();

    const { data: lastMsg } = await supabase
      .from('messages')
      .select('content, created_at')
      .eq('booking_request_id', booking.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('booking_request_id', booking.id)
      .neq('sender_id', userId)
      .is('read_at', null);

    const displayProfile = otherProfile
      ? {
          first_name: otherProfile.first_name || otherProfile.username || otherProfile.email?.split('@')[0] || null,
          last_name: otherProfile.last_name,
          avatar_url: otherProfile.avatar_url,
        }
      : { first_name: null, last_name: null, avatar_url: null };

    conversations.push({
      booking_request_id: booking.id,
      other_user: displayProfile,
      other_user_id: otherUserId,
      last_message: lastMsg?.content || null,
      last_message_at: lastMsg?.created_at || null,
      unread_count: count || 0,
      announcement: {
        departure_city: ann.departure_city,
        destination_city: ann.destination_city,
        departure_date: ann.departure_date,
      },
    });
  }

  conversations.sort((a, b) => {
    if (!a.last_message_at && !b.last_message_at) return 0;
    if (!a.last_message_at) return 1;
    if (!b.last_message_at) return -1;
    return new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime();
  });

  return conversations;
}

function generateDeliveryCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function confirmHandoff(
  bookingRequestId: string,
  senderId: string,
  step: HandoffStep
): Promise<string | void> {
  const systemMessages: Record<string, string> = {
    sender_confirmed: '[HANDOFF] sender_confirmed',
    handed_over: '[HANDOFF] handed_over',
    delivered: '[HANDOFF] delivered',
  };

  const statusForStep: Record<string, string> = {
    handed_over: 'handed_over',
    delivered: 'delivered',
  };

  let deliveryCode: string | undefined;
  const updateData: Record<string, string> = { handoff_step: step };
  if (statusForStep[step]) {
    updateData.status = statusForStep[step];
  }
  if (step === 'handed_over') {
    deliveryCode = generateDeliveryCode();
    updateData.delivery_code = deliveryCode;
  }

  const { error: updateError } = await supabase
    .from('booking_requests')
    .update(updateData)
    .eq('id', bookingRequestId);

  if (updateError) throw updateError;

  const content = systemMessages[step];
  if (content) {
    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        booking_request_id: bookingRequestId,
        sender_id: senderId,
        content,
        is_system: true,
      });

    if (msgError) throw msgError;
  }

  return deliveryCode;
}

export async function fetchDeliveryCode(bookingRequestId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('delivery_code')
    .eq('id', bookingRequestId)
    .single();

  if (error) return null;
  return data?.delivery_code || null;
}

export async function validateDeliveryCode(
  bookingRequestId: string,
  code: string,
  senderId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('delivery_code, handoff_step')
    .eq('id', bookingRequestId)
    .single();

  if (error || !data) return false;
  if (data.handoff_step !== 'handed_over') return false;

  if (data.delivery_code && code.toUpperCase().trim() === data.delivery_code.toUpperCase().trim()) {
    const { error: updateError } = await supabase
      .from('booking_requests')
      .update({ handoff_step: 'delivered', status: 'delivered' })
      .eq('id', bookingRequestId);

    if (updateError) throw updateError;

    const { error: msgError } = await supabase
      .from('messages')
      .insert({
        booking_request_id: bookingRequestId,
        sender_id: senderId,
        content: '[HANDOFF] delivered',
        is_system: true,
      });

    if (msgError) throw msgError;

    return true;
  }

  return false;
}

export async function fetchHandoffStep(bookingRequestId: string): Promise<HandoffStep> {
  const { data, error } = await supabase
    .from('booking_requests')
    .select('handoff_step')
    .eq('id', bookingRequestId)
    .single();

  if (error) return 'none';
  return (data?.handoff_step as HandoffStep) || 'none';
}

export async function submitRating(
  bookingRequestId: string,
  raterId: string,
  ratedId: string,
  score: number,
  comment?: string
): Promise<void> {
  const { error } = await supabase
    .from('ratings')
    .insert({
      booking_request_id: bookingRequestId,
      rater_id: raterId,
      rated_id: ratedId,
      score,
      comment: comment || null,
    });

  if (error) throw error;
}

export async function fetchRatingForBooking(
  bookingRequestId: string,
  raterId: string
): Promise<Rating | null> {
  const { data, error } = await supabase
    .from('ratings')
    .select('*')
    .eq('booking_request_id', bookingRequestId)
    .eq('rater_id', raterId)
    .maybeSingle();

  if (error) return null;
  return data as Rating | null;
}

export async function fetchUserAverageRating(userId: string): Promise<{ average: number; count: number }> {
  const { data, error } = await supabase
    .from('ratings')
    .select('score')
    .eq('rated_id', userId);

  if (error || !data || data.length === 0) return { average: 0, count: 0 };

  const total = data.reduce((sum: number, r: any) => sum + r.score, 0);
  return { average: total / data.length, count: data.length };
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { data: bookings, error: bookingsError } = await supabase
    .from('booking_requests')
    .select('id, user_id, announcement_id')
    .not('status', 'in', '("pending","rejected","cancelled")');

  if (bookingsError || !bookings) return 0;

  const annIds = [...new Set(bookings.map((b: any) => b.announcement_id))];
  const { data: announcements } = await supabase
    .from('announcements')
    .select('id, user_id')
    .in('id', annIds);

  const annOwnerMap: Record<string, string> = {};
  announcements?.forEach((a: any) => { annOwnerMap[a.id] = a.user_id; });

  const myBookingIds = bookings
    .filter((b: any) => b.user_id === userId || annOwnerMap[b.announcement_id] === userId)
    .map((b: any) => b.id);

  if (myBookingIds.length === 0) return 0;

  const { count, error } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .in('booking_request_id', myBookingIds)
    .neq('sender_id', userId)
    .is('read_at', null);

  if (error) return 0;
  return count || 0;
}
