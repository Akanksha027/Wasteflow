// src/screens/StopListScreen.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp, useFocusEffect } from '@react-navigation/native';
import { getRouteStops, getTodayEventsForTrip, skipStop } from '../api';
import { getCurrentLocation, openRouteInMaps, openTurnByTurn, watchCurrentLocation } from '../services/location';
import StopItem from '../components/StopItem';
import ProgressBar from '../components/ProgressBar';
import OfflineBanner from '../components/OfflineBanner';
import RouteMap from '../components/RouteMap';
import { Route, CollectionTrip, StopWithStatus, LocationCoords } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

type StopListParams = {
  StopList: {
    route: Route;
    trip: CollectionTrip;
    employeeId: string;
    vehicleId: string | null;
  };
};

const SKIP_REASONS = [
  'Bin not found',
  'Road blocked',
  'Already collected',
  'Bin damaged',
  'Access denied',
  'Other',
];

export default function StopListScreen() {
  const navigation = useNavigation<any>();
  const routeParams = useRoute<RouteProp<StopListParams, 'StopList'>>();
  const { route, trip, employeeId, vehicleId } = routeParams.params;

  const [stops, setStops] = useState<StopWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'map' | 'list'>('map');
  const [selected, setSelected] = useState<StopWithStatus | null>(null);
  const [userLocation, setUserLocation] = useState<LocationCoords | null>(null);
  const [skipModalVisible, setSkipModalVisible] = useState(false);
  const [skipTargetStop, setSkipTargetStop] = useState<StopWithStatus | null>(null);
  const [skipping, setSkipping] = useState(false);

  const slideAnim = useRef(new Animated.Value(300)).current;

  async function loadStops() {
    const [rawStops, events] = await Promise.all([
      getRouteStops(route.id),
      getTodayEventsForTrip(trip.id),
    ]);

    const stopsWithStatus: StopWithStatus[] = rawStops.map((s) => {
      const event = events.find((e) => e.bwg_id === s.bwg_id);
      let status: StopWithStatus['status'] = 'pending';
      let event_id: string | undefined;
      if (event) {
        event_id = event.id;
        status = event.status === 'missed' ? 'skipped' : 'scanned';
      }
      return { ...s, status, event_id };
    });
    setStops(stopsWithStatus);
    setSelected((prev) => {
      if (prev) return stopsWithStatus.find((s) => s.id === prev.id) ?? null;
      return stopsWithStatus.find((s) => s.status === 'pending') ?? stopsWithStatus[0] ?? null;
    });
  }

  useEffect(() => {
    loadStops().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    void (async () => {
      const first = await getCurrentLocation();
      if (first) setUserLocation(first);
      sub = await watchCurrentLocation(setUserLocation);
    })();
    return () => sub?.remove();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        void loadStops();
      }
    }, [loading]),
  );

  function showSkipModal(stop: StopWithStatus) {
    setSkipTargetStop(stop);
    setSkipModalVisible(true);
    Animated.spring(slideAnim, {
      toValue: 0, tension: 80, friction: 10, useNativeDriver: true,
    }).start();
  }

  function hideSkipModal() {
    Animated.timing(slideAnim, {
      toValue: 300, duration: 250, useNativeDriver: true,
    }).start(() => setSkipModalVisible(false));
  }

  async function confirmSkip(reason: string) {
    if (!skipTargetStop) return;
    setSkipping(true);
    try {
      const loc = await getCurrentLocation();
      const result = await skipStop({
        tripId: trip.id,
        bwgId: skipTargetStop.bwg_id,
        routeId: route.id,
        vehicleId,
        operatorId: employeeId,
        reason,
        location: loc,
      });

      if (result?.id) {
        setStops((prev) =>
          prev.map((s) =>
            s.id === skipTargetStop.id ? { ...s, status: 'skipped', event_id: result.id } : s
          )
        );
      }
    } finally {
      setSkipping(false);
      hideSkipModal();
    }
  }

  function handleScanStop(stop: StopWithStatus) {
    if (stop.status !== 'pending') return;
    navigation.navigate('Scan', {
      stop,
      trip,
      route,
      employeeId,
      vehicleId,
    });
  }

  function handleCompleteTrip() {
    const remaining = stops.filter((s) => s.status === 'pending').length;
    if (remaining > 0) {
      Alert.alert(
        'Stops remaining',
        `${remaining} stop(s) are still pending. End the trip anyway? Remaining stops stay uncollected.`,
        [
          { text: 'Keep collecting', style: 'cancel' },
          {
            text: 'End trip',
            style: 'destructive',
            onPress: () => navigation.navigate('TripComplete', { trip, route, stops, employeeId, vehicleId }),
          },
        ],
      );
      return;
    }
    navigation.navigate('TripComplete', { trip, route, stops, employeeId, vehicleId });
  }

  function navigateToStop(stop: StopWithStatus) {
    const lat = stop.bwg?.latitude;
    const lng = stop.bwg?.longitude;
    if (lat == null || lng == null) {
      Alert.alert('No GPS', 'This stop has no map coordinates.');
      return;
    }
    openTurnByTurn(lat, lng, stop.bwg?.name);
  }

  const completed = stops.filter((s) => s.status !== 'pending').length;
  const nextStop = stops.find((s) => s.status === 'pending') ?? null;
  const activeStop = selected ?? nextStop;
  const mappedStops = stops.filter((s) => s.bwg?.latitude != null && s.bwg?.longitude != null);

  return (
    <View style={styles.container}>
      <OfflineBanner />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Now Tracking</Text>
          <Text style={styles.routeCode}>{route.route_code} · {route.name.replace(/^Route \d+ - /, '')}</Text>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
          <Text style={styles.iconText}>⚙</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressSection}>
        <ProgressBar completed={completed} total={stops.length} />
      </View>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'map' && styles.tabActive]}
          onPress={() => setTab('map')}
        >
          <Text style={[styles.tabText, tab === 'map' && styles.tabTextActive]}>Map</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'list' && styles.tabActive]}
          onPress={() => setTab('list')}
        >
          <Text style={[styles.tabText, tab === 'list' && styles.tabTextActive]}>Stops</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navAll}
          onPress={() =>
            openRouteInMaps(
              mappedStops.map((s) => ({
                latitude: s.bwg.latitude as number,
                longitude: s.bwg.longitude as number,
              })),
            )
          }
        >
          <Text style={styles.navAllText}>Full route</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading stops…</Text>
        </View>
      ) : tab === 'map' ? (
        <View style={styles.mapWrap}>
          <RouteMap
            stops={stops}
            userLocation={userLocation}
            selectedStopId={activeStop?.id}
            onSelectStop={setSelected}
          />
        </View>
      ) : (
        <FlatList
          data={stops}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <StopItem
              stop={item}
              onPress={() => handleScanStop(item)}
              onLongPress={() => {
                if (item.status === 'pending') showSkipModal(item);
              }}
            />
          )}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No stops found for this route.</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 160 }} />}
        />
      )}

      {activeStop ? (
        <View style={styles.nextCard}>
          <View style={styles.nextTop}>
            <View style={styles.nextBadge}>
              <Text style={styles.nextBadgeText}>
                {activeStop.status === 'pending' ? `NEXT  ${activeStop.stop_order}` : `#${activeStop.stop_order}`}
              </Text>
            </View>
            <Text style={styles.nextName} numberOfLines={1}>{activeStop.bwg?.name}</Text>
          </View>
          <Text style={styles.nextAddr} numberOfLines={1}>
            {activeStop.bwg?.address ?? activeStop.bwg?.ward ?? 'No address'}
          </Text>
          <View style={styles.nextActions}>
            {activeStop.status === 'pending' ? (
              <>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => navigateToStop(activeStop)}>
                  <Text style={styles.secondaryBtnText}>Navigate</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={() => showSkipModal(activeStop)}>
                  <Text style={[styles.secondaryBtnText, { color: Colors.danger }]}>Skip</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.primaryBtn} onPress={() => handleScanStop(activeStop)}>
                  <Text style={styles.primaryBtnText}>Scan QR</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.doneHint}>
                {activeStop.status === 'scanned' ? 'Collected' : 'Skipped'} · tap next pin or open Stops
              </Text>
            )}
          </View>
        </View>
      ) : null}

      <View style={styles.footer}>
        <TouchableOpacity style={styles.completeBtn} onPress={handleCompleteTrip}>
          <Text style={styles.completeBtnText}>
            {completed === stops.length && stops.length > 0
              ? '✓  Complete Trip'
              : `${stops.length - completed} stops remaining · End trip`}
          </Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={skipModalVisible}
        transparent
        animationType="none"
        onRequestClose={hideSkipModal}
      >
        <TouchableOpacity style={styles.modalOverlay} onPress={hideSkipModal} activeOpacity={1}>
          <Animated.View
            style={[styles.skipSheet, { transform: [{ translateY: slideAnim }] }]}
          >
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Skip Stop</Text>
            <Text style={styles.sheetSubtitle}>
              {skipTargetStop?.bwg?.name ?? 'This stop'}
            </Text>
            <Text style={styles.sheetLabel}>Select a reason:</Text>
            {SKIP_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={styles.reasonBtn}
                onPress={() => confirmSkip(reason)}
                disabled={skipping}
              >
                <Text style={styles.reasonText}>{reason}</Text>
                <Text style={styles.reasonArrow}>›</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelBtn} onPress={hideSkipModal}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing['3xl'], paddingBottom: Spacing.md,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: Radius.full,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  iconText: { color: Colors.textSecondary, fontSize: 18 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.medium },
  routeCode: { color: Colors.textTertiary, fontSize: Typography.fontSize.sm, marginTop: 2 },

  progressSection: { paddingHorizontal: Spacing.xl, paddingBottom: Spacing.sm },

  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
    gap: 8,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { color: Colors.textSecondary, fontWeight: Typography.fontWeight.semibold, fontSize: 13 },
  tabTextActive: { color: Colors.black },
  navAll: { marginLeft: 'auto', paddingVertical: 8, paddingHorizontal: 10 },
  navAllText: { color: Colors.primary, fontSize: 12, fontWeight: Typography.fontWeight.semibold },

  mapWrap: { flex: 1, marginHorizontal: Spacing.base, borderRadius: Radius.xl, overflow: 'hidden' },
  list: { paddingHorizontal: Spacing.base },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textTertiary, fontSize: Typography.fontSize.base },

  emptyContainer: { alignItems: 'center', paddingVertical: Spacing['3xl'] },
  emptyText: { color: Colors.textTertiary, fontSize: Typography.fontSize.base },

  nextCard: {
    marginHorizontal: Spacing.base,
    marginTop: Spacing.sm,
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.base,
  },
  nextTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  nextBadge: {
    backgroundColor: Colors.primaryGlow,
    borderRadius: Radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  nextBadgeText: { color: Colors.primary, fontSize: 10, fontWeight: Typography.fontWeight.extrabold },
  nextName: { color: Colors.white, fontWeight: Typography.fontWeight.semibold, flex: 1 },
  nextAddr: { color: Colors.textSecondary, fontSize: 12, marginBottom: 10 },
  nextActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.full,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryBtnText: { color: Colors.white, fontWeight: Typography.fontWeight.semibold, fontSize: 12 },
  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 10,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.black, fontWeight: Typography.fontWeight.bold },
  doneHint: { color: Colors.textTertiary, fontSize: 12 },

  footer: {
    padding: Spacing.xl, paddingBottom: Spacing['2xl'],
    backgroundColor: Colors.background,
  },
  completeBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: Spacing.base + 2, alignItems: 'center',
  },
  completeBtnText: { color: Colors.black, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, justifyContent: 'flex-end' },
  skipSheet: {
    backgroundColor: Colors.card, borderTopLeftRadius: Radius['2xl'], borderTopRightRadius: Radius['2xl'],
    padding: Spacing.xl, paddingBottom: Spacing['3xl'],
  },
  sheetHandle: { width: 40, height: 4, backgroundColor: Colors.border, borderRadius: Radius.full, alignSelf: 'center', marginBottom: Spacing.base },
  sheetTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, marginBottom: 4 },
  sheetSubtitle: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, marginBottom: Spacing.lg },
  sheetLabel: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.sm },

  reasonBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.surface, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.base, paddingHorizontal: Spacing.base, marginBottom: Spacing.sm,
  },
  reasonText: { color: Colors.textPrimary, fontSize: Typography.fontSize.base },
  reasonArrow: { color: Colors.textTertiary, fontSize: 20 },

  cancelBtn: { marginTop: Spacing.sm, alignItems: 'center', paddingVertical: Spacing.base },
  cancelText: { color: Colors.textTertiary, fontSize: Typography.fontSize.sm },
});
