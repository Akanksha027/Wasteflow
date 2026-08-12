// src/components/RouteCard.tsx
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Route, CollectionTrip } from '../types';
import { Colors, Typography, Spacing, Radius, Shadow } from '../theme';

interface Props {
  route: Route;
  stopCount: number;
  trip: CollectionTrip | null;
  onPress: () => void;
  isSyncing?: boolean;
}

export default function RouteCard({ route, stopCount, trip, onPress, isSyncing }: Props) {
  const isActive = trip && trip.status === 'in_progress';
  const isCompleted = trip && trip.status === 'completed';

  const collectedCount = trip?.total_collected_kg ? 'Started' : 'Pending';

  return (
    <View style={[styles.card, isActive && styles.cardActive, isCompleted && styles.cardCompleted]}>
      {/* Header section */}
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          <Text style={[styles.icon, isActive && styles.iconActive]}>🚛</Text>
        </View>
        <View style={styles.info}>
          <Text style={[styles.routeName, isActive && styles.textBlack]}>{route.name}</Text>
          <Text style={[styles.routeCode, isActive && styles.textBlackSoft]}>
            {route.route_code} • {stopCount} Stops
          </Text>
        </View>
        
        {/* Status Badge in place of "Tracking" */}
        <View style={[styles.statusBadge, isActive && styles.statusBadgeActive]}>
          <Text style={[styles.statusText, isActive && styles.textWhite]}>
            {isCompleted ? 'Completed' : isActive ? 'Tracking' : 'Pending'}
          </Text>
        </View>
      </View>

      {/* Details Row */}
      <View style={styles.detailsRow}>
        <Text style={[styles.detailText, isActive && styles.textBlack]}>{route.ward || 'General'}</Text>
        <View style={[styles.dot, isActive && { backgroundColor: Colors.black }]} />
        <Text style={[styles.detailText, isActive && styles.textBlack]}>Today</Text>
        <View style={[styles.dot, isActive && { backgroundColor: Colors.black }]} />
        <Text style={[styles.detailText, isActive && styles.textBlack]}>{collectedCount}</Text>
      </View>

      {/* Buttons */}
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.secondaryBtn, isActive && styles.secondaryBtnActive]}
          disabled={isCompleted || isSyncing}
        >
          <Text style={[styles.secondaryBtnText, isActive && styles.textWhite]}>Details</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.primaryBtn, 
            isActive && styles.primaryBtnActive,
            (isCompleted || isSyncing) && styles.btnDisabled
          ]}
          onPress={onPress}
          disabled={isCompleted || isSyncing}
        >
          <Text style={[styles.primaryBtnText, isActive && styles.textWhite]}>
            {isActive ? 'Continue Trip' : 'Accept Trip'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
    ...Shadow.glow(Colors.primary),
  },
  cardCompleted: {
    opacity: 0.6,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: Radius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.md,
  },
  icon: {
    fontSize: 20,
  },
  iconActive: {
    opacity: 0.9,
  },
  info: {
    flex: 1,
  },
  routeName: {
    color: Colors.textPrimary,
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.bold,
  },
  routeCode: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statusBadgeActive: {
    backgroundColor: Colors.black,
    borderColor: Colors.black,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.xl,
    paddingHorizontal: 4,
  },
  detailText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.textTertiary,
    marginHorizontal: Spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: Colors.surface,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryBtnActive: {
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderColor: 'rgba(0,0,0,0.1)',
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: Radius.full,
    alignItems: 'center',
  },
  primaryBtnActive: {
    backgroundColor: Colors.black,
  },
  secondaryBtnText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.semibold,
  },
  primaryBtnText: {
    color: Colors.black,
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.bold,
  },
  btnDisabled: {
    opacity: 0.5,
  },
  textBlack: { color: Colors.black },
  textBlackSoft: { color: 'rgba(0,0,0,0.7)' },
  textWhite: { color: Colors.white },
});
