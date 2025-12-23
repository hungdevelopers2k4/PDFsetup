
import React, { useMemo } from 'react';
import { Droppable } from '@hello-pangea/dnd';
import { PDFDocument } from './PDFDocument';
import { PDFDocument as IPDFDocument } from '../types/types';
import { Plus, FilePlus, AlertTriangle } from 'lucide-react';
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

  // Logic nhận diện các số bị thiếu trong dãy số của tài liệu
  const missingNumbers = useMemo(() => {
    if (documents.length < 2) return [];
    
    const sortedNums = documents
      .map(doc => getSortValue(doc.name))
      .filter(n => n >= 0) // Chỉ xét các file có số thực sự (loại bỏ Bia, Muc luc)
      .sort((a, b) => a - b);
    
    if (sortedNums.length === 0) return [];

    const gaps: number[] = [];
    const min = sortedNums[0];
    const max = sortedNums[sortedNums.length - 1];

    for (let i = min + 1; i < max; i++) {
      if (!sortedNums.includes(i)) {
        gaps.push(i);
      }
    }
    return gaps;
  }, [documents]);

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
        element.classList.add('ring-4', 'ring-red-400');
        setTimeout(() => element.classList.remove('ring-4', 'ring-red-400'), 2000);
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
        accept="application/pdf" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={onFileChange}
      />
      
      <div className="flex items-center justify-between px-4 py-2 bg-gray-200/50 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
           <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{isSecondary ? 'Cửa sổ Phụ' : 'Cửa sổ Chính'}</span>
           {missingNumbers.length > 0 && (
             <span className="bg-red-100 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 animate-pulse">
               <AlertTriangle size={10} /> THIẾU {missingNumbers.length} SỐ
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

      {/* Thanh hiển thị các số bị thiếu */}
      {missingNumbers.length > 0 && (
        <div className="bg-white border-b border-gray-200 p-2 overflow-x-auto flex items-center gap-2 shrink-0 custom-scrollbar shadow-inner">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter whitespace-nowrap px-2">Dãy thiếu:</span>
          {missingNumbers.map(num => (
            <button
              key={num}
              onClick={() => scrollToGap(num)}
              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-[11px] font-mono font-bold transition-all whitespace-nowrap shringk-100"
              title={`Nhấn để cuộn đến vị trí số ${num.toString().padStart(3, '0')}`}
            >
              {num.toString().padStart(3, '0')}
            </button>
          ))}
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
