// src/screens/OnboardingScreen.tsx
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  Platform,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../theme';

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
      <View style={styles.container}>
        
        {/* Top Half: Image & Headline */}
        <View style={styles.imageContainer}>
          <Image
            source={require('../../assets/onboarding-truck.png')}
            style={styles.image}
            resizeMode="cover"
          />
          <View style={styles.overlay}>
            <Text style={styles.headline}>
              Your Logistics{'\n'}Partner for Seamless{'\n'}Delivery
            </Text>
          </View>
        </View>

        {/* Bottom Half: Description & Button */}
        <View style={styles.bottomSection}>
          <Text style={styles.description}>
            Our Logistics Services provide end-to-end solutions for all your shipping needs.
          </Text>
          
          <TouchableOpacity 
            style={styles.button}
            onPress={() => navigation.replace('Login')}
            activeOpacity={0.8}
            accessibilityLabel="Get started"
          >
            <Text style={styles.buttonText}>Get started</Text>
            <View style={styles.buttonIconContainer}>
              <Text style={styles.buttonIcon}>→</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  imageContainer: {
    flex: 1.5,
    position: 'relative',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    padding: Spacing.xl,
    paddingTop: Spacing['3xl'],
  },
  headline: {
    color: Colors.white,
    fontSize: Typography.fontSize['3xl'],
    fontWeight: Typography.fontWeight.bold,
    lineHeight: 40,
  },
  bottomSection: {
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  description: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.base,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing['4xl'],
    paddingHorizontal: Spacing.lg,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    paddingVertical: 8,
    paddingHorizontal: Spacing.xl,
    paddingRight: 8,
    width: 220,
    justifyContent: 'space-between',
  },
  buttonText: {
    color: Colors.black,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.semibold,
    marginLeft: Spacing.md,
  },
  buttonIconContainer: {
    width: 36,
    height: 36,
    borderRadius: Radius.full,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonIcon: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
});
