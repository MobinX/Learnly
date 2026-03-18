import React, { useEffect } from "react";
import {
  StyleSheet,
  View,
  Text,
  Button,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import RnPdfKing, { usePdfDocument } from "rn-pdf-king";
import { navigationTarget } from "../navigation_state";

export default function IndexPage() {
  const router = useRouter();
  const { loading, filePath, pickFile, error } = usePdfDocument();

  const handlePickFile = () => {
      navigationTarget.current = '/viewer';
      pickFile();
  };

  const handleTestFeatures = () => {
      navigationTarget.current = '/viewer2';
      pickFile();
  };

  useEffect(() => {
    // Check initial intent on mount (Android only)
    if (Platform.OS === "android") {
      RnPdfKing.checkInitialIntent();
    }
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading PDF...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>PDF King</Text>
        <Text style={styles.subtitle}>Select a PDF to get started</Text>
        <Button title="Pick PDF File" onPress={handlePickFile} color="#007AFF" />
        <View style={{height: 10}} />
        <Button title="Test Base64Bitmap and getTextChars" onPress={handleTestFeatures} color="#FF9500" />
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#fff",
    padding: 30,
    borderRadius: 16,
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1C1C1E",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#8E8E93",
    marginBottom: 24,
    textAlign: "center",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#8E8E93",
  },
  error: {
    color: "#FF3B30",
    marginTop: 16,
    textAlign: "center",
  },
});
