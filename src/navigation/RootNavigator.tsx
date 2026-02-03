import React from 'react';
import { useAuth } from '../lib/auth';
import { LoadingScreen } from '../components/LoadingScreen';
import { AuthStack } from './AuthStack';
import { MainTabs } from './MainTabs';

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return user ? <MainTabs /> : <AuthStack />;
}
