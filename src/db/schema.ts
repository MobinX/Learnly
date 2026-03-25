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
  threadId?: string;
  pageReferences?: number[];
}

export interface SummaryVirtualPage {
  id: string;
  pdfFileId: string;
  summaryForPdfPageNo: number;
  summary: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correctOption: string;
  explanation: string;
}

export interface Quiz {
  id: string;
  pdfFileId: string;
  title: string;
  pageReferences: number[];
  totalQuestions: number;
  optionsPerQuestion: number;
  aiInstruction?: string;
  questions: QuizQuestion[];
  createdAt: number;
  lastScore?: number; // Last score percentage (0-100)
  lastAttemptedAt?: number; // Timestamp of last attempt
}

export enum TableNames {
  PDF_FILES = 'pdf_files',
  HIGHLIGHTS = 'highlights',
  CHATS = 'chats',
  SUMMARY_VIRTUAL_PAGES = 'summary_virtual_pages',
  QUIZZES = 'quizzes',
}
