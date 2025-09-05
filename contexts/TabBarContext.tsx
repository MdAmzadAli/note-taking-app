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

  const hideTabBar = () => setIsTabBarVisible(false);
  const showTabBar = () => setIsTabBarVisible(true);

  return (
    <TabBarContext.Provider value={{ isTabBarVisible, hideTabBar, showTabBar }}>
      {children}
    </TabBarContext.Provider>
  );
};