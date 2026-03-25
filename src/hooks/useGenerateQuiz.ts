import { useState, useCallback } from 'react';
import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import type { QuizQuestion } from '../db/schema';

const QUIZ_SYSTEM_PROMPT = `You are Learnly's expert quiz generator for educational content.

Your task is to create high-quality multiple-choice questions (MCQs) from textbook/page images.

Output contract (strict):
1) Return ONLY valid JSON matching this exact schema:
   {
     "title": "A concise, descriptive title for this quiz",
     "quizzes": [
       {
         "question": "Clear, unambiguous question text",
         "options": ["Option A", "Option B", "Option C", "Option D"],
         "correctOption": "Option B",
         "explanation": "Brief explanation of why this answer is correct"
       }
     ]
   }
2) The "correctOption" value must EXACTLY match one of the options in the array.
3) Generate the exact number of questions requested.
4) Each question must have exactly the number of options requested.
5) Questions should vary in difficulty (easy, medium, hard).
6) Base all questions strictly on the provided page content.

Quality guidelines:
- Questions should test understanding, not just recall.
- Distractors (wrong options) should be plausible but clearly incorrect.
- Explanations should be educational and reference specific concepts.
- Avoid "all of the above" or "none of the above" as options.
- Randomize the position of correct answers across questions.`;

const QUIZ_USER_PROMPT = `Generate a quiz based on these page images.

Configuration:
- Total questions: {totalQuestions}
- Options per question: {optionsPerQuestion}
{aiInstruction}

Create engaging, educational MCQs that test comprehension and critical thinking.`;

export interface QuizConfig {
  totalQuestions: number;
  optionsPerQuestion: number;
  aiInstruction?: string;
}

export interface QuizOutput {
  title: string;
  quizzes: QuizQuestion[];
}

export const useGenerateQuiz = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateQuiz = useCallback(async (
    base64Images: string[],
    config: QuizConfig
  ): Promise<QuizOutput> => {
    setLoading(true);
    setError(null);

    try {
      const app = getApp();
      const ai = getAI(app);
      const model = getGenerativeModel(ai, { 
        model: 'gemini-2.5-flash-lite',
        generationConfig: {
          responseMimeType: 'application/json',
        },
      });

      const userPrompt = QUIZ_USER_PROMPT
        .replace('{totalQuestions}', config.totalQuestions.toString())
        .replace('{optionsPerQuestion}', config.optionsPerQuestion.toString())
        .replace('{aiInstruction}', config.aiInstruction ? `Additional instructions: ${config.aiInstruction}` : '');

      const result = await model.generateContent({
        systemInstruction: QUIZ_SYSTEM_PROMPT,
        contents: [
          {
            role: 'user',
            parts: [
              { text: userPrompt },
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

      const responseText = result.response.text();
      const parsed: QuizOutput = JSON.parse(responseText);

      // Validate the output
      if (!parsed.title || !Array.isArray(parsed.quizzes)) {
        throw new Error('Invalid quiz format from AI');
      }

      // Validate each question
      for (const q of parsed.quizzes) {
        if (!q.question || !Array.isArray(q.options) || !q.correctOption || !q.explanation) {
          throw new Error('Invalid question format in quiz');
        }
        if (!q.options.includes(q.correctOption)) {
          throw new Error('Correct option not found in options array');
        }
      }

      return parsed;

    } catch (e: any) {
      console.error("Error generating quiz:", e);
      setError(e);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);

  return { generateQuiz, loading, error };
};
