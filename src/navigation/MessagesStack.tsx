import React from 'react';
import { TouchableOpacity } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ConversationsScreen } from '../screens/messages/ConversationsScreen';
import { ChatScreen } from '../screens/messages/ChatScreen';
import { PublicProfileScreen } from '../screens/profile/PublicProfileScreen';
import { colors } from '../theme/colors';

export type MessagesStackParamList = {
  Conversations: undefined;
  Chat: { bookingRequestId: string };
  PublicProfile: { userId: string };
};

const Stack = createNativeStackNavigator<MessagesStackParamList>();

export function MessagesStack() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerTintColor: colors.primary,
        headerTitleStyle: { color: colors.gray900 },
      }}
    >
      <Stack.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
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
        options={{ title: '' }}
      />
    </Stack.Navigator>
  );
}
