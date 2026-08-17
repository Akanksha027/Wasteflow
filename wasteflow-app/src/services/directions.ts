import { LocationCoords } from '../types';

export type LatLng = { latitude: number; longitude: number };

const cache = new Map<string, LatLng[]>();

function cacheKey(points: LatLng[]) {
  return points.map((p) => `${p.latitude.toFixed(5)},${p.longitude.toFixed(5)}`).join('|');
}

function asLatLng(points: LatLng[]): LocationCoords[] {
  return points.map((p) => ({ latitude: p.latitude, longitude: p.longitude }));
}

export async function getDrivingRoute(points: LatLng[]): Promise<LatLng[]> {
  const valid = points.filter(
    (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude),
  );
  if (valid.length < 2) return asLatLng(valid);

  const key = cacheKey(valid);
  const hit = cache.get(key);
  if (hit) return hit;

  const googleKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  try {
    const coords = googleKey ? await fetchGoogleRoute(valid, googleKey) : await fetchOsrmRoute(valid);
    if (coords.length >= 2) {
      cache.set(key, coords);
      return coords;
    }
  } catch (err) {
    console.warn('Driving route failed:', err);
  }
  return asLatLng(valid);
}

async function fetchOsrmRoute(points: LatLng[]): Promise<LatLng[]> {
  const chunks: LatLng[][] = [];
  const size = 20;
  for (let i = 0; i < points.length - 1; i += size - 1) {
    chunks.push(points.slice(i, Math.min(i + size, points.length)));
  }

  const merged: LatLng[] = [];
  for (const chunk of chunks) {
    if (chunk.length < 2) continue;
    const path = chunk.map((p) => `${p.longitude},${p.latitude}`).join(';');
    const url = `https://router.project-osrm.org/route/v1/driving/${path}?overview=full&geometries=geojson&steps=false`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const json = await res.json();
    const coords = json?.routes?.[0]?.geometry?.coordinates as [number, number][] | undefined;
    if (!coords?.length) continue;
    const mapped = coords.map(([lng, lat]) => ({ latitude: lat, longitude: lng }));
    if (merged.length && mapped.length) mapped.shift();
    merged.push(...mapped);
  }
  return merged;
}

async function fetchGoogleRoute(points: LatLng[], apiKey: string): Promise<LatLng[]> {
  const origin = `${points[0].latitude},${points[0].longitude}`;
  const destination = `${points[points.length - 1].latitude},${points[points.length - 1].longitude}`;
  const waypoints = points
    .slice(1, -1)
    .map((p) => `${p.latitude},${p.longitude}`)
    .join('|');
  const url =
    `https://maps.googleapis.com/maps/api/directions/json?origin=${encodeURIComponent(origin)}` +
    `&destination=${encodeURIComponent(destination)}` +
    (waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : '') +
    `&mode=driving&key=${apiKey}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Directions ${res.status}`);
  const json = await res.json();
  const encoded = json?.routes?.[0]?.overview_polyline?.points as string | undefined;
  if (!encoded) return [];
  return decodePolyline(encoded);
}

function decodePolyline(encoded: string): LatLng[] {
  const coords: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;
    result = 0;
    shift = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;
    coords.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return coords;
}
