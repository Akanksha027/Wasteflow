// src/components/StatusBadge.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';

type Status = 'pending' | 'scanned' | 'skipped' | 'in_progress' | 'completed' | 'not_started';

interface Props {
  status: Status;
  size?: 'sm' | 'md';
}

const STATUS_CONFIG: Record<Status, { label: string; bg: string; text: string; dot: string }> = {
  pending:     { label: 'Pending',     bg: 'rgba(100,116,139,0.18)', text: Colors.textSecondary, dot: Colors.statusPending },
  scanned:     { label: 'Scanned',     bg: Colors.primaryGlow,       text: Colors.primaryLight,  dot: Colors.primary },
  skipped:     { label: 'Skipped',     bg: Colors.warningBg,         text: Colors.warningLight,  dot: Colors.warning },
  in_progress: { label: 'In Progress', bg: Colors.infoBg,            text: '#93C5FD',            dot: Colors.info },
  completed:   { label: 'Completed',   bg: Colors.primaryGlow,       text: Colors.primaryLight,  dot: Colors.primary },
  not_started: { label: 'Not Started', bg: 'rgba(100,116,139,0.18)', text: Colors.textSecondary, dot: Colors.statusPending },
};

export default function StatusBadge({ status, size = 'md' }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
  const isSmall = size === 'sm';

  return (
    <View style={[styles.badge, { backgroundColor: config.bg }, isSmall && styles.badgeSm]}>
      <View style={[styles.dot, { backgroundColor: config.dot }, isSmall && styles.dotSm]} />
      <Text style={[styles.label, { color: config.text }, isSmall && styles.labelSm]}>
        {config.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: Radius.full,
    alignSelf: 'flex-start',
  },
  badgeSm: { paddingHorizontal: Spacing.sm, paddingVertical: 3 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  dotSm: { width: 5, height: 5, marginRight: 4 },
  label: { fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.semibold },
  labelSm: { fontSize: Typography.fontSize.xs },
});
