
import React, { useRef } from 'react';
import { 
  RotateCcw, 
  RotateCw, 
  Scissors, 
  Trash2, 
  Undo2, 
  Redo2, 
  Columns,
  FolderOpen,
  FilePlus,
  SearchCode,
  Files,
  FileStack,
  FileSpreadsheet,
  SortAsc
} from 'lucide-react';
import { usePDFStore } from '../context/PDFContext';
import { analyzeFolderSequences, SequenceResult } from '../utils/utils';

interface HeaderProps {
  onCheckSequences: (results: Record<string, SequenceResult[]>) => void;
  onGenerateExcel: (files: FileList) => void;
}

export const Header: React.FC<HeaderProps> = ({ onCheckSequences, onGenerateExcel }) => {
  const { state, dispatch, importFiles } = usePDFStore();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const splitMergeInputRef = useRef<HTMLInputElement>(null);
  const checkerInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const handleSplit = () => dispatch({ type: 'SPLIT_SELECTED_PAGES' });
  const handleDelete = () => dispatch({ type: 'DELETE_SELECTED_PAGES' });
  const handleRotateLeft = () => dispatch({ type: 'ROTATE_SELECTED_PAGES', payload: 'left' });
  const handleRotateRight = () => dispatch({ type: 'ROTATE_SELECTED_PAGES', payload: 'right' });
  const handleUndo = () => dispatch({ type: 'UNDO' });
  const handleRedo = () => dispatch({ type: 'REDO' });
  const toggleSecondary = () => dispatch({ type: 'TOGGLE_SECONDARY_SCREEN' });
  const handleSortMain = () => dispatch({ type: 'SORT_DOCUMENTS', payload: { target: 'main' } });
  
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>, target: 'main' | 'secondary' = 'main') => {
    importFiles(e.target.files, target);
    if (target === 'secondary' && !state.secondaryScreenOpen) {
      dispatch({ type: 'TOGGLE_SECONDARY_SCREEN' });
    }
    e.target.value = '';
  };

  const onCheckerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const results = analyzeFolderSequences(e.target.files);
      onCheckSequences(results);
    }
    e.target.value = '';
  };

  const onExcelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onGenerateExcel(e.target.files);
    }
    e.target.value = '';
  };

  const hasSelection = state.selection.selectedPageIds.size > 0;
  const hasDocuments = state.documents.length > 0;

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-30 relative">
      <input 
        type="file" 
        multiple 
        accept="application/pdf,text/plain" 
        className="hidden" 
        ref={fileInputRef} 
        onChange={(e) => onFileChange(e, 'main')}
      />
      <input 
        type="file" 
        // @ts-ignore
        webkitdirectory="" 
        directory=""
        multiple
        className="hidden" 
        ref={folderInputRef} 
        onChange={(e) => onFileChange(e, 'main')}
      />
      <input 
        type="file" 
        multiple 
        accept="application/pdf,text/plain" 
        className="hidden" 
        ref={splitMergeInputRef} 
        onChange={(e) => onFileChange(e, 'secondary')}
      />
      <input 
        type="file" 
        // @ts-ignore
        webkitdirectory="" 
        directory=""
        multiple
        className="hidden" 
        ref={checkerInputRef} 
        onChange={onCheckerChange}
      />
      <input 
        type="file" 
        // @ts-ignore
        webkitdirectory="" 
        directory=""
        multiple
        className="hidden" 
        ref={excelInputRef} 
        onChange={onExcelChange}
      />

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 font-bold text-xl text-blue-700 mr-2">
           <div className="w-9 h-9 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg rotate-3">
             <Files size={20} />
           </div>
           <span className="hidden xl:inline tracking-tighter">PDF Flow Pro</span>
        </div>

        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        <div className="flex items-center gap-1">
           <button 
             onClick={() => fileInputRef.current?.click()} 
             className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0"
             title="Thêm File (PDF hoặc TXT)"
           >
             <FilePlus size={16} className="text-blue-600" />
             <span className="hidden lg:inline">Thêm File</span>
           </button>
           
           <button 
             onClick={() => folderInputRef.current?.click()} 
             className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 rounded-lg text-xs font-bold transition-all shadow-sm shrink-0"
             title="Mở Thư mục"
           >
             <FolderOpen size={16} className="text-amber-600" />
             <span className="hidden lg:inline">Mở Thư mục</span>
           </button>

           <button 
             onClick={() => splitMergeInputRef.current?.click()} 
             className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold transition-all shadow-md active:scale-95 shrink-0"
             title="Luôn thêm vào Cửa sổ Phụ"
           >
             <FileStack size={16} />
             <span>Split/Merge</span>
           </button>
           
           <div className="h-8 w-px bg-gray-200 mx-1"></div>

           <button 
             onClick={() => checkerInputRef.current?.click()} 
             className="flex items-center gap-2 px-3 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold transition-all shadow-sm group shrink-0"
             title="Rà soát dãy số"
           >
             <SearchCode size={16} className="group-hover:scale-110 transition-transform" />
             <span>Check Sequence</span>
           </button>

           <button 
             onClick={() => excelInputRef.current?.click()} 
             className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg text-xs font-bold transition-all shadow-sm group shrink-0"
             title="Xuất Báo cáo Excel"
           >
             <FileSpreadsheet size={16} className="group-hover:scale-110 transition-transform" />
             <span>Excel Report</span>
           </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex bg-gray-100 p-1 rounded-xl gap-0.5 border border-gray-200 shadow-inner">
          <IconButton 
            onClick={handleSortMain} 
            disabled={!hasDocuments} 
            icon={<SortAsc size={16} />} 
            title="Sắp xếp tự động" 
            className="text-amber-600 hover:bg-white"
          />
        </div>

        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        <div className="flex bg-gray-100 p-1 rounded-xl gap-0.5 border border-gray-200 shadow-inner">
          <IconButton onClick={handleRotateLeft} disabled={!hasSelection} icon={<RotateCcw size={16} />} title="Xoay Trái" />
          <IconButton onClick={handleRotateRight} disabled={!hasSelection} icon={<RotateCw size={16} />} title="Xoay Phải" />
        </div>
        
        <div className="flex bg-gray-100 p-1 rounded-xl gap-0.5 ml-1 border border-gray-200 shadow-inner">
           <IconButton 
             onClick={handleSplit} 
             disabled={!hasSelection} 
             icon={<Scissors size={16} />} 
             title="Tách PDF (Cmd/Ctrl + B)" 
             className="text-blue-600 hover:bg-white hover:text-blue-700" 
           />
           <IconButton 
             onClick={handleDelete} 
             disabled={!hasSelection} 
             icon={<Trash2 size={16} />} 
             title="Xóa trang (Del)" 
             className="text-red-500 hover:bg-white hover:text-red-600" 
           />
        </div>

        <div className="h-8 w-px bg-gray-200 mx-1"></div>

        <div className="flex items-center gap-0.5 bg-gray-100 p-1 rounded-xl border border-gray-200 shadow-inner">
          <IconButton onClick={handleUndo} disabled={state.history.past.length === 0} icon={<Undo2 size={16} />} title="Undo (Cmd/Ctrl + Z)" />
          <IconButton onClick={handleRedo} disabled={state.history.future.length === 0} icon={<Redo2 size={16} />} title="Redo (Cmd/Ctrl + Y)" />
        </div>
        
        <div className="ml-1">
            <button 
              onClick={toggleSecondary} 
              className={`p-2 rounded-xl transition-all shadow-sm border flex items-center gap-1 ${state.secondaryScreenOpen ? 'bg-blue-600 text-white border-blue-700' : 'bg-white text-gray-500 hover:bg-gray-50 border-gray-200'}`} 
              title="Đổi giao diện song song"
            >
                <Columns size={18} />
                {state.secondaryScreenOpen && <span className="text-[10px] font-bold uppercase">Dual</span>}
            </button>
        </div>
      </div>
    </header>
  );
};

const IconButton = ({ onClick, disabled, icon, title, className = '' }: any) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={`p-1.5 rounded-lg transition-all ${
      disabled 
        ? 'opacity-30 cursor-not-allowed text-gray-400' 
        : `hover:bg-white hover:shadow-sm text-gray-700 active:scale-90 ${className}`
    }`}
  >
    {icon}
  </button>
);
