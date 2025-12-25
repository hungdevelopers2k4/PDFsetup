
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePDFStore } from '../context/PDFContext';
import { EyeOff, ZoomIn, ZoomOut, RotateCcw, Eraser, AlignCenter, Crop, MousePointer2, Loader2, Sparkles, X as CloseIcon, Check, MousePointerClick, SlidersHorizontal } from 'lucide-react';
import { autoRemoveBlackBorders, autoDeskew } from '../utils/utils';
import { PDFImageProcessor } from '../edit/imageProcessor';

type ToolMode = 'none' | 'mask-erase' | 'click-erase' | 'crop' | 'rotate';

export const PreviewPanel: React.FC = () => {
  const { state, dispatch } = usePDFStore();
  const { selectedPageIds, activeDocumentId } = state.selection;
  
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [showEraserMenu, setShowEraserMenu] = useState(false);
  const [toolMode, setToolMode] = useState<ToolMode>('none');
  const [maskRect, setMaskRect] = useState<{ x: number, y: number, w: number, h: number } | null>(null);
  const [manualAngle, setManualAngle] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 });
  const maskStartRef = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
  }

  useEffect(() => {
    setZoom(1);
    setToolMode('none');
    setMaskRect(null);
    setManualAngle(0);
    setIsProcessing(false);
  }, [previewPage?.id]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowEraserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && toolMode !== 'none') {
        setToolMode('none');
        setMaskRect(null);
        setManualAngle(0);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [toolMode]);

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.25, 5.0));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.25, 0.1));
  const handleResetZoom = () => setZoom(1);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((toolMode === 'mask-erase' || toolMode === 'crop') && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      maskStartRef.current = { x, y };
      setMaskRect({ x, y, w: 0, h: 0 });
      return;
    }

    // CLICK ERASE LOGIC
    if (toolMode === 'click-erase' && imageRef.current && previewPage) {
        const rect = imageRef.current.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) / zoom;
        const clickY = (e.clientY - rect.top) / zoom;
        applyClickEraser(clickX, clickY);
        return;
    }

    if (!scrollContainerRef.current || e.button !== 0) return;
    setIsPanning(true);
    panStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: scrollContainerRef.current.scrollLeft,
      scrollTop: scrollContainerRef.current.scrollTop
    };
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if ((toolMode === 'mask-erase' || toolMode === 'crop') && maskRect && imageRef.current) {
      const rect = imageRef.current.getBoundingClientRect();
      const curX = (e.clientX - rect.left) / zoom;
      const curY = (e.clientY - rect.top) / zoom;
      setMaskRect(prev => prev ? {
        x: Math.min(curX, maskStartRef.current.x),
        y: Math.min(curY, maskStartRef.current.y),
        w: Math.abs(curX - maskStartRef.current.x),
        h: Math.abs(curY - maskStartRef.current.y)
      } : null);
      return;
    }

    if (!isPanning || !scrollContainerRef.current) return;
    const dx = e.clientX - panStartRef.current.x;
    const dy = e.clientY - panStartRef.current.y;
    scrollContainerRef.current.scrollLeft = panStartRef.current.scrollLeft - dx;
    scrollContainerRef.current.scrollTop = panStartRef.current.scrollTop - dy;
  }, [isPanning, toolMode, maskRect, zoom]);

  const applyClickEraser = async (x: number, y: number) => {
    if (!previewPage || !imageRef.current) return;
    setIsProcessing(true);
    const originalImgUrl = previewPage.imageUrl;
    const pageId = previewPage.id;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);

      const scaleX = img.width / (imageRef.current!.width / zoom);
      const scaleY = img.height / (imageRef.current!.height / zoom);
      
      PDFImageProcessor.floodFillInpaint(canvas, x * scaleX, y * scaleY);
      
      dispatch({ 
        type: 'UPDATE_PAGE_IMAGE', 
        payload: { pageId: pageId, imageUrl: canvas.toDataURL('image/jpeg', 0.9) } 
      });
      setIsProcessing(false);
    };
    img.src = originalImgUrl;
  };

  const applyMaskAction = async (currentRect: { x: number, y: number, w: number, h: number }) => {
    if (!previewPage || !imageRef.current || currentRect.w < 2 || currentRect.h < 2) {
      setMaskRect(null);
      return;
    }
    
    setIsProcessing(true);
    const originalImgUrl = previewPage.imageUrl;
    const pageId = previewPage.id;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);

      const scaleX = img.width / (imageRef.current!.width / zoom);
      const scaleY = img.height / (imageRef.current!.height / zoom);
      
      const realX = currentRect.x * scaleX;
      const realY = currentRect.y * scaleY;
      const realW = currentRect.w * scaleX;
      const realH = currentRect.h * scaleY;

      if (toolMode === 'mask-erase') {
        PDFImageProcessor.inpaintRegion(canvas, realX, realY, realW, realH);
        dispatch({ 
            type: 'UPDATE_PAGE_IMAGE', 
            payload: { pageId, imageUrl: canvas.toDataURL('image/jpeg', 0.9) } 
        });
      } else if (toolMode === 'crop') {
        const croppedCanvas = PDFImageProcessor.cropImage(canvas, realX, realY, realW, realH);
        dispatch({ 
            type: 'UPDATE_PAGE_IMAGE', 
            payload: { pageId, imageUrl: croppedCanvas.toDataURL('image/jpeg', 0.9) } 
        });
        setToolMode('none');
      }
      
      setIsProcessing(false);
      setMaskRect(null);
    };
    img.src = originalImgUrl;
  };

  const applyManualRotation = async () => {
    if (!previewPage || manualAngle === 0) return;
    setIsProcessing(true);
    const img = new Image();
    img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const rotatedCanvas = PDFImageProcessor.rotateImage(canvas, manualAngle);
        dispatch({ 
            type: 'UPDATE_PAGE_IMAGE', 
            payload: { pageId: previewPage.id, imageUrl: rotatedCanvas.toDataURL('image/jpeg', 0.9) } 
        });
        setIsProcessing(false);
        setToolMode('none');
        setManualAngle(0);
    }
    img.src = previewPage.imageUrl;
  };

  const handleMouseUp = () => {
    if ((toolMode === 'mask-erase' || toolMode === 'crop') && maskRect) {
      applyMaskAction(maskRect);
    }
    setIsPanning(false);
  };

  const handleAutoEraser = async () => {
    if (!previewPage) return;
    setIsProcessing(true);
    try {
      const resultBase64 = await autoRemoveBlackBorders(previewPage.imageUrl);
      dispatch({ 
        type: 'UPDATE_PAGE_IMAGE', 
        payload: { pageId: previewPage.id, imageUrl: resultBase64 } 
      });
    } finally {
      setIsProcessing(false);
      setShowEraserMenu(false);
    }
  };

  const handleAutoDeskew = async () => {
    if (!previewPage) return;
    setIsProcessing(true);
    try {
      const result = await autoDeskew(previewPage.imageUrl);
      dispatch({ 
        type: 'UPDATE_PAGE_IMAGE', 
        payload: { pageId: previewPage.id, imageUrl: result.imageUrl } 
      });
    } finally {
      setIsProcessing(false);
      setShowEraserMenu(false);
    }
  };

  return (
    <div className="bg-white flex flex-col h-full w-full select-none overflow-hidden border-l border-gray-100 shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
            Preview
            {isProcessing && <Loader2 size={12} className="animate-spin text-blue-500" />}
          </span>
        </div>
        
        {previewPage && !isProcessing && (
           <div className="flex items-center gap-1.5">
             <div className="h-4 w-px bg-gray-300 mx-1"></div>
             
             {/* NÚT LÀM THẲNG AI ĐƯA RA NGOÀI NHƯ CŨ */}
             <button 
                onClick={handleAutoDeskew}
                className="p-1.5 rounded-lg transition-all flex items-center gap-1 hover:bg-blue-50 text-gray-600 hover:text-blue-600 group"
                title="Làm thẳng AI (Auto Deskew)"
             >
               <AlignCenter size={16} />
               <span className="text-[10px] font-bold hidden xl:inline">Làm thẳng AI</span>
             </button>

             <button 
                onClick={() => setToolMode(toolMode === 'rotate' ? 'none' : 'rotate')}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-1 group ${toolMode === 'rotate' ? 'bg-blue-600 text-white' : 'hover:bg-blue-50 text-gray-600 hover:text-blue-600'}`}
                title="Chỉnh góc ảnh thủ công"
             >
               <SlidersHorizontal size={16} />
               <span className="text-[10px] font-bold hidden xl:inline">Chỉnh góc</span>
             </button>

             <button 
                onClick={() => setToolMode(toolMode === 'crop' ? 'none' : 'crop')}
                className={`p-1.5 rounded-lg transition-all flex items-center gap-1 group ${toolMode === 'crop' ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 text-gray-600 hover:text-indigo-600'}`}
                title="Cắt khung trang"
             >
               <Crop size={16} />
               <span className="text-[10px] font-bold hidden xl:inline">Cắt khung</span>
             </button>

             <div className="relative" ref={menuRef}>
                <button 
                    onClick={() => {
                      if (toolMode === 'mask-erase' || toolMode === 'click-erase') {
                        setToolMode('none');
                        setMaskRect(null);
                      } else {
                        setShowEraserMenu(!showEraserMenu);
                      }
                    }}
                    className={`p-1.5 rounded-lg transition-all flex items-center gap-1 group ${showEraserMenu || toolMode === 'mask-erase' || toolMode === 'click-erase' ? 'bg-red-600 text-white shadow-md' : 'hover:bg-red-50 text-gray-600 hover:text-red-600'}`}
                    title="Xóa vùng đen"
                >
                  {toolMode === 'mask-erase' || toolMode === 'click-erase' ? <CloseIcon size={16} /> : <Eraser size={16} className="group-hover:rotate-12 transition-transform"/>}
                  <span className="text-[10px] font-bold hidden xl:inline">Xóa đen</span>
                </button>

                {showEraserMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-100 py-1 animate-modal">
                    <button 
                      onClick={handleAutoEraser}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors"
                    >
                      <Sparkles size={14} className="text-amber-500" /> Tự động xóa (AI)
                    </button>
                    <button 
                      onClick={() => { setToolMode('click-erase'); setShowEraserMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors"
                    >
                      <MousePointerClick size={14} /> Nhấn để xóa vùng đen
                    </button>
                    <button 
                      onClick={() => { setToolMode('mask-erase'); setShowEraserMenu(false); }}
                      className="w-full text-left px-4 py-2.5 text-xs font-bold text-gray-700 hover:bg-red-50 hover:text-red-700 flex items-center gap-2 transition-colors"
                    >
                      <MousePointer2 size={14} /> Khoanh vùng cần xóa
                    </button>
                  </div>
                )}
             </div>

             <div className="h-4 w-px bg-gray-300 mx-1"></div>

             <button onClick={handleZoomOut} className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"><ZoomOut size={16}/></button>
             <button onClick={handleResetZoom} className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"><RotateCcw size={16}/></button>
             <button onClick={handleZoomIn} className="p-1.5 hover:bg-gray-200 rounded text-gray-500 transition-colors"><ZoomIn size={16}/></button>
           </div>
        )}
      </div>

      <div className="flex-1 relative bg-gray-100/50 overflow-hidden group">
      {isProcessing && (
        <div className="absolute inset-0 z-120 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px]">
              <Loader2 size={32} className="animate-spin text-blue-500 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">Đang xử lý hình ảnh...</p>
           </div>
        )}

        {/* TOOL OVERLAYS */}
        {toolMode === 'rotate' && (
           <div className="absolute top-4 left-1/2 -translate-x-1/2 z-110 bg-white border border-gray-200 p-3 rounded-2xl shadow-xl flex flex-col gap-2 w-64 animate-modal">
             <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Góc: {manualAngle}°</span>
                <button onClick={() => setToolMode('none')} className="text-gray-400 hover:text-gray-950"><CloseIcon size={14}/></button>
             </div>
             <input 
                type="range" min="-15" max="15" step="0.1" 
                value={manualAngle} 
                onChange={(e) => setManualAngle(parseFloat(e.target.value))}
                className="w-full accent-blue-600 h-1.5 bg-gray-100 rounded-lg appearance-none cursor-pointer"
             />
             <button 
                onClick={applyManualRotation}
                className="w-full py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-colors flex items-center justify-center gap-1"
             >
               <Check size={12}/> Áp dụng góc xoay
             </button>
           </div>
        )}

        {previewPage ? (
          <div 
            ref={scrollContainerRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className={`absolute inset-0 overflow-auto flex items-center justify-center p-8 custom-scrollbar ${isPanning ? 'cursor-grabbing' : (toolMode !== 'none' ? (toolMode === 'click-erase' ? 'cursor-pointer' : 'cursor-crosshair') : 'cursor-grab')}`}
          >
            <div 
               className="relative shadow-2xl bg-white border border-gray-200 transition-transform duration-75 ease-out origin-center"
               style={{ 
                  transform: `scale(${zoom}) rotate(${previewPage.rotation + (toolMode === 'rotate' ? manualAngle : 0)}deg)` 
               }}
            >
               <img 
                  ref={imageRef}
                  src={previewPage.imageUrl} 
                  alt="Preview" 
                  className="max-w-[90vw] max-h-[80vh] object-contain block pointer-events-none"
                  draggable={false}
               />
               
               {/* MASK / CROP RECT */}
               {(toolMode === 'mask-erase' || toolMode === 'crop') && maskRect && (
                 <div 
                   className={`absolute border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)] pointer-events-none z-105 ${toolMode === 'crop' ? 'border-indigo-500 bg-indigo-500/10' : 'border-red-500 bg-red-500/20'}`}
                   style={{
                     left: maskRect.x,
                     top: maskRect.y,
                     width: maskRect.w,
                     height: maskRect.h
                   }}
                 >
                   <div className="absolute top-0 right-0 -translate-y-full bg-indigo-600 text-white text-[9px] font-black px-1 rounded-t uppercase tracking-widest">
                     {toolMode === 'crop' ? 'Cắt khung' : 'Xóa đen'}
                   </div>
                 </div>
               )}
            </div>
          </div>
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
