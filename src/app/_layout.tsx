import { Stack, router, usePathname } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PdfDocumentProvider } from 'rn-pdf-king';
import { useEffect } from 'react';

export default function RootLayout() {
  const pathname = usePathname();

  // Handle accidental navigation to unmatched routes (like intent URIs)
  useEffect(() => {
    if (pathname && pathname !== '/' && pathname !== '/viewer' && !pathname.includes('viewer')) {
      router.replace('/');
    }
  }, [pathname]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PdfDocumentProvider
        onLoadSuccess={() => {
          router.push("/viewer");
        }}
      >
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: '#fff' },
            headerTintColor: '#333',
            headerTitleStyle: { fontWeight: 'bold' },
          }}
        />
      </PdfDocumentProvider>
    </GestureHandlerRootView>
  );
}
