// src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getDriverRoutes, getRouteStopCount, getTodayTrip, getVehicle, startTrip } from '../api';
import { getCurrentLocation } from '../services/location';
import RouteCard from '../components/RouteCard';
import OfflineBanner from '../components/OfflineBanner';
import { CollectionTrip, Route, Vehicle } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface RouteData {
  route: Route;
  stopCount: number;
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
            const stopCount = await getRouteStopCount(route.id);
            const trip = await getTodayTrip(route.id, employee.id);
            return { route, stopCount, trip };
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

    setSyncingRouteId(data.route.id);
    try {
      const loc = await getCurrentLocation();
      const trip = await startTrip({
        route_id: data.route.id,
        vehicle_id: employee.assigned_vehicle_id ?? vehicle?.id ?? null,
        driver_id: employee.id,
        start_km: vehicle?.odometer,
        start_lat: loc?.latitude,
        start_lng: loc?.longitude,
      });

      if (!trip) {
        Alert.alert('Could not start trip', 'Check your connection and try again.');
        return;
      }

      navigation.navigate('StopList', {
        route: data.route,
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
    alignItems: 'center',
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
});
