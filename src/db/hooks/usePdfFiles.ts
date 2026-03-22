import { useCallback, useEffect, useState } from 'react';
import { useFirebaseDatabase } from '../FirebaseDatabaseProvider';
import { PdfFile } from '../schema';
import { getDatabase, ref, onValue, update, remove, set, push, child, get, orderByChild, query, equalTo } from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';

export const usePdfFiles = () => {
  const { getPdfFilesRef } = useFirebaseDatabase();
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dbRef = getPdfFilesRef();
    console.log('📡 Setting up PDF files listener...');
    
    const unsubscribe = onValue(dbRef, (snapshot) => {
      console.log('📦 PDF files snapshot received:', snapshot.exists() ? 'has data' : 'empty');
      const data = snapshot.val();
      if (data) {
        const files = Object.entries(data).map(([key, value]) => ({
          ...(value as PdfFile),
          id: key,
        }));
        // Sort by lastOpened DESC
        files.sort((a, b) => b.lastOpened - a.lastOpened);
        setPdfFiles(files);
        console.log(`✅ Loaded ${files.length} PDF files`);
      } else {
        console.log('⚠️ No PDF files found in database');
        setPdfFiles([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('❌ Error listening to PDF files:', error);
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [getPdfFilesRef]);

  const addPdfFile = useCallback(async (name: string, path: string): Promise<string> => {
    try {
      console.log('💾 Adding new PDF:', { name, path });
      const dbRef = getPdfFilesRef();
      
      // First check if file already exists (by name, since path is temp cache)
      const snapshot = await get(dbRef);
      const data = snapshot.val();
      if (data) {
        // Find by name (path is unreliable due to temp cache)
        for (const [key, value] of Object.entries(data)) {
          const pdf = value as PdfFile;
          if (pdf.name === name) {
            console.log('⚠️ PDF already exists with ID:', key);
            // Update with new path and last opened
            await update(child(dbRef, key), { 
              path, 
              lastOpened: Date.now(), 
              lastVisitedPageNo: 1 
            });
            return key;
          }
        }
      }
      
      // Create ID based on name only (path is temp cache, unreliable)
      const sanitizeId = (name: string): string => {
        // Simple djb2 hash
        let hash = 5381;
        for (let i = 0; i < name.length; i++) {
          hash = ((hash << 5) + hash) + name.charCodeAt(i);
          hash = hash & hash; // Convert to 32bit integer
        }
        // Convert to hex and ensure positive
        const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
        return 'pdf_' + hashHex;
      };
      
      const id = sanitizeId(name);
      console.log('🔑 Generated ID for', name, ':', id);
      
      const pdfFile: Omit<PdfFile, 'id'> = {
        name,
        path,
        lastOpened: Date.now(),
        lastVisitedPageNo: 1,
      };
      await set(child(dbRef, id), pdfFile);
      console.log('✅ PDF added with ID:', id);
      return id;
    } catch (error) {
      console.error('❌ Error adding PDF:', error);
      throw error;
    }
  }, [getPdfFilesRef]);

  const updateLastOpened = useCallback(async (id: string, pageNo?: number) => {
    const dbRef = getPdfFilesRef();
    const updates: Partial<PdfFile> = {
      lastOpened: Date.now(),
    };
    if (pageNo !== undefined) {
      updates.lastVisitedPageNo = pageNo;
    }
    await update(child(dbRef, id), updates);
  }, [getPdfFilesRef]);

  const deletePdfFile = useCallback(async (id: string) => {
    const dbRef = getPdfFilesRef();
    await remove(child(dbRef, id));
  }, [getPdfFilesRef]);

  return {
    pdfFiles,
    loading,
    addPdfFile,
    updateLastOpened,
    deletePdfFile,
  };
};

export const usePdfActions = () => {
  const { getPdfFilesRef } = useFirebaseDatabase();

  const getPdfFileByPath = useCallback(async (path: string, name?: string): Promise<PdfFile | null> => {
    try {
      console.log('🔍 Searching for PDF:', { path, name });
      const dbRef = getPdfFilesRef();
      
      // Search by name (path is temp cache, unreliable)
      if (name) {
        const snapshot = await get(dbRef);
        const data = snapshot.val();
        if (data) {
          // Find the file that matches by name
          for (const [key, value] of Object.entries(data)) {
            const pdf = value as PdfFile;
            if (pdf.name === name) {
              console.log('✅ Found match:', key, 'Name:', pdf.name);
              
              // Check if this is an old random ID (starts with -)
              if (key.startsWith('-')) {
                console.log('⚠️ Found old random ID, will migrate to hash-based ID');
                return null; // Force recreation with new ID
              }
              
              return { ...pdf, id: key };
            }
          }
        }
      }
      
      console.log('⚠️ PDF not found in database');
      return null;
    } catch (error) {
      console.error('❌ Error getting PDF:', error);
      return null;
    }
  }, [getPdfFilesRef]);

  const addPdfFile = useCallback(async (name: string, path: string): Promise<string> => {
    try {
      console.log('💾 Adding new PDF:', { name, path });
      const dbRef = getPdfFilesRef();
      
      // First check if file already exists (by name, since path is temp cache)
      const snapshot = await get(dbRef);
      const data = snapshot.val();
      if (data) {
        // Find by name (path is unreliable due to temp cache)
        for (const [key, value] of Object.entries(data)) {
          const pdf = value as PdfFile;
          if (pdf.name === name) {
            console.log('⚠️ PDF already exists with ID:', key);
            // Update with new path and last opened
            await update(child(dbRef, key), { 
              path, 
              lastOpened: Date.now(), 
              lastVisitedPageNo: 1 
            });
            return key;
          }
        }
      }
      
      // Create ID based on name only (path is temp cache, unreliable)
      const sanitizeId = (name: string): string => {
        // Simple djb2 hash
        let hash = 5381;
        for (let i = 0; i < name.length; i++) {
          hash = ((hash << 5) + hash) + name.charCodeAt(i);
          hash = hash & hash; // Convert to 32bit integer
        }
        // Convert to hex and ensure positive
        const hashHex = Math.abs(hash).toString(16).padStart(8, '0');
        return 'pdf_' + hashHex;
      };
      
      const id = sanitizeId(name);
      console.log('🔑 Generated ID for', name, ':', id);
      
      const pdfFile: Omit<PdfFile, 'id'> = {
        name,
        path,
        lastOpened: Date.now(),
        lastVisitedPageNo: 1,
      };
      await set(child(dbRef, id), pdfFile);
      console.log('✅ PDF added with ID:', id);
      return id;
    } catch (error) {
      console.error('❌ Error adding PDF:', error);
      throw error;
    }
  }, [getPdfFilesRef]);

  const updateLastOpened = useCallback(async (id: string, pageNo?: number) => {
    const dbRef = getPdfFilesRef();
    const updates: Partial<PdfFile> = {
      lastOpened: Date.now(),
    };
    if (pageNo !== undefined) {
      updates.lastVisitedPageNo = pageNo;
    }
    await update(child(dbRef, id), updates);
  }, [getPdfFilesRef]);

  const updatePageNumberOnly = useCallback(async (id: string, pageNo: number) => {
    const dbRef = getPdfFilesRef();
    await update(child(dbRef, id), { lastVisitedPageNo: pageNo });
  }, [getPdfFilesRef]);

  return {
    getPdfFileByPath,
    addPdfFile,
    updateLastOpened,
    updatePageNumberOnly,
  };
};
