
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { AppState, Action, PDFDocument, Page } from '../types/types';
import { processFile, getSortValue, processImageFile } from '../utils/utils';
import { v4 as uuidv4 } from 'uuid';

const initialState: AppState = {
  documents: [],
  secondaryDocuments: [],
  secondaryScreenOpen: false,
  selection: {
    activeDocumentId: null,
    selectedPageIds: new Set(),
    selectedDocumentIds: new Set(),
    lastFocusedWorkspace: 'main',
  },
  history: {
    past: [],
    future: [],
  },
};

const pushHistory = (state: AppState): AppState => {
  return {
    ...state,
    history: {
      past: [...state.history.past, { documents: state.documents, secondaryDocuments: state.secondaryDocuments }],
      future: [],
    },
  };
};

const sortDocumentsList = (list: PDFDocument[]): PDFDocument[] => {
  return [...list].sort((a, b) => {
    const valA = getSortValue(a.name);
    const valB = getSortValue(b.name);
    if (valA !== valB) return valA - valB;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });
};

const pdfReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'LOAD_DOCUMENTS': {
      const newState = pushHistory(state);
      const { docs, target } = action.payload;
      if (target === 'secondary') {
        const newList = sortDocumentsList([...newState.secondaryDocuments, ...docs]);
        return { ...newState, secondaryDocuments: newList, selection: { ...newState.selection, lastFocusedWorkspace: 'secondary' } };
      }
      const newList = sortDocumentsList([...newState.documents, ...docs]);
      return { ...newState, documents: newList, selection: { ...newState.selection, lastFocusedWorkspace: 'main' } };
    }

    case 'UPDATE_DOCUMENT': {
      const { docId, updates, target } = action.payload;
      const listKey = target === 'secondary' ? 'secondaryDocuments' : 'documents';
      return { ...state, [listKey]: state[listKey].map(doc => doc.id === docId ? { ...doc, ...updates } : doc) };
    }

    case 'UPDATE_PAGE_IMAGE': {
      const { pageId, imageUrl } = action.payload;
      const newState = pushHistory(state);
      const updateDocs = (docs: PDFDocument[]) => docs.map(doc => ({
        ...doc,
        pages: doc.pages.map(p => p.id === pageId ? { ...p, imageUrl } : p)
      }));
      return { 
        ...newState, 
        documents: updateDocs(newState.documents), 
        secondaryDocuments: updateDocs(newState.secondaryDocuments) 
      };
    }

    case 'LOAD_IMAGES': {
      const newState = pushHistory(state);
      const { pages, target, intoDocId } = action.payload;
      const updateList = (docs: PDFDocument[]) => {
        if (intoDocId) {
          return docs.map(doc => {
            if (doc.id === intoDocId) {
              const newPages = [...doc.pages, ...pages.map(p => ({ ...p, documentId: doc.id }))];
              return { ...doc, pages: newPages };
            }
            return doc;
          });
        } else {
          const newDoc: PDFDocument = {
            id: uuidv4(), name: `Ảnh mới_${new Date().getTime()}.pdf`,
            pages: pages.map(p => ({ ...p, documentId: '' })), isExpanded: true
          };
          newDoc.pages.forEach(p => p.documentId = newDoc.id);
          return sortDocumentsList([...docs, newDoc]);
        }
      };
      if (target === 'secondary') return { ...newState, secondaryDocuments: updateList(newState.secondaryDocuments) };
      return { ...newState, documents: updateList(newState.documents) };
    }

    case 'TOGGLE_SECONDARY_SCREEN': return { ...state, secondaryScreenOpen: !state.secondaryScreenOpen };

    case 'SET_FOCUS_WORKSPACE': return { ...state, selection: { ...state.selection, lastFocusedWorkspace: action.payload } };

    case 'SELECT_PAGE': {
      const { pageId, documentId, multiSelect } = action.payload;
      const { activeDocumentId, selectedPageIds, selectedDocumentIds, lastFocusedWorkspace } = state.selection;
      const isNewInSecondary = state.secondaryDocuments.some(d => d.id === documentId);
      const newWorkspace = isNewInSecondary ? 'secondary' : 'main';
      let newSelectedPageIds = new Set(multiSelect ? selectedPageIds : []);
      let newSelectedDocIds = new Set(multiSelect ? selectedDocumentIds : []);
      if (newWorkspace !== lastFocusedWorkspace || (!multiSelect && activeDocumentId !== documentId)) {
        newSelectedPageIds.clear(); newSelectedDocIds.clear();
      }
      if (newSelectedPageIds.has(pageId)) newSelectedPageIds.delete(pageId);
      else newSelectedPageIds.add(pageId);
      return { ...state, selection: { activeDocumentId: documentId, selectedPageIds: newSelectedPageIds, selectedDocumentIds: newSelectedDocIds, lastFocusedWorkspace: newWorkspace } };
    }

    case 'SELECT_DOCUMENT': {
      const { documentId, multiSelect } = action.payload;
      const { lastFocusedWorkspace, selectedPageIds, selectedDocumentIds } = state.selection;
      const allDocs = [...state.documents, ...state.secondaryDocuments];
      const targetDoc = allDocs.find(d => d.id === documentId);
      if (!targetDoc) return state;
      const isNewInSecondary = state.secondaryDocuments.some(d => d.id === documentId);
      const newWorkspace = isNewInSecondary ? 'secondary' : 'main';
      let newSelectedPageIds = new Set(multiSelect ? selectedPageIds : []);
      let newSelectedDocIds = new Set(multiSelect ? selectedDocumentIds : []);
      if (newWorkspace !== lastFocusedWorkspace || !multiSelect) {
        newSelectedPageIds.clear(); newSelectedDocIds.clear();
      }
      if (newSelectedDocIds.has(documentId)) {
        newSelectedDocIds.delete(documentId);
        targetDoc.pages.forEach(p => newSelectedPageIds.delete(p.id));
      } else {
        newSelectedDocIds.add(documentId);
        targetDoc.pages.forEach(p => newSelectedPageIds.add(p.id));
      }
      return { ...state, selection: { activeDocumentId: documentId, selectedPageIds: newSelectedPageIds, selectedDocumentIds: newSelectedDocIds, lastFocusedWorkspace: newWorkspace } };
    }

    case 'SELECT_ALL_PAGES': {
      const { lastFocusedWorkspace } = state.selection;
      const allPageIds = new Set<string>();
      const allDocIds = new Set<string>();
      const targetList = lastFocusedWorkspace === 'secondary' ? state.secondaryDocuments : state.documents;
      targetList.forEach(doc => {
        allDocIds.add(doc.id);
        doc.pages.forEach(p => allPageIds.add(p.id));
      });
      return { ...state, selection: { ...state.selection, selectedPageIds: allPageIds, selectedDocumentIds: allDocIds } };
    }

    case 'DELETE_SELECTED_PAGES': {
      const { selectedPageIds, selectedDocumentIds } = state.selection;
      if (selectedPageIds.size === 0 && selectedDocumentIds.size === 0) return state;
      const newState = pushHistory(state);
      const filterDocs = (docs: PDFDocument[]) => docs
        .filter(doc => !selectedDocumentIds.has(doc.id)) 
        .map(doc => {
          const newPages = doc.pages.filter(p => !selectedPageIds.has(p.id));
          return { ...doc, pages: newPages };
        })
        .filter(doc => doc.isNote || doc.pages.length > 0); 
      return { ...newState, documents: filterDocs(newState.documents), secondaryDocuments: filterDocs(newState.secondaryDocuments), selection: { ...newState.selection, activeDocumentId: null, selectedPageIds: new Set(), selectedDocumentIds: new Set() } };
    }

    case 'DESELECT_ALL': return { ...state, selection: { ...state.selection, activeDocumentId: null, selectedPageIds: new Set(), selectedDocumentIds: new Set() } };

    case 'MOVE_PAGE': {
      const { pageId, sourceDocId, destDocId, newIndex } = action.payload;
      const { selectedPageIds } = state.selection;
      const newState = pushHistory(state);
      const movingPageIds = selectedPageIds.has(pageId) ? Array.from(selectedPageIds) : [pageId];
      const movingPages: Page[] = [];
      const removeAndCollect = (docs: PDFDocument[]) => docs.map(doc => {
        const pagesToKeep = doc.pages.filter(p => {
          if (movingPageIds.includes(p.id)) { movingPages.push(p); return false; }
          return true;
        });
        return { ...doc, pages: pagesToKeep };
      });
      newState.documents = removeAndCollect(newState.documents);
      newState.secondaryDocuments = removeAndCollect(newState.secondaryDocuments);
      const insertPages = (docs: PDFDocument[]) => docs.map(doc => {
        if (doc.id === destDocId) {
          const updatedPages = [...doc.pages];
          const pagesWithNewDocId = movingPages.map(p => ({ ...p, documentId: destDocId }));
          updatedPages.splice(newIndex, 0, ...pagesWithNewDocId);
          return { ...doc, pages: updatedPages };
        }
        return doc;
      });
      newState.documents = insertPages(newState.documents);
      newState.secondaryDocuments = insertPages(newState.secondaryDocuments);
      return { ...newState, selection: { ...newState.selection, activeDocumentId: destDocId, selectedDocumentIds: new Set() } };
    }

    case 'TOGGLE_DOCUMENT_TYPE': {
      const newState = pushHistory(state);
      const { id } = action.payload;
      const toggle = (docs: PDFDocument[]) => docs.map(doc => {
        if (doc.id === id) {
          const willBeNote = !doc.isNote;
          const newName = willBeNote ? doc.name.replace(/\.pdf$/, '.txt') : doc.name.replace(/\.txt$/, '.pdf');
          return { ...doc, isNote: willBeNote, name: newName };
        }
        return doc;
      });
      return { ...newState, documents: toggle(newState.documents), secondaryDocuments: toggle(newState.secondaryDocuments) };
    }

    case 'UPDATE_NOTE_CONTENT': {
      const { id, content } = action.payload;
      const update = (docs: PDFDocument[]) => docs.map(doc => doc.id === id ? { ...doc, noteContent: content } : doc);
      return { ...state, documents: update(state.documents), secondaryDocuments: update(state.secondaryDocuments) };
    }

    case 'RENAME_DOCUMENT': {
      const { id, name } = action.payload;
      const update = (docs: PDFDocument[]) => docs.map(d => d.id === id ? { ...d, name } : d);
      return { ...state, documents: update(state.documents), secondaryDocuments: update(state.secondaryDocuments) };
    }

    case 'ADD_ADJACENT_DOCUMENT': {
      const { documentId, direction } = action.payload;
      let targetDoc = state.documents.find(d => d.id === documentId);
      let isMain = true;
      if (!targetDoc) { targetDoc = state.secondaryDocuments.find(d => d.id === documentId); isMain = false; }
      if (!targetDoc) return state;
      const nameWithoutExt = targetDoc.name.replace(/\.[^/.]+$/, "");
      const extMatch = targetDoc.name.match(/\.[^/.]+$/);
      const extension = extMatch ? extMatch[0] : ".pdf";
      const lastNumMatch = nameWithoutExt.match(/^(.*?)(\d+)$/);
      let newName = ""; let newBaseName = "";
      if (lastNumMatch) {
        const prefix = lastNumMatch[1]; const numStr = lastNumMatch[2]; const padding = numStr.length; const currentVal = parseInt(numStr, 10);
        if (direction === 'before' && currentVal <= 0) return state;
        const newVal = direction === 'before' ? currentVal - 1 : currentVal + 1;
        newBaseName = prefix + newVal.toString().padStart(padding, '0');
        newName = newBaseName + extension;
      } else {
        newBaseName = direction === 'before' ? `000_${nameWithoutExt}` : `${nameWithoutExt}_001`;
        newName = newBaseName + extension;
      }
      const listToCheck = isMain ? state.documents : state.secondaryDocuments;
      const isDuplicate = listToCheck.some(d => d.name.replace(/\.[^/.]+$/, "") === newBaseName);
      if (isDuplicate) return state;
      const newState = pushHistory(state);
      const newDoc: PDFDocument = { id: uuidv4(), name: newName, pages: [], isExpanded: true };
      if (isMain) newState.documents = sortDocumentsList([...newState.documents, newDoc]);
      else newState.secondaryDocuments = sortDocumentsList([...newState.secondaryDocuments, newDoc]);
      return newState;
    }

    case 'SORT_DOCUMENTS': {
      const newState = pushHistory(state);
      const target = action.payload.target;
      const listKey = target === 'main' ? 'documents' : 'secondaryDocuments';
      return { ...newState, [listKey]: sortDocumentsList(newState[listKey]) };
    }

    case 'CLEAR_ALL_DOCUMENTS': return { ...initialState, secondaryScreenOpen: state.secondaryScreenOpen };

    case 'SPLIT_SELECTED_PAGES': {
      const { selectedPageIds, activeDocumentId } = state.selection;
      if (selectedPageIds.size === 0) return state;
      const newState = pushHistory(state);
      const allDocs = [...newState.documents, ...newState.secondaryDocuments];
      let sourceDoc = allDocs.find(d => d.id === activeDocumentId);
      const firstSelectedId = Array.from(selectedPageIds)[0];
      if (!sourceDoc || !sourceDoc.pages.some(p => p.id === firstSelectedId)) sourceDoc = allDocs.find(d => d.pages.some(p => p.id === firstSelectedId));
      if (!sourceDoc) return state;
      const docPageIds = sourceDoc.pages.map(p => p.id);
      let minIdx = Infinity;
      selectedPageIds.forEach(id => {
        const idx = docPageIds.indexOf(id);
        if (idx !== -1 && idx < minIdx) minIdx = idx;
      });
      if (minIdx === Infinity || minIdx === 0) return state;
      const pagesToKeep = sourceDoc.pages.slice(0, minIdx);
      const pagesToMove = sourceDoc.pages.slice(minIdx);
      if (pagesToMove.length === 0) return state;
      const newDocId = uuidv4();
      const newDoc: PDFDocument = { id: newDocId, name: sourceDoc.name.replace('.pdf', '') + `_Part2.pdf`, pages: pagesToMove.map(p => ({ ...p, documentId: newDocId })), isExpanded: true };
      const updatedSourceDoc = { ...sourceDoc, pages: pagesToKeep };
      const isMain = state.documents.some(d => d.id === sourceDoc!.id);
      const docIdx = (isMain ? newState.documents : newState.secondaryDocuments).findIndex(d => d.id === sourceDoc!.id);
      if (isMain) {
        const newList = [...newState.documents]; newList[docIdx] = updatedSourceDoc; newList.splice(docIdx + 1, 0, newDoc);
        newState.documents = newList;
      } else {
        const newList = [...newState.secondaryDocuments]; newList[docIdx] = updatedSourceDoc; newList.splice(docIdx + 1, 0, newDoc);
        newState.secondaryDocuments = newList;
      }
      return { ...newState, selection: { ...newState.selection, activeDocumentId: newDocId, selectedPageIds: new Set(), selectedDocumentIds: new Set() } };
    }

    case 'ROTATE_SELECTED_PAGES': {
      if (state.selection.selectedPageIds.size === 0) return state;
      const angle = action.payload === 'left' ? -90 : 90;
      const newState = pushHistory(state);
      const rotateDocs = (docs: PDFDocument[]) => docs.map(doc => ({
        ...doc, pages: doc.pages.map(p => {
          if (state.selection.selectedPageIds.has(p.id)) {
            let newRot = (p.rotation + angle) % 360; if (newRot < 0) newRot += 360;
            return { ...p, rotation: newRot };
          }
          return p;
        })
      }));
      return { ...newState, documents: rotateDocs(newState.documents), secondaryDocuments: rotateDocs(newState.secondaryDocuments) };
    }

    case 'REORDER_DOCUMENTS': {
      const { sourceIndex, destIndex, listId } = action.payload;
      const newState = pushHistory(state);
      const listKey = listId === 'main' ? 'documents' : 'secondaryDocuments';
      const list = [...newState[listKey]]; const [moved] = list.splice(sourceIndex, 1); list.splice(destIndex, 0, moved);
      return { ...newState, [listKey]: list };
    }

    case 'MOVE_DOCUMENT': {
      const { sourceIndex, destIndex, sourceList, destList } = action.payload;
      const newState = pushHistory(state);
      const sourceKey = sourceList === 'main' ? 'documents' : 'secondaryDocuments';
      const destKey = destList === 'main' ? 'documents' : 'secondaryDocuments';
      const sourceArr = [...newState[sourceKey]];
      if (sourceList === destList) {
        const [moved] = sourceArr.splice(sourceIndex, 1); sourceArr.splice(destIndex, 0, moved);
        return { ...newState, [sourceKey]: sourceArr };
      } else {
        const destArr = [...newState[destKey]]; const [moved] = sourceArr.splice(sourceIndex, 1); destArr.splice(destIndex, 0, moved);
        return { ...newState, [sourceKey]: sourceArr, [destKey]: destArr };
      }
    }

    case 'UNDO': {
      if (state.history.past.length === 0) return state;
      const last = state.history.past[state.history.past.length - 1];
      const newPast = state.history.past.slice(0, -1);
      return { ...state, documents: last.documents, secondaryDocuments: last.secondaryDocuments, history: { past: newPast, future: [{ documents: state.documents, secondaryDocuments: state.secondaryDocuments }, ...state.history.future] } };
    }

    case 'REDO': {
      if (state.history.future.length === 0) return state;
      const next = state.history.future[0]; const newFuture = state.history.future.slice(1);
      return { ...state, documents: next.documents, secondaryDocuments: next.secondaryDocuments, history: { past: [...state.history.past, { documents: state.documents, secondaryDocuments: state.secondaryDocuments }], future: newFuture } };
    }
    default: return state;
  }
};

interface PDFContextProps {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  importFiles: (files: FileList | null, target: 'main' | 'secondary') => Promise<void>;
  importImages: (files: FileList | null, target: 'main' | 'secondary', intoDocId?: string) => Promise<void>;
  importToDocument: (files: FileList | null, target: 'main' | 'secondary', intoDocId: string) => Promise<void>;
}

const PDFContext = createContext<PDFContextProps | undefined>(undefined);

export const PDFProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(pdfReducer, initialState);

  const importFiles = useCallback(async (files: FileList | null, target: 'main' | 'secondary') => {
    if (!files) return;
    const fileArray = Array.from(files).filter(f => f.type === 'application/pdf' || f.type === 'text/plain' || f.name.toLowerCase().endsWith('.txt'));
    for (const file of fileArray) {
      const docId = uuidv4();
      const placeholderDoc: PDFDocument = { id: docId, name: file.name, pages: [], isExpanded: true, isLoading: true };
      dispatch({ type: 'LOAD_DOCUMENTS', payload: { docs: [placeholderDoc], target } });
      processFile(file).then(processedDoc => {
        dispatch({ type: 'UPDATE_DOCUMENT', payload: { docId, target, updates: { ...processedDoc, id: docId, isLoading: false } } });
      });
      await new Promise(r => setTimeout(r, 10));
    }
  }, []);

  const importImages = useCallback(async (files: FileList | null, target: 'main' | 'secondary', intoDocId?: string) => {
    if (!files) return;
    const pages: Page[] = [];
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const page = await processImageFile(file);
        pages.push(page);
      }
    }
    if (pages.length > 0) dispatch({ type: 'LOAD_IMAGES', payload: { pages, target, intoDocId } });
  }, []);

  const importToDocument = useCallback(async (files: FileList | null, target: 'main' | 'secondary', intoDocId: string) => {
    if (!files) return;
    const pages: Page[] = [];
    for (const file of Array.from(files)) {
      if (file.type === 'application/pdf') {
        const processed = await processFile(file);
        pages.push(...processed.pages);
      } else if (file.type.startsWith('image/')) {
        const page = await processImageFile(file);
        pages.push(page);
      }
    }
    if (pages.length > 0) dispatch({ type: 'LOAD_IMAGES', payload: { pages, target, intoDocId } });
  }, []);

  return (
    <PDFContext.Provider value={{ state, dispatch, importFiles, importImages, importToDocument }}>
      {children}
    </PDFContext.Provider>
  );
};

export const usePDFStore = () => {
  const context = useContext(PDFContext);
  if (!context) throw new Error('usePDFStore must be used within a PDFProvider');
  return context;
};
