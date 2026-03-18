import React, { useState, useLayoutEffect, useEffect, useRef, useCallback } from "react";
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import {
  usePdfDocument,
  ZoomableList,
  ZoomablePdfPage,
} from "rn-pdf-king";
import { usePdfActions } from "../db";

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
  const [isSelecting, setIsSelecting] = useState(false);
  
  const { getPdfFileByPath, addPdfFile, updateLastOpened, updatePageNumberOnly } = usePdfActions();
  const [dbLoaded, setDbLoaded] = useState(false);
  const [initialPage, setInitialPage] = useState(1);
  const [pdfId, setPdfId] = useState<string | null>(null);
  
  const currentPageRef = useRef(1);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: fileName || "PDF Viewer",
      headerBackTitle: "Back",
    });
  }, [navigation, fileName]);

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
    if (filePath && fileName && !loading) { // Remove !dbLoaded check, rely on deps
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

  const renderItem = ({ item, width }: { item: number; width: number }) => {
    const itemHeight = width * 1.414;
    const highlights = [
        { id: "h1", startIndex: 0, endIndex: 100, color: "rgba(255, 235, 0, 0.5)" },
        { id: "h2", startIndex: 100, endIndex: 150, color: "#ff000088" },
    ];

    return (
      <View style={[styles.pageWrapper, { width, height: itemHeight }]}>
        <ZoomablePdfPage
            pageNo={item}
            width={width}
            height={itemHeight}
            preDefinedHighlights={highlights}
            handleColor="green"
            selectionColor="rgba(0, 255, 0, 0.3)"
            onSelectionStarted={() => setIsSelecting(true)}
            onSelectionEnded={() => setIsSelecting(false)}
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

  return (
    <View style={styles.container}>
      <ZoomableList
          data={Array.from({ length: pageCount }, (_, i) => i + 1)}
          renderItem={renderItem}
          estimatedItemSize={500}
          keyExtractor={(item) => item.toString()}
          scrollEnabled={!isSelecting}
          pageSliderEnabled
          pageSliderLabel={(current, total) => `${current}/${total}`}
          pageSliderLogo={<GripHorizontal size={20} color="#666" />}
          onScrollPageNumberChanged={(page) => {
            currentPageRef.current = page;
          }}
          onMomentumScrollEnd={() => {
            if (pdfId) {
              updatePageNumberOnly(pdfId, currentPageRef.current);
            }
          }}
          initialScrollIndex={initialPage - 1}
          key={pdfId || 'loading'}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0f0f0",
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
});
