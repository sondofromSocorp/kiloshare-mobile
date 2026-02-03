import { supabase } from './supabase';
import type { PublicProfile, ReviewWithRater } from './types';

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, city, country, bio, languages, created_at')
    .eq('id', userId)
    .maybeSingle();

  if (error || !profile) return null;

  const { data: idDoc } = await supabase
    .from('identity_documents')
    .select('status')
    .eq('user_id', userId)
    .eq('status', 'approved')
    .limit(1)
    .maybeSingle();

  return {
    ...profile,
    languages: profile.languages || [],
    identity_verified: idDoc?.status === 'approved',
  };
}

export async function fetchUserRole(userId: string): Promise<string> {
  const { count: annCount } = await supabase
    .from('announcements')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const { count: bookingCount } = await supabase
    .from('booking_requests')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  if ((annCount || 0) > 0 && (bookingCount || 0) > 0) return 'both';
  if ((annCount || 0) > 0) return 'traveler';
  if ((bookingCount || 0) > 0) return 'sender';
  return 'new';
}

export async function fetchUserReviews(userId: string): Promise<ReviewWithRater[]> {
  const { data: ratings, error } = await supabase
    .from('ratings')
    .select('id, score, comment, created_at, rater_id')
    .eq('rated_id', userId)
    .order('created_at', { ascending: false });

  if (error || !ratings || ratings.length === 0) return [];

  const raterIds = [...new Set(ratings.map(r => r.rater_id))];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url')
    .in('id', raterIds);

  const profileMap: Record<string, { first_name: string | null; last_name: string | null; avatar_url: string | null }> = {};
  profiles?.forEach(p => {
    profileMap[p.id] = { first_name: p.first_name, last_name: p.last_name, avatar_url: p.avatar_url };
  });

  return ratings.map(r => ({
    id: r.id,
    score: r.score,
    comment: r.comment,
    created_at: r.created_at,
    rater: profileMap[r.rater_id] || { first_name: null, last_name: null, avatar_url: null },
  }));
}
