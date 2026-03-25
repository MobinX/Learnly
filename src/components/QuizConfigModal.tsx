import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Keyboard,
  KeyboardEvent,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProgressBar, Button } from 'react-native-paper';
import { useTheme } from '../theme/colors';

interface QuizConfigModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (config: {
    totalQuestions: number;
    optionsPerQuestion: number;
    aiInstruction: string;
  }) => Promise<void>;
  loading?: boolean;
}

export const QuizConfigModal: React.FC<QuizConfigModalProps> = ({
  visible,
  onClose,
  onSubmit,
  loading = false,
}) => {
  const { colors } = useTheme();
  const [totalQuestions, setTotalQuestions] = useState('5');
  const [optionsPerQuestion, setOptionsPerQuestion] = useState('4');
  const [aiInstruction, setAiInstruction] = useState('');
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const insets = useSafeAreaInsets();
  const keyboardLiftOffset = Platform.OS === 'ios' ? 40 : 16;
  const effectiveKeyboardOffset =
    keyboardHeight > 0 ? keyboardHeight + keyboardLiftOffset : 0;

  // Debug: Log loading state changes
  useEffect(() => {
    console.log('📝 QuizConfigModal loading state changed:', loading);
  }, [loading]);

  // Handle keyboard show/hide
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleKeyboardShow = (event: KeyboardEvent) => {
      setKeyboardHeight(event.endCoordinates?.height ?? 0);
    };

    const handleKeyboardHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleOk = async () => {
    console.log('🔘 Generate button pressed');
    const totalQ = parseInt(totalQuestions, 10);
    const optionsPerQ = parseInt(optionsPerQuestion, 10);

    if (isNaN(totalQ) || totalQ < 1 || totalQ > 20) {
      alert('Please enter a valid number of questions (1-20)');
      return;
    }

    if (isNaN(optionsPerQ) || optionsPerQ < 2 || optionsPerQ > 6) {
      alert('Please enter valid options per question (2-6)');
      return;
    }

    console.log('📞 Calling onSubmit...');
    await onSubmit({
      totalQuestions: totalQ,
      optionsPerQuestion: optionsPerQ,
      aiInstruction: aiInstruction.trim(),
    });
    console.log('✅ onSubmit completed');
  };

  const handleCancel = () => {
    setTotalQuestions('5');
    setOptionsPerQuestion('4');
    setAiInstruction('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={loading ? () => {} : handleCancel}
    >
      <View style={styles.overlay}>
        <View style={[styles.keyboardWrapper, { paddingBottom: effectiveKeyboardOffset }]}>
          <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
              <View style={styles.headerIndicator} />
              <Text style={[styles.headerTitle, { color: colors.text }]}>Configure Quiz</Text>
            </View>

            <ScrollView
              style={styles.scrollContent}
              contentContainerStyle={[styles.scrollContentContainer, { backgroundColor: colors.surface }]}
              keyboardShouldPersistTaps="handled"
              scrollEnabled={!loading}
            >
              {loading ? (
                <View style={styles.loadingState}>
                  <ActivityIndicator size="large" color={colors.warning} />
                  <Text style={[styles.loadingTitle, { color: colors.text }]}>Generating Quiz...</Text>
                  <Text style={[styles.loadingSubtitle, { color: colors.textSecondary }]}>
                    AI is creating questions from the selected pages
                  </Text>
                  <ProgressBar progress={0.6} color={colors.warning} style={styles.progressBar} />
                </View>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Total Questions</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                      value={totalQuestions}
                      onChangeText={setTotalQuestions}
                      keyboardType="number-pad"
                      placeholder="Enter number of questions"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>Enter a number between 1 and 20</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>Options per Question</Text>
                    <TextInput
                      style={[styles.input, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                      value={optionsPerQuestion}
                      onChangeText={setOptionsPerQuestion}
                      keyboardType="number-pad"
                      placeholder="Enter options per question"
                      placeholderTextColor={colors.textTertiary}
                    />
                    <Text style={[styles.hint, { color: colors.textTertiary }]}>Enter a number between 2 and 6</Text>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={[styles.label, { color: colors.text }]}>
                      Optional Instruction to AI
                      <Text style={[styles.optionalLabel, { color: colors.textSecondary }]}> (Optional)</Text>
                    </Text>
                    <TextInput
                      style={[styles.input, styles.textArea, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder, color: colors.text }]}
                      value={aiInstruction}
                      onChangeText={setAiInstruction}
                      placeholder="E.g., Focus on definitions and formulas, or Create challenging questions..."
                      placeholderTextColor={colors.textTertiary}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </>
              )}
            </ScrollView>

            {!loading && (
              <View style={[styles.footer, { borderTopColor: colors.border }]}>
                <Button
                  mode="outlined"
                  onPress={handleCancel}
                  disabled={loading}
                  style={[styles.button, styles.cancelButton, { borderColor: colors.inputBorder }]}
                  labelStyle={styles.cancelButtonLabel}
                >
                  Cancel
                </Button>

                <Button
                  mode="contained"
                  onPress={handleOk}
                  disabled={loading}
                  style={[styles.button, styles.okButton, { backgroundColor: colors.warning }]}
                  labelStyle={styles.okButtonLabel}
                  icon="star-outline"
                >
                  Generate Quiz
                </Button>
              </View>
            )}
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
  keyboardWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  header: {
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  headerIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
    textAlign: 'center',
  },
  scrollContent: {
    flexGrow: 1,
  },
  scrollContentContainer: {
    padding: 20,
    flexGrow: 1,
  },
  loadingState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 16,
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  loadingSubtitle: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    width: '80%',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  optionalLabel: {
    fontWeight: '400',
    color: '#666',
  },
  input: {
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    paddingTop: 16,
  },
  button: {
    flex: 1,
    borderRadius: 12,
  },
  cancelButton: {
    borderColor: '#E0E0E0',
  },
  cancelButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  okButton: {
    backgroundColor: '#FF9500',
  },
  okButtonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
