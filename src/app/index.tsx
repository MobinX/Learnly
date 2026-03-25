import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  Button,
  ActivityIndicator,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import RnPdfKing, { usePdfDocument } from "rn-pdf-king";
import { navigationTarget } from "../navigation_state";
import { useTheme } from "../theme/colors";
import { useAuth } from "../auth/useAuth";
import { GoogleSignInButton } from "../components/GoogleSignInButton";

export default function IndexPage() {
  const router = useRouter();
  const { loading, filePath, pickFile, error } = usePdfDocument();
  const { colors } = useTheme();
  const { user, signInWithGoogle, signInAnonymously, signOut, loading: authLoading } = useAuth();
  const [googleSignInLoading, setGoogleSignInLoading] = useState(false);
  const [anonymousSignInLoading, setAnonymousSignInLoading] = useState(false);
  const [showSignInModal, setShowSignInModal] = useState(false);

  const handlePickFile = () => {
      navigationTarget.current = '/viewer';
      pickFile();
  };

  const handleTestFeatures = () => {
      navigationTarget.current = '/viewer2';
      pickFile();
  };

  const handleGoogleSignIn = async () => {
    try {
      setGoogleSignInLoading(true);
      await signInWithGoogle();
      setShowSignInModal(false);
    } catch (error) {
      console.error('Google Sign-In failed:', error);
    } finally {
      setGoogleSignInLoading(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    try {
      setAnonymousSignInLoading(true);
      await signInAnonymously();
      setShowSignInModal(false);
    } catch (error) {
      console.error('Anonymous Sign-In failed:', error);
    } finally {
      setAnonymousSignInLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Sign Out failed:', error);
    }
  };

  useEffect(() => {
    // Check initial intent on mount (Android only)
    if (Platform.OS === "android") {
      RnPdfKing.checkInitialIntent();
    }
  }, []);

  // Show sign-in modal when auth is loaded and user is not authenticated
  useEffect(() => {
    if (!authLoading && !loading && !user) {
      setShowSignInModal(true);
    }
  }, [authLoading, loading, user]);

  if (loading || authLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.text }]}>
        <Text style={[styles.title, { color: colors.text }]}>Learnly</Text>

        {user ? (
          <>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {user.email ? `Signed in as ${user.email}` : 'Signed in anonymously'}
            </Text>
            <View style={{height: 10}} />
            <Button title="PDF File" onPress={handlePickFile} color={colors.primary} />
            <View style={{height: 10}} />
            <Button title="Sign Out" onPress={handleSignOut} color="#FF3B30" />
          </>
        ) : (
          <>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Select a PDF to Get Started</Text>
            <View style={{height: 20}} />
            <GoogleSignInButton
              onPress={handleGoogleSignIn}
              loading={googleSignInLoading}
            />
            <View style={{height: 16}} />
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>
            <View style={{height: 16}} />
            <Button
              title="Continue Anonymously"
              onPress={handleAnonymousSignIn}
              color={colors.primary}
              disabled={anonymousSignInLoading}
            />
            <View style={{height: 10}} />
          </>
        )}

        {error && <Text style={[styles.error, { color: colors.error }]}>{error}</Text>}
      </View>

      {/* Sign-In Modal */}
      <Modal
        visible={showSignInModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSignInModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Welcome to Learnly</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              Sign in to get started with your learning journey
            </Text>

            <View style={{height: 24}} />

            <GoogleSignInButton
              onPress={handleGoogleSignIn}
              loading={googleSignInLoading}
            />

            <View style={{height: 16}} />

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.dividerLine} />
            </View>

            <View style={{height: 16}} />

            <Button
              title="Continue Anonymously"
              onPress={handleAnonymousSignIn}
              color={colors.primary}
              disabled={anonymousSignInLoading}
            />

            <View style={{height: 20}} />

            <Pressable
              onPress={() => setShowSignInModal(false)}
              style={styles.skipButton}
            >
              <Text style={[styles.skipText, { color: colors.textSecondary }]}>Maybe Later</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
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
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0',
  },
  dividerText: {
    marginHorizontal: 12,
    color: '#8E8E93',
    fontSize: 14,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    padding: 30,
    borderRadius: 20,
    width: '85%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  modalTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
