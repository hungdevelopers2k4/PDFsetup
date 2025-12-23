
import { v4 as uuidv4 } from 'uuid';
import { Page, PDFDocument } from '../types/types';
import * as pdfjsModule from 'pdfjs-dist';
// @ts-ignore
import { PDFDocument as PDFLibDoc } from 'pdf-lib';
// @ts-ignore
import XLSX from 'xlsx-js-style';

const pdfjs = (pdfjsModule as any).default || pdfjsModule;

if (pdfjs.GlobalWorkerOptions) {
  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
}

// Helper function to extract sort value from filename
export const getSortValue = (name: string): number => {
  const cleanName = name.replace(/\.[^/.]+$/, "").toLowerCase();
  
  if (cleanName.includes('bia')) return -20000;
  if (/^[0]+$/.test(cleanName)) return -10000;
  
  const match = cleanName.match(/(\d+)$/);
  if (match) return parseInt(match[1], 10);
  
  const anyMatch = cleanName.match(/\d+/);
  if (anyMatch) return parseInt(anyMatch[0], 10);
  
  return 999999;
};

export const formatFileName = (name: string): string => {
  if (!name) return '';
  const nameWithoutExt = name.replace(/\.[pP][dD][fF]$/, '');
  const parts = nameWithoutExt.split('.');
  return parts[parts.length - 1] || nameWithoutExt;
};

export interface SequenceResult {
  groupName: string;
  folderPath: string;
  total: number;
  missing: number[];
  range: { min: number, max: number };
  hasCover: boolean;
  hasTableOfContents: boolean;
}

export interface ExcelReportRow {
  date: string;
  phongSo: string;
  mucLuc: string;
  hopSo: string;
  hoSoSo: string;
  soLuongTo: string;
  a3: number;
  a4: number;
  quyDoiA4: number;
  ghiChuScan: string;
  nguoiRaSoat: string;
  ghiChuRaSoat: string;
}

export const analyzeFolderSequences = (files: FileList | File[]): Record<string, SequenceResult[]> => {
  const fileGroups: Record<string, Record<string, File[]>> = {};
  
  Array.from(files).forEach(file => {
    const fullPath = (file as any).webkitRelativePath || file.name;
    const parts = fullPath.split('/');
    
    let hop = "";
    let hoso = "";

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (/^\d{3}$/.test(p)) {
        hop = p;
        if (i + 1 < parts.length && parts[i+1].includes('.')) {
          hoso = "Root";
        } else if (i + 1 < parts.length) {
          hoso = parts[i+1];
        }
        break;
      }
    }

    if (!hop && parts.length > 1) {
      hop = parts[parts.length - 2];
      hoso = "General";
    }

    if (hop && hoso) {
      if (!fileGroups[hop]) fileGroups[hop] = {};
      if (!fileGroups[hop][hoso]) fileGroups[hop][hoso] = [];
      fileGroups[hop][hoso].push(file);
    }
  });

  const finalGroups: Record<string, SequenceResult[]> = {};
  Object.entries(fileGroups).forEach(([group, subs]) => {
    const results: SequenceResult[] = [];
    Object.entries(subs).forEach(([path, fList]) => {
      const pdfs = fList.filter(f => f.name.toLowerCase().endsWith('.pdf'));
      if (pdfs.length === 0) return;

      const nums: number[] = [];
      let cover = false, toc = false;
      pdfs.forEach(f => {
        const name = formatFileName(f.name).toLowerCase();
        if (name.includes('bia')) cover = true;
        else if (/^[0]+$/.test(name)) toc = true;
        else {
          const match = name.match(/(\d+)$/);
          if (match) nums.push(parseInt(match[1], 10));
          else {
            const anyNum = name.match(/\d+/);
            if (anyNum) nums.push(parseInt(anyNum[0], 10));
          }
        }
      });

      const max = nums.length > 0 ? Math.max(...nums) : 0;
      const missing: number[] = [];
      const set = new Set(nums);
      for (let i = 1; i <= max; i++) {
        if (!set.has(i)) missing.push(i);
      }

      results.push({
        groupName: group,
        folderPath: path,
        total: pdfs.length,
        missing,
        range: { min: nums.length > 0 ? Math.min(...nums) : 1, max },
        hasCover: cover,
        hasTableOfContents: toc
      });
    });
    if (results.length > 0) finalGroups[group] = results.sort((a,b) => a.folderPath.localeCompare(b.folderPath));
  });
  return finalGroups;
};

export const analyzePdfPageSizes = async (file: File): Promise<{ a3: number, a4: number }> => {
  let loadingTask = null;
  try {
    const buffer = await file.arrayBuffer();
    loadingTask = pdfjs.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    let a3 = 0, a4 = 0;
    const THRESHOLD = 650 * 900; 

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const { width, height } = page.getViewport({ scale: 1 });
      if ((width * height) > THRESHOLD) a3++;
      else a4++;
    }
    
    await pdf.destroy();
    return { a3, a4 };
  } catch (error) {
    console.error(`Lỗi tệp ${file.name}:`, error);
    return { a3: 0, a4: 0 };
  }
};

export const collectReportData = async (
  files: FileList | File[], 
  onProgress?: (current: number, total: number, name: string) => void
): Promise<ExcelReportRow[]> => {
  const now = new Date();
  const dateStr = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
  
  const reportGroups: Record<string, Record<string, File[]>> = {};
  
  Array.from(files).forEach(file => {
    if (!file.name.toLowerCase().endsWith('.pdf')) return;
    
    const fullPath = (file as any).webkitRelativePath || file.name;
    const parts = fullPath.split('/');
    
    let h = "";
    let hs = "";

    for (let i = 0; i < parts.length - 1; i++) {
      if (/^\d{3}$/.test(parts[i])) {
        h = parts[i];
        hs = parts[i+1];
        break;
      }
    }

    if (h && hs) {
      if (!reportGroups[h]) reportGroups[h] = {};
      if (!reportGroups[h][hs]) reportGroups[h][hs] = [];
      reportGroups[h][hs].push(file);
    }
  });

  const allRecords: {h: string, hs: string, files: File[]}[] = [];
  Object.entries(reportGroups).forEach(([h, subs]) => {
    Object.entries(subs).forEach(([hs, fList]) => {
      allRecords.push({ h, hs, files: fList });
    });
  });

  allRecords.sort((a, b) => {
    const hCompare = a.h.localeCompare(b.h, undefined, { numeric: true });
    if (hCompare !== 0) return hCompare;
    return a.hs.localeCompare(b.hs, undefined, { numeric: true });
  });

  const rows: ExcelReportRow[] = [];
  for (let i = 0; i < allRecords.length; i++) {
    const record = allRecords[i];
    if (onProgress) onProgress(i + 1, allRecords.length, `Hộp ${record.h} - HS ${record.hs}`);
    
    let a3 = 0, a4 = 0;
    for (const f of record.files) {
      const res = await analyzePdfPageSizes(f);
      a3 += res.a3; 
      a4 += res.a4;
    }

    rows.push({
      date: dateStr, phongSo: '01', mucLuc: '01', hopSo: record.h, hoSoSo: record.hs,
      soLuongTo: '', a3, a4, quyDoiA4: (a3 * 2) + a4,
      ghiChuScan: '', nguoiRaSoat: '', ghiChuRaSoat: ''
    });
  }
  return rows;
};

export const exportToExcel = (data: ExcelReportRow[]) => {
  const headers = [
    'Ngày', 'Phông số', 'Mục lục', 'Hộp số', 'Hồ sơ số', 
    'Số lượng tờ', 'A3', 'A4', 'Quy đổi A4', 
    'Ghi chú Scan', 'Người rà soát', 'Ghi chú rà soát'
  ];

  const BOX_COLORS = [
    'FFD9EAD3', 'FFFFF2CC', 'FFF4CCCC', 'FFC9DAF8', 
    'FFEAD1DC', 'FFFCE5CD', 'FFD0E0E3', 'FFEFEFEF',
  ];

  const uniqueHops = Array.from(new Set(data.map(r => r.hopSo))).sort();
  const hopColorMap: Record<string, string> = {};
  uniqueHops.forEach((hop, idx) => {
    hopColorMap[hop] = BOX_COLORS[idx % BOX_COLORS.length];
  });

  const sheetData: any[][] = [headers.map(h => ({ 
    v: h, 
    s: { 
      font: { bold: true }, 
      fill: { fgColor: { rgb: "FFCCCCCC" } }, 
      border: { 
        top: { style: "thin" }, bottom: { style: "thin" }, 
        left: { style: "thin" }, right: { style: "thin" } 
      },
      alignment: { vertical: "center", horizontal: "center" }
    } 
  }))];

  data.forEach(row => {
    const rowColor = hopColorMap[row.hopSo];
    const baseStyle = {
      font: { bold: false },
      fill: { fgColor: { rgb: rowColor } },
      border: { 
        top: { style: "thin" }, bottom: { style: "thin" }, 
        left: { style: "thin" }, right: { style: "thin" } 
      },
      alignment: { vertical: "center", horizontal: "center" }
    };

    sheetData.push([
      { v: row.date, s: baseStyle },
      { v: row.phongSo, s: baseStyle },
      { v: row.mucLuc, s: baseStyle },
      { v: row.hopSo, s: { ...baseStyle, font: { bold: true } } }, 
      { v: row.hoSoSo, s: { ...baseStyle, font: { bold: true } } }, 
      { v: row.soLuongTo, s: baseStyle },
      { v: row.a3, s: baseStyle },
      { v: row.a4, s: baseStyle },
      { v: row.quyDoiA4, s: { ...baseStyle, font: { bold: true, color: { rgb: "FFCC0000" } } } },
      { v: row.ghiChuScan, s: baseStyle },
      { v: row.nguoiRaSoat, s: baseStyle },
      { v: row.ghiChuRaSoat, s: baseStyle }
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, 
    { wch: 12 }, { wch: 8 }, { wch: 8 }, { wch: 12 }, 
    { wch: 15 }, { wch: 15 }, { wch: 15 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Báo cáo thống kê");
  XLSX.writeFile(wb, `Bao_cao_thong_ke_${new Date().getTime()}.xlsx`);
};

export const processFile = async (file: File): Promise<PDFDocument> => {
  try {
    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const id = uuidv4();
    const pages: Page[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const vp = page.getViewport({ scale: 1.1 });
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.height = vp.height; canvas.width = vp.width;
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      pages.push({ id: uuidv4(), documentId: id, originalIndex: i, imageUrl: canvas.toDataURL('image/jpeg', 0.8), rotation: 0 });
    }
    await pdf.destroy();
    return { id, name: file.name, pages, isExpanded: true };
  } catch (error) {
    return { id: uuidv4(), name: `Error: ${file.name}`, pages: [], isExpanded: false };
  }
};

export const processImageFile = async (file: File): Promise<Page> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      resolve({
        id: uuidv4(),
        documentId: '', 
        originalIndex: 1,
        imageUrl: e.target?.result as string,
        rotation: 0
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const exportDocumentToPDF = async (doc: PDFDocument): Promise<Uint8Array> => {
  const pdfDoc = await PDFLibDoc.create();
  if (doc.pages.length === 0) {
    pdfDoc.addPage([595.28, 841.89]);
  } else {
    for (const p of doc.pages) {
      const bytes = Uint8Array.from(atob(p.imageUrl.split(',')[1]), c => c.charCodeAt(0));
      const img = await pdfDoc.embedJpg(bytes);
      const { width, height } = img.scale(1);
      const page = pdfDoc.addPage([width, height]);
      page.drawImage(img, { x: 0, y: 0, width, height, rotate: { type: 'degrees', angle: p.rotation } });
    }
  }
  return await pdfDoc.save();
};
