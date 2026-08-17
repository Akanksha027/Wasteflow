import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { LocationCoords, StopWithStatus } from '../types';
import { getDrivingRoute, LatLng } from '../services/directions';
import { getCurrentLocation, openTurnByTurn } from '../services/location';
import { Colors, Radius, Spacing, Typography } from '../theme';

function pinColor(status: StopWithStatus['status'], isNext: boolean) {
  if (status === 'scanned') return '#16A34A';
  if (status === 'skipped') return Colors.danger;
  if (isNext) return Colors.primary;
  return Colors.info;
}

function statusLabel(status: StopWithStatus['status'], isNext: boolean) {
  if (status === 'scanned') return 'Collected';
  if (status === 'skipped') return 'Skipped';
  if (isNext) return 'Next';
  return 'Pending';
}

function nativePinColor(status: StopWithStatus['status'], isNext: boolean) {
  if (status === 'scanned') return 'green';
  if (status === 'skipped') return 'red';
  if (isNext) return 'orange';
  return 'blue';
}

function kmBetween(a: LatLng, b: LatLng) {
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return Math.sqrt(dLat * dLat + dLng * dLng) * 111;
}

const BANGALORE: Region = {
  latitude: 12.9716,
  longitude: 77.5946,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

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
  const [origin, setOrigin] = useState<LatLng | null>(null);
  const originLocked = useRef(false);
  const [roadPath, setRoadPath] = useState<LatLng[]>([]);

  const mapped = useMemo(
    () =>
      [...stops]
        .filter(
          (s) =>
            typeof s.bwg?.latitude === 'number' &&
            typeof s.bwg?.longitude === 'number' &&
            Number.isFinite(s.bwg.latitude) &&
            Number.isFinite(s.bwg.longitude),
        )
        .sort((a, b) => a.stop_order - b.stop_order),
    [stops],
  );

  const stopPoints = useMemo(
    () =>
      mapped.map((s) => ({
        latitude: s.bwg.latitude as number,
        longitude: s.bwg.longitude as number,
      })),
    [mapped],
  );

  const nextStop = mapped.find((s) => s.status === 'pending') ?? null;
  const clusterCenter = useMemo(() => {
    if (stopPoints.length === 0) return null;
    return {
      latitude: stopPoints.reduce((s, p) => s + p.latitude, 0) / stopPoints.length,
      longitude: stopPoints.reduce((s, p) => s + p.longitude, 0) / stopPoints.length,
    };
  }, [stopPoints]);

  const originNearRoute =
    origin && clusterCenter ? kmBetween(origin, clusterCenter) < 8 : false;

  useEffect(() => {
    if (originLocked.current) return;
    const loc = userLocation
      ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
      : null;
    if (loc) {
      originLocked.current = true;
      setOrigin(loc);
      return;
    }
    void getCurrentLocation({ timeoutMs: 2000 }).then((got) => {
      if (originLocked.current || !got) return;
      originLocked.current = true;
      setOrigin({ latitude: got.latitude, longitude: got.longitude });
    });
  }, [userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    let cancelled = false;
    if (stopPoints.length < 2) {
      setRoadPath(stopPoints);
      return;
    }
    const points = originNearRoute && origin ? [origin, ...stopPoints] : stopPoints;
    void getDrivingRoute(points).then((coords) => {
      if (cancelled) return;
      setRoadPath(coords.length >= 2 ? coords : stopPoints);
    });
    return () => {
      cancelled = true;
    };
  }, [origin, originNearRoute, stopPoints]);

  const initialRegion: Region = useMemo(() => {
    if (stopPoints.length === 0) return BANGALORE;
    const lats = stopPoints.map((p) => p.latitude);
    const lngs = stopPoints.map((p) => p.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(0.02, (maxLat - minLat) * 2.2 || 0.03),
      longitudeDelta: Math.max(0.02, (maxLng - minLng) * 2.2 || 0.03),
    };
  }, [stopPoints]);

  function fitAllStops() {
    if (stopPoints.length < 1 || !mapRef.current) return;
    mapRef.current.fitToCoordinates(stopPoints, {
      edgePadding: { top: 88, right: 56, bottom: 150, left: 56 },
      animated: true,
    });
  }

  useEffect(() => {
    const t = setTimeout(fitAllStops, 350);
    return () => clearTimeout(t);
  }, [stopPoints.length]);

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
        showsCompass
        toolbarEnabled={false}
        mapPadding={{ top: 56, right: 0, bottom: 24, left: 0 }}
      >
        {roadPath.length > 1 ? (
          <Polyline
            coordinates={roadPath}
            strokeColor={Colors.primary}
            strokeWidth={5}
            lineJoin="round"
            lineCap="round"
          />
        ) : null}

        {mapped.map((stop) => {
          const isNext = nextStop?.id === stop.id;
          const selected = selectedStopId === stop.id;
          const color = pinColor(stop.status, isNext);
          const label = statusLabel(stop.status, isNext);
          return (
            <Marker
              key={`${stop.id}-${stop.status}-${isNext ? 'next' : 'rest'}`}
              coordinate={{
                latitude: stop.bwg.latitude as number,
                longitude: stop.bwg.longitude as number,
              }}
              title={`${stop.stop_order}. ${stop.bwg?.name ?? 'Stop'}`}
              description={label}
              pinColor={nativePinColor(stop.status, isNext)}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges
              onPress={() => onSelectStop(stop)}
              zIndex={isNext || selected ? 40 : 20}
            >
              <LocationPin color={color} selected={selected || isNext} />
            </Marker>
          );
        })}
      </MapView>

      <View style={styles.legend}>
        <LegendDot color={Colors.primary} label="Next" />
        <LegendDot color={Colors.info} label="Pending" />
        <LegendDot color="#16A34A" label="✓ Collected" />
        <LegendDot color={Colors.danger} label="✕ Skipped" />
      </View>

      <View style={styles.bottomBtns}>
        {nextStop?.bwg?.latitude != null && nextStop.bwg.longitude != null ? (
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() =>
              openTurnByTurn(
                nextStop.bwg.latitude as number,
                nextStop.bwg.longitude as number,
                nextStop.bwg?.name,
              )
            }
          >
            <Text style={styles.navBtnText}>Drive to next</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.fitBtn} onPress={fitAllStops}>
          <Text style={styles.fitText}>Show all stops</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const LocationPin = memo(function LocationPin({
  color,
  selected,
}: {
  color: string;
  selected: boolean;
}) {
  const size = selected ? 16 : 14;
  return (
    <View style={styles.pinWrap} collapsable={false}>
      <View
        style={[
          styles.pinHead,
          {
            backgroundColor: color,
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: selected ? Colors.white : 'rgba(0,0,0,0.35)',
          },
        ]}
      />
      <View style={[styles.pinTip, { borderTopColor: color }]} />
    </View>
  );
});

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
  pinWrap: { alignItems: 'center' },
  pinHead: { borderWidth: 2 },
  pinTip: {
    width: 0,
    height: 0,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 7,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
  legend: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    backgroundColor: 'rgba(18,18,18,0.9)',
    borderRadius: Radius.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { color: Colors.textSecondary, fontSize: 11 },
  bottomBtns: {
    position: 'absolute',
    right: Spacing.sm,
    bottom: Spacing.sm,
    gap: 8,
    alignItems: 'flex-end',
  },
  navBtn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  navBtnText: { color: Colors.black, fontSize: 12, fontWeight: Typography.fontWeight.bold },
  fitBtn: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  fitText: { color: Colors.white, fontSize: 12, fontWeight: Typography.fontWeight.semibold },
});
