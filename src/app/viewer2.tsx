import { useState } from 'react';
import { View, Text, Button, Image, ScrollView, StyleSheet, TextInput } from 'react-native';
import RnPdfKing, { usePdfDocument } from 'rn-pdf-king';

export default function Viewer2() {
  const { filePath, pageCount } = usePdfDocument();
  const [pageNo, setPageNo] = useState(1);
  const [base64, setBase64] = useState<string | null>(null);
  const [text, setText] = useState<string | null>(null);

  const handleGetBitmap = async () => {
    try {
      const result = await RnPdfKing.getPageBitmapBase64(pageNo);
      setBase64(result);
    } catch (e) {
      console.error(e);
      setText("Error getting bitmap: " + e);
    }
  };

  const handleGetText = async () => {
    try {
      const result = await RnPdfKing.getTextChars(pageNo);
      setText(result);
    } catch (e) {
      console.error(e);
      setText("Error getting text: " + e);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.header}>Viewer 2 (Test Features)</Text>
      <Text>File: {filePath}</Text>
      <Text>Total Pages: {pageCount}</Text>
      
      <View style={styles.controls}>
          <Text>Page No: </Text>
          <TextInput 
            value={pageNo.toString()} 
            onChangeText={(t) => setPageNo(parseInt(t) || 1)} 
            keyboardType="numeric"
            style={styles.input}
          />
      </View>

      <View style={styles.buttonRow}>
        <Button title="Get Bitmap Base64" onPress={handleGetBitmap} />
        <View style={{width: 10}} />
        <Button title="Get Text Chars" onPress={handleGetText} />
      </View>

      {base64 && (
        <View style={styles.result}>
            <Text style={styles.label}>Bitmap Result (Preview):</Text>
            <Image 
                source={{ uri: `data:image/png;base64,${base64}` }} 
                style={{ width: '100%', height: 300, resizeMode: 'contain', borderWidth: 1, borderColor: '#ccc' }} 
            />
            <Text style={{fontSize: 10, color: '#888'}}>Base64 length: {base64.length}</Text>
        </View>
      )}

      {text !== null && (
        <View style={styles.result}>
            <Text style={styles.label}>Text Result:</Text>
            <Text style={styles.textOutput}>{text || "<Empty String>"}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#fff' },
    header: { fontSize: 20, fontWeight: 'bold', marginBottom: 10 },
    controls: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
    input: { borderWidth: 1, borderColor: '#ccc', padding: 5, width: 60, marginLeft: 10, borderRadius: 4 },
    buttonRow: { flexDirection: 'row', marginBottom: 20 },
    result: { marginBottom: 20, padding: 10, backgroundColor: '#f9f9f9', borderRadius: 8, borderWidth: 1, borderColor: '#eee' },
    label: { fontWeight: 'bold', marginBottom: 5 },
    textOutput: { fontFamily: 'monospace', fontSize: 12, backgroundColor: '#eee', padding: 5 }
});
