import React from 'react';
import { useLayoutEffect } from 'react';

// Add polyfill before any other imports that might use React
if (!React.useInsertionEffect) {
  // @ts-ignore - runtime fix
  React.useInsertionEffect = useLayoutEffect;
}

import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/(tabs)" />;
}