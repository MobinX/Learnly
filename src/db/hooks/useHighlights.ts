import { useCallback, useEffect, useState } from 'react';
import { useAppDatabase } from '../DatabaseProvider';
import { Highlight, TableNames } from '../schema';
import * as Crypto from 'expo-crypto';

export const useHighlights = (pdfFileId: string) => {
  const { db, notifyUpdate, useTableVersion } = useAppDatabase();
  const version = useTableVersion(TableNames.HIGHLIGHTS);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const fetchHighlights = useCallback(async () => {
    if (!pdfFileId) return;
    try {
      const result = await db.getAllAsync<Highlight>(
        `SELECT * FROM ${TableNames.HIGHLIGHTS} WHERE pdfFileId = $pdfFileId ORDER BY pageNo, startIndex`,
        { $pdfFileId: pdfFileId }
      );
      setHighlights(result);
    } catch (error) {
      console.error('Error fetching highlights:', error);
    }
  }, [db, pdfFileId]);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights, version]);

  const addHighlight = useCallback(async (
    pageNo: number,
    startIndex: number,
    endIndex: number,
    color: string,
    text: string,
    relatedChatId?: string
  ) => {
    const id = Crypto.randomUUID();
    try {
      const statement = await db.prepareAsync(
        `INSERT INTO ${TableNames.HIGHLIGHTS} (id, pdfFileId, pageNo, startIndex, endIndex, color, text, relatedChatId) VALUES ($id, $pdfFileId, $pageNo, $startIndex, $endIndex, $color, $text, $relatedChatId)`
      );
      try {
        await statement.executeAsync({
          $id: id,
          $pdfFileId: pdfFileId,
          $pageNo: pageNo,
          $startIndex: startIndex,
          $endIndex: endIndex,
          $color: color,
          $text: text,
          $relatedChatId: relatedChatId ?? null,
        });
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.HIGHLIGHTS);
      return id;
    } catch (error) {
      console.error('Error adding highlight:', error);
      throw error;
    }
  }, [db, pdfFileId, notifyUpdate]);

  const deleteHighlight = useCallback(async (id: string) => {
    try {
      const statement = await db.prepareAsync(
        `DELETE FROM ${TableNames.HIGHLIGHTS} WHERE id = $id`
      );
      try {
        await statement.executeAsync({ $id: id });
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.HIGHLIGHTS);
    } catch (error) {
      console.error('Error deleting highlight:', error);
      throw error;
    }
  }, [db, notifyUpdate]);

  return {
    highlights,
    addHighlight,
    deleteHighlight,
  };
};
