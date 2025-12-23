
import React, { memo } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { Page } from '../types/types';
import { usePDFStore } from '../context/PDFContext';

interface Props {
  page: Page;
  index: number;
  displayIndex?: number;
}

const portalRoot = document.getElementById('portal-root');

export const PageThumbnail = memo(({ page, index, displayIndex }: Props) => {
  const { state, dispatch } = usePDFStore();
  const isSelected = state.selection.selectedPageIds.has(page.id);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    dispatch({ 
      type: 'SELECT_PAGE', 
      payload: { 
        pageId: page.id, 
        documentId: page.documentId, 
        multiSelect: e.ctrlKey || e.metaKey 
      } 
    });
  };

  const showIndex = typeof displayIndex === 'number' ? displayIndex : index;

  return (
    <Draggable 
      draggableId={page.id} 
      index={index}
    >
      {(provided, snapshot) => {
        const content = (
          <div
            ref={provided.innerRef}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={handleClick}
            className={`
              relative group flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all duration-200
              ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-100'}
              ${snapshot.isDragging ? 'shadow-2xl scale-110 bg-white ring-2 ring-blue-600' : ''}
            `}
            style={{
              ...provided.draggableProps.style,
              width: '116px',
              height: '170px',
              zIndex: snapshot.isDragging ? 10000 : undefined
            }}
          >
            {/* Page Number Badge */}
            <div className="absolute top-3 left-3 bg-gray-900/70 text-white text-[10px] px-1.5 py-0.5 rounded z-10 font-mono pointer-events-none">
              {showIndex + 1}
            </div>

            {/* Image Container */}
            <div 
              className="relative shadow-md bg-white overflow-hidden border border-gray-200"
              style={{ 
                width: 100, 
                height: 130,
                transform: snapshot.isDragging ? 'rotate(5deg)' : 'none',
                transition: snapshot.isDragging ? 'none' : 'transform 0.2s ease'
              }}
            >
              <img 
                src={page.imageUrl} 
                alt={`Page ${page.originalIndex}`}
                loading="lazy"
                className="w-full h-full object-cover pointer-events-none select-none"
                style={{ 
                  transform: `rotate(${page.rotation}deg)`,
                  transition: 'transform 0.3s ease'
                }}
              />
              
              {isSelected && (
                <div className="absolute inset-0 bg-blue-500/10 mix-blend-multiply border-2 border-blue-500" />
              )}
            </div>

            <span className="mt-1 text-[10px] text-gray-400 font-bold truncate max-w-full uppercase tracking-tighter">
              Trang {showIndex + 1}
            </span>

            {snapshot.isDragging && (
              <div className="absolute inset-0 bg-blue-500/5 rounded-lg" />
            )}
          </div>
        );

        // Nếu đang kéo, render nội dung vào Portal để luôn nằm trên cùng
        if (snapshot.isDragging && portalRoot) {
          return createPortal(content, portalRoot);
        }

        return content;
      }}
    </Draggable>
  );
});

PageThumbnail.displayName = 'PageThumbnail';
