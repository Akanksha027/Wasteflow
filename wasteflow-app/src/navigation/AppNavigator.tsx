// src/navigation/AppNavigator.tsx
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import RoutePreviewScreen from '../screens/RoutePreviewScreen';
import StopListScreen from '../screens/StopListScreen';
import ScanScreen from '../screens/ScanScreen';
import WeightEntryScreen from '../screens/WeightEntryScreen';
import TripCompleteScreen from '../screens/TripCompleteScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { Colors } from '../theme';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  const { session, role, employee, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={Colors.primary} size="large" />
      </View>
    );
  }

  const isAuthenticated = !!session && role === 'driver' && !!employee;

  return (
    <NavigationContainer>
      <Stack.Navigator
        id="WasteFlowDriver"
        initialRouteName={isAuthenticated ? 'Home' : 'Onboarding'}
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: Colors.background },
          animation: 'slide_from_right',
        }}
      >
        {!isAuthenticated ? (
          <Stack.Group>
            <Stack.Screen name="Onboarding" component={OnboardingScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="RoutePreview" component={RoutePreviewScreen} />
            <Stack.Screen name="StopList" component={StopListScreen} />
            <Stack.Screen name="Scan" component={ScanScreen} />
            <Stack.Screen name="WeightEntry" component={WeightEntryScreen} />
            <Stack.Screen name="TripComplete" component={TripCompleteScreen} />
            <Stack.Screen
              name="Settings"
              component={SettingsScreen}
              options={{ presentation: 'modal', animation: 'slide_from_bottom' }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
