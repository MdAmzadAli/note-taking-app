import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_ENDPOINTS } from '@/config/api';
import { io, Socket } from 'socket.io-client';

interface TranscriptionUsageData {
  current_usage: number;
  limit: number;
  percentage: number;
}

interface FileUsageData {
  file_size_used: number;
  file_upload_size_limit: number;
  percentage: number;
}

interface TranscriptionUsageContextType {
  usageData: TranscriptionUsageData;
  isLoading: boolean;
  isUsageLimitExceeded: boolean;
  refreshUsage: () => Promise<void>;
}

interface FileUsageContextType {
  usageData: FileUsageData;
  isLoading: boolean;
  isUsageLimitExceeded: boolean;
  refreshUsage: () => Promise<void>;
}

const defaultTranscriptionUsageData: TranscriptionUsageData = {
  current_usage: 0,
  limit: 60,
  percentage: 0
};

const defaultFileUsageData: FileUsageData = {
  file_size_used: 0,
  file_upload_size_limit: 52428800, // 50 MB default
  percentage: 0
};

const TranscriptionUsageContext = createContext<TranscriptionUsageContextType>({
  usageData: defaultTranscriptionUsageData,
  isLoading: true,
  isUsageLimitExceeded: false,
  refreshUsage: async () => {},
});

const FileUsageContext = createContext<FileUsageContextType>({
  usageData: defaultFileUsageData,
  isLoading: true,
  isUsageLimitExceeded: false,
  refreshUsage: async () => {},
});

export const useTranscriptionUsage = () => useContext(TranscriptionUsageContext);
export const useFileUsage = () => useContext(FileUsageContext);

export const UsageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [transcriptionUsageData, setTranscriptionUsageData] = useState<TranscriptionUsageData>(defaultTranscriptionUsageData);
  const [fileUsageData, setFileUsageData] = useState<FileUsageData>(defaultFileUsageData);
  const [isTranscriptionLoading, setIsTranscriptionLoading] = useState(true);
  const [isFileLoading, setIsFileLoading] = useState(true);
  const socketRef = useRef<Socket | null>(null);

  // Calculate if usage limits are exceeded
  const isTranscriptionUsageLimitExceeded = transcriptionUsageData.percentage >= 100;
  const isFileUsageLimitExceeded = fileUsageData.percentage >= 100;

  const loadTranscriptionUsageFromAPI = async (): Promise<void> => {
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
            
            setTranscriptionUsageData(newUsageData);
            console.log('[TRANSCRIPTION_USAGE] Usage data loaded:', newUsageData);
          }
        }
      }
    } catch (error) {
      console.error('[TRANSCRIPTION_USAGE] Error loading usage data:', error);
    } finally {
      setIsTranscriptionLoading(false);
    }
  };

  const loadFileUsageFromAPI = async (): Promise<void> => {
    try {
      const userUuid = await AsyncStorage.getItem('userUuid');
      if (userUuid) {
        console.log('[FILE_USAGE] Loading usage data from API for user:', userUuid);
        
        const response = await fetch(`${API_ENDPOINTS.base}/usage/file/${userUuid}`);
        if (response.ok) {
          const apiUsageData = await response.json();
          if (apiUsageData.success) {
            const percentage = (apiUsageData.file_size_used / apiUsageData.file_upload_size_limit) * 100;
            const newUsageData = {
              file_size_used: apiUsageData.file_size_used,
              file_upload_size_limit: apiUsageData.file_upload_size_limit,
              percentage: Math.round(percentage * 10) / 10
            };
            
            setFileUsageData(newUsageData);
            console.log('[FILE_USAGE] Usage data loaded:', newUsageData);
          }
        }
      }
    } catch (error) {
      console.error('[FILE_USAGE] Error loading usage data:', error);
    } finally {
      setIsFileLoading(false);
    }
  };

  const setupSocketConnection = async () => {
    try {
      const userUuid = await AsyncStorage.getItem('userUuid');
      if (userUuid && !socketRef.current) {
        console.log('[USAGE] Setting up socket connection for user:', userUuid);
        
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
            setTranscriptionUsageData(newUsageData);
            console.log('[TRANSCRIPTION_USAGE] Usage data updated via socket:', newUsageData);
          }
        });

        // Listen for file usage updates
        socketRef.current.on('file_usage_updated', (data) => {
          console.log('[FILE_USAGE] Received usage update via socket:', data);
          
          if (data.user_uuid === userUuid) {
            const newUsageData = {
              file_size_used: data.file_size_used,
              file_upload_size_limit: data.file_upload_size_limit,
              percentage: data.percentage
            };
            setFileUsageData(newUsageData);
            console.log('[FILE_USAGE] Usage data updated via socket:', newUsageData);
          }
        });

        socketRef.current.on('connect', () => {
          console.log('[USAGE] Socket connected');
        });

        socketRef.current.on('disconnect', () => {
          console.log('[USAGE] Socket disconnected');
        });
      }
    } catch (error) {
      console.error('[USAGE] Error setting up socket connection:', error);
    }
  };

  // Initialize usage data and socket connection
  useEffect(() => {
    const initialize = async () => {
      await Promise.all([
        loadTranscriptionUsageFromAPI(),
        loadFileUsageFromAPI()
      ]);
      await setupSocketConnection();
    };

    initialize();

    // Cleanup socket connection on unmount
    return () => {
      if (socketRef.current) {
        console.log('[USAGE] Cleaning up socket connection');
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  const refreshTranscriptionUsage = async (): Promise<void> => {
    setIsTranscriptionLoading(true);
    await loadTranscriptionUsageFromAPI();
  };

  const refreshFileUsage = async (): Promise<void> => {
    setIsFileLoading(true);
    await loadFileUsageFromAPI();
  };

  return (
    <TranscriptionUsageContext.Provider 
      value={{ 
        usageData: transcriptionUsageData, 
        isLoading: isTranscriptionLoading, 
        isUsageLimitExceeded: isTranscriptionUsageLimitExceeded,
        refreshUsage: refreshTranscriptionUsage 
      }}
    >
      <FileUsageContext.Provider
        value={{
          usageData: fileUsageData,
          isLoading: isFileLoading,
          isUsageLimitExceeded: isFileUsageLimitExceeded,
          refreshUsage: refreshFileUsage
        }}
      >
        {children}
      </FileUsageContext.Provider>
    </TranscriptionUsageContext.Provider>
  );
};

// Backward compatibility: export the old name as well
export const TranscriptionUsageProvider = UsageProvider;
