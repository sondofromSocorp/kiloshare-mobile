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
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import type { BookingRequest, Profile } from '../../lib/types';
import type { AnnouncementsStackParamList } from '../../navigation/AnnouncementsStack';

type BookingRouteProp = RouteProp<AnnouncementsStackParamList, 'BookingRequests'>;

type BookingRequestWithProfile = BookingRequest & {
  profiles: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
};

const statusConfig: Record<string, { icon: string; color: string; bg: string }> = {
  pending: { icon: 'time-outline', color: colors.yellow600, bg: colors.yellow50 },
  approved: { icon: 'checkmark-circle-outline', color: colors.green700, bg: colors.green50 },
  rejected: { icon: 'close-circle-outline', color: colors.red700, bg: colors.red50 },
  cancelled: { icon: 'ban-outline', color: colors.gray600, bg: colors.gray100 },
  handed_over: { icon: 'swap-horizontal-outline', color: colors.primary, bg: colors.primaryBg },
  delivered: { icon: 'checkmark-done-outline', color: colors.green700, bg: colors.green50 },
};

export function BookingRequestsScreen() {
  const { t } = useTranslation();
  const route = useRoute<BookingRouteProp>();
  const navigation = useNavigation<NativeStackNavigationProp<AnnouncementsStackParamList>>();
  const { announcementId } = route.params;

  const [requests, setRequests] = useState<BookingRequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('booking_requests')
        .select('*, profiles(first_name, last_name, avatar_url)')
        .eq('announcement_id', announcementId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setRequests((data as BookingRequestWithProfile[]) ?? []);
    } catch {
      setError(t('bookingRequest.errors.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [announcementId, t]);

  useFocusEffect(
    useCallback(() => {
      fetchRequests();
    }, [fetchRequests])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchRequests();
  }, [fetchRequests]);

  const handleUpdateStatus = async (requestId: string, newStatus: 'approved' | 'rejected') => {
    setUpdatingId(requestId);
    try {
      const { error: updateError } = await supabase
        .from('booking_requests')
        .update({ status: newStatus })
        .eq('id', requestId);

      if (updateError) throw updateError;

      setRequests((prev) =>
        prev.map((r) => (r.id === requestId ? { ...r, status: newStatus } : r))
      );
    } catch {
      Alert.alert(t('common.error'), t('bookingRequest.errors.updateFailed'));
    } finally {
      setUpdatingId(null);
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

  const renderRequestCard = ({ item }: { item: BookingRequestWithProfile }) => {
    const senderName = [item.profiles?.first_name, item.profiles?.last_name]
      .filter(Boolean)
      .join(' ') || t('chat.unknownUser');

    const config = statusConfig[item.status] ?? statusConfig.pending;
    const isPending = item.status === 'pending';
    const isUpdating = updatingId === item.id;

    return (
      <View style={styles.card}>
        {/* Sender info */}
        <TouchableOpacity
          style={styles.senderRow}
          onPress={() => navigation.navigate('PublicProfile', { userId: item.user_id })}
        >
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={16} color={colors.white} />
          </View>
          <View style={styles.senderInfo}>
            <Text style={styles.senderName}>{senderName}</Text>
            <Text style={styles.requestDate}>
              {t('announcements.requestedOn')} {formatDate(item.created_at)}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.gray400} />
        </TouchableOpacity>

        {/* Request details */}
        <View style={styles.requestDetails}>
          <View style={styles.detailChip}>
            <Ionicons name="cube-outline" size={14} color={colors.gray600} />
            <Text style={styles.detailChipText}>{item.requested_kilos} kg</Text>
          </View>
          <View style={styles.detailChip}>
            <Ionicons name="pricetag-outline" size={14} color={colors.gray600} />
            <Text style={styles.detailChipText}>
              {t('announcements.totalPrice')}: {(item.requested_kilos * 0).toFixed(2)}€
            </Text>
          </View>
          <View style={[styles.statusChip, { backgroundColor: config.bg }]}>
            <Ionicons name={config.icon as any} size={14} color={config.color} />
            <Text style={[styles.statusChipText, { color: config.color }]}>
              {t(`bookingRequest.status.${item.status}`)}
            </Text>
          </View>
        </View>

        {/* Message */}
        {item.message && (
          <View style={styles.messageBox}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.gray400} />
            <Text style={styles.messageText} numberOfLines={3}>{item.message}</Text>
          </View>
        )}

        {/* Actions for pending requests */}
        {isPending && (
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.rejectButton}
              onPress={() => handleUpdateStatus(item.id, 'rejected')}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={colors.red600} />
              ) : (
                <>
                  <Ionicons name="close" size={16} color={colors.red600} />
                  <Text style={styles.rejectButtonText}>{t('bookingRequest.reject')}</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.approveButton}
              onPress={() => handleUpdateStatus(item.id, 'approved')}
              disabled={isUpdating}
            >
              {isUpdating ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark" size={16} color={colors.white} />
                  <Text style={styles.approveButtonText}>{t('bookingRequest.approve')}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="people-outline" size={48} color={colors.gray300} />
      <Text style={styles.emptyTitle}>{t('bookingRequest.noRequests')}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Ionicons name="cloud-offline-outline" size={48} color={colors.red500} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchRequests}>
          <Text style={styles.retryText}>{t('announcements.errors.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={requests}
      keyExtractor={(item) => item.id}
      renderItem={renderRequestCard}
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
      style={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 24,
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
  senderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  senderInfo: {
    flex: 1,
    marginLeft: 10,
  },
  senderName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
  },
  requestDate: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: 2,
  },
  requestDetails: {
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
    fontSize: 13,
    color: colors.gray600,
    fontWeight: '500',
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
  messageBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: colors.gray50,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  messageText: {
    flex: 1,
    fontSize: 13,
    color: colors.gray600,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 12,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.red500,
  },
  rejectButtonText: {
    color: colors.red600,
    fontWeight: '600',
    fontSize: 14,
  },
  approveButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.green600,
  },
  approveButtonText: {
    color: colors.white,
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
    fontSize: 16,
    fontWeight: '600',
    color: colors.gray500,
    marginTop: 16,
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
