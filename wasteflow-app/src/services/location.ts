import { Linking, Platform } from 'react-native';
import * as Location from 'expo-location';
import { LocationCoords } from '../types';

let lastKnown: LocationCoords | null = null;

export function getLastKnownLocation(): LocationCoords | null {
  return lastKnown;
}

function remember(coords: LocationCoords) {
  lastKnown = coords;
  return coords;
}

export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === 'granted';
}

export async function getCurrentLocation(options?: {
  timeoutMs?: number;
  highAccuracy?: boolean;
}): Promise<LocationCoords | null> {
  const timeoutMs = options?.timeoutMs ?? 2500;
  try {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return lastKnown;

    try {
      const cached = await Location.getLastKnownPositionAsync();
      if (cached) {
        remember({
          latitude: cached.coords.latitude,
          longitude: cached.coords.longitude,
          accuracy: cached.coords.accuracy,
        });
      }
    } catch {
      /* ignore */
    }

    const loc = await Promise.race([
      Location.getCurrentPositionAsync({
        accuracy: options?.highAccuracy ? Location.Accuracy.High : Location.Accuracy.Balanced,
      }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);

    if (loc) {
      return remember({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy,
      });
    }
    return lastKnown;
  } catch (e) {
    console.warn('Location capture failed:', e);
    return lastKnown;
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
        const coords = remember({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy,
        });
        onChange(coords);
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
