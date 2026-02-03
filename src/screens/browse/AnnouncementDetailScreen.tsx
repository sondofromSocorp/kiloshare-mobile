import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { Announcement, Profile, BookingRequest } from '../../lib/types';
import type { BrowseStackParamList } from '../../navigation/BrowseStack';

type DetailRouteProp = RouteProp<BrowseStackParamList, 'AnnouncementDetail'>;
type NavigationProp = NativeStackNavigationProp<BrowseStackParamList>;

type AnnouncementWithProfile = Announcement & {
  profiles: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
};

export function AnnouncementDetailScreen() {
  const { t } = useTranslation();
  const route = useRoute<DetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();
  const { announcementId } = route.params;

  const [announcement, setAnnouncement] = useState<AnnouncementWithProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Booking form
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [requestedKilos, setRequestedKilos] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [legalChecked, setLegalChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [existingRequest, setExistingRequest] = useState<BookingRequest | null>(null);

  const fetchAnnouncement = useCallback(async () => {
    try {
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('announcements')
        .select('*, profiles(first_name, last_name, avatar_url)')
        .eq('id', announcementId)
        .single();

      if (fetchError) throw fetchError;
      setAnnouncement(data as AnnouncementWithProfile);
    } catch {
      setError(t('announcements.errors.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [announcementId, t]);

  const checkExistingRequest = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('booking_requests')
      .select('*')
      .eq('announcement_id', announcementId)
      .eq('user_id', user.id)
      .in('status', ['pending', 'approved'])
      .maybeSingle();

    if (data) setExistingRequest(data as BookingRequest);
  }, [announcementId, user]);

  useEffect(() => {
    fetchAnnouncement();
    checkExistingRequest();
  }, [fetchAnnouncement, checkExistingRequest]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleSubmitBooking = async () => {
    if (!user || !announcement) return;

    const kilos = parseFloat(requestedKilos);
    if (isNaN(kilos) || kilos <= 0) {
      Alert.alert(t('common.error'), t('bookingRequest.errors.invalidKilos'));
      return;
    }
    if (kilos > announcement.available_space) {
      Alert.alert(
        t('common.error'),
        t('bookingRequest.errors.notEnoughSpace', { available: announcement.available_space }),
      );
      return;
    }
    if (!legalChecked) return;

    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('booking_requests').insert({
        user_id: user.id,
        announcement_id: announcement.id,
        requested_kilos: kilos,
        message: bookingMessage.trim() || null,
      });

      if (insertError) throw insertError;

      Alert.alert(t('common.success'), t('bookingRequest.title'));
      setShowBookingForm(false);
      setRequestedKilos('');
      setBookingMessage('');
      setLegalChecked(false);
      checkExistingRequest();
    } catch {
      Alert.alert(t('common.error'), t('bookingRequest.errors.generic'));
    } finally {
      setSubmitting(false);
    }
  };

  const isOwnAnnouncement = user?.id === announcement?.user_id;
  const totalPrice = parseFloat(requestedKilos) * (announcement?.price_per_kg ?? 0);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !announcement) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.red500} />
        <Text style={styles.errorText}>{error || t('announcements.errors.loadFailed')}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchAnnouncement}>
          <Text style={styles.retryText}>{t('announcements.errors.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const travelerName = [announcement.profiles?.first_name, announcement.profiles?.last_name]
    .filter(Boolean)
    .join(' ') || t('chat.unknownUser');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Route Header */}
      <View style={styles.routeCard}>
        <View style={styles.routeStop}>
          <View style={styles.routeDot} />
          <View style={styles.routeStopInfo}>
            <Text style={styles.routeLabel}>{t('announcements.filters.departureCity')}</Text>
            <Text style={styles.routeCityName}>{announcement.departure_city}</Text>
            <Text style={styles.routeCountry}>{announcement.departure_country}</Text>
          </View>
        </View>
        <View style={styles.routeConnector} />
        <View style={styles.routeStop}>
          <View style={[styles.routeDot, styles.routeDotEnd]} />
          <View style={styles.routeStopInfo}>
            <Text style={styles.routeLabel}>{t('announcements.filters.destinationCity')}</Text>
            <Text style={styles.routeCityName}>{announcement.destination_city}</Text>
            <Text style={styles.routeCountry}>{announcement.destination_country}</Text>
          </View>
        </View>
      </View>

      {/* Details */}
      <View style={styles.detailsCard}>
        <Text style={styles.announcementTitle}>{announcement.title}</Text>

        <View style={styles.detailRow}>
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>{t('announcements.filters.departureDate')}</Text>
            <Text style={styles.detailValue}>{formatDate(announcement.departure_date)}</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="cube-outline" size={18} color={colors.primary} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>{t('announcements.form.availableSpace')}</Text>
            <Text style={styles.detailValue}>{announcement.available_space} kg</Text>
          </View>
        </View>

        <View style={styles.detailRow}>
          <Ionicons name="pricetag-outline" size={18} color={colors.primary} />
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>{t('announcements.form.pricePerKg')}</Text>
            <Text style={styles.detailValue}>{announcement.price_per_kg}€ / kg</Text>
          </View>
        </View>

        {announcement.complementary_info && (
          <View style={styles.complementarySection}>
            <Text style={styles.complementaryLabel}>
              {t('announcements.form.complementaryInfo')}
            </Text>
            <Text style={styles.complementaryText}>{announcement.complementary_info}</Text>
          </View>
        )}
      </View>

      {/* Traveler */}
      <TouchableOpacity
        style={styles.travelerCard}
        onPress={() => navigation.navigate('PublicProfile', { userId: announcement.user_id })}
        activeOpacity={0.7}
      >
        <View style={styles.travelerInfo}>
          {announcement.profiles?.avatar_url ? (
            <Image
              source={{ uri: announcement.profiles.avatar_url }}
              style={styles.avatarImage}
            />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={20} color={colors.white} />
            </View>
          )}
          <View>
            <Text style={styles.travelerLabel}>{t('announcements.traveler')}</Text>
            <Text style={styles.travelerName}>{travelerName}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.gray400} />
      </TouchableOpacity>

      {/* Booking section */}
      {!isOwnAnnouncement && (
        <View style={styles.bookingSection}>
          {existingRequest ? (
            <View style={styles.existingRequestBanner}>
              <Ionicons name="checkmark-circle" size={20} color={colors.green600} />
              <Text style={styles.existingRequestText}>
                {t(`bookingRequest.status.${existingRequest.status}`)} — {existingRequest.requested_kilos}kg
              </Text>
            </View>
          ) : showBookingForm ? (
            <View style={styles.bookingForm}>
              <Text style={styles.bookingFormTitle}>{t('bookingRequest.title')}</Text>

              <Text style={styles.fieldLabel}>{t('bookingRequest.requestedKilos')}</Text>
              <View style={styles.kilosInputRow}>
                <TextInput
                  style={styles.kilosInput}
                  placeholder="0"
                  placeholderTextColor={colors.gray400}
                  value={requestedKilos}
                  onChangeText={setRequestedKilos}
                  keyboardType="numeric"
                />
                <Text style={styles.kilosUnit}>kg</Text>
              </View>
              <Text style={styles.availableHint}>
                {t('bookingRequest.availableSpace', { available: announcement.available_space })}
              </Text>

              {requestedKilos && !isNaN(parseFloat(requestedKilos)) && (
                <View style={styles.priceEstimate}>
                  <Text style={styles.priceEstimateText}>
                    {t('announcements.totalPrice')}: {totalPrice.toFixed(2)}€
                  </Text>
                </View>
              )}

              <Text style={styles.fieldLabel}>{t('bookingRequest.message')}</Text>
              <TextInput
                style={styles.messageInput}
                placeholder={t('bookingRequest.messagePlaceholder')}
                placeholderTextColor={colors.gray400}
                value={bookingMessage}
                onChangeText={setBookingMessage}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setLegalChecked(!legalChecked)}
              >
                <Ionicons
                  name={legalChecked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={legalChecked ? colors.primary : colors.gray400}
                />
                <Text style={styles.checkboxText}>{t('bookingRequest.legalCheckbox')}</Text>
              </TouchableOpacity>

              <View style={styles.formActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setShowBookingForm(false)}
                >
                  <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.submitBtn,
                    (!legalChecked || submitting) && styles.submitBtnDisabled,
                  ]}
                  onPress={handleSubmitBooking}
                  disabled={!legalChecked || submitting}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.submitBtnText}>{t('bookingRequest.submit')}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.bookButton}
              onPress={() => setShowBookingForm(true)}
            >
              <Ionicons name="send" size={18} color={colors.white} />
              <Text style={styles.bookButtonText}>{t('announcements.browse.book')}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
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

  // Route card
  routeCard: {
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
  routeStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    marginTop: 18,
    marginRight: 12,
  },
  routeDotEnd: {
    backgroundColor: colors.green600,
  },
  routeStopInfo: {
    flex: 1,
  },
  routeConnector: {
    width: 2,
    height: 16,
    backgroundColor: colors.gray200,
    marginLeft: 5,
    marginVertical: 2,
  },
  routeLabel: {
    fontSize: 11,
    color: colors.gray400,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  routeCityName: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
  },
  routeCountry: {
    fontSize: 13,
    color: colors.gray500,
    marginTop: 2,
  },

  // Details card
  detailsCard: {
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
  announcementTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 14,
    gap: 12,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    color: colors.gray400,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 15,
    color: colors.gray800,
    fontWeight: '500',
  },
  complementarySection: {
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
  },
  complementaryLabel: {
    fontSize: 12,
    color: colors.gray400,
    marginBottom: 6,
  },
  complementaryText: {
    fontSize: 14,
    color: colors.gray700,
    lineHeight: 20,
  },

  // Traveler card
  travelerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
  travelerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  travelerLabel: {
    fontSize: 12,
    color: colors.gray400,
  },
  travelerName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.gray900,
  },

  // Booking section
  bookingSection: {
    marginTop: 4,
  },
  bookButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    ...Platform.select({
      ios: {
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  bookButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '700',
  },
  existingRequestBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.green50,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.green500,
  },
  existingRequestText: {
    fontSize: 14,
    color: colors.green700,
    fontWeight: '600',
  },

  // Booking form
  bookingForm: {
    backgroundColor: colors.white,
    borderRadius: 12,
    padding: 20,
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
  bookingFormTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    marginBottom: 6,
    marginTop: 12,
  },
  kilosInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 12,
  },
  kilosInput: {
    flex: 1,
    fontSize: 16,
    color: colors.gray900,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  kilosUnit: {
    fontSize: 14,
    color: colors.gray500,
    fontWeight: '600',
  },
  availableHint: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: 4,
  },
  priceEstimate: {
    backgroundColor: colors.primaryBg,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  priceEstimateText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
    textAlign: 'center',
  },
  messageInput: {
    backgroundColor: colors.gray50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.gray900,
    minHeight: 80,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 16,
  },
  checkboxText: {
    fontSize: 13,
    color: colors.gray600,
    flex: 1,
    lineHeight: 18,
  },
  formActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: colors.gray600,
    fontWeight: '600',
    fontSize: 14,
  },
  submitBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 14,
  },
});
