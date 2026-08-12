// src/services/location.ts
import * as Location from 'expo-location';
import { LocationCoords } from '../types';

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(): Promise<LocationCoords | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const loc = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    };
  } catch (e) {
    console.warn('Location capture failed:', e);
    return null;
  }
}

export function formatAccuracy(accuracy: number | null): string {
  if (accuracy === null) return 'Unknown';
  return `±${Math.round(accuracy)}m`;
}
