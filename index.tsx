import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Square, Trash2, Camera, Sparkles, Plus, X, Maximize, 
  Loader2, Save, History, Settings2, Box, Eye, EyeOff
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES & DEFAULTS ---
type Point = { x: number; y: number };
enum EffectType { NONE = 'none', STROBE = 'strobe', BREATHE = 'breathe' }

interface Shape {
  id: string;
  name: string;
  points: Point[];
  color: string;
  opacity: number;
  effect: EffectType;
  visible: boolean;
}

interface Snapshot {
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
    contents: `Projection mapping request: "${prompt}"`,
    config: {
      systemInstruction: "Generate JSON coordinates (0.0 to 1.0) for projection mapping surfaces. Valid effects: none, strobe, breathe.",
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
                  items: {
                    type: Type.OBJECT,
                    properties: { x: { type: Type.NUMBER }, y: { type: Type.NUMBER } },
                    required: ["x", "y"]
                  }
                },
                color: { type: Type.STRING },
                effect: { type: Type.STRING }
              },
              required: ["name", "points", "color", "effect"]
            }
          }
        },
        required: ["shapes"]
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
  const [loadingAI, setLoadingAI] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dragPoint, setDragPoint] = useState<{ shapeId: string; index: number } | null>(null);

  // Persistence
  useEffect(() => {
    const saved = localStorage.getItem('lumemap_v1_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      setShapes(parsed.shapes || []);
      setSnapshots(parsed.snapshots || []);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('lumemap_v1_data', JSON.stringify({ shapes, snapshots }));
  }, [shapes, snapshots]);

  // Camera handling for iPad
  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
        .catch(() => alert("Camera blocked. Enable in settings."));
    } else if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  }, [cameraOn]);

  const getPos = (e: any): Point => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: (touch.clientX - rect.left) / rect.width,
      y: (touch.clientY - rect.top) / rect.height
    };
  };

  const addShape = (pts: Point[], name = 'Surface') => {
    const id = Math.random().toString(36).substr(2, 9);
    const newShape: Shape = {
      id,
      name: `${name} ${shapes.length + 1}`,
      points: pts,
      color: '#6366f1',
      opacity: 0.8,
      effect: EffectType.NONE,
      visible: true
    };
    setShapes(prev => [...prev, newShape]);
    setSelectedId(id);
  };

  const handlePointerDown = (e: any) => {
    const pos = getPos(e);
    if (mode === 'DRAWING') {
      const newPts = [...drawingPoints, pos];
      if (newPts.length > 2 && Math.hypot(pos.x - newPts[0].x, pos.y - newPts[0].y) < 0.05) {
        addShape(drawingPoints, 'Poly');
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
        // Larger hit area for iPad
        const pIdx = s.points.findIndex(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 0.05);
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
      return pos.x >= Math.min(...xs) - 0.03 && pos.x <= Math.max(...xs) + 0.03 &&
             pos.y >= Math.min(...ys) - 0.03 && pos.y <= Math.max(...ys) + 0.03;
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
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.drawImage(videoRef.current, 0, 0, w, h);
        ctx.restore();
      }

      shapes.forEach(s => {
        if (!s.visible) return;
        ctx.save();
        let alpha = s.opacity;
        if (s.effect === EffectType.BREATHE) alpha *= 0.6 + 0.4 * Math.sin(t / 500);
        if (s.effect === EffectType.STROBE) alpha *= Math.floor(t / 100) % 2;
        
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        s.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h));
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();

        if (selectedId === s.id && !zenMode) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 2;
          ctx.stroke();
          s.points.forEach(p => {
            ctx.fillStyle = '#6366f1';
            ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 10, 0, 7); ctx.fill();
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
          });
        }
        ctx.restore();
      });

      if (mode === 'DRAWING' && drawingPoints.length > 0) {
        ctx.strokeStyle = '#6366f1';
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
    <div className="h-screen w-screen bg-black flex flex-col text-white touch-none">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      
      {!zenMode && (
        <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-50 pointer-events-none">
          <div className="flex gap-3 p-2 bg-zinc-900/90 backdrop-blur rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
            <button onClick={() => addShape([{x:0.4,y:0.4},{x:0.6,y:0.4},{x:0.6,y:0.6},{x:0.4,y:0.6}], 'Quad')} className="p-3 hover:bg-white/10 rounded-xl transition-all"><Square className="w-5 h-5"/></button>
            <button onClick={() => { setMode('DRAWING'); setDrawingPoints([]); }} className={`p-3 rounded-xl transition-all ${mode === 'DRAWING' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}><Plus className="w-5 h-5"/></button>
            <button onClick={() => setCameraOn(!cameraOn)} className={`p-3 rounded-xl transition-all ${cameraOn ? 'text-green-400 bg-green-400/10' : 'hover:bg-white/10'}`}><Camera className="w-5 h-5"/></button>
            <button onClick={() => setShowHistory(true)} className="p-3 hover:bg-white/10 rounded-xl transition-all"><History className="w-5 h-5"/></button>
          </div>
          <div className="flex gap-4 pointer-events-auto">
            <button onClick={() => setShowAI(true)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl transition-all"><Sparkles className="w-4 h-4"/> AI Assist</button>
            <button onClick={() => setZenMode(true)} className="p-3 bg-zinc-900 rounded-2xl border border-white/10"><Maximize className="w-5 h-5"/></button>
          </div>
        </div>
      )}

      <div className="flex-1 relative">
        <canvas ref={canvasRef} onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={() => setDragPoint(null)} className="w-full h-full cursor-crosshair" />
        
        {selectedId && !zenMode && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-white/10 p-6 rounded-[32px] flex items-center gap-8 backdrop-blur shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">Color</span>
              <input type="color" className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer" value={shapes.find(s=>s.id===selectedId)?.color} onChange={e => {
                setShapes(prev => prev.map(s => s.id === selectedId ? {...s, color: e.target.value} : s));
              }} />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[8px] font-black uppercase text-zinc-500 tracking-widest">FX</span>
              <select className="bg-black border border-white/10 rounded-lg p-2 text-[10px] font-black uppercase tracking-widest outline-none" value={shapes.find(s=>s.id===selectedId)?.effect} onChange={e => {
                setShapes(prev => prev.map(s => s.id === selectedId ? {...s, effect: e.target.value as EffectType} : s));
              }}>
                <option value="none">Solid</option>
                <option value="breathe">Breathe</option>
                <option value="strobe">Strobe</option>
              </select>
            </div>
            <button onClick={() => { setShapes(prev => prev.filter(s => s.id !== selectedId)); setSelectedId(null); }} className="p-4 text-red-400 hover:bg-red-400/10 rounded-2xl transition-all"><Trash2 className="w-6 h-6"/></button>
          </div>
        )}
      </div>

      {showAI && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[40px] p-8 shadow-2xl relative">
             <button onClick={() => setShowAI(false)} className="absolute top-8 right-8 p-2 text-zinc-500 hover:text-white"><X/></button>
             <h2 className="text-2xl font-black mb-2 flex items-center gap-3"><Sparkles className="text-indigo-400"/> AI Mapping</h2>
             <textarea id="ai-input" placeholder="e.g. 5 triangles scattered randomly..." className="w-full h-32 bg-black border border-white/10 rounded-2xl p-4 text-white resize-none mb-6 outline-none focus:ring-2 ring-indigo-500" />
             <button disabled={loadingAI} onClick={async () => {
               const val = (document.getElementById('ai-input') as any).value;
               if (!val) return;
               setLoadingAI(true);
               try {
                 const res = await callGeminiAI(val);
                 res.shapes.forEach((s: any) => addShape(s.points, s.name));
                 setShowAI(false);
               } catch (e: any) { alert(e.message); } finally { setLoadingAI(false); }
             }} className="w-full py-5 bg-indigo-600 rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 active:scale-95 transition-all">
               {loadingAI ? <Loader2 className="animate-spin"/> : 'Generate Surfaces'}
             </button>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[40px] p-8 shadow-2xl relative">
             <button onClick={() => setShowHistory(false)} className="absolute top-8 right-8 p-2 text-zinc-500 hover:text-white"><X/></button>
             <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><Save className="text-indigo-400"/> Snapshots</h2>
             <div className="flex gap-2 mb-6">
               <input id="snap-name" placeholder="Name..." className="flex-1 bg-black border border-white/10 rounded-xl px-4 text-sm" />
               <button onClick={() => {
                 const name = (document.getElementById('snap-name') as HTMLInputElement).value || `Project ${snapshots.length + 1}`;
                 setSnapshots([{ id: Date.now().toString(), name, timestamp: Date.now(), shapes: [...shapes] }, ...snapshots]);
               }} className="p-4 bg-indigo-600 rounded-xl"><Plus/></button>
             </div>
             <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
               {snapshots.map(s => (
                 <div key={s.id} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between">
                   <div><div className="font-bold text-xs uppercase">{s.name}</div><div className="text-[9px] text-zinc-500">{new Date(s.timestamp).toLocaleTimeString()}</div></div>
                   <div className="flex gap-2">
                     <button onClick={() => { setShapes(s.shapes); setShowHistory(false); }} className="px-3 py-2 bg-indigo-600/20 text-indigo-400 rounded-lg text-[10px] font-bold">Load</button>
                     <button onClick={() => setSnapshots(snapshots.filter(x => x.id !== s.id))} className="p-2 text-red-400"><Trash2 className="w-4 h-4"/></button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {zenMode && (
        <button onClick={() => setZenMode(false)} className="fixed top-8 right-8 p-5 bg-zinc-900/40 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 opacity-0 hover:opacity-100 transition-all backdrop-blur-sm">Exit Mode</button>
      )}
    </div>
  );
};

// --- RENDER ---
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
