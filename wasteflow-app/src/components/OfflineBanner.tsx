// src/components/OfflineBanner.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useOffline } from '../context/OfflineQueueContext';
import { Colors, Typography, Spacing } from '../theme';

export default function OfflineBanner() {
  const { isOnline, pendingCount, isSyncing, syncNow } = useOffline();
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!isOnline) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.5, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isOnline]);

  if (isOnline && pendingCount === 0) return null;

  return (
    <View style={[styles.banner, isOnline ? styles.syncing : styles.offline]}>
      <Animated.View style={{ opacity: pulseAnim, flexDirection: 'row', alignItems: 'center', flex: 1 }}>
        <View style={[styles.dot, isOnline ? styles.dotOnline : styles.dotOffline]} />
        <Text style={styles.text}>
          {isOnline
            ? isSyncing
              ? `Syncing ${pendingCount} event${pendingCount !== 1 ? 's' : ''}…`
              : `${pendingCount} event${pendingCount !== 1 ? 's' : ''} pending sync`
            : `Offline — ${pendingCount} event${pendingCount !== 1 ? 's' : ''} pending`}
        </Text>
      </Animated.View>
      {isOnline && !isSyncing && pendingCount > 0 && (
        <TouchableOpacity onPress={syncNow} style={styles.syncBtn}>
          <Text style={styles.syncBtnText}>Sync</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.sm,
  },
  offline: { backgroundColor: Colors.warningBg, borderBottomWidth: 1, borderBottomColor: Colors.warning },
  syncing: { backgroundColor: Colors.infoBg, borderBottomWidth: 1, borderBottomColor: Colors.info },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: Spacing.sm },
  dotOffline: { backgroundColor: Colors.warning },
  dotOnline: { backgroundColor: Colors.info },
  text: { color: Colors.textPrimary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.medium, flex: 1 },
  syncBtn: {
    backgroundColor: Colors.info,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
  },
  syncBtnText: { color: Colors.white, fontSize: Typography.fontSize.xs, fontWeight: Typography.fontWeight.bold },
});
