import { useCallback, useEffect, useState } from 'react';
import { useAppDatabase } from '../DatabaseProvider';
import { Chat, SenderType, TableNames } from '../schema';
import * as Crypto from 'expo-crypto';

export const useChats = (pdfFileId: string, threadId?: string) => {
  const { db, notifyUpdate, useTableVersion } = useAppDatabase();
  const version = useTableVersion(TableNames.CHATS);
  const [messages, setMessages] = useState<Chat[]>([]);

  const fetchMessages = useCallback(async () => {
    if (!pdfFileId) return;
    try {
      let query = `SELECT * FROM ${TableNames.CHATS} WHERE pdfFileId = $pdfFileId`;
      const params: any = { $pdfFileId: pdfFileId };

      if (threadId) {
        query += ` AND threadId = $threadId`;
        params.$threadId = threadId;
      }

      query += ` ORDER BY timestamp ASC`;

      const result = await db.getAllAsync<Chat>(query, params);
      setMessages(result);
    } catch (error) {
      console.error('Error fetching chat messages:', error);
    }
  }, [db, pdfFileId, threadId]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages, version]);

  const addMessage = useCallback(async (
    sender: SenderType,
    messageText: string,
    threadId?: string
  ) => {
    const id = Crypto.randomUUID();
    const timestamp = Date.now();
    try {
      const statement = await db.prepareAsync(
        `INSERT INTO ${TableNames.CHATS} (id, pdfFileId, sender, messageText, timestamp, threadId) VALUES ($id, $pdfFileId, $sender, $messageText, $timestamp, $threadId)`
      );
      try {
        await statement.executeAsync({
          $id: id,
          $pdfFileId: pdfFileId,
          $sender: sender,
          $messageText: messageText,
          $timestamp: timestamp,
          $threadId: threadId ?? null,
        });
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.CHATS);
      return id;
    } catch (error) {
      console.error('Error adding chat message:', error);
      throw error;
    }
  }, [db, pdfFileId, notifyUpdate]);

  const deleteMessage = useCallback(async (id: string) => {
    try {
      const statement = await db.prepareAsync(
        `DELETE FROM ${TableNames.CHATS} WHERE id = $id`
      );
      try {
        await statement.executeAsync({ $id: id });
      } finally {
        await statement.finalizeAsync();
      }
      notifyUpdate(TableNames.CHATS);
    } catch (error) {
      console.error('Error deleting chat message:', error);
      throw error;
    }
  }, [db, notifyUpdate]);

  return {
    messages,
    addMessage,
    deleteMessage,
  };
};
