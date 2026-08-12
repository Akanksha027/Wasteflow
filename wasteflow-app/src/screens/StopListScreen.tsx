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
import { getCurrentLocation } from '../services/location';
import StopItem from '../components/StopItem';
import ProgressBar from '../components/ProgressBar';
import OfflineBanner from '../components/OfflineBanner';
import { Route, CollectionTrip, StopWithStatus } from '../types';
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
  }

  useEffect(() => {
    loadStops().finally(() => setLoading(false));
  }, []);

  // Refresh stop statuses every time we return to this screen (after a scan)
  useFocusEffect(
    useCallback(() => {
      if (!loading) {
        loadStops();
      }
    }, [loading])
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
      const eventId = await skipStop({
        tripId: trip.id,
        bwgId: skipTargetStop.bwg_id,
        routeId: route.id,
        vehicleId,
        operatorId: employeeId,
        reason,
        location: loc,
      });

      if (eventId) {
        setStops((prev) =>
          prev.map((s) =>
            s.id === skipTargetStop.id ? { ...s, status: 'skipped', event_id: eventId } : s
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
    navigation.navigate('TripComplete', { trip, route, stops, employeeId, vehicleId });
  }

  const completed = stops.filter((s) => s.status !== 'pending').length;
  const allDone = stops.length > 0 && completed === stops.length;

  return (
    <View style={styles.container}>
      <OfflineBanner />

      {/* Modern Header matching mockup */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>
        
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Now Tracking</Text>
          <Text style={styles.routeCode}>{route.route_code}</Text>
        </View>

        <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.iconBtn}>
          <Text style={styles.iconText}>⚙</Text>
        </TouchableOpacity>
      </View>

      {/* Progress */}
      <View style={styles.progressSection}>
        <ProgressBar completed={completed} total={stops.length} />
      </View>

      {/* Stop list */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading stops…</Text>
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
          ListFooterComponent={<View style={{ height: 120 }} />}
        />
      )}

      {/* Complete Trip button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.completeBtn, !allDone && styles.completeBtnDisabled]}
          onPress={handleCompleteTrip}
          disabled={!allDone}
          accessibilityLabel="Complete trip button"
        >
          <Text style={[styles.completeBtnText, !allDone && styles.completeBtnTextDisabled]}>
            {allDone ? '✓  Complete Trip' : `${stops.length - completed} stops remaining`}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Skip Modal */}
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
    paddingHorizontal: Spacing.xl, paddingTop: Spacing['3xl'], paddingBottom: Spacing.xl,
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

  progressSection: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.base },

  list: { paddingHorizontal: Spacing.base },

  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textTertiary, fontSize: Typography.fontSize.base },

  emptyContainer: { alignItems: 'center', paddingVertical: Spacing['3xl'] },
  emptyText: { color: Colors.textTertiary, fontSize: Typography.fontSize.base },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.xl, paddingBottom: Spacing['2xl'],
    backgroundColor: Colors.background,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  completeBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.lg,
    paddingVertical: Spacing.base + 2, alignItems: 'center',
  },
  completeBtnDisabled: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  completeBtnText: { color: Colors.white, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  completeBtnTextDisabled: { color: Colors.textTertiary },

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
