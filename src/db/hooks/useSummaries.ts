import { useCallback, useEffect, useState } from 'react';
import { useFirebaseDatabase } from '../FirebaseDatabaseProvider';
import { SummaryVirtualPage } from '../schema';
import { getDatabase, ref, onValue, set, push, child, remove, get, orderByChild, query, equalTo, update } from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';

export const useSummaries = (pdfFileId: string) => {
  const { getSummariesRef } = useFirebaseDatabase();
  const [summaries, setSummaries] = useState<SummaryVirtualPage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔔 useSummaries: pdfFileId =', pdfFileId);
    if (!pdfFileId) {
      setSummaries([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const dbRef = getSummariesRef();
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      console.log('📦 Summaries snapshot:', data ? Object.keys(data).length + ' items' : 'empty');
      if (data) {
        const items = Object.entries(data)
          .filter(([_, value]) => {
            const summary = value as SummaryVirtualPage;
            const matches = summary.pdfFileId === pdfFileId;
            console.log(`  Summary ${summary.pdfFileId} === ${pdfFileId} ? ${matches}`);
            return matches;
          })
          .map(([key, value]) => ({
            ...(value as SummaryVirtualPage),
            id: key,
          }));
        // Sort by summaryForPdfPageNo ASC
        items.sort((a, b) => a.summaryForPdfPageNo - b.summaryForPdfPageNo);
        console.log(`✅ Loaded ${items.length} summaries for PDF ${pdfFileId}`);
        setSummaries(items);
      } else {
        setSummaries([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [getSummariesRef, pdfFileId]);

  const addOrUpdateSummary = useCallback(async (
    pageNo: number,
    summaryText: string
  ): Promise<void> => {
    console.log('💾 Saving summary for pdfFileId:', pdfFileId, 'pageNo:', pageNo);
    const dbRef = getSummariesRef();
    
    // Query for existing summary for this pdfFileId
    const q = query(dbRef, orderByChild('pdfFileId'), equalTo(pdfFileId));
    const snapshot = await get(q);
    const data = snapshot.val();
    console.log('📦 Existing summaries snapshot:', data ? Object.keys(data).length + ' items' : 'empty');

    if (data) {
      // Check if summary exists for this page
      const existingEntry = Object.entries(data).find(
        ([_, value]) => {
          const summary = value as SummaryVirtualPage;
          console.log(`  Checking: ${summary.pdfFileId} === ${pdfFileId} && ${summary.summaryForPdfPageNo} === ${pageNo}`);
          return summary.pdfFileId === pdfFileId && summary.summaryForPdfPageNo === pageNo;
        }
      );

      if (existingEntry) {
        // Update existing
        const [id] = existingEntry;
        console.log('✏️ Updating existing summary:', id);
        await update(child(dbRef, id), { summary: summaryText });
        return;
      }
    }

    // Insert new
    const newRef = push(dbRef);
    const summary: Omit<SummaryVirtualPage, 'id'> = {
      pdfFileId,
      summaryForPdfPageNo: pageNo,
      summary: summaryText,
    };
    console.log('➕ Adding new summary with ID:', newRef.key, 'data:', summary);
    await set(newRef, summary);
  }, [getSummariesRef, pdfFileId]);

  const deleteSummary = useCallback(async (id: string) => {
    const dbRef = getSummariesRef();
    await remove(child(dbRef, id));
  }, [getSummariesRef]);

  return {
    summaries,
    loading,
    addOrUpdateSummary,
    deleteSummary,
  };
};
