
import React, { useState, useEffect, useRef, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Square, Trash2, Camera, Sparkles, Plus, 
  Circle, X, MonitorOff, Zap, Bot, Loader2, Maximize
} from 'lucide-react';
import { GoogleGenAI, Type } from "@google/genai";

// --- GEMINI SERVICE ---
const generateMappingAI = async (prompt: string) => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Projection mapping request: ${prompt}`,
    config: {
      systemInstruction: "Generate JSON shapes. Coordinates 0.0-1.0. Effects: none, strobe, breathe, rainbow.",
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

// --- TYPES ---
type Point = { x: number; y: number };
type Shape = {
  id: string;
  name: string;
  points: Point[];
  color: string;
  opacity: number;
  effect: string;
  visible: boolean;
};

// --- COMPONENTS ---

const App = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'IDLE' | 'DRAWING' | 'EDITING'>('IDLE');
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Setup Camera
  useEffect(() => {
    if (cameraOn) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        .then(s => { if (videoRef.current) videoRef.current.srcObject = s; })
        .catch(console.error);
    } else if (videoRef.current?.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
    }
  }, [cameraOn]);

  const getPos = (e: any): Point => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const touch = e.touches?.[0] || e;
    return {
      x: (touch.clientX - rect.left) / rect.width,
      y: (touch.clientY - rect.top) / rect.height
    };
  };

  const addShape = (pts: Point[], name = 'Shape') => {
    const newShape: Shape = {
      id: Math.random().toString(36).substr(2, 9),
      name: `${name} ${shapes.length + 1}`,
      points: pts,
      color: '#ffffff',
      opacity: 1,
      effect: 'none',
      visible: true
    };
    setShapes([...shapes, newShape]);
    setSelectedId(newShape.id);
  };

  const handleStart = (e: any) => {
    const pos = getPos(e);
    if (mode === 'DRAWING') {
      const newPts = [...drawingPoints, pos];
      if (newPts.length > 2 && Math.hypot(pos.x - newPts[0].x, pos.y - newPts[0].y) < 0.04) {
        addShape(drawingPoints, 'Poly');
        setDrawingPoints([]);
        setMode('IDLE');
      } else {
        setDrawingPoints(newPts);
      }
      return;
    }
    // Simple hit detection
    const hit = shapes.find(s => {
      // Very simple bounding box check for hit detection on iPad
      const minX = Math.min(...s.points.map(p => p.x));
      const maxX = Math.max(...s.points.map(p => p.x));
      const minY = Math.min(...s.points.map(p => p.y));
      const maxY = Math.max(...s.points.map(p => p.y));
      return pos.x >= minX && pos.x <= maxX && pos.y >= minY && pos.y <= maxY;
    });
    setSelectedId(hit?.id || null);
  };

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    let rid: number;
    const draw = (t: number) => {
      const { width: w, height: h } = canvasRef.current!;
      canvasRef.current!.width = canvasRef.current!.offsetWidth;
      canvasRef.current!.height = canvasRef.current!.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      if (cameraOn && videoRef.current) {
        ctx.globalAlpha = 0.4;
        ctx.drawImage(videoRef.current, 0, 0, w, h);
      }

      shapes.forEach(s => {
        if (!s.visible) return;
        ctx.save();
        let alpha = s.opacity;
        if (s.effect === 'breathe') alpha *= 0.6 + 0.4 * Math.sin(t / 400);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        s.points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x * w, p.y * h) : ctx.lineTo(p.x * w, p.y * h));
        ctx.closePath();
        ctx.fillStyle = s.color;
        ctx.fill();
        if (selectedId === s.id && !zenMode) {
          ctx.strokeStyle = '#6366f1';
          ctx.lineWidth = 3;
          ctx.stroke();
        }
        ctx.restore();
      });

      if (mode === 'DRAWING' && drawingPoints.length > 0) {
        ctx.strokeStyle = '#6366f1';
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
    <div className="h-screen w-screen bg-black overflow-hidden flex flex-col text-white touch-none">
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      
      {!zenMode && (
        <div className="absolute top-8 left-8 right-8 flex justify-between items-center z-50">
          <div className="flex gap-4 p-2 bg-zinc-900/90 backdrop-blur rounded-2xl border border-white/10">
            <button onClick={() => addShape([{x:0.4,y:0.4},{x:0.6,y:0.4},{x:0.6,y:0.6},{x:0.4,y:0.6}], 'Quad')} className="p-3 hover:bg-white/10 rounded-xl"><Square className="w-5 h-5"/></button>
            <button onClick={() => setMode('DRAWING')} className={`p-3 rounded-xl ${mode === 'DRAWING' ? 'bg-indigo-600' : ''}`}><Plus className="w-5 h-5"/></button>
            <button onClick={() => setCameraOn(!cameraOn)} className={`p-3 rounded-xl ${cameraOn ? 'text-green-400' : ''}`}><Camera className="w-5 h-5"/></button>
          </div>
          <div className="flex gap-4">
            <button onClick={() => setShowAI(true)} className="px-6 py-3 bg-indigo-600 rounded-2xl font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 shadow-xl"><Sparkles className="w-4 h-4"/> AI Assist</button>
            <button onClick={() => setZenMode(true)} className="p-3 bg-zinc-900 rounded-2xl border border-white/10"><Maximize className="w-5 h-5"/></button>
          </div>
        </div>
      )}

      <div className="flex-1 relative">
        <canvas ref={canvasRef} onPointerDown={handleStart} className="w-full h-full cursor-crosshair" />
        
        {selectedId && !zenMode && (
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 bg-zinc-900/95 border border-white/10 p-6 rounded-3xl flex items-center gap-6 backdrop-blur shadow-2xl">
            <input type="color" className="w-10 h-10 rounded bg-transparent" onChange={e => {
              setShapes(shapes.map(s => s.id === selectedId ? {...s, color: e.target.value} : s));
            }} />
            <select className="bg-black border border-white/10 rounded-lg p-2 text-[10px] uppercase tracking-widest" onChange={e => {
              setShapes(shapes.map(s => s.id === selectedId ? {...s, effect: e.target.value} : s));
            }}>
              <option value="none">Solid</option>
              <option value="breathe">Breathe</option>
              <option value="strobe">Strobe</option>
              <option value="rainbow">Rainbow</option>
            </select>
            <button onClick={() => setShapes(shapes.filter(s => s.id !== selectedId))} className="p-3 text-red-400"><Trash2 className="w-5 h-5"/></button>
          </div>
        )}
      </div>

      {showAI && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex items-center justify-center p-6">
          <div className="bg-zinc-900 border border-white/10 w-full max-w-md rounded-[32px] p-8 shadow-2xl relative">
             <button onClick={() => setShowAI(false)} className="absolute top-6 right-6 p-2"><X/></button>
             <h2 className="text-xl font-black mb-4 flex items-center gap-2"><Sparkles className="text-indigo-400"/> AI Mapping</h2>
             <textarea id="ai-p" placeholder="Describe layout..." className="w-full h-24 bg-black border border-white/10 rounded-xl p-4 mb-4" />
             <button disabled={loadingAI} onClick={async () => {
               setLoadingAI(true);
               try {
                 const res = await generateMappingAI((document.getElementById('ai-p') as any).value);
                 res.shapes.forEach((s: any) => addShape(s.points, s.name));
                 setShowAI(false);
               } catch (e) { alert(e.message); } finally { setLoadingAI(false); }
             }} className="w-full py-4 bg-indigo-600 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2">
               {loadingAI ? <Loader2 className="animate-spin"/> : 'Generate'}
             </button>
          </div>
        </div>
      )}

      {zenMode && <button onClick={() => setZenMode(false)} className="fixed top-6 right-6 p-4 bg-zinc-900/20 rounded-xl text-[10px] font-bold uppercase opacity-0 hover:opacity-100">Exit</button>}
    </div>
  );
};

// --- MOUNTING ---
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<App />);
const loader = document.getElementById('initial-loader');
if (loader) {
  setTimeout(() => {
    loader.style.opacity = '0';
    setTimeout(() => loader.remove(), 500);
  }, 1000);
}
