# Database Module

This module provides a SQLite database implementation for storing PDFs, Highlights, Chats, and Summaries.

## Setup

Wrap your application root with `DatabaseProvider`:

```tsx
import { DatabaseProvider } from './src/db';

export default function App() {
  return (
    <DatabaseProvider>
      <Slot />
    </DatabaseProvider>
  );
}
```

## Usage

Use the custom hooks to interact with the database. These hooks are reactive and will automatically re-render your components when data changes.

### PDFs

```tsx
import { usePdfFiles } from './src/db';

const { pdfFiles, addPdfFile, deletePdfFile } = usePdfFiles();

// Add a file
await addPdfFile('My Document', '/path/to/file.pdf');

// List files
{pdfFiles.map(file => <Text>{file.name}</Text>)}
```

### Highlights

```tsx
import { useHighlights } from './src/db';

const { highlights, addHighlight } = useHighlights(pdfId);
```

### Chats

```tsx
import { useChats } from './src/db';

const { messages, addMessage } = useChats(pdfId, threadId);
```

### Summaries

```tsx
import { useSummaries } from './src/db';

const { summaries, addOrUpdateSummary } = useSummaries(pdfId);
```
