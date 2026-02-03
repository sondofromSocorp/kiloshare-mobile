import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { EditProfileScreen } from '../screens/profile/EditProfileScreen';
import { PublicProfileScreen } from '../screens/profile/PublicProfileScreen';
import { colors } from '../theme/colors';

export type ProfileStackParamList = {
  MyProfile: undefined;
  EditProfile: undefined;
  PublicProfile: { userId: string };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.gray900 },
      }}
    >
      <Stack.Screen
        name="MyProfile"
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
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
