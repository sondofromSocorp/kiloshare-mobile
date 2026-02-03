import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
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
import { fetchUserRole } from '../../lib/profile';
import { fetchUserAverageRating } from '../../lib/chat';
import type { Profile } from '../../lib/types';
import type { ProfileStackParamList } from '../../navigation/ProfileStack';

type NavigationProp = NativeStackNavigationProp<ProfileStackParamList>;

const roleKeys: Record<string, string> = {
  traveler: 'publicProfile.roleTraveler',
  sender: 'publicProfile.roleSender',
  both: 'publicProfile.roleBoth',
  new: 'publicProfile.roleNew',
};

export function ProfileScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NavigationProp>();
  const { user } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState('new');
  const [rating, setRating] = useState({ average: 0, count: 0 });
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) setProfile(data as Profile);

      const [userRole, userRating] = await Promise.all([
        fetchUserRole(user.id),
        fetchUserAverageRating(user.id),
      ]);
      setRole(userRole);
      setRating(userRating);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const handleSignOut = () => {
    Alert.alert(
      t('nav.signOut'),
      '',
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('nav.signOut'),
          style: 'destructive',
          onPress: () => supabase.auth.signOut(),
        },
      ],
    );
  };

  const displayName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');

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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header card */}
        <View style={styles.headerCard}>
          <View style={styles.avatarLarge}>
            <Ionicons name="person" size={36} color={colors.white} />
          </View>
          <Text style={styles.displayName}>{displayName || profile?.username || user?.email}</Text>
          {profile?.username && displayName && (
            <Text style={styles.username}>@{profile.username}</Text>
          )}
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{t(roleKeys[role] ?? roleKeys.new)}</Text>
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            {rating.count > 0 && (
              <View style={styles.statItem}>
                <View style={styles.statValue}>
                  <Ionicons name="star" size={16} color={colors.yellow500} />
                  <Text style={styles.statNumber}>{rating.average.toFixed(1)}</Text>
                </View>
                <Text style={styles.statLabel}>
                  {t('publicProfile.reviewCount', { count: rating.count })}
                </Text>
              </View>
            )}
            {profile?.city && (
              <View style={styles.statItem}>
                <View style={styles.statValue}>
                  <Ionicons name="location-outline" size={16} color={colors.primary} />
                  <Text style={styles.statNumber}>{profile.city}</Text>
                </View>
                <Text style={styles.statLabel}>{profile.country}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Menu items */}
        <View style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('EditProfile')}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.primaryBg }]}>
                <Ionicons name="create-outline" size={18} color={colors.primary} />
              </View>
              <Text style={styles.menuItemText}>{t('profile.edit')}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => navigation.navigate('PublicProfile', { userId: user!.id })}
          >
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: colors.green50 }]}>
                <Ionicons name="eye-outline" size={18} color={colors.green600} />
              </View>
              <Text style={styles.menuItemText}>{t('publicProfile.aboutTitle', { name: '' }).trim()}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
          </TouchableOpacity>
        </View>

        {/* Info card */}
        {profile && (
          <View style={styles.infoCard}>
            <Text style={styles.infoCardTitle}>{t('profile.title')}</Text>

            {profile.email && (
              <View style={styles.infoRow}>
                <Ionicons name="mail-outline" size={16} color={colors.gray400} />
                <Text style={styles.infoText}>{profile.email}</Text>
              </View>
            )}
            {profile.phone && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={16} color={colors.gray400} />
                <Text style={styles.infoText}>{profile.phone}</Text>
              </View>
            )}
            {profile.street_address && (
              <View style={styles.infoRow}>
                <Ionicons name="home-outline" size={16} color={colors.gray400} />
                <Text style={styles.infoText}>
                  {profile.street_address}, {profile.postal_code} {profile.city}
                </Text>
              </View>
            )}
            {profile.bio && (
              <View style={styles.infoRow}>
                <Ionicons name="document-text-outline" size={16} color={colors.gray400} />
                <Text style={styles.infoText}>{profile.bio}</Text>
              </View>
            )}
            {profile.languages && profile.languages.length > 0 && (
              <View style={styles.infoRow}>
                <Ionicons name="globe-outline" size={16} color={colors.gray400} />
                <Text style={styles.infoText}>
                  {profile.languages.map((l) => t(`languages.${l}`, l)).join(', ')}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color={colors.red600} />
          <Text style={styles.signOutText}>{t('nav.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
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
    fontSize: 20,
    fontWeight: '700',
    color: colors.gray900,
  },
  username: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: colors.primaryBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 8,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 32,
    marginTop: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.gray900,
  },
  statLabel: {
    fontSize: 12,
    color: colors.gray400,
    marginTop: 2,
  },

  // Menu
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: 12,
    marginBottom: 12,
    overflow: 'hidden',
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray100,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 15,
    color: colors.gray900,
    fontWeight: '500',
  },

  // Info card
  infoCard: {
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
  infoCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.gray900,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.gray600,
    lineHeight: 20,
  },

  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.red500,
  },
  signOutText: {
    color: colors.red600,
    fontWeight: '600',
    fontSize: 15,
  },
});
