import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { fetchConversations } from '../../lib/chat';
import { useAuth } from '../../lib/auth';
import type { ConversationSummary } from '../../lib/types';
import type { MessagesStackParamList } from '../../navigation/MessagesStack';

type NavigationProp = NativeStackNavigationProp<MessagesStackParamList>;

export function ConversationsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) return;
    try {
      setError(null);
      const data = await fetchConversations(user.id);
      setConversations(data);
    } catch {
      setError(t('announcements.errors.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user, t]);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, [loadConversations]);

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    if (diffDays === 1) return 'Hier';
    if (diffDays < 7) {
      return date.toLocaleDateString(undefined, { weekday: 'short' });
    }
    return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };

  const formatLastMessage = (content: string | null): string => {
    if (!content) return t('chat.noConversations');
    if (content === '[HANDOFF] sender_confirmed') return t('handoff.systemMessages.senderConfirmed');
    if (content === '[HANDOFF] handed_over') return t('handoff.systemMessages.handedOver');
    if (content === '[HANDOFF] delivered') return t('handoff.systemMessages.delivered');
    return content;
  };

  const renderConversation = ({ item }: { item: ConversationSummary }) => {
    const name = [item.other_user.first_name, item.other_user.last_name]
      .filter(Boolean)
      .join(' ') || t('chat.unknownUser');

    const route = `${item.announcement.departure_city} → ${item.announcement.destination_city}`;
    const hasUnread = item.unread_count > 0;

    return (
      <TouchableOpacity
        style={styles.conversationCard}
        onPress={() => navigation.navigate('Chat', { bookingRequestId: item.booking_request_id })}
        activeOpacity={0.7}
      >
        {/* Avatar */}
        <View style={[styles.avatar, hasUnread && styles.avatarUnread]}>
          <Ionicons name="person" size={18} color={colors.white} />
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.topRow}>
            <Text style={[styles.name, hasUnread && styles.nameUnread]} numberOfLines={1}>
              {name}
            </Text>
            <Text style={[styles.time, hasUnread && styles.timeUnread]}>
              {formatTime(item.last_message_at)}
            </Text>
          </View>

          <Text style={styles.route} numberOfLines={1}>
            <Ionicons name="airplane-outline" size={11} color={colors.gray400} /> {route}
          </Text>

          <View style={styles.bottomRow}>
            <Text
              style={[styles.lastMessage, hasUnread && styles.lastMessageUnread]}
              numberOfLines={1}
            >
              {formatLastMessage(item.last_message)}
            </Text>
            {hasUnread && (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {item.unread_count > 99 ? '99+' : item.unread_count}
                </Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="chatbubbles-outline" size={48} color={colors.gray300} />
      <Text style={styles.emptyTitle}>{t('chat.noConversations')}</Text>
      <Text style={styles.emptySubtitle}>{t('chat.noConversationsSubtitle')}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('chat.conversations')}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.red500} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadConversations}>
            <Text style={styles.retryText}>{t('announcements.errors.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.booking_request_id}
          renderItem={renderConversation}
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
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
  },
  listContent: {
    flexGrow: 1,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.gray400,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarUnread: {
    backgroundColor: colors.primary,
  },
  content: {
    flex: 1,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 2,
  },
  name: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.gray900,
    flex: 1,
    marginRight: 8,
  },
  nameUnread: {
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    color: colors.gray400,
  },
  timeUnread: {
    color: colors.primary,
    fontWeight: '600',
  },
  route: {
    fontSize: 12,
    color: colors.gray400,
    marginBottom: 4,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lastMessage: {
    fontSize: 13,
    color: colors.gray500,
    flex: 1,
    marginRight: 8,
  },
  lastMessageUnread: {
    color: colors.gray800,
    fontWeight: '600',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '700',
  },
  separator: {
    height: 1,
    backgroundColor: colors.gray100,
    marginLeft: 80,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
