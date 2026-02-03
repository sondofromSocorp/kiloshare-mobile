import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { BrowseScreen } from '../screens/browse/BrowseScreen';
import { AnnouncementDetailScreen } from '../screens/browse/AnnouncementDetailScreen';
import { PublicProfileScreen } from '../screens/profile/PublicProfileScreen';
import { colors } from '../theme/colors';

export type BrowseStackParamList = {
  BrowseAnnouncements: undefined;
  AnnouncementDetail: { announcementId: string };
  PublicProfile: { userId: string };
};

const Stack = createNativeStackNavigator<BrowseStackParamList>();

export function BrowseStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.gray900 },
      }}
    >
      <Stack.Screen
        name="BrowseAnnouncements"
        component={BrowseScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AnnouncementDetail"
        component={AnnouncementDetailScreen}
        options={{ title: '' }}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={{ title: '' }}
      />
    </Stack.Navigator>
  );
}
