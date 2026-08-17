import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { LocationCoords, StopWithStatus } from '../types';
import { Colors, Radius, Spacing, Typography } from '../theme';

const DARK_MAP = [
  { elementType: 'geometry', stylers: [{ color: '#1d1d1d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1d1d1d' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1a24' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

function pinColor(status: StopWithStatus['status'], isNext: boolean) {
  if (status === 'scanned') return Colors.wasteWet;
  if (status === 'skipped') return Colors.danger;
  if (isNext) return Colors.primary;
  return Colors.info;
}

export default function RouteMap({
  stops,
  userLocation,
  selectedStopId,
  onSelectStop,
}: {
  stops: StopWithStatus[];
  userLocation: LocationCoords | null;
  selectedStopId?: string | null;
  onSelectStop: (stop: StopWithStatus) => void;
}) {
  const mapRef = useRef<MapView>(null);

  const mapped = useMemo(
    () =>
      stops.filter(
        (s) =>
          typeof s.bwg?.latitude === 'number' &&
          typeof s.bwg?.longitude === 'number' &&
          Number.isFinite(s.bwg.latitude) &&
          Number.isFinite(s.bwg.longitude),
      ),
    [stops],
  );

  const polyline = useMemo(
    () =>
      mapped.map((s) => ({
        latitude: s.bwg.latitude as number,
        longitude: s.bwg.longitude as number,
      })),
    [mapped],
  );

  const nextStop = stops.find((s) => s.status === 'pending') ?? null;

  const initialRegion: Region = useMemo(() => {
    const points = [
      ...polyline,
      ...(userLocation ? [{ latitude: userLocation.latitude, longitude: userLocation.longitude }] : []),
    ];
    if (points.length === 0) {
      return { latitude: 12.9716, longitude: 77.5946, latitudeDelta: 0.08, longitudeDelta: 0.08 };
    }
    const lats = points.map((p) => p.latitude);
    const lngs = points.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.012, (maxLat - minLat) * 1.7 || 0.02),
      longitudeDelta: Math.max(0.012, (maxLng - minLng) * 1.7 || 0.02),
    };
  }, [polyline, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    const coords = [
      ...polyline,
      ...(userLocation ? [{ latitude: userLocation.latitude, longitude: userLocation.longitude }] : []),
    ];
    if (coords.length < 1 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(coords, {
      edgePadding: { top: 60, right: 40, bottom: 180, left: 40 },
      animated: true,
    });
  }, [polyline.length]);

  if (mapped.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No mapped stops</Text>
        <Text style={styles.emptyText}>This route’s generators don’t have GPS coordinates yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
        toolbarEnabled={false}
        customMapStyle={DARK_MAP}
      >
        {polyline.length > 1 ? (
          <Polyline coordinates={polyline} strokeColor={Colors.primary} strokeWidth={4} lineDashPattern={[1, 0]} />
        ) : null}

        {mapped.map((stop) => {
          const isNext = nextStop?.id === stop.id;
          const selected = selectedStopId === stop.id;
          return (
            <Marker
              key={stop.id}
              coordinate={{
                latitude: stop.bwg.latitude as number,
                longitude: stop.bwg.longitude as number,
              }}
              onPress={() => onSelectStop(stop)}
              tracksViewChanges={false}
              zIndex={isNext || selected ? 20 : 5}
            >
              <View
                style={[
                  styles.pin,
                  {
                    backgroundColor: pinColor(stop.status, isNext),
                    borderColor: selected || isNext ? Colors.white : 'transparent',
                  },
                ]}
              >
                <Text style={[styles.pinText, { color: isNext ? Colors.black : Colors.white }]}>{stop.stop_order}</Text>
              </View>
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.legend}>
        <LegendDot color={Colors.primary} label="Next" />
        <LegendDot color={Colors.info} label="Pending" />
        <LegendDot color={Colors.wasteWet} label="Done" />
        <LegendDot color={Colors.danger} label="Skipped" />
      </View>

      <TouchableOpacity
        style={styles.fitBtn}
        onPress={() => {
          const coords = [
            ...polyline,
            ...(userLocation ? [{ latitude: userLocation.latitude, longitude: userLocation.longitude }] : []),
          ];
          mapRef.current?.fitToCoordinates(coords, {
            edgePadding: { top: 60, right: 40, bottom: 180, left: 40 },
            animated: true,
          });
        }}
      >
        <Text style={styles.fitText}>Fit route</Text>
      </TouchableOpacity>
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: Colors.surface },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
    backgroundColor: Colors.surface,
  },
  emptyTitle: { color: Colors.white, fontWeight: Typography.fontWeight.bold, marginBottom: 6 },
  emptyText: { color: Colors.textTertiary, textAlign: 'center' },
  pin: {
    minWidth: 28,
    height: 28,
    paddingHorizontal: 6,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  pinText: { color: Colors.black, fontWeight: Typography.fontWeight.extrabold, fontSize: 12 },
  legend: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'rgba(18,18,18,0.82)',
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: Colors.textSecondary, fontSize: 11 },
  fitBtn: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fitText: { color: Colors.white, fontSize: 12, fontWeight: Typography.fontWeight.semibold },
});
