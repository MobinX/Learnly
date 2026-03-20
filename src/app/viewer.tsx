import React, { useState, useLayoutEffect, useEffect, useRef, useCallback } from "react";
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
} from "react-native";
import { FAB, ActivityIndicator } from 'react-native-paper';
import { useNavigation, useRouter } from "expo-router";
import RnPdfKing, {
  usePdfDocument,
  ZoomableList,
  ZoomablePdfPage,
  PdfPageHandle,
} from "rn-pdf-king";
import { usePdfActions, useHighlights, useSummaries } from "../db";
import { useGenerateSummary } from "../hooks/useGenerateSummary";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  cancelAnimation,
  runOnJS,
  withRepeat
} from "react-native-reanimated";
import * as Clipboard from 'expo-clipboard';
import { Ionicons, AntDesign } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ColorPicker, { Panel1, Swatches, Preview, OpacitySlider, HueSlider } from 'reanimated-color-picker';

const HEADER_HEIGHT = 60;

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
  
  const { getPdfFileByPath, addPdfFile, updateLastOpened, updatePageNumberOnly } = usePdfActions();
  const [dbLoaded, setDbLoaded] = useState(false);
  const [initialPage, setInitialPage] = useState(1);
  const [pdfId, setPdfId] = useState<string | null>(null);
  
  // Custom Data Source
  const [viewerData, setViewerData] = useState<ViewerItemType[]>([]);

  const currentPageRef = useRef(1);

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

  const [highlightColor, setHighlightColor] = useState('rgba(0, 0, 255, 0.3)'); // Default to blue
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Header animation
  const headerOpacity = useSharedValue(1);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Database hooks
  const { highlights, addHighlight, deleteHighlight } = useHighlights(pdfId || "");
  const { summaries, addOrUpdateSummary } = useSummaries(pdfId || "");
  const { generateSummary } = useGenerateSummary();
  
  const insets = useSafeAreaInsets();
  const headerHeight = HEADER_HEIGHT + insets.top;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  const showHeader = useCallback(() => {
    cancelAnimation(headerOpacity);
    headerOpacity.value = withTiming(1, { duration: 300 });
    resetInactivityTimer();
  }, [headerOpacity, resetInactivityTimer]);

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
    if (summaries.length > 0) {
      setViewerData(prev => {
        // If we haven't initialized yet, don't do anything
        if (prev.length === 0) return prev;

        let newData = [...prev];
        let hasChanges = false;
        
        summaries.forEach(summary => {
          // Check if this summary is already in viewerData
          const exists = newData.some(item => item.type === 'custom' && item.id === summary.id);
          if (!exists) {
             // Insert it
             const pageNo = summary.summaryForPdfPageNo;
             const insertIndex = newData.findIndex(item => item.type === 'pdf' && item.pageNo === pageNo);
             const newItem: ViewerItemType = {
               type: 'custom',
               text: summary.summary,
               id: summary.id,
               isLoading: false
             };
             
             if (insertIndex !== -1) {
               newData.splice(insertIndex, 0, newItem);
             } else {
               // If page not found (maybe at end), append?
               newData.push(newItem);
             }
             hasChanges = true;
          }
        });
        
        return hasChanges ? newData : prev;
      });
    }
  }, [summaries, viewerData.length]);

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
    }
  }, [loading]);

  useEffect(() => {
    if (filePath && fileName && !loading) {
      let active = true;
      (async () => {
        try {
          const file = await getPdfFileByPath(filePath);
          let id = file?.id;
          let page = file?.lastVisitedPageNo || 1;

          if (file) {
            await updateLastOpened(file.id);
            id = file.id;
          } else {
            id = await addPdfFile(fileName, filePath);
          }
          
          if (active && id) {
            setPdfId(id);
            setInitialPage(page);
            currentPageRef.current = page;
            setDbLoaded(true);
          }
        } catch (error) {
          console.error("Error initializing PDF in DB:", error);
          if (active) {
            setInitialPage(1);
            setDbLoaded(true);
          }
        }
      })();
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
      <Animated.View style={[styles.header, headerStyle, { height: headerHeight, paddingTop: insets.top }]}>
          <View style={styles.headerContent}>
            {isSelectionMode ? (
              <View style={styles.selectionHeader}>
                <TouchableOpacity onPress={() => {
                  setIsSelectionMode(false);
                  setSelectedPages([]);
                }} style={styles.iconButton}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>{selectedPages.length} Selected</Text>
                <View style={{ width: 40 }} />
              </View>
            ) : selection ? (
              <View style={styles.selectionHeader}>
                <TouchableOpacity onPress={clearSelection} style={styles.iconButton}>
                  <Ionicons name="close" size={24} color="#333" />
                </TouchableOpacity>
                <View style={styles.actionButtons}>
                  <TouchableOpacity onPress={handleCopy} style={styles.iconButton}>
                    <Ionicons name="copy-outline" size={24} color="#333" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowColorPicker(true)} style={styles.iconButton}>
                    <Ionicons name="color-palette-outline" size={24} color={highlightColor} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleHighlight} style={styles.iconButton}>
                    <AntDesign name="highlight" size={24} color={highlightColor} />
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <View style={styles.normalHeader}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                  <Ionicons name="chevron-back" size={24} color="#007AFF" />
                  <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>
                <Text style={styles.title} numberOfLines={1}>{fileName}</Text>
                <View style={{ width: 60 }} />
              </View>
            )}
          </View>
      </Animated.View>
    );
  };

  const renderItem = useCallback(({ item, width }: { item: ViewerItemType; width: number }) => {
    if (item.type === 'custom') {
      return (
        <View style={[styles.pageWrapper, { width, minHeight: width, padding: 20 }]}>
          {item.isLoading ? (
            <SkeletonLoader />
          ) : (
            <Text style={{ fontSize: 16, lineHeight: 24 }}>{item.text}</Text>
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
  }, [highlights, selection, handleHighlightClick, isSelectionMode, selectedPages, togglePageSelection]);

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
      
      let finalSummary = "";
      
      // Generate summary with streaming
      await generateSummary(bitmaps, (text) => {
        finalSummary = text;
        setViewerData(prev => prev.map(item => 
          (item.type === 'custom' && item.id === newPageId) 
            ? { ...item, text: text } 
            : item
        ));
      });

      // Final update to remove loading state
      setViewerData(prev => prev.map(item => 
          (item.type === 'custom' && item.id === newPageId) 
            ? { ...item, text: finalSummary, isLoading: false } 
            : item
      ));

      // Save to DB
      if (pdfId) {
        await addOrUpdateSummary(firstPage, finalSummary);
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

  if (loading || !dbLoaded || !pdfId) {
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
  // Note: with custom pages, initialPage logic might need adjustment if we wanted to deep link to a specific item index
  // But for now keeping it simple based on PDF page count
  const validInitialIndex = Math.max(0, Math.min(initialPage, pageCount) - 1);

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
          estimatedItemSize={500}
          keyExtractor={(item: ViewerItemType, index: number) => {
             if (item.type === 'pdf') return `pdf-${item.pageNo}`;
             return item.id;
          }}
          scrollEnabled={!selection} // Disable scroll when selecting? User didn't specify but usually good.
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
          initialScrollIndex={validInitialIndex}
          key={pdfId || 'loading'}
          onTouchStart={() => {
            if (!selection) showHeader();
          }}
      />
      <FAB
        icon={isSelectionMode ? "check" : "check-circle-outline"}
        label={isSelectionMode ? "Execute" : "Select Page"}
        style={styles.fab}
        onPress={() => {
          if (isSelectionMode) {
            handleExecute();
          } else {
            setIsSelectionMode(true);
          }
        }}
        visible={!isSelectionMode || (isSelectionMode && selectedPages.length > 0)}
      />
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
});
