import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Square, Trash2, Camera, Sparkles, Plus, X, Maximize, 
  Loader2, Save, History, Settings2, Box, Eye, EyeOff,
  Video, Image as ImageIcon, Upload, MonitorPlay, Crop,
  Check, Clock, Download, ChevronRight, Menu
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES (Version 1 Full) ---
type Point = { x: number; y: number };
enum EffectType { NONE = 'none', STROBE = 'strobe', BREATHE = 'breathe', RAINBOW = 'rainbow' }
enum FillType { SOLID = 'solid', CHECKERBOARD = 'checkerboard', GRID = 'grid', VIDEO = 'video', IMAGE = 'image' }
enum MappingMode { MASK = 'mask', STRETCH = 'stretch' }

interface ShapeStyle {
  color: string;
  opacity: number;
  effect: EffectType;
  effectSpeed: number;
  fillType: FillType;
  mappingMode: MappingMode;
  videoSrc?: string;
  imageSrc?: string;
}

interface Shape {
  id: string;
  name: string;
  points: Point[];
  visible: boolean;
  style: ShapeStyle;
}

interface ProjectSnapshot {
  id: string;
  name: string;
  timestamp: number;
  shapes: Shape[];
}

// --- AI SERVICE ---
const callGeminiAI = async (prompt: string) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key Missing");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Projection mapping layout request: "${prompt}"`,
    config: {
      systemInstruction: "Generate JSON coordinates (0.0 to 1.0) for surfaces. Valid effects: none, strobe, breathe, rainbow.",
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shapes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                points: {
                  type: Type.ARRAY,
                  items: { type: Type.OBJECT, properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } } }
                },
                color: { type: Type.STRING },
                effect: { type: Type.STRING }
              }
            }
          }
        }
      }
    }
  });
  return JSON.parse(response.text.trim());
};

// --- MAIN APP ---
const App = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'IDLE' | 'DRAWING'>('IDLE');
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showLayers, setShowLayers] = useState(window.innerWidth > 1024);
  const [loadingAI, setLoadingAI] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [snapshots, setSnapshots] = useState<ProjectSnapshot[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragPoint, setDragPoint] = useState<{ shapeId: string; index: number } | null>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('lumemap_v1_full_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      setShapes(parsed.shapes || []);
      setSnapshots(parsed.snapshots || []);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lumemap_v1_full_data', JSON.stringify({ shapes, snapshots }));
  }, [shapes, snapshots]);

  // Camera handling
  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
        .catch(() => alert("Camera Access Required"));
    } else if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  }, [cameraOn]);

  const getPos = (e: any): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX ?? e.touches?.[0]?.clientX;
    const clientY = e.clientY ?? e.touches?.[0]?.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height
    };
  };

  const addShape = (pts: Point[], name = 'Surface') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newShape: Shape = {
      id,
      name: `${name} ${shapes.length + 1}`,
      points: pts,
      visible: true,
      style: {
        color: '#ffffff',
        opacity: 1,
        effect: EffectType.NONE,
        effectSpeed: 5,
        fillType: FillType.SOLID,
        mappingMode: MappingMode.STRETCH
      }
    };
    setShapes(prev => [...prev, newShape]);
    setSelectedId(id);
  };

  const handlePointerDown = (e: any) => {
    const pos = getPos(e);
    if (mode === 'DRAWING') {
      const newPts = [...drawingPoints, pos];
      if (newPts.length > 2 && Math.hypot(pos.x - newPts[0].x, pos.y - newPts[0].y) < 0.05) {
        addShape(drawingPoints, 'Path');
        setDrawingPoints([]);
        setMode('IDLE');
      } else {
        setDrawingPoints(newPts);
      }
      return;
    }

    if (selectedId) {
      const s = shapes.find(x => x.id === selectedId);
      if (s) {
        const pIdx = s.points.findIndex(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 0.06);
        if (pIdx !== -1) {
          setDragPoint({ shapeId: selectedId, index: pIdx });
          return;
        }
      }
    }

    const hit = [...shapes].reverse().find(s => {
      if (!s.visible) return false;
      const xs = s.points.map(p => p.x);
      const ys = s.points.map(p => p.y);
      return pos.x >= Math.min(...xs) - 0.04 && pos.x <= Math.max(...xs) + 0.04 &&
             pos.y >= Math.min(...ys) - 0.04 && pos.y <= Math.max(...ys) + 0.04;
    });
    setSelectedId(hit?.id || null);
  };

  const handlePointerMove = (e: any) => {
    if (dragPoint) {
      const pos = getPos(e);
      setShapes(prev => prev.map(s => {
        if (s.id === dragPoint.shapeId) {
          const newPoints = [...s.points];
          newPoints[dragPoint.index] = pos;
          return { ...s, points: newPoints };
        }
        return s;
      }));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedId) return;
    const url = URL.createObjectURL(file);
    setShapes(prev => prev.map(s => {
      if (s.id === selectedId) {
        const isVideo = file.type.startsWith('video/');
        return {
          ...s,
          style: {
            ...s.style,
            fillType: isVideo ? FillType.VIDEO : FillType.IMAGE,
            videoSrc: isVideo ? url : s.style.videoSrc,
            imageSrc: isVideo ? s.style.imageSrc : url
          }
        };
      }
      return s;
    }));
  };

  // Rendering logic
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

      if (cameraOn && videoRef.current) {
        ctx.save(); ctx.globalAlpha = 0.4; ctx.drawImage(videoRef.current, 0, 0, w, h); ctx.restore();
      }

      shapes.forEach(s => {
        if (!s.visible) return;
        ctx.save();
        let alpha = s.style.opacity;
        if (s.style.effect === EffectType.BREATHE) alpha *= 0.5 + 0.5 * Math.sin(t / (1000 / s.style.effectSpeed));
        if (s.style.effect === EffectType.STROBE) alpha *= Math.floor(t / (100 / s.style.effectSpeed)) % 2;
        
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        s.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h));
        ctx.closePath();

        ctx.save();
        ctx.clip();

        if (s.style.fillType === FillType.SOLID) {
          ctx.fillStyle = s.style.color;
          ctx.fill();
        } else if (s.style.fillType === FillType.GRID) {
          ctx.strokeStyle = s.style.color;
          ctx.lineWidth = 1;
          for (let i = 0; i <= 20; i++) {
            ctx.beginPath(); ctx.moveTo(i * w / 20, 0); ctx.lineTo(i * w / 20, h); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(0, i * h / 20); ctx.lineTo(w, i * h / 20); ctx.stroke();
          }
        } else if (s.style.fillType === FillType.CHECKERBOARD) {
          const size = 30;
          ctx.fillStyle = s.style.color;
          for (let x = 0; x < w; x += size * 2) {
            for (let y = 0; y < h; y += size * 2) {
              ctx.fillRect(x, y, size, size);
              ctx.fillRect(x + size, y + size, size, size);
            }
          }
        }

        ctx.restore(); // end clip
        
        if (selectedId === s.id && !zenMode) {
          ctx.strokeStyle = '#00b5cc';
          ctx.lineWidth = 3;
          ctx.stroke();
          s.points.forEach(p => {
            ctx.fillStyle = '#00b5cc';
            ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 10, 0, 7); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
          });
        }
        ctx.restore();
      });

      if (mode === 'DRAWING' && drawingPoints.length > 0) {
        ctx.strokeStyle = '#00b5cc';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        drawingPoints.forEach((p, i) => i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h));
        ctx.stroke();
      }
      rid = requestAnimationFrame(draw);
    };
    rid = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rid);
  }, [shapes, selectedId, mode, drawingPoints, cameraOn, zenMode]);

  return (
    <div className="h-screen w-screen bg-black flex overflow-hidden text-white touch-none">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="video/*,image/*" />

      {/* LEFT SIDEBAR (Layers) */}
      {!zenMode && showLayers && (
        <div className="w-72 bg-zinc-950 border-r border-white/10 flex flex-col p-6 animate-in slide-in-from-left duration-300">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-sm font-black uppercase tracking-[0.2em] text-zinc-500">Layers</h1>
            <button onClick={() => setShowLayers(false)} className="lg:hidden p-2"><X/></button>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto custom-scrollbar">
            {shapes.map(s => (
              <div key={s.id} onClick={() => setSelectedId(s.id)} className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${selectedId === s.id ? 'bg-[#00b5cc]/10 border-[#00b5cc]/50 text-white' : 'bg-transparent border-transparent text-zinc-500'}`}>
                <div className="flex items-center gap-3">
                   <div className="w-2 h-2 rounded-full" style={{backgroundColor: s.style.color}} />
                   <span className="text-[10px] font-black uppercase tracking-wider">{s.name}</span>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setShapes(prev => prev.map(sh => sh.id === s.id ? {...sh, visible: !sh.visible} : sh)) }}>
                  {s.visible ? <Eye className="w-4 h-4"/> : <EyeOff className="w-4 h-4 text-zinc-700"/>}
                </button>
              </div>
            ))}
          </div>
          <button onClick={() => addShape([{x:0.4,y:0.4},{x:0.6,y:0.4},{x:0.6,y:0.6},{x:0.4,y:0.6}], 'Quad')} className="mt-6 w-full py-4 bg-zinc-900 rounded-2xl border border-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-zinc-800 transition-all">Add Surface</button>
        </div>
      )}

      {/* CENTER STAGE */}
      <div className="flex-1 flex flex-col relative bg-[#050505]">
        {!zenMode && (
          <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-50 pointer-events-none">
            <div className="flex gap-2 pointer-events-auto">
              {!showLayers && <button onClick={() => setShowLayers(true)} className="p-4 bg-zinc-950/90 rounded-2xl border border-white/10"><Menu className="w-5 h-5"/></button>}
              <div className="flex gap-2 p-2 bg-zinc-950/90 backdrop-blur rounded-2xl border border-white/10">
                <button onClick={() => setMode('DRAWING')} className={`p-3 rounded-xl transition-all ${mode === 'DRAWING' ? 'bg-[#00b5cc] text-black' : 'hover:bg-white/10'}`}><Plus className="w-5 h-5"/></button>
                <button onClick={() => setCameraOn(!cameraOn)} className={`p-3 rounded-xl transition-all ${cameraOn ? 'text-green-400 bg-green-400/10' : 'hover:bg-white/10'}`}><Camera className="w-5 h-5"/></button>
                <button onClick={() => setShowHistory(true)} className="p-3 hover:bg-white/10 rounded-xl transition-all"><History className="w-5 h-5"/></button>
              </div>
            </div>
            <div className="flex gap-4 pointer-events-auto">
              <button onClick={() => setShowAI(true)} className="px-6 py-3 bg-[#00b5cc] text-black hover:bg-[#00d8f0] rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 shadow-2xl transition-all"><Sparkles className="w-4 h-4"/> AI Assist</button>
              <button onClick={() => setZenMode(true)} className="p-4 bg-zinc-950/90 rounded-2xl border border-white/10"><Maximize className="w-5 h-5"/></button>
            </div>
          </div>
        )}

        <div className="flex-1">
          <canvas 
            ref={canvasRef} 
            onPointerDown={handlePointerDown} 
            onPointerMove={handlePointerMove} 
            onPointerUp={() => setDragPoint(null)} 
            className="w-full h-full cursor-crosshair" 
          />
        </div>

        {selectedId && !zenMode && (
          <div className="absolute bottom-10 left-10 right-10 bg-zinc-950/95 border border-white/10 p-8 rounded-[40px] flex items-center justify-between backdrop-blur-2xl shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="flex gap-12 items-center">
              <div>
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Tint & Pattern</label>
                <div className="flex gap-3">
                  <input type="color" className="w-12 h-12 rounded-xl bg-transparent border-none cursor-pointer" value={shapes.find(s=>s.id===selectedId)?.style.color} onChange={e => {
                    setShapes(prev => prev.map(s => s.id === selectedId ? {...s, style: {...s.style, color: e.target.value}} : s));
                  }} />
                  <select className="bg-black border border-white/10 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest outline-none" value={shapes.find(s=>s.id===selectedId)?.style.fillType} onChange={e => {
                    setShapes(prev => prev.map(s => s.id === selectedId ? {...s, style: {...s.style, fillType: e.target.value as FillType}} : s));
                  }}>
                    <option value="solid">Solid</option>
                    <option value="grid">Grid Pattern</option>
                    <option value="checkerboard">Checker</option>
                    <option value="video">Video Loop</option>
                    <option value="image">Still Image</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[8px] font-black text-zinc-500 uppercase tracking-widest block mb-2">Mapping FX</label>
                <div className="flex gap-3">
                  <select className="bg-black border border-white/10 rounded-xl px-4 text-[10px] font-black uppercase tracking-widest outline-none" value={shapes.find(s=>s.id===selectedId)?.style.effect} onChange={e => {
                    setShapes(prev => prev.map(s => s.id === selectedId ? {...s, style: {...s.style, effect: e.target.value as EffectType}} : s));
                  }}>
                    <option value="none">None</option>
                    <option value="breathe">Breathe</option>
                    <option value="strobe">Strobe</option>
                    <option value="rainbow">Rainbow</option>
                  </select>
                  <button onClick={() => fileInputRef.current?.click()} className="px-5 bg-white/5 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Upload className="w-4 h-4"/> Import Media</button>
                </div>
              </div>
            </div>
            
            <button onClick={() => { setShapes(prev => prev.filter(s => s.id !== selectedId)); setSelectedId(null); }} className="p-5 text-red-400 hover:bg-red-400/10 rounded-3xl transition-all"><Trash2 className="w-6 h-6"/></button>
          </div>
        )}
      </div>

      {/* OVERLAYS */}
      {showAI && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-white/10 w-full max-w-lg rounded-[48px] p-10 shadow-2xl relative">
             <button onClick={() => setShowAI(false)} className="absolute top-10 right-10 p-2 text-zinc-500 hover:text-white transition-colors"><X/></button>
             <h2 className="text-3xl font-black mb-2 flex items-center gap-4"><Sparkles className="text-[#00b5cc]"/> Magic Assistant</h2>
             <p className="text-zinc-500 text-xs mb-8">Describe your layout (e.g., "A grid of 6 circles with rainbow strobe").</p>
             <textarea id="ai-input" placeholder="Enter description..." className="w-full h-40 bg-black border border-white/10 rounded-3xl p-6 text-white resize-none mb-8 outline-none focus:ring-4 ring-[#00b5cc]/20" />
             <button disabled={loadingAI} onClick={async () => {
               const val = (document.getElementById('ai-input') as any).value;
               if (!val) return;
               setLoadingAI(true);
               try {
                 const res = await callGeminiAI(val);
                 res.shapes.forEach((s: any) => addShape(s.points, s.name));
                 setShowAI(false);
               } catch (e: any) { alert(e.message); } finally { setLoadingAI(false); }
             }} className="w-full py-6 bg-[#00b5cc] text-black rounded-3xl font-black uppercase tracking-[0.3em] flex items-center justify-center gap-3 active:scale-95 transition-all">
               {loadingAI ? <Loader2 className="animate-spin"/> : 'Generate Surfaces'}
             </button>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-950 border border-white/10 w-full max-w-md rounded-[48px] p-10 shadow-2xl relative">
             <button onClick={() => setShowHistory(false)} className="absolute top-10 right-10 p-2 text-zinc-500 hover:text-white"><X/></button>
             <h2 className="text-2xl font-black mb-8 flex items-center gap-3"><Save className="text-[#00b5cc]"/> Snapshot Vault</h2>
             <div className="flex gap-2 mb-8">
               <input id="snap-name" placeholder="Label..." className="flex-1 bg-black border border-white/10 rounded-2xl px-5 text-sm" />
               <button onClick={() => {
                 const name = (document.getElementById('snap-name') as HTMLInputElement).value || `Version ${snapshots.length + 1}`;
                 setSnapshots([{ id: Date.now().toString(), name, timestamp: Date.now(), shapes: [...shapes] }, ...snapshots]);
               }} className="p-5 bg-[#00b5cc] text-black rounded-2xl"><Plus/></button>
             </div>
             <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
               {snapshots.map(s => (
                 <div key={s.id} className="p-5 bg-white/5 border border-white/5 rounded-3xl flex items-center justify-between">
                   <div><div className="font-black text-[10px] uppercase tracking-widest">{s.name}</div><div className="text-[8px] text-zinc-600 font-bold">{new Date(s.timestamp).toLocaleTimeString()}</div></div>
                   <div className="flex gap-2">
                     <button onClick={() => { setShapes(s.shapes); setShowHistory(false); }} className="px-4 py-2 bg-[#00b5cc]/10 text-[#00b5cc] rounded-xl text-[9px] font-black uppercase">Restore</button>
                     <button onClick={() => setSnapshots(snapshots.filter(x => x.id !== s.id))} className="p-2 text-red-500/50 hover:text-red-500"><Trash2 className="w-4 h-4"/></button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {zenMode && (
        <button onClick={() => setZenMode(false)} className="fixed top-10 right-10 px-8 py-4 bg-zinc-950/40 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/5 opacity-0 hover:opacity-100 transition-all backdrop-blur-sm">Exit Projecting</button>
      )}
    </div>
  );
};

// --- BOOTSTRAP ---
const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
  setTimeout(() => {
    const loader = document.getElementById('initial-loader');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }
  }, 1000);
}
