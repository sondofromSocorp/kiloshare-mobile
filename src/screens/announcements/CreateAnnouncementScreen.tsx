import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { announcementSchema } from '../../lib/validation';
import { searchCities } from '../../lib/airlabs';
import type { City } from '../../lib/types';
import type { AnnouncementsStackParamList } from '../../navigation/AnnouncementsStack';

type CreateRouteProp = RouteProp<AnnouncementsStackParamList, 'CreateAnnouncement'>;

export function CreateAnnouncementScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const route = useRoute<CreateRouteProp>();
  const { user } = useAuth();

  const editId = route.params?.announcementId;
  const isEdit = !!editId;

  const [title, setTitle] = useState('');
  const [departureCity, setDepartureCity] = useState('');
  const [departureCountry, setDepartureCountry] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationCountry, setDestinationCountry] = useState('');
  const [departureDate, setDepartureDate] = useState(new Date());
  const [availableSpace, setAvailableSpace] = useState('');
  const [pricePerKg, setPricePerKg] = useState('');
  const [complementaryInfo, setComplementaryInfo] = useState('');

  const [departureSearch, setDepartureSearch] = useState('');
  const [destinationSearch, setDestinationSearch] = useState('');
  const [departureCities, setDepartureCities] = useState<City[]>([]);
  const [destinationCities, setDestinationCities] = useState<City[]>([]);

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(isEdit);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const departureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destinationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchAnnouncement = useCallback(async () => {
    if (!editId) return;
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('id', editId)
        .single();

      if (error) throw error;
      if (data) {
        setTitle(data.title);
        setDepartureCity(data.departure_city);
        setDepartureCountry(data.departure_country);
        setDepartureSearch(data.departure_city);
        setDestinationCity(data.destination_city);
        setDestinationCountry(data.destination_country);
        setDestinationSearch(data.destination_city);
        setDepartureDate(new Date(data.departure_date));
        setAvailableSpace(String(data.available_space));
        setPricePerKg(String(data.price_per_kg));
        setComplementaryInfo(data.complementary_info ?? '');
      }
    } catch {
      Alert.alert(t('common.error'), t('announcements.errors.loadFailed'));
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  }, [editId, t, navigation]);

  useEffect(() => {
    if (isEdit) fetchAnnouncement();
  }, [isEdit, fetchAnnouncement]);

  // Debounced search for departure cities
  useEffect(() => {
    if (departureTimer.current) clearTimeout(departureTimer.current);
    if (departureSearch.length < 2) {
      setDepartureCities([]);
      return;
    }
    departureTimer.current = setTimeout(async () => {
      try {
        const cities = await searchCities(departureSearch);
        setDepartureCities(cities);
      } catch {
        setDepartureCities([]);
      }
    }, 300);
    return () => { if (departureTimer.current) clearTimeout(departureTimer.current); };
  }, [departureSearch]);

  // Debounced search for destination cities
  useEffect(() => {
    if (destinationTimer.current) clearTimeout(destinationTimer.current);
    if (destinationSearch.length < 2) {
      setDestinationCities([]);
      return;
    }
    destinationTimer.current = setTimeout(async () => {
      try {
        const cities = await searchCities(destinationSearch);
        setDestinationCities(cities);
      } catch {
        setDestinationCities([]);
      }
    }, 300);
    return () => { if (destinationTimer.current) clearTimeout(destinationTimer.current); };
  }, [destinationSearch]);

  const handleDepartureSelect = (city: City) => {
    setDepartureCity(city.name);
    setDepartureCountry(city.country_code);
    setDepartureSearch(city.name);
    setDepartureCities([]);
  };

  const handleDestinationSelect = (city: City) => {
    setDestinationCity(city.name);
    setDestinationCountry(city.country_code);
    setDestinationSearch(city.name);
    setDestinationCities([]);
  };

  const onDepartureSearchChange = (text: string) => {
    setDepartureSearch(text);
    setDepartureCity('');
    setDepartureCountry('');
  };

  const onDestinationSearchChange = (text: string) => {
    setDestinationSearch(text);
    setDestinationCity('');
    setDestinationCountry('');
  };

  const onDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (event.type === 'set' && selectedDate) {
      setDepartureDate(selectedDate);
    }
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const handleSubmit = async () => {
    if (!user) return;

    const formData = {
      title: title.trim(),
      departure_city: departureCity.trim(),
      departure_country: departureCountry.trim(),
      destination_city: destinationCity.trim(),
      destination_country: destinationCountry.trim(),
      departure_date: departureDate.toISOString().split('T')[0],
      available_space: parseFloat(availableSpace) || 0,
      price_per_kg: parseFloat(pricePerKg) || 0,
      complementary_info: complementaryInfo.trim() || undefined,
    };

    const result = announcementSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.issues.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      if (isEdit) {
        const { error: updateError } = await supabase
          .from('announcements')
          .update(formData)
          .eq('id', editId);

        if (updateError) throw updateError;
      } else {
        const { error: insertError } = await supabase
          .from('announcements')
          .insert({ ...formData, user_id: user.id });

        if (insertError) throw insertError;
      }

      navigation.goBack();
    } catch {
      Alert.alert(t('common.error'), t('announcements.errors.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>
          {isEdit ? t('announcements.form.editTitle') : t('announcements.form.title')}
        </Text>

        {/* Title */}
        <Text style={styles.label}>{t('announcements.form.announcementTitle')}</Text>
        <TextInput
          style={[styles.input, errors.title && styles.inputError]}
          placeholder={t('announcements.form.announcementTitlePlaceholder')}
          placeholderTextColor={colors.gray400}
          value={title}
          onChangeText={setTitle}
        />
        {errors.title && <Text style={styles.errorText}>{errors.title}</Text>}

        {/* Departure city + country */}
        <Text style={styles.label}>{t('announcements.form.departureCity')}</Text>
        <View style={styles.autocompleteContainer}>
          <TextInput
            style={[styles.input, errors.departure_city && styles.inputError]}
            placeholder={t('announcements.form.departureCityPlaceholder')}
            placeholderTextColor={colors.gray400}
            value={departureSearch}
            onChangeText={onDepartureSearchChange}
          />
          {departureCities.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {departureCities.map((city) => (
                <TouchableOpacity
                  key={city.city_code}
                  style={styles.suggestionItem}
                  onPress={() => handleDepartureSelect(city)}
                >
                  <Ionicons name="airplane-outline" size={16} color={colors.primary} />
                  <Text style={styles.suggestionText}>{city.name}</Text>
                  <Text style={styles.suggestionCountry}>{city.country_code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {errors.departure_city && <Text style={styles.errorText}>{errors.departure_city}</Text>}
        {departureCountry !== '' && (
          <View style={styles.countryBadge}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.countryBadgeText}>{departureCountry}</Text>
          </View>
        )}

        {/* Destination city + country */}
        <Text style={styles.label}>{t('announcements.form.destinationCity')}</Text>
        <View style={styles.autocompleteContainer}>
          <TextInput
            style={[styles.input, errors.destination_city && styles.inputError]}
            placeholder={t('announcements.form.destinationCityPlaceholder')}
            placeholderTextColor={colors.gray400}
            value={destinationSearch}
            onChangeText={onDestinationSearchChange}
          />
          {destinationCities.length > 0 && (
            <View style={styles.suggestionsContainer}>
              {destinationCities.map((city) => (
                <TouchableOpacity
                  key={city.city_code}
                  style={styles.suggestionItem}
                  onPress={() => handleDestinationSelect(city)}
                >
                  <Ionicons name="airplane-outline" size={16} color={colors.primary} />
                  <Text style={styles.suggestionText}>{city.name}</Text>
                  <Text style={styles.suggestionCountry}>{city.country_code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
        {errors.destination_city && <Text style={styles.errorText}>{errors.destination_city}</Text>}
        {destinationCountry !== '' && (
          <View style={styles.countryBadge}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.countryBadgeText}>{destinationCountry}</Text>
          </View>
        )}

        {/* Departure date */}
        <Text style={styles.label}>{t('announcements.form.departureDate')}</Text>
        <TouchableOpacity
          style={[styles.input, styles.dateButton]}
          onPress={() => setShowDatePicker(true)}
        >
          <Ionicons name="calendar-outline" size={18} color={colors.primary} />
          <Text style={styles.dateText}>{formatDateDisplay(departureDate)}</Text>
        </TouchableOpacity>
        {errors.departure_date && <Text style={styles.errorText}>{errors.departure_date}</Text>}

        {showDatePicker && (
          <DateTimePicker
            value={departureDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            minimumDate={new Date()}
            onChange={onDateChange}
          />
        )}

        {/* Available space */}
        <Text style={styles.label}>{t('announcements.form.availableSpace')}</Text>
        <View style={styles.unitInputRow}>
          <TextInput
            style={[styles.input, styles.flex, errors.available_space && styles.inputError]}
            placeholder={t('announcements.form.availableSpacePlaceholder')}
            placeholderTextColor={colors.gray400}
            value={availableSpace}
            onChangeText={setAvailableSpace}
            keyboardType="numeric"
          />
          <Text style={styles.unitText}>kg</Text>
        </View>
        {errors.available_space && <Text style={styles.errorText}>{errors.available_space}</Text>}

        {/* Price per kg */}
        <Text style={styles.label}>{t('announcements.form.pricePerKg')}</Text>
        <View style={styles.unitInputRow}>
          <TextInput
            style={[styles.input, styles.flex, errors.price_per_kg && styles.inputError]}
            placeholder={t('announcements.form.pricePerKgPlaceholder')}
            placeholderTextColor={colors.gray400}
            value={pricePerKg}
            onChangeText={setPricePerKg}
            keyboardType="numeric"
          />
          <Text style={styles.unitText}>€/kg</Text>
        </View>
        {errors.price_per_kg && <Text style={styles.errorText}>{errors.price_per_kg}</Text>}

        {/* Complementary info */}
        <Text style={styles.label}>{t('announcements.form.complementaryInfo')}</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder={t('announcements.form.complementaryInfoPlaceholder')}
          placeholderTextColor={colors.gray400}
          value={complementaryInfo}
          onChangeText={setComplementaryInfo}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
        />

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
            <Text style={styles.cancelButtonText}>{t('announcements.form.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>
                {isEdit ? t('announcements.form.update') : t('announcements.form.submit')}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray700,
    marginTop: 16,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.gray50,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    color: colors.gray900,
  },
  inputError: {
    borderColor: colors.red500,
  },
  smallMargin: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  autocompleteContainer: {
    position: 'relative',
    zIndex: 10,
  },
  suggestionsContainer: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.gray200,
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
      },
      android: { elevation: 4 },
    }),
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
    gap: 8,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray900,
  },
  suggestionCountry: {
    fontSize: 12,
    color: colors.gray500,
    fontWeight: '600',
  },
  countryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: colors.gray50,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  countryBadgeText: {
    fontSize: 13,
    color: colors.gray700,
    fontWeight: '500',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateText: {
    fontSize: 15,
    color: colors.gray900,
  },
  unitInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  unitText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.gray500,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    fontSize: 12,
    color: colors.red500,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 28,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.gray200,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: colors.gray600,
    fontWeight: '600',
    fontSize: 15,
  },
  submitButton: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 10,
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
      android: { elevation: 3 },
    }),
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
