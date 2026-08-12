// src/screens/WeightEntryScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  submitCollectionEvent,
  submitCollectionItems,
  getWasteTypes,
  upsertDailyStatus,
  updateTripTotalKg,
  logGpsEvent,
} from '../api';
import { formatAccuracy } from '../services/location';
import { Bwg, Route, CollectionTrip, StopWithStatus, LocationCoords } from '../types';
import { Colors, Typography, Spacing, Radius, WASTE_TYPE_COLORS, WASTE_TYPE_NAMES } from '../theme';

type WeightParams = {
  WeightEntry: {
    stop: StopWithStatus;
    bwg: Bwg;
    trip: CollectionTrip;
    route: Route;
    employeeId: string;
    vehicleId: string | null;
    location: LocationCoords | null;
    isOverride: boolean;
  };
};

export default function WeightEntryScreen() {
  const navigation = useNavigation<any>();
  const routeParams = useRoute<RouteProp<WeightParams, 'WeightEntry'>>();
  const { stop, bwg, trip, route, employeeId, vehicleId, location, isOverride } = routeParams.params;

  const [weights, setWeights] = useState<Record<string, string>>({});
  const [remarks, setRemarks] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [wasteTypes, setWasteTypes] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  useEffect(() => {
    getWasteTypes().then((types) => {
      const relevant = types.filter((wt) =>
        bwg.waste_type_codes?.includes(wt.code)
      );
      // If no specific types, show first 3
      setWasteTypes(relevant.length > 0 ? relevant : types.slice(0, 3));
    }).finally(() => setLoadingTypes(false));
  }, []);

  async function pickPhoto() {
    const camPermission = await ImagePicker.requestCameraPermissionsAsync();
    if (camPermission.status !== 'granted') {
      Alert.alert('Permission Required', 'Camera permission is needed to take photos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotoUri(result.assets[0].uri);
    }
  }

  function getTotalKg(): number {
    return Object.values(weights).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }

  function hasAnyWeight(): boolean {
    return Object.values(weights).some((v) => parseFloat(v) > 0);
  }

  async function handleSubmit() {
    if (!hasAnyWeight()) {
      Alert.alert('Weight Required', 'Please enter the weight for at least one waste type.');
      return;
    }

    setSubmitting(true);
    try {
      const totalKg = getTotalKg();

      // Log GPS event
      if (location) {
        await logGpsEvent({
          event_type: 'scan',
          trip_id: trip.id,
          bwg_id: bwg.id,
          vehicle_id: vehicleId,
          employee_id: employeeId,
          location,
        });
      }

      // Submit collection event
      const eventId = await submitCollectionEvent({
        tripId: trip.id,
        bwgId: bwg.id,
        routeId: route.id,
        vehicleId,
        operatorId: employeeId,
        location,
        totalKg,
        remarks: remarks.trim() || undefined,
        status: 'collected',
        isOverride,
      });

      if (!eventId) {
        Alert.alert('Submission Failed', 'Could not save collection event. Please try again.');
        return;
      }

      // Submit weight breakdown items
      const itemsToSubmit = wasteTypes
        .filter((wt) => parseFloat(weights[wt.code] ?? '0') > 0)
        .map((wt) => ({
          waste_type_id: wt.id,
          quantity_kg: parseFloat(weights[wt.code] ?? '0'),
        }));
      if (itemsToSubmit.length > 0) {
        await submitCollectionItems(eventId, itemsToSubmit);
      }

      // Update daily status board
      await upsertDailyStatus({
        bwg_id: bwg.id,
        route_id: route.id,
        status: 'collected',
        collected_kg: totalKg,
        event_id: eventId,
      });

      // Recalculate trip total
      await updateTripTotalKg(trip.id);

      // Return to Stop List — useFocusEffect on StopListScreen will refresh statuses
      navigation.pop(2);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const totalKg = getTotalKg();

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
            <Text style={styles.iconText}>←</Text>
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Record Weight</Text>
            <Text style={styles.headerSub}>{bwg?.name}</Text>
          </View>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Context info */}
          <View style={styles.contextCard}>
            <View style={styles.contextRow}>
              <View style={styles.contextLeft}>
                <Text style={styles.contextLabel}>STOP {stop.stop_order}</Text>
                <Text style={styles.contextName}>{bwg.name}</Text>
                <Text style={styles.contextAddress}>{bwg.address ?? bwg.ward}</Text>
              </View>
              {isOverride && (
                <View style={styles.overrideBadge}>
                  <Text style={styles.overrideText}>⚠ Override</Text>
                </View>
              )}
            </View>
          </View>

          {/* GPS Status */}
          <View style={styles.gpsCard}>
            <Text style={styles.gpsIcon}>📍</Text>
            <View style={styles.gpsContent}>
              <Text style={styles.gpsLabel}>GPS Location</Text>
              <Text style={styles.gpsValue}>
                {location
                  ? `Captured • Accuracy ${formatAccuracy(location.accuracy)}`
                  : 'Location unavailable'}
              </Text>
            </View>
            <View style={[styles.gpsStatus, { backgroundColor: location ? Colors.primaryGlow : Colors.dangerBg }]}>
              <Text style={{ color: location ? Colors.primary : Colors.danger, fontSize: 14 }}>
                {location ? '✓' : '✗'}
              </Text>
            </View>
          </View>

          {/* Weight inputs */}
          <Text style={styles.sectionTitle}>Waste Weight by Type</Text>

          {loadingTypes ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={Colors.primary} size="small" />
              <Text style={styles.loadingText}>Loading waste types…</Text>
            </View>
          ) : (
            wasteTypes.map((wt, index) => (
              <View key={wt.code} style={[styles.weightCard, { borderLeftColor: WASTE_TYPE_COLORS[wt.code] ?? Colors.border }]}>
                <View style={styles.weightLeft}>
                  <Text style={[styles.wasteCode, { color: WASTE_TYPE_COLORS[wt.code] ?? Colors.textSecondary }]}>
                    {wt.code}
                  </Text>
                  <Text style={styles.wasteName}>{WASTE_TYPE_NAMES[wt.code] ?? wt.name}</Text>
                </View>
                <View style={styles.weightRight}>
                  <TextInput
                    style={styles.weightInput}
                    value={weights[wt.code] ?? ''}
                    onChangeText={(v) => setWeights((prev) => ({ ...prev, [wt.code]: v }))}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={Colors.textDisabled}
                    returnKeyType={index < wasteTypes.length - 1 ? 'next' : 'done'}
                    accessibilityLabel={`${wt.name} weight in kg`}
                  />
                  <Text style={styles.unitText}>kg</Text>
                </View>
              </View>
            ))
          )}

          {/* Total */}
          {totalKg > 0 && (
            <View style={styles.totalCard}>
              <Text style={styles.totalLabel}>Total Weight</Text>
              <Text style={styles.totalValue}>{totalKg.toFixed(2)} kg</Text>
            </View>
          )}

          {/* Remarks */}
          <Text style={[styles.sectionTitle, { marginTop: Spacing.xl }]}>
            Remarks <Text style={styles.optionalLabel}>(Optional)</Text>
          </Text>
          <TextInput
            style={styles.remarksInput}
            value={remarks}
            onChangeText={setRemarks}
            placeholder="e.g. Bin was overflowing, segregation issue…"
            placeholderTextColor={Colors.textDisabled}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            accessibilityLabel="Remarks field"
          />

          {/* Photo */}
          <Text style={styles.sectionTitle}>
            Photo <Text style={styles.optionalLabel}>(Optional)</Text>
          </Text>
          <TouchableOpacity
            style={styles.photoBtn}
            onPress={pickPhoto}
            accessibilityLabel="Add photo button"
          >
            {photoUri ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                <View style={styles.photoChangeOverlay}>
                  <Text style={styles.photoChangeText}>Tap to change</Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.photoBtnIcon}>📷</Text>
                <Text style={styles.photoBtnText}>Take Photo</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 110 }} />
        </ScrollView>

        {/* Submit footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitBtn, (!hasAnyWeight() || submitting) && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={!hasAnyWeight() || submitting}
            accessibilityLabel="Submit collection button"
          >
            {submitting ? (
              <ActivityIndicator color={Colors.black} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Collection</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl, paddingTop: Spacing['3xl'], paddingBottom: Spacing.xl,
    backgroundColor: Colors.background, zIndex: 10,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: Radius.full,
    backgroundColor: Colors.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  iconText: { color: Colors.textSecondary, fontSize: 18 },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { color: Colors.white, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold },
  headerSub: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs, marginTop: 2 },

  scroll: { padding: Spacing.xl },

  contextCard: {
    backgroundColor: Colors.card, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.base, marginBottom: Spacing.base,
  },
  contextRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  contextLeft: { flex: 1 },
  contextLabel: { color: Colors.primary, fontSize: 10, fontWeight: Typography.fontWeight.extrabold, letterSpacing: 1.5, marginBottom: 2 },
  contextName: { color: Colors.textPrimary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  contextAddress: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs, marginTop: 2 },
  overrideBadge: { backgroundColor: Colors.warningBg, borderRadius: Radius.sm, paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  overrideText: { color: Colors.warning, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },

  gpsCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.md, marginBottom: Spacing.xl,
  },
  gpsIcon: { fontSize: 20, marginRight: Spacing.md },
  gpsContent: { flex: 1 },
  gpsLabel: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs, marginBottom: 2 },
  gpsValue: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm },
  gpsStatus: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },

  sectionTitle: {
    color: Colors.textSecondary, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold,
    textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md,
  },
  optionalLabel: { color: Colors.textDisabled, fontWeight: Typography.fontWeight.regular, textTransform: 'none', letterSpacing: 0 },

  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.base },
  loadingText: { color: Colors.textTertiary, fontSize: Typography.fontSize.sm },

  weightCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    borderLeftWidth: 4, marginBottom: Spacing.sm, overflow: 'hidden',
  },
  weightLeft: { flex: 1, paddingVertical: Spacing.md, paddingLeft: Spacing.md },
  wasteCode: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.extrabold, letterSpacing: 1.2, marginBottom: 2 },
  wasteName: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm },
  weightRight: { flexDirection: 'row', alignItems: 'center', paddingRight: Spacing.md },
  weightInput: {
    color: Colors.textPrimary, fontSize: Typography.fontSize['2xl'], fontWeight: Typography.fontWeight.extrabold,
    textAlign: 'right', minWidth: 70, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm,
  },
  unitText: { color: Colors.textTertiary, fontSize: Typography.fontSize.sm, minWidth: 22 },

  totalCard: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: Colors.primaryGlow, borderRadius: Radius.md,
    padding: Spacing.base, borderWidth: 1, borderColor: Colors.primary, marginTop: Spacing.xs,
  },
  totalLabel: { color: Colors.primary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.semibold },
  totalValue: { color: Colors.primary, fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.extrabold },

  remarksInput: {
    backgroundColor: Colors.card, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.border,
    color: Colors.textPrimary, fontSize: Typography.fontSize.base, padding: Spacing.base,
    minHeight: 80, marginBottom: Spacing.base,
  },

  photoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.full, paddingVertical: Spacing.md,
    borderWidth: 1, borderColor: Colors.border, borderStyle: 'dashed',
  },
  photoBtnIcon: { fontSize: 20 },
  photoBtnText: { color: Colors.primary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium, marginLeft: Spacing.sm },
  photoPreviewContainer: { width: '100%', position: 'relative' },
  photoPreview: { width: '100%', height: 160, borderRadius: Radius.md },
  photoChangeOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(0,0,0,0.55)', padding: Spacing.sm, alignItems: 'center',
  },
  photoChangeText: { color: Colors.white, fontSize: Typography.fontSize.xs },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: Spacing.xl, paddingBottom: Spacing['2xl'],
    backgroundColor: Colors.background, borderTopWidth: 1, borderTopColor: Colors.border,
  },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: Spacing.base + 2, alignItems: 'center', marginTop: Spacing.xl,
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: Colors.black, fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold },
});
