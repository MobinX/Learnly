import { useCallback, useEffect, useState } from 'react';
import { useFirebaseDatabase } from '../FirebaseDatabaseProvider';
import { Chat, SenderType } from '../schema';
import { getDatabase, ref, onValue, set, push, child, remove } from '@react-native-firebase/database';
import { getApp } from '@react-native-firebase/app';

export const useChats = (pdfFileId: string, threadId?: string) => {
  const { getChatsRef } = useFirebaseDatabase();
  const [messages, setMessages] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log('🔔 useChats: pdfFileId =', pdfFileId, 'threadId =', threadId);
    if (!pdfFileId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const dbRef = getChatsRef();
    const unsubscribe = onValue(dbRef, (snapshot) => {
      const data = snapshot.val();
      console.log('📦 Chats snapshot:', data ? Object.keys(data).length + ' items' : 'empty');
      if (data) {
        const items = Object.entries(data)
          .filter(([_, value]) => {
            const chat = value as Chat;
            const matches = chat.pdfFileId === pdfFileId && (!threadId || chat.threadId === threadId);
            console.log(`  Chat ${chat.pdfFileId} === ${pdfFileId} ? ${matches}`);
            return matches;
          })
          .map(([key, value]) => ({
            ...(value as Chat),
            id: key,
          }));
        // Sort by timestamp ASC
        items.sort((a, b) => a.timestamp - b.timestamp);
        console.log(`✅ Loaded ${items.length} chats for PDF ${pdfFileId}`);
        setMessages(items);
      } else {
        setMessages([]);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [getChatsRef, pdfFileId, threadId]);

  const addMessage = useCallback(async (
    sender: SenderType,
    messageText: string,
    threadId?: string
  ): Promise<string> => {
    const dbRef = getChatsRef();
    const newRef = push(dbRef);
    const chat: Omit<Chat, 'id'> = {
      pdfFileId,
      sender,
      messageText,
      timestamp: Date.now(),
      threadId,
    };
    await set(newRef, chat);
    return newRef.key!;
  }, [getChatsRef, pdfFileId]);

  const deleteMessage = useCallback(async (id: string) => {
    const dbRef = getChatsRef();
    await remove(child(dbRef, id));
  }, [getChatsRef]);

  return {
    messages,
    loading,
    addMessage,
    deleteMessage,
  };
};
