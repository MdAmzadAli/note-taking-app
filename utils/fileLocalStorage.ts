import AsyncStorage from '@react-native-async-storage/async-storage';

const LOCAL_FILES_KEY = '@local_files_metadata';

export interface LocalFileMetadata {
  fileId: string;
  localUri?: string;
  originalUrl?: string;
  originalName: string;
  mimeType: string;
  source: 'device' | 'from_url' | 'webpage';
  uploadDate: string;
  size?: number;
  isIndexed: boolean;
}

interface LocalFilesMap {
  [fileId: string]: LocalFileMetadata;
}

export const saveLocalFileMetadata = async (metadata: LocalFileMetadata): Promise<void> => {
  try {
    console.log('💾 Saving file metadata to local storage:', metadata.fileId);
    const existingData = await AsyncStorage.getItem(LOCAL_FILES_KEY);
    const filesMap: LocalFilesMap = existingData ? JSON.parse(existingData) : {};
    
    filesMap[metadata.fileId] = metadata;
    
    await AsyncStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(filesMap));
    console.log('✅ File metadata saved to local storage successfully');
  } catch (error) {
    console.error('❌ Error saving file metadata to local storage:', error);
    throw error;
  }
};

export const getLocalFileMetadata = async (fileId: string): Promise<LocalFileMetadata | null> => {
  try {
    const existingData = await AsyncStorage.getItem(LOCAL_FILES_KEY);
    if (!existingData) {
      return null;
    }
    
    const filesMap: LocalFilesMap = JSON.parse(existingData);
    return filesMap[fileId] || null;
  } catch (error) {
    console.error('❌ Error getting file metadata from local storage:', error);
    return null;
  }
};

export const deleteLocalFileMetadata = async (fileId: string): Promise<void> => {
  try {
    console.log('🗑️ Deleting file metadata from local storage:', fileId);
    const existingData = await AsyncStorage.getItem(LOCAL_FILES_KEY);
    if (!existingData) {
      return;
    }
    
    const filesMap: LocalFilesMap = JSON.parse(existingData);
    delete filesMap[fileId];
    
    await AsyncStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(filesMap));
    console.log('✅ File metadata deleted from local storage successfully');
  } catch (error) {
    console.error('❌ Error deleting file metadata from local storage:', error);
    throw error;
  }
};

export const updateFileIdInLocalStorage = async (tempId: string, realId: string): Promise<void> => {
  try {
    console.log('🔄 Updating file ID in local storage:', tempId, '->', realId);
    const existingData = await AsyncStorage.getItem(LOCAL_FILES_KEY);
    if (!existingData) {
      console.warn('⚠️ No local storage data found during ID update');
      return;
    }
    
    const filesMap: LocalFilesMap = JSON.parse(existingData);
    const fileMetadata = filesMap[tempId];
    
    if (!fileMetadata) {
      console.warn('⚠️ File not found in local storage during ID update:', tempId);
      return;
    }
    
    delete filesMap[tempId];
    filesMap[realId] = { ...fileMetadata, fileId: realId };
    
    await AsyncStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(filesMap));
    console.log('✅ File ID updated in local storage successfully');
  } catch (error) {
    console.error('❌ Error updating file ID in local storage:', error);
    throw error;
  }
};

export const markFileAsIndexed = async (fileId: string): Promise<void> => {
  try {
    console.log('✅ Marking file as indexed in local storage:', fileId);
    const existingData = await AsyncStorage.getItem(LOCAL_FILES_KEY);
    if (!existingData) {
      return;
    }
    
    const filesMap: LocalFilesMap = JSON.parse(existingData);
    if (filesMap[fileId]) {
      filesMap[fileId].isIndexed = true;
      await AsyncStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(filesMap));
      console.log('✅ File marked as indexed successfully');
    }
  } catch (error) {
    console.error('❌ Error marking file as indexed:', error);
    throw error;
  }
};

export const getAllLocalFiles = async (): Promise<LocalFileMetadata[]> => {
  try {
    const existingData = await AsyncStorage.getItem(LOCAL_FILES_KEY);
    if (!existingData) {
      return [];
    }
    
    const filesMap: LocalFilesMap = JSON.parse(existingData);
    return Object.values(filesMap);
  } catch (error) {
    console.error('❌ Error getting all local files:', error);
    return [];
  }
};

export const cleanupUnindexedFiles = async (): Promise<number> => {
  try {
    console.log('🧹 Cleaning up unindexed files from local storage...');
    const existingData = await AsyncStorage.getItem(LOCAL_FILES_KEY);
    if (!existingData) {
      return 0;
    }
    
    const filesMap: LocalFilesMap = JSON.parse(existingData);
    const fileIds = Object.keys(filesMap);
    let deletedCount = 0;
    
    for (const fileId of fileIds) {
      if (!filesMap[fileId].isIndexed) {
        delete filesMap[fileId];
        deletedCount++;
      }
    }
    
    await AsyncStorage.setItem(LOCAL_FILES_KEY, JSON.stringify(filesMap));
    console.log(`✅ Cleaned up ${deletedCount} unindexed files from local storage`);
    return deletedCount;
  } catch (error) {
    console.error('❌ Error cleaning up unindexed files:', error);
    return 0;
  }
};
