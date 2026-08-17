// src/screens/OnboardingScreen.tsx
import React, { useRef, useEffect } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  Platform,
  StatusBar,
  Animated,
  PanResponder,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors, Typography, Spacing, Radius } from '../theme';

export default function OnboardingScreen() {
  const navigation = useNavigation<any>();

  // Swipe button logic
  const pan = useRef(new Animated.ValueXY()).current;
  const anim1 = useRef(new Animated.Value(0.2)).current;
  const anim2 = useRef(new Animated.Value(0.2)).current;
  const anim3 = useRef(new Animated.Value(0.2)).current;

  // Sizes for larger button
  const buttonWidth = 300;
  const buttonHeight = 72;
  const thumbWidth = 56; 
  const padding = 8;
  const maxSlide = buttonWidth - thumbWidth - (padding * 2);

  useEffect(() => {
    const pulse = (anim: Animated.Value) => Animated.sequence([
      Animated.timing(anim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(anim, { toValue: 0.2, duration: 250, useNativeDriver: true }),
    ]);

    Animated.loop(
      Animated.sequence([
        Animated.stagger(150, [
          pulse(anim1),
          pulse(anim2),
          pulse(anim3),
        ]),
        Animated.delay(1000),
      ])
    ).start();
  }, [anim1, anim2, anim3]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (e, gesture) => {
        if (gesture.dx > maxSlide * 0.7) {
          // Trigger action
          Animated.timing(pan, {
            toValue: { x: maxSlide, y: 0 },
            duration: 150,
            useNativeDriver: false,
          }).start(() => {
            navigation.navigate('Login');
            // Reset the swipe thumb for when we go back
            setTimeout(() => pan.setValue({ x: 0, y: 0 }), 300);
          });
        } else {
          // Snap back
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            tension: 80,
            friction: 10,
            useNativeDriver: false,
          }).start();
        }
      }
    })
  ).current;

  // Note: Translation removed in favor of purely cascading opacities

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

        {/* Bottom Half: Description & Swipe Button */}
        <View style={styles.bottomSection}>
          <Text style={styles.description}>
            Our Logistics Services provide end-to-end solutions for all your shipping needs.
          </Text>
          
          <View style={[styles.swipeButton, { width: buttonWidth, height: buttonHeight }]}>
            <View style={styles.swipeTextContainer}>
              <Text style={styles.swipeText}>Get started</Text>
              
              {/* Animated Chevrons */}
              <View style={styles.chevronContainer}>
                <Animated.Text style={[styles.chevron, { opacity: anim1 }]}>›</Animated.Text>
                <Animated.Text style={[styles.chevron, { opacity: anim2 }]}>›</Animated.Text>
                <Animated.Text style={[styles.chevron, { opacity: anim3 }]}>›</Animated.Text>
              </View>
            </View>
            
            <Animated.View
              style={[
                styles.swipeThumb,
                {
                  width: thumbWidth,
                  height: thumbWidth,
                  transform: [{
                    translateX: pan.x.interpolate({
                      inputRange: [0, maxSlide],
                      outputRange: [0, maxSlide],
                      extrapolate: 'clamp' // prevents thumb from going out of bounds
                    })
                  }]
                }
              ]}
              {...panResponder.panHandlers}
            >
              <Text style={styles.swipeIcon}>→</Text>
            </Animated.View>
          </View>

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
  swipeButton: {
    backgroundColor: Colors.primary,
    borderRadius: Radius.full,
    padding: 8,
    justifyContent: 'center',
  },
  swipeTextContainer: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
    marginLeft: 32, // Push it slightly to the right to balance visual weight against the thumb
  },
  swipeText: {
    color: Colors.black,
    fontSize: Typography.fontSize.md,
    fontWeight: Typography.fontWeight.bold,
    marginRight: 8,
  },
  chevronContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -2,
  },
  chevron: {
    color: 'rgba(0,0,0,0.5)',
    fontSize: 22,
    fontWeight: 'bold',
    marginRight: -4, // overlap chevrons slightly
  },
  swipeThumb: {
    borderRadius: Radius.full,
    backgroundColor: Colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  swipeIcon: {
    color: Colors.white,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    textAlignVertical: 'center',
    includeFontPadding: false,
    marginTop: -8,
  },
});
