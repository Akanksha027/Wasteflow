import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getRouteStops, startTrip } from '../api';
import { getCurrentLocation, openRouteInMaps } from '../services/location';
import RouteMap from '../components/RouteMap';
import { CollectionTrip, Route, StopWithStatus } from '../types';
import { Colors, Radius, Spacing, Typography } from '../theme';

type Params = {
  RoutePreview: {
    route: Route;
    employeeId: string;
    vehicleId: string | null;
    startKm?: number;
    existingTrip?: CollectionTrip | null;
  };
};

export default function RoutePreviewScreen() {
  const navigation = useNavigation<any>();
  const { route, employeeId, vehicleId, startKm, existingTrip } =
    useRoute<RouteProp<Params, 'RoutePreview'>>().params;
  const [stops, setStops] = useState<StopWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    void getRouteStops(route.id).then((rows) => {
      setStops(rows.map((s) => ({ ...s, status: 'pending' as const })));
      setLoading(false);
    });
  }, [route.id]);

  async function begin() {
    if (existingTrip?.status === 'in_progress') {
      navigation.replace('StopList', {
        route,
        trip: existingTrip,
        employeeId,
        vehicleId: existingTrip.vehicle_id ?? vehicleId,
      });
      return;
    }
    setStarting(true);
    try {
      const loc = await getCurrentLocation();
      const trip = await startTrip({
        route_id: route.id,
        vehicle_id: vehicleId,
        driver_id: employeeId,
        start_km: startKm,
        start_lat: loc?.latitude,
        start_lng: loc?.longitude,
      });
      if (!trip) {
        Alert.alert('Could not start trip', 'Check your connection and try again.');
        return;
      }
      navigation.replace('StopList', {
        route,
        trip,
        employeeId,
        vehicleId: trip.vehicle_id ?? vehicleId,
      });
    } finally {
      setStarting(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>{route.route_code}</Text>
          <Text style={styles.sub}>{stops.length} stops on this route</Text>
        </View>
        <TouchableOpacity
          style={styles.iconBtn}
          onPress={() =>
            openRouteInMaps(
              stops
                .filter((s) => s.bwg?.latitude != null && s.bwg?.longitude != null)
                .map((s) => ({ latitude: s.bwg.latitude as number, longitude: s.bwg.longitude as number })),
            )
          }
        >
          <Text style={styles.iconText}>↗</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <View style={styles.map}>
          <RouteMap stops={stops} userLocation={null} onSelectStop={() => undefined} />
        </View>
      )}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.btn} onPress={() => void begin()} disabled={starting}>
          {starting ? (
            <ActivityIndicator color={Colors.black} />
          ) : (
            <Text style={styles.btnText}>
              {existingTrip?.status === 'in_progress' ? 'Open live trip map' : 'Start trip & follow map'}
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.md,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconText: { color: Colors.textSecondary, fontSize: 18, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false, marginTop: -6 },
  headerCenter: { flex: 1, alignItems: 'center' },
  title: { color: Colors.white, fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.lg },
  sub: { color: Colors.textTertiary, fontSize: 12 },
  map: { flex: 1, margin: Spacing.base, borderRadius: Radius.xl, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { padding: Spacing.xl, paddingBottom: Spacing['2xl'] },
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.base,
    alignItems: 'center',
  },
  btnText: { color: Colors.black, fontWeight: Typography.fontWeight.bold },
});
