// App.tsx
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/context/AuthContext';
import { OfflineQueueProvider } from './src/context/OfflineQueueContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <OfflineQueueProvider>
        <StatusBar style="light" backgroundColor="#0B1120" />
        <AppNavigator />
      </OfflineQueueProvider>
    </AuthProvider>
  );
}
