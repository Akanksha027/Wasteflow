// src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getDriverRoutes, getRouteTodayStats, getVehicle, startTrip } from '../api';
import { getCurrentLocation } from '../services/location';
import RouteCard from '../components/RouteCard';
import OfflineBanner from '../components/OfflineBanner';
import { CollectionTrip, Route, Vehicle } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface RouteData {
  route: Route;
  stopCount: number;
  todayCount: number;
  collectedCount: number;
  trip: CollectionTrip | null;
}

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { employee } = useAuth();
  const [routeData, setRouteData] = useState<RouteData[]>([]);
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingRouteId, setSyncingRouteId] = useState<string | null>(null);
  const [pendingRoute, setPendingRoute] = useState<RouteData | null>(null);
  const [startKm, setStartKm] = useState('');

  const loadData = useCallback(async () => {
    if (!employee?.id) {
      setRouteData([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const routes = await getDriverRoutes(employee.id);
      const vehiclePromise = employee.assigned_vehicle_id
        ? getVehicle(employee.assigned_vehicle_id)
        : Promise.resolve(null);

      const [veh, fullData] = await Promise.all([
        vehiclePromise,
        Promise.all(
          routes.map(async (route) => {
            const stats = await getRouteTodayStats(route.id, employee.id);
            return {
              route,
              stopCount: stats.stopCount,
              todayCount: stats.todayCount,
              collectedCount: stats.collectedCount,
              trip: stats.trip,
            };
          }),
        ),
      ]);

      setVehicle(veh);
      fullData.sort((a, b) => {
        if (a.trip?.status === 'in_progress') return -1;
        if (b.trip?.status === 'in_progress') return 1;
        return 0;
      });
      setRouteData(fullData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [employee]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleRoutePress(data: RouteData) {
    if (!employee?.id) {
      Alert.alert('Missing profile', 'No employee record linked to this driver account.');
      return;
    }

    if (data.trip?.status === 'in_progress') {
      navigation.navigate('StopList', {
        route: data.route,
        trip: data.trip,
        employeeId: employee.id,
        vehicleId: data.trip.vehicle_id ?? employee.assigned_vehicle_id ?? vehicle?.id ?? null,
      });
      return;
    }

    setPendingRoute(data);
    setStartKm(vehicle?.odometer ? String(vehicle.odometer) : '');
  }

  async function confirmStartTrip() {
    if (!employee?.id || !pendingRoute) return;
    const km = startKm.trim() ? parseFloat(startKm) : undefined;
    if (startKm.trim() && (km == null || Number.isNaN(km) || km < 0)) {
      Alert.alert('Invalid odometer', 'Enter a valid start kilometre reading.');
      return;
    }

    setSyncingRouteId(pendingRoute.route.id);
    try {
      const loc = await getCurrentLocation();
      const trip = await startTrip({
        route_id: pendingRoute.route.id,
        vehicle_id: employee.assigned_vehicle_id ?? vehicle?.id ?? null,
        driver_id: employee.id,
        start_km: km,
        start_lat: loc?.latitude,
        start_lng: loc?.longitude,
      });

      if (!trip) {
        Alert.alert('Could not start trip', 'Check your connection and try again.');
        return;
      }

      setPendingRoute(null);
      navigation.navigate('StopList', {
        route: pendingRoute.route,
        trip,
        employeeId: employee.id,
        vehicleId: trip.vehicle_id ?? employee.assigned_vehicle_id ?? vehicle?.id ?? null,
      });
      await loadData();
    } finally {
      setSyncingRouteId(null);
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <View style={styles.container}>
      <OfflineBanner />

      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.iconText}>⚙</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{employee?.full_name ?? 'Driver'}</Text>
          <Text style={styles.headerSub}>{today}</Text>
        </View>

        <View style={styles.iconBtnPlaceholder} />
      </View>

      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderTitle}>Today's Routes</Text>
        {vehicle ? (
          <Text style={styles.seeAllText}>{vehicle.vehicle_number}</Text>
        ) : null}
      </View>
      <Text style={styles.flowHint}>
        Start a trip → follow the map pins in order → scan QR at each stop → enter weight → complete trip.
      </Text>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={routeData}
          keyExtractor={(item) => item.route.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={Colors.primary}
            />
          }
          renderItem={({ item }) => (
            <RouteCard
              route={item.route}
              stopCount={item.stopCount}
              todayCount={item.todayCount}
              collectedCount={item.collectedCount}
              trip={item.trip}
              onPress={() => handleRoutePress(item)}
              isSyncing={syncingRouteId === item.route.id}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No routes assigned today.</Text>
            </View>
          }
        />
      )}

      <Modal visible={!!pendingRoute} transparent animationType="fade" onRequestClose={() => setPendingRoute(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Start trip</Text>
            <Text style={styles.modalSub}>{pendingRoute?.route.name}</Text>
            <Text style={styles.modalLabel}>Start odometer (km)</Text>
            <TextInput
              style={styles.modalInput}
              value={startKm}
              onChangeText={setStartKm}
              keyboardType="decimal-pad"
              placeholder="e.g. 48250"
              placeholderTextColor={Colors.textDisabled}
            />
            <TouchableOpacity
              style={styles.modalPrimary}
              onPress={() => void confirmStartTrip()}
              disabled={!!syncingRouteId}
            >
              {syncingRouteId ? (
                <ActivityIndicator color={Colors.black} />
              ) : (
                <Text style={styles.modalPrimaryText}>Start Trip</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalMap}
              onPress={() => {
                if (!employee?.id || !pendingRoute) return;
                const km = startKm.trim() ? parseFloat(startKm) : undefined;
                setPendingRoute(null);
                navigation.navigate('RoutePreview', {
                  route: pendingRoute.route,
                  employeeId: employee.id,
                  vehicleId: employee.assigned_vehicle_id ?? vehicle?.id ?? null,
                  startKm: km,
                });
              }}
            >
              <Text style={styles.modalMapText}>View route map first</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setPendingRoute(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['3xl'],
    paddingBottom: Spacing.xl,
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
  iconBtnPlaceholder: {
    width: 44,
    height: 44,
  },
  iconText: {
    color: Colors.textSecondary,
    fontSize: 18,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    marginTop: 40,
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
  },
  headerSub: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  listHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  listHeaderTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.semibold,
  },
  seeAllText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  flowHint: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    lineHeight: 18,
  },
  list: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    padding: Spacing['3xl'],
    alignItems: 'center',
  },
  emptyText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.base,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: {
    color: Colors.white,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
  },
  modalSub: {
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
    marginTop: 4,
  },
  modalLabel: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.xs,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    color: Colors.white,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: Typography.fontSize.lg,
    marginBottom: Spacing.lg,
  },
  modalPrimary: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  modalPrimaryText: {
    color: Colors.black,
    fontWeight: Typography.fontWeight.bold,
  },
  modalMap: { alignItems: 'center', paddingTop: Spacing.md },
  modalMapText: { color: Colors.primary, fontWeight: Typography.fontWeight.semibold },
  modalCancel: { alignItems: 'center', paddingVertical: Spacing.md },
  modalCancelText: { color: Colors.textTertiary },
});
