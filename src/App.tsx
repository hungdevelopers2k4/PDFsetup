
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { DragDropContext, DropResult } from '@hello-pangea/dnd';
import { Header } from './components/Header';
import { Workspace } from './components/Workspace';
import { PreviewPanel } from './components/PreviewPanel';
import { usePDFStore } from './context/PDFContext';
import { Save, AlertCircle, CheckCircle2, Loader2, X, Download, FileText, SearchCode, FolderTree, FileSpreadsheet, FileOutput, MapPin, FolderCheck, Trash2, ShieldCheck, Info, ChevronDown, ChevronUp, AlertTriangle, Filter, CheckCircle, Package } from 'lucide-react';
import { exportDocumentToPDF, SequenceResult, collectReportData, ExcelReportRow, exportToExcel } from './utils/utils';

const App: React.FC = () => {
  const { state, dispatch } = usePDFStore();
  
  const [previewWidth, setPreviewWidth] = useState(350);
  const [workspaceSplit, setWorkspaceSplit] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [resizingType, setResizingType] = useState<'preview' | 'split' | null>(null);

  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveProgress, setSaveProgress] = useState({ current: 0, total: 0, name: '', action: 'Ready' });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [excelProgress, setExcelProgress] = useState({ current: 0, total: 0, name: '' });
  const [checkerGroups, setCheckerGroups] = useState<Record<string, SequenceResult[]> | null>(null);
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [fileListToSave, setFileListToSave] = useState<{id: string, name: string, workspace: string}[]>([]);

  // @ts-ignore
  const isFileSystemApiSupported = typeof window.showDirectoryPicker === 'function';

  const groupStats = useMemo(() => {
    if (!checkerGroups) return { total: 0, withErrors: 0, completed: 0, itemsTotal: 0 };
    const groups = Object.entries(checkerGroups) as [string, SequenceResult[]][];
    let itemsTotal = 0;
    let itemsWithErrors = 0;
    
    groups.forEach(([_, results]) => {
      results.forEach(r => {
        itemsTotal++;
        if (r.missing.length > 0 || !r.hasCover || !r.hasTableOfContents) {
          itemsWithErrors++;
        }
      });
    });

    return { 
      total: groups.length, 
      withErrors: itemsWithErrors, 
      completed: itemsTotal - itemsWithErrors,
      itemsTotal
    };
  }, [checkerGroups]);

  useEffect(() => {
    if (showSaveConfirm) {
      const mainFiles = state.documents.map(d => ({ id: d.id, name: d.name, workspace: 'Main' }));
      const secondaryFiles = state.secondaryDocuments.map(d => ({ id: d.id, name: d.name, workspace: 'Secondary' }));
      setFileListToSave([...mainFiles, ...secondaryFiles]);
    }
  }, [showSaveConfirm, state.documents, state.secondaryDocuments]);

  const updateFileNameInList = (id: string, newName: string) => {
    setFileListToSave(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement;
      const isTyping = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isCmdOrCtrl) {
        if (key === 'a' && !isTyping) { e.preventDefault(); dispatch({ type: 'SELECT_ALL_PAGES' }); }
        if (key === 'b') { e.preventDefault(); dispatch({ type: 'SPLIT_SELECTED_PAGES' }); }
        if (key === 'z') { e.preventDefault(); if (e.shiftKey) dispatch({ type: 'REDO' }); else dispatch({ type: 'UNDO' }); }
        if (key === 'y') { e.preventDefault(); dispatch({ type: 'REDO' }); }
        if (key === 's') { e.preventDefault(); setShowSaveConfirm(true); }
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isTyping) dispatch({ type: 'DELETE_SELECTED_PAGES' });
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

  useEffect(() => {
    if (!resizingType) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      if (resizingType === 'preview') {
        const newWidth = containerRect.right - e.clientX;
        setPreviewWidth(Math.max(200, Math.min(newWidth, containerRect.width * 0.6)));
      } else if (resizingType === 'split') {
        const workspaceAreaWidth = containerRect.width - previewWidth;
        const relativeX = e.clientX - containerRect.left;
        setWorkspaceSplit(Math.max(10, Math.min((relativeX / workspaceAreaWidth) * 100, 90)));
      }
    };
    const handleMouseUp = () => { setResizingType(null); document.body.style.cursor = ''; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [resizingType, previewWidth]);

  const onDragEnd = (result: DropResult) => {
    const { source, destination, type } = result;
    if (!destination) return;
    if (type === 'DOCUMENT') {
      const sourceList = source.droppableId === 'workspace-main' ? 'main' : 'secondary';
      const destList = destination.droppableId === 'workspace-main' ? 'main' : 'secondary';
      dispatch({ type: 'MOVE_DOCUMENT', payload: { sourceIndex: source.index, destIndex: destination.index, sourceList, destList } });
    } else if (type === 'PAGE') {
      const parseDroppable = (id: string) => {
        if (!id) return { docId: id, start: 0 };
        const parts = id.split('::');
        if (parts.length >= 5 && parts[1] === 'row' && parts[3] === 'start') {
          const docId = parts[0];
          const start = Number(parts[4]) || 0;
          return { docId, start };
        }
        return { docId: id, start: 0 };
      };

      const parsedSource = parseDroppable(source.droppableId);
      const parsedDest = parseDroppable(destination.droppableId);
      const destIndex = (parsedDest.start || 0) + destination.index;

      dispatch({
        type: 'MOVE_PAGE',
        payload: {
          pageId: result.draggableId,
          sourceDocId: parsedSource.docId,
          destDocId: parsedDest.docId,
          newIndex: destIndex,
        },
      });
    }
  };

  const handleGenerateExcel = async (files: FileList) => {
    setIsGeneratingExcel(true);
    setExcelProgress({ current: 0, total: 0, name: 'Đang khởi tạo...' });
    try {
      const data = await collectReportData(files, (current, total, name) => {
        setExcelProgress({ current, total, name });
      });
      // Tự động tải xuống sau khi xử lý xong
      if (data && data.length > 0) {
        exportToExcel(data);
      } else {
        alert("Không tìm thấy dữ liệu hợp lệ để xuất báo cáo. Hãy kiểm tra cấu trúc thư mục.");
      }
    } catch (error) {
      console.error(error);
      alert("Lỗi phân tích dữ liệu. Hãy đảm bảo đúng cấu trúc Hộp (3 số) / Hồ sơ.");
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const handleSave = async () => {
    const totalDocsCount = fileListToSave.length;
    if (totalDocsCount === 0) return;
    
    setIsSaving(true);
    setSaveStatus('idle');
    setSaveProgress({ current: 0, total: totalDocsCount, name: 'Initializing...', action: 'Waiting for folder selection' });
    
    try {
      const allDocs = [...state.documents, ...state.secondaryDocuments];
      
      if (isFileSystemApiSupported) {
        // @ts-ignore
        const dirHandle = await window.showDirectoryPicker({ 
          mode: 'readwrite',
          id: 'pdf-flow-export'
        });
        
        // @ts-ignore
        if (await dirHandle.queryPermission({ mode: 'readwrite' }) !== 'granted') {
          // @ts-ignore
          await dirHandle.requestPermission({ mode: 'readwrite' });
        }

        for (let i = 0; i < fileListToSave.length; i++) {
          const fileInfo = fileListToSave[i];
          const fileName = fileInfo.name.endsWith('.pdf') ? fileInfo.name : `${fileInfo.name}.pdf`;
          
          setSaveProgress({ current: i + 1, total: totalDocsCount, name: fileName, action: 'Removing existing file...' });
          
          try {
            await dirHandle.removeEntry(fileName);
            await new Promise(r => setTimeout(r, 50));
          } catch (e) {}
          
          setSaveProgress(prev => ({ ...prev, action: 'Encoding document...' }));
          const doc = allDocs.find(d => d.id === fileInfo.id);
          if (!doc) continue;
          
          const pdfBytes = await exportDocumentToPDF(doc);
          
          setSaveProgress(prev => ({ ...prev, action: 'Writing fresh copy...' }));
          const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(pdfBytes);
          await writable.close();
        }
      } else {
        for (let i = 0; i < fileListToSave.length; i++) {
          const fileInfo = fileListToSave[i];
          setSaveProgress({ current: i + 1, total: totalDocsCount, name: fileInfo.name, action: 'Downloading...' });
          
          const doc = allDocs.find(d => d.id === fileInfo.id);
          if (!doc) continue;
          
          const pdfBytes = await exportDocumentToPDF(doc);
          const blob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileInfo.name.endsWith('.pdf') ? fileInfo.name : `${fileInfo.name}.pdf`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
      
      setSaveStatus('success');
      setTimeout(() => { 
        setShowSaveConfirm(false); 
        setSaveStatus('idle'); 
        setIsSaving(false);
        dispatch({ type: 'CLEAR_ALL_DOCUMENTS' });
      }, 2500);
    } catch (err) {
      console.error("Save error:", err);
      setSaveStatus('error');
      setErrorMessage((err as Error).message || "User cancelled or permission denied.");
      setIsSaving(false);
    }
  };

  const canSave = state.documents.length > 0 || state.secondaryDocuments.length > 0;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-50 text-gray-900">
      <Header onCheckSequences={setCheckerGroups} onGenerateExcel={handleGenerateExcel} />
      
      <div ref={containerRef} className="flex flex-1 overflow-hidden relative">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex flex-1 overflow-hidden h-full">
            <div style={{ width: state.secondaryScreenOpen ? `${workspaceSplit}%` : '100%', flex: state.secondaryScreenOpen ? 'none' : '1' }} className="flex flex-col min-w-[200px] relative h-full transition-[width] duration-75 ease-out">
              <Workspace id="workspace-main" documents={state.documents} title="Main Workspace" />
            </div>
            {state.secondaryScreenOpen && (
              <>
                <div onMouseDown={(e) => { e.preventDefault(); setResizingType('split'); }} className="group relative w-1.5 cursor-col-resize z-[60] bg-gray-200 hover:bg-blue-500 transition-colors">
                  <div className="absolute inset-y-0 -left-2 -right-2 z-10" />
                  <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-gray-400 opacity-30 group-hover:opacity-100" />
                </div>
                <div className="flex-1 flex flex-col min-w-[200px] relative h-full">
                  <Workspace id="workspace-secondary" documents={state.secondaryDocuments} title="Secondary Screen" isSecondary />
                </div>
              </>
            )}
          </div>
        </DragDropContext>
        <div onMouseDown={(e) => { e.preventDefault(); setResizingType('preview'); }} className="group relative w-1.5 cursor-col-resize z-[60] bg-gray-200 hover:bg-blue-500 transition-colors border-l border-gray-300">
             <div className="absolute inset-y-0 -left-2 -right-2 z-10" />
             <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-gray-400 opacity-30 group-hover:opacity-100" />
        </div>
        <div style={{ width: previewWidth }} className="flex-shrink-0 min-w-[200px] bg-white h-full border-l border-gray-200">
          <PreviewPanel />
        </div>
      </div>

      {/* Sequence Checker Modal - GROUPED TABLE UI */}
      {checkerGroups && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-950/60 backdrop-blur-sm" onClick={() => setCheckerGroups(null)} />
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-6xl max-h-[92vh] overflow-hidden animate-modal relative flex flex-col border border-gray-100">
            {/* Modal Header */}
            <div className="p-8 border-b border-gray-100 bg-white shrink-0">
               <button onClick={() => setCheckerGroups(null)} className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"><X size={24}/></button>
               <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-5">
                   <div className="p-4 bg-amber-500 text-white rounded-[24px] shadow-lg shadow-amber-100"><SearchCode size={36}/></div>
                   <div>
                     <h2 className="text-3xl font-black text-gray-900 tracking-tight">Rà soát Dãy số Hồ sơ</h2>
                     <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mt-1">Phát hiện hồ sơ lỗi theo từng Hộp lưu trữ</p>
                   </div>
                 </div>

                 <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setShowOnlyErrors(!showOnlyErrors)}
                      className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black transition-all border ${showOnlyErrors ? 'bg-red-600 text-white border-red-700 shadow-lg shadow-red-100' : 'bg-gray-100 text-gray-600 border-gray-200 hover:bg-gray-200'}`}
                    >
                      <Filter size={16} />
                      {showOnlyErrors ? 'ĐANG LỌC HỒ SƠ LỖI' : 'LỌC HỒ SƠ LỖI'}
                    </button>
                 </div>
               </div>
               
               {/* Quick Stats Grid */}
               <div className="grid grid-cols-4 gap-4">
                 <div className="bg-gray-50 p-5 rounded-3xl border border-gray-100 flex flex-col gap-1">
                   <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Số lượng Hộp</p>
                   <p className="text-3xl font-black text-gray-900">{groupStats.total}</p>
                 </div>
                 <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100 flex flex-col gap-1">
                   <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Tổng Hồ sơ</p>
                   <p className="text-3xl font-black text-blue-600">{groupStats.itemsTotal}</p>
                 </div>
                 <div className="bg-red-50 p-5 rounded-3xl border border-red-100 flex flex-col gap-1">
                   <p className="text-[10px] font-black text-red-400 uppercase tracking-widest">Hồ sơ có lỗi</p>
                   <p className="text-3xl font-black text-red-600">{groupStats.withErrors}</p>
                 </div>
                 <div className="bg-green-50 p-5 rounded-3xl border border-green-100 flex flex-col gap-1">
                   <p className="text-[10px] font-black text-green-400 uppercase tracking-widest">Hồ sơ sạch</p>
                   <p className="text-3xl font-black text-green-600">{groupStats.completed}</p>
                 </div>
               </div>
            </div>

            {/* Grouped Content Area */}
            <div className="flex-1 overflow-auto bg-gray-50 custom-scrollbar p-8">
               <div className="space-y-12">
                 {Object.entries(checkerGroups).map(([groupName, results]) => {
                    // Filter results per box if showOnlyErrors is active
                    const displayResults = showOnlyErrors 
                      ? results.filter(r => r.missing.length > 0 || !r.hasCover || !r.hasTableOfContents)
                      : results;

                    // If a box has no results to show, skip rendering it
                    if (displayResults.length === 0) return null;

                    const boxErrorCount = results.filter(r => r.missing.length > 0 || !r.hasCover || !r.hasTableOfContents).length;

                    return (
                      <div key={groupName} className="space-y-4">
                        {/* Box Header Section */}
                        <div className="flex items-center gap-4 px-2">
                           <div className="p-2.5 bg-gray-900 text-white rounded-xl shadow-lg shadow-gray-200"><Package size={20}/></div>
                           <div>
                              <h3 className="text-xl font-black text-gray-900">HỘP SỐ {groupName}</h3>
                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                Có {results.length} hồ sơ • {boxErrorCount > 0 ? <span className="text-red-500">{boxErrorCount} hồ sơ lỗi</span> : <span className="text-green-600">Dãy số đầy đủ</span>}
                              </p>
                           </div>
                        </div>

                        {/* Individual Table for this Box */}
                        <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
                          <table className="w-full text-left border-collapse">
                            <thead>
                               <tr className="bg-gray-100/80 border-b border-gray-200">
                                 <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest w-1/4">Hồ sơ</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-16">Tệp</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-16">Bìa</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-24">Mục lục</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Dãy số bị thiếu</th>
                                 <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center w-28">Trạng thái</th>
                               </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                               {displayResults.map((item, idx) => {
                                 const hasError = item.missing.length > 0 || !item.hasCover || !item.hasTableOfContents;
                                 return (
                                   <tr key={idx} className={`group transition-all hover:bg-gray-50/50 ${hasError ? 'bg-red-50/10' : ''}`}>
                                     <td className="px-6 py-4">
                                       <span className="text-xs font-bold text-gray-700 block truncate" title={item.folderPath}>{item.folderPath}</span>
                                     </td>
                                     <td className="px-6 py-4 text-center">
                                       <span className="text-xs font-mono font-bold text-gray-500">{item.total}</span>
                                     </td>
                                     <td className="px-6 py-4 text-center">
                                       {item.hasCover ? 
                                         <CheckCircle size={18} className="text-green-500 mx-auto" /> : 
                                         <AlertCircle size={18} className="text-red-500 mx-auto" />
                                       }
                                     </td>
                                     <td className="px-6 py-4 text-center">
                                       {item.hasTableOfContents ? 
                                         <CheckCircle size={18} className="text-green-500 mx-auto" /> : 
                                         <AlertCircle size={18} className="text-red-500 mx-auto" />
                                       }
                                     </td>
                                     <td className="px-6 py-4">
                                       {item.missing.length > 0 ? (
                                         <div className="flex flex-wrap gap-1">
                                           {item.missing.map(m => (
                                             <span key={m} className="text-[9px] font-black bg-red-600 text-white px-1.5 py-0.5 rounded shadow-sm">
                                               {m.toString().padStart(3, '0')}
                                             </span>
                                           ))}
                                         </div>
                                       ) : (
                                         <span className="text-[10px] font-bold text-gray-300 italic">Dãy số chuẩn</span>
                                       )}
                                     </td>
                                     <td className="px-6 py-4 text-center">
                                       {hasError ? (
                                         <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 rounded-full text-[10px] font-black border border-red-200">
                                           <AlertTriangle size={12} /> LỖI
                                         </span>
                                       ) : (
                                         <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black border border-green-200">
                                           <CheckCircle2 size={12} /> OK
                                         </span>
                                       )}
                                     </td>
                                   </tr>
                                 );
                               })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                 })}

                 {/* Empty State when filtering */}
                 {showOnlyErrors && Object.values(checkerGroups).every(results => 
                    results.every(r => r.missing.length === 0 && r.hasCover && r.hasTableOfContents)
                 ) && (
                    <div className="flex flex-col items-center justify-center py-32 text-gray-400 gap-4">
                       <div className="p-6 bg-green-50 text-green-600 rounded-full shadow-inner"><CheckCircle2 size={64}/></div>
                       <div className="text-center">
                          <p className="text-xl font-black text-gray-900">Mọi hồ sơ đều Hoàn hảo!</p>
                          <p className="text-sm font-medium">Tất cả hồ sơ trong danh sách đã rà soát đều có đầy đủ Bìa, Mục lục và Dãy số.</p>
                       </div>
                    </div>
                 )}
               </div>
            </div>

            {/* Modal Footer */}
            <div className="p-8 bg-white border-t border-gray-100 text-center shrink-0">
               <button 
                onClick={() => setCheckerGroups(null)}
                className="px-20 py-4 bg-gray-900 text-white rounded-[28px] font-black text-sm hover:bg-black transition-all shadow-2xl shadow-gray-300 active:scale-95"
               >
                 HOÀN TẤT RÀ SOÁT
               </button>
            </div>
          </div>
        </div>
      )}

      {isGeneratingExcel && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" />
          <div className="bg-white p-8 rounded-3xl shadow-2xl w-full max-w-md flex flex-col items-center gap-6 animate-modal border border-gray-100 relative z-10">
            <div className="p-5 bg-green-50 text-green-600 rounded-2xl shadow-inner animate-pulse"><FileSpreadsheet size={48} /></div>
            <div className="text-center w-full">
              <h3 className="text-xl font-black text-gray-800">Đang thống kê hồ sơ</h3>
              <div className="mt-4 h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all duration-300"
                  style={{ width: `${(excelProgress.current / excelProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs font-bold text-gray-400 uppercase mt-4 tracking-widest">
                Đang xử lý: {excelProgress.current} / {excelProgress.total}
              </p>
              <p className="text-sm text-gray-600 mt-1 font-medium truncate w-full px-4 italic">
                {excelProgress.name}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Save Button */}
      <div className="fixed bottom-6 left-6 z-50">
        <button 
          onClick={() => setShowSaveConfirm(true)} 
          disabled={!canSave} 
          className={`group flex items-center gap-3 px-8 py-4 bg-gray-900 text-white rounded-full shadow-[0_20px_50px_rgba(0,0,0,0.3)] hover:bg-black active:scale-95 transition-all ${!canSave ? 'opacity-50 cursor-not-allowed grayscale' : 'hover:scale-105'}`}
        >
          <div className="p-2 bg-blue-600 rounded-full group-hover:rotate-12 transition-transform">
            <Save size={20} />
          </div>
          <span className="font-black tracking-tight text-sm">SAVE WORKSPACE</span>
        </button>
      </div>

      {showSaveConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-950/70 backdrop-blur-md" onClick={() => !isSaving && setShowSaveConfirm(false)} />
          <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-xl overflow-hidden animate-modal relative border border-white/20">
            <button onClick={() => !isSaving && setShowSaveConfirm(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 transition-colors p-2 hover:bg-gray-100 rounded-full"><X size={20} /></button>
            
            <div className="p-10">
              {isSaving ? (
                <div className="flex flex-col items-center gap-8 py-4 text-center">
                  <div className="relative w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 border-4 border-gray-100 rounded-full" />
                    <div 
                      className="absolute inset-0 border-4 border-blue-600 rounded-full transition-all duration-300" 
                      style={{ 
                        clipPath: `polygon(50% 50%, -50% -50%, ${Math.round((saveProgress.current / saveProgress.total) * 100)}% -50%, ${Math.round((saveProgress.current / saveProgress.total) * 100)}% 150%, -50% 150%)`,
                        transform: 'rotate(-90deg)'
                      }}
                    />
                    <Loader2 size={48} className="animate-spin text-blue-600" />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-gray-900">Batch Processing...</h2>
                    <div className="flex items-center justify-center gap-2">
                      <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-full border border-red-100 animate-pulse">CLEANING & REPLACING</span>
                      <span className="text-[10px] font-black text-gray-400">FILE {saveProgress.current} OF {saveProgress.total}</span>
                    </div>
                    <p className="text-sm font-bold text-blue-600 truncate max-w-[350px] mx-auto mt-4 px-4 bg-blue-50 py-2 rounded-xl">"{saveProgress.name}"</p>
                    <p className="text-[10px] text-gray-400 font-mono mt-1 uppercase tracking-widest">{saveProgress.action}</p>
                  </div>
                </div>
              ) : saveStatus === 'success' ? (
                <div className="flex flex-col items-center gap-6 py-8 text-center">
                  <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full flex items-center justify-center shadow-inner scale-110"><CheckCircle2 size={56} /></div>
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black text-gray-900">Successfully Saved!</h2>
                    <p className="text-sm text-gray-500 max-w-sm">All files have been successfully written to the folder. Workspaces will now be cleared.</p>
                  </div>
                </div>
              ) : saveStatus === 'error' ? (
                <div className="flex flex-col items-center gap-6 py-8 text-center">
                  <div className="w-24 h-24 bg-red-100 text-red-600 rounded-full flex items-center justify-center shadow-inner"><AlertCircle size={56} /></div>
                  <div className="space-y-2">
                    <h2 className="text-2xl font-black text-gray-900">Process Halted</h2>
                    <p className="text-sm text-gray-500 font-medium bg-red-50 p-4 rounded-2xl border border-red-100">Error: {errorMessage}</p>
                    <button onClick={() => setSaveStatus('idle')} className="mt-6 px-10 py-3 bg-gray-900 text-white rounded-2xl text-sm font-black hover:bg-black transition-all">Retry Export</button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-4 mb-8">
                    <div className="p-4 bg-blue-600 text-white rounded-[24px] shadow-xl shadow-blue-100"><FolderCheck size={32} /></div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-black text-gray-900 tracking-tight">Bulk Export Manager</h2>
                      <p className="text-sm text-gray-500 font-medium">Prepare to sync <span className="text-blue-600 font-bold">{fileListToSave.length} documents</span> to your local system.</p>
                    </div>
                  </div>

                  <div className="bg-amber-50 rounded-2xl p-5 border border-amber-100 mb-8 flex gap-4 items-start">
                    <div className="p-2 bg-amber-200 text-amber-800 rounded-xl shrink-0"><Trash2 size={20} /></div>
                    <div className="space-y-1">
                      <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Zero-Conflict Replacement</p>
                      <p className="text-[11px] text-amber-700 leading-relaxed">The application will automatically <strong>delete</strong> existing files in the target folder before writing new ones. This prevents browser-auto-renaming like "(1).pdf".</p>
                    </div>
                  </div>

                  {!isFileSystemApiSupported && (
                     <div className="bg-red-50 rounded-2xl p-4 border border-red-100 mb-8 flex gap-3 items-center text-red-700">
                        <Info size={18} />
                        <p className="text-[10px] font-bold">Your browser does not support Folder Access. You will be prompted to download files individually.</p>
                     </div>
                  )}

                  <div className="space-y-2 mb-8 max-h-[220px] overflow-y-auto custom-scrollbar pr-2">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">File Registry</p>
                    {fileListToSave.map(file => (
                      <div key={file.id} className="flex items-center gap-3 bg-gray-50 p-3 rounded-2xl border border-gray-100 group hover:border-blue-200 hover:bg-blue-50/30 transition-all">
                        <FileText size={18} className="text-red-500 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <input 
                            type="text" 
                            value={file.name} 
                            onChange={(e) => updateFileNameInList(file.id, e.target.value)} 
                            className="w-full text-xs font-black bg-transparent focus:outline-none focus:border-blue-400 border-b border-transparent text-gray-800" 
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-black px-2 py-0.5 bg-white border border-gray-200 text-gray-400 rounded-lg uppercase shadow-sm">{file.workspace}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setShowSaveConfirm(false)} className="flex-1 px-4 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black text-sm hover:bg-gray-200 transition-all">Cancel</button>
                    <button onClick={handleSave} className="flex-[2] px-6 py-4 bg-gray-900 text-white rounded-2xl font-black text-sm hover:bg-black flex items-center justify-center gap-3 shadow-2xl shadow-gray-200 transition-all active:scale-95">
                      <ShieldCheck size={20} className="text-blue-400" />
                      AUTHORIZE & SAVE ALL
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
