import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
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
import type { AnnouncementsStackParamList } from '../../navigation/AnnouncementsStack';

type NavigationProp = NativeStackNavigationProp<AnnouncementsStackParamList>;

type AnnouncementWithCount = Announcement & {
  booking_requests: { count: number }[];
};

const statusColors: Record<string, { bg: string; text: string }> = {
  active: { bg: colors.green50, text: colors.green700 },
  completed: { bg: colors.gray100, text: colors.gray600 },
  cancelled: { bg: colors.red50, text: colors.red700 },
};

export function MyAnnouncementsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<AnnouncementWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('announcements')
        .select('*, booking_requests(count)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setAnnouncements((data as AnnouncementWithCount[]) ?? []);
    } catch {
      setError(t('announcements.errors.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t]);

  useFocusEffect(
    useCallback(() => {
      fetchAnnouncements();
    }, [fetchAnnouncements])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handleDelete = (announcementId: string) => {
    Alert.alert(
      t('common.confirm'),
      t('common.delete') + ' ?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const { error: deleteError } = await supabase
              .from('announcements')
              .delete()
              .eq('id', announcementId);

            if (deleteError) {
              Alert.alert(t('common.error'), t('announcements.errors.deleteFailed'));
            } else {
              setAnnouncements((prev) => prev.filter((a) => a.id !== announcementId));
            }
          },
        },
      ],
    );
  };

  const handleStatusChange = async (announcementId: string, newStatus: 'active' | 'completed' | 'cancelled') => {
    const { error: updateError } = await supabase
      .from('announcements')
      .update({ status: newStatus })
      .eq('id', announcementId);

    if (updateError) {
      Alert.alert(t('common.error'), t('announcements.errors.loadFailed'));
    } else {
      setAnnouncements((prev) =>
        prev.map((a) => (a.id === announcementId ? { ...a, status: newStatus } : a))
      );
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getBookingCount = (item: AnnouncementWithCount): number => {
    return item.booking_requests?.[0]?.count ?? 0;
  };

  const renderAnnouncementCard = ({ item }: { item: AnnouncementWithCount }) => {
    const bookingCount = getBookingCount(item);
    const statusColor = statusColors[item.status] ?? statusColors.active;

    return (
      <View style={styles.card}>
        {/* Header: status badge */}
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {t(`bookingRequest.status.${item.status === 'active' ? 'approved' : item.status === 'completed' ? 'delivered' : 'cancelled'}`)}
            </Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeBlock}>
          <View style={styles.routeLine}>
            <View style={styles.routeDot} />
            <Text style={styles.cityText}>{item.departure_city}</Text>
            {item.departure_country ? (
              <Text style={styles.countryText}>, {item.departure_country}</Text>
            ) : null}
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeLine}>
            <View style={[styles.routeDot, styles.routeDotEnd]} />
            <Text style={styles.cityText}>{item.destination_city}</Text>
            {item.destination_country ? (
              <Text style={styles.countryText}>, {item.destination_country}</Text>
            ) : null}
          </View>
        </View>

        {/* Title */}
        <Text style={styles.announcementTitle} numberOfLines={1}>{item.title}</Text>

        {/* Details */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.gray500} />
            <Text style={styles.detailText}>{formatDate(item.departure_date)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cube-outline" size={14} color={colors.gray500} />
            <Text style={styles.detailText}>{item.available_space}kg</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="pricetag-outline" size={14} color={colors.gray500} />
            <Text style={styles.detailText}>{item.price_per_kg}€/kg</Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          {/* Booking requests button */}
          <TouchableOpacity
            style={styles.bookingsButton}
            onPress={() => navigation.navigate('BookingRequests', { announcementId: item.id })}
          >
            <Ionicons name="people-outline" size={14} color={colors.primary} />
            {bookingCount > 0 && (
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{bookingCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={styles.actionButtons}>
            {item.status === 'active' && (
              <>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => navigation.navigate('CreateAnnouncement', { announcementId: item.id })}
                >
                  <Ionicons name="create-outline" size={18} color={colors.gray600} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => handleStatusChange(item.id, 'completed')}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color={colors.green600} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.iconButton}
                  onPress={() => handleStatusChange(item.id, 'cancelled')}
                >
                  <Ionicons name="close-circle-outline" size={18} color={colors.red500} />
                </TouchableOpacity>
              </>
            )}
            {(item.status === 'completed' || item.status === 'cancelled') && (
              <TouchableOpacity
                style={styles.iconButton}
                onPress={() => handleDelete(item.id)}
              >
                <Ionicons name="trash-outline" size={18} color={colors.red500} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="airplane-outline" size={48} color={colors.gray300} />
      <Text style={styles.emptyTitle}>{t('announcements.noAnnouncements')}</Text>
      <Text style={styles.emptySubtitle}>{t('announcements.noAnnouncementsSubtitle')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>{t('announcements.title')}</Text>
            <Text style={styles.subtitle}>{t('announcements.subtitle')}</Text>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate('CreateAnnouncement')}
          >
            <Ionicons name="add" size={22} color={colors.white} />
          </TouchableOpacity>
        </View>

        {/* Segment control */}
        <View style={styles.segmentControl}>
          <View style={[styles.segmentButton, styles.segmentButtonActive]}>
            <Ionicons name="airplane" size={15} color={colors.primary} />
            <Text style={styles.segmentTextActive} numberOfLines={1}>{t('nav.myTrips', 'Mes trajets')}</Text>
          </View>
          <TouchableOpacity
            style={styles.segmentButton}
            onPress={() => navigation.navigate('MyBookings')}
          >
            <Ionicons name="document-text-outline" size={15} color={colors.gray500} />
            <Text style={styles.segmentText} numberOfLines={1}>{t('nav.myBookings', 'Mes demandes')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.red500} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchAnnouncements}>
            <Text style={styles.retryText}>{t('announcements.errors.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item.id}
          renderItem={renderAnnouncementCard}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
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
  header: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  segmentControl: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 12,
    backgroundColor: colors.gray100,
    borderRadius: 10,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
  },
  segmentButtonActive: {
    backgroundColor: colors.white,
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  segmentText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.gray500,
  },
  segmentTextActive: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray900,
  },
  subtitle: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: 2,
  },
  createButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 16,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  routeBlock: {
    marginBottom: 8,
    paddingLeft: 4,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  routeDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  routeDotEnd: {
    backgroundColor: colors.green600,
  },
  routeConnector: {
    width: 2,
    height: 12,
    backgroundColor: colors.gray200,
    marginLeft: 3.5,
    marginVertical: 2,
  },
  cityText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.gray900,
  },
  countryText: {
    fontSize: 12,
    color: colors.gray400,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  announcementTitle: {
    fontSize: 13,
    color: colors.gray500,
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: colors.gray500,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 10,
  },
  bookingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.primaryBg,
  },
  countBadge: {
    backgroundColor: colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countBadgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 4,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.gray50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.gray700,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.gray400,
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: colors.gray600,
    marginTop: 12,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  retryText: {
    color: colors.white,
    fontWeight: '600',
  },
});
