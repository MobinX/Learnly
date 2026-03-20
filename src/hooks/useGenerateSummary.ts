import { useState, useCallback } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';

export const useGenerateSummary = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateSummary = useCallback(async (
    base64Images: string[],
    onStreamUpdate: (text: string) => void
  ) => {
    setLoading(true);
    setError(null);
    let fullText = '';

    try {
      const app = getApp();
      const ai = getAI(app);
      const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash-lite' });

      // Prepare parts
      const parts: any[] = [
        { text: "Please summarize the content of these pages." },
        ...base64Images.map(b64 => ({
          inlineData: {
            mimeType: 'image/png',
            data: b64
          }
        }))
      ];

      const result = await model.generateContentStream(parts);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullText += chunkText;
        onStreamUpdate(fullText);
      }

    } catch (e: any) {
      console.error("Error generating summary:", e);
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
    return fullText;
  }, []);

  return { generateSummary, loading, error };
};
