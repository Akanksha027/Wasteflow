// src/components/ProgressBar.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Colors, Typography, Spacing, Radius } from '../theme';

interface Props {
  completed: number;
  total: number;
}

export default function ProgressBar({ completed, total }: Props) {
  const progress = total > 0 ? completed / total : 0;
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: progress,
      tension: 40,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const percentage = Math.round(progress * 100);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>{completed} of {total} stops completed</Text>
        <Text style={styles.percent}>{percentage}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.fill,
            {
              width: widthAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: percentage === 100 ? Colors.primary : Colors.info,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.base },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  label: { color: Colors.textSecondary, fontSize: Typography.fontSize.sm },
  percent: { color: Colors.textPrimary, fontSize: Typography.fontSize.sm, fontWeight: Typography.fontWeight.bold },
  track: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: Radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
