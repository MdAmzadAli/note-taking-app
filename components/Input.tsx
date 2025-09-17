
import React, { useState } from 'react';
import { TextInput, View, StyleSheet, TextInputProps } from 'react-native';
import { ThemedText } from './ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { BorderRadius, Spacing, Typography } from '@/constants/Colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

export function Input({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  size = 'md',
  style,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  
  const backgroundColor = useThemeColor({}, 'input');
  const borderColor = useThemeColor({}, 'inputBorder');
  const focusColor = useThemeColor({}, 'inputFocus');
  const textColor = useThemeColor({}, 'text');
  const placeholderColor = useThemeColor({}, 'textSecondary');

  const getBorderColor = () => {
    if (error) return useThemeColor({}, 'error');
    if (isFocused) return focusColor;
    return borderColor;
  };

  const getInputContainerStyle = () => {
    return [
      styles.inputContainer,
      styles[size],
      {
        backgroundColor,
        borderColor: getBorderColor(),
      },
      isFocused && styles.focused,
      error && styles.error,
    ];
  };

  return (
    <View style={styles.container}>
      {label && (
        <ThemedText type="label" style={styles.label}>
          {label}
        </ThemedText>
      )}
      
      <View style={getInputContainerStyle()}>
        {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}
        
        <TextInput
          style={[
            styles.input,
            { color: textColor },
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            style,
          ]}
          placeholderTextColor={placeholderColor}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {rightIcon && <View style={styles.rightIcon}>{rightIcon}</View>}
      </View>
      
      {error && (
        <ThemedText type="caption" color="error" style={styles.errorText}>
          {error}
        </ThemedText>
      )}
      
      {hint && !error && (
        <ThemedText type="caption" color="secondary" style={styles.hintText}>
          {hint}
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    marginBottom: Spacing.xs,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
  },
  sm: {
    minHeight: 36,
  },
  md: {
    minHeight: 44,
  },
  lg: {
    minHeight: 52,
  },
  focused: {
    borderWidth: 2,
  },
  error: {
    borderWidth: 2,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    paddingVertical: Spacing.xs,
  },
  inputWithLeftIcon: {
    marginLeft: Spacing.xs,
  },
  inputWithRightIcon: {
    marginRight: Spacing.xs,
  },
  leftIcon: {
    marginRight: Spacing.xs,
  },
  rightIcon: {
    marginLeft: Spacing.xs,
  },
  errorText: {
    marginTop: Spacing.xs / 2,
  },
  hintText: {
    marginTop: Spacing.xs / 2,
  },
});
