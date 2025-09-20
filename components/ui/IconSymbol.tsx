import React from 'react';
import { Platform } from 'react-native';

// Fallback for using react-native-vector-icons on Android and web.
import Ionicons from 'react-native-vector-icons/Ionicons';
import { SymbolWeight, SymbolViewProps } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<IconSymbolName, ComponentProps<typeof Ionicons>['name']>;
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
  | 'line.horizontal.3'
  | 'mic'
  | 'mic.fill'
  | 'xmark'
  | 'arrow.up'
  | 'arrow.up.circle'
  | 'chevron.down'
  | 'chevron.up'
  | 'chevron.left'
  | 'phone'
  | 'link'
  | 'globe'
  | 'plus'
  | 'trash'
  | 'arrow.right'
  | 'checkmark'
  | 'folder'
  | 'ellipsis'
  | 'calendar'
  | 'brush'
  | 'target'
  | 'pencil'
  | 'person.crop.circle.badge.plus'
  | 'envelope.fill'
  | 'envelope.open'
  | 'share'
  | 'square.and.arrow.up'
  | 'copy'
  | 'copy.outline'
  | 'clipboard';

/**
 * Add your SF Symbols to Ionicons mappings here.
 * - see Ionicons in the [Icons Directory](https://ionic.io/ionicons).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING: IconMapping = {
  // Add more mappings as needed
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'line.horizontal.3': 'menu',
  'chevron.left.forwardslash.chevron.right': 'code-slash',
  'chevron.right': 'chevron-forward',
  'chevron.left': 'chevron-back',
  'chevron.up': 'chevron-up',
  'chevron.down': 'chevron-down',
  'magnifyingglass': 'search',
  'note.text': 'document-text',
  'doc.text': 'document',
  'mic': 'mic',
  'mic.fill': 'mic',
  'xmark': 'close',
  'arrow.up': 'arrow-up',
  'arrow.up.circle': 'arrow-up-circle',
  'arrow.right': 'arrow-forward',
  'phone': 'phone-portrait',
  'link': 'link',
  'globe': 'globe',
  'plus': 'add',
  'trash': 'trash',
  'checkmark': 'checkmark',
  'folder': 'folder',
  'envelope.fill': 'mail',
  'envelope.open': 'mail-open',
  'ellipsis': 'ellipsis-vertical',
  'calendar': 'calendar',
  'brush': 'brush',
  'gear': 'settings',
  // Missing icon mappings that were causing "?" to appear
  'bell': 'notifications',
  'target': 'radio-button-on',
  'pencil': 'pencil',
  'checkmark.square': 'checkbox',
  'person.crop.circle.badge.plus': 'person-add',
  'gearshape': 'settings',
  'document.badge.plus': 'document-attach',
  'checklist': 'list',
  'share': 'share-outline',
  'square.and.arrow.up': 'share-outline',
  'copy': 'copy',
  'copy.outline': 'copy-outline',
  'clipboard': 'clipboard-outline',
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