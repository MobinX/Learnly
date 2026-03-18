import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { SQLiteProvider, useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { MIGRATIONS } from './migrations';

interface DatabaseContextType {
  notifyUpdate: (tableName: string) => void;
  useTableVersion: (tableName: string) => number;
}

const TableUpdateContext = createContext<DatabaseContextType | null>(null);

export const useTableUpdate = () => {
  const context = useContext(TableUpdateContext);
  if (!context) {
    throw new Error('useTableUpdate must be used within a TableUpdateProvider');
  }
  return context;
};

const TableUpdateProvider = ({ children }: { children: ReactNode }) => {
  const [tableVersions, setTableVersions] = useState<Record<string, number>>({});

  const notifyUpdate = useCallback((tableName: string) => {
    setTableVersions((prev) => ({
      ...prev,
      [tableName]: (prev[tableName] || 0) + 1,
    }));
  }, []);

  const useTableVersion = useCallback((tableName: string) => {
    return tableVersions[tableName] || 0;
  }, [tableVersions]);

  return (
    <TableUpdateContext.Provider value={{ notifyUpdate, useTableVersion }}>
      {children}
    </TableUpdateContext.Provider>
  );
};

const initDb = async (db: SQLiteDatabase) => {
  try {
    await db.execAsync('PRAGMA foreign_keys = ON;');
    for (const query of MIGRATIONS) {
      await db.execAsync(query);
    }
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
  }
};

export const DatabaseProvider = ({ children }: { children: ReactNode }) => {
  return (
    <SQLiteProvider databaseName="learnly.db" onInit={initDb} useSuspense>
      <TableUpdateProvider>
        {children}
      </TableUpdateProvider>
    </SQLiteProvider>
  );
};

export const useAppDatabase = () => {
  const db = useSQLiteContext();
  const { notifyUpdate, useTableVersion } = useTableUpdate();
  return { db, notifyUpdate, useTableVersion };
};
