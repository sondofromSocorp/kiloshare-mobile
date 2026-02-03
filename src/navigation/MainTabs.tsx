import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTranslation } from 'react-i18next';
import { BrowseStack } from './BrowseStack';
import { AnnouncementsStack } from './AnnouncementsStack';
import { MessagesStack } from './MessagesStack';
import { ProfileStack } from './ProfileStack';
import { useAuth } from '../lib/auth';
import { useUnreadMessages } from '../hooks/useUnreadMessages';
import { colors } from '../theme/colors';
import { Ionicons } from '@expo/vector-icons';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { count: unreadCount } = useUnreadMessages(user?.id);

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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
