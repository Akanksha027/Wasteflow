// App.tsx
import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { AuthProvider } from './src/context/AuthContext';
import { OfflineQueueProvider } from './src/context/OfflineQueueContext';
import AppNavigator from './src/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

export default function App() {
  return (
    <AuthProvider>
      <OfflineQueueProvider>
        <StatusBar style="light" backgroundColor="#121212" />
        <AppNavigator />
      </OfflineQueueProvider>
    </AuthProvider>
  );
}
