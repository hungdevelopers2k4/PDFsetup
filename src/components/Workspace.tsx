
import React, { useMemo } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { PDFDocument } from './PDFDocument';
import { PDFDocument as IPDFDocument } from '../types/types';
import { Plus, FilePlus, AlertTriangle, Loader2 } from 'lucide-react';
import { usePDFStore } from '../context/PDFContext';
import { getSortValue } from '../utils/utils';

interface Props {
  id: string;
  documents: IPDFDocument[];
  title: string;
  isSecondary?: boolean;
}

export const Workspace: React.FC<Props> = ({ id, documents, title, isSecondary }) => {
  const { importFiles, dispatch } = usePDFStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const handleAddClick = () => {
    fileInputRef.current?.click();
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    importFiles(e.target.files, isSecondary ? 'secondary' : 'main');
    e.target.value = '';
  };

  const handleFocus = () => {
    dispatch({ type: 'SET_FOCUS_WORKSPACE', payload: isSecondary ? 'secondary' : 'main' });
  };

  // Kiểm tra xem có bất kỳ tài liệu nào đang trong quá trình xử lý (isLoading) không
  const isProcessing = useMemo(() => documents.some(doc => doc.isLoading), [documents]);

  // Logic nhận diện các số bị thiếu trong dãy số của tài liệu
  const missingNumbers = useMemo(() => {
    // Chỉ rà soát dãy số ở cửa sổ Chính (Main)
    // KHÔNG hiển thị nếu đang trong quá trình nạp dữ liệu (isProcessing)
    if (isSecondary || documents.length === 0 || isProcessing) return [];
    
    const sortedNums = documents
      .map(doc => getSortValue(doc.name))
      .filter(n => n >= 0 && n < 999999) // Bao gồm cả số 0 (n >= 0)
      .sort((a, b) => a - b);
    
    if (sortedNums.length === 0) return [];

    const gaps: number[] = [];
    const max = sortedNums[sortedNums.length - 1];

    const numSet = new Set(sortedNums);
    // Vòng lặp chạy từ 0 đến số lớn nhất hiện có
    for (let i = 0; i <= max; i++) {
      if (!numSet.has(i)) {
        gaps.push(i);
      }
    }
    return gaps;
  }, [documents, isSecondary, isProcessing]);

  const scrollToGap = (missingNum: number) => {
    if (!scrollContainerRef.current) return;

    // Tìm document đầu tiên có số thứ tự lớn hơn số bị thiếu để cuộn tới đó
    const nextDoc = documents.find(doc => getSortValue(doc.name) > missingNum);
    if (nextDoc) {
      const anchorId = `doc-anchor-${getSortValue(nextDoc.name)}`;
      const element = document.getElementById(anchorId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Hiệu ứng highlight nháy nhẹ
        element.classList.add('ring-4', 'ring-red-400', 'ring-offset-2');
        setTimeout(() => element.classList.remove('ring-4', 'ring-red-400', 'ring-offset-2'), 2000);
      }
    }
  };
  
  return (
    <div 
      className="flex-1 flex flex-col h-full bg-gray-100/50 min-w-0"
      onMouseDown={handleFocus}
    >
      <input 
        type="file" 
        multiple 
        accept="application/pdf,text/plain" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={onFileChange}
      />
      
      <div className="flex items-center justify-between px-4 py-2 bg-gray-200/50 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
           <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isSecondary ? 'Cửa sổ Phụ' : 'Cửa sổ Chính'}</span>
           
           {isProcessing ? (
             <span className="bg-blue-500 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-sm">
               <Loader2 size={10} className="animate-spin" /> ĐANG XỬ LÝ DỮ LIỆU...
             </span>
           ) : missingNumbers.length > 0 && (
             <span className="bg-red-600 text-white px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 animate-pulse shadow-sm">
               <AlertTriangle size={10} /> THIẾU {missingNumbers.length} HỒ SƠ
             </span>
           )}
        </div>
        <button 
           onClick={handleAddClick}
           className="p-1 hover:bg-gray-200 rounded text-gray-600 transition-colors"
           title="Thêm file vào vùng này"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Thanh hiển thị các số bị thiếu - Chỉ hiện khi KHÔNG processing */}
      {!isProcessing && missingNumbers.length > 0 && (
        <div className="bg-white border-b border-red-100 p-2.5 overflow-x-auto flex items-center gap-2 shrink-0 custom-scrollbar shadow-inner">
          <div className="flex items-center gap-2 px-2 shrink-0 border-r border-gray-100 mr-1">
             <AlertTriangle size={14} className="text-red-500" />
             <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest whitespace-nowrap">Dãy thiếu:</span>
          </div>
          <div className="flex items-center gap-2">
            {missingNumbers.map(num => (
              <button
                key={num}
                onClick={() => scrollToGap(num)}
                className="px-2.5 py-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-600 border border-red-200 rounded-md text-[11px] font-mono font-bold transition-all whitespace-nowrap shrink-0 shadow-sm"
                title={`Nhấn để cuộn đến vị trí số ${num.toString().padStart(3, '0')}`}
              >
                {num.toString().padStart(3, '0')}
              </button>
            ))}
          </div>
        </div>
      )}

      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4 custom-scrollbar"
      >
        <Droppable droppableId={id} type="DOCUMENT">
          {(provided, snapshot) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`min-h-52 transition-colors ${snapshot.isDraggingOver ? 'bg-blue-50/30' : ''}`}
            >
              {documents.length === 0 ? (
                <div 
                  onClick={handleAddClick}
                  className="h-80 flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded-2xl m-4 cursor-pointer hover:bg-white hover:border-blue-400 hover:text-blue-500 transition-all group"
                >
                  <div className="p-4 bg-gray-100 rounded-full mb-3 group-hover:bg-blue-50 transition-colors">
                    <FilePlus size={32} />
                  </div>
                  <p className="font-bold">Kéo thả file vào đây</p>
                  <p className="text-xs">Hoặc click để chọn file PDF cần tách/ghép</p>
                </div>
              ) : (
                documents.map((doc, index) => (
                  <PDFDocument key={doc.id} document={doc} index={index} />
                ))
              )}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    </div>
  );
};
