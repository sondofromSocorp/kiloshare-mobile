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
import type { BookingRequest, Announcement, Profile } from '../../lib/types';
import type { AnnouncementsStackParamList } from '../../navigation/AnnouncementsStack';

type NavigationProp = NativeStackNavigationProp<AnnouncementsStackParamList>;

type BookingWithAnnouncement = BookingRequest & {
  announcements: Pick<
    Announcement,
    'user_id' | 'title' | 'departure_city' | 'departure_country' | 'destination_city' | 'destination_country' | 'departure_date' | 'price_per_kg'
  > & {
    profiles: Pick<Profile, 'first_name' | 'last_name'> | null;
  };
};

const statusConfig: Record<string, { icon: string; color: string; bg: string }> = {
  pending: { icon: 'time-outline', color: colors.yellow600, bg: colors.yellow50 },
  approved: { icon: 'checkmark-circle-outline', color: colors.green700, bg: colors.green50 },
  rejected: { icon: 'close-circle-outline', color: colors.red700, bg: colors.red50 },
  cancelled: { icon: 'ban-outline', color: colors.gray600, bg: colors.gray100 },
  handed_over: { icon: 'swap-horizontal-outline', color: colors.primary, bg: colors.primaryBg },
  delivered: { icon: 'checkmark-done-outline', color: colors.green700, bg: colors.green50 },
};

export function MyBookingsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const [bookings, setBookings] = useState<BookingWithAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('booking_requests')
        .select('*, announcements(user_id, title, departure_city, departure_country, destination_city, destination_country, departure_date, price_per_kg, profiles:user_id(first_name, last_name))')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBookings((data as BookingWithAnnouncement[]) ?? []);
    } catch {
      setError(t('announcements.errors.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t]);

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [fetchBookings])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchBookings();
  }, [fetchBookings]);

  const handleCancel = (bookingId: string) => {
    Alert.alert(
      t('common.confirm'),
      t('announcements.cancelBooking') + ' ?',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            setCancellingId(bookingId);
            try {
              const { error: updateError } = await supabase
                .from('booking_requests')
                .update({ status: 'cancelled' })
                .eq('id', bookingId);

              if (updateError) throw updateError;

              setBookings((prev) =>
                prev.map((b) => (b.id === bookingId ? { ...b, status: 'cancelled' } : b))
              );
            } catch {
              Alert.alert(t('common.error'), t('announcements.cancelFailed'));
            } finally {
              setCancellingId(null);
            }
          },
        },
      ],
    );
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderBookingCard = ({ item }: { item: BookingWithAnnouncement }) => {
    const config = statusConfig[item.status] ?? statusConfig.pending;
    const ann = item.announcements;
    const totalPrice = item.requested_kilos * (ann?.price_per_kg ?? 0);
    const canCancel = item.status === 'pending';
    const isCancelling = cancellingId === item.id;
    const travelerName = ann?.profiles
      ? [ann.profiles.first_name, ann.profiles.last_name].filter(Boolean).join(' ') || t('chat.unknownUser')
      : t('chat.unknownUser');

    return (
      <View style={styles.card}>
        {/* Route */}
        <View style={styles.routeBlock}>
          <View style={styles.routeLine}>
            <View style={styles.routeDot} />
            <Text style={styles.cityText}>{ann?.departure_city}</Text>
            {ann?.departure_country ? (
              <Text style={styles.countryText}>, {ann.departure_country}</Text>
            ) : null}
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeLine}>
            <View style={[styles.routeDot, styles.routeDotEnd]} />
            <Text style={styles.cityText}>{ann?.destination_city}</Text>
            {ann?.destination_country ? (
              <Text style={styles.countryText}>, {ann.destination_country}</Text>
            ) : null}
          </View>
        </View>

        {/* Traveler */}
        <TouchableOpacity
          style={styles.travelerRow}
          onPress={() => ann?.user_id && navigation.navigate('PublicProfile', { userId: ann.user_id })}
        >
          <View style={styles.travelerAvatar}>
            <Ionicons name="person" size={12} color={colors.white} />
          </View>
          <Text style={styles.travelerLabel}>{t('announcements.traveler')}: </Text>
          <Text style={styles.travelerName}>{travelerName}</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.gray400} />
        </TouchableOpacity>

        {/* Title */}
        {ann?.title && (
          <Text style={styles.announcementTitle} numberOfLines={1}>{ann.title}</Text>
        )}

        {/* Details chips */}
        <View style={styles.detailsRow}>
          <View style={styles.detailChip}>
            <Ionicons name="calendar-outline" size={13} color={colors.gray500} />
            <Text style={styles.detailChipText}>{ann ? formatDate(ann.departure_date) : ''}</Text>
          </View>
          <View style={styles.detailChip}>
            <Ionicons name="cube-outline" size={13} color={colors.gray500} />
            <Text style={styles.detailChipText}>{item.requested_kilos} kg</Text>
          </View>
          <View style={styles.detailChip}>
            <Ionicons name="pricetag-outline" size={13} color={colors.gray500} />
            <Text style={styles.detailChipText}>{totalPrice.toFixed(2)}€</Text>
          </View>
        </View>

        {/* Status + date */}
        <View style={styles.statusRow}>
          <View style={[styles.statusChip, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon as any} size={14} color={config.color} />
            <Text style={[styles.statusChipText, { color: config.color }]}>
              {t(`bookingRequest.status.${item.status}`)}
            </Text>
          </View>
          <Text style={styles.requestDate}>
            {t('announcements.requestedOn')} {formatDate(item.created_at)}
          </Text>
        </View>

        {/* Message */}
        {item.message && (
          <View style={styles.messageBox}>
            <Ionicons name="chatbubble-outline" size={13} color={colors.gray400} />
            <Text style={styles.messageText} numberOfLines={2}>{item.message}</Text>
          </View>
        )}

        {/* Cancel action */}
        {canCancel && (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => handleCancel(item.id)}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color={colors.red600} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={16} color={colors.red600} />
                <Text style={styles.cancelButtonText}>{t('announcements.cancelBooking')}</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="document-text-outline" size={48} color={colors.gray300} />
      <Text style={styles.emptyTitle}>{t('announcements.noBookings')}</Text>
      <Text style={styles.emptySubtitle}>{t('announcements.noBookingsSubtitle')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('announcements.myBookings')}</Text>
        <Text style={styles.subtitle}>{t('announcements.myBookingsSubtitle')}</Text>

        {/* Segment control */}
        <View style={styles.segmentControl}>
          <TouchableOpacity
            style={styles.segmentButton}
            onPress={() => navigation.goBack()}
          >
            <Ionicons name="airplane" size={15} color={colors.gray500} />
            <Text style={styles.segmentText} numberOfLines={1}>{t('nav.myTrips', 'Mes trajets')}</Text>
          </TouchableOpacity>
          <View style={[styles.segmentButton, styles.segmentButtonActive]}>
            <Ionicons name="document-text-outline" size={15} color={colors.primary} />
            <Text style={styles.segmentTextActive} numberOfLines={1}>{t('nav.myBookings', 'Mes demandes')}</Text>
          </View>
        </View>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.red500} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchBookings}>
            <Text style={styles.retryText}>{t('announcements.errors.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={renderBookingCard}
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
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
    marginBottom: 12,
  },
  segmentControl: {
    flexDirection: 'row',
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
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
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  countryText: {
    fontSize: 13,
    color: colors.gray400,
  },
  travelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  travelerAvatar: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  travelerLabel: {
    fontSize: 12,
    color: colors.gray400,
  },
  travelerName: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.gray900,
    flex: 1,
  },
  announcementTitle: {
    fontSize: 13,
    color: colors.gray500,
    marginBottom: 10,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  detailChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.gray50,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  detailChipText: {
    fontSize: 12,
    color: colors.gray600,
    fontWeight: '500',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  requestDate: {
    fontSize: 12,
    color: colors.gray400,
  },
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.red500,
    marginTop: 4,
  },
  cancelButtonText: {
    color: colors.red600,
    fontWeight: '600',
    fontSize: 14,
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
