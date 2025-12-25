
export class PDFImageProcessor {
  /**
   * Xoay ảnh dựa trên góc tùy chỉnh (Fine Rotation)
   * Thuật toán lấy mẫu màu nền thông minh sử dụng Median (Trung vị)
   */
  static rotateImage(canvas: HTMLCanvasElement, angle: number): HTMLCanvasElement {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const w = canvas.width;
    const h = canvas.height;

    const imageData = ctx.getImageData(0, 0, w, h);
    const pixels = imageData.data;
    
    // Tăng mật độ lấy mẫu lên 50x50 để bao quát toàn bộ khổ giấy
    const samples: {r: number, g: number, b: number, brightness: number}[] = [];
    const gridSteps = 50;
    const stepX = Math.max(1, Math.floor(w / gridSteps));
    const stepY = Math.max(1, Math.floor(h / gridSteps));

    for (let gy = 0; gy < gridSteps; gy++) {
      for (let gx = 0; gx < gridSteps; gx++) {
        const x = gx * stepX;
        const y = gy * stepY;
        if (x >= w || y >= h) continue;

        const idx = (y * w + x) * 4;
        const r = pixels[idx];
        const g = pixels[idx + 1];
        const b = pixels[idx + 2];
        
        // Lọc các pixel có khả năng là màu nền (sáng và trung tính)
        // Ngưỡng 150 để bắt được cả giấy hơi tối màu hoặc cũ
        if (r > 150 && g > 150 && b > 150) {
          const diff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
          // Chỉ lấy các màu trung tính (không phải màu sắc đậm)
          if (diff < 25) {
            samples.push({ r, g, b, brightness: r + g + b });
          }
        }
      }
    }

    let avgR = 255, avgG = 255, avgB = 255;
    
    if (samples.length > 0) {
      /**
       * Sử dụng thuật toán Median (Trung vị) để tìm màu nền chuẩn xác nhất.
       * Điều này cực kỳ hiệu quả vì nó loại bỏ các giá trị ngoại lai (text, hình ảnh).
       */
      samples.sort((a, b) => a.brightness - b.brightness);
      const medianIndex = Math.floor(samples.length / 2);
      const medianColor = samples[medianIndex];
      avgR = medianColor.r;
      avgG = medianColor.g;
      avgB = medianColor.b;
    } else {
      // Nếu không tìm thấy màu sáng, lấy mẫu từ các góc (thường là lề giấy)
      const corners = [0, (w-1)*4, (h-1)*w*4, (h*w-1)*4];
      let rS = 0, gS = 0, bS = 0;
      corners.forEach(c => {
        rS += pixels[c]; gS += pixels[c+1]; bS += pixels[c+2];
      });
      avgR = rS / 4; avgG = gS / 4; avgB = bS / 4;
    }

    const backgroundColor = `rgb(${avgR}, ${avgG}, ${avgB})`;

    const newCanvas = document.createElement('canvas');
    const newCtx = newCanvas.getContext('2d', { willReadFrequently: true })!;
    const rad = (angle * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    
    newCanvas.width = w * cos + h * sin;
    newCanvas.height = w * sin + h * cos;
    
    // Đổ màu nền đã tính toán cho toàn bộ canvas mới
    newCtx.fillStyle = backgroundColor;
    newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
    
    // Vẽ ảnh gốc lên trên
    newCtx.translate(newCanvas.width / 2, newCanvas.height / 2);
    newCtx.rotate(rad);
    newCtx.drawImage(canvas, -w / 2, -h / 2);
    
    return newCanvas;
  }

  /**
   * Cắt ảnh (Crop)
   */
  static cropImage(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
    const newCanvas = document.createElement('canvas');
    newCanvas.width = w;
    newCanvas.height = h;
    const ctx = newCanvas.getContext('2d')!;
    ctx.drawImage(canvas, x, y, w, h, 0, 0, w, h);
    return newCanvas;
  }

  /**
   * Tự động phát hiện góc nghiêng
   */
  static detectSkewAngle(canvas: HTMLCanvasElement): number {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const scale = 0.5;
    const w = Math.floor(canvas.width * scale);
    const h = Math.floor(canvas.height * scale);
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = w; tempCanvas.height = h;
    const tCtx = tempCanvas.getContext('2d')!;
    tCtx.drawImage(canvas, 0, 0, w, h);
    const imageData = tCtx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const binary = new Uint8Array(w * h);
    for (let i = 0; i < data.length; i += 4) {
      const avg = (data[i] + data[i+1] + data[i+2]) / 3;
      binary[i/4] = avg < 128 ? 1 : 0;
    }
    let bestAngle = 0;
    let maxVariance = -1;
    for (let angle = -5; angle <= 5; angle += 0.25) {
      const rad = (angle * Math.PI) / 180;
      const projections = new Float32Array(h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (binary[y * w + x]) {
            const rotY = Math.round(-x * Math.sin(rad) + y * Math.cos(rad));
            if (rotY >= 0 && rotY < h) projections[rotY]++;
          }
        }
      }
      let sum = 0, sumSq = 0;
      for (let i = 0; i < h; i++) {
        sum += projections[i]; sumSq += projections[i] * projections[i];
      }
      const variance = sumSq / h - (sum / h) ** 2;
      if (variance > maxVariance) { maxVariance = variance; bestAngle = angle; }
    }
    return -bestAngle;
  }

  /**
   * Vá ảnh (Inpainting) vùng chọn
   */
  static inpaintRegion(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number): HTMLCanvasElement {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    let rSum = 0, gSum = 0, bSum = 0, count = 0;
    const margin = 30; 
    
    const sample = (sx: number, sy: number) => {
      const fx = Math.floor(sx), fy = Math.floor(sy);
      if (fx < 0 || fx >= canvas.width || fy < 0 || fy >= canvas.height) return;
      const idx = (fy * canvas.width + fx) * 4;
      if (pixels[idx] > 140 && pixels[idx+1] > 140 && pixels[idx+2] > 140) {
        rSum += pixels[idx]; gSum += pixels[idx + 1]; bSum += pixels[idx + 2];
        count++;
      }
    };

    for (let i = -margin; i < w + margin; i += 5) {
      sample(x + i, y - margin); sample(x + i, y + h + margin);
    }
    for (let j = -margin; j < h + margin; j += 5) {
      sample(x - margin, y + j); sample(x + w + margin, y + j);
    }

    const avgR = count > 0 ? rSum / count : 255;
    const avgG = count > 0 ? gSum / count : 255;
    const avgB = count > 0 ? bSum / count : 255;
    const color = `rgb(${avgR},${avgG},${avgB})`;

    ctx.fillStyle = color;
    ctx.fillRect(x - 1, y - 1, w + 2, h + 2);

    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = canvas.width; patchCanvas.height = canvas.height;
    const pCtx = patchCanvas.getContext('2d')!;
    pCtx.filter = 'blur(10px)';
    pCtx.fillStyle = color;
    pCtx.fillRect(x - 4, y - 4, w + 8, h + 8);
    
    ctx.globalAlpha = 0.6;
    ctx.drawImage(patchCanvas, 0, 0);
    ctx.globalAlpha = 1.0;

    return canvas;
  }

  /**
   * Xóa vùng đen bằng thuật toán Flood Fill "Thông minh"
   */
  static floodFillInpaint(canvas: HTMLCanvasElement, startX: number, startY: number): HTMLCanvasElement {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    
    const blackThreshold = 100;
    const sx = Math.floor(startX);
    const sy = Math.floor(startY);
    const idx = (sy * w + sx) * 4;
    
    if (data[idx] > blackThreshold || data[idx+1] > blackThreshold || data[idx+2] > blackThreshold) {
      return canvas;
    }

    const step = 2; 
    const visited = new Uint8Array(Math.ceil(w/step) * Math.ceil(h/step));
    let minX = sx, maxX = sx, minY = sy, maxY = sy;
    
    const stack: [number, number][] = [[sx, sy]];
    const initialVIdx = Math.floor(sy/step) * Math.ceil(w/step) + Math.floor(sx/step);
    visited[initialVIdx] = 1;

    let pointsCount = 0;
    while (stack.length > 0 && pointsCount < 50000) {
      const [cx, cy] = stack.pop()!;
      pointsCount++;
      minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
      minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);

      const neighbors = [[cx + step, cy], [cx - step, cy], [cx, cy + step], [cx, cy - step]];
      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nvIdx = Math.floor(ny/step) * Math.ceil(w/step) + Math.floor(nx/step);
          if (!visited[nvIdx]) {
            const nidx = (ny * w + nx) * 4;
            if (data[nidx] < blackThreshold + 30) {
              visited[nvIdx] = 1;
              stack.push([nx, ny]);
            }
          }
        }
      }
    }

    const rw = maxX - minX + step;
    const rh = maxY - minY + step;
    const area = rw * rh;
    const density = pointsCount / (area / (step * step));
    
    const isTooSmall = rw < 25 && rh < 25;
    const looksLikeText = density < 0.25 && area < 2500; 

    if (!isTooSmall && !looksLikeText) {
      this.inpaintRegion(canvas, minX, minY, rw, rh);
    }
    
    return canvas;
  }

  /**
   * Tự động xóa viền đen
   */
  static autoRepairBlackRegions(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const w = canvas.width;
    const h = canvas.height;
    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;
    const blackThreshold = 110; 
    const borderLimitX = Math.floor(w * 0.20);
    const borderLimitY = Math.floor(h * 0.20);
    const step = 5;
    const visited = new Uint8Array(Math.ceil(w/step) * Math.ceil(h/step));
    const regions: {x: number, y: number, w: number, h: number}[] = [];

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const isBorderZone = (x < borderLimitX || x > w - borderLimitX || y < borderLimitY || y > h - borderLimitY);
        if (!isBorderZone) continue;
        const vIdx = Math.floor(y/step) * Math.ceil(w/step) + Math.floor(x/step);
        if (visited[vIdx]) continue;
        const idx = (y * w + x) * 4;
        if (data[idx] < blackThreshold && data[idx+1] < blackThreshold && data[idx+2] < blackThreshold) {
          let minX = x, maxX = x, minY = y, maxY = y;
          const stack = [[x, y]];
          visited[vIdx] = 1;
          let pointsCount = 0;
          let touchesEdge = false;
          while (stack.length > 0 && pointsCount < 25000) {
            const [cx, cy] = stack.pop()!;
            pointsCount++;
            minX = Math.min(minX, cx); maxX = Math.max(maxX, cx);
            minY = Math.min(minY, cy); maxY = Math.max(maxY, cy);
            if (cx <= step * 2 || cx >= w - step * 2 || cy <= step * 2 || cy >= h - step * 2) touchesEdge = true;
            const neighbors = [[cx+step, cy], [cx-step, cy], [cx, cy+step], [cx, cy-step]];
            for (const [nx, ny] of neighbors) {
              if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
                const nvIdx = Math.floor(ny/step) * Math.ceil(w/step) + Math.floor(nx/step);
                if (!visited[nvIdx]) {
                  const nidx = (ny * w + nx) * 4;
                  if (data[nidx] < blackThreshold + 15) { 
                    visited[nvIdx] = 1;
                    stack.push([nx, ny]);
                  }
                }
              }
            }
          }
          const rw = maxX - minX + step;
          const rh = maxY - minY + step;
          const centerX = (minX + maxX) / 2;
          const centerY = (minY + maxY) / 2;
          const isBorderArtifact = (centerX < borderLimitX || centerX > w - borderLimitX || centerY < borderLimitY || centerY > h - borderLimitY);
          if (touchesEdge && isBorderArtifact && rw < w * 0.4 && rh < h * 0.4) {
            regions.push({x: minX, y: minY, w: rw, h: rh});
          }
        }
      }
    }
    regions.forEach(r => this.inpaintRegion(canvas, r.x, r.y, r.w, r.h));
    return canvas;
  }
}
