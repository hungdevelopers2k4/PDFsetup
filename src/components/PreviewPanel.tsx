
import React, { useState, useEffect, useRef } from 'react';
import { usePDFStore } from '../context/PDFContext';
import { EyeOff, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { formatFileName } from '../utils/utils';

export const PreviewPanel: React.FC = () => {
  const { state } = usePDFStore();
  const { selectedPageIds, activeDocumentId } = state.selection;
  
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });

  let previewPage = null;
  let previewDoc = null;

  const findPage = (pageId: string) => {
    for (const doc of [...state.documents, ...state.secondaryDocuments]) {
      const page = doc.pages.find(p => p.id === pageId);
      if (page) return { page, doc };
    }
    return null;
  };

  const findDoc = (docId: string) => {
    return [...state.documents, ...state.secondaryDocuments].find(d => d.id === docId);
  }

  if (selectedPageIds.size > 0) {
    const lastId = Array.from(selectedPageIds).pop() as string | undefined;
    if (lastId) {
      const result = findPage(lastId);
      if (result) {
        previewPage = result.page;
        previewDoc = result.doc;
      }
    }
  } else if (activeDocumentId) {
    const doc = findDoc(activeDocumentId);
    if (doc && doc.pages.length > 0) {
        previewDoc = doc;
        previewPage = doc.pages[0];
    }
  } else if (state.documents.length > 0 && state.documents[0].pages.length > 0) {
      previewDoc = state.documents[0];
      previewPage = previewDoc.pages[0];
  }

  useEffect(() => {
    setZoom(1);
  }, [previewPage?.id]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // Hỗ trợ cả Ctrl (Windows) và Cmd (Mac) khi cuộn chuột để zoom
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = -e.deltaY * 0.005; 
        setZoom(prev => Math.min(Math.max(prev + delta, 0.1), 5.0));
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current || e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop
    };
    document.body.style.cursor = 'grabbing';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isPanning || !scrollContainerRef.current) return;
      e.preventDefault();
      const dx = e.clientX - panStartRef.current.x;
      const dy = e.clientY - panStartRef.current.y;
      scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
      scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
    };

    const handleMouseUp = () => {
      if (isPanning) {
        setIsPanning(false);
        document.body.style.cursor = '';
      }
    };

    if (isPanning) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isPanning]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 5.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.1));
  const handleResetZoom = () => setZoom(1);
  
  const handleDoubleClick = () => {
    setZoom(zoom === 1 ? 2 : 1);
  };

  const previewDisplayName = previewDoc ? formatFileName(previewDoc.name) : '';

  return (
    <div className="bg-white flex flex-col h-full w-full select-none overflow-hidden border-l border-gray-100 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
          Preview
          {previewPage && (
            <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-[10px] font-mono">
              {Math.round(zoom * 100)}%
            </span>
          )}
        </span>
        
        {previewPage && (
           <div className="flex items-center gap-1">
             <button onClick={handleZoomOut} className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"><ZoomOut size={14}/></button>
             <button onClick={handleResetZoom} className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"><RotateCcw size={14}/></button>
             <button onClick={handleZoomIn} className="p-1 hover:bg-gray-200 rounded text-gray-500 transition-colors"><ZoomIn size={14}/></button>
           </div>
        )}
      </div>

      <div className="flex-1 relative bg-gray-100/50 overflow-hidden group">
        {previewPage ? (
          <>
            <div 
              ref={scrollContainerRef}
              onMouseDown={handleMouseDown}
              onDoubleClick={handleDoubleClick}
              className={`absolute inset-0 overflow-auto flex items-center justify-center p-8 custom-scrollbar ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            >
              <div 
                 className="relative shadow-2xl bg-white border border-gray-200 transition-transform duration-75 ease-out origin-center"
                 style={{ transform: `scale(${zoom}) rotate(${previewPage.rotation}deg)` }}
              >
                 <img 
                    src={previewPage.imageUrl} 
                    alt="Preview" 
                    className="max-w-[90vw] max-h-[80vh] object-contain block pointer-events-none"
                    draggable={false}
                 />
              </div>
            </div>

            <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="bg-black/75 backdrop-blur text-white py-1.5 px-3 rounded-full shadow-lg border border-white/10 flex items-center gap-2">
                    <p className="font-bold text-xs truncate max-w-40">{previewDisplayName}</p>
                    <div className="w-1 h-1 bg-gray-400 rounded-full" />
                    <p className="text-xs text-gray-300 font-mono">Page {previewPage.originalIndex}</p>
                </div>
            </div>
            
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none opacity-0 group-hover:opacity-60 transition-opacity duration-500">
                <div className="text-[10px] text-gray-500 bg-white/80 px-2 py-1 rounded shadow-sm border border-gray-200 font-medium">
                  Cmd/Ctrl + Scroll: Zoom • Drag: Pan • Double-click: Reset
                </div>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-3">
            <div className="p-4 bg-gray-200/50 rounded-full">
              <EyeOff size={32} className="opacity-40" />
            </div>
            <p className="text-sm font-medium">No page selected</p>
          </div>
        )}
      </div>
    </div>
  );
};
