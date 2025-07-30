import React from 'react';
import { Platform } from 'react-native';

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
const MAPPING: IconMapping = {
  // Add more mappings as needed
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code-slash',
  'chevron.right': 'chevron-forward',
  'magnifyingglass': 'search',
  'line.horizontal.3': 'menu',
  'note.text': 'document-text',
  'mic': 'mic',
  'mic.fill': 'mic',
} as const;

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
  // For now, always use Ionicons until we fix the iOS integration properly
  const ioniconsName = MAPPING[name];

  if (!ioniconsName) {
    console.warn(`IconSymbol: No mapping found for "${name}"`);
    return <Ionicons color={color} size={size} name="help-outline" style={style} />;
  }

  return <Ionicons color={color} size={size} name={ioniconsName} style={style} />;
}