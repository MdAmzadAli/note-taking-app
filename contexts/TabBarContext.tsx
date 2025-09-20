import React, { createContext, useContext, useState, ReactNode } from 'react';

interface TabBarContextType {
  isTabBarVisible: boolean;
  hideTabBar: () => void;
  showTabBar: () => void;
}

const TabBarContext = createContext<TabBarContextType>({
  isTabBarVisible: true,
  hideTabBar: () => {},
  showTabBar: () => {},
});

export const useTabBar = () => useContext(TabBarContext);

export const TabBarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isTabBarVisible, setIsTabBarVisible] = useState(true);

  const hideTabBar = React.useCallback(() => {
    console.log('🎯 TabBarContext: Hiding tab bar');
    setIsTabBarVisible(false);
  }, []);
  
  const showTabBar = React.useCallback(() => {
    console.log('🎯 TabBarContext: Showing tab bar');
    setIsTabBarVisible(true);
  }, []);

  // Safety net - ensure tab bar is visible on app focus/resume
  React.useEffect(() => {
    const handleAppStateChange = () => {
      // Reset tab bar visibility when app becomes active
      setTimeout(() => {
        console.log('🎯 TabBarContext: App state change - Ensuring tab bar visibility');
        setIsTabBarVisible(true);
      }, 100);
    };

    // For React Native, we'd use AppState, but since we're in Expo/web context, 
    // we'll use visibility change events
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleAppStateChange);
      
      return () => {
        document.removeEventListener('visibilitychange', handleAppStateChange);
      };
    }
  }, []);

  return (
    <TabBarContext.Provider value={{ isTabBarVisible, hideTabBar, showTabBar }}>
      {children}
    </TabBarContext.Provider>
  );
};