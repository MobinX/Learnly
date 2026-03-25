import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import type { Quiz, QuizQuestion } from '../db/schema';
import { useTheme } from '../theme/colors';

interface QuizOverlayProps {
  visible: boolean;
  quiz: Quiz | null;
  onClose: () => void;
  onSaveScore?: (score: number) => void;
}

interface QuestionItemProps {
  question: QuizQuestion;
  questionNumber: number;
  selectedAnswer: string | null;
  onAnswerSelect: (answer: string) => void;
  showExplanation: boolean;
  isLastQuestion: boolean;
}

const QuestionItem: React.FC<QuestionItemProps & { colors: any; isDark: boolean }> = ({
  question,
  questionNumber,
  selectedAnswer,
  onAnswerSelect,
  showExplanation,
  isLastQuestion,
  colors,
  isDark,
}) => {
  const isCorrect = selectedAnswer === question.correctOption;
  const hasAnswered = selectedAnswer !== null;

  return (
    <View style={[styles.questionContainer, isLastQuestion && styles.lastQuestion, { borderBottomColor: colors.border }]}>
      <View style={styles.questionHeader}>
        <View style={[styles.questionNumberBadge, { backgroundColor: colors.primary }]}>
          <Text style={styles.questionNumberText}>{questionNumber}</Text>
        </View>
        <Text style={[styles.questionText, { color: colors.text }]}>{question.question}</Text>
      </View>

      <View style={styles.optionsContainer}>
        {question.options.map((option, index) => {
          const isSelected = selectedAnswer === option;
          const isCorrectOption = option === question.correctOption;
          
          const optionStyle = [
            styles.option,
            { backgroundColor: colors.quizOption, borderColor: colors.inputBorder },
            hasAnswered && isCorrectOption && { backgroundColor: colors.quizOptionCorrect, borderColor: colors.success },
            hasAnswered && isSelected && !isCorrectOption && { backgroundColor: colors.quizOptionIncorrect, borderColor: colors.error },
            !hasAnswered && isSelected && { backgroundColor: colors.quizOptionSelected, borderColor: colors.primary },
          ];
          let optionTextStyle = { ...styles.optionText, color: colors.text };
          if (hasAnswered && isCorrectOption) {
            optionTextStyle = { ...styles.correctOptionText, color: colors.success };
          } else if (hasAnswered && isSelected && !isCorrectOption) {
            optionTextStyle = { ...styles.incorrectOptionText, color: colors.error };
          } else if (!hasAnswered && isSelected) {
            optionTextStyle = { ...styles.selectedOptionText, color: colors.primary };
          }
          let icon = null;
          if (hasAnswered && isCorrectOption) {
            icon = <Ionicons name="checkmark-circle" size={24} color={colors.success} />;
          } else if (hasAnswered && isSelected && !isCorrectOption) {
            icon = <Ionicons name="close-circle" size={24} color={colors.error} />;
          }

          return (
            <TouchableOpacity
              key={index}
              style={optionStyle}
              onPress={() => !hasAnswered && onAnswerSelect(option)}
              disabled={hasAnswered}
            >
              <View style={styles.optionContent}>
                <Text style={[styles.optionLabel, optionTextStyle]}>
                  {String.fromCharCode(65 + index)}
                </Text>
                <Text style={[styles.optionText, optionTextStyle]}>{option}</Text>
              </View>
              {icon}
            </TouchableOpacity>
          );
        })}
      </View>

      {showExplanation && hasAnswered && (
        <View style={[styles.explanationContainer, { backgroundColor: isDark ? '#3A2E1C' : '#FFF8E1', borderLeftColor: colors.warning }]}>
          <View style={styles.explanationHeader}>
            <Ionicons name="bulb-outline" size={20} color={colors.warning} />
            <Text style={[styles.explanationTitle, { color: colors.warning }]}>Explanation</Text>
          </View>
          <Text style={[styles.explanationText, { color: colors.textSecondary }]}>{question.explanation}</Text>
        </View>
      )}
    </View>
  );
};

export const QuizOverlay: React.FC<QuizOverlayProps> = ({
  visible,
  quiz,
  onClose,
  onSaveScore,
}) => {
  const { colors, isDark } = useTheme();
  const [answers, setAnswers] = useState<{ [key: number]: string | null }>({});
  const [showResults, setShowResults] = useState(false);

  const totalQuestions = quiz?.questions.length || 0;
  const answeredCount = Object.values(answers).filter(a => a !== null).length;
  const correctCount = Object.entries(answers).filter(([index, answer]) => {
    return answer === quiz?.questions[parseInt(index)].correctOption;
  }).length;

  const score = useMemo(() => {
    if (totalQuestions === 0) return 0;
    return Math.round((correctCount / totalQuestions) * 100);
  }, [correctCount, totalQuestions]);

  const handleAnswerSelect = (questionIndex: number, answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const handleSubmit = () => {
    setShowResults(true);
    // Save the score
    if (onSaveScore && quiz) {
      onSaveScore(score);
    }
  };

  const handleRestart = () => {
    setAnswers({});
    setShowResults(false);
  };

  const handleClose = () => {
    setAnswers({});
    setShowResults(false);
    onClose();
  };

  const renderQuestion = ({ item, index }: { item: QuizQuestion; index: number }) => (
    <QuestionItem
      question={item}
      questionNumber={index + 1}
      selectedAnswer={answers[index] || null}
      onAnswerSelect={(answer) => handleAnswerSelect(index, answer)}
      showExplanation={showResults}
      isLastQuestion={index === totalQuestions - 1}
      colors={colors}
      isDark={isDark}
    />
  );

  const keyExtractor = (item: QuizQuestion, index: number) => `question-${index}`;

  if (!quiz) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerIndicator} />
            <View style={styles.headerContent}>
              <View style={styles.headerLeft}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>{quiz.title}</Text>
                <View style={[styles.referenceBadge]}>
                  <Ionicons name="documents-outline" size={14} color={colors.primary} />
                  <Text style={[styles.referenceText, { color: colors.primary }]}>
                    Pages: {quiz.pageReferences.join(', ')}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <Ionicons name="close-circle" size={28} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {!showResults ? (
            <>
              <View style={[styles.progressBarContainer, { backgroundColor: colors.inputBorder }]}>
                <View style={[styles.progressBar, { width: `${(answeredCount / totalQuestions) * 100}%`, backgroundColor: colors.primary }]} />
              </View>
              
              <View style={styles.progressTextContainer}>
                <Text style={[styles.progressText, { color: colors.text }]}>
                  Question {answeredCount} of {totalQuestions}
                </Text>
                <Text style={[styles.progressSubtext, { color: colors.textSecondary }]}>
                  {answeredCount === totalQuestions ? 'Ready to submit!' : 'Answer all questions'}
                </Text>
              </View>

              <FlashList
                data={quiz.questions}
                renderItem={renderQuestion}
                keyExtractor={keyExtractor}
                contentContainerStyle={styles.listContent}
              />

              {answeredCount === totalQuestions && (
                <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
                  <TouchableOpacity style={[styles.submitButton, { backgroundColor: colors.primary }]} onPress={handleSubmit}>
                    <Text style={styles.submitButtonText}>Submit Quiz</Text>
                    <Ionicons name="arrow-forward" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : (
            <ScrollView style={styles.resultsContainer} contentContainerStyle={styles.resultsContent}>
              <View style={styles.scoreCard}>
                <View style={[styles.scoreCircle, { backgroundColor: colors.badge }]}>
                  <Text style={[styles.scorePercentage, { color: colors.primary }]}>{score}%</Text>
                </View>
                <Text style={[styles.scoreText, { color: colors.textSecondary }]}>
                  You got {correctCount} out of {totalQuestions} correct
                </Text>
                <View style={styles.scoreStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="checkmark-circle" size={24} color={colors.success} />
                    <Text style={[styles.statText, { color: colors.text }]}>{correctCount} Correct</Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="close-circle" size={24} color={colors.error} />
                    <Text style={[styles.statText, { color: colors.text }]}>{totalQuestions - correctCount} Incorrect</Text>
                  </View>
                </View>
              </View>

              <View style={styles.resultsActions}>
                <TouchableOpacity style={[styles.restartButton, { backgroundColor: colors.badge }]} onPress={handleRestart}>
                  <Ionicons name="refresh-outline" size={20} color={colors.primary} />
                  <Text style={[styles.restartButtonText, { color: colors.primary }]}>Retry Quiz</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.doneButton, { backgroundColor: colors.surfaceSecondary }]} onPress={handleClose}>
                  <Text style={[styles.doneButtonText, { color: colors.text }]}>Done</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.reviewTitle}>
                <Text style={[styles.reviewTitleText, { color: colors.text }]}>Review Answers</Text>
              </View>

              {quiz.questions.map((question, index) => (
                <QuestionItem
                  key={index}
                  question={question}
                  questionNumber={index + 1}
                  selectedAnswer={answers[index] || null}
                  onAnswerSelect={() => {}}
                  showExplanation={true}
                  isLastQuestion={index === totalQuestions - 1}
                  colors={colors}
                  isDark={isDark}
                />
              ))}
            </ScrollView>
          )}
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
    height: '90%',
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 20,
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
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  referenceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  referenceText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  closeButton: {
    padding: 2,
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: '#F0F0F0',
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  progressTextContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  progressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  progressSubtext: {
    fontSize: 12,
    color: '#999',
  },
  listContent: {
    padding: 20,
    paddingBottom: 100,
  },
  questionContainer: {
    marginBottom: 24,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  lastQuestion: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  questionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  questionNumberText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  questionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    lineHeight: 22,
  },
  optionsContainer: {
    gap: 10,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F4FF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  correctOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F8ED',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#34C759',
  },
  incorrectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFE5E5',
    borderRadius: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#333',
    marginRight: 8,
    minWidth: 22,
  },
  optionText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  selectedOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#007AFF',
    fontWeight: '600',
  },
  correctOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#34C759',
    fontWeight: '600',
  },
  incorrectOptionText: {
    flex: 1,
    fontSize: 15,
    color: '#FF3B30',
    fontWeight: '600',
  },
  explanationContainer: {
    marginTop: 16,
    backgroundColor: '#FFF8E1',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9500',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  explanationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF9500',
  },
  explanationText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  resultsContainer: {
    flex: 1,
  },
  resultsContent: {
    padding: 20,
    paddingBottom: 40,
  },
  scoreCard: {
    alignItems: 'center',
    paddingVertical: 20,
    marginBottom: 20,
  },
  scoreCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#E8F4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  scorePercentage: {
    fontSize: 36,
    fontWeight: '800',
    color: '#007AFF',
  },
  scoreText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  scoreStats: {
    flexDirection: 'row',
    gap: 24,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  statText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  resultsActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  restartButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F4FF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  restartButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#007AFF',
  },
  doneButton: {
    flex: 1,
    backgroundColor: '#F0F0F0',
    paddingVertical: 14,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
  },
  reviewTitle: {
    marginBottom: 16,
  },
  reviewTitleText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
  },
});
