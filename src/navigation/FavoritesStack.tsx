import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { FavoritesScreen } from '../screens/favorites/FavoritesScreen';
import { AnnouncementDetailScreen } from '../screens/browse/AnnouncementDetailScreen';
import { PublicProfileScreen } from '../screens/profile/PublicProfileScreen';
import { colors } from '../theme/colors';

export type FavoritesStackParamList = {
  FavoritesList: undefined;
  AnnouncementDetail: { announcementId: string };
  PublicProfile: { userId: string };
};

const Stack = createNativeStackNavigator<FavoritesStackParamList>();

export function FavoritesStack() {
  const { t } = useTranslation();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.white },
        headerTintColor: colors.gray900,
        headerTitleStyle: { fontWeight: '600' },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="FavoritesList"
        component={FavoritesScreen}
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
        options={{ title: t('nav.profile') }}
      />
    </Stack.Navigator>
  );
}
