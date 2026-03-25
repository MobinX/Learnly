import { useCallback, useEffect, useState } from 'react';
import { useFirebaseDatabase } from '../FirebaseDatabaseProvider';
import { Quiz } from '../schema';
import { getDatabase, ref, onValue, set, push, child, remove, get, orderByChild, query, equalTo, update } from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';

export const useQuizs = (pdfFileId: string) => {
  const { getQuizzesRef } = useFirebaseDatabase();
  const [quizs, setQuizs] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔔 useQuizs: pdfFileId =', pdfFileId);
    if (!pdfFileId) {
      setQuizs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const dbRef = getQuizzesRef();
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      console.log('📦 Quizs snapshot:', data ? Object.keys(data).length + ' items' : 'empty');
      if (data) {
        const items = Object.entries(data)
          .filter(([_, value]) => {
            const quiz = value as Quiz;
            const matches = quiz.pdfFileId === pdfFileId;
            console.log(`  Quiz ${quiz.pdfFileId} === ${pdfFileId} ? ${matches}`);
            return matches;
          })
          .map(([key, value]) => ({
            ...(value as Quiz),
            id: key,
          }));
        // Sort by createdAt DESC (newest first)
        items.sort((a, b) => b.createdAt - a.createdAt);
        console.log(`✅ Loaded ${items.length} quizs for PDF ${pdfFileId}`);
        setQuizs(items);
      } else {
        setQuizs([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [getQuizzesRef, pdfFileId]);

  const addQuiz = useCallback(async (
    title: string,
    pageReferences: number[],
    totalQuestions: number,
    optionsPerQuestion: number,
    aiInstruction: string | undefined,
    questions: Quiz['questions']
  ): Promise<string> => {
    const dbRef = getQuizzesRef();
    const newRef = push(dbRef);
    const quiz: Omit<Quiz, 'id'> = {
      pdfFileId,
      title,
      pageReferences,
      totalQuestions,
      optionsPerQuestion,
      aiInstruction,
      questions,
      createdAt: Date.now(),
    };
    await set(newRef, quiz);
    return newRef.key!;
  }, [getQuizzesRef, pdfFileId]);

  const deleteQuiz = useCallback(async (id: string) => {
    const dbRef = getQuizzesRef();
    await remove(child(dbRef, id));
  }, [getQuizzesRef]);

  const updateQuizScore = useCallback(async (
    id: string,
    score: number
  ): Promise<void> => {
    const dbRef = getQuizzesRef();
    await update(child(dbRef, id), {
      lastScore: score,
      lastAttemptedAt: Date.now(),
    });
  }, [getQuizzesRef]);

  return {
    quizs,
    loading,
    addQuiz,
    deleteQuiz,
    updateQuizScore,
  };
};
