// src/screens/ScanScreen.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Animated,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { getBwgByQr, getLastCollection, getWasteTypes } from '../api';
import { formatAccuracy, getCurrentLocation } from '../services/location';
import { Bwg, LocationCoords, Route, CollectionTrip, StopWithStatus, WasteType } from '../types';
import { Colors, Typography, Spacing, Radius } from '../theme';

type ScanParams = {
  Scan: {
    stop: StopWithStatus;
    trip: CollectionTrip;
    route: Route;
    employeeId: string;
    vehicleId: string | null;
  };
};

export default function ScanScreen() {
  const navigation = useNavigation<any>();
  const routeParams = useRoute<RouteProp<ScanParams, 'Scan'>>();
  const { stop, trip, route, employeeId, vehicleId } = routeParams.params;

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [bwg, setBwg] = useState<Bwg | null>(null);
  const [isOverride, setIsOverride] = useState(false);
  const [manualEntry, setManualEntry] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [mismatchBwg, setMismatchBwg] = useState<Bwg | null>(null);
  const [lastCollection, setLastCollection] = useState<{ scanned_at: string; total_kg: number } | null>(null);
  const [scanLocation, setScanLocation] = useState<LocationCoords | null>(null);
  const [wasteTypes, setWasteTypes] = useState<WasteType[]>([]);

  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const successAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!permission?.granted) requestPermission();
    startScanAnimation();
    void getWasteTypes().then(setWasteTypes);
  }, []);

  function startScanAnimation() {
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, { toValue: 1, duration: 1800, useNativeDriver: true }),
        Animated.timing(scanLineAnim, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ])
    ).start();
  }

  async function processScan(qrData: string, override = false) {
    setScanning(true);
    const fetchedBwg = await getBwgByQr(qrData);

    if (!fetchedBwg) {
      setScanning(false);
      Alert.alert('Unknown QR Code', 'This QR code is not registered in the system.', [
        { text: 'Try Again', onPress: () => setScanning(false) },
        { text: 'Enter Manually', onPress: () => { setManualEntry(true); setScanning(false); } },
      ]);
      return;
    }

    if (fetchedBwg.id !== stop.bwg_id && !override) {
      setMismatchBwg(fetchedBwg);
      setScanning(false);
      return;
    }

    // Success
    setBwg(fetchedBwg);
    setIsOverride(override || fetchedBwg.id !== stop.bwg_id);
    setScanned(true);
    setScanning(false);
    const [last, loc] = await Promise.all([
      getLastCollection(fetchedBwg.id),
      getCurrentLocation(),
    ]);
    setLastCollection(last);
    setScanLocation(loc);
    Animated.spring(successAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
  }

  async function handleBarcodeScanned({ data: qrData }: { data: string }) {
    if (scanned || scanning) return;
    await processScan(qrData);
  }

  async function handleManualSubmit() {
    if (!manualCode.trim()) return;
    setManualEntry(false);
    await processScan(manualCode.trim());
  }

  async function proceedToWeight() {
    const loc = scanLocation ?? (await getCurrentLocation());
    navigation.navigate('WeightEntry', {
      stop,
      bwg: bwg ?? stop.bwg,
      trip,
      route,
      employeeId,
      vehicleId,
      location: loc,
      isOverride,
    });
  }

  const viewfinderSize = 260;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <Text style={styles.headerSub}>Stop {stop.stop_order} — {stop.bwg?.name}</Text>
        </View>
        <TouchableOpacity onPress={() => setManualEntry(true)} style={styles.manualBtn}>
          <Text style={styles.manualBtnText}>Manual</Text>
        </TouchableOpacity>
      </View>

      {/* Camera viewfinder */}
      {!scanned && (
        <>
          {permission?.granted ? (
            <View style={styles.cameraContainer}>
              <CameraView
                style={StyleSheet.absoluteFill}
                facing="back"
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={handleBarcodeScanned}
              />
              <View style={styles.overlay}>
                <View style={styles.overlayTop} />
                <View style={styles.overlayRow}>
                  <View style={styles.overlaySide} />
                  <View style={[styles.viewfinder, { width: viewfinderSize, height: viewfinderSize }]}>
                    <View style={[styles.corner, styles.cornerTL]} />
                    <View style={[styles.corner, styles.cornerTR]} />
                    <View style={[styles.corner, styles.cornerBL]} />
                    <View style={[styles.corner, styles.cornerBR]} />
                    <Animated.View
                      style={[
                        styles.scanLine,
                        {
                          transform: [{
                            translateY: scanLineAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, viewfinderSize - 2],
                            }),
                          }],
                        },
                      ]}
                    />
                  </View>
                  <View style={styles.overlaySide} />
                </View>
                <View style={styles.overlayBottom}>
                  {scanning && <ActivityIndicator color={Colors.primary} style={{ marginBottom: 12 }} />}
                  <Text style={styles.scanHint}>Point at the QR code on the bin</Text>
                  <View style={styles.expectedCodeBox}>
                    <Text style={styles.expectedLabel}>EXPECTED</Text>
                    <Text style={styles.expectedCode}>{stop.bwg?.qr_code}</Text>
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.noCameraContainer}>
              <Text style={styles.noCameraIcon}>📷</Text>
              <Text style={styles.noCameraMsg}>Camera permission is required to scan QR codes</Text>
              <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
                <Text style={styles.grantBtnText}>Grant Camera Access</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.manualFallbackBtn} onPress={() => setManualEntry(true)}>
                <Text style={styles.manualFallbackText}>Enter QR Code Manually</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      {/* Success panel */}
      {scanned && bwg && (
        <Animated.ScrollView
          contentContainerStyle={styles.successScroll}
          style={{ opacity: successAnim }}
        >
          <Animated.View style={{
            transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1] }) }]
          }}>
            <View style={styles.successIconContainer}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.successTitle}>QR Code Matched!</Text>
            {isOverride && (
              <View style={styles.overrideBadge}>
                <Text style={styles.overrideBadgeText}>⚠ Override Active</Text>
              </View>
            )}

            <View style={styles.bwgCard}>
              <Text style={styles.bwgCardLabel}>LOCATION DETAILS</Text>
              <Text style={styles.bwgName}>{bwg.name}</Text>
              <Text style={styles.bwgOwner}>{bwg.owner_name} • {bwg.category}</Text>
              <Text style={styles.bwgAddress}>{bwg.address}{bwg.ward ? ` — ${bwg.ward}` : ''}</Text>
              {bwg.waste_type_codes?.length > 0 && (
                <View style={styles.wasteTypesRow}>
                  {bwg.waste_type_codes.map((code) => {
                    const wt = wasteTypes.find((t) => t.code === code);
                    const color = wt?.color ?? Colors.textSecondary;
                    return (
                      <View key={code} style={[styles.wasteTag, { backgroundColor: `${color}22` }]}>
                        <Text style={[styles.wasteTagText, { color }]}>
                          {wt?.name ?? code}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={styles.expectedKgRow}>
                <Text style={styles.expectedKgLabel}>Expected today</Text>
                <Text style={styles.expectedKgValue}>{bwg.daily_expected_kg} kg</Text>
              </View>
              <View style={styles.expectedKgRow}>
                <Text style={styles.expectedKgLabel}>Last collection</Text>
                <Text style={styles.lastCollectionValue}>
                  {lastCollection
                    ? `${new Date(lastCollection.scanned_at).toLocaleDateString()} · ${lastCollection.total_kg} kg`
                    : 'No prior pickup'}
                </Text>
              </View>
              <View style={styles.expectedKgRow}>
                <Text style={styles.expectedKgLabel}>GPS</Text>
                <Text style={styles.lastCollectionValue}>
                  {scanLocation
                    ? `Captured · ${formatAccuracy(scanLocation.accuracy)}`
                    : 'Location unavailable'}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={styles.proceedBtn} onPress={proceedToWeight}>
              <Text style={styles.proceedBtnText}>Enter Weight →</Text>
            </TouchableOpacity>
          </Animated.View>
        </Animated.ScrollView>
      )}

      {/* Mismatch Modal */}
      <Modal visible={!!mismatchBwg} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.mismatchCard}>
            <Text style={styles.mismatchIcon}>⚠️</Text>
            <Text style={styles.mismatchTitle}>Wrong Bin Scanned</Text>
            <View style={styles.mismatchCompare}>
              <View style={styles.mismatchRow}>
                <Text style={styles.mismatchRowLabel}>Expected</Text>
                <Text style={styles.mismatchRowValue}>{stop.bwg?.name}</Text>
              </View>
              <View style={styles.mismatchDivider} />
              <View style={styles.mismatchRow}>
                <Text style={styles.mismatchRowLabel}>Scanned</Text>
                <Text style={[styles.mismatchRowValue, { color: Colors.danger }]}>{mismatchBwg?.name}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.reScanBtn} onPress={() => setMismatchBwg(null)}>
              <Text style={styles.reScanText}>Re-scan Correct Bin</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.overrideBtn}
              onPress={() => {
                const b = mismatchBwg;
                setMismatchBwg(null);
                if (b) {
                  setBwg(b);
                  setIsOverride(true);
                  setScanned(true);
                  void getLastCollection(b.id).then(setLastCollection);
                  Animated.spring(successAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }).start();
                }
              }}
            >
              <Text style={styles.overrideText}>Override & Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Manual Entry Modal */}
      <Modal visible={manualEntry} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.manualCard}>
            <Text style={styles.manualTitle}>Enter QR Code Manually</Text>
            <Text style={styles.manualHint}>e.g. WF-BWG-001</Text>
            <TextInput
              style={styles.manualInput}
              value={manualCode}
              onChangeText={setManualCode}
              placeholder="WF-BWG-000"
              placeholderTextColor={Colors.textDisabled}
              autoCapitalize="characters"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleManualSubmit}
            />
            <TouchableOpacity style={styles.manualSubmit} onPress={handleManualSubmit}>
              <Text style={styles.manualSubmitText}>Confirm</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setManualEntry(false)} style={styles.cancelBtn}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const C = 24;
const T = 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },

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
  headerSub: { color: Colors.textSecondary, fontSize: Typography.fontSize.xs, marginTop: 2 },
  manualBtn: {
    backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingHorizontal: Spacing.md, paddingVertical: 8,
  },
  manualBtnText: { color: Colors.textSecondary, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.medium },

  cameraContainer: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'space-between' },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  overlayRow: { flexDirection: 'row', height: 260 },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)' },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.62)', alignItems: 'center', paddingTop: Spacing.xl },

  viewfinder: { position: 'relative' },
  corner: { position: 'absolute', width: C, height: C, borderColor: Colors.primary },
  cornerTL: { top: 0, left: 0, borderTopWidth: T, borderLeftWidth: T, borderTopLeftRadius: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: T, borderRightWidth: T, borderTopRightRadius: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: T, borderLeftWidth: T, borderBottomLeftRadius: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: T, borderRightWidth: T, borderBottomRightRadius: 3 },
  scanLine: {
    position: 'absolute', left: 0, right: 0, height: 2,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 1, shadowRadius: 8,
  },

  scanHint: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, textAlign: 'center', marginBottom: Spacing.base },
  expectedCodeBox: {
    backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: Radius.sm, padding: Spacing.sm,
    borderWidth: 1, borderColor: Colors.border,
  },
  expectedLabel: { color: Colors.textTertiary, fontSize: 9, letterSpacing: 1.5, textAlign: 'center', marginBottom: 2 },
  expectedCode: { color: Colors.textPrimary, fontSize: Typography.fontSize.sm, fontFamily: 'monospace', textAlign: 'center' },

  noCameraContainer: { flex: 1, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center', padding: Spacing['2xl'] },
  noCameraIcon: { fontSize: 60, marginBottom: Spacing.base },
  noCameraMsg: { color: Colors.textSecondary, fontSize: Typography.fontSize.base, textAlign: 'center', marginBottom: Spacing.xl, lineHeight: 22 },
  grantBtn: { backgroundColor: Colors.primary, borderRadius: Radius.full, paddingVertical: Spacing.md, paddingHorizontal: Spacing.xl, marginBottom: Spacing.base },
  grantBtnText: { color: Colors.black, fontWeight: Typography.fontWeight.bold },
  manualFallbackBtn: { paddingVertical: Spacing.md },
  manualFallbackText: { color: Colors.primary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },

  successScroll: { flexGrow: 1, backgroundColor: Colors.background, padding: Spacing.xl, paddingTop: Spacing['2xl'], alignItems: 'center' },
  successIconContainer: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primaryGlow, borderWidth: 3, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.base, alignSelf: 'center',
  },
  successIconText: { color: Colors.primary, fontSize: 36, fontWeight: Typography.fontWeight.extrabold },
  successTitle: { color: Colors.textPrimary, fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.bold, textAlign: 'center', marginBottom: Spacing.sm },
  overrideBadge: { backgroundColor: Colors.warningBg, borderRadius: Radius.full, paddingHorizontal: 12, paddingVertical: 4, alignSelf: 'center', marginBottom: Spacing.lg },
  overrideBadgeText: { color: Colors.warning, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },

  bwgCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl,
    borderWidth: 1, borderColor: Colors.border, width: '100%', marginBottom: Spacing.xl,
  },
  bwgCardLabel: { color: Colors.textTertiary, fontSize: 10, letterSpacing: 1.5, marginBottom: Spacing.sm },
  bwgName: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginBottom: 2 },
  bwgOwner: { color: Colors.primary, fontSize: Typography.fontSize.xs, marginBottom: 4 },
  bwgAddress: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, marginBottom: Spacing.base },
  wasteTypesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: Spacing.base },
  wasteTag: { borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  wasteTagText: { fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold },
  expectedKgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  expectedKgLabel: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs },
  expectedKgValue: { color: Colors.primary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
  lastCollectionValue: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium },

  proceedBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.full,
    paddingVertical: Spacing.base + 2, alignItems: 'center', width: '100%',
  },
  proceedBtnText: { color: Colors.black, fontSize: Typography.fontSize.md, fontWeight: Typography.fontWeight.bold },

  modalOverlay: { flex: 1, backgroundColor: Colors.overlay, alignItems: 'center', justifyContent: 'center' },

  mismatchCard: {
    backgroundColor: Colors.card, borderRadius: Radius.xl, padding: Spacing.xl, width: '88%',
    alignItems: 'center', borderWidth: 1, borderColor: Colors.danger,
  },
  mismatchIcon: { fontSize: 40, marginBottom: Spacing.sm },
  mismatchTitle: { color: Colors.danger, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginBottom: Spacing.base },
  mismatchCompare: { width: '100%', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: Spacing.base, marginBottom: Spacing.xl },
  mismatchRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  mismatchRowLabel: { color: Colors.textTertiary, fontSize: Typography.fontSize.sm },
  mismatchRowValue: { color: Colors.textPrimary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium, flexShrink: 1, textAlign: 'right', maxWidth: '60%' },
  mismatchDivider: { height: 1, backgroundColor: Colors.border },
  reScanBtn: {
    backgroundColor: Colors.primary, borderRadius: Radius.md, paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl, marginBottom: Spacing.sm, width: '100%', alignItems: 'center',
  },
  reScanText: { color: Colors.white, fontWeight: Typography.fontWeight.bold },
  overrideBtn: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md,
    paddingVertical: Spacing.md, width: '100%', alignItems: 'center',
  },
  overrideText: { color: Colors.textSecondary },

  manualCard: {
    backgroundColor: Colors.primary, borderRadius: Radius['2xl'], padding: Spacing['2xl'],
    width: '90%', shadowColor: Colors.primary, shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4, shadowRadius: 20, elevation: 10,
  },
  manualTitle: { color: Colors.black, fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.extrabold, textAlign: 'center', marginBottom: 4 },
  manualHint: { color: 'rgba(0,0,0,0.7)', fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold, textAlign: 'center', marginBottom: Spacing.xl },
  manualInput: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: Radius.full, borderWidth: 0,
    color: Colors.black, fontSize: Typography.fontSize.xl, padding: Spacing.lg,
    fontFamily: 'monospace', marginBottom: Spacing.xl, letterSpacing: 2, textAlign: 'center', fontWeight: 'bold'
  },
  manualSubmit: { backgroundColor: Colors.black, borderRadius: Radius.full, paddingVertical: Spacing.lg, alignItems: 'center', marginBottom: Spacing.md, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  manualSubmitText: { color: Colors.white, fontWeight: Typography.fontWeight.bold, fontSize: Typography.fontSize.md },
  cancelBtn: { paddingVertical: Spacing.sm, alignItems: 'center' },
  cancelText: { color: 'rgba(0,0,0,0.6)', fontWeight: Typography.fontWeight.semibold },
});
