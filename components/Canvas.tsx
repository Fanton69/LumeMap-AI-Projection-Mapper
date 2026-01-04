
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Shape, Point, EditorMode, EffectType, FillType, MappingMode } from '../types';

interface CanvasProps {
  shapes: Shape[];
  selectedShapeId: string | null;
  mode: EditorMode;
  showCamera: boolean;
  globalTestPattern: boolean;
  isProjector?: boolean;
  currentDrawingPoints: Point[];
  onPointsUpdate: (points: Point[], isClosed: boolean) => void;
  onModeChange: (mode: EditorMode) => void;
  onSelectShape: (id: string | null) => void;
  onDrawingUpdate: (points: Point[]) => void;
}

const Canvas: React.FC<CanvasProps> = ({ 
  shapes, 
  selectedShapeId, 
  mode, 
  showCamera, 
  globalTestPattern,
  isProjector = false,
  currentDrawingPoints,
  onPointsUpdate, 
  onModeChange,
  onSelectShape,
  onDrawingUpdate
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoElements = useRef<Map<string, HTMLVideoElement>>(new Map());
  const imageElements = useRef<Map<string, HTMLImageElement>>(new Map());
  const animationRef = useRef<number>(0);
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [dragInfo, setDragInfo] = useState<{ 
    shapeId: string; 
    pointIndex: number; 
  } | null>(null);

  useEffect(() => {
    shapes.forEach(shape => {
      if (shape.style.fillType === FillType.VIDEO && shape.style.videoSrc) {
        let video = videoElements.current.get(shape.id);
        if (!video || video.src !== shape.style.videoSrc) {
          if (video) video.pause();
          video = document.createElement('video');
          video.src = shape.style.videoSrc;
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.crossOrigin = 'anonymous';
          video.play().catch(e => console.error("Auto-play blocked", e));
          videoElements.current.set(shape.id, video);
        }
      }
      if (shape.style.fillType === FillType.IMAGE && shape.style.imageSrc) {
        let img = imageElements.current.get(shape.id);
        if (!img || img.src !== shape.style.imageSrc) {
          img = new Image();
          img.src = shape.style.imageSrc;
          img.crossOrigin = 'anonymous';
          imageElements.current.set(shape.id, img);
        }
      }
    });

    const activeIds = new Set(shapes.map(s => s.id));
    for (const id of videoElements.current.keys()) if (!activeIds.has(id)) videoElements.current.delete(id);
    for (const id of imageElements.current.keys()) if (!activeIds.has(id)) imageElements.current.delete(id);
  }, [shapes]);

  useEffect(() => {
    if (!isProjector && showCamera && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => { if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); } })
        .catch(err => console.error("Camera error:", err));
    } else if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  }, [showCamera, isProjector]);

  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = canvasRef.current.offsetWidth;
        canvasRef.current.height = canvasRef.current.offsetHeight;
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const dist = (p1: Point, p2: Point) => Math.hypot(p1.x - p2.x, p1.y - p2.y);
  const toPixels = (p: Point, w: number, h: number): Point => ({ x: p.x * w, y: p.y * h });
  const toNormalized = (p: Point, w: number, h: number): Point => ({ x: p.x / w, y: p.y / h });
  const lerp = (p1: Point, p2: Point, t: number): Point => ({
    x: p1.x + (p2.x - p1.x) * t,
    y: p1.y + (p2.y - p1.y) * t
  });

  const defineShapePath = (ctx: CanvasRenderingContext2D, shape: Shape, w: number, h: number) => {
    if (shape.points.length < 2) return;
    const p0 = toPixels(shape.points[0], w, h);
    ctx.beginPath();
    ctx.moveTo(p0.x, p0.y);
    for (let i = 1; i < shape.points.length; i++) {
      const p = toPixels(shape.points[i], w, h);
      ctx.lineTo(p.x, p.y);
    }
    if (shape.isClosed) ctx.closePath();
  };

  const getShapeBoundsPixels = (shape: Shape, w: number, h: number) => {
    let minX = w, minY = h, maxX = 0, maxY = 0;
    shape.points.forEach(p => {
      const px = p.x * w; const py = p.y * h;
      minX = Math.min(minX, px); minY = Math.min(minY, py);
      maxX = Math.max(maxX, px); maxY = Math.max(maxY, py);
    });
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const drawTriangle = (
    ctx: CanvasRenderingContext2D,
    img: CanvasImageSource,
    s0: Point, s1: Point, s2: Point,
    d0: Point, d1: Point, d2: Point
  ) => {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(d0.x, d0.y);
    ctx.lineTo(d1.x, d1.y);
    ctx.lineTo(d2.x, d2.y);
    ctx.closePath();
    ctx.clip();

    const det = (s1.x - s0.x) * (s2.y - s0.y) - (s2.x - s0.x) * (s1.y - s0.y);
    if (Math.abs(det) < 0.1) { ctx.restore(); return; }

    const a = ((d1.x - d0.x) * (s2.y - s0.y) - (d2.x - d0.x) * (s1.y - s0.y)) / det;
    const b = ((d1.y - d0.y) * (s2.y - s0.y) - (d2.y - d0.y) * (s1.y - s0.y)) / det;
    const c = ((d2.x - d0.x) * (s1.x - s0.x) - (d1.x - d0.x) * (s2.x - s0.x)) / det;
    const d = ((d2.y - d0.y) * (s1.x - s0.x) - (d1.y - d0.y) * (s2.x - s0.x)) / det;
    const e = d0.x - a * s0.x - c * s0.y;
    const f = d0.y - b * s0.x - d * s0.y;

    ctx.setTransform(a, b, c, d, e, f);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  };

  const drawWarpedImage = (ctx: CanvasRenderingContext2D, img: CanvasImageSource, shape: Shape, w: number, h: number) => {
    const iw = img instanceof HTMLVideoElement ? img.videoWidth : (img as HTMLImageElement).width;
    const ih = img instanceof HTMLVideoElement ? img.videoHeight : (img as HTMLImageElement).height;
    if (iw === 0 || ih === 0 || shape.points.length < 3) return;

    if (shape.points.length === 4) {
      const s0 = { x: 0, y: 0 };
      const s1 = { x: iw, y: 0 };
      const s2 = { x: iw, y: ih };
      const s3 = { x: 0, y: ih };

      const d0 = toPixels(shape.points[0], w, h);
      const d1 = toPixels(shape.points[1], w, h);
      const d2 = toPixels(shape.points[2], w, h);
      const d3 = toPixels(shape.points[3], w, h);

      drawTriangle(ctx, img, s0, s1, s2, d0, d1, d2);
      drawTriangle(ctx, img, s0, s2, s3, d0, d2, d3);
    } else {
      const centroidNorm = shape.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
      centroidNorm.x /= shape.points.length;
      centroidNorm.y /= shape.points.length;

      const cPx = toPixels(centroidNorm, w, h);
      const cUV = { x: iw / 2, y: ih / 2 };

      for (let i = 0; i < shape.points.length; i++) {
        const p1 = shape.points[i];
        const p2 = shape.points[(i + 1) % shape.points.length];
        
        const angle1 = (i / shape.points.length) * Math.PI * 2;
        const angle2 = ((i + 1) / shape.points.length) * Math.PI * 2;

        const uv1 = {
          x: (Math.cos(angle1) * 0.5 + 0.5) * iw,
          y: (Math.sin(angle1) * 0.5 + 0.5) * ih
        };
        const uv2 = {
          x: (Math.cos(angle2) * 0.5 + 0.5) * iw,
          y: (Math.sin(angle2) * 0.5 + 0.5) * ih
        };

        drawTriangle(ctx, img, cUV, uv1, uv2, cPx, toPixels(p1, w, h), toPixels(p2, w, h));
      }
    }
  };

  const drawPattern = (ctx: CanvasRenderingContext2D, shape: Shape, time: number, w: number, h: number) => {
    const { fillType, mappingMode } = shape.style;
    if (fillType === FillType.SOLID) { defineShapePath(ctx, shape, w, h); ctx.fill(); return; }

    ctx.save();
    
    if (fillType === FillType.VIDEO || fillType === FillType.IMAGE) {
      const asset = fillType === FillType.VIDEO ? videoElements.current.get(shape.id) : imageElements.current.get(shape.id);
      const isReady = asset instanceof HTMLVideoElement ? asset.readyState >= 2 : (asset as HTMLImageElement)?.complete;

      if (isReady && asset) {
        if (mappingMode === MappingMode.STRETCH) {
          drawWarpedImage(ctx, asset, shape, w, h);
        } else {
          defineShapePath(ctx, shape, w, h);
          ctx.clip();
          const bounds = getShapeBoundsPixels(shape, w, h);
          ctx.drawImage(asset, bounds.x, bounds.y, bounds.w, bounds.h);
        }
      } else {
        ctx.fillStyle = '#111';
        defineShapePath(ctx, shape, w, h);
        ctx.fill();
      }
    } else if (fillType === FillType.GRID) {
      if (mappingMode === MappingMode.STRETCH && shape.points.length >= 3) {
        const divisions = 12;
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#FFFFFF44';
        
        const mapUVtoXY = (u: number, v: number) => {
          if (shape.points.length === 4) {
            const p0 = shape.points[0]; const p1 = shape.points[1];
            const p2 = shape.points[2]; const p3 = shape.points[3];
            const top = lerp(p0, p1, u);
            const bottom = lerp(p3, p2, u);
            return lerp(top, bottom, v);
          } else {
            const centroid = shape.points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
            centroid.x /= shape.points.length; centroid.y /= shape.points.length;
            
            const angle = u * Math.PI * 2;
            const segment = (u * shape.points.length);
            const idx = Math.floor(segment) % shape.points.length;
            const nextIdx = (idx + 1) % shape.points.length;
            const t = segment - Math.floor(segment);
            const edgePoint = lerp(shape.points[idx], shape.points[nextIdx], t);
            return lerp(centroid, edgePoint, v);
          }
        };

        defineShapePath(ctx, shape, w, h);
        ctx.clip();

        ctx.beginPath();
        for (let i = 0; i <= divisions; i++) {
          const u = i / divisions;
          ctx.moveTo(toPixels(mapUVtoXY(u, 0), w, h).x, toPixels(mapUVtoXY(u, 0), w, h).y);
          ctx.lineTo(toPixels(mapUVtoXY(u, 1), w, h).x, toPixels(mapUVtoXY(u, 1), w, h).y);
          
          const v = i / divisions;
          ctx.moveTo(toPixels(mapUVtoXY(0, v), w, h).x, toPixels(mapUVtoXY(0, v), w, h).y);
          for(let j=1; j<=divisions; j++) {
            const p = toPixels(mapUVtoXY(j/divisions, v), w, h);
            ctx.lineTo(p.x, p.y);
          }
        }
        ctx.stroke();
      } else {
        defineShapePath(ctx, shape, w, h);
        ctx.clip();
        const spacing = 40;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5; ctx.shadowBlur = 8; ctx.shadowColor = '#ffffff';
        ctx.beginPath();
        for (let x = 0; x < w; x += spacing) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
        for (let y = 0; y < h; y += spacing) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
        ctx.stroke();
      }
    } else if (fillType === FillType.CHECKERBOARD) {
      defineShapePath(ctx, shape, w, h);
      ctx.clip();
      const size = 40;
      for (let x = -size; x < w + size; x += size) {
        for (let y = -size; y < h + size; y += size) {
          ctx.fillStyle = (Math.floor(x / size) + Math.floor(y / size)) % 2 === 0 ? '#fff' : '#000';
          ctx.fillRect(x, y, size, size);
        }
      }
    }
    ctx.restore();
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    const time = Date.now();

    shapes.forEach(shape => {
      if (!shape.visible || shape.points.length < 2) return;
      const isSelected = shape.id === selectedShapeId && !isProjector;
      let opacity = shape.style.opacity;
      let color = shape.style.color;

      if (shape.style.effect === EffectType.STROBE) opacity = Math.floor(time / ((11 - shape.style.effectSpeed) * 80)) % 2 === 0 ? opacity : 0;
      else if (shape.style.effect === EffectType.BREATHE) opacity = shape.style.opacity * (0.3 + 0.7 * (Math.sin(time * (shape.style.effectSpeed / 800)) * 0.5 + 0.5));
      else if (shape.style.effect === EffectType.RAINBOW) color = `hsla(${(time * (shape.style.effectSpeed / 25)) % 360}, 80%, 50%, ${opacity})`;

      ctx.fillStyle = color;
      if (mode === 'PROJECTING' || isProjector) {
        ctx.globalAlpha = opacity;
        drawPattern(ctx, shape, time, w, h);
      } else {
        ctx.globalAlpha = isSelected ? opacity * 0.7 : opacity * 0.4;
        drawPattern(ctx, shape, time, w, h);
        ctx.globalAlpha = 1;
        defineShapePath(ctx, shape, w, h);
        ctx.strokeStyle = isSelected ? '#00b5cc' : '#ffffff22';
        ctx.lineWidth = isSelected ? 3 : 1;
        if (isSelected) ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        if (isSelected && mode === 'EDITING') {
          shape.points.forEach(p => {
            const px = toPixels(p, w, h);
            ctx.beginPath(); ctx.arc(px.x, px.y, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#00b5cc'; ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
          });
        }
      }
    });

    if (!isProjector && mode === 'DRAWING') {
      if (currentDrawingPoints.length > 0) {
        const firstPx = toPixels(currentDrawingPoints[0], w, h);
        const lastPx = toPixels(currentDrawingPoints[currentDrawingPoints.length - 1], w, h);
        const mPx = mousePos ? toPixels(mousePos, w, h) : lastPx;
        const isNearFirst = dist(mPx, firstPx) < 25;

        // 1. PREVIEW FILL
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(firstPx.x, firstPx.y);
        currentDrawingPoints.forEach(p => {
          const px = toPixels(p, w, h);
          ctx.lineTo(px.x, px.y);
        });
        if (mousePos) ctx.lineTo(mPx.x, mPx.y);
        ctx.closePath();
        ctx.fillStyle = isNearFirst ? 'rgba(0, 255, 170, 0.15)' : 'rgba(0, 181, 204, 0.1)';
        ctx.fill();
        ctx.restore();

        // 2. LASER PATH (CONFIRMED)
        // Outer glow
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(firstPx.x, firstPx.y);
        currentDrawingPoints.forEach(p => ctx.lineTo(toPixels(p, w, h).x, toPixels(p, w, h).y));
        ctx.strokeStyle = '#00b5cc';
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#00b5cc';
        ctx.globalAlpha = 0.3;
        ctx.stroke();
        
        // Inner core
        ctx.globalAlpha = 1;
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.restore();

        // 3. RUBBER BAND (ACTIVE SEGMENT)
        if (mousePos) {
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(lastPx.x, lastPx.y);
          ctx.lineTo(mPx.x, mPx.y);
          
          ctx.strokeStyle = isNearFirst ? '#00ffaa' : '#00b5cc';
          ctx.setLineDash([10, 5]);
          ctx.lineDashOffset = -(time / 40);
          ctx.lineWidth = 2;
          ctx.stroke();
          
          if (isNearFirst && currentDrawingPoints.length > 2) {
            // Visual feedback for closing
            ctx.beginPath();
            ctx.arc(firstPx.x, firstPx.y, 18, 0, Math.PI * 2);
            ctx.strokeStyle = '#00ffaa';
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            ctx.stroke();
            
            ctx.fillStyle = '#00ffaa';
            ctx.font = 'bold 10px Inter';
            ctx.textAlign = 'center';
            ctx.fillText('SNAP TO CLOSE', firstPx.x, firstPx.y - 30);
          }
          ctx.restore();
        }

        // 4. NODES
        currentDrawingPoints.forEach((p, idx) => {
          const px = toPixels(p, w, h);
          ctx.beginPath();
          const isFirst = idx === 0;
          const radius = isFirst ? (isNearFirst ? 12 : 8) : 5;
          ctx.arc(px.x, px.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = isFirst ? (isNearFirst ? '#00ffaa' : '#00f2ff') : '#ffffff';
          ctx.shadowBlur = isFirst ? 15 : 5;
          ctx.shadowColor = isFirst ? '#00f2ff' : '#ffffff';
          ctx.fill();
        });
      }
    }
    animationRef.current = requestAnimationFrame(draw);
  }, [shapes, selectedShapeId, mode, currentDrawingPoints, mousePos, globalTestPattern, isProjector]);

  useEffect(() => { animationRef.current = requestAnimationFrame(draw); return () => cancelAnimationFrame(animationRef.current); }, [draw]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (isProjector || mode === 'PROJECTING') return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pixelP = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const p = toNormalized(pixelP, rect.width, rect.height);

    if (mode === 'DRAWING') {
      if (currentDrawingPoints.length > 2) {
        const firstPx = toPixels(currentDrawingPoints[0], rect.width, rect.height);
        if (dist(pixelP, firstPx) < 25) {
          onPointsUpdate(currentDrawingPoints, true);
          onDrawingUpdate([]);
          onModeChange('EDITING');
          return;
        }
      }
      onDrawingUpdate([...currentDrawingPoints, p]);
      return;
    }

    if (selectedShapeId) {
      const selected = shapes.find(s => s.id === selectedShapeId);
      if (selected) {
        const handleIndex = selected.points.findIndex(hp => dist(pixelP, toPixels(hp, rect.width, rect.height)) < 20);
        if (handleIndex !== -1) {
          setDragInfo({ shapeId: selected.id, pointIndex: handleIndex });
          canvasRef.current?.setPointerCapture(e.pointerId);
          return;
        }
      }
    }

    for (let i = shapes.length - 1; i >= 0; i--) {
      const scaledPoints = shapes[i].points.map(sp => toPixels(sp, rect.width, rect.height));
      const isInside = (pt: Point, poly: Point[]) => {
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const xi = poly[i].x, yi = poly[i].y, xj = poly[j].x, yj = poly[j].y;
          const intersect = ((yi > pt.y) !== (yj > pt.y)) && (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      };

      if (isInside(pixelP, scaledPoints)) { onSelectShape(shapes[i].id); onModeChange('EDITING'); return; }
    }
    onSelectShape(null); onModeChange('IDLE');
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const p = toNormalized({ x: e.clientX - rect.left, y: e.clientY - rect.top }, rect.width, rect.height);
    
    if (mode === 'DRAWING') {
      setMousePos(p);
      return;
    }

    if (isProjector || !dragInfo) return;
    const shape = shapes.find(s => s.id === dragInfo.shapeId);
    if (!shape) return;

    if (dragInfo.pointIndex !== -1) {
      const newPoints = [...shape.points];
      newPoints[dragInfo.pointIndex] = {
        x: Math.max(0, Math.min(1, p.x)),
        y: Math.max(0, Math.min(1, p.y))
      };
      onPointsUpdate(newPoints, shape.isClosed);
    }
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-black touch-none">
      <video ref={videoRef} className={`absolute inset-0 w-full h-full object-cover transition-opacity pointer-events-none ${showCamera && !isProjector ? 'opacity-40' : 'opacity-0'}`} muted playsInline />
      <canvas 
        ref={canvasRef} 
        className={`absolute inset-0 z-10 block w-full h-full ${mode === 'DRAWING' ? 'cursor-crosshair' : 'cursor-default'}`} 
        onPointerDown={handlePointerDown} 
        onPointerMove={handlePointerMove} 
        onPointerUp={() => setDragInfo(null)} 
      />
    </div>
  );
};

export default Canvas;
