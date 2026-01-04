

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Square as SquareIcon, Trash2, Maximize2, Camera, Sparkles, Plus, 
  Circle as CircleIcon, Monitor, PanelRightClose, Grid3X3, Settings2, 
  Cast, X, Expand, RotateCcw, Check, FolderOpen, Menu, Eye, 
  MonitorOff, EyeOff, Box, MonitorPlay, Upload, Crop, Maximize, Zap, Bot, Loader2, Clock, Download
} from 'lucide-react';
import { generateMappingAssistant } from './services/geminiService.ts';

// --- TYPES ---
export type Point = { x: number; y: number; };
export enum EffectType { NONE = 'none', STROBE = 'strobe', BREATHE = 'breathe', RAINBOW = 'rainbow' }
export enum FillType { SOLID = 'solid', CHECKERBOARD = 'checkerboard', GRID = 'grid', VIDEO = 'video', IMAGE = 'image' }
export enum MappingMode { MASK = 'mask', STRETCH = 'stretch' }
export type ShapeType = 'polygon' | 'circle' | 'square';
export type EditorMode = 'IDLE' | 'DRAWING' | 'EDITING' | 'PROJECTING';

export interface ShapeStyle {
  color: string;
  opacity: number;
  strokeColor: string;
  strokeWidth: number;
  effect: EffectType;
  effectSpeed: number;
  fillType: FillType;
  mappingMode: MappingMode;
  videoSrc?: string;
  imageSrc?: string;
}

export interface Shape {
  id: string;
  name: string;
  type: ShapeType;
  points: Point[];
  visible: boolean;
  isClosed: boolean;
  style: ShapeStyle;
}

export interface ProjectVersion {
  id: string;
  name: string;
  timestamp: number;
  shapes: Shape[];
}

// --- SUB-COMPONENTS ---

const Canvas: React.FC<{
  shapes: Shape[];
  selectedShapeId: string | null;
  mode: EditorMode;
  showCamera: boolean;
  globalTestPattern: boolean;
  isProjector?: boolean;
  currentDrawingPoints: Point[];
  onPointsUpdate: (points: Point[], isClosed: boolean) => void;
  onSelectShape: (id: string | null) => void;
  onDrawingUpdate: (points: Point[]) => void;
}> = ({ shapes, selectedShapeId, mode, showCamera, globalTestPattern, isProjector, currentDrawingPoints, onPointsUpdate, onSelectShape, onDrawingUpdate }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dragInfo, setDragInfo] = useState<{ shapeId: string; pointIndex: number } | null>(null);

  useEffect(() => {
    if (showCamera && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(stream => { if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(err => console.error("Camera error:", err));
    }
  }, [showCamera]);

  const getCanvasCoords = (e: any): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height };
  };

  const handleStart = (e: any) => {
    if (isProjector || mode === 'PROJECTING') return;
    const pos = getCanvasCoords(e);
    if (mode === 'DRAWING') {
      const newPoints = [...currentDrawingPoints, pos];
      if (newPoints.length > 2 && Math.hypot(pos.x - newPoints[0].x, pos.y - newPoints[0].y) < 0.04) {
        onPointsUpdate(currentDrawingPoints, true);
      } else {
        onDrawingUpdate(newPoints);
      }
      return;
    }
    if (mode === 'EDITING' && selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      if (shape) {
        const idx = shape.points.findIndex(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 0.04);
        if (idx !== -1) { setDragInfo({ shapeId: selectedShapeId, pointIndex: idx }); return; }
      }
    }
    const hit = [...shapes].reverse().find(s => s.visible); // Simplification for hitting shapes
    onSelectShape(hit ? hit.id : null);
  };

  const handleMove = (e: any) => {
    if (dragInfo) {
      const pos = getCanvasCoords(e);
      const shape = shapes.find(s => s.id === dragInfo.shapeId);
      if (shape) {
        const pts = [...shape.points];
        pts[dragInfo.pointIndex] = pos;
        onPointsUpdate(pts, shape.isClosed);
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let rid: number;
    const draw = (t: number) => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      const { width: w, height: h } = canvas;
      ctx.clearRect(0, 0, w, h);

      if (showCamera && videoRef.current) {
        ctx.globalAlpha = 0.3;
        ctx.drawImage(videoRef.current, 0, 0, w, h);
      }

      shapes.forEach(shape => {
        if (!shape.visible) return;
        ctx.save();
        let alpha = shape.style.opacity;
        if (shape.style.effect === EffectType.BREATHE) alpha *= 0.6 + 0.4 * Math.sin(t / 500);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        shape.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h));
        ctx.closePath();
        ctx.fillStyle = shape.style.color;
        ctx.fill();
        if (selectedShapeId === shape.id && !isProjector) {
          ctx.strokeStyle = '#00f2ff';
          ctx.lineWidth = 3;
          ctx.stroke();
          shape.points.forEach(p => {
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 6, 0, 7); ctx.fill();
          });
        }
        ctx.restore();
      });

      if (mode === 'DRAWING') {
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        currentDrawingPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h));
        ctx.stroke();
      }
      rid = requestAnimationFrame(draw);
    };
    rid = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rid);
  }, [shapes, selectedShapeId, mode, showCamera, currentDrawingPoints]);

  return (
    <div className="w-full h-full bg-black relative touch-none">
      <canvas ref={canvasRef} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={() => setDragInfo(null)} onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={() => setDragInfo(null)} className="w-full h-full" />
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
    </div>
  );
};

// --- MAIN APP ---

const App: React.FC = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('IDLE');
  const [showCamera, setShowCamera] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [uiVisible, setUiVisible] = useState(true);

  const addShape = (type: ShapeType, pts?: Point[]) => {
    const id = Math.random().toString(36).substr(2, 9);
    const newShape: Shape = {
      id,
      name: `${type} ${shapes.length + 1}`,
      type,
      points: pts || [{x:0.4,y:0.4},{x:0.6,y:0.4},{x:0.6,y:0.6},{x:0.4,y:0.6}],
      visible: true,
      isClosed: true,
      style: { color: '#ffffff', opacity: 1, strokeColor: '#fff', strokeWidth: 0, effect: EffectType.NONE, effectSpeed: 5, fillType: FillType.SOLID, mappingMode: MappingMode.STRETCH }
    };
    setShapes([...shapes, newShape]);
    setSelectedShapeId(id);
    setMode('EDITING');
  };

  const deleteShape = (id: string) => {
    setShapes(shapes.filter(s => s.id !== id));
    if (selectedShapeId === id) setSelectedShapeId(null);
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden flex flex-col text-white">
      {/* Top Bar */}
      {uiVisible && !zenMode && (
        <div className="absolute top-6 left-6 right-6 flex justify-between items-center z-50">
          <div className="flex gap-4 p-2 bg-zinc-900/90 backdrop-blur rounded-2xl border border-white/10">
            <button onClick={() => addShape('square')} className="p-3 hover:bg-white/10 rounded-xl transition-all"><SquareIcon className="w-5 h-5"/></button>
            <button onClick={() => setMode('DRAWING')} className={`p-3 rounded-xl transition-all ${mode === 'DRAWING' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}><Plus className="w-5 h-5"/></button>
            <button onClick={() => setShowCamera(!showCamera)} className={`p-3 rounded-xl transition-all ${showCamera ? 'text-green-400' : ''}`}><Camera className="w-5 h-5"/></button>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setShowAI(true)} className="px-6 py-3 bg-indigo-600 rounded-2xl font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 shadow-xl"><Sparkles className="w-4 h-4"/> Magic AI</button>
            <button onClick={() => setZenMode(true)} className="p-3 bg-zinc-900 rounded-2xl border border-white/10"><MonitorOff className="w-5 h-5"/></button>
          </div>
        </div>
      )}

      {/* Main Canvas Area */}
      <div className="flex-1 relative">
        <Canvas 
          shapes={shapes}
          selectedShapeId={selectedShapeId}
          mode={mode}
          showCamera={showCamera}
          globalTestPattern={false}
          currentDrawingPoints={drawingPoints}
          onPointsUpdate={(pts, closed) => {
            if (mode === 'DRAWING') { addShape('polygon', pts); setDrawingPoints([]); setMode('IDLE'); }
            else if (selectedShapeId) setShapes(shapes.map(s => s.id === selectedShapeId ? {...s, points: pts} : s));
          }}
          onSelectShape={setSelectedShapeId}
          onDrawingUpdate={setDrawingPoints}
        />

        {/* HUD for selected shape */}
        {selectedShapeId && uiVisible && !zenMode && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900/90 border border-white/10 p-6 rounded-3xl flex items-center gap-8 backdrop-blur shadow-2xl animate-in slide-in-from-bottom-4">
            <div>
              <div className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mb-1">Active Surface</div>
              <div className="font-bold">{shapes.find(s => s.id === selectedShapeId)?.name}</div>
            </div>
            <div className="h-10 w-px bg-white/10"></div>
            <div className="flex gap-2">
              <input type="color" className="w-10 h-10 rounded bg-transparent border-none cursor-pointer" onChange={(e) => {
                setShapes(shapes.map(s => s.id === selectedShapeId ? {...s, style: {...s.style, color: e.target.value}} : s));
              }} />
              <button onClick={() => deleteShape(selectedShapeId)} className="p-3 text-red-400 hover:bg-red-400/10 rounded-xl transition-all"><Trash2 className="w-5 h-5"/></button>
            </div>
          </div>
        )}
      </div>

      {/* AI Assistant Overlay */}
      {showAI && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-lg rounded-[40px] p-8 shadow-2xl relative">
             <button onClick={() => setShowAI(false)} className="absolute top-6 right-6 p-2 text-zinc-500 hover:text-white"><X className="w-6 h-6"/></button>
             <h2 className="text-2xl font-black mb-2 flex items-center gap-3"><Sparkles className="text-indigo-400"/> Magic AI</h2>
             <p className="text-zinc-500 text-sm mb-6">Describe a layout and Gemini will map it for you.</p>
             <textarea 
              id="ai-prompt"
              placeholder="e.g. A symmetrical 3x3 grid of squares in the center..."
              className="w-full h-32 bg-black border border-white/10 rounded-2xl p-4 text-white resize-none mb-6 focus:ring-2 ring-indigo-500 outline-none"
             />
             <button 
              onClick={async () => {
                const prompt = (document.getElementById('ai-prompt') as HTMLTextAreaElement).value;
                if (!prompt) return;
                try {
                  const res = await generateMappingAssistant(prompt);
                  if (res && res.shapes) {
                    res.shapes.forEach((s: any) => addShape('polygon', s.points));
                    setShowAI(false);
                  }
                } catch (e) { alert("AI Error: " + e.message); }
              }}
              className="w-full py-5 bg-indigo-600 rounded-2xl font-black uppercase tracking-[0.2em]"
             >
              Generate Shapes
             </button>
          </div>
        </div>
      )}

      {/* Zen Exit */}
      {zenMode && (
        <button onClick={() => setZenMode(false)} className="fixed top-6 right-6 p-4 bg-zinc-900/50 rounded-2xl text-[10px] font-black uppercase tracking-widest opacity-0 hover:opacity-100 transition-opacity">Exit Mirror Mode</button>
      )}
    </div>
  );
};

export default App;
