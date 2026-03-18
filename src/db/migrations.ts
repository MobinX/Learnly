export const MIGRATIONS = [
  `
  CREATE TABLE IF NOT EXISTS pdf_files (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    path TEXT NOT NULL,
    lastOpened INTEGER NOT NULL,
    lastVisitedPageNo INTEGER DEFAULT 1
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS highlights (
    id TEXT PRIMARY KEY NOT NULL,
    pdfFileId TEXT NOT NULL,
    pageNo INTEGER NOT NULL,
    startIndex INTEGER NOT NULL,
    endIndex INTEGER NOT NULL,
    color TEXT NOT NULL,
    text TEXT NOT NULL,
    relatedChatId TEXT,
    FOREIGN KEY(pdfFileId) REFERENCES pdf_files(id) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY NOT NULL,
    pdfFileId TEXT NOT NULL,
    sender TEXT CHECK(sender IN ('AI', 'Human')) NOT NULL,
    messageText TEXT NOT NULL,
    timestamp INTEGER NOT NULL,
    threadId TEXT,
    FOREIGN KEY(pdfFileId) REFERENCES pdf_files(id) ON DELETE CASCADE
  );
  `,
  `
  CREATE TABLE IF NOT EXISTS summary_virtual_pages (
    id TEXT PRIMARY KEY NOT NULL,
    pdfFileId TEXT NOT NULL,
    summaryForPdfPageNo INTEGER NOT NULL,
    summary TEXT NOT NULL,
    FOREIGN KEY(pdfFileId) REFERENCES pdf_files(id) ON DELETE CASCADE
  );
  `
];
