import { Stack, router, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PdfDocumentProvider } from 'rn-pdf-king';
import { useEffect } from 'react';
import { navigationTarget } from '../navigation_state';
import { DatabaseProvider } from '../db';
import { PaperProvider } from 'react-native-paper';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  
  const themeColors = {
    headerBackground: isDark ? '#1C1C1E' : '#fff',
    headerTintColor: isDark ? '#fff' : '#333',
  };

  // Handle accidental navigation to unmatched routes (like intent URIs)
  useEffect(() => {
    if (pathname && pathname !== '/' && pathname !== '/viewer' && !pathname.includes('viewer')) {
      router.replace('/');
    }
  }, [pathname]);

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
      </PaperProvider>
    </GestureHandlerRootView>
  );
}
