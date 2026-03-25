import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
  Keyboard,
  KeyboardEvent,
  Linking,
} from 'react-native';
import { FlashList, type FlashListRef, type ListRenderItemInfo } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChats } from '../db/hooks/useChats';
import type { Chat } from '../db/schema';
import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import RnPdfKing from 'rn-pdf-king';
import { EnrichedMarkdownText, type MarkdownStyle } from 'react-native-enriched-markdown';
import { useTheme } from '../theme/colors';

interface ChatOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  pdfId: string | null;
  currentPage: number;
  pageCount: number;
  initialQuery?: string;
  selectedPages?: number[];
  onNavigateToPage?: (page: number) => void;
  onSaveScrollPosition?: (position: number) => void;
  onClearReferences?: () => void;
}

const aiMarkdownStyle: MarkdownStyle = {
  paragraph: { fontSize: 16, lineHeight: 22, color: '#1C1C1E', marginBottom: 10 },
  h1: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: '#111827', marginBottom: 10 },
  h2: { fontSize: 19, lineHeight: 27, fontWeight: '700', color: '#111827', marginBottom: 8 },
  h3: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: '#111827', marginBottom: 6 },
  list: { fontSize: 16, lineHeight: 22, color: '#1C1C1E', marginBottom: 8 },
  codeBlock: { fontSize: 14, lineHeight: 20, backgroundColor: '#EAEAF0', borderRadius: 8, padding: 10 },
  code: { fontSize: 14, color: '#111827', backgroundColor: '#E5E7EB', borderColor: '#D1D5DB' },
  link: { color: '#0066CC', underline: true },
  table: {
    fontSize: 14,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    headerBackgroundColor: '#E5E7EB',
    cellPaddingHorizontal: 8,
    cellPaddingVertical: 6,
  },
};

const CHAT_SYSTEM_PROMPT = `You are Learnly's AI tutor for a PDF study app.

You must help the student using the chat question, recent conversation history, and provided page images.

Output contract (strict):
1) Respond only in GitHub-Flavored Markdown.
2) Use clear headings/bullets when useful.
3) Use LaTeX for math:
   - Inline math: $...$
   - Block math: $$...$$
4) Do not wrap the whole response in a markdown code fence.
5) If evidence is insufficient from the page images/context, clearly say what is uncertain.

Tutoring behavior:
- Be correct, concise, and educational.
- Explain reasoning step-by-step for problem solving.
- Highlight assumptions before conclusions.
- Offer a quick follow-up prompt at the end when useful.
- Never invent page details you cannot infer.`;

const CHAT_USER_GUIDANCE_PROMPT = `Answer the student's question using the conversation context and attached page images.

Focus on:
- Direct answer first
- Brief explanation
- Formulas in LaTeX when relevant
- A short "Next step" suggestion`;

interface ChatMessageItemProps {
  item: Chat;
  onLinkPress: ({ url }: { url: string }) => void;
  onNavigateToPage?: (page: number) => void;
}

const ChatMessageItem = memo(
  ({ item, onLinkPress, onNavigateToPage, isDark, colors }: ChatMessageItemProps & { isDark: boolean; colors: any }) => {
    const formattedTime = useMemo(
      () => new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      [item.timestamp]
    );
    
    // Update markdown colors based on theme
    const themedAiMarkdownStyle: MarkdownStyle = useMemo(() => ({
      paragraph: { fontSize: 16, lineHeight: 22, color: colors.text, marginBottom: 10 },
      h1: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: colors.text, marginBottom: 10 },
      h2: { fontSize: 19, lineHeight: 27, fontWeight: '700', color: colors.text, marginBottom: 8 },
      h3: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.text, marginBottom: 6 },
      list: { fontSize: 16, lineHeight: 22, color: colors.text, marginBottom: 8 },
      codeBlock: { fontSize: 14, lineHeight: 20, backgroundColor: isDark ? '#3A3A3C' : '#EAEAF0', borderRadius: 8, padding: 10 },
      code: { fontSize: 14, color: colors.text, backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB', borderColor: isDark ? '#48484A' : '#D1D5DB' },
      link: { color: colors.primary, underline: true },
      table: {
        fontSize: 14,
        borderColor: isDark ? '#48484A' : '#D1D5DB',
        borderRadius: 8,
        headerBackgroundColor: isDark ? '#3A3A3C' : '#E5E7EB',
        cellPaddingHorizontal: 8,
        cellPaddingVertical: 6,
      },
    }), [colors, isDark]);

    return (
      <View
        style={[
          styles.messageContainer,
          item.sender === 'Human' 
            ? [styles.humanMessage, { backgroundColor: colors.chatHuman }] 
            : [styles.aiMessage, { backgroundColor: colors.chatAI }],
        ]}
      >
        {item.sender === 'AI' ? (
          <EnrichedMarkdownText
            flavor="github"
            markdown={item.messageText || ''}
            markdownStyle={themedAiMarkdownStyle}
            containerStyle={styles.aiMarkdownContainer}
            onLinkPress={onLinkPress}
          />
        ) : (
          <Text style={[styles.messageText, styles.humanText]}>{item.messageText}</Text>
        )}
        
        {item.sender === 'AI' && item.pageReferences && item.pageReferences.length > 0 && (
          <TouchableOpacity
            style={[styles.goToPageButton, { backgroundColor: colors.badge }]}
            onPress={() => onNavigateToPage?.(item.pageReferences![0])}
          >
            <Ionicons name="book-outline" size={16} color={colors.primary} />
            <Text style={[styles.goToPageText, { color: colors.primary }]}>
              Go to referred Pages ({item.pageReferences.join(', ')})
            </Text>
          </TouchableOpacity>
        )}
        
        <Text
          style={[
            styles.timestamp,
            item.sender === 'Human' ? styles.humanTimestamp : styles.aiTimestamp,
          ]}
        >
          {formattedTime}
        </Text>
      </View>
    );
  },
  (prevProps, nextProps) =>
    prevProps.onLinkPress === nextProps.onLinkPress &&
    prevProps.onNavigateToPage === nextProps.onNavigateToPage &&
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.sender === nextProps.item.sender &&
    prevProps.item.messageText === nextProps.item.messageText &&
    prevProps.item.timestamp === nextProps.item.timestamp &&
    JSON.stringify(prevProps.item.pageReferences) === JSON.stringify(nextProps.item.pageReferences)
);
ChatMessageItem.displayName = 'ChatMessageItem';

export const ChatOverlay: React.FC<ChatOverlayProps> = ({
  isVisible,
  onClose,
  pdfId,
  currentPage,
  pageCount,
  initialQuery,
  selectedPages,
  onNavigateToPage,
  onClearReferences,
}) => {
  const { colors, isDark } = useTheme();
  const { messages, addMessage } = useChats(pdfId || '');
  
  // Update markdown colors based on theme
  const themedAiMarkdownStyle: MarkdownStyle = useMemo(() => ({
    paragraph: { fontSize: 16, lineHeight: 22, color: colors.text, marginBottom: 10 },
    h1: { fontSize: 22, lineHeight: 30, fontWeight: '700', color: colors.text, marginBottom: 10 },
    h2: { fontSize: 19, lineHeight: 27, fontWeight: '700', color: colors.text, marginBottom: 8 },
    h3: { fontSize: 17, lineHeight: 24, fontWeight: '600', color: colors.text, marginBottom: 6 },
    list: { fontSize: 16, lineHeight: 22, color: colors.text, marginBottom: 8 },
    codeBlock: { fontSize: 14, lineHeight: 20, backgroundColor: isDark ? '#3A3A3C' : '#EAEAF0', borderRadius: 8, padding: 10 },
    code: { fontSize: 14, color: colors.text, backgroundColor: isDark ? '#3A3A3C' : '#E5E7EB', borderColor: isDark ? '#48484A' : '#D1D5DB' },
    link: { color: colors.primary, underline: true },
    table: {
      fontSize: 14,
      borderColor: isDark ? '#48484A' : '#D1D5DB',
      borderRadius: 8,
      headerBackgroundColor: isDark ? '#3A3A3C' : '#E5E7EB',
      cellPaddingHorizontal: 8,
      cellPaddingVertical: 6,
    },
  }), [colors, isDark]);
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flashListRef = useRef<FlashListRef<Chat>>(null);
  const previousMessageCountRef = useRef(0);
  const [savedScrollOffset, setSavedScrollOffset] = useState<number | null>(null);

  const insets = useSafeAreaInsets();
  const keyboardLiftOffset = Platform.OS === 'ios' ? 40 : 16;
  const effectiveKeyboardOffset =
    keyboardHeight > 0 ? keyboardHeight + keyboardLiftOffset : 0;

  // Auto-scroll only when new messages are appended.
  useEffect(() => {
    if (messages.length > previousMessageCountRef.current) {
      requestAnimationFrame(() => {
        flashListRef.current?.scrollToEnd({ animated: true });
      });
    }

    previousMessageCountRef.current = messages.length;
  }, [messages.length]);

  // Save scroll position when overlay is closed
  useEffect(() => {
    if (!isVisible && savedScrollOffset !== null) {
      // Scroll position will be restored when reopened
    }
    return () => {
      if (isVisible && flashListRef.current) {
        // Save current scroll position when closing
        // This is a simplified approach - FlashList doesn't have a direct scrollOffset getter
      }
    };
  }, [isVisible]);

  // Restore scroll position when overlay is opened
  useEffect(() => {
    if (isVisible && savedScrollOffset !== null && flashListRef.current) {
      // Restore scroll position if we have a saved one
      // flashListRef.current.scrollToOffset({ offset: savedScrollOffset, animated: false });
    }
  }, [isVisible, savedScrollOffset]);

  // Keep chat sheet above keyboard on both iOS and Android.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const frameEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';

    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
      flashListRef.current?.scrollToEnd({ animated: true });
    };

    const handleKeyboardHide = () => setKeyboardHeight(0);

    const handleFrameChange = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    };

    const showSub = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);
    const frameSub = Keyboard.addListener(frameEvent, handleFrameChange);

    return () => {
      showSub.remove();
      hideSub.remove();
      frameSub.remove();
    };
  }, []);

  useEffect(() => {
    if (initialQuery && isVisible) {
      setInputText(initialQuery);
    }
  }, [initialQuery, isVisible]);

  const handleMarkdownLinkPress = useCallback(({ url }: { url: string }) => {
    Linking.openURL(url).catch((error) => {
      console.error('Failed to open markdown link:', error);
    });
  }, []);

  const renderMessage = useCallback(
    ({ item }: ListRenderItemInfo<Chat>) => (
      <ChatMessageItem 
        item={item} 
        onLinkPress={handleMarkdownLinkPress}
        onNavigateToPage={onNavigateToPage}
        isDark={isDark}
        colors={colors}
      />
    ),
    [handleMarkdownLinkPress, onNavigateToPage, isDark, colors]
  );

  const keyExtractor = useCallback((item: Chat) => item.id, []);

  // Don't render content if no pdfId or not visible
  if (!pdfId || !isVisible) {
    return null;
  }

  const handleSend = async (queryOverride?: string) => {
    const query = queryOverride || inputText.trim();
    if (!query || isLoading) return;

    setInputText('');
    setIsLoading(true);

    try {
      // 1. Add Human message to DB
      await addMessage('Human', query);

      // 2. Prepare images - use selectedPages if provided, otherwise use current page context
      const pagesToCapture = selectedPages && selectedPages.length > 0 
        ? [...selectedPages]
        : (() => {
            const pages = [];
            if (currentPage > 1) pages.push(currentPage - 1);
            pages.push(currentPage);
            if (currentPage < pageCount) pages.push(currentPage + 1);
            return pages;
          })();

      const bitmaps = await Promise.all(
        pagesToCapture.map((p) => RnPdfKing.getPageBitmapBase64(p))
      );

      // 3. Prepare AI contents (with history)
      const ai = getAI(getApp());
      const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash-lite' });

      // Get last 10 messages for context
      const lastMessages = messages.slice(-10);
      const history = lastMessages.map(m => ({
        role: m.sender === 'Human' ? 'user' as const : 'model' as const,
        parts: [{ text: m.messageText }]
      }));

      const contents = [
        {
          role: 'user' as const,
          parts: [{ text: CHAT_USER_GUIDANCE_PROMPT }],
        },
        ...history,
        {
          role: 'user' as const,
          parts: [
            { text: query },
            ...bitmaps.map((b) => ({
              inlineData: {
                data: b,
                mimeType: 'image/png',
              },
            })),
          ],
        },
      ];

      const result = await model.generateContent({
        systemInstruction: CHAT_SYSTEM_PROMPT,
        contents,
      });
      const responseText = result.response.text();

      // 4. Add AI response to DB with page references
      await addMessage('AI', responseText || "I couldn't generate a response.", undefined, pagesToCapture);
    } catch (error: any) {
      console.error('Error in chat:', error);
      await addMessage('AI', `Sorry, I encountered an error: ${error.message || 'Unknown error'}`, undefined, selectedPages);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Transparent backdrop for closing */}
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />

        <View style={[styles.keyboardWrapper, { paddingBottom: effectiveKeyboardOffset }]}>
          <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headerIndicator} />
              <View style={styles.headerContent}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>AI Tutor</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close-circle" size={28} color={colors.textTertiary} />
                </TouchableOpacity>
              </View>
            </View>

            {/* Reference Pages Indicator (WhatsApp-style) */}
            {selectedPages && selectedPages.length > 0 && (
              <View style={styles.referenceContainer}>
                <View style={[styles.referencePill, { backgroundColor: colors.badge }]}>
                  <Ionicons name="documents-outline" size={16} color={colors.primary} />
                  <Text style={[styles.referencePillText, { color: colors.primary }]}>
                    {selectedPages.length} page{selectedPages.length > 1 ? 's' : ''} included
                  </Text>
                  <TouchableOpacity onPress={onClearReferences} style={styles.referenceClose}>
                    <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <FlashList
                ref={flashListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              />
            </View>

            {isLoading && (
              <View style={[styles.loadingContainer, { backgroundColor: colors.loading }]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.primary }]}>AI Tutor is analyzing pages...</Text>
              </View>
            )}

            <View style={[
              styles.inputArea,
              { 
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
                paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 16)
              }
            ]}>
              <View style={[styles.inputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Ask about these pages..."
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity
                  onPress={() => handleSend()}
                  style={[styles.sendButton, !inputText.trim() && { backgroundColor: colors.inputBorder }]}
                  disabled={!inputText.trim() || isLoading}
                >
                  <Ionicons name="arrow-up" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '88%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
    flexShrink: 1,
  },
  header: {
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 2,
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 14,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  humanMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F2F2F7',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  humanText: {
    color: '#fff',
    fontWeight: '500',
  },
  aiText: {
    color: '#1C1C1E',
  },
  aiMarkdownContainer: {
    flexShrink: 1,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 4,
    opacity: 0.7,
  },
  humanTimestamp: {
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'right',
  },
  aiTimestamp: {
    color: '#8E8E93',
    textAlign: 'left',
  },
  keyboardWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  inputArea: {
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: '#F8F8F8',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  input: {
    flex: 1,
    maxHeight: 120,
    fontSize: 16,
    color: '#1C1C1E',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  sendButton: {
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  disabledSend: {
    backgroundColor: '#E0E0E0',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(0, 122, 255, 0.05)',
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 10,
  },
  loadingText: {
    marginLeft: 10,
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
  referenceContainer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: 'transparent',
  },
  referencePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
    gap: 6,
  },
  referencePillText: {
    fontSize: 13,
    color: '#007AFF',
    fontWeight: '500',
  },
  referenceClose: {
    marginLeft: 4,
  },
  goToPageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 8,
    gap: 6,
  },
  goToPageText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
});
