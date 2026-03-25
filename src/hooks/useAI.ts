import { useState, useCallback } from 'react';
import { generateText, streamText, Output } from 'ai';
import { createAiGateway } from 'ai-gateway-provider';
import { createUnified } from 'ai-gateway-provider/providers/unified';
import type { TextPart, ImagePart, ModelMessage } from 'ai';
import { z } from 'zod';

// Initialize AI Gateway with Cloudflare
const aigateway = createAiGateway({
  accountId: "9ada87e1043c02fee3a42cf500922832",
  gateway: "master",
  apiKey: 'cfut_rZCVkF4jxRMuEdB0djd21ImUTwCQPoXp8OKODpOsba30f6aa',
});

const unified = createUnified();

export interface AIModelConfig<T = unknown> {
  model?: string;
  responseMimeType?: 'application/json' | 'text/plain';
  /**
   * Zod schema for structured output
   * When provided, the AI will return data matching this schema
   * Example: z.object({ title: z.string(), quizzes: z.array(...) })
   */
  outputSchema?: z.ZodType<T>;
}

export interface AIRequestOptions {
  systemInstruction: string;
  messages: ModelMessage[];
  responseMimeType?: 'application/json' | 'text/plain';
}

export interface AIStreamOptions {
  systemInstruction: string;
  messages: ModelMessage[];
}

/**
 * Universal AI hook for interacting with Cloudflare AI Gateway
 * Provides both streaming and non-streaming content generation
 */
export const useAI = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Generate content from AI model (non-streaming)
   * @param options - AI request options with system instruction and messages
   * @param modelConfig - Optional model configuration (defaults to gemini-2.5-flash)
   * @returns Promise resolving to the AI response text (or parsed object if schema provided)
   */
  const generateContent = useCallback(async (
    options: AIRequestOptions,
    modelConfig?: AIModelConfig
  ): Promise<any> => {
    setLoading(true);
    setError(null);

    try {
      console.log('[useAI] Generating content with model:', modelConfig?.model || 'google-ai-studio/gemini-2.5-flash');

      const model = aigateway(unified(modelConfig?.model || 'google-ai-studio/gemini-2.5-flash'));

      const generateOptions: any = {
        model,
        system: options.systemInstruction,
        messages: options.messages,
      };

      // For structured output with schema
      if (modelConfig?.outputSchema) {
        console.log('[useAI] Using structured output with schema');
        generateOptions.output = Output.object({
          schema: modelConfig.outputSchema,
        });
      } else if (modelConfig?.responseMimeType === 'application/json') {
        // For simple JSON without schema validation
        generateOptions.responseFormat = 'json';
      }

      const result = await generateText(generateOptions);

      // If using structured output, return the parsed object
      if (modelConfig?.outputSchema) {
        console.log('[useAI] Structured output generated successfully');
        return result.output;
      }

      const text = result.text;
      console.log('[useAI] Content generated successfully, length:', text.length);
      
      // If JSON expected (without schema), validate it
      if (modelConfig?.responseMimeType === 'application/json') {
        try {
          JSON.parse(text); // Validate JSON
          return text;
        } catch (parseError: any) {
          console.error('[useAI] Invalid JSON response:', parseError?.message);
          throw new Error('AI returned invalid JSON format');
        }
      }
      
      return text;

    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred during AI content generation';
      console.error('[useAI] Error generating content:', {
        message: errorMessage,
        name: error?.name,
        stack: error?.stack,
        response: error?.response,
        cause: error?.cause,
      });

      setError(error instanceof Error ? error : new Error(errorMessage));
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Generate content from AI model with streaming
   * @param options - AI request options with system instruction and messages
   * @param onStreamUpdate - Callback invoked with accumulated text on each chunk
   * @param modelConfig - Optional model configuration (defaults to gemini-2.5-flash)
   * @returns Promise resolving to the complete AI response text
   */
  const generateContentStream = useCallback(async (
    options: AIStreamOptions,
    onStreamUpdate: (accumulatedText: string) => void,
    modelConfig?: AIModelConfig
  ): Promise<string> => {
    setLoading(true);
    setError(null);
    let fullText = '';

    try {
      console.log('[useAI] Streaming content with model:', modelConfig?.model || 'google-ai-studio/gemini-2.5-flash-lite');
      
      const model = aigateway(unified(modelConfig?.model || 'google-ai-studio/gemini-2.5-flash-lite'));

      const result = streamText({
        model,
        system: options.systemInstruction,
        messages: options.messages,
        onError({ error }) {
          const errorObj = error as any;
          console.error('[useAI] Stream error:', {
            message: errorObj?.message || 'Unknown stream error',
            name: errorObj?.name,
            stack: errorObj?.stack,
            cause: errorObj?.cause,
          });
        },
      });

      for await (const textPart of result.textStream) {
        fullText += textPart;
        onStreamUpdate(fullText);
      }

      console.log('[useAI] Stream completed successfully, total length:', fullText.length);
      return fullText;

    } catch (error: any) {
      const errorMessage = error?.message || 'Unknown error occurred during AI stream generation';
      console.error('[useAI] Error streaming content:', {
        message: errorMessage,
        name: error?.name,
        stack: error?.stack,
        response: error?.response,
        cause: error?.cause,
      });
      
      setError(error instanceof Error ? error : new Error(errorMessage));
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Helper to create image parts from base64 strings
   * @param base64Images - Array of base64 encoded image strings
   * @param mimeType - MIME type for images (defaults to 'image/png')
   * @returns Array of ImagePart objects
   */
  const createImageParts = useCallback(
    (base64Images: string[], mimeType: string = 'image/png'): ImagePart[] => {
      return base64Images.map(data => ({
        type: 'image',
        image: data,
        mimeType,
      }));
    },
    []
  );

  /**
   * Helper to create user message with text and images
   * @param text - Optional text content
   * @param imageParts - Array of image parts
   * @returns ModelMessage object for user role
   */
  const createUserMessage = useCallback(
    (text?: string, imageParts?: ImagePart[]): ModelMessage => {
      const content: Array<TextPart | ImagePart> = [];
      
      if (text) {
        content.push({ type: 'text', text });
      }
      
      if (imageParts) {
        content.push(...imageParts);
      }

      return {
        role: 'user',
        content,
      } as ModelMessage;
    },
    []
  );

  /**
   * Helper to create assistant message
   * @param text - The assistant's message text
   * @returns ModelMessage object for assistant role
   */
  const createAssistantMessage = useCallback(
    (text: string): ModelMessage => ({
      role: 'assistant',
      content: [{ type: 'text', text }],
    } as ModelMessage),
    []
  );

  return {
    generateContent,
    generateContentStream,
    createImageParts,
    createUserMessage,
    createAssistantMessage,
    loading,
    error,
  };
};
