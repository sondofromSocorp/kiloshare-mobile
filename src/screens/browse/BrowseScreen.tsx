import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import type { Announcement, Profile } from '../../lib/types';
import type { BrowseStackParamList } from '../../navigation/BrowseStack';

type NavigationProp = NativeStackNavigationProp<BrowseStackParamList>;

type AnnouncementWithProfile = Announcement & {
  profiles: Pick<Profile, 'first_name' | 'last_name' | 'avatar_url'>;
};

export function BrowseScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const [announcements, setAnnouncements] = useState<AnnouncementWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [departureCity, setDepartureCity] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    try {
      setError(null);
      let query = supabase
        .from('announcements')
        .select('*, profiles(first_name, last_name, avatar_url)')
        .eq('status', 'active')
        .gte('departure_date', new Date().toISOString().split('T')[0])
        .order('departure_date', { ascending: true });

      if (departureCity.trim()) {
        query = query.ilike('departure_city', `%${departureCity.trim()}%`);
      }
      if (destinationCity.trim()) {
        query = query.ilike('destination_city', `%${destinationCity.trim()}%`);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;
      setAnnouncements((data as AnnouncementWithProfile[]) ?? []);
    } catch (err: any) {
      setError(t('announcements.errors.loadFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [departureCity, destinationCity, t]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const clearFilters = () => {
    setDepartureCity('');
    setDestinationCity('');
  };

  const hasFilters = departureCity.trim() !== '' || destinationCity.trim() !== '';

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderAnnouncementCard = ({ item }: { item: AnnouncementWithProfile }) => {
    const travelerName = [item.profiles?.first_name, item.profiles?.last_name]
      .filter(Boolean)
      .join(' ') || t('chat.unknownUser');

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('AnnouncementDetail', { announcementId: item.id })}
        activeOpacity={0.7}
      >
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

        {/* Date + Space */}
        <View style={styles.detailsRow}>
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.gray500} />
            <Text style={styles.detailText}>{formatDate(item.departure_date)}</Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="cube-outline" size={14} color={colors.gray500} />
            <Text style={styles.detailText}>
              {item.available_space}kg {t('announcements.browse.available')}
            </Text>
          </View>
        </View>

        {/* Price + Traveler */}
        <View style={styles.bottomRow}>
          <TouchableOpacity
            style={styles.travelerRow}
            onPress={(e) => {
              e.stopPropagation?.();
              navigation.navigate('PublicProfile', { userId: item.user_id });
            }}
          >
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person" size={14} color={colors.white} />
            </View>
            <Text style={styles.travelerName}>{travelerName}</Text>
          </TouchableOpacity>
          <Text style={styles.priceText}>{item.price_per_kg}€/kg</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="airplane-outline" size={48} color={colors.gray300} />
      <Text style={styles.emptyTitle}>{t('announcements.noResults')}</Text>
      <Text style={styles.emptySubtitle}>{t('announcements.tryDifferentSearch')}</Text>
      {hasFilters && (
        <TouchableOpacity style={styles.clearButton} onPress={clearFilters}>
          <Text style={styles.clearButtonText}>{t('announcements.filters.clear')}</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('announcements.browse.title')}</Text>
        <Text style={styles.subtitle}>{t('announcements.browse.subtitle')}</Text>
      </View>

      {/* Filter toggle */}
      <TouchableOpacity
        style={styles.filterToggle}
        onPress={() => setShowFilters(!showFilters)}
      >
        <Ionicons
          name={showFilters ? 'options' : 'options-outline'}
          size={20}
          color={colors.primary}
        />
        <Text style={styles.filterToggleText}>{t('announcements.browse.filterResults')}</Text>
        {hasFilters && <View style={styles.filterBadge} />}
        <Ionicons
          name={showFilters ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.gray500}
          style={styles.chevron}
        />
      </TouchableOpacity>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterRow}>
            <View style={styles.filterInput}>
              <Ionicons name="location-outline" size={16} color={colors.gray400} />
              <TextInput
                style={styles.input}
                placeholder={t('announcements.filters.departureCityPlaceholder')}
                placeholderTextColor={colors.gray400}
                value={departureCity}
                onChangeText={setDepartureCity}
                returnKeyType="search"
                onSubmitEditing={fetchAnnouncements}
              />
            </View>
            <View style={styles.filterInput}>
              <Ionicons name="navigate-outline" size={16} color={colors.gray400} />
              <TextInput
                style={styles.input}
                placeholder={t('announcements.filters.destinationCityPlaceholder')}
                placeholderTextColor={colors.gray400}
                value={destinationCity}
                onChangeText={setDestinationCity}
                returnKeyType="search"
                onSubmitEditing={fetchAnnouncements}
              />
            </View>
          </View>
          <View style={styles.filterActions}>
            <TouchableOpacity style={styles.searchButton} onPress={fetchAnnouncements}>
              <Ionicons name="search" size={16} color={colors.white} />
              <Text style={styles.searchButtonText}>{t('announcements.browse.filterResults')}</Text>
            </TouchableOpacity>
            {hasFilters && (
              <TouchableOpacity style={styles.clearFiltersBtn} onPress={clearFilters}>
                <Text style={styles.clearFiltersText}>{t('announcements.filters.clear')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Content */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>{t('announcements.browse.loading')}</Text>
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
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: colors.white,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.gray900,
  },
  subtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 4,
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  filterToggleText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 8,
    flex: 1,
  },
  filterBadge: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginRight: 8,
  },
  chevron: {
    marginLeft: 4,
  },
  filtersContainer: {
    backgroundColor: colors.white,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  filterRow: {
    gap: 10,
  },
  filterInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.gray50,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 4,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: colors.gray900,
  },
  filterActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 12,
  },
  searchButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    flex: 1,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 6,
  },
  clearFiltersBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  clearFiltersText: {
    color: colors.gray500,
    fontSize: 14,
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
      android: {
        elevation: 3,
      },
    }),
  },
  routeBlock: {
    marginBottom: 12,
    paddingLeft: 4,
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginRight: 10,
  },
  routeDotEnd: {
    backgroundColor: colors.green600,
  },
  routeConnector: {
    width: 2,
    height: 14,
    backgroundColor: colors.gray200,
    marginLeft: 4,
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
  detailsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 13,
    color: colors.gray500,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.gray100,
    paddingTop: 10,
  },
  travelerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  travelerName: {
    fontSize: 13,
    color: colors.gray600,
    fontWeight: '500',
  },
  priceText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.primary,
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
  clearButton: {
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.primaryBg,
  },
  clearButtonText: {
    color: colors.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: colors.gray500,
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
