import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Clipboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useChat } from '../../hooks/useChat';
import {
  confirmHandoff,
  fetchHandoffStep,
  fetchDeliveryCode,
  validateDeliveryCode,
  submitRating,
  fetchRatingForBooking,
} from '../../lib/chat';
import type { MessageWithSender, HandoffStep, BookingRequest } from '../../lib/types';
import type { MessagesStackParamList } from '../../navigation/MessagesStack';

type ChatRouteProp = RouteProp<MessagesStackParamList, 'Chat'>;
type ChatNavProp = NativeStackNavigationProp<MessagesStackParamList, 'Chat'>;

export function ChatScreen() {
  const { t } = useTranslation();
  const route = useRoute<ChatRouteProp>();
  const navigation = useNavigation<ChatNavProp>();
  const { user } = useAuth();
  const { bookingRequestId } = route.params;

  const { messages, loading, error, send, markRead } = useChat(bookingRequestId, user?.id);
  const flatListRef = useRef<FlatList>(null);

  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

  // Handoff state
  const [handoffStep, setHandoffStep] = useState<HandoffStep>('none');
  const [deliveryCode, setDeliveryCode] = useState<string | null>(null);
  const [isSender, setIsSender] = useState(false);
  const [isTraveler, setIsTraveler] = useState(false);
  const [handoffLoading, setHandoffLoading] = useState(false);

  // Rating state
  const [showRating, setShowRating] = useState(false);
  const [ratingScore, setRatingScore] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [otherUserId, setOtherUserId] = useState<string | null>(null);
  const [otherUserName, setOtherUserName] = useState('');

  // Load booking context
  useEffect(() => {
    if (!user) return;

    const loadBookingContext = async () => {
      const { data: booking } = await supabase
        .from('booking_requests')
        .select('user_id, announcement_id, status')
        .eq('id', bookingRequestId)
        .single();

      if (!booking) return;

      const { data: ann } = await supabase
        .from('announcements')
        .select('user_id')
        .eq('id', booking.announcement_id)
        .single();

      if (!ann) return;

      const userIsSender = booking.user_id === user.id;
      const userIsTraveler = ann.user_id === user.id;
      setIsSender(userIsSender);
      setIsTraveler(userIsTraveler);

      const otherId = userIsSender ? ann.user_id : booking.user_id;
      setOtherUserId(otherId);

      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', otherId)
        .single();

      const firstName = profile?.first_name || t('chat.unknownUser');
      const fullName = profile
        ? [profile.first_name, profile.last_name].filter(Boolean).join(' ') || t('chat.unknownUser')
        : t('chat.unknownUser');
      setOtherUserName(fullName);

      const initial = profile?.first_name?.[0]?.toUpperCase() || '?';

      navigation.setOptions({
        headerTitle: () => (
          <TouchableOpacity
            style={headerStyles.headerColumn}
            onPress={() => navigation.navigate('PublicProfile', { userId: otherId })}
            activeOpacity={0.7}
          >
            <View style={headerStyles.avatar}>
              <Text style={headerStyles.avatarText}>{initial}</Text>
            </View>
            <Text style={headerStyles.headerName} numberOfLines={1}>{firstName}</Text>
          </TouchableOpacity>
        ),
      });

      // Check handoff
      const step = await fetchHandoffStep(bookingRequestId);
      setHandoffStep(step);

      if (step === 'handed_over' || step === 'delivered') {
        const code = await fetchDeliveryCode(bookingRequestId);
        setDeliveryCode(code);
      }

      // Check if rating already submitted
      if (booking.status === 'delivered' || step === 'delivered') {
        const existing = await fetchRatingForBooking(bookingRequestId, user.id);
        if (!existing) {
          setShowRating(true);
        }
      }
    };

    loadBookingContext();
  }, [bookingRequestId, user, t]);

  // Mark messages as read
  useEffect(() => {
    if (messages.length > 0) {
      markRead();
    }
  }, [messages.length, markRead]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || sending) return;

    setSending(true);
    setInputText('');

    try {
      // Check if message is a delivery code
      if (handoffStep === 'handed_over' && isSender) {
        const valid = await validateDeliveryCode(bookingRequestId, text, user!.id);
        if (valid) {
          setHandoffStep('delivered');
          setShowRating(true);
          return;
        }
      }

      await send(text);
    } catch {
      Alert.alert(t('common.error'), t('announcements.errors.loadFailed'));
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  const handleHandoffAction = async () => {
    if (!user || handoffLoading) return;
    setHandoffLoading(true);

    try {
      if (isSender && handoffStep === 'none') {
        await confirmHandoff(bookingRequestId, user.id, 'sender_confirmed');
        setHandoffStep('sender_confirmed');
      } else if (isTraveler && handoffStep === 'sender_confirmed') {
        const code = await confirmHandoff(bookingRequestId, user.id, 'handed_over');
        setHandoffStep('handed_over');
        if (code) setDeliveryCode(code);
      }
    } catch {
      Alert.alert(t('common.error'), t('announcements.errors.loadFailed'));
    } finally {
      setHandoffLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (deliveryCode) {
      Clipboard.setString(deliveryCode);
      Alert.alert('', t('handoff.codeCopied'));
    }
  };

  const handleSubmitRating = async () => {
    if (!user || !otherUserId || ratingScore === 0) return;
    setRatingSubmitting(true);
    try {
      await submitRating(
        bookingRequestId,
        user.id,
        otherUserId,
        ratingScore,
        ratingComment.trim() || undefined
      );
      setShowRating(false);
      Alert.alert('', t('rating.submitted'));
    } catch {
      Alert.alert(t('common.error'), t('announcements.errors.loadFailed'));
    } finally {
      setRatingSubmitting(false);
    }
  };

  const parseSystemMessage = (content: string): string | null => {
    if (content === '[HANDOFF] sender_confirmed') return t('handoff.systemMessages.senderConfirmed');
    if (content === '[HANDOFF] handed_over') return t('handoff.systemMessages.handedOver');
    if (content === '[HANDOFF] delivered') return t('handoff.systemMessages.delivered');
    return null;
  };

  const renderMessage = ({ item }: { item: MessageWithSender }) => {
    const isMe = item.sender_id === user?.id;
    const systemText = (item.is_system || item.content.startsWith('[HANDOFF]')) ? parseSystemMessage(item.content) : null;

    if (systemText) {
      return (
        <View style={styles.systemMessageContainer}>
          <View style={styles.systemMessageBubble}>
            <Ionicons name="information-circle-outline" size={14} color={colors.primary} />
            <Text style={styles.systemMessageText}>{systemText}</Text>
          </View>
        </View>
      );
    }

    const time = new Date(item.created_at).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {item.content}
          </Text>
          <View style={styles.messageFooter}>
            <Text style={[styles.messageTime, isMe && styles.messageTimeMe]}>{time}</Text>
            {isMe && item.read_at && (
              <Ionicons name="checkmark-done" size={14} color={colors.primaryLight} style={styles.readIcon} />
            )}
          </View>
        </View>
      </View>
    );
  };

  // Handoff banner
  const renderHandoffBanner = () => {
    if (handoffStep === 'delivered') return null;

    // Sender: confirm handover
    if (isSender && handoffStep === 'none') {
      return (
        <TouchableOpacity style={styles.handoffBanner} onPress={handleHandoffAction} disabled={handoffLoading}>
          {handoffLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="cube-outline" size={18} color={colors.white} />
              <Text style={styles.handoffBannerText}>{t('handoff.senderConfirmHandover')}</Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    // Waiting for traveler confirmation
    if (isSender && handoffStep === 'sender_confirmed') {
      return (
        <View style={styles.waitingBanner}>
          <ActivityIndicator size="small" color={colors.yellow600} />
          <Text style={styles.waitingBannerText}>{t('handoff.waitingConfirmation')}</Text>
        </View>
      );
    }

    // Traveler: confirm reception
    if (isTraveler && handoffStep === 'sender_confirmed') {
      return (
        <TouchableOpacity style={styles.handoffBannerGreen} onPress={handleHandoffAction} disabled={handoffLoading}>
          {handoffLoading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={18} color={colors.white} />
              <Text style={styles.handoffBannerText}>{t('handoff.travelerConfirmReception')}</Text>
            </>
          )}
        </TouchableOpacity>
      );
    }

    // Delivery code display
    if (handoffStep === 'handed_over' && deliveryCode) {
      if (isTraveler) {
        return (
          <View style={styles.deliveryCodeBanner}>
            <Text style={styles.deliveryCodeLabel}>{t('handoff.deliveryCode')}</Text>
            <View style={styles.deliveryCodeRow}>
              <Text style={styles.deliveryCodeText}>{deliveryCode}</Text>
              <TouchableOpacity onPress={handleCopyCode} style={styles.copyButton}>
                <Ionicons name="copy-outline" size={16} color={colors.primary} />
                <Text style={styles.copyButtonText}>{t('handoff.copyCode')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      }
      if (isSender) {
        return (
          <View style={styles.codeHintBanner}>
            <Ionicons name="key-outline" size={16} color={colors.primary} />
            <Text style={styles.codeHintText}>{t('handoff.enterCodeHint')}</Text>
          </View>
        );
      }
    }

    return null;
  };

  // Rating widget
  const renderRatingWidget = () => {
    if (!showRating) return null;

    return (
      <View style={styles.ratingContainer}>
        <Text style={styles.ratingTitle}>{t('rating.title')}</Text>
        <Text style={styles.ratingSubtitle}>
          {t('rating.subtitle', { name: otherUserName })}
        </Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <TouchableOpacity key={star} onPress={() => setRatingScore(star)}>
              <Ionicons
                name={star <= ratingScore ? 'star' : 'star-outline'}
                size={32}
                color={star <= ratingScore ? colors.yellow500 : colors.gray300}
              />
            </TouchableOpacity>
          ))}
        </View>
        {ratingScore > 0 && (
          <Text style={styles.ratingLabel}>
            {t(`rating.labels.${ratingScore}`)}
          </Text>
        )}
        <TextInput
          style={styles.ratingInput}
          placeholder={t('rating.commentPlaceholder')}
          placeholderTextColor={colors.gray400}
          value={ratingComment}
          onChangeText={setRatingComment}
          multiline
          numberOfLines={2}
        />
        <TouchableOpacity
          style={[styles.ratingSubmitBtn, ratingScore === 0 && styles.ratingSubmitDisabled]}
          onPress={handleSubmitRating}
          disabled={ratingScore === 0 || ratingSubmitting}
        >
          {ratingSubmitting ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.ratingSubmitText}>{t('rating.submit')}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

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
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Handoff banner */}
      {renderHandoffBanner()}

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => {
          flatListRef.current?.scrollToEnd({ animated: false });
        }}
      />

      {/* Rating widget */}
      {renderRatingWidget()}

      {/* Input bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder={t('chat.inputPlaceholder')}
          placeholderTextColor={colors.gray400}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={2000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!inputText.trim() || sending) && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="send" size={18} color={colors.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.gray50,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    padding: 24,
  },
  errorText: {
    fontSize: 14,
    color: colors.gray600,
    marginTop: 12,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
  },

  // Messages
  messageRow: {
    flexDirection: 'row',
    marginBottom: 8,
    justifyContent: 'flex-start',
  },
  messageRowMe: {
    justifyContent: 'flex-end',
  },
  messageBubble: {
    maxWidth: '78%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
  },
  bubbleMe: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: colors.white,
    borderBottomLeftRadius: 4,
    ...Platform.select({
      ios: {
        shadowColor: colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 1 },
    }),
  },
  messageText: {
    fontSize: 15,
    color: colors.gray900,
    lineHeight: 20,
  },
  messageTextMe: {
    color: colors.white,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 11,
    color: colors.gray400,
  },
  messageTimeMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  readIcon: {
    marginLeft: 4,
  },

  // System messages
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 12,
  },
  systemMessageBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryBg,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
  },
  systemMessageText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  textInput: {
    flex: 1,
    backgroundColor: colors.gray50,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: Platform.OS === 'ios' ? 10 : 8,
    fontSize: 15,
    color: colors.gray900,
    maxHeight: 100,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  sendButtonDisabled: {
    backgroundColor: colors.gray300,
  },

  // Handoff banners
  handoffBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  handoffBannerGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.green600,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  handoffBannerText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.yellow50,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  waitingBannerText: {
    color: colors.yellow600,
    fontWeight: '500',
    fontSize: 13,
  },
  deliveryCodeBanner: {
    backgroundColor: colors.green50,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.green500,
  },
  deliveryCodeLabel: {
    fontSize: 12,
    color: colors.green700,
    fontWeight: '600',
    marginBottom: 6,
  },
  deliveryCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deliveryCodeText: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.green700,
    letterSpacing: 2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: colors.white,
  },
  copyButtonText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  codeHintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryBg,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  codeHintText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
    flex: 1,
  },

  // Rating
  ratingContainer: {
    backgroundColor: colors.white,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  ratingTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    textAlign: 'center',
  },
  ratingSubtitle: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 12,
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  ratingLabel: {
    fontSize: 13,
    color: colors.gray500,
    textAlign: 'center',
    marginBottom: 10,
  },
  ratingInput: {
    backgroundColor: colors.gray50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: colors.gray900,
    minHeight: 50,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  ratingSubmitBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ratingSubmitDisabled: {
    opacity: 0.5,
  },
  ratingSubmitText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});

const headerStyles = StyleSheet.create({
  headerColumn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  headerName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.gray900,
    marginTop: 2,
    maxWidth: 120,
  },
});
