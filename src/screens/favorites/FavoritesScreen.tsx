import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { Announcement } from '../../lib/types';
import type { BrowseStackParamList } from '../../navigation/BrowseStack';

type NavigationProp = NativeStackNavigationProp<BrowseStackParamList>;

interface Profile {
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

interface FavoriteAnnouncement extends Announcement {
  profiles: Profile;
}

export function FavoritesScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const [favorites, setFavorites] = useState<FavoriteAnnouncement[]>([]);
  const [verifiedUsers, setVerifiedUsers] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bookedKilos, setBookedKilos] = useState<Record<string, number>>({});

  const loadFavorites = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          announcement_id,
          announcements (
            *,
            profiles (first_name, last_name, avatar_url)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const announcements = (data as any[])
        ?.map((f) => f.announcements)
        .filter(Boolean) || [];

      setFavorites(announcements);

      if (announcements.length > 0) {
        const ids = announcements.map((a) => a.id);
        const userIds = [...new Set(announcements.map((a) => a.user_id))];

        const [bookingsResult, verifiedResult] = await Promise.all([
          supabase
            .from('booking_requests')
            .select('announcement_id, requested_kilos')
            .in('announcement_id', ids)
            .in('status', ['pending', 'approved']),
          supabase
            .from('identity_documents')
            .select('user_id')
            .in('user_id', userIds)
            .eq('status', 'approved'),
        ]);

        const booked: Record<string, number> = {};
        bookingsResult.data?.forEach((b) => {
          booked[b.announcement_id] = (booked[b.announcement_id] || 0) + Number(b.requested_kilos);
        });
        setBookedKilos(booked);

        const verifiedSet = new Set(verifiedResult.data?.map((d) => d.user_id) || []);
        setVerifiedUsers(verifiedSet);
      }
    } catch (err) {
      console.error('Error loading favorites:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [loadFavorites])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  const handleRemoveFavorite = async (announcementId: string) => {
    if (!user) return;

    setFavorites((prev) => prev.filter((a) => a.id !== announcementId));

    await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('announcement_id', announcementId);
  };

  const getTravelerName = (profile: Profile) => {
    if (!profile) return t('announcements.traveler');
    if (profile.first_name && profile.last_name) return `${profile.first_name} ${profile.last_name}`;
    if (profile.first_name) return profile.first_name;
    return t('announcements.traveler');
  };

  const renderItem = ({ item }: { item: FavoriteAnnouncement }) => {
    const remaining = Math.max(0, item.available_space - (bookedKilos[item.id] || 0));
    const progress = Math.min(100, ((bookedKilos[item.id] || 0) / item.available_space) * 100);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AnnouncementDetail', { announcementId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          <TouchableOpacity
            style={styles.favoriteButton}
            onPress={() => handleRemoveFavorite(item.id)}
          >
            <Ionicons name="heart" size={22} color={colors.red500} />
          </TouchableOpacity>
        </View>

        <View style={styles.routeRow}>
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <Text style={styles.cityText}>{item.departure_city}</Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routePoint}>
            <View style={[styles.dot, { backgroundColor: colors.green500 }]} />
            <Text style={styles.cityText}>{item.destination_city}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.gray400} />
            <Text style={styles.infoText}>
              {new Date(item.departure_date).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="cube-outline" size={14} color={colors.gray400} />
            <Text style={styles.infoText}>{remaining}kg / {item.available_space}kg</Text>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>

        <View style={styles.cardFooter}>
          <View style={styles.travelerRow}>
            <View style={styles.avatarContainer}>
              {item.profiles?.avatar_url ? (
                <Image source={{ uri: item.profiles.avatar_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person" size={12} color={colors.white} />
                </View>
              )}
              {verifiedUsers.has(item.user_id) && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="shield-checkmark" size={10} color={colors.white} />
                </View>
              )}
            </View>
            <Text style={styles.travelerName}>{getTravelerName(item.profiles)}</Text>
          </View>
          <Text style={styles.price}>{item.price_per_kg}€/kg</Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('profile.favorites')}</Text>
      </View>

      {favorites.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="heart-outline" size={64} color={colors.gray300} />
          <Text style={styles.emptyTitle}>{t('profile.noFavorites')}</Text>
          <Text style={styles.emptySubtitle}>{t('profile.noFavoritesSubtitle')}</Text>
        </View>
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray900,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray900,
    marginRight: 8,
  },
  favoriteButton: {
    padding: 4,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  routeLine: {
    flex: 1,
    height: 2,
    backgroundColor: colors.gray200,
    marginHorizontal: 8,
  },
  cityText: {
    fontSize: 13,
    color: colors.gray600,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  infoText: {
    fontSize: 12,
    color: colors.gray500,
  },
  progressContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.gray200,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  travelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.green600,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.white,
  },
  travelerName: {
    fontSize: 13,
    color: colors.gray600,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
});
