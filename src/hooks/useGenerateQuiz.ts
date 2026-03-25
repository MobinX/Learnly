import { useCallback } from 'react';
import { z } from 'zod';
import type { QuizQuestion } from '../db/schema';
import { useAI } from './useAI';

// Zod schema for quiz output validation
const QuizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()),
  correctOption: z.string(),
  explanation: z.string(),
});

const QuizOutputSchema = z.object({
  title: z.string(),
  quizzes: z.array(QuizQuestionSchema),
});

type QuizOutput = z.infer<typeof QuizOutputSchema>;

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

export const useGenerateQuiz = () => {
  const { generateContent, createImageParts, createUserMessage, loading, error } = useAI();

  const generateQuiz = useCallback(async (
    base64Images: string[],
    config: QuizConfig
  ): Promise<QuizOutput> => {
    console.log('[useGenerateQuiz] Starting quiz generation with config:', config);
    console.log('[useGenerateQuiz] Number of images:', base64Images.length);
    
    const userPrompt = QUIZ_USER_PROMPT
      .replace('{totalQuestions}', config.totalQuestions.toString())
      .replace('{optionsPerQuestion}', config.optionsPerQuestion.toString())
      .replace('{aiInstruction}', config.aiInstruction ? `Additional instructions: ${config.aiInstruction}` : '');

    console.log('[useGenerateQuiz] User prompt:', userPrompt.substring(0, 200));

    const imageParts = createImageParts(base64Images);
    const userMessage = createUserMessage(userPrompt, imageParts);

    // Use structured output with Zod schema - no more manual JSON parsing!
    const quizData = await generateContent({
      systemInstruction: QUIZ_SYSTEM_PROMPT,
      messages: [userMessage],
    }, {
      outputSchema: QuizOutputSchema,
    });

    console.log('[useGenerateQuiz] Generated quiz:', {
      title: quizData.title,
      questionCount: quizData.quizzes?.length,
    });

    // Validation is automatic via Zod schema, but we can add extra checks
    if (!quizData.title || !Array.isArray(quizData.quizzes)) {
      throw new Error('Invalid quiz format from AI');
    }

    // Validate each question has correct option in options array
    for (const q of quizData.quizzes) {
      if (!q.options.includes(q.correctOption)) {
        throw new Error('Correct option not found in options array');
      }
    }

    return quizData;
  }, [generateContent, createImageParts, createUserMessage]);

  return { generateQuiz, loading, error };
};
