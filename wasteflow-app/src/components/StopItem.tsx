// src/components/StopItem.tsx
import React, { useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { StopWithStatus } from '../types';
import StatusBadge from './StatusBadge';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  stop: StopWithStatus;
  onPress: () => void;
  onLongPress: () => void;
}

export default function StopItem({ stop, onPress, onLongPress }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  function onPressIn() {
    Animated.spring(scaleAnim, { toValue: 0.98, useNativeDriver: true, tension: 200, friction: 12 }).start();
  }
  function onPressOut() {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 12 }).start();
  }

  const isScanned = stop.status === 'scanned';
  const isSkipped = stop.status === 'skipped';
  const isDone = isScanned || isSkipped;

  // Make the entire card black for completed, dark grey for pending
  const backgroundColor = isDone ? Colors.background : Colors.card;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
        style={[styles.container, { backgroundColor }]}
        accessibilityLabel={`Stop ${stop.stop_order}: ${stop.bwg?.name}`}
        accessibilityHint="Tap to scan, long press to skip"
      >
        <View style={styles.topRow}>
          <Text style={[styles.name, isDone && styles.nameDone]} numberOfLines={1}>
            {stop.bwg?.name ?? 'Unknown'}
          </Text>
          <StatusBadge status={stop.status as any} size="sm" />
        </View>

        <View style={styles.bottomRow}>
          <View style={styles.detailsBox}>
            <Text style={styles.address} numberOfLines={1}>
              {stop.bwg?.address ?? stop.bwg?.ward ?? '—'}
            </Text>
            {stop.bwg?.waste_type_codes?.length > 0 && (
              <View style={styles.wasteTypes}>
                {stop.bwg.waste_type_codes.slice(0, 4).map((code) => (
                  <View key={code} style={styles.wasteTag}>
                    <Text style={styles.wasteTagText}>{code}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          
          {isDone ? (
            <View style={styles.actionBtn}>
              <Text style={styles.actionBtnText}>✓</Text>
            </View>
          ) : (
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.skipChip}
                onPress={onLongPress}
                accessibilityLabel="Skip this stop"
              >
                <Text style={styles.skipChipText}>Skip</Text>
              </TouchableOpacity>
              <View style={styles.actionBtn}>
                <Text style={styles.actionBtnText}>Scan</Text>
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.xl,
    marginBottom: Spacing.md,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  topRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: Spacing.md 
  },
  name: { 
    color: Colors.white, 
    fontSize: Typography.fontSize.md, 
    fontWeight: Typography.fontWeight.semibold, 
    flex: 1, 
    marginRight: Spacing.sm 
  },
  nameDone: { 
    color: Colors.textSecondary 
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  detailsBox: {
    flex: 1,
    paddingRight: Spacing.md,
  },
  address: { 
    color: Colors.textSecondary, 
    fontSize: Typography.fontSize.sm, 
    marginBottom: Spacing.sm 
  },
  wasteTypes: { 
    flexDirection: 'row', 
    gap: Spacing.xs, 
    flexWrap: 'wrap' 
  },
  wasteTag: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  wasteTagText: { 
    color: Colors.textSecondary, 
    fontSize: Typography.fontSize.xs, 
    fontWeight: Typography.fontWeight.medium 
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  skipChip: {
    paddingHorizontal: 12,
    height: 44,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipChipText: {
    color: Colors.danger,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.bold,
  },
});
