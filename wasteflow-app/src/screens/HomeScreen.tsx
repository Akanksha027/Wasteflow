// src/screens/HomeScreen.tsx
import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getDriverCompletedTrips, getDriverRoutes, getRouteTodayStats, getVehicle, startTrip } from '../api';
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
  const [completedTrips, setCompletedTrips] = useState<Array<CollectionTrip & { route: Route | null }>>([]);
  const [pendingRoute, setPendingRoute] = useState<RouteData | null>(null);
  const [startKm, setStartKm] = useState('');
  const [activeTab, setActiveTab] = useState<'pending' | 'completed'>('pending');

  const loadData = useCallback(async () => {
    if (!employee?.id) {
      setRouteData([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const [routes, completed] = await Promise.all([
        getDriverRoutes(employee.id),
        getDriverCompletedTrips(employee.id),
      ]);
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
      setCompletedTrips(completed);
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

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData]),
  );

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
      const loc = await getCurrentLocation({ timeoutMs: 2000 });
      const trip = await startTrip({
        route_id: pendingRoute.route.id,
        vehicle_id: pendingRoute.trip?.vehicle_id ?? employee.assigned_vehicle_id ?? vehicle?.id ?? null,
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
        <View style={styles.headerContent}>
          <Text style={styles.headerGreeting}>
            {new Date().getHours() < 12 ? 'Good morning,' : new Date().getHours() < 17 ? 'Good afternoon,' : 'Good evening,'}
          </Text>
          <Text style={styles.headerTitle}>{employee?.full_name ?? 'Driver'}</Text>
          <View style={styles.headerBadgeRow}>
            <View style={styles.dateBadge}>
              <Text style={styles.dateBadgeText}>{today}</Text>
            </View>
            {vehicle && (
              <View style={styles.vehicleBadge}>
                <Text style={styles.vehicleBadgeText}>🚛 {vehicle.vehicle_number}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.headerAction}>
          <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
            <Text style={styles.iconText}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'pending' && styles.activeTab]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.activeTabText]}>
            Pending ({routeData.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.activeTab]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.activeTabText]}>
            Completed ({completedTrips.length})
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'pending' && (
        <Text style={styles.flowHint}>
          Start a trip → follow the map pins in order → scan QR at each stop → enter weight → complete trip.
        </Text>
      )}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={Colors.primary} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadData();
              }}
              tintColor={Colors.primary}
            />
          }
        >
          {activeTab === 'pending' ? (
            routeData.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No routes assigned today.</Text>
              </View>
            ) : (
              routeData.map((item) => (
                <RouteCard
                  key={item.route.id}
                  route={item.route}
                  stopCount={item.stopCount}
                  todayCount={item.todayCount}
                  collectedCount={item.collectedCount}
                  trip={item.trip}
                  onPress={() => handleRoutePress(item)}
                  isSyncing={syncingRouteId === item.route.id}
                />
              ))
            )
          ) : (
            completedTrips.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>No completed trips yet.</Text>
              </View>
            ) : (
              completedTrips.map((trip) => {
              const route = trip.route ?? {
                id: trip.route_id ?? trip.id,
                route_code: '—',
                name: 'Completed trip',
                ward: null,
                description: null,
                is_active: true,
              };
              const when = new Date(trip.ended_at ?? trip.trip_date);
              const mins =
                trip.started_at && trip.ended_at
                  ? Math.max(
                      0,
                      Math.round(
                        (new Date(trip.ended_at).getTime() - new Date(trip.started_at).getTime()) / 60000,
                      ),
                    )
                  : null;
              return (
                <TouchableOpacity
                  key={trip.id}
                  style={styles.completedCard}
                  onPress={() =>
                    navigation.navigate('TripComplete', {
                      trip,
                      route,
                      stops: [],
                      employeeId: employee?.id,
                      vehicleId: trip.vehicle_id ?? employee?.assigned_vehicle_id ?? vehicle?.id ?? null,
                      readOnly: true,
                    })
                  }
                >
                  <View style={styles.completedTop}>
                    <Text style={styles.completedCode}>{route.route_code}</Text>
                    <View style={styles.completedBadge}>
                      <Text style={styles.completedBadgeText}>Completed</Text>
                    </View>
                  </View>
                  <Text style={styles.completedName}>{route.name}</Text>
                  <Text style={styles.completedMeta}>
                    {when.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                    {mins != null ? ` · ${mins} min` : ''}
                    {` · ${Number(trip.total_collected_kg ?? 0).toFixed(1)} kg`}
                  </Text>
                  <Text style={styles.completedLink}>View details →</Text>
                </TouchableOpacity>
              );
            })
          ))}
        </ScrollView>
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
    paddingTop: 60,
    paddingBottom: Spacing['2xl'],
    backgroundColor: Colors.background,
  },
  headerContent: {
    flex: 1,
    alignItems: 'flex-start',
  },
  headerAction: {
    marginLeft: Spacing.lg,
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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  iconText: {
    color: Colors.primary,
    fontSize: 20,
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  headerGreeting: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
    marginBottom: 0,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: 34,
    fontWeight: Typography.fontWeight.extrabold,
    letterSpacing: -1,
    marginBottom: Spacing.sm,
  },
  headerBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: 4,
  },
  dateBadge: {
    backgroundColor: Colors.card,
    paddingHorizontal: Spacing.md,
    paddingVertical: 8,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateBadgeText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  vehicleBadge: {
    backgroundColor: Colors.primaryGlow,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: 'rgba(252, 163, 17, 0.3)',
  },
  vehicleBadgeText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
    letterSpacing: 0.5,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: Colors.primary,
  },
  tabText: {
    color: Colors.textTertiary,
    fontSize: Typography.fontSize.base,
    fontWeight: Typography.fontWeight.medium,
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: Typography.fontWeight.bold,
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
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing['2xl'],
    marginBottom: Spacing.md,
  },
  completedCard: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
    marginBottom: Spacing.md,
  },
  completedTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  completedCode: { color: Colors.primary, fontWeight: Typography.fontWeight.extrabold },
  completedBadge: {
    backgroundColor: 'rgba(22,163,74,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  completedBadgeText: { color: '#16A34A', fontSize: 10, fontWeight: Typography.fontWeight.bold },
  completedName: { color: Colors.white, fontWeight: Typography.fontWeight.semibold, marginTop: 6 },
  completedMeta: { color: Colors.textSecondary, fontSize: 12, marginTop: 4 },
  completedLink: { color: Colors.primary, fontSize: 12, fontWeight: Typography.fontWeight.semibold, marginTop: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    backgroundColor: Colors.primary,
    borderRadius: Radius['2xl'],
    padding: Spacing['2xl'],
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    color: Colors.black,
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.extrabold,
    textAlign: 'center',
  },
  modalSub: {
    color: 'rgba(0,0,0,0.7)',
    marginBottom: Spacing.xl,
    marginTop: 4,
    textAlign: 'center',
    fontWeight: Typography.fontWeight.semibold,
  },
  modalLabel: {
    color: 'rgba(0,0,0,0.8)',
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  modalInput: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: Radius.full,
    color: Colors.black,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    fontSize: Typography.fontSize.xl,
    fontWeight: Typography.fontWeight.bold,
    marginBottom: Spacing.xl,
    textAlign: 'center',
  },
  modalPrimary: {
    backgroundColor: Colors.black,
    borderRadius: Radius.full,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  modalPrimaryText: {
    color: Colors.white,
    fontWeight: Typography.fontWeight.bold,
    fontSize: Typography.fontSize.md,
  },
  modalMap: { alignItems: 'center', paddingTop: Spacing.lg },
  modalMapText: { color: Colors.black, fontWeight: Typography.fontWeight.bold, textDecorationLine: 'underline' },
  modalCancel: { alignItems: 'center', paddingVertical: Spacing.md },
  modalCancelText: { color: 'rgba(0,0,0,0.6)', fontWeight: Typography.fontWeight.semibold },
});
