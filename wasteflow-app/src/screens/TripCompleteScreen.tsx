// src/screens/TripCompleteScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { completeTrip, getTripStopsWithStatus, getTripWeightBreakdown, getWasteTypes } from '../api';
import { getCurrentLocation } from '../services/location';
import { CollectionTrip, Route, StopWithStatus } from '../types';
import { Colors, Typography, Spacing, Radius, WASTE_TYPE_COLORS, WASTE_TYPE_NAMES } from '../theme';

type TripCompleteParams = {
  TripComplete: {
    trip: CollectionTrip;
    route: Route;
    stops: StopWithStatus[];
    employeeId: string;
    vehicleId: string | null;
    readOnly?: boolean;
  };
};

export default function TripCompleteScreen() {
  const navigation = useNavigation<any>();
  const routeParams = useRoute<RouteProp<TripCompleteParams, 'TripComplete'>>();
  const { trip, route, stops: initialStops, employeeId, vehicleId, readOnly } = routeParams.params;

  const [endOdometer, setEndOdometer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [weightByType, setWeightByType] = useState<Record<string, number>>({});
  const [typeMeta, setTypeMeta] = useState<Record<string, { name: string; color: string | null }>>({});
  const [loading, setLoading] = useState(true);
  const [stops, setStops] = useState<StopWithStatus[]>(initialStops ?? []);
  const [odometerErrorVisible, setOdometerErrorVisible] = useState(false);
  const [odometerErrorMsg, setOdometerErrorMsg] = useState('');

  const celebrationAnim = useRef(new Animated.Value(0)).current;

  const completed = stops.filter((s) => s.status === 'scanned').length;
  const skipped = stops.filter((s) => s.status === 'skipped').length;
  const totalStops = stops.length;

  const startedAt = trip.started_at ? new Date(trip.started_at) : null;
  const endedAt = trip.ended_at ? new Date(trip.ended_at) : new Date();
  const durationMs = startedAt ? endedAt.getTime() - startedAt.getTime() : 0;
  const durationMins = Math.floor(durationMs / 60000);
  const durationStr = durationMins >= 60
    ? `${Math.floor(durationMins / 60)}h ${durationMins % 60}m`
    : `${durationMins}m`;

  useEffect(() => {
    Animated.spring(celebrationAnim, {
      toValue: 1, tension: 40, friction: 6, useNativeDriver: true,
    }).start();

    loadDetails();
  }, []);

  async function loadDetails() {
    const [breakdown, types, tripStops] = await Promise.all([
      getTripWeightBreakdown(trip.id),
      getWasteTypes(),
      route?.id ? getTripStopsWithStatus(route.id, trip.id) : Promise.resolve(initialStops ?? []),
    ]);
    if (tripStops.length) setStops(tripStops);
    setWeightByType(breakdown);
    setTypeMeta(
      Object.fromEntries(types.map((t) => [t.code, { name: t.name, color: t.color }])),
    );
    setLoading(false);
  }

  async function handleSubmit() {
    if (!endOdometer.trim()) {
      setOdometerErrorMsg('Please enter the end odometer reading.');
      setOdometerErrorVisible(true);
      return;
    }
    const endKm = parseFloat(endOdometer);
    if (isNaN(endKm) || endKm <= 0) {
      setOdometerErrorMsg('Please enter a valid odometer reading.');
      setOdometerErrorVisible(true);
      return;
    }

    setSubmitting(true);
    try {
      const loc = await getCurrentLocation({ timeoutMs: 2000 });
      const success = await completeTrip({
        tripId: trip.id,
        end_km: endKm,
        end_lat: loc?.latitude,
        end_lng: loc?.longitude,
        vehicleId,
        driverId: employeeId,
      });

      if (!success) {
        Alert.alert('Error', 'Failed to complete trip. Please try again.');
        return;
      }

      // Navigate to Home (reset stack)
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    } finally {
      setSubmitting(false);
    }
  }

  const totalKg = Object.values(weightByType).reduce((s, v) => s + v, 0);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* Celebration header */}
          <Animated.View
            style={[
              styles.celebrationHeader,
              {
                opacity: celebrationAnim,
                transform: [{ scale: celebrationAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
              },
            ]}
          >
            <View style={styles.celebIcon}>
              <Text style={styles.celebIconText}>🎉</Text>
            </View>
            <Text style={styles.celebTitle}>{readOnly ? 'Completed trip' : 'Trip Complete!'}</Text>
            <Text style={styles.celebSubtitle}>{route.name}</Text>
            {readOnly && trip.trip_date ? (
              <Text style={styles.celebSubtitle}>
                {new Date(trip.ended_at ?? trip.trip_date).toLocaleString()}
              </Text>
            ) : null}
          </Animated.View>

          {/* Summary stats */}
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: Colors.primary }]}>{completed}</Text>
              <Text style={styles.statLabel}>Collected</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: Colors.warning }]}>{skipped}</Text>
              <Text style={styles.statLabel}>Skipped</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{totalStops}</Text>
              <Text style={styles.statLabel}>Total Stops</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: Colors.info }]}>{durationStr}</Text>
              <Text style={styles.statLabel}>Duration</Text>
            </View>
          </View>

          {/* Weight breakdown */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weight Collected</Text>
            {loading ? (
              <ActivityIndicator color={Colors.primary} />
            ) : (
              <>
                {Object.entries(weightByType).map(([code, kg]) => (
                  <View key={code} style={styles.weightRow}>
                    <View style={styles.weightLeft}>
                      <View style={[styles.colorDot, { backgroundColor: typeMeta[code]?.color ?? WASTE_TYPE_COLORS[code] ?? Colors.border }]} />
                      <Text style={styles.weightLabel}>{typeMeta[code]?.name ?? WASTE_TYPE_NAMES[code] ?? code}</Text>
                    </View>
                    <Text style={styles.weightValue}>{kg.toFixed(2)} kg</Text>
                  </View>
                ))}
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>{totalKg.toFixed(2)} kg</Text>
                </View>
              </>
            )}
          </View>

          {/* Stop details */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Stops</Text>
            {stops.map((s) => (
              <View key={s.id} style={styles.stopRow}>
                <Text style={styles.stopOrder}>{s.stop_order}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.stopName} numberOfLines={1}>{s.bwg?.name ?? 'Stop'}</Text>
                  <Text style={styles.stopAddr} numberOfLines={1}>{s.bwg?.address ?? s.bwg?.ward ?? ''}</Text>
                </View>
                <Text
                  style={[
                    styles.stopStatus,
                    s.status === 'scanned' && { color: '#16A34A' },
                    s.status === 'skipped' && { color: Colors.danger },
                  ]}
                >
                  {s.status === 'scanned' ? 'Collected' : s.status === 'skipped' ? 'Skipped' : 'Pending'}
                </Text>
              </View>
            ))}
          </View>

          {readOnly ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Trip details</Text>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Start km</Text>
                <Text style={styles.detailValue}>{trip.start_km ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>End km</Text>
                <Text style={styles.detailValue}>{trip.end_km ?? '—'}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Total collected</Text>
                <Text style={styles.detailValue}>{Number(trip.total_collected_kg ?? totalKg).toFixed(1)} kg</Text>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>End Odometer Reading</Text>
              <View style={styles.odometerWrapper}>
                <Text style={styles.odometerIcon}>🛣</Text>
                <TextInput
                  style={styles.odometerInput}
                  value={endOdometer}
                  onChangeText={setEndOdometer}
                  placeholder="e.g. 48350"
                  placeholderTextColor={Colors.textDisabled}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  accessibilityLabel="End odometer reading"
                />
                <Text style={styles.odometerUnit}>km</Text>
              </View>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <View style={styles.footer}>
          {readOnly ? (
            <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.submitBtnText}>Back to home</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
              onPress={() => void handleSubmit()}
              disabled={submitting}
              accessibilityLabel="Submit and end trip button"
            >
              {submitting ? (
                <ActivityIndicator color={Colors.black} />
              ) : (
                <Text style={styles.submitBtnText}>Submit & End Trip ✓</Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Modal visible={odometerErrorVisible} transparent animationType="fade" onRequestClose={() => setOdometerErrorVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Odometer Required</Text>
              <Text style={styles.modalSub}>{odometerErrorMsg}</Text>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalPrimary} onPress={() => setOdometerErrorVisible(false)}>
                  <Text style={styles.modalPrimaryText}>OK</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },
  scroll: { padding: Spacing.xl },

  celebrationHeader: { alignItems: 'center', marginBottom: Spacing['2xl'], marginTop: Spacing.base },
  celebIcon: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: Colors.primaryGlow, borderWidth: 3, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.base,
  },
  celebIconText: { fontSize: 40 },
  celebTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.extrabold, marginBottom: 4 },
  celebSubtitle: { color: Colors.textTertiary, fontSize: Typography.fontSize.sm },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.xl },
  statCard: {
    flex: 1, minWidth: '45%', backgroundColor: Colors.card, borderRadius: Radius.xl,
    padding: Spacing.xl, alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  statValue: { color: Colors.textPrimary, fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.extrabold },
  statLabel: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs, marginTop: 3 },

  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.textSecondary, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },

  weightRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.base, paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm,
  },
  weightLeft: { flexDirection: 'row', alignItems: 'center' },
  colorDot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.sm },
  weightLabel: { color: Colors.textSecondary, fontSize: Typography.fontSize.base },
  weightValue: { color: Colors.textPrimary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },

  totalRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.full,
    paddingVertical: Spacing.base, paddingHorizontal: Spacing.xl, borderWidth: 1, borderColor: Colors.primary, marginTop: Spacing.xs,
  },
  totalLabel: { color: Colors.primary, fontWeight: Typography.fontWeight.semibold },
  totalValue: { color: Colors.primary, fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.extrabold },

  odometerWrapper: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.xl,
  },
  odometerIcon: { fontSize: 20, marginRight: Spacing.sm },
  odometerInput: {
    flex: 1, color: Colors.textPrimary, fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold, paddingVertical: Spacing.base,
  },
  odometerUnit: { color: Colors.textTertiary, fontSize: Typography.fontSize.sm },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.xl, paddingBottom: Spacing['2xl'],
    backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  submitBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: Spacing.base + 2, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.7 },
  submitBtnText: { color: Colors.black, fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  modalCard: { width: '100%', backgroundColor: Colors.primary, borderRadius: Radius['2xl'], padding: Spacing['2xl'], shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.4, shadowRadius: 20, elevation: 10 },
  modalTitle: { color: Colors.black, fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.extrabold, textAlign: 'center' },
  modalSub: { color: 'rgba(0,0,0,0.7)', marginBottom: Spacing.xl, marginTop: 4, textAlign: 'center', fontWeight: Typography.fontWeight.semibold },
  modalActions: { flexDirection: 'row', justifyContent: 'center' },
  modalPrimary: { backgroundColor: Colors.black, borderRadius: Radius.full, paddingVertical: Spacing.md, paddingHorizontal: Spacing['2xl'], alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  modalPrimaryText: { color: Colors.white, fontWeight: Typography.fontWeight.bold },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  stopOrder: { color: Colors.primary, fontWeight: Typography.fontWeight.extrabold, width: 22 },
  stopName: { color: Colors.white, fontWeight: Typography.fontWeight.semibold, fontSize: 13 },
  stopAddr: { color: Colors.textTertiary, fontSize: 11, marginTop: 1 },
  stopStatus: { color: Colors.textSecondary, fontSize: 11, fontWeight: Typography.fontWeight.bold },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  detailLabel: { color: Colors.textSecondary, fontSize: 13 },
  detailValue: { color: Colors.white, fontWeight: Typography.fontWeight.bold },
});
