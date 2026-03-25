import { useCallback } from 'react';
import { useAI } from './useAI';

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
- Key takeaways for quick revision

{additionalInstruction}`;

export const useGenerateSummary = () => {
  const { generateContent, createImageParts, createUserMessage, loading, error } = useAI();

  const generateSummary = useCallback(async (
    base64Images: string[],
    additionalInstruction?: string
  ): Promise<string> => {
    const userPrompt = SUMMARY_USER_PROMPT.replace(
      '{additionalInstruction}',
      additionalInstruction
        ? `Additional instructions: ${additionalInstruction}`
        : ''
    );

    const imageParts = createImageParts(base64Images);
    const userMessage = createUserMessage(userPrompt, imageParts);

    // Use non-streaming for simple text generation
    return await generateContent({
      systemInstruction: SUMMARY_SYSTEM_PROMPT,
      messages: [userMessage],
    });
  }, [generateContent, createImageParts, createUserMessage]);

  return { generateSummary, loading, error };
};
