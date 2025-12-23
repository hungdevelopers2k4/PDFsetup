
import React, { useState, useRef, useEffect, memo, useMemo } from 'react';
import { Droppable, Draggable } from '@hello-pangea/dnd';
import { PDFDocument as IPDFDocument } from '../types/types';
import { PageThumbnail } from './PageThumbnail';
import { FileText, GripVertical, Edit3, PlusSquare, ChevronUp, ChevronDown } from 'lucide-react';
import { usePDFStore } from '../context/PDFContext';
import { formatFileName, getSortValue } from '../utils/utils';

interface Props {
  document: IPDFDocument;
  index: number;
}

export const PDFDocument = memo(({ document, index }: Props) => {
  const { dispatch } = usePDFStore();
  const [isEditing, setIsEditing] = useState(false);
  const [tempName, setTempName] = useState(document.name);
  const [containerWidth, setContainerWidth] = useState(0);
  const [showMenu, setShowMenu] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    updateWidth();
    const resizeObserver = new ResizeObserver(updateWidth);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      window.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMenu]);

  const calculateColumns = useMemo(() => {
    const itemWidth = 116; 
    const gap = 8; 
    const padding = 32; 
    const availableWidth = containerWidth - padding;
    
    if (availableWidth <= 0) return 1;
    
    const columns = Math.max(1, Math.floor((availableWidth + gap) / (itemWidth + gap)));
    return columns;
  }, [containerWidth]);

  const handleRename = () => {
    if (tempName.trim()) {
      dispatch({ 
        type: 'RENAME_DOCUMENT', 
        payload: { 
          id: document.id, 
          name: tempName.trim().endsWith('.pdf') ? tempName.trim() : tempName.trim() + '.pdf' 
        } 
      });
    }
    setIsEditing(false);
  };

  const handleAddAdjacent = (direction: 'before' | 'after') => {
    dispatch({ type: 'ADD_ADJACENT_DOCUMENT', payload: { documentId: document.id, direction } });
    setShowMenu(false);
  };

  const displayName = formatFileName(document.name);
  const sortVal = getSortValue(document.name);

  return (
    <Draggable draggableId={document.id} index={index}>
      {(provided, snapshot) => (
        <div
          id={`doc-anchor-${sortVal}`}
          ref={(el) => {
            provided.innerRef(el);
            containerRef.current = el;
          }}
          {...provided.draggableProps}
          className={`bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col transition-all mb-6 relative ${
            snapshot.isDragging ? 'shadow-2xl ring-2 ring-blue-500 z-50' : 'z-0'
          }`}
        >
          {/* Header - z-10 thay vì z-20 để dễ dàng bị đè bởi Portal của Page dragging */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-200 group sticky top-0 z-10 shadow-sm">
            <div className="relative" ref={menuRef}>
              <div 
                {...provided.dragHandleProps} 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
                className="cursor-grab active:cursor-grabbing p-1 -m-1 hover:bg-gray-200 rounded text-gray-400 group-hover:text-gray-600 transition-colors"
              >
                <GripVertical size={16} />
              </div>

              {showMenu && (
                <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden py-1 animate-modal">
                  <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 mb-1">
                     <PlusSquare size={14} className="text-blue-500" />
                     <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Thêm file trống</span>
                  </div>
                  <button 
                    onClick={() => handleAddAdjacent('before')}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                  >
                    <ChevronUp size={14} /> Thêm 1 file thấp số trước
                  </button>
                  <button 
                    onClick={() => handleAddAdjacent('after')}
                    className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition-colors flex items-center gap-2"
                  >
                    <ChevronDown size={14} /> Thêm 1 file trên số sau
                  </button>
                </div>
              )}
            </div>
            
            <div className="p-2 bg-red-100 text-red-600 rounded-lg shrink-0">
              <FileText size={20} />
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2 overflow-hidden">
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onBlur={handleRename}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename()}
                  className="w-full text-sm font-semibold text-gray-800 bg-white border border-blue-400 px-2 py-0.5 rounded outline-none"
                />
              ) : (
                <div 
                  onClick={() => setIsEditing(true)}
                  className="flex-1 min-w-0 group/name flex items-center gap-2 cursor-pointer hover:bg-gray-100 px-2 py-0.5 rounded transition-colors"
                  title={document.name}
                >
                  <h3 className="text-sm font-bold text-gray-800 truncate select-none">
                    {displayName}
                  </h3>
                  <Edit3 size={12} className="text-gray-400 opacity-0 group-hover/name:opacity-100 shrink-0" />
                </div>
              )}
            </div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter shrink-0">{document.pages.length} PGS</p>
          </div>

          <div className="p-4 transition-colors duration-200 bg-white relative z-0 overflow-visible">
            {document.pages.length === 0 ? (
              <Droppable droppableId={`${document.id}::row::0::start::0`} direction="horizontal" type="PAGE" isDropDisabled={snapshot.isDragging}>
                {(providedRow) => (
                  <div
                    ref={providedRow.innerRef}
                    {...providedRow.droppableProps}
                    className="w-full h-24 flex items-center justify-center text-gray-400 text-sm italic border-2 border-dashed border-gray-200 rounded-lg select-none"
                  >
                    Kéo thả trang vào đây
                    {providedRow.placeholder}
                  </div>
                )}
              </Droppable>
            ) : (
              (() => {
                const columns = calculateColumns;
                const rows = [] as typeof document.pages[];
                for (let i = 0; i < document.pages.length; i += columns) {
                  rows.push(document.pages.slice(i, i + columns));
                }

                return rows.map((rowPages, rIdx) => {
                  const rowStart = rIdx * columns;
                  const rowDroppableId = `${document.id}::row::${rIdx}::start::${rowStart}`;
                  return (
                    <Droppable key={rowDroppableId} droppableId={rowDroppableId} direction="horizontal" type="PAGE" isDropDisabled={snapshot.isDragging}>
                        {(providedRow, snapshotRow) => (
                          <div
                            ref={providedRow.innerRef}
                            {...providedRow.droppableProps}
                            className={`flex items-start gap-2 mb-2 transition-colors ${snapshotRow.isDraggingOver ? 'bg-blue-50/50' : ''}`}
                            style={{
                              display: 'flex',
                              flexDirection: 'row',
                              gap: '8px',
                              alignItems: 'flex-start',
                              flexWrap: 'nowrap',
                              overflow: 'visible'
                            }}
                          >
                          {rowPages.map((page, idx) => (
                            <PageThumbnail key={page.id} page={page} index={idx} displayIndex={rowStart + idx} />
                          ))}
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
