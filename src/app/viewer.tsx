import React, { useState, useLayoutEffect, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import {
  usePdfDocument,
  ZoomableList,
  ZoomablePdfPage,
} from "rn-pdf-king";
import { usePdfActions, useHighlights } from "../db";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay, 
  cancelAnimation,
  runOnJS 
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

export default function ViewerPage() {
  const navigation = useNavigation();
  const router = useRouter();
  const { loading, pageCount, filePath, fileName } = usePdfDocument();
  
  const { getPdfFileByPath, addPdfFile, updateLastOpened, updatePageNumberOnly } = usePdfActions();
  const [dbLoaded, setDbLoaded] = useState(false);
  const [initialPage, setInitialPage] = useState(1);
  const [pdfId, setPdfId] = useState<string | null>(null);
  
  const currentPageRef = useRef(1);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection state
  const [selection, setSelection] = useState<{
    text: string;
    pageNo: number;
    start: number;
    end: number;
  } | null>(null);

  // Used to clear selection by toggling selectionEnabled
  const [isSelectionEnabled, setIsSelectionEnabled] = useState(true);

  const [highlightColor, setHighlightColor] = useState('rgba(0, 0, 255, 0.3)'); // Default to blue
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Header animation
  const headerOpacity = useSharedValue(1);
  const inactivityTimer = useRef<NodeJS.Timeout | null>(null);

  // Database hooks
  const { highlights, addHighlight, deleteHighlight } = useHighlights(pdfId || "");
  
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
  }, [headerOpacity]);

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
  }, [loading, filePath]);

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
            setCurrentPage(page);
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
    setIsSelectionEnabled(false);
    // Re-enable after a short delay to allow UI to update and native selection to clear
    setTimeout(() => {
      setIsSelectionEnabled(true);
    }, 100);
  }, []);

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

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: withTiming(headerOpacity.value === 0 ? -headerHeight : 0) }]
  }));

  const renderHeader = () => {
    return (
      <Animated.View style={[styles.header, headerStyle, { height: headerHeight, paddingTop: insets.top }]}>
          <View style={styles.headerContent}>
            {selection ? (
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

  const renderItem = ({ item, width }: { item: number; width: number }) => {
    const itemHeight = width * 1.414;
    // Filter highlights for this page
    const pageHighlights = highlights
      .filter(h => h.pageNo === item)
      .map(h => ({
        id: h.id,
        startIndex: h.startIndex,
        endIndex: h.endIndex,
        color: h.color,
      }));

    return (
      <View style={[styles.pageWrapper, { width, height: itemHeight }]}>
        <ZoomablePdfPage
            pageNo={item}
            width={width}
            height={itemHeight}
            preDefinedHighlights={pageHighlights}
            handleColor="blue"
            selectionColor="rgba(0, 0, 255, 0.3)"
            onSelectionStarted={() => {
              // Optional: Clear timer or just rely on onSelectionChanged
            }}
            onSelectionEnded={() => {
               // Usually we want to keep selection until user dismisses or selects elsewhere
            }}
            onPreDefinedHighlightClick={handleHighlightClick}
            selectionEnabled={isSelectionEnabled}
            // @ts-ignore: Assuming ZoomablePdfPage supports this event based on prompt
            onSelectionChanged={(event) => {
              const { selectedText, selectionStart, selectionEnd } = event.nativeEvent;
              if (selectedText) {
                setSelection({
                  text: selectedText,
                  pageNo: item,
                  start: selectionStart,
                  end: selectionEnd
                });
              } else {
                setSelection(null);
              }
            }}
        />
        <Text style={styles.pageLabel}>Page {item}</Text>
      </View>
    );
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
          data={Array.from({ length: pageCount }, (_, i) => i + 1)}
          renderItem={renderItem}
          estimatedItemSize={500}
          keyExtractor={(item) => item.toString()}
          scrollEnabled={!selection} // Disable scroll when selecting? User didn't specify but usually good.
          pageSliderEnabled
          pageSliderLabel={(current, total) => `${current}/${total}`}
          pageSliderLogo={<GripHorizontal size={20} color="#666" />}
          onScrollPageNumberChanged={(page) => {
            currentPageRef.current = page;
            setCurrentPage(page);
            showHeader(); // Show header on page change
          }}
          onMomentumScrollEnd={() => {
            if (pdfId) {
              updatePageNumberOnly(pdfId, currentPageRef.current);
            }
          }}
          initialScrollIndex={validInitialIndex}
          key={pdfId || 'loading'}
          onTouchStart={() => {
            if (!selection) showHeader();
          }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
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
