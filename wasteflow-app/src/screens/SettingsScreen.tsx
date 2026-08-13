// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useOffline } from '../context/OfflineQueueContext';
import { getRoute, getVehicle } from '../api';
import { Colors, Typography, Spacing, Radius } from '../theme';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { employee, signOut } = useAuth();
  const { pendingCount, isSyncing, syncNow, isOnline } = useOffline();
  const [vehicleLabel, setVehicleLabel] = useState('—');
  const [routeLabel, setRouteLabel] = useState('—');

  useEffect(() => {
    let active = true;
    (async () => {
      if (employee?.assigned_vehicle_id) {
        const v = await getVehicle(employee.assigned_vehicle_id);
        if (active) setVehicleLabel(v?.vehicle_number ?? '—');
      } else if (active) {
        setVehicleLabel('Unassigned');
      }
      if (employee?.assigned_route_id) {
        const route = await getRoute(employee.assigned_route_id);
        if (active) setRouteLabel(route ? `${route.route_code} · ${route.name}` : 'Assigned in ERP');
      } else if (active) {
        setRouteLabel('Unassigned');
      }
    })();
    return () => {
      active = false;
    };
  }, [employee]);

  async function handleSignOut() {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
        },
      },
    ]);
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
          <Text style={styles.iconText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(employee?.full_name ?? 'D').charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{employee?.full_name ?? '—'}</Text>
            <View style={styles.driverBadge}>
              <Text style={styles.driverBadgeText}>DRIVER</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Details</Text>
          <InfoRow icon="🪪" label="Employee Code" value={employee?.employee_code ?? '—'} />
          <InfoRow icon="📞" label="Phone" value={employee?.phone ?? '—'} />
          <InfoRow icon="🚛" label="Assigned Vehicle" value={vehicleLabel} />
          <InfoRow icon="🗺️" label="Assigned Route" value={routeLabel} />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Offline Queue</Text>
          <View style={styles.offlineCard}>
            <View style={styles.offlineRow}>
              <View style={[styles.dot, { backgroundColor: isOnline ? Colors.primary : Colors.warning }]} />
              <Text style={styles.offlineStatus}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
            <View style={styles.pendingRow}>
              <Text style={styles.pendingLabel}>Pending Events</Text>
              <View style={[styles.pendingBadge, pendingCount > 0 && styles.pendingBadgeActive]}>
                <Text style={[styles.pendingCount, pendingCount > 0 && styles.pendingCountActive]}>
                  {pendingCount}
                </Text>
              </View>
            </View>
            {isOnline && (
              <TouchableOpacity
                style={[styles.syncBtn, isSyncing && styles.syncBtnDisabled]}
                onPress={syncNow}
                disabled={isSyncing}
                accessibilityLabel="Sync now button"
              >
                {isSyncing ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <Text style={styles.syncBtnText}>↑  Sync Now</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Info</Text>
          <InfoRow icon="📱" label="App Version" value="1.0.0" />
          <InfoRow icon="☁️" label="Backend" value="Supabase" />
        </View>

        <View style={styles.section}>
          <TouchableOpacity
            style={styles.signOutBtn}
            onPress={handleSignOut}
            accessibilityLabel="Sign out button"
          >
            <Text style={styles.signOutIcon}>⎋</Text>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: Spacing['2xl'] }} />
      </ScrollView>
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerTitle: { flex: 1, color: Colors.white, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, textAlign: 'center' },
  scroll: { padding: Spacing.xl },
  profileCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border,
    padding: Spacing.xl, marginBottom: Spacing.xl,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: Colors.primaryGlow, borderWidth: 2, borderColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginRight: Spacing.base,
  },
  avatarText: { color: Colors.primary, fontSize: Typography.fontSize.xl, fontWeight: Typography.fontWeight.extrabold },
  profileInfo: { flex: 1 },
  profileName: { color: Colors.textPrimary, fontSize: Typography.fontSize.lg, fontWeight: Typography.fontWeight.bold, marginBottom: 6 },
  driverBadge: { backgroundColor: Colors.primaryGlow, borderRadius: Radius.full, paddingHorizontal: 10, paddingVertical: 2, alignSelf: 'flex-start' },
  driverBadgeText: { color: Colors.primary, fontSize: 10, fontWeight: Typography.fontWeight.extrabold, letterSpacing: 1.5 },
  section: { marginBottom: Spacing.xl },
  sectionTitle: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.semibold, textTransform: 'uppercase', letterSpacing: 1, marginBottom: Spacing.md },
  infoRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.card, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.border,
    paddingVertical: Spacing.base, paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm,
  },
  infoIcon: { fontSize: 18, marginRight: Spacing.md, width: 28, textAlign: 'center' },
  infoContent: { flex: 1 },
  infoLabel: { color: Colors.textTertiary, fontSize: Typography.fontSize.xs, marginBottom: 2 },
  infoValue: { color: Colors.textPrimary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.medium },
  offlineCard: { backgroundColor: Colors.card, borderRadius: Radius.xl, borderWidth: 1, borderColor: Colors.border, padding: Spacing.xl },
  offlineRow: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.base },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: Spacing.sm },
  offlineStatus: { color: Colors.textSecondary, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.medium },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.base },
  pendingLabel: { color: Colors.textSecondary, fontSize: Typography.fontSize.base },
  pendingBadge: { backgroundColor: Colors.surface, borderRadius: Radius.full, minWidth: 32, height: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  pendingBadgeActive: { backgroundColor: Colors.warningBg },
  pendingCount: { color: Colors.textTertiary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold },
  pendingCountActive: { color: Colors.warning },
  syncBtn: { backgroundColor: Colors.info, borderRadius: Radius.full, paddingVertical: Spacing.md, alignItems: 'center' },
  syncBtnDisabled: { opacity: 0.7 },
  syncBtnText: { color: Colors.white, fontWeight: Typography.fontWeight.bold },
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: Colors.dangerBg, borderRadius: Radius.full, borderWidth: 1, borderColor: Colors.danger,
    paddingVertical: Spacing.base + 2,
  },
  signOutIcon: { fontSize: 18, marginRight: Spacing.sm },
  signOutText: { color: Colors.danger, fontSize: Typography.fontSize.base, fontWeight: Typography.fontWeight.bold },
});
