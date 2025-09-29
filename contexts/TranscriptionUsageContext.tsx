import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '@/config/api';
import { io, Socket } from 'socket.io-client';

interface TranscriptionUsageData {
  current_usage: number;
  limit: number;
  percentage: number;
}

interface TranscriptionUsageContextType {
  usageData: TranscriptionUsageData;
  isLoading: boolean;
  isUsageLimitExceeded: boolean; // percentage >= 100
  refreshUsage: () => Promise<void>;
}

const defaultUsageData: TranscriptionUsageData = {
  current_usage: 0,
  limit: 60,
  percentage: 0
};

const TranscriptionUsageContext = createContext<TranscriptionUsageContextType>({
  usageData: defaultUsageData,
  isLoading: true,
  isUsageLimitExceeded: false,
  refreshUsage: async () => {},
});

export const useTranscriptionUsage = () => useContext(TranscriptionUsageContext);

export const TranscriptionUsageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [usageData, setUsageData] = useState<TranscriptionUsageData>(defaultUsageData);
  const [isLoading, setIsLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  // Calculate if usage limit is exceeded
  const isUsageLimitExceeded = usageData.percentage >= 100;

  const loadUsageFromAPI = async (): Promise<void> => {
    try {
      const userUuid = await AsyncStorage.getItem('userUuid');
      if (userUuid) {
        console.log('[TRANSCRIPTION_USAGE] Loading usage data from API for user:', userUuid);
        
        const response = await fetch(`${API_ENDPOINTS.base}/usage/transcription/${userUuid}`);
        if (response.ok) {
          const apiUsageData = await response.json();
          if (apiUsageData.success) {
            const percentage = (apiUsageData.transcription_used / apiUsageData.transcription_limit) * 100;
            const newUsageData = {
              current_usage: apiUsageData.transcription_used,
              limit: apiUsageData.transcription_limit,
              percentage: Math.round(percentage * 10) / 10
            };
            
            setUsageData(newUsageData);
            console.log('[TRANSCRIPTION_USAGE] Usage data loaded:', newUsageData);
          }
        }
      }
    } catch (error) {
      console.error('[TRANSCRIPTION_USAGE] Error loading usage data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupSocketConnection = async () => {
    try {
      const userUuid = await AsyncStorage.getItem('userUuid');
      if (userUuid && !socketRef.current) {
        console.log('[TRANSCRIPTION_USAGE] Setting up socket connection for user:', userUuid);
        
        socketRef.current = io(API_ENDPOINTS.base, {
          transports: ['websocket']
        });

        // Listen for transcription usage updates
        socketRef.current.on('transcription_usage_updated', (data) => {
          console.log('[TRANSCRIPTION_USAGE] Received usage update via socket:', data);
          
          if (data.user_uuid === userUuid) {
            const newUsageData = {
              current_usage: data.current_usage,
              limit: data.limit,
              percentage: data.percentage
            };
            setUsageData(newUsageData);
            console.log('[TRANSCRIPTION_USAGE] Usage data updated via socket:', newUsageData);
          }
        });

        socketRef.current.on('connect', () => {
          console.log('[TRANSCRIPTION_USAGE] Socket connected');
        });

        socketRef.current.on('disconnect', () => {
          console.log('[TRANSCRIPTION_USAGE] Socket disconnected');
        });
      }
    } catch (error) {
      console.error('[TRANSCRIPTION_USAGE] Error setting up socket connection:', error);
    }
  };

  // Initialize usage data and socket connection
  useEffect(() => {
    const initialize = async () => {
      await loadUsageFromAPI();
      await setupSocketConnection();
    };

    initialize();

    // Cleanup socket connection on unmount
    return () => {
      if (socketRef.current) {
        console.log('[TRANSCRIPTION_USAGE] Cleaning up socket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const refreshUsage = async (): Promise<void> => {
    setIsLoading(true);
    await loadUsageFromAPI();
  };

  return (
    <TranscriptionUsageContext.Provider 
      value={{ 
        usageData, 
        isLoading, 
        isUsageLimitExceeded,
        refreshUsage 
      }}
    >
      {children}
    </TranscriptionUsageContext.Provider>
  );
};