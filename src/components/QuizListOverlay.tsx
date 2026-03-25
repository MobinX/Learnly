import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Quiz } from '../db/schema';
import { useTheme } from '../theme/colors';

interface QuizListOverlayProps {
  visible: boolean;
  onClose: () => void;
  quizzes: Quiz[];
  onSelectQuiz: (quiz: Quiz) => void;
  loading?: boolean;
}

export const QuizListOverlay: React.FC<QuizListOverlayProps> = ({
  visible,
  onClose,
  quizzes,
  onSelectQuiz,
  loading = false,
}) => {
  const { colors } = useTheme();
  
  const renderQuizItem = ({ item }: { item: Quiz }) => {
    const hasAttempted = item.lastScore !== undefined && item.lastScore !== null;
    const scoreColor = hasAttempted
      ? item.lastScore! >= 70
        ? colors.success
        : item.lastScore! >= 50
          ? colors.warning
          : colors.error
      : colors.textTertiary;

    return (
      <TouchableOpacity
        style={[styles.quizItem, { backgroundColor: colors.surfaceSecondary, borderColor: colors.inputBorder }]}
        onPress={() => onSelectQuiz(item)}
        activeOpacity={0.7}
      >
        <View style={styles.quizItemLeft}>
          <View style={[styles.quizIcon, { backgroundColor: hasAttempted ? colors.success : colors.warning }]}>
            <Ionicons
              name={hasAttempted ? 'checkmark-done' : 'school'}
              size={24}
              color="#fff"
            />
          </View>
          <View style={styles.quizItemContent}>
            <Text style={[styles.quizTitle, { color: colors.text }]} numberOfLines={2}>{item.title}</Text>
            <View style={styles.quizMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="documents-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>Pages: {item.pageReferences.join(', ')}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="help-circle-outline" size={14} color={colors.textSecondary} />
                <Text style={[styles.metaText, { color: colors.textSecondary }]}>{item.totalQuestions} questions</Text>
              </View>
            </View>
            {hasAttempted && (
              <View style={[styles.scoreBadge, { backgroundColor: colors.surfaceSecondary }]}>
                <Ionicons name="trophy" size={14} color={scoreColor} />
                <Text style={[styles.scoreText, { color: scoreColor }]}>
                  {item.lastScore}% correct
                </Text>
                {item.lastAttemptedAt && (
                  <Text style={[styles.lastAttemptText, { color: colors.textTertiary }]}>
                    {new Date(item.lastAttemptedAt).toLocaleDateString()}
                  </Text>
                )}
              </View>
            )}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.textTertiary} />
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="school-outline" size={64} color={colors.textTertiary} />
      <Text style={[styles.emptyTitle, { color: colors.textTertiary }]}>No Quizzes Yet</Text>
      <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
        Select pages and tap the Quiz FAB to generate your first quiz
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={onClose}
        />
        
        <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={styles.headerIndicator} />
            <View style={styles.headerContent}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>My Quizzes</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close-circle" size={28} color={colors.textTertiary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading quizzes...</Text>
            </View>
          ) : quizzes.length === 0 ? (
            renderEmptyState()
          ) : (
            <FlatList
              data={quizzes}
              renderItem={renderQuizItem}
              keyExtractor={(item) => item.id}
              contentContainerStyle={[styles.listContent, { backgroundColor: colors.surface }]}
            />
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
    height: '85%',
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
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A1A1A',
  },
  closeButton: {
    padding: 2,
  },
  listContent: {
    padding: 16,
  },
  quizItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  quizItemLeft: {
    flexDirection: 'row',
    flex: 1,
    alignItems: 'center',
  },
  quizIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#FF9500',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  quizIconAttempted: {
    backgroundColor: '#34C759',
  },
  quizItemContent: {
    flex: 1,
  },
  quizTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  quizMeta: {
    flexDirection: 'row',
    gap: 16,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
    color: '#666',
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '600',
  },
  lastAttemptText: {
    fontSize: 11,
    color: '#999',
    marginLeft: 4,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#999',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 22,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#999',
  },
});
