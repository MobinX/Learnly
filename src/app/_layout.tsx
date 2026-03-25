import { Stack, router, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PdfDocumentProvider } from 'rn-pdf-king';
import { useEffect, useState } from 'react';
import { navigationTarget } from '../navigation_state';
import { DatabaseProvider } from '../db';
import { PaperProvider, Portal, Modal, ActivityIndicator, Snackbar, Button } from 'react-native-paper';
import { useColorScheme, View, Text, StyleSheet } from 'react-native';
import * as Updates from 'expo-updates';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

// Configure Google Sign-In with the web client ID from google-services.json
GoogleSignin.configure({
  webClientId: '58399230776-bsfp3ilm78p2b984k3m5p29587rp0qa3.apps.googleusercontent.com',
});

export default function RootLayout() {
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  // Update states
  const [updateDialogVisible, setUpdateDialogVisible] = useState(false);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const {
    currentlyRunning,
    isUpdateAvailable,
    isUpdatePending,
  } = Updates.useUpdates();

  const themeColors = {
    headerBackground: isDark ? '#1C1C1E' : '#fff',
    headerTintColor: isDark ? '#fff' : '#333',
  };

  // Handle update pending - reload the app
  useEffect(() => {
    if (isUpdatePending) {
      console.log('🔄 Update is pending, reloading app...');
      Updates.reloadAsync();
    }
  }, [isUpdatePending]);

  // Show snackbar when app is up to date
  useEffect(() => {
    if (!isUpdateAvailable && !isUpdatePending && currentlyRunning && !currentlyRunning.isEmbeddedLaunch) {
      showSnackbarMessage('App is up to date', 1000);
    }
  }, [currentlyRunning]);

  // Check for updates on mount (only in production builds)
  useEffect(() => {
    const checkAndUpdate = async () => {
      try {
        // Skip update check in development mode
        if (!Updates.isEmbeddedLaunch) {
          console.log('🔧 Development mode - skipping update check');
          return;
        }
        
        console.log('🔍 Checking for updates...');
        setIsCheckingUpdate(true);
        
        const { isAvailable } = await Updates.checkForUpdateAsync();
        console.log('📱 Update available:', isAvailable);
        
        if (isAvailable) {
          setUpdateDialogVisible(true);
        }
        
        setIsCheckingUpdate(false);
      } catch (error) {
        console.error('❌ Error checking for updates:', error);
        setIsCheckingUpdate(false);
      }
    };

    checkAndUpdate();
  }, [currentlyRunning]);

  const handleUpdateNow = async () => {
    try {
      console.log('⬇️ Downloading update...');
      await Updates.fetchUpdateAsync();
      // reloadAsync will be called by the isUpdatePending effect
    } catch (error) {
      console.error('❌ Error downloading update:', error);
      setUpdateDialogVisible(false);
      showSnackbarMessage('Failed to download update', 3000);
    }
  };

  const showSnackbarMessage = (message: string, duration: number = 3000) => {
    setSnackbarMessage(message);
    setShowSnackbar(true);
    setTimeout(() => setShowSnackbar(false), duration);
  };

  // Handle accidental navigation to unmatched routes (like intent URIs)
  useEffect(() => {
    if (pathname && pathname !== '/' && pathname !== '/viewer' && !pathname.includes('viewer')) {
      router.replace('/');
    }
  }, [pathname]);

  // Show whether or not we are running embedded code or an update
  const runTypeMessage = currentlyRunning?.isEmbeddedLaunch
    ? 'This app is running from built-in code'
    : 'This app is running an update';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PaperProvider>
        <DatabaseProvider>
          <PdfDocumentProvider
            onLoadSuccess={() => {
              router.push(navigationTarget.current);
            }}
          >
            <Stack
              screenOptions={{
                headerStyle: { backgroundColor: themeColors.headerBackground },
                headerTintColor: themeColors.headerTintColor,
                headerTitleStyle: { fontWeight: 'bold' },
                contentStyle: { backgroundColor: isDark ? '#000000' : '#F2F2F7' },
              }}
            />
          </PdfDocumentProvider>
        </DatabaseProvider>

        {/* Update Available Modal */}
        <Portal>
          <Modal
            visible={updateDialogVisible}
            onDismiss={() => setUpdateDialogVisible(false)}
            contentContainerStyle={[
              styles.modalContainer,
              { backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF' }
            ]}
          >
            <Text style={[styles.modalTitle, { color: isDark ? '#FFFFFF' : '#000000' }]}>
              Update Available
            </Text>
            <Text style={[styles.modalMessage, { color: isDark ? '#B0B0B0' : '#666666' }]}>
              A new version of Learnly is available. Would you like to update now?
            </Text>
            
            {isUpdatePending ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={themeColors.headerTintColor} />
                <Text style={[styles.loadingText, { color: isDark ? '#B0B0B0' : '#666666' }]}>
                  Downloading update...
                </Text>
                <Text style={[styles.warningText, { color: '#FF9800' }]}>
                  Please do not close the app
                </Text>
              </View>
            ) : (
              <View style={styles.modalActions}>
                <Button
                  mode="outlined"
                  onPress={() => setUpdateDialogVisible(false)}
                  style={styles.modalButton}
                  labelStyle={{ color: isDark ? '#B0B0B0' : '#666666' }}
                >
                  Later
                </Button>
                <Button
                  mode="contained"
                  onPress={handleUpdateNow}
                  style={styles.modalButton}
                  labelStyle={{ color: '#FFFFFF' }}
                >
                  Update Now
                </Button>
              </View>
            )}
          </Modal>

          {/* Snackbar for status messages */}
          <Snackbar
            visible={showSnackbar}
            onDismiss={() => setShowSnackbar(false)}
            duration={4000}
            style={{ backgroundColor: isDark ? '#333' : '#323232' }}
          >
            {snackbarMessage}
          </Snackbar>
        </Portal>
      </PaperProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    padding: 20,
    margin: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    textAlign: 'center',
  },
  warningText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
  },
  modalButton: {
    minWidth: 100,
  },
});
