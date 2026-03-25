import React, { useState, useLayoutEffect, useEffect, useRef, useCallback, useMemo } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  Platform,
  Modal,
  Pressable,
  Linking,
  BackHandler,
  Keyboard,
  KeyboardEvent,
  TextInput,
} from "react-native";
import { FAB, ActivityIndicator, Portal } from 'react-native-paper';
import { useNavigation, useRouter } from "expo-router";
import RnPdfKing, {
  usePdfDocument,
  ZoomableList,
  ZoomablePdfPage,
  PdfPageHandle,
} from "rn-pdf-king";
import { usePdfActions, useHighlights, useSummaries, useQuizs } from "../db";
import { useGenerateSummary } from "../hooks/useGenerateSummary";
import { useGenerateQuiz } from "../hooks/useGenerateQuiz";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  cancelAnimation,
  runOnJS,
  withRepeat
} from "react-native-reanimated";
import * as Clipboard from 'expo-clipboard';
import { Ionicons, AntDesign, MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ColorPicker, { Panel1, Swatches, Preview, OpacitySlider, HueSlider } from 'reanimated-color-picker';
import { ChatOverlay } from "../components/ChatOverlay";
import { QuizOverlay } from "../components/QuizOverlay";
import { QuizListOverlay } from "../components/QuizListOverlay";
import { QuizConfigModal } from "../components/QuizConfigModal";
import { EnrichedMarkdownText, type MarkdownStyle } from "react-native-enriched-markdown";
import type { Quiz } from "../db/schema";
import { useTheme } from "../theme/colors";

const HEADER_HEIGHT = 60;
const summaryMarkdownStyle: MarkdownStyle = {
  paragraph: { fontSize: 16, lineHeight: 24, color: "#1C1C1E", marginBottom: 12 },
  h1: { fontSize: 26, lineHeight: 34, fontWeight: "700", color: "#111827", marginBottom: 12 },
  h2: { fontSize: 22, lineHeight: 30, fontWeight: "700", color: "#111827", marginBottom: 10 },
  h3: { fontSize: 19, lineHeight: 27, fontWeight: "600", color: "#111827", marginBottom: 8 },
  list: { fontSize: 16, lineHeight: 24, color: "#1C1C1E", marginBottom: 8 },
  codeBlock: { fontSize: 14, lineHeight: 20, backgroundColor: "#F3F4F6", borderRadius: 8, padding: 10 },
  code: { fontSize: 14, color: "#111827", backgroundColor: "#EEF2FF", borderColor: "#E5E7EB" },
  link: { color: "#007AFF", underline: true },
  blockquote: { color: "#374151", borderColor: "#D1D5DB", borderWidth: 4, gapWidth: 12, backgroundColor: "#F9FAFB" },
  table: {
    fontSize: 14,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    headerBackgroundColor: "#F3F4F6",
    cellPaddingHorizontal: 10,
    cellPaddingVertical: 6,
  },
};

const GripHorizontal = ({ size = 20, color = "#666" }) => {
  const dotSize = size / 6;
  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', marginBottom: 2 }}>
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color, marginHorizontal: 1 }} />
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color, marginHorizontal: 1 }} />
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color, marginHorizontal: 1 }} />
      </View>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color, marginHorizontal: 1 }} />
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color, marginHorizontal: 1 }} />
        <View style={{ width: dotSize, height: dotSize, borderRadius: dotSize / 2, backgroundColor: color, marginHorizontal: 1 }} />
      </View>
    </View>
  );
};

interface PageItemProps {
  item: number;
  width: number;
  highlights: any[];
  activeSelectionPage: number | null;
  onSelectionChanged: (page: number, selection: any) => void;
  onPreDefinedHighlightClick: (event: any) => void;
  isSelectionMode: boolean;
  isSelected: boolean;
  onToggleSelect: (page: number) => void;
}

const SkeletonLoader = () => {
  const opacity = useSharedValue(0.3);
  
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 1000 }),
      -1,
      true
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value
  }));

  return (
    <View style={{ gap: 10, padding: 10 }}>
      <Animated.View style={[{ height: 20, width: '80%', backgroundColor: '#eee', borderRadius: 4 }, animatedStyle]} />
      <Animated.View style={[{ height: 20, width: '90%', backgroundColor: '#eee', borderRadius: 4 }, animatedStyle]} />
      <Animated.View style={[{ height: 20, width: '95%', backgroundColor: '#eee', borderRadius: 4 }, animatedStyle]} />
      <Animated.View style={[{ height: 20, width: '85%', backgroundColor: '#eee', borderRadius: 4 }, animatedStyle]} />
      <Animated.View style={[{ height: 20, width: '60%', backgroundColor: '#eee', borderRadius: 4 }, animatedStyle]} />
    </View>
  );
};

type ViewerItemType = 
  | { type: 'pdf'; pageNo: number }
  | { type: 'custom'; text: string; id: string; isLoading?: boolean };

const PageItem = React.memo(({ 
  item, 
  width, 
  highlights, 
  activeSelectionPage, 
  onSelectionChanged, 
  onPreDefinedHighlightClick,
  isSelectionMode,
  isSelected,
  onToggleSelect
}: PageItemProps) => {
  const itemHeight = width * 1.414;
  const pdfRef = useRef<PdfPageHandle>(null);

  // Filter highlights for this page
  const pageHighlights = React.useMemo(() => highlights
    .filter(h => h.pageNo === item)
    .map(h => ({
      id: h.id,
      startIndex: h.startIndex,
      endIndex: h.endIndex,
      color: h.color,
    })), [highlights, item]);

  // Clear selection if this page is not the active one
  useEffect(() => {
    if (activeSelectionPage !== null && activeSelectionPage !== item) {
      pdfRef.current?.clearSelectionState();
    }
  }, [activeSelectionPage, item]);

  return (
    <View style={[styles.pageWrapper, { width, height: itemHeight }]}>
      <View style={{ flex: 1 }} pointerEvents={isSelectionMode ? "none" : "auto"}>
        <ZoomablePdfPage
            ref={pdfRef}
            pageNo={item}
            width={width}
            height={itemHeight}
            preDefinedHighlights={pageHighlights}
            handleColor="blue"
            selectionColor="rgba(0, 0, 255, 0.3)"
            onSelectionStarted={() => {}}
            onSelectionEnded={() => {}}
            onPreDefinedHighlightClick={onPreDefinedHighlightClick}
            // Always enabled, we clear programmatically
            selectionEnabled={true} 
            // @ts-ignore: Assuming ZoomablePdfPage supports this event based on prompt
            onSelectionChanged={(event) => {
               onSelectionChanged(item, event.nativeEvent);
            }}
        />
      </View>
      {isSelectionMode && (
        <Pressable 
          style={[
            StyleSheet.absoluteFill,
            isSelected && { backgroundColor: 'rgba(0, 0, 0, 0.2)' }
          ]} 
          onPress={() => onToggleSelect(item)}
        >
          <View style={styles.checkboxContainer}>
            <Ionicons 
              name={isSelected ? "checkbox" : "square-outline"} 
              size={24} 
              color={isSelected ? "#007AFF" : "#666"} 
            />
          </View>
        </Pressable>
      )}
      <Text style={styles.pageLabel}>Page {item}</Text>
    </View>
  );
});

PageItem.displayName = 'PageItem';

export default function ViewerPage() {
  const navigation = useNavigation();
  const router = useRouter();
  const { loading, pageCount, filePath, fileName, clearAllSelections } = usePdfDocument();
  const { colors, isDark } = useTheme();
  
  // Always use light theme for markdown summaries (never dark)
  const themedSummaryMarkdownStyle: MarkdownStyle = useMemo(() => ({
    paragraph: { fontSize: 16, lineHeight: 24, color: "#1C1C1E", marginBottom: 12 },
    h1: { fontSize: 26, lineHeight: 34, fontWeight: "700", color: "#111827", marginBottom: 12 },
    h2: { fontSize: 22, lineHeight: 30, fontWeight: "700", color: "#111827", marginBottom: 10 },
    h3: { fontSize: 19, lineHeight: 27, fontWeight: "600", color: "#111827", marginBottom: 8 },
    list: { fontSize: 16, lineHeight: 24, color: "#1C1C1E", marginBottom: 8 },
    codeBlock: { fontSize: 14, lineHeight: 20, backgroundColor: "#F3F4F6", borderRadius: 8, padding: 10 },
    code: { fontSize: 14, color: "#111827", backgroundColor: "#EEF2FF", borderColor: "#E5E7EB" },
    link: { color: "#007AFF", underline: true },
    blockquote: { color: "#374151", borderColor: "#D1D5DB", borderWidth: 4, gapWidth: 12, backgroundColor: "#F9FAFB" },
    table: {
      fontSize: 14,
      borderColor: "#E5E7EB",
      borderRadius: 8,
      headerBackgroundColor: "#F3F4F6",
      cellPaddingHorizontal: 10,
      cellPaddingVertical: 6,
    },
  }), []);

  const { getPdfFileByPath, addPdfFile, updateLastOpened, updatePageNumberOnly } = usePdfActions();
  const [dbLoaded, setDbLoaded] = useState(false);
  const [initialPage, setInitialPage] = useState(1);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);
  
  // Custom Data Source
  const [viewerData, setViewerData] = useState<ViewerItemType[]>([]);

  const currentPageRef = useRef(1);
  const navigateToPageIndexRef = useRef<number | null>(null);
  const [, forceUpdate] = useState(0);

  // Selection state
  const [selection, setSelection] = useState<{
    text: string;
    pageNo: number;
    start: number;
    end: number;
  } | null>(null);

  // Page Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInitialQuery, setChatInitialQuery] = useState('');
  const [fabOpen, setFabOpen] = useState(false);

  // Quiz states
  const [isQuizOpen, setIsQuizOpen] = useState(false);
  const [showQuizConfig, setShowQuizConfig] = useState(false);
  const [showQuizList, setShowQuizList] = useState(false);
  const [selectedQuiz, setSelectedQuiz] = useState<Quiz | null>(null);
  const [isGeneratingQuiz, setIsGeneratingQuiz] = useState(false);

  // Chat scroll position memory
  const [chatScrollPosition, setChatScrollPosition] = useState<number | null>(null);

  // Summary edit states
  const [editingSummaryId, setEditingSummaryId] = useState<string | null>(null);
  const [editInstruction, setEditInstruction] = useState('');
  const [isRegeneratingSummary, setIsRegeneratingSummary] = useState(false);
  const [summaryKeyboardHeight, setSummaryKeyboardHeight] = useState(0);

  const [highlightColor, setHighlightColor] = useState('rgba(0, 0, 255, 0.3)'); // Default to blue
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Header animation
  const headerOpacity = useSharedValue(1);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Database hooks
  console.log('📄 Viewer: pdfId =', pdfId, 'fileName =', fileName);
  const { highlights, addHighlight, deleteHighlight } = useHighlights(pdfId || "");
  const { summaries, addOrUpdateSummary, deleteSummary } = useSummaries(pdfId || "");
  const { quizs, addQuiz, deleteQuiz, updateQuizScore } = useQuizs(pdfId || "");
  const { generateSummary } = useGenerateSummary();
  const { generateQuiz } = useGenerateQuiz();
  
  const insets = useSafeAreaInsets();
  const headerHeight = HEADER_HEIGHT + insets.top;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const hideHeader = useCallback(() => {
    cancelAnimation(headerOpacity);
    headerOpacity.value = withTiming(0, { duration: 300 });
  }, [headerOpacity]);

  const resetInactivityTimer = useCallback(() => {
    if (selection) return; // Don't hide if selecting

    if (inactivityTimer.current) {
      clearTimeout(inactivityTimer.current);
    }
    inactivityTimer.current = setTimeout(() => {
      hideHeader();
    }, 1000); // 1s inactivity
  }, [selection, hideHeader]);

  const showHeader = useCallback(() => {
    cancelAnimation(headerOpacity);
    headerOpacity.value = withTiming(1, { duration: 300 });
    resetInactivityTimer();
  }, [headerOpacity, resetInactivityTimer]);

  // Handle back button when selection mode is active or editing summary
  useEffect(() => {
    const onBackPress = () => {
      if (isSelectionMode) {
        // Exit selection mode instead of going back
        setIsSelectionMode(false);
        setSelectedPages([]);
        return true; // Prevent default back behavior
      }
      if (editingSummaryId) {
        // Exit edit mode instead of going back
        console.log('🔙 Back pressed while editing, closing edit box');
        setEditingSummaryId(null);
        setEditInstruction('');
        return true; // Prevent default back behavior
      }
      return false; // Allow default back behavior
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [isSelectionMode, editingSummaryId]);

  // Handle keyboard for summary editing
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const handleKeyboardShow = (event: any) => {
      setSummaryKeyboardHeight(event.endCoordinates?.height ? event.endCoordinates.height + 20 : 0);
    };

    const handleKeyboardHide = () => setSummaryKeyboardHeight(0);

    const showSub = Keyboard.addListener(showEvent, handleKeyboardShow);
    const hideSub = Keyboard.addListener(hideEvent, handleKeyboardHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Initial setup and reset
  useEffect(() => {
    showHeader();
    return () => {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [showHeader]);

  // Initialize Viewer Data from PageCount
  useEffect(() => {
    if (pageCount > 0 && viewerData.length === 0) {
      const initialData: ViewerItemType[] = Array.from({ length: pageCount }, (_, i) => ({
        type: 'pdf',
        pageNo: i + 1
      }));
      setViewerData(initialData);
    }
  }, [pageCount, viewerData.length]);

  // Merge summaries into viewerData
  useEffect(() => {
    if (summaries.length > 0 && firebaseReady) {
      setViewerData(prev => {
        // If we haven't initialized yet, don't do anything
        if (prev.length === 0) return prev;

        let newData = [...prev];
        let hasChanges = false;

        summaries.forEach(summary => {
          // Check if this summary is already in viewerData with the correct ID
          const exists = newData.some(item => item.type === 'custom' && item.id === summary.id);
          
          if (!exists) {
             // Check if there's a temporary summary page (with loading or temporary ID)
             // that should be replaced by this permanent summary
             const tempIndex = newData.findIndex(
               item => item.type === 'custom' && 
                       item.id.startsWith('summary-') && 
                       !item.isLoading
             );
             
             const pageNo = summary.summaryForPdfPageNo;
             const insertIndex = newData.findIndex(item => item.type === 'pdf' && item.pageNo === pageNo);
             const newItem: ViewerItemType = {
               type: 'custom',
               text: summary.summary,
               id: summary.id,
               isLoading: false
             };

             if (tempIndex !== -1) {
               // Replace temporary page with permanent one
               newData[tempIndex] = newItem;
             } else if (insertIndex !== -1) {
               // Insert at the correct position
               newData.splice(insertIndex, 0, newItem);
             } else {
               // If page not found (maybe at end), append
               newData.push(newItem);
             }
             hasChanges = true;
          }
        });

        return hasChanges ? newData : prev;
      });
    }
  }, [summaries, viewerData.length, firebaseReady]);

  // Watch selection changes
  useEffect(() => {
    if (selection) {
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
      headerOpacity.value = withTiming(1);
    } else {
      resetInactivityTimer();
    }
  }, [selection, resetInactivityTimer, headerOpacity]);

  // If no file is loaded, go back to picker
  useEffect(() => {
    if (!loading && !filePath) {
      router.replace("/");
    }
  }, [loading, filePath, router]);

  // Reset DB state when loading new file
  useEffect(() => {
    if (loading) {
      setDbLoaded(false);
      setPdfId(null);
      setFirebaseReady(false);
    }
  }, [loading]);

  // Initialize PDF immediately, fetch DB data in background
  useEffect(() => {
    if (filePath && fileName) {
      let active = true;

      console.log('📁 Initializing PDF:', { filePath, fileName });

      // Show PDF immediately at page 1
      setInitialPage(1);
      currentPageRef.current = 1;
      setDbLoaded(true);

      // Fetch DB data in background
      if (!loading) {
        (async () => {
          try {
            console.log('🔍 Searching for existing PDF:', { filePath, fileName });
            const file = await getPdfFileByPath(filePath, fileName);
            console.log('📄 Search result:', file ? `Found ID: ${file.id}` : 'Not found');
            let id = file?.id;

            if (file) {
              // Update last opened (fire and forget)
              console.log('✏️ Updating lastOpened for:', file.id);
              updateLastOpened(file.id).catch(console.error);
              id = file.id;

              // Restore last visited page
              if (file.lastVisitedPageNo && file.lastVisitedPageNo > 1) {
                if (active) {
                  console.log('⬅️ Restoring page:', file.lastVisitedPageNo);
                  setInitialPage(file.lastVisitedPageNo);
                  currentPageRef.current = file.lastVisitedPageNo;
                }
              }
            } else {
              // New file - save it
              console.log('➕ Adding new PDF:', fileName, filePath);
              id = await addPdfFile(fileName, filePath);
              console.log('✅ New PDF ID:', id);
            }

            if (active && id) {
              console.log('✅ Setting pdfId:', id);
              setPdfId(id);
              setFirebaseReady(true);
            }
          } catch (error) {
            console.error("❌ Error initializing PDF in DB:", error);
            if (active) {
              // Even on error, mark as ready so UI works
              setFirebaseReady(true);
            }
          }
        })();
      }
      return () => { active = false; };
    }
  }, [filePath, fileName, loading, getPdfFileByPath, addPdfFile, updateLastOpened]);

  const clearSelection = useCallback(() => {
    setSelection(null);
    clearAllSelections?.();
  }, [clearAllSelections]);

  const handleCopy = async () => {
    if (selection) {
      await Clipboard.setStringAsync(selection.text);
      clearSelection();
      if (Platform.OS === 'android') {
         // Android doesn't always show toast on copy automatically like iOS 
         Alert.alert("Copied", "Text copied to clipboard");
      }
    }
  };

  const handleHighlight = async () => {
    if (selection && pdfId) {
      try {
        await addHighlight(
          selection.pageNo,
          selection.start,
          selection.end,
          highlightColor,
          selection.text
        );
        clearSelection();
      } catch (error) {
        console.error("Failed to add highlight", error);
      }
    }
  };

  const handleHighlightClick = useCallback((event: any) => {
    const { id } = event.nativeEvent;
    Alert.alert(
      "Remove Highlight",
      "Do you want to remove this highlight?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteHighlight(id);
            } catch (error) {
              console.error("Failed to delete highlight", error);
            }
          }
        }
      ]
    );
  }, [deleteHighlight]);

  const handleMarkdownLinkPress = useCallback(({ url }: { url: string }) => {
    Linking.openURL(url).catch((error) => {
      console.error("Failed to open markdown link:", error);
    });
  }, []);

  const togglePageSelection = useCallback((page: number) => {
    setSelectedPages(prev => {
      if (prev.includes(page)) {
        return prev.filter(p => p !== page);
      } else {
        return [...prev, page];
      }
    });
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: withTiming(headerOpacity.value === 0 ? -headerHeight : 0) }]
  }));

  const renderHeader = () => {
    return (
      <Animated.View style={[styles.header, headerStyle, { height: headerHeight, paddingTop: insets.top, backgroundColor: 'rgba(255,255,255,0.95)', borderBottomColor: "transparent" }]}>
          <View style={styles.headerContent}>
            {isSelectionMode ? (
              <View style={[styles.selectionHeader, { backgroundColor: colors.surfaceSecondary }]}>
                <TouchableOpacity onPress={() => {
                  setIsSelectionMode(false);
                  setSelectedPages([]);
                }} style={styles.iconButton}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>{selectedPages.length} Selected</Text>
                <View style={{ width: 40 }} />
              </View>
            ) : selection ? (
              <View style={[styles.selectionHeader, { backgroundColor: colors.surfaceSecondary }]}>
                <TouchableOpacity onPress={clearSelection} style={styles.iconButton}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.actionButtons}>
                  <TouchableOpacity onPress={handleCopy} style={styles.iconButton}>
                    <Ionicons name="copy-outline" size={24} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      if (selection) {
                        setChatInitialQuery(`Tell me more about this text from page ${selection.pageNo}: "${selection.text}"`);
                        setIsChatOpen(true);
                        clearSelection();
                      }
                    }}
                    style={styles.iconButton}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={24} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowColorPicker(true)} style={styles.iconButton}>
                    <Ionicons name="color-palette-outline" size={24} color={colors.text} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleHighlight} style={styles.iconButton}>
                    <AntDesign name="highlight" size={24} color={colors.text} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.normalHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={24} color={colors.primary} />
                  <Text style={[styles.backText, { color: colors.primary }]}>Back</Text>
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>{fileName}</Text>
                <View style={{ width: 60 }} />
              </View>
            )}
          </View>
      </Animated.View>
    );
  };

  const renderItem = useCallback(({ item, width }: { item: ViewerItemType; width: number }) => {
    if (item.type === 'custom') {
      // Find the summary in the summaries array to get forPages
      const summaryData = summaries.find(s => s.id === item.id);
      const isEditing = editingSummaryId === item.id;
      
      return (
        <View style={[styles.pageWrapper, { width, minHeight: width, padding: 20 }]}>
          {/* Summary Action Buttons */}
          {!isEditing && !item.isLoading && (
            <View style={styles.summaryActions}>
              <TouchableOpacity
                style={[styles.summaryActionButton, { backgroundColor: colors.error }]}
                onPress={() => handleDeleteSummary(item.id, summaryData?.summaryForPdfPageNo || 0)}
              >
                <Ionicons name="trash-outline" size={18} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.summaryActionButton, { backgroundColor: colors.primary }]}
                onPress={() => setEditingSummaryId(item.id)}
              >
                <Ionicons name="create-outline" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
          
          {item.isLoading ? (
            <SkeletonLoader />
          ) : (
            <>
              <View style={[styles.summaryMarkdownContainer, { backgroundColor: '#FFFFFF', padding: 20 }]}>
                <EnrichedMarkdownText
                  flavor="github"
                  markdown={item.text || ""}
                  markdownStyle={themedSummaryMarkdownStyle}
                  onLinkPress={handleMarkdownLinkPress}
                />
              </View>
              
              {/* Edit Input */}
              {isEditing && (
                <View style={[styles.editInstructionContainer, { backgroundColor: colors.surface }]}>
                  <TextInput
                    style={[styles.editInstructionInput, { 
                      backgroundColor: colors.inputBackground, 
                      borderColor: colors.inputBorder,
                      color: colors.text 
                    }]}
                    placeholder="Add instructions (e.g., 'Focus on formulas', 'Make it shorter')..."
                    placeholderTextColor={colors.textTertiary}
                    value={editInstruction}
                    onChangeText={setEditInstruction}
                    multiline
                    autoFocus
                  />
                  <TouchableOpacity
                    style={[styles.editSendButton, { backgroundColor: colors.primary }]}
                    onPress={() => {
                      console.log('✏️ Inline edit send pressed for:', item.id);
                      handleRegenerateSummary(
                        item.id,
                        summaryData?.summaryForPdfPageNo || 0,
                        item.text,
                        summaryData?.forPages
                      );
                    }}
                  >
                    <Ionicons name="send" size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.editCancelButton, { backgroundColor: colors.surfaceSecondary }]}
                    onPress={() => {
                      console.log('✏️ Edit cancelled for:', item.id);
                      setEditingSummaryId(null);
                      setEditInstruction('');
                    }}
                  >
                    <Ionicons name="close" size={20} color={colors.text} />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
          <Text style={styles.pageLabel}>Summary Page</Text>
        </View>
      );
    }

    return (
      <PageItem 
        item={item.pageNo} 
        width={width} 
        highlights={highlights} 
        activeSelectionPage={selection?.pageNo ?? null}
        onSelectionChanged={(pageNo, nativeEvent) => {
           const { selectedText, selectionStart, selectionEnd } = nativeEvent;
           if (selectedText) {
             setSelection({
               text: selectedText,
               pageNo: pageNo,
               start: selectionStart,
               end: selectionEnd
             });
           } else {
             // If selection cleared via tap outside on native side
             if (selection?.pageNo === pageNo) {
                setSelection(null);
             }
           }
        }}
        onPreDefinedHighlightClick={handleHighlightClick}
        isSelectionMode={isSelectionMode}
        isSelected={selectedPages.includes(item.pageNo)}
        onToggleSelect={togglePageSelection}
      />
    );
  }, [highlights, selection, handleHighlightClick, handleMarkdownLinkPress, isSelectionMode, selectedPages, togglePageSelection]);

  const handleExecute = async () => {
    if (selectedPages.length === 0) return;

    // Sort selected pages to find the first one
    const sortedPages = [...selectedPages].sort((a, b) => a - b);
    const firstPage = sortedPages[0];

    // Create new custom page item with loading state
    const newPageId = `summary-${Date.now()}`;
    const newPage: ViewerItemType = {
      type: 'custom',
      text: '',
      id: newPageId,
      isLoading: true
    };

    // Insert immediately to show loading
    setViewerData(prev => {
      const newData = [...prev];
      const insertIndex = newData.findIndex(
        item => item.type === 'pdf' && item.pageNo === firstPage
      );

      if (insertIndex !== -1) {
        newData.splice(insertIndex, 0, newPage);
      } else {
         newData.unshift(newPage);
      }
      return newData;
    });

    // Reset selection mode
    setIsSelectionMode(false);
    setSelectedPages([]);

    try {
      // Fetch bitmaps for all selected pages
      const bitmaps = await Promise.all(
        sortedPages.map(page => RnPdfKing.getPageBitmapBase64(page))
      );

      // Show loading state
      setViewerData(prev => prev.map(item =>
        (item.type === 'custom' && item.id === newPageId)
          ? { ...item, text: 'Generating summary...', isLoading: true }
          : item
      ));

      // Generate summary (non-streaming)
      const finalSummary = await generateSummary(bitmaps);

      // Update with final summary
      setViewerData(prev => prev.map(item =>
          (item.type === 'custom' && item.id === newPageId)
            ? { ...item, text: finalSummary, isLoading: false }
            : item
      ));

      // Save to DB
      if (pdfId) {
        await addOrUpdateSummary(firstPage, finalSummary);
        // The summary will be added to viewerData by the useEffect watching summaries
        // No need to manually remove the temporary page as it will be replaced
      }

    } catch (error) {
      console.error("Error executing page extraction:", error);
      Alert.alert("Error", "Failed to generate summary.");

      // Remove the failed page
      setViewerData(prev => prev.filter(item =>
        !(item.type === 'custom' && item.id === newPageId)
      ));
    }
  };

  const handleDeleteSummary = (summaryId: string, summaryPageNo: number) => {
    Alert.alert(
      "Delete Summary",
      "Are you sure you want to delete this summary?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            await deleteSummary(summaryId);
            // Remove from viewer data
            setViewerData(prev => prev.filter(item => (item as any).id !== summaryId));
          },
        },
      ]
    );
  };

  const handleRegenerateSummary = async (
    summaryId: string,
    summaryPageNo: number,
    currentSummaryText: string,
    forPages?: number[]
  ) => {
    // Always allow regeneration - use existing pages if no forPages specified
    const pagesToUse = forPages && forPages.length > 0 
      ? forPages 
      : [summaryPageNo];

    setIsRegeneratingSummary(true);
    setEditingSummaryId(summaryId);

    console.log('🔄 Starting summary regeneration for:', summaryId, 'pages:', pagesToUse);

    // Set summary to loading state
    setViewerData(prev => prev.map(item =>
      (item as any).id === summaryId
        ? { ...item, text: '', isLoading: true }
        : item
    ));

    try {
      // Fetch bitmaps
      console.log('📸 Fetching bitmaps for pages:', pagesToUse);
      const bitmaps = await Promise.all(
        pagesToUse.map(page => RnPdfKing.getPageBitmapBase64(page))
      );
      console.log('✅ Bitmaps fetched:', bitmaps.length);

      // Show loading state
      setViewerData(prev => prev.map(item =>
        (item as any).id === summaryId
          ? { ...item, text: 'Regenerating summary...', isLoading: true }
          : item
      ));

      // Generate new summary with user's instruction (non-streaming)
      console.log('🤖 Generating summary with instruction:', editInstruction.trim());
      const finalSummary = await generateSummary(bitmaps, editInstruction.trim() || undefined);
      console.log('✅ Summary generated, length:', finalSummary.length);

      // Update in DB
      await addOrUpdateSummary(summaryPageNo, finalSummary, pagesToUse);
      console.log('✅ Summary saved to DB');

      // Update viewerData to remove loading state and show new summary
      setViewerData(prev => prev.map(item =>
        (item as any).id === summaryId
          ? { ...item, text: finalSummary, isLoading: false }
          : item
      ));
      console.log('✅ ViewerData updated, isLoading set to false');

      // Reset state
      setEditInstruction('');
      setEditingSummaryId(null);
      setIsRegeneratingSummary(false);
      console.log('✅ Edit mode closed, editingSummaryId set to null');

    } catch (error: any) {
      console.error("❌ Error regenerating summary:", error);
      Alert.alert("Error", "Failed to regenerate summary: " + error.message);
      // Restore previous text on error
      setViewerData(prev => prev.map(item =>
        (item as any).id === summaryId
          ? { ...item, text: currentSummaryText, isLoading: false }
          : item
      ));
      // Reset state on error too
      setEditInstruction('');
      setEditingSummaryId(null);
      setIsRegeneratingSummary(false);
      console.log('✅ Error handler: Edit mode closed');
    }
  };

  const handleChatWithPages = () => {
    if (selectedPages.length === 0) return;
    setIsSelectionMode(false);
    setIsChatOpen(true);
    // Don't clear selectedPages here - they're needed in ChatOverlay
  };

  const handleQuizWithPages = () => {
    if (selectedPages.length === 0) return;
    setIsSelectionMode(false);
    setShowQuizConfig(true);
  };

  const handleGenerateQuiz = async (config: {
    totalQuestions: number;
    optionsPerQuestion: number;
    aiInstruction: string;
  }) => {
    console.log('🚀 Starting quiz generation, config:', config);
    // Set loading state immediately when generation starts
    setIsGeneratingQuiz(true);
    console.log('✅ Set isGeneratingQuiz to true');

    try {
      const sortedPages = [...selectedPages].sort((a, b) => a - b);
      console.log('📄 Selected pages:', sortedPages);
      
      // Fetch bitmaps for all selected pages
      console.log('📸 Fetching bitmaps...');
      const bitmaps = await Promise.all(
        sortedPages.map(page => RnPdfKing.getPageBitmapBase64(page))
      );
      console.log('✅ Bitmaps fetched:', bitmaps.length);

      // Generate quiz
      console.log('🤖 Generating quiz with AI...');
      const quizOutput = await generateQuiz(bitmaps, {
        totalQuestions: config.totalQuestions,
        optionsPerQuestion: config.optionsPerQuestion,
        aiInstruction: config.aiInstruction || undefined,
      });
      console.log('✅ Quiz generated:', quizOutput.title, quizOutput.quizzes.length, 'questions');

      // Save to Firebase
      console.log('💾 Saving to Firebase...');
      const quizId = await addQuiz(
        quizOutput.title,
        sortedPages,
        config.totalQuestions,
        config.optionsPerQuestion,
        config.aiInstruction || undefined,
        quizOutput.quizzes
      );
      console.log('✅ Saved with ID:', quizId);

      // Open quiz overlay
      const newQuiz: Quiz = {
        id: quizId,
        pdfFileId: pdfId!,
        title: quizOutput.title,
        pageReferences: sortedPages,
        totalQuestions: config.totalQuestions,
        optionsPerQuestion: config.optionsPerQuestion,
        aiInstruction: config.aiInstruction || undefined,
        questions: quizOutput.quizzes,
        createdAt: Date.now(),
      };

      setSelectedQuiz(newQuiz);
      setIsQuizOpen(true);
      setSelectedPages([]);
      console.log('✅ Quiz state updated');
      
      // Close config modal AFTER quiz is generated
      setShowQuizConfig(false);
      console.log('✅ Closed config modal');

    } catch (error: any) {
      console.error("❌ Error generating quiz:", error);
      Alert.alert("Error", "Failed to generate quiz. Please try again.");
    } finally {
      // Always reset loading state
      setIsGeneratingQuiz(false);
      console.log('✅ Reset isGeneratingQuiz to false');
    }
  };

  const handleNavigateToPage = useCallback((page: number) => {
    // Navigate to the specified page in the viewer
    // Find the index of the page in viewerData (0-based index)
    const index = viewerData.findIndex(item => item.type === 'pdf' && item.pageNo === page);
    console.log('🔍 Navigate to page:', page, 'index:', index, 'viewerData length:', viewerData.length);
    if (index !== -1) {
      // Close chat overlay first
      setIsChatOpen(false);
      // Clear selected pages
      setSelectedPages([]);
      
      // Set the navigate index using ref and force update
      console.log('📍 Setting navigateToPageIndexRef to:', index);
      navigateToPageIndexRef.current = index;
      forceUpdate(n => n + 1);
    }
  }, [viewerData]);

  const handleClearChatReferences = useCallback(() => {
    // Clear selected pages when user dismisses the reference pill
    setSelectedPages([]);
    // Also clear navigation ref
    navigateToPageIndexRef.current = null;
    forceUpdate(n => n + 1);
  }, []);

  if (loading || !dbLoaded) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (pageCount === 0) {
    return (
      <View style={styles.center}>
        <Text style={{ color: '#666' }}>No pages to display</Text>
      </View>
    );
  }

  // Ensure initialPage is valid
  const validInitialIndex = Math.max(0, Math.min(initialPage, pageCount) - 1);
  
  // Use navigateToPageIndexRef if set, otherwise use validInitialIndex
  const effectiveInitialIndex = navigateToPageIndexRef.current !== null ? navigateToPageIndexRef.current : validInitialIndex;
  console.log('📍 effectiveInitialIndex:', effectiveInitialIndex, 'navigateToPageIndexRef:', navigateToPageIndexRef.current, 'validInitialIndex:', validInitialIndex);

  const onSelectColor = ({ hex }: { hex: string }) => {
    'worklet';
    runOnJS(setHighlightColor)(hex);
  };
  
  // Custom Color Picker Modal Content
  const renderColorPickerModal = () => (
    <Modal 
      visible={showColorPicker} 
      animationType="fade" 
      transparent={true}
      onRequestClose={() => setShowColorPicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.colorPickerContainer}>
          <Text style={styles.modalTitle}>Pick Highlight Color</Text>
          
          <ColorPicker 
            style={{ width: '100%', gap: 20 }} 
            value={highlightColor}
            onComplete={onSelectColor}
          >
            <Preview />
            <Panel1 />
            <HueSlider />
            <OpacitySlider />
            <Swatches colors={['#FFEB3B80', '#FF000080', '#00FF0080', '#0000FF80', '#FFA50080', '#80008080']} />
          </ColorPicker>

          <TouchableOpacity 
            style={styles.closeButton} 
            onPress={() => {
              handleHighlight();
              setShowColorPicker(false);
            }}
          >
            <Text style={styles.closeButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {renderHeader()}
      {renderColorPickerModal()}
      
      <ZoomableList
          data={viewerData}
          renderItem={renderItem}
          keyExtractor={(item: ViewerItemType, index: number) => {
             if (item.type === 'pdf') return `pdf-${item.pageNo}`;
             return item.id;
          }}
          scrollEnabled={!selection}
          pageSliderEnabled
          pageSliderLabel={(current, total) => `${current}/${total}`}
          pageSliderLogo={<GripHorizontal size={20} color="#666" />}
          onScrollPageNumberChanged={(pageIndex) => {
            // pageIndex is 1-based index from the list
            // We need to map it to the actual PDF page number if possible
            const item = viewerData[pageIndex - 1];

            if (pageIndex < currentPageRef.current) {
              showHeader();
            }

            // Only update DB if it's a PDF page
            if (item && item.type === 'pdf') {
               currentPageRef.current = item.pageNo;
            }
          }}
          onMomentumScrollEnd={() => {
            if (pdfId && viewerData.length > 0) {
               // We use the last known PDF page
               updatePageNumberOnly(pdfId, currentPageRef.current);
            }
          }}
          initialScrollIndex={effectiveInitialIndex}
          key={navigateToPageIndexRef.current !== null ? `${pdfId || 'loading'}-nav-${navigateToPageIndexRef.current}` : (pdfId || 'loading')}
          onTouchStart={() => {
            if (!selection) showHeader();
          }}
      />
      
      {isSelectionMode ? (
        <View style={styles.fabContainer}>
          <FAB
            icon="text-box-outline"
            label="Summarize"
            style={[styles.fabVertical, styles.fabSummarize]}
            onPress={handleExecute}
            visible={selectedPages.length > 0}
          />
          <FAB
            icon="chat-outline"
            label="Chat"
            style={[styles.fabVertical, styles.fabChat]}
            onPress={handleChatWithPages}
            visible={selectedPages.length > 0}
          />
          <FAB
            icon="school-outline"
            label="Quiz"
            style={[styles.fabVertical, styles.fabQuiz]}
            onPress={handleQuizWithPages}
            visible={selectedPages.length > 0}
          />
        </View>
      ) : (
        <Portal>
          <FAB.Group
            open={fabOpen}
            icon={fabOpen ? 'close' : 'plus'}
            actions={[

              {
                icon: 'chat-outline',
                label: 'Chat',
                onPress: () => {
                   setChatInitialQuery('');
                   setIsChatOpen(true);
                },
              },
             
              {
                icon: 'school-outline',
                label: quizs.length > 0 ? `Quiz (${quizs.length})` : 'Quiz',
                onPress: () => {
                  if (quizs.length === 0) {
                    // No quizzes yet, show hint to select pages
                    Alert.alert(
                      'Create a Quiz',
                      'Select pages first, then tap Quiz to generate a quiz from those pages.',
                      [{ text: 'OK', onPress: () => setIsSelectionMode(true) }]
                    );
                  } else {
                    // Show list of saved quizzes
                    setShowQuizList(true);
                  }
                },
              },
              {
                icon: 'file-document-outline',
                label: 'Select Pages',
                onPress: () => setIsSelectionMode(true),
              },
            ]}
            onStateChange={({ open }) => setFabOpen(open)}
            visible={true}
            fabStyle={{ backgroundColor: '#007AFF' }}
            color="white"
          />
        </Portal>
      )}

      <ChatOverlay
        isVisible={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setSelectedPages([]);
        }}
        pdfId={pdfId}
        currentPage={currentPageRef.current}
        pageCount={pageCount}
        initialQuery={chatInitialQuery}
        selectedPages={selectedPages}
        onNavigateToPage={handleNavigateToPage}
        onClearReferences={handleClearChatReferences}
      />

      <QuizConfigModal
        visible={showQuizConfig}
        onClose={() => setShowQuizConfig(false)}
        onSubmit={handleGenerateQuiz}
        loading={isGeneratingQuiz}
      />

      <QuizOverlay
        visible={isQuizOpen}
        quiz={selectedQuiz}
        onClose={() => {
          setIsQuizOpen(false);
          setSelectedQuiz(null);
        }}
        onSaveScore={async (score: number) => {
          if (selectedQuiz) {
            await updateQuizScore(selectedQuiz.id, score);
            // Update local state to reflect the new score
            setSelectedQuiz({
              ...selectedQuiz,
              lastScore: score,
              lastAttemptedAt: Date.now(),
            });
          }
        }}
      />

      <QuizListOverlay
        visible={showQuizList}
        onClose={() => setShowQuizList(false)}
        quizzes={quizs}
        onSelectQuiz={(quiz) => {
          setShowQuizList(false);
          setSelectedQuiz(quiz);
          setIsQuizOpen(true);
        }}
      />

      {/* Summary Edit Input Bar (at bottom when editing) */}
      {editingSummaryId && (
        <View style={[
          styles.summaryEditBar,
          { 
            paddingBottom: summaryKeyboardHeight > 0 ? summaryKeyboardHeight + 16 : Math.max(insets.bottom, 16),
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
          }
        ]}>
          <View style={[styles.summaryEditInputWrapper, { backgroundColor: colors.inputBackground, borderColor: colors.inputBorder }]}>
            <TextInput
              style={[styles.summaryEditInput, { color: colors.text }]}
              placeholder="Add instructions for regenerating summary..."
              placeholderTextColor={colors.textTertiary}
              value={editInstruction}
              onChangeText={setEditInstruction}
              multiline
              onSubmitEditing={() => {
                // Find the summary being edited and regenerate
                const summaryData = summaries.find(s => s.id === editingSummaryId);
                if (summaryData) {
                  const viewerItem = viewerData.find(item => (item as any).id === editingSummaryId);
                  if (viewerItem && viewerItem.type === 'custom') {
                    handleRegenerateSummary(
                      editingSummaryId,
                      summaryData.summaryForPdfPageNo,
                      viewerItem.text,
                      summaryData.forPages
                    );
                  }
                }
              }}
            />
            <TouchableOpacity
              onPress={() => {
                console.log('📍 Bottom bar send pressed for:', editingSummaryId);
                // Find the summary being edited and regenerate
                const summaryData = summaries.find(s => s.id === editingSummaryId);
                if (summaryData) {
                  const viewerItem = viewerData.find(item => (item as any).id === editingSummaryId);
                  if (viewerItem && viewerItem.type === 'custom') {
                    console.log('📝 Found summary, regenerating...');
                    handleRegenerateSummary(
                      editingSummaryId,
                      summaryData.summaryForPdfPageNo,
                      viewerItem.text,
                      summaryData.forPages
                    );
                  } else {
                    console.error('❌ Viewer item not found or not custom type');
                  }
                } else {
                  console.error('❌ Summary data not found for:', editingSummaryId);
                }
              }}
              style={[styles.summaryEditSendButton, !editInstruction.trim() && { backgroundColor: colors.inputBorder }]}
              disabled={!editInstruction.trim() || isRegeneratingSummary}
            >
              {isRegeneratingSummary ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="arrow-up" size={20} color="#fff" />
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  fabContainer: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    zIndex: 1000,
    gap: 12,
  },
  fabVertical: {
    marginBottom: 0,
  },
  fabSummarize: {
    backgroundColor: '#007AFF',
  },
  fabChat: {
    backgroundColor: '#34C759',
  },
  fabQuiz: {
    backgroundColor: '#FF9500',
  },
  checkboxContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    zIndex: 10,
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderRadius: 4,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(255,255,255,0.95)',
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  headerContent: {
    height: 44,
    justifyContent: 'center',
  },
  normalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  selectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    backgroundColor: '#f8f9fa',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 60,
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
    marginLeft: -4,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    flex: 1,
    textAlign: 'center',
  },
  iconButton: {
    padding: 8,
  },
  actionButtons: {
    flexDirection: 'row',
  },
  pageWrapper: {
    marginBottom: 20,
    overflow: "hidden",
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  pageLabel: {
    textAlign: "center",
    marginVertical: 12,
    fontSize: 14,
    color: "#666",
  },
  summaryMarkdownContainer: {
    flexShrink: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  colorPickerContainer: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 20,
  },
  closeButton: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: '600',
  },
  summaryActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryActionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editInstructionContainer: {
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  editInstructionInput: {
    flex: 1,
    minHeight: 60,
    maxHeight: 120,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  editSendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  editCancelButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  summaryEditBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  summaryEditInputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
  },
  summaryEditInput: {
    flex: 1,
    maxHeight: 120,
    fontSize: 16,
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
  },
  summaryEditSendButton: {
    backgroundColor: '#007AFF',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
});
