import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { FirebaseDatabaseProvider, useFirebaseDatabase } from './FirebaseDatabaseProvider';
import { useAuth } from '../auth/useAuth';

interface DatabaseContextType {
  userId: string;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export const useAppDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useAppDatabase must be used within a DatabaseProvider');
  }
  return context;
};

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading, signInAnonymously } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      signInAnonymously();
    }
  }, [loading, user, signInAnonymously]);

  if (loading || !user) {
    return null;
  }

  return (
    <DatabaseContext.Provider value={{ userId: user.uid }}>
      <FirebaseDatabaseProvider userId={user.uid}>
        {children}
      </FirebaseDatabaseProvider>
    </DatabaseContext.Provider>
  );
};
