export interface PdfFile {
  id: string;
  name: string;
  path: string;
  lastOpened: number; // timestamp
  lastVisitedPageNo: number;
}

export interface Highlight {
  id: string;
  pdfFileId: string;
  pageNo: number;
  startIndex: number;
  endIndex: number;
  color: string;
  text: string;
  relatedChatId?: string; // Links to a chat thread
}

export type SenderType = 'AI' | 'Human';

export interface Chat {
  id: string;
  pdfFileId: string;
  sender: SenderType;
  messageText: string;
  timestamp: number;
  threadId?: string; // Groups messages into a conversation
}

export interface SummaryVirtualPage {
  id: string;
  pdfFileId: string;
  summaryForPdfPageNo: number;
  summary: string;
}

export enum TableNames {
  PDF_FILES = 'pdf_files',
  HIGHLIGHTS = 'highlights',
  CHATS = 'chats',
  SUMMARY_VIRTUAL_PAGES = 'summary_virtual_pages',
}
