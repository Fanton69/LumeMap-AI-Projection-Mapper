import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Square, Trash2, Camera, Sparkles, Plus, 
  X, Maximize, Loader2, Zap, Save, History, 
  Download, Upload, Clock, Box, Eye, EyeOff,
  ChevronRight, Settings2, RotateCcw
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- TYPES & CONSTANTS ---
type Point = { x: number; y: number };
enum EffectType { NONE = 'none', STROBE = 'strobe', BREATHE = 'breathe', RAINBOW = 'rainbow' }

interface Shape {
  id: string;
  name: string;
  points: Point[];
  color: string;
  opacity: number;
  effect: EffectType;
  visible: boolean;
}

interface ProjectVersion {
  id: string;
  name: string;
  timestamp: number;
  shapes: Shape[];
}

// --- GEMINI SERVICE ---
const generateMappingAI = async (prompt: string) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Projection mapping request: ${prompt}`,
    config: {
      systemInstruction: "You are an expert projection mapping designer. Generate JSON shapes. All points (x,y) must be 0.0 to 1.0. Effects: none, strobe, breathe, rainbow.",
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
  const [showProjects, setShowProjects] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [dragPoint, setDragPoint] = useState<{ shapeId: string; index: number } | null>(null);

  // Load versions from local storage
  useEffect(() => {
    const saved = localStorage.getItem('lumemap_projects');
    if (saved) setVersions(JSON.parse(saved));
  }, []);

  // Sync versions to local storage
  useEffect(() => {
    localStorage.setItem('lumemap_projects', JSON.stringify(versions));
  }, [versions]);

  // Camera Handling
  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
        .catch(err => {
          console.error(err);
          alert("Camera access denied. Please check site permissions.");
        });
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
    const newShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      name: `${name} ${shapes.length + 1}`,
      points: pts,
      color: '#6366f1',
      opacity: 0.8,
      effect: EffectType.NONE,
      visible: true
    };
    setShapes(prev => [...prev, newShape]);
    setSelectedId(newShape.id);
  };

  const handlePointerDown = (e: any) => {
    const pos = getPos(e);
    
    if (mode === 'DRAWING') {
      const newPts = [...drawingPoints, pos];
      // Close path if clicking near start
      if (newPts.length > 2 && Math.hypot(pos.x - newPts[0].x, pos.y - newPts[0].y) < 0.04) {
        addShape(drawingPoints, 'Poly');
        setDrawingPoints([]);
        setMode('IDLE');
      } else {
        setDrawingPoints(newPts);
      }
      return;
    }

    // Hit test for points first
    if (selectedId) {
      const shape = shapes.find(s => s.id === selectedId);
      if (shape) {
        const pointIdx = shape.points.findIndex(p => Math.hypot(p.x - pos.x, p.y - pos.y) < 0.03);
        if (pointIdx !== -1) {
          setDragPoint({ shapeId: selectedId, index: pointIdx });
          return;
        }
      }
    }

    // Hit test for shapes
    const hit = [...shapes].reverse().find(s => {
      if (!s.visible) return false;
      const xs = s.points.map(p => p.x);
      const ys = s.points.map(p => p.y);
      return pos.x >= Math.min(...xs) - 0.02 && pos.x <= Math.max(...xs) + 0.02 &&
             pos.y >= Math.min(...ys) - 0.02 && pos.y <= Math.max(...ys) + 0.02;
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

  const handlePointerUp = () => setDragPoint(null);

  // Render Loop
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
          ctx.setLineDash([5, 5]);
          ctx.stroke();
          ctx.setLineDash([]);
          
          // Render corner handles
          s.points.forEach(p => {
            ctx.fillStyle = '#6366f1';
            ctx.beginPath(); ctx.arc(p.x * w, p.y * h, 8, 0, 7); ctx.fill();
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

  const saveVersion = (name: string) => {
    const newV: ProjectVersion = {
      id: Math.random().toString(36).substr(2, 9),
      name: name || `Project ${versions.length + 1}`,
      timestamp: Date.now(),
      shapes: JSON.parse(JSON.stringify(shapes))
    };
    setVersions([newV, ...versions]);
    setShowProjects(false);
  };

  return (
    <div className="h-screen w-screen bg-black overflow-hidden flex flex-col text-white touch-none">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      
      {/* HUD - Top Bar */}
      {!zenMode && (
        <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-50 pointer-events-none">
          <div className="flex gap-4 p-2 bg-zinc-900/90 backdrop-blur rounded-2xl border border-white/10 shadow-2xl pointer-events-auto">
            <button 
              onClick={() => addShape([{x:0.35,y:0.35},{x:0.65,y:0.35},{x:0.65,y:0.65},{x:0.35,y:0.65}], 'Quad')} 
              className="p-3 hover:bg-white/10 rounded-xl transition-all"
            ><Square className="w-5 h-5"/></button>
            <button 
              onClick={() => { setMode('DRAWING'); setDrawingPoints([]); }} 
              className={`p-3 rounded-xl transition-all ${mode === 'DRAWING' ? 'bg-indigo-600' : 'hover:bg-white/10'}`}
            ><Plus className="w-5 h-5"/></button>
            <button 
              onClick={() => setCameraOn(!cameraOn)} 
              className={`p-3 rounded-xl transition-all ${cameraOn ? 'text-green-400 bg-green-400/10 border border-green-400/20' : 'hover:bg-white/10'}`}
            ><Camera className="w-5 h-5"/></button>
          </div>
          
          <div className="flex gap-4 pointer-events-auto">
            <button 
              onClick={() => setShowProjects(true)}
              className="p-3 bg-zinc-900/90 rounded-2xl border border-white/10 hover:bg-white/5 transition-all shadow-xl"
            ><History className="w-5 h-5"/></button>
            <button 
              onClick={() => setShowAI(true)} 
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl active:scale-95 transition-all"
            ><Sparkles className="w-4 h-4"/> AI Assist</button>
            <button 
              onClick={() => setZenMode(true)} 
              className="p-3 bg-zinc-900/90 rounded-2xl border border-white/10 hover:bg-white/5 shadow-xl"
            ><Maximize className="w-5 h-5"/></button>
          </div>
        </div>
      )}

      {/* Main Interaction Canvas */}
      <div className="flex-1 relative">
        <canvas 
          ref={canvasRef} 
          onPointerDown={handlePointerDown} 
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="w-full h-full cursor-crosshair" 
        />
        
        {/* Shape Properties Panel */}
        {selectedId && !zenMode && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-white/10 p-6 rounded-[32px] flex items-center gap-8 backdrop-blur shadow-2xl animate-in slide-in-from-bottom-8">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Color</span>
              <input type="color" className="w-10 h-10 rounded-lg bg-transparent cursor-pointer" value={shapes.find(s=>s.id===selectedId)?.color} onChange={e => {
                setShapes(prev => prev.map(s => s.id === selectedId ? {...s, color: e.target.value} : s));
              }} />
            </div>
            
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Effect</span>
              <select className="bg-black border border-white/10 rounded-lg p-2 text-[10px] font-black uppercase tracking-widest outline-none ring-indigo-500 focus:ring-1" value={shapes.find(s=>s.id===selectedId)?.effect} onChange={e => {
                setShapes(prev => prev.map(s => s.id === selectedId ? {...s, effect: e.target.value as EffectType} : s));
              }}>
                <option value="none">Solid</option>
                <option value="breathe">Breathe</option>
                <option value="strobe">Strobe</option>
              </select>
            </div>

            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Opacity</span>
              <input type="range" min="0" max="1" step="0.1" value={shapes.find(s=>s.id===selectedId)?.opacity} onChange={e => {
                setShapes(prev => prev.map(s => s.id === selectedId ? {...s, opacity: parseFloat(e.target.value)} : s));
              }} className="w-24 accent-indigo-500" />
            </div>

            <button onClick={() => { setShapes(prev => prev.filter(s => s.id !== selectedId)); setSelectedId(null); }} className="p-4 text-red-400 hover:bg-red-400/10 rounded-2xl transition-all">
              <Trash2 className="w-6 h-6"/>
            </button>
          </div>
        )}
      </div>

      {/* AI Modal */}
      {showAI && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[40px] p-8 shadow-2xl relative animate-in zoom-in-95">
             <button onClick={() => setShowAI(false)} className="absolute top-8 right-8 p-2 text-zinc-500 hover:text-white"><X/></button>
             <h2 className="text-2xl font-black mb-2 flex items-center gap-3"><Sparkles className="text-indigo-400"/> AI Mapping Assistant</h2>
             <p className="text-zinc-500 text-sm mb-8">Describe your layout (e.g., "5 triangles floating in the center").</p>
             <textarea id="ai-input" placeholder="Describe layout..." className="w-full h-32 bg-black border border-white/10 rounded-2xl p-4 text-white resize-none mb-6 outline-none focus:ring-2 ring-indigo-500" />
             <button disabled={loadingAI} onClick={async () => {
               const val = (document.getElementById('ai-input') as HTMLTextAreaElement).value;
               if (!val) return;
               setLoadingAI(true);
               try {
                 const res = await generateMappingAI(val);
                 res.shapes.forEach((s: any) => addShape(s.points, s.name));
                 setShowAI(false);
               } catch (e) { alert(e.message); } finally { setLoadingAI(false); }
             }} className="w-full py-5 bg-indigo-600 rounded-2xl font-black uppercase tracking-[0.2em] flex items-center justify-center gap-3 shadow-lg hover:bg-indigo-500 transition-all">
               {loadingAI ? <Loader2 className="animate-spin w-6 h-6"/> : 'Generate Geometry'}
             </button>
          </div>
        </div>
      )}

      {/* Projects/History Modal */}
      {showProjects && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[40px] p-8 shadow-2xl relative animate-in zoom-in-95">
             <button onClick={() => setShowProjects(false)} className="absolute top-8 right-8 p-2 text-zinc-500 hover:text-white"><X/></button>
             <h2 className="text-2xl font-black mb-6 flex items-center gap-3"><Save className="text-indigo-400"/> Projects</h2>
             
             <div className="flex gap-2 mb-8">
               <input id="proj-name" placeholder="Snapshot Name..." className="flex-1 bg-black border border-white/10 rounded-xl px-4 text-sm" />
               <button onClick={() => saveVersion((document.getElementById('proj-name') as HTMLInputElement).value)} className="p-4 bg-indigo-600 rounded-xl"><Plus/></button>
             </div>

             <div className="space-y-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
               {versions.length === 0 && <p className="text-zinc-600 text-center py-8 font-bold uppercase tracking-widest text-[10px]">No snapshots found</p>}
               {versions.map(v => (
                 <div key={v.id} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between group">
                   <div>
                     <div className="font-bold text-sm uppercase tracking-wider">{v.name}</div>
                     <div className="text-[9px] text-zinc-600 font-black">{new Date(v.timestamp).toLocaleString()}</div>
                   </div>
                   <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => { setShapes(v.shapes); setShowProjects(false); }} className="p-2 text-indigo-400 hover:bg-indigo-400/10 rounded-lg">Load</button>
                     <button onClick={() => setVersions(versions.filter(x => x.id !== v.id))} className="p-2 text-red-500"><Trash2 className="w-4 h-4"/></button>
                   </div>
                 </div>
               ))}
             </div>
          </div>
        </div>
      )}

      {/* Exit Zen Mode */}
      {zenMode && (
        <button 
          onClick={() => setZenMode(false)} 
          className="fixed top-8 right-8 p-5 bg-zinc-900/40 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/5 opacity-0 hover:opacity-100 transition-all backdrop-blur-sm"
        >Exit Mirror</button>
      )}
    </div>
  );
};

// --- RENDER ---
const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
  
  // Cleanup initial loader
  const loader = document.getElementById('initial-loader');
  if (loader) {
    setTimeout(() => {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 500);
    }, 1000);
  }
}
