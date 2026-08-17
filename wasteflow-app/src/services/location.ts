// src/services/location.ts
import { Linking, Platform } from 'react-native';
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

export async function watchCurrentLocation(
  onChange: (coords: LocationCoords) => void,
): Promise<{ remove: () => void } | null> {
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return null;

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 4000,
        distanceInterval: 12,
      },
      (loc) => {
        onChange({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        });
      },
    );
    return sub;
  } catch (e) {
    console.warn('Location watch failed:', e);
    return null;
  }
}

export function openTurnByTurn(lat: number, lng: number, label?: string) {
  const encoded = encodeURIComponent(label || `${lat},${lng}`);
  const url = Platform.select({
    ios: `http://maps.apple.com/?daddr=${lat},${lng}&q=${encoded}`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
  });
  void Linking.openURL(url!);
}

export function openRouteInMaps(
  stops: { latitude: number; longitude: number }[],
) {
  if (stops.length === 0) return;
  const dest = stops[stops.length - 1];
  const origin = stops[0];
  const waypoints = stops
    .slice(1, -1)
    .map((s) => `${s.latitude},${s.longitude}`)
    .join('|');
  const url =
    `https://www.google.com/maps/dir/?api=1` +
    `&origin=${origin.latitude},${origin.longitude}` +
    `&destination=${dest.latitude},${dest.longitude}` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') +
    `&travelmode=driving`;
  void Linking.openURL(url);
}
