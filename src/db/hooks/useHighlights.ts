import { useCallback, useEffect, useState } from 'react';
import { useFirebaseDatabase } from '../FirebaseDatabaseProvider';
import { Highlight } from '../schema';
import { getDatabase, ref, onValue, set, push, child, remove } from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';

export const useHighlights = (pdfFileId: string) => {
  const { getHighlightsRef } = useFirebaseDatabase();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔔 useHighlights: pdfFileId =', pdfFileId);
    if (!pdfFileId) {
      setHighlights([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const dbRef = getHighlightsRef();
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      console.log('📦 Highlights snapshot:', data ? Object.keys(data).length + ' items' : 'empty');
      if (data) {
        const items = Object.entries(data)
          .filter(([_, value]) => {
            const highlight = value as Highlight;
            const matches = highlight.pdfFileId === pdfFileId;
            console.log(`  Highlight ${highlight.pdfFileId} === ${pdfFileId} ? ${matches}`);
            return matches;
          })
          .map(([key, value]) => ({
            ...(value as Highlight),
            id: key,
          }));
        // Sort by pageNo, then startIndex
        items.sort((a, b) => {
          if (a.pageNo !== b.pageNo) return a.pageNo - b.pageNo;
          return a.startIndex - b.startIndex;
        });
        console.log(`✅ Loaded ${items.length} highlights for PDF ${pdfFileId}`);
        setHighlights(items);
      } else {
        setHighlights([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [getHighlightsRef, pdfFileId]);

  const addHighlight = useCallback(async (
    pageNo: number,
    startIndex: number,
    endIndex: number,
    color: string,
    text: string,
    relatedChatId?: string
  ): Promise<string> => {
    const dbRef = getHighlightsRef();
    const newRef = push(dbRef);
    const highlight: Omit<Highlight, 'id'> = {
      pdfFileId,
      pageNo,
      startIndex,
      endIndex,
      color,
      text,
      relatedChatId,
    };
    await set(newRef, highlight);
    return newRef.key!;
  }, [getHighlightsRef, pdfFileId]);

  const deleteHighlight = useCallback(async (id: string) => {
    const dbRef = getHighlightsRef();
    await remove(child(dbRef, id));
  }, [getHighlightsRef]);

  return {
    highlights,
    loading,
    addHighlight,
    deleteHighlight,
  };
};
