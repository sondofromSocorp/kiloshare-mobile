import React, { useState, useEffect } from 'react';
import { Image, View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { BrowseStack } from './BrowseStack';
import { AnnouncementsStack } from './AnnouncementsStack';
import { MessagesStack } from './MessagesStack';
import { ProfileStack } from './ProfileStack';
import { useAuth } from '../lib/auth';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { count: unreadCount } = useUnreadMessages(user?.id);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    const loadAvatar = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('id', user.id)
        .single();

      if (data?.avatar_url) {
        setAvatarUrl(data.avatar_url);
      }
    };

    loadAvatar();

    // Subscribe to profile changes to update avatar in real-time
    const channel = supabase
      .channel('profile-avatar')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new?.avatar_url !== undefined) {
            setAvatarUrl(payload.new.avatar_url);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.gray200,
        },
      }}
    >
      <Tab.Screen
        name="BrowseTab"
        component={BrowseStack}
        options={{
          tabBarLabel: t('nav.browse', 'Explorer'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="search" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="AnnouncementsTab"
        component={AnnouncementsStack}
        options={{
          tabBarLabel: t('nav.myTrips', 'Mes Trajets'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="airplane" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagesStack}
        options={{
          tabBarLabel: t('nav.messages', 'Messages'),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" size={size} color={color} />
          ),
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{
          tabBarLabel: t('nav.profile', 'Profil'),
          tabBarIcon: ({ color, size, focused }) =>
            avatarUrl ? (
              <View style={[styles.avatarContainer, focused && styles.avatarFocused]}>
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              </View>
            ) : (
              <Ionicons name="person" size={size} color={color} />
            ),
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  avatarContainer: {
    width: 26,
    height: 26,
    borderRadius: 13,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  avatarFocused: {
    borderColor: colors.primary,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
});
