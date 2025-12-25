
export interface Page {
  id: string;
  documentId: string;
  originalIndex: number;
  imageUrl: string;
  rotation: number; // 0, 90, 180, 270
}

export interface PDFDocument {
  id: string;
  name: string;
  pages: Page[];
  isExpanded: boolean;
  isNote?: boolean;
  noteContent?: string;
  isLoading?: boolean; // Trạng thái đang xử lý file
}

export interface SelectionState {
  activeDocumentId: string | null;
  selectedPageIds: Set<string>;
  selectedDocumentIds: Set<string>; // Mới: Theo dõi các hồ sơ được chọn toàn bộ
  lastFocusedWorkspace: 'main' | 'secondary';
}

export interface AppState {
  documents: PDFDocument[]; // Main workspace
  secondaryDocuments: PDFDocument[]; // Secondary workspace
  secondaryScreenOpen: boolean;
  selection: SelectionState;
  history: {
    past: { documents: PDFDocument[]; secondaryDocuments: PDFDocument[] }[];
    future: { documents: PDFDocument[]; secondaryDocuments: PDFDocument[] }[];
  };
}

export type Action =
  | { type: 'LOAD_DOCUMENTS'; payload: { docs: PDFDocument[]; target: 'main' | 'secondary' } }
  | { type: 'UPDATE_DOCUMENT'; payload: { docId: string; updates: Partial<PDFDocument>; target: 'main' | 'secondary' } }
  | { type: 'UPDATE_PAGE_IMAGE'; payload: { pageId: string; imageUrl: string } }
  | { type: 'LOAD_IMAGES'; payload: { pages: Page[]; target: 'main' | 'secondary'; intoDocId?: string } }
  | { type: 'TOGGLE_SECONDARY_SCREEN' }
  | { type: 'SELECT_PAGE'; payload: { pageId: string; documentId: string; multiSelect: boolean } }
  | { type: 'SELECT_DOCUMENT'; payload: { documentId: string; multiSelect: boolean } }
  | { type: 'SELECT_ALL_PAGES' }
  | { type: 'SET_FOCUS_WORKSPACE'; payload: 'main' | 'secondary' }
  | { type: 'DESELECT_ALL' }
  | { type: 'DELETE_SELECTED_PAGES' }
  | { type: 'SPLIT_SELECTED_PAGES' }
  | { type: 'ROTATE_SELECTED_PAGES'; payload: 'left' | 'right' }
  | { type: 'MOVE_PAGE'; payload: { pageId: string; sourceDocId: string; destDocId: string; newIndex: number } }
  | { type: 'REORDER_DOCUMENTS'; payload: { sourceIndex: number; destIndex: number; listId: 'main' | 'secondary' } }
  | { type: 'MOVE_DOCUMENT'; payload: { sourceIndex: number; destIndex: number; sourceList: 'main' | 'secondary'; destList: 'main' | 'secondary' } }
  | { type: 'RENAME_DOCUMENT'; payload: { id: string; name: string } }
  | { type: 'ADD_ADJACENT_DOCUMENT'; payload: { documentId: string; direction: 'before' | 'after' } }
  | { type: 'SORT_DOCUMENTS'; payload: { target: 'main' | 'secondary' } }
  | { type: 'TOGGLE_DOCUMENT_TYPE'; payload: { id: string } }
  | { type: 'UPDATE_NOTE_CONTENT'; payload: { id: string; content: string } }
  | { type: 'CLEAR_ALL_DOCUMENTS' }
  | { type: 'UNDO' }
  | { type: 'REDO' };
