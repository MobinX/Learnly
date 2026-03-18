import { useCallback, useEffect, useState } from 'react';
import { useAppDatabase } from '../DatabaseProvider';
import { SummaryVirtualPage, TableNames } from '../schema';
import * as Crypto from 'expo-crypto';

export const useSummaries = (pdfFileId: string) => {
  const { db, notifyUpdate, useTableVersion } = useAppDatabase();
  const version = useTableVersion(TableNames.SUMMARY_VIRTUAL_PAGES);
  const [summaries, setSummaries] = useState<SummaryVirtualPage[]>([]);

  const fetchSummaries = useCallback(async () => {
    if (!pdfFileId) return;
    try {
      const result = await db.getAllAsync<SummaryVirtualPage>(
        `SELECT * FROM ${TableNames.SUMMARY_VIRTUAL_PAGES} WHERE pdfFileId = $pdfFileId ORDER BY summaryForPdfPageNo ASC`,
        { $pdfFileId: pdfFileId }
      );
      setSummaries(result);
    } catch (error) {
      console.error('Error fetching summaries:', error);
    }
  }, [db, pdfFileId]);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries, version]);

  const addOrUpdateSummary = useCallback(async (
    pageNo: number,
    summaryText: string
  ) => {
    const id = Crypto.randomUUID();
    try {
      // Check if summary exists for this page
      const existing = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM ${TableNames.SUMMARY_VIRTUAL_PAGES} WHERE pdfFileId = $pdfFileId AND summaryForPdfPageNo = $pageNo`,
        { $pdfFileId: pdfFileId, $pageNo: pageNo }
      );

      if (existing) {
        // Update
        const statement = await db.prepareAsync(
          `UPDATE ${TableNames.SUMMARY_VIRTUAL_PAGES} SET summary = $summary WHERE id = $id`
        );
        try {
          await statement.executeAsync({
            $id: existing.id,
            $summary: summaryText,
          });
        } finally {
          await statement.finalizeAsync();
        }
      } else {
        // Insert
        const statement = await db.prepareAsync(
          `INSERT INTO ${TableNames.SUMMARY_VIRTUAL_PAGES} (id, pdfFileId, summaryForPdfPageNo, summary) VALUES ($id, $pdfFileId, $pageNo, $summary)`
        );
        try {
          await statement.executeAsync({
            $id: id,
            $pdfFileId: pdfFileId,
            $pageNo: pageNo,
            $summary: summaryText,
          });
        } finally {
          await statement.finalizeAsync();
        }
      }
      notifyUpdate(TableNames.SUMMARY_VIRTUAL_PAGES);
    } catch (error) {
      console.error('Error saving summary:', error);
      throw error;
    }
  }, [db, pdfFileId, notifyUpdate]);

  const deleteSummary = useCallback(async (id: string) => {
    try {
      const statement = await db.prepareAsync(
        `DELETE FROM ${TableNames.SUMMARY_VIRTUAL_PAGES} WHERE id = $id`
      );
      try {
        await statement.executeAsync({ $id: id });
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.SUMMARY_VIRTUAL_PAGES);
    } catch (error) {
      console.error('Error deleting summary:', error);
      throw error;
    }
  }, [db, notifyUpdate]);

  return {
    summaries,
    addOrUpdateSummary,
    deleteSummary,
  };
};
