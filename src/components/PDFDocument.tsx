
import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { PDFDocument as IPDFDocument } from '../types/types';
import { PageThumbnail } from './PageThumbnail';
import { FileText, GripVertical, Edit3, PlusSquare, ChevronUp, ChevronDown, Image as ImageIcon, StickyNote, FileType2, FilePlus, Loader2 } from 'lucide-react';
import { usePDFStore } from '../context/PDFContext';
import { formatFileName, getSortValue } from '../utils/utils';

interface Props {
  document: IPDFDocument;
  index: number;
}

export const PDFDocument = memo(({ document, index }: Props) => {
  const { state, dispatch, importToDocument } = usePDFStore();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(document.name);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputIntoDocRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing) {
      setTempName(document.name);
      inputRef.current?.focus();
    }
  }, [isEditing, document.name]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) setContainerWidth(containerRef.current.clientWidth);
    };
    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setShowMenu(false);
    };
    if (showMenu) window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const calculateColumns = useMemo(() => {
    const itemWidth = 116; const gap = 8; const padding = 32; 
    const availableWidth = containerWidth - padding;
    if (availableWidth <= 0) return 1;
    return Math.max(1, Math.floor((availableWidth + gap) / (itemWidth + gap)));
  }, [containerWidth]);

  const handleRename = () => {
    if (tempName.trim()) {
      const ext = document.isNote ? '.txt' : '.pdf';
      let finalName = tempName.trim();
      if (!finalName.toLowerCase().endsWith(ext)) finalName = finalName.replace(/\.(pdf|txt)$/i, '') + ext;
      dispatch({ type: 'RENAME_DOCUMENT', payload: { id: document.id, name: finalName } });
    }
    setIsEditing(false);
  };

  const handleAddAdjacent = (direction: 'before' | 'after') => {
    dispatch({ type: 'ADD_ADJACENT_DOCUMENT', payload: { documentId: document.id, direction } });
    setShowMenu(false);
  };

  const handleToggleType = () => {
    dispatch({ type: 'TOGGLE_DOCUMENT_TYPE', payload: { id: document.id } });
    setShowMenu(false);
  };

  const handleInsertFiles = () => {
    fileInputIntoDocRef.current?.click();
    setShowMenu(false);
  };

  const handleSelectDocument = (e: React.MouseEvent) => {
    if (isEditing) return;
    dispatch({ type: 'SELECT_DOCUMENT', payload: { documentId: document.id, multiSelect: e.ctrlKey || e.metaKey } });
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isSecondary = state.secondaryDocuments.some(d => d.id === document.id);
    importToDocument(e.target.files, isSecondary ? 'secondary' : 'main', document.id);
    e.target.value = '';
  };

  const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    dispatch({ type: 'UPDATE_NOTE_CONTENT', payload: { id: document.id, content: e.target.value } });
  };

  const displayName = formatFileName(document.name);
  const sortVal = getSortValue(document.name);
  const isDocSelected = state.selection.selectedDocumentIds.has(document.id);
  const shouldShowTypeToggle = document.isNote || (!document.isNote && document.pages.length === 0);

  return (
    <Draggable draggableId={document.id} index={index}>
      {(provided, snapshot) => (
        <div
          id={`doc-anchor-${sortVal}`}
          ref={(el) => { provided.innerRef(el); containerRef.current = el as HTMLDivElement; }}
          {...provided.draggableProps}
          className={`bg-white rounded-xl shadow-sm border flex flex-col transition-all mb-6 relative ${snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500 z-50' : 'z-0'} ${isDocSelected ? 'ring-2 ring-blue-600 border-blue-600 shadow-md' : 'border-gray-200'} ${document.isNote && !isDocSelected ? 'border-amber-200' : ''}`}
        >
          <input 
            type="file" multiple accept="application/pdf,image/*" 
            className="hidden" ref={fileInputIntoDocRef} onChange={onFileChange}
          />
          <div 
            onClick={handleSelectDocument}
            className={`flex items-center gap-3 px-4 py-3 border-b border-gray-200 group sticky top-0 z-10 shadow-sm cursor-pointer transition-colors ${document.isNote ? 'bg-amber-50/50 hover:bg-amber-100/50' : (isDocSelected ? 'bg-blue-50 hover:bg-blue-100' : 'bg-gray-50 hover:bg-gray-100')}`}
          >
            <div className="relative" ref={menuRef}>
              <div 
                {...provided.dragHandleProps} 
                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                className="cursor-grab active:cursor-grabbing p-1 -m-1 hover:bg-gray-200 rounded text-gray-400 group-hover:text-gray-600 transition-colors"
              >
                <GripVertical size={16} />
              </div>
              {showMenu && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-modal" onClick={e => e.stopPropagation()}>
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 mb-1">
                     <PlusSquare size={14} className="text-blue-500" />
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tùy chọn Hồ sơ</span>
                  </div>
                  <button onClick={() => handleAddAdjacent('before')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2">
                    <ChevronUp size={14} /> Thêm 1 hồ sơ trống trước
                  </button>
                  <button onClick={() => handleAddAdjacent('after')} className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2">
                    <ChevronDown size={14} /> Thêm 1 hồ sơ trống sau
                  </button>
                  {shouldShowTypeToggle && (
                    <>
                      <div className="h-px bg-gray-100 my-1"></div>
                      <button onClick={handleToggleType} className={`w-full text-left px-4 py-2.5 text-xs font-bold transition-colors flex items-center gap-2 ${document.isNote ? 'text-blue-600 hover:bg-blue-50' : 'text-amber-600 hover:bg-amber-50'}`}>
                        {document.isNote ? (<><FileType2 size={14} /> Chuyển sang Hồ sơ PDF</>) : (<><StickyNote size={14} /> Chuyển sang Ghi chú (.txt)</>)}
                      </button>
                    </>
                  )}
                  {!document.isNote && (
                    <button onClick={handleInsertFiles} className="w-full text-left px-4 py-2.5 text-xs font-bold text-purple-700 hover:bg-purple-50 transition-colors flex items-center gap-2 border-t border-gray-100">
                      <FilePlus size={14} /> Chèn thêm tệp (PDF/Ảnh) vào hồ sơ
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className={`p-2 rounded-lg shrink-0 ${document.isNote ? 'bg-amber-100 text-amber-600' : (isDocSelected ? 'bg-blue-100 text-blue-600' : 'bg-red-100 text-red-600')}`}>
              {document.isLoading ? <Loader2 size={20} className="animate-spin" /> : (document.isNote ? <StickyNote size={20} /> : <FileText size={20} />)}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
              {isEditing ? (
                <input ref={inputRef} type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} onBlur={handleRename} onKeyDown={(e) => e.key === 'Enter' && handleRename()} onClick={e => e.stopPropagation()} className="w-full text-sm font-semibold text-gray-800 bg-white border border-blue-400 px-2 py-0.5 rounded outline-none" />
              ) : (
                <div onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="flex-1 min-w-0 group/name flex items-center gap-2 cursor-pointer hover:bg-white/50 px-2 py-0.5 rounded transition-colors" title={document.name}>
                  <h3 className={`text-sm font-bold truncate select-none ${document.isLoading ? 'text-gray-400 italic' : 'text-gray-800'}`}>{displayName} {document.isLoading && '...'}</h3>
                  <Edit3 size={12} className="text-gray-400 opacity-0 group-hover/name:opacity-100 shrink-0" />
                </div>
              )}
            </div>
            <p className={`text-[10px] font-bold uppercase tracking-tighter shrink-0 ${isDocSelected ? 'text-blue-600' : 'text-gray-400'}`}>
              {document.isLoading ? 'Processing' : (document.isNote ? 'NOTE' : `${document.pages.length} PGS`)}
            </p>
          </div>
          <div className={`p-4 transition-colors duration-200 bg-white relative z-0 overflow-visible ${document.isNote ? 'bg-amber-50/20' : ''}`}>
            {document.isLoading ? (
               <div className="w-full h-24 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                 <Loader2 size={24} className="animate-spin text-blue-500" />
                 <p className="font-bold uppercase tracking-widest">Đang giải mã nội dung PDF...</p>
               </div>
            ) : document.isNote ? (
              <div className="w-full">
                <textarea value={document.noteContent || ''} onChange={handleNoteChange} placeholder="Nhập ghi chú tại đây..." className="w-full min-h-32 p-4 text-sm font-medium text-gray-700 bg-white border border-amber-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-400/50 transition-all resize-y shadow-inner" />
              </div>
            ) : document.pages.length === 0 ? (
              <Droppable droppableId={`${document.id}::row::0::start::0`} direction="horizontal" type="PAGE" isDropDisabled={snapshot.isDragging}>
                {(providedRow) => (
                  <div ref={providedRow.innerRef} {...providedRow.droppableProps} onClick={() => fileInputIntoDocRef.current?.click()} className="w-full h-32 flex flex-col items-center justify-center text-gray-400 text-sm italic border-2 border-dashed border-gray-200 rounded-lg select-none hover:bg-blue-50/50 hover:border-blue-300 hover:text-blue-500 transition-all cursor-pointer gap-2 group/empty">
                    <div className="p-2 bg-gray-50 rounded-full group-hover/empty:bg-blue-100 transition-colors"><FilePlus size={24} /></div>
                    <div className="text-center">
                      <p className="font-bold">Kéo thả trang vào đây</p>
                      <p className="text-[10px] uppercase font-black tracking-widest mt-1">Hoặc Click để chọn tệp (PDF/Ảnh) cho hồ sơ</p>
                    </div>
                    {providedRow.placeholder}
                  </div>
                )}
              </Droppable>
            ) : (
              (() => {
                const columns = calculateColumns; const rows = [] as typeof document.pages[];
                for (let i = 0; i < document.pages.length; i += columns) rows.push(document.pages.slice(i, i + columns));
                return rows.map((rowPages, rIdx) => {
                  const rowStart = rIdx * columns; const rowDroppableId = `${document.id}::row::${rIdx}::start::${rowStart}`;
                  return (
                    <Droppable key={rowDroppableId} droppableId={rowDroppableId} direction="horizontal" type="PAGE" isDropDisabled={snapshot.isDragging}>
                        {(providedRow, snapshotRow) => (
                          <div ref={providedRow.innerRef} {...providedRow.droppableProps} className={`flex items-start gap-2 mb-2 transition-colors ${snapshotRow.isDraggingOver ? 'bg-blue-50/50' : ''}`} style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'flex-start', flexWrap: 'nowrap', overflow: 'visible' }}>
                          {rowPages.map((page, idx) => (<PageThumbnail key={page.id} page={page} index={idx} displayIndex={rowStart + idx} />))}
                          {providedRow.placeholder}
                        </div>
                      )}
                    </Droppable>
                  );
                });
              })()
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
});
PDFDocument.displayName = 'PDFDocument';
