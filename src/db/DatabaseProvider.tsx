import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { FirebaseDatabaseProvider } from './FirebaseDatabaseProvider';
import { useAuth } from '../auth/useAuth';

interface DatabaseContextType {
  userId: string;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export const useAppDatabase = () => {
  const context = useContext(DatabaseContext);
  return context;
};

export const useRequireAppDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useRequireAppDatabase must be used within a DatabaseProvider with an authenticated user');
  }
  return context;
};

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();

  // Always render children, even without a user
  // Database context will be null until user signs in
  if (loading || !user) {
    return (
      <DatabaseContext.Provider value={null}>
        {children}
      </DatabaseContext.Provider>
    );
  }

  return (
    <DatabaseContext.Provider value={{ userId: user.uid }}>
      <FirebaseDatabaseProvider userId={user.uid}>
        {children}
      </FirebaseDatabaseProvider>
    </DatabaseContext.Provider>
  );
};
