
import React from 'react';
import { Platform } from 'react-native';

// Import iOS component if available
let IOSIconSymbol: any = null;
try {
  if (Platform.OS === 'ios') {
    IOSIconSymbol = require('./IconSymbol.ios').IconSymbol;
  }
} catch (error) {
  // iOS component not available, use fallback
}

// Fallback for using react-native-vector-icons on Android and web.
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof Ionicons>['name']>;
type IconSymbolName = 
  | 'house.fill'
  | 'paperplane.fill'
  | 'chevron.left.forwardslash.chevron.right'
  | 'chevron.right'
  | 'doc.text'
  | 'note.text'
  | 'magnifyingglass'
  | 'bell'
  | 'checklist'
  | 'checkmark.square'
  | 'gearshape'
  | 'gear'
  | 'document.badge.plus'
  | 'line.horizontal.3';

/**
 * Add your SF Symbols to Ionicons mappings here.
 * - see Ionicons in the [Icons Directory](https://ionic.io/ionicons).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code-slash',
  'chevron.right': 'chevron-forward',
  'doc.text': 'document-text',
  'note.text': 'document-text',
  'magnifyingglass': 'search',
  'bell': 'notifications',
  'checklist': 'checkmark-circle',
  'checkmark.square': 'checkbox',
  'gearshape': 'settings',
  'gear': 'settings',
  'document.badge.plus': 'add-circle',
  'line.horizontal.3': 'menu',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Ionicons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Ionicons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
  weight = 'regular',
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  // Use iOS native symbols if available and on iOS platform
  if (Platform.OS === 'ios' && IOSIconSymbol) {
    return (
      <IOSIconSymbol
        name={name}
        size={size}
        color={color}
        style={style}
        weight={weight}
      />
    );
  }

  // Fallback to Ionicons for other platforms
  return <Ionicons color={color} size={size} name={MAPPING[name]} style={style} />;
}
