// src/screens/HomeScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getAllActiveRoutes, getRouteStopCount, getTodayTrip, startTrip } from '../api';
import { getCurrentLocation } from '../services/location';
import RouteCard from '../components/RouteCard';
import OfflineBanner from '../components/OfflineBanner';
import { CollectionTrip, Route } from '../types';
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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncingRouteId, setSyncingRouteId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const routes = await getAllActiveRoutes();
      const relevant = employee?.assigned_route_id 
        ? routes.filter(r => r.id === employee.assigned_route_id) 
        : routes;

      const fullData = await Promise.all(
        relevant.map(async (route) => {
          const stopCount = await getRouteStopCount(route.id);
          const trip = await getTodayTrip(route.id);
          return { route, stopCount, trip };
        })
      );
      
      // Sort so active trip is at the top
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
    if (data.trip) {
      if (data.trip.status === 'in_progress') {
        navigation.navigate('StopList', {
          route: data.route,
          trip: data.trip,
          employeeId: employee?.id,
          vehicleId: null,
        });
      }
      return;
    }

    setSyncingRouteId(data.route.id);
    try {
      const loc = await getCurrentLocation();
      const tripId = await startTrip({
        routeId: data.route.id,
        vehicleId: null,
        driverId: employee?.id,
        start_lat: loc?.latitude,
        start_lng: loc?.longitude,
      });

      if (tripId) {
        await loadData();
      }
    } finally {
      setSyncingRouteId(null);
    }
  }

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  return (
    <View style={styles.container}>
      <OfflineBanner />

      {/* Modern Header matching mockup */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => navigation.navigate('Settings')}>
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>New Trip Requests</Text>
        
        <TouchableOpacity style={styles.iconBtn}>
          <Text style={styles.iconText}>🔔</Text>
          <View style={styles.notificationDot}>
            <Text style={styles.notificationCount}>3</Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* List Header */}
      <View style={styles.listHeaderRow}>
        <Text style={styles.listHeaderTitle}>New Trip Requests</Text>
        <TouchableOpacity>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {/* Route List */}
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
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={Colors.primary} />
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
    position: 'relative',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconText: {
    color: Colors.textSecondary,
    fontSize: 18,
  },
  notificationDot: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  notificationCount: {
    color: Colors.black,
    fontSize: 10,
    fontWeight: 'bold',
  },
  headerTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.medium,
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
