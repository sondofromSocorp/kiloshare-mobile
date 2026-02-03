import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { MyAnnouncementsScreen } from '../screens/announcements/MyAnnouncementsScreen';
import { MyBookingsScreen } from '../screens/announcements/MyBookingsScreen';
import { CreateAnnouncementScreen } from '../screens/announcements/CreateAnnouncementScreen';
import { BookingRequestsScreen } from '../screens/announcements/BookingRequestsScreen';
import { PublicProfileScreen } from '../screens/profile/PublicProfileScreen';
import { colors } from '../theme/colors';

export type AnnouncementsStackParamList = {
  MyAnnouncements: undefined;
  MyBookings: undefined;
  CreateAnnouncement: { announcementId?: string } | undefined;
  BookingRequests: { announcementId: string };
  PublicProfile: { userId: string };
};

const Stack = createNativeStackNavigator<AnnouncementsStackParamList>();

export function AnnouncementsStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.gray900 },
        headerBackTitle: '',
      }}
    >
      <Stack.Screen
        name="MyAnnouncements"
        component={MyAnnouncementsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="CreateAnnouncement"
        component={CreateAnnouncementScreen}
        options={({ navigation }) => ({
          title: '',
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="BookingRequests"
        component={BookingRequestsScreen}
        options={({ navigation }) => ({
          title: '',
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
      <Stack.Screen
        name="PublicProfile"
        component={PublicProfileScreen}
        options={({ navigation }) => ({
          title: '',
          headerBackVisible: false,
          headerLeft: () => (
            <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={8}>
              <Ionicons name="chevron-back" size={24} color={colors.primary} />
            </TouchableOpacity>
          ),
        })}
      />
    </Stack.Navigator>
  );
}
