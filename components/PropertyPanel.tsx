
import React, { useRef } from 'react';
import { Settings, Boxes, Zap, Paintbrush, Video, Upload, Image as ImageIcon, MonitorPlay, Film, Waves, Maximize, Crop } from 'lucide-react';
import { Shape, EffectType, ShapeStyle, FillType, MappingMode } from '../types';

interface PropertyPanelProps {
  shape: Shape;
  onUpdateStyle: (style: Partial<ShapeStyle>) => void;
  onUpdateName: (name: string) => void;
}

const PropertyPanel: React.FC<PropertyPanelProps> = ({ shape, onUpdateStyle, onUpdateName }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    if (file.type.startsWith('video/')) {
      onUpdateStyle({ fillType: FillType.VIDEO, videoSrc: url, videoMuted: true });
    } else if (file.type.startsWith('image/')) {
      onUpdateStyle({ fillType: FillType.IMAGE, imageSrc: url });
    }
  };

  const isMediaFill = shape.style.fillType === FillType.VIDEO || shape.style.fillType === FillType.IMAGE;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      <div className="space-y-6">
        {/* Surface Name */}
        <div>
          <label className="text-[10px] text-slate-500 block mb-2 uppercase font-black tracking-[0.2em]">Surface Identity</label>
          <input 
            type="text" 
            value={shape.name}
            onChange={(e) => onUpdateName(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#00b5cc] transition-all"
          />
        </div>

        {/* Content Source Selection */}
        <div>
          <label className="text-[10px] text-slate-500 block mb-4 uppercase font-black tracking-[0.2em] flex items-center gap-2">
            <MonitorPlay className="w-3.5 h-3.5" /> Content Source
          </label>
          
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => onUpdateStyle({ fillType: FillType.SOLID })}
                className={`flex flex-col items-center gap-2 group transition-all`}
              >
                <div 
                  className={`w-full h-14 rounded-xl border-2 transition-all shadow-xl overflow-hidden flex items-center justify-center ${shape.style.fillType === FillType.SOLID ? 'border-[#00b5cc] scale-105 shadow-[#00b5cc]/20' : 'border-white/5 group-hover:border-white/20'}`}
                  style={{ backgroundColor: shape.style.color }}
                />
                <span className={`text-[8px] font-black uppercase tracking-widest ${shape.style.fillType === FillType.SOLID ? 'text-[#00b5cc]' : 'text-slate-500'}`}>Solid</span>
              </button>

              <button
                onClick={() => onUpdateStyle({ fillType: FillType.CHECKERBOARD })}
                className={`flex flex-col items-center gap-2 group transition-all`}
              >
                <div 
                  className={`w-full h-14 rounded-xl border-2 transition-all shadow-xl overflow-hidden bg-black ${shape.style.fillType === FillType.CHECKERBOARD ? 'border-[#00b5cc] scale-105 shadow-[#00b5cc]/20' : 'border-white/5 group-hover:border-white/20'}`}
                  style={{backgroundImage: `linear-gradient(45deg, #333 25%, transparent 25%), linear-gradient(-45deg, #333 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #333 75%), linear-gradient(-45deg, transparent 75%, #333 75%)`, backgroundSize: '10px 10px'}}
                />
                <span className={`text-[8px] font-black uppercase tracking-widest ${shape.style.fillType === FillType.CHECKERBOARD ? 'text-[#00b5cc]' : 'text-slate-500'}`}>Check</span>
              </button>

              <button
                onClick={() => onUpdateStyle({ fillType: FillType.GRID })}
                className={`flex flex-col items-center gap-2 group transition-all`}
              >
                <div 
                  className={`w-full h-14 rounded-xl border-2 transition-all shadow-xl overflow-hidden bg-slate-900 ${shape.style.fillType === FillType.GRID ? 'border-[#00f2ff] scale-105 shadow-[#00f2ff]/30' : 'border-white/5 group-hover:border-white/20'}`}
                  style={{backgroundImage: `linear-gradient(rgba(0, 242, 255, 0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 242, 255, 0.4) 1px, transparent 1px)`, backgroundSize: '10px 10px'}}
                />
                <span className={`text-[8px] font-black uppercase tracking-widest ${shape.style.fillType === FillType.GRID ? 'text-[#00f2ff]' : 'text-slate-500'}`}>Grid</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => onUpdateStyle({ fillType: FillType.VIDEO })}
                className={`flex flex-col items-center gap-2 group transition-all`}
              >
                <div className={`w-full h-12 rounded-xl border-2 flex items-center justify-center transition-all bg-slate-950 ${shape.style.fillType === FillType.VIDEO ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400 shadow-lg shadow-indigo-500/10' : 'border-white/5 text-slate-500 group-hover:border-white/20'}`}>
                  <Video className="w-5 h-5" />
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest ${shape.style.fillType === FillType.VIDEO ? 'text-indigo-400' : 'text-slate-500'}`}>Video</span>
              </button>

              <button
                onClick={() => onUpdateStyle({ fillType: FillType.IMAGE })}
                className={`flex flex-col items-center gap-2 group transition-all`}
              >
                <div className={`w-full h-12 rounded-xl border-2 flex items-center justify-center transition-all bg-slate-950 ${shape.style.fillType === FillType.IMAGE ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/10' : 'border-white/5 text-slate-500 group-hover:border-white/20'}`}>
                  <ImageIcon className="w-5 h-5" />
                </div>
                <span className={`text-[8px] font-black uppercase tracking-widest ${shape.style.fillType === FillType.IMAGE ? 'text-emerald-400' : 'text-slate-500'}`}>Image</span>
              </button>
            </div>
          </div>
        </div>

        {isMediaFill && (
          <div className="bg-slate-950/50 p-4 rounded-2xl border border-white/5 space-y-5 animate-in slide-in-from-top-4">
            <div>
              <label className="text-[9px] text-slate-500 block uppercase font-black tracking-widest mb-3">Fit Mode</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => onUpdateStyle({ mappingMode: MappingMode.MASK })}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${shape.style.mappingMode === MappingMode.MASK ? 'bg-white text-black border-white' : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'}`}
                >
                  <Crop className="w-3.5 h-3.5" /> Mask
                </button>
                <button 
                  onClick={() => onUpdateStyle({ mappingMode: MappingMode.STRETCH })}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-[9px] font-black uppercase tracking-widest transition-all ${shape.style.mappingMode === MappingMode.STRETCH ? 'bg-indigo-600 text-white border-indigo-500' : 'bg-transparent text-slate-500 border-white/10 hover:border-white/30'}`}
                >
                  <Maximize className="w-3.5 h-3.5" /> Stretch
                </button>
              </div>
            </div>

            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group relative w-full h-24 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-2 bg-black hover:bg-slate-900 cursor-pointer transition-all hover:border-[#00b5cc]/40 overflow-hidden"
            >
              {shape.style.fillType === FillType.VIDEO && shape.style.videoSrc ? (
                <video src={shape.style.videoSrc} className="absolute inset-0 w-full h-full object-cover opacity-60" muted />
              ) : shape.style.fillType === FillType.IMAGE && shape.style.imageSrc ? (
                <img src={shape.style.imageSrc} className="absolute inset-0 w-full h-full object-cover opacity-60" />
              ) : null}
              <div className="relative z-10 flex flex-col items-center">
                <Upload className="w-5 h-5 text-[#00b5cc] mb-1" />
                <span className="text-[9px] text-white font-black uppercase tracking-widest">Replace Content</span>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept={shape.style.fillType === FillType.VIDEO ? "video/*" : "image/*"} />
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-white/5 grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-slate-500 block mb-2 uppercase font-black tracking-widest">Color Tint</label>
            <div className="flex items-center gap-2 bg-slate-950 border border-white/5 p-2 rounded-xl">
              <input 
                type="color" 
                value={shape.style.color}
                onChange={(e) => onUpdateStyle({ color: e.target.value })}
                className="w-full h-10 bg-transparent rounded cursor-pointer border-none"
              />
            </div>
          </div>
          <div>
            <label className="text-[10px] text-slate-500 block mb-2 uppercase font-black tracking-widest">Opacity</label>
            <div className="h-14 flex items-center">
              <input 
                type="range" 
                min="0" max="1" step="0.01"
                value={shape.style.opacity}
                onChange={(e) => onUpdateStyle({ opacity: parseFloat(e.target.value) })}
                className="w-full accent-[#00b5cc]"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 block mb-3 uppercase font-black tracking-widest flex items-center gap-2">
            <Zap className="w-3.5 h-3.5 text-yellow-400" /> FX Engine
          </label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(EffectType).map(type => (
              <button 
                key={type}
                onClick={() => onUpdateStyle({ effect: type as EffectType })}
                className={`text-[9px] font-black uppercase py-3 rounded-xl border transition-all flex items-center justify-center gap-2 ${shape.style.effect === type ? 'bg-yellow-500 text-black border-yellow-400 shadow-lg shadow-yellow-500/10' : 'bg-slate-950 border-white/5 text-slate-500'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyPanel;
