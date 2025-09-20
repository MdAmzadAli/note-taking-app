import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';

interface SkeletonLoaderProps {
  height: number;
  width?: number | string;
  borderRadius?: number;
  marginBottom?: number;
  style?: any;
}

export default function SkeletonLoader({ 
  height, 
  width = '100%', 
  borderRadius = 8, 
  marginBottom = 8,
  style 
}: SkeletonLoaderProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: false,
        }),
      ])
    );

    animation.start();

    return () => animation.stop();
  }, [animatedValue]);

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['#2a2a2a', '#3a3a3a'],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          height,
          width,
          borderRadius,
          marginBottom,
          backgroundColor,
        },
        style,
      ]}
    />
  );
}

// Predefined skeleton components for common use cases
export function FileCardSkeleton() {
  return (
    <View style={styles.fileCardSkeleton}>
      <View style={styles.leftBorder} />
      <View style={styles.fileCardContent}>
        <SkeletonLoader height={16} width="60%" marginBottom={4} />
        <View style={styles.metaRow}>
          <SkeletonLoader height={10} width="25%" borderRadius={4} marginBottom={0} />
          <View style={styles.dot} />
          <SkeletonLoader height={10} width="30%" borderRadius={4} marginBottom={0} />
        </View>
      </View>
      <SkeletonLoader height={16} width={16} borderRadius={8} marginBottom={0} />
    </View>
  );
}

export function ChatMessageSkeleton() {
  return (
    <View style={styles.chatMessageSkeleton}>
      <SkeletonLoader height={14} width="80%" marginBottom={6} />
      <SkeletonLoader height={14} width="60%" marginBottom={6} />
      <SkeletonLoader height={14} width="40%" marginBottom={0} />
    </View>
  );
}

export function HeaderSkeleton() {
  return (
    <View style={styles.headerSkeleton}>
      <SkeletonLoader height={24} width="40%" marginBottom={8} />
      <SkeletonLoader height={16} width="60%" marginBottom={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#2a2a2a',
  },
  fileCardSkeleton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1.4,
    borderColor: '#555555',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingRight: 16,
  },
  leftBorder: {
    width: 4,
    height: '100%',
    backgroundColor: '#00D4AA',
    marginRight: 12,
  },
  fileCardContent: {
    flex: 1,
    paddingLeft: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 2,
    height: 2,
    backgroundColor: '#8E8E93',
    borderRadius: 1,
    marginHorizontal: 6,
  },
  chatMessageSkeleton: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  headerSkeleton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});