import { useState, useCallback } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';

const SUMMARY_SYSTEM_PROMPT = `You are Learnly's elite study-note generator.

Your job is to read the provided textbook/page images and produce a clean, accurate, student-friendly summary.

Output contract (strict):
1) Return only GitHub-Flavored Markdown (no HTML).
2) Use helpful structure with headings and bullets.
3) Use LaTeX for mathematics:
   - Inline math: $...$
   - Block math: $$...$$
4) Never wrap the whole answer in a markdown code fence.
5) Ground every claim in visible page content. If something is unclear or missing, explicitly say so.

Quality guidelines:
- Prioritize core ideas, definitions, formulas, and reasoning steps.
- Prefer concise explanations over long paragraphs.
- Include a short "Key Takeaways" section at the end.
- If calculations are present, show clean step-by-step derivations in Markdown + LaTeX.
- Keep tone clear, encouraging, and academically precise.`;

const SUMMARY_USER_PROMPT = `Create a high-quality study summary from these page images.

Please include:
- A short title
- Main concepts
- Important formulas (with LaTeX)
- Worked reasoning steps when relevant
- Key takeaways for quick revision`;

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

      const result = await model.generateContentStream({
        systemInstruction: SUMMARY_SYSTEM_PROMPT,
        contents: [
          {
            role: 'user',
            parts: [
              { text: SUMMARY_USER_PROMPT },
              ...base64Images.map(b64 => ({
                inlineData: {
                  mimeType: 'image/png',
                  data: b64,
                },
              })),
            ],
          },
        ],
      });

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
