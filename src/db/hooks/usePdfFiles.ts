import { useCallback, useEffect, useState } from 'react';
import { useAppDatabase } from '../DatabaseProvider';
import { PdfFile, TableNames } from '../schema';
import * as Crypto from 'expo-crypto';

export const usePdfFiles = () => {
  const { db, notifyUpdate, useTableVersion } = useAppDatabase();
  const version = useTableVersion(TableNames.PDF_FILES);
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);

  const fetchPdfFiles = useCallback(async () => {
    try {
      const result = await db.getAllAsync<PdfFile>(
        `SELECT * FROM ${TableNames.PDF_FILES} ORDER BY lastOpened DESC`
      );
      setPdfFiles(result);
    } catch (error) {
      console.error('Error fetching PDF files:', error);
    }
  }, [db]);

  useEffect(() => {
    fetchPdfFiles();
  }, [fetchPdfFiles, version]);

  const addPdfFile = useCallback(async (name: string, path: string) => {
    const id = Crypto.randomUUID();
    const now = Date.now();
    try {
      const statement = await db.prepareAsync(
        `INSERT INTO ${TableNames.PDF_FILES} (id, name, path, lastOpened, lastVisitedPageNo) VALUES ($id, $name, $path, $lastOpened, $lastVisitedPageNo)`
      );
      try {
        await statement.executeAsync({
          $id: id,
          $name: name,
          $path: path,
          $lastOpened: now,
          $lastVisitedPageNo: 1,
        });
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.PDF_FILES);
      return id;
    } catch (error) {
      console.error('Error adding PDF file:', error);
      throw error;
    }
  }, [db, notifyUpdate]);

  const updateLastOpened = useCallback(async (id: string, pageNo?: number) => {
    const now = Date.now();
    try {
      let query = `UPDATE ${TableNames.PDF_FILES} SET lastOpened = $lastOpened`;
      const params: any = { $id: id, $lastOpened: now };
      
      if (pageNo !== undefined) {
        query += `, lastVisitedPageNo = $pageNo`;
        params.$pageNo = pageNo;
      }
      
      query += ` WHERE id = $id`;

      const statement = await db.prepareAsync(query);
      try {
        await statement.executeAsync(params);
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.PDF_FILES);
    } catch (error) {
      console.error('Error updating PDF file:', error);
      throw error;
    }
  }, [db, notifyUpdate]);

  const deletePdfFile = useCallback(async (id: string) => {
    try {
      const statement = await db.prepareAsync(
        `DELETE FROM ${TableNames.PDF_FILES} WHERE id = $id`
      );
      try {
        await statement.executeAsync({ $id: id });
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.PDF_FILES);
    } catch (error) {
      console.error('Error deleting PDF file:', error);
      throw error;
    }
  }, [db, notifyUpdate]);

  return {
    pdfFiles,
    addPdfFile,
    updateLastOpened,
    deletePdfFile,
  };
};

export const usePdfActions = () => {
  const { db, notifyUpdate } = useAppDatabase();

  const getPdfFileByPath = useCallback(async (path: string) => {
    try {
      const result = await db.getFirstAsync<PdfFile>(
        `SELECT * FROM ${TableNames.PDF_FILES} WHERE path = $path`,
        { $path: path }
      );
      return result;
    } catch (error) {
      console.error('Error getting PDF file by path:', error);
      return null;
    }
  }, [db]);

  const addPdfFile = useCallback(async (name: string, path: string) => {
    const id = Crypto.randomUUID();
    const now = Date.now();
    try {
      const statement = await db.prepareAsync(
        `INSERT INTO ${TableNames.PDF_FILES} (id, name, path, lastOpened, lastVisitedPageNo) VALUES ($id, $name, $path, $lastOpened, $lastVisitedPageNo)`
      );
      try {
        await statement.executeAsync({
          $id: id,
          $name: name,
          $path: path,
          $lastOpened: now,
          $lastVisitedPageNo: 1,
        });
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.PDF_FILES);
      return id;
    } catch (error) {
      console.error('Error adding PDF file:', error);
      throw error;
    }
  }, [db, notifyUpdate]);

  const updateLastOpened = useCallback(async (id: string, pageNo?: number) => {
    const now = Date.now();
    try {
      let query = `UPDATE ${TableNames.PDF_FILES} SET lastOpened = $lastOpened`;
      const params: any = { $id: id, $lastOpened: now };
      
      if (pageNo !== undefined) {
        query += `, lastVisitedPageNo = $pageNo`;
        params.$pageNo = pageNo;
      }
      
      query += ` WHERE id = $id`;

      const statement = await db.prepareAsync(query);
      try {
        await statement.executeAsync(params);
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.PDF_FILES);
    } catch (error) {
      console.error('Error updating PDF file:', error);
      throw error;
    }
  }, [db, notifyUpdate]);

  const updatePageNumberOnly = useCallback(async (id: string, pageNo: number) => {
    // Updates page number without updating lastOpened (optional) or just updates it.
    // User asked to "continuously update database about the last visited page"
    // AND "for performance this should not trigger re render"
    // So we do NOT call notifyUpdate here.
    try {
      const statement = await db.prepareAsync(
        `UPDATE ${TableNames.PDF_FILES} SET lastVisitedPageNo = $pageNo WHERE id = $id`
      );
      try {
        await statement.executeAsync({ $id: id, $pageNo: pageNo });
      } finally {
        await statement.finalizeAsync();
      }
      // NO notifyUpdate(TableNames.PDF_FILES);
    } catch (error) {
      console.error('Error updating PDF page number:', error);
    }
  }, [db]);

  return {
    getPdfFileByPath,
    addPdfFile,
    updateLastOpened,
    updatePageNumberOnly,
  };
};
