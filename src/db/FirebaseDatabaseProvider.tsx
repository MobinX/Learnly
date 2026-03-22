import React, { createContext, useContext, ReactNode, useCallback, useEffect } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getDatabase, ref, keepSynced, setPersistenceEnabled } from '@react-native-firebase/database';
import { PdfFile, Highlight, Chat, SummaryVirtualPage } from './schema';
import { FirebaseDatabaseTypes } from '@react-native-firebase/database';

interface FirebaseDatabaseContextType {
  userId: string;
  getPdfFilesRef: () => FirebaseDatabaseTypes.Reference;
  getHighlightsRef: () => FirebaseDatabaseTypes.Reference;
  getChatsRef: () => FirebaseDatabaseTypes.Reference;
  getSummariesRef: () => FirebaseDatabaseTypes.Reference;
}

const FirebaseDatabaseContext = createContext<FirebaseDatabaseContextType | null>(null);

export const useFirebaseDatabase = () => {
  const context = useContext(FirebaseDatabaseContext);
  if (!context) {
    throw new Error('useFirebaseDatabase must be used within a FirebaseDatabaseProvider');
  }
  return context;
};

interface FirebaseDatabaseProviderProps {
  children: ReactNode;
  userId: string;
}

export const FirebaseDatabaseProvider = ({ children, userId }: FirebaseDatabaseProviderProps) => {
  // Enable offline persistence
  useEffect(() => {
    const enablePersistence = async () => {
      try {
        const db = getDatabase(getApp());
        await setPersistenceEnabled(db, true);
        console.log('✅ Firebase offline persistence enabled');
        
        // Keep user data synced for offline access
        const userRef = ref(db, `users/${userId}`);
        await keepSynced(userRef, true);
        console.log('✅ Firebase data sync enabled for offline access');
      } catch (error) {
        console.error('❌ Failed to enable Firebase persistence:', error);
      }
    };
    enablePersistence();
  }, [userId]);

  const getPdfFilesRef = useCallback(() => {
    const db = getDatabase(getApp());
    return ref(db, `users/${userId}/pdfFiles`);
  }, [userId]);

  const getHighlightsRef = useCallback(() => {
    const db = getDatabase(getApp());
    return ref(db, `users/${userId}/highlights`);
  }, [userId]);

  const getChatsRef = useCallback(() => {
    const db = getDatabase(getApp());
    return ref(db, `users/${userId}/chats`);
  }, [userId]);

  const getSummariesRef = useCallback(() => {
    const db = getDatabase(getApp());
    return ref(db, `users/${userId}/summaries`);
  }, [userId]);

  return (
    <FirebaseDatabaseContext.Provider
      value={{
        userId,
        getPdfFilesRef,
        getHighlightsRef,
        getChatsRef,
        getSummariesRef,
      }}
    >
      {children}
    </FirebaseDatabaseContext.Provider>
  );
};
