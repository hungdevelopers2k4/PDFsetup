
import React, { memo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Draggable } from '@hello-pangea/dnd';
import { Page } from '../types/types';
import { usePDFStore } from '../context/PDFContext';
import { Layers, Loader2 } from 'lucide-react';

interface Props {
  page: Page;
  index: number;
  displayIndex?: number;
}

const portalRoot = document.getElementById('portal-root');

export const PageThumbnail = memo(({ page, index, displayIndex }: Props) => {
  const { state, dispatch } = usePDFStore();
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const isSelected = state.selection.selectedPageIds.has(page.id);
  const selectedCount = state.selection.selectedPageIds.size;

  // Lazy Loading Logic
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' } // Tải trước khi trang cách viewport 200px
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
  }, [page.id]);

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
        const isDraggingThis = snapshot.isDragging;
        const isDraggingMultiple = isDraggingThis && isSelected && selectedCount > 1;

        const content = (
          <div
            ref={(el) => {
              provided.innerRef(el);
              // @ts-ignore
              containerRef.current = el;
            }}
            {...provided.draggableProps}
            {...provided.dragHandleProps}
            onClick={handleClick}
            className={`
              relative group flex flex-col items-center p-2 rounded-lg cursor-pointer transition-all duration-200
              ${isSelected ? 'bg-blue-100 ring-2 ring-blue-500' : 'hover:bg-gray-100'}
              ${isDraggingThis ? 'shadow-2xl scale-110 bg-white ring-2 ring-blue-600' : ''}
            `}
            style={{
              ...provided.draggableProps.style,
              width: '116px',
              height: '150px',
              zIndex: isDraggingThis ? 10000 : undefined
            }}
          >
            {/* Multi-drag Badge */}
              {isDraggingMultiple && (
              <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded-full shadow-lg z-100 flex items-center gap-1 border border-blue-400">
                <Layers size={10} />
                {selectedCount}
              </div>
            )}

            {/* Page Number Badge */}
            <div className="absolute top-3 left-3 bg-gray-900/70 text-white text-[10px] px-1.5 py-0.5 rounded z-10 font-mono pointer-events-none">
              {showIndex + 1}
            </div>

            {/* Image Container */}
            <div 
              className="relative shadow-md bg-gray-50 overflow-hidden border border-gray-200 flex items-center justify-center"
              style={{ 
                width: 100, 
                height: 130,
                transform: isDraggingThis ? 'rotate(5deg)' : 'none',
                transition: isDraggingThis ? 'none' : 'transform 0.2s ease'
              }}
            >
              {isVisible ? (
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
              ) : (
                <div className="flex flex-col items-center justify-center gap-1">
                   <Loader2 size={16} className="text-gray-300 animate-spin" />
                </div>
              )}
              
              {isSelected && (
                <div className="absolute inset-0 bg-blue-500/10 mix-blend-multiply border-2 border-blue-500" />
              )}
            </div>

            {isDraggingThis && (
              <div className="absolute inset-0 bg-blue-500/5 rounded-lg" />
            )}
          </div>
        );

        if (isDraggingThis && portalRoot) {
          return createPortal(content, portalRoot);
        }

        return content;
      }}
    </Draggable>
  );
});

PageThumbnail.displayName = 'PageThumbnail';
