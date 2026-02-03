import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRoute, RouteProp } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { fetchPublicProfile, fetchUserRole, fetchUserReviews } from '../../lib/profile';
import { fetchUserAverageRating } from '../../lib/chat';
import type { PublicProfile, ReviewWithRater } from '../../lib/types';
import type { ProfileStackParamList } from '../../navigation/ProfileStack';

type PublicProfileRouteProp = RouteProp<ProfileStackParamList, 'PublicProfile'>;

const roleKeys: Record<string, string> = {
  traveler: 'publicProfile.roleTraveler',
  sender: 'publicProfile.roleSender',
  both: 'publicProfile.roleBoth',
  new: 'publicProfile.roleNew',
};

export function PublicProfileScreen() {
  const { t } = useTranslation();
  const route = useRoute<PublicProfileRouteProp>();
  const { userId } = route.params;

  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [role, setRole] = useState('new');
  const [rating, setRating] = useState({ average: 0, count: 0 });
  const [reviews, setReviews] = useState<ReviewWithRater[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [profileData, userRole, userRating, userReviews] = await Promise.all([
        fetchPublicProfile(userId),
        fetchUserRole(userId),
        fetchUserAverageRating(userId),
        fetchUserReviews(userId),
      ]);

      setProfile(profileData);
      setRole(userRole);
      setRating(userRating);
      setReviews(userReviews);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatMemberSince = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  };

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={styles.centered}>
        <Ionicons name="person-outline" size={48} color={colors.gray300} />
        <Text style={styles.notFoundText}>{t('publicProfile.notFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.avatarLarge}>
          <Ionicons name="person" size={36} color={colors.white} />
        </View>
        <Text style={styles.displayName}>{displayName || t('chat.unknownUser')}</Text>

        {/* Role badge */}
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>{t(roleKeys[role] ?? roleKeys.new)}</Text>
        </View>

        {/* Verified badge */}
        {profile.identity_verified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={14} color={colors.green600} />
            <Text style={styles.verifiedText}>{t('publicProfile.identityVerified')}</Text>
          </View>
        )}

        {/* Stats */}
        <View style={styles.statsRow}>
          {rating.count > 0 && (
            <View style={styles.statItem}>
              <Ionicons name="star" size={18} color={colors.yellow500} />
              <Text style={styles.statNumber}>{rating.average.toFixed(1)}</Text>
              <Text style={styles.statLabel}>({rating.count})</Text>
            </View>
          )}
          <View style={styles.statItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.gray400} />
            <Text style={styles.statLabel}>
              {t('publicProfile.memberSince', { date: formatMemberSince(profile.created_at) })}
            </Text>
          </View>
        </View>
      </View>

      {/* About */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          {t('publicProfile.aboutTitle', { name: profile.first_name || '' })}
        </Text>

        {profile.bio ? (
          <Text style={styles.bioText}>{profile.bio}</Text>
        ) : (
          <Text style={styles.noInfoText}>{t('publicProfile.noInfo')}</Text>
        )}

        {(profile.city || profile.country) && (
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={16} color={colors.gray400} />
            <Text style={styles.infoText}>
              {t('publicProfile.livesIn')} {[profile.city, profile.country].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}

        {profile.languages && profile.languages.length > 0 && (
          <View style={styles.infoRow}>
            <Ionicons name="globe-outline" size={16} color={colors.gray400} />
            <Text style={styles.infoText}>
              {t('publicProfile.speaks')} {profile.languages.map((l) => t(`languages.${l}`, l)).join(', ')}
            </Text>
          </View>
        )}
      </View>

      {/* Reviews */}
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          {t('publicProfile.reviewsTitle', { name: profile.first_name || '' })}
        </Text>

        {reviews.length === 0 ? (
          <Text style={styles.noInfoText}>{t('publicProfile.noReviewsYet')}</Text>
        ) : (
          reviews.map((review) => {
            const reviewerName = [review.rater.first_name, review.rater.last_name]
              .filter(Boolean)
              .join(' ') || t('chat.unknownUser');

            return (
              <View key={review.id} style={styles.reviewCard}>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerInfo}>
                    <View style={styles.reviewerAvatar}>
                      <Ionicons name="person" size={12} color={colors.white} />
                    </View>
                    <Text style={styles.reviewerName}>{reviewerName}</Text>
                  </View>
                  <View style={styles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= review.score ? 'star' : 'star-outline'}
                        size={14}
                        color={star <= review.score ? colors.yellow500 : colors.gray300}
                      />
                    ))}
                  </View>
                </View>
                {review.comment && (
                  <Text style={styles.reviewComment}>{review.comment}</Text>
                )}
                <Text style={styles.reviewDate}>
                  {new Date(review.created_at).toLocaleDateString(undefined, {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </Text>
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 24,
  },
  notFoundText: {
    fontSize: 16,
    color: colors.gray500,
    marginTop: 12,
  },

  // Header
  headerCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray900,
  },
  roleBadge: {
    backgroundColor: colors.primaryBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
    marginTop: 8,
  },
  roleBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    backgroundColor: colors.green50,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  verifiedText: {
    fontSize: 12,
    color: colors.green700,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 16,
    alignItems: 'center',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
  },
  statLabel: {
    fontSize: 13,
    color: colors.gray500,
  },

  // Section card
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
    marginBottom: 12,
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 12,
  },
  bioText: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 22,
    marginBottom: 12,
  },
  noInfoText: {
    fontSize: 14,
    color: colors.gray400,
    fontStyle: 'italic',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  infoText: {
    fontSize: 14,
    color: colors.gray600,
  },

  // Reviews
  reviewCard: {
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 12,
    marginTop: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  reviewerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewerAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewerName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray900,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewComment: {
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
    marginBottom: 4,
  },
  reviewDate: {
    fontSize: 12,
    color: colors.gray400,
  },
});
