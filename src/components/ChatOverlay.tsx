import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Platform,
  ActivityIndicator,
  Modal,
  Keyboard,
  KeyboardEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChats } from '../db/hooks/useChats';
import { getApp } from '@react-native-firebase/app';
import { getAI, getGenerativeModel } from '@react-native-firebase/ai';
import RnPdfKing from 'rn-pdf-king';

interface ChatOverlayProps {
  isVisible: boolean;
  onClose: () => void;
  pdfId: string;
  currentPage: number;
  pageCount: number;
  initialQuery?: string;
}

export const ChatOverlay: React.FC<ChatOverlayProps> = ({
  isVisible,
  onClose,
  pdfId,
  currentPage,
  pageCount,
  initialQuery,
}) => {
  const { messages, addMessage } = useChats(pdfId);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const insets = useSafeAreaInsets();
  const keyboardLiftOffset = Platform.OS === 'android' ? 40 : 16;
  const effectiveKeyboardOffset =
    keyboardHeight > 0 ? keyboardHeight + keyboardLiftOffset : 0;

  // Auto-scroll when messages update
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // Keep chat sheet above keyboard on both iOS and Android.
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const frameEvent = Platform.OS === 'ios' ? 'keyboardWillChangeFrame' : 'keyboardDidShow';

    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
      flatListRef.current?.scrollToEnd({ animated: true });
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

  const handleSend = async (queryOverride?: string) => {
    const query = queryOverride || inputText.trim();
    if (!query || isLoading) return;

    setInputText('');
    setIsLoading(true);

    try {
      // 1. Add Human message to DB
      await addMessage('Human', query);

      // 2. Prepare images (Current, prev, next)
      const pagesToCapture = [];
      if (currentPage > 1) pagesToCapture.push(currentPage - 1);
      pagesToCapture.push(currentPage);
      if (currentPage < pageCount) pagesToCapture.push(currentPage + 1);

      const bitmaps = await Promise.all(
        pagesToCapture.map((p) => RnPdfKing.getPageBitmapBase64(p))
      );

      // 3. Prepare AI contents (with history)
      const ai = getAI(getApp());
      const model = getGenerativeModel(ai, { model: 'gemini-2.5-flash-lite' });
      
      // Get last 10 messages for context
      const lastMessages = messages.slice(-10);
      const history = lastMessages.map(m => ({
        role: m.sender === 'Human' ? 'user' : 'model',
        parts: [{ text: m.messageText }]
      }));

      const contents = [
        ...history,
        {
          role: 'user',
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

      const result = await model.generateContent({ contents });
      const responseText = result.response.text();

      // 4. Add AI response to DB
      await addMessage('AI', responseText || "I couldn't generate a response.");
    } catch (error: any) {
      console.error('Error in chat:', error);
      await addMessage('AI', `Sorry, I encountered an error: ${error.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: any }) => (
    <View
      style={[
        styles.messageContainer,
        item.sender === 'Human' ? styles.humanMessage : styles.aiMessage,
      ]}
    >
      <Text style={[
          styles.messageText,
          item.sender === 'Human' ? styles.humanText : styles.aiText
      ]}>
        {item.messageText}
      </Text>
      <Text style={[
        styles.timestamp,
        item.sender === 'Human' ? styles.humanTimestamp : styles.aiTimestamp
      ]}>
        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    </View>
  );

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
          <View style={styles.container}>
            <View style={styles.header}>
              <View style={styles.headerIndicator} />
              <View style={styles.headerContent}>
                <Text style={styles.headerTitle}>AI Tutor</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close-circle" size={28} color="#999" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={{ flex: 1 }}>
              <FlatList
                ref={flatListRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                keyboardShouldPersistTaps="handled"
              />
            </View>

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#007AFF" />
                <Text style={styles.loadingText}>AI Tutor is analyzing pages...</Text>
              </View>
            )}

            <View style={[
              styles.inputArea, 
              { paddingBottom: keyboardHeight > 0 ? 12 : Math.max(insets.bottom, 16) }
            ]}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Ask about these pages..."
                  value={inputText}
                  onChangeText={setInputText}
                  multiline
                  placeholderTextColor="#999"
                />
                <TouchableOpacity 
                  onPress={() => handleSend()} 
                  style={[styles.sendButton, !inputText.trim() && styles.disabledSend]}
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
});
