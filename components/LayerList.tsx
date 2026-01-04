
import React from 'react';
import { Eye, EyeOff, Trash2, Hexagon, Plus, Video, Image as ImageIcon, Box } from 'lucide-react';
import { Shape, FillType } from '../types';

interface LayerListProps {
  shapes: Shape[];
  selectedShapeId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleVisibility: (id: string, visible: boolean) => void;
  onAddClick: () => void;
}

const LayerList: React.FC<LayerListProps> = ({ 
  shapes, 
  selectedShapeId, 
  onSelect, 
  onDelete, 
  onToggleVisibility,
  onAddClick
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
          <Box className="w-3.5 h-3.5" />
          Mapping Stack
        </h3>
        <button 
          onClick={onAddClick}
          className="p-1.5 rounded-lg bg-[#00b5cc]/10 text-[#00b5cc] hover:bg-[#00b5cc] hover:text-black transition-all shadow-lg"
          title="Add New Surface"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex flex-col gap-2">
        {shapes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-white/5 rounded-2xl bg-slate-950/20">
            <p className="text-slate-600 text-[10px] font-bold uppercase tracking-widest text-center mb-4">
              Canvas Empty
            </p>
            <button 
              onClick={onAddClick}
              className="px-4 py-2 rounded-lg bg-slate-900 text-[10px] font-black text-[#00b5cc] hover:bg-slate-800 uppercase tracking-widest transition-all border border-[#00b5cc]/20"
            >
              Add First Quad
            </button>
          </div>
        ) : (
          [...shapes].reverse().map(shape => (
            <div 
              key={shape.id}
              onClick={() => onSelect(shape.id)}
              className={`flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all border group ${selectedShapeId === shape.id ? 'bg-[#00b5cc]/10 border-[#00b5cc]/50 text-white' : 'bg-slate-950/40 border-transparent text-slate-400 hover:bg-slate-900 hover:border-white/5'}`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <div 
                  className="w-1.5 h-8 rounded-full flex-shrink-0" 
                  style={{ backgroundColor: shape.style.color, opacity: shape.style.opacity }} 
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black uppercase tracking-wider truncate leading-tight">{shape.name}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {shape.style.fillType === FillType.VIDEO ? (
                      <Video className="w-2.5 h-2.5 text-indigo-400" />
                    ) : shape.style.fillType === FillType.IMAGE ? (
                      <ImageIcon className="w-2.5 h-2.5 text-emerald-400" />
                    ) : (
                      <div className="w-2 h-2 rounded-sm border border-slate-600" />
                    )}
                    <span className="text-[8px] font-bold uppercase text-slate-600">{shape.style.fillType}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleVisibility(shape.id, !shape.visible);
                  }}
                  className={`p-1.5 rounded-lg transition-colors ${shape.visible ? 'text-[#00b5cc]' : 'text-slate-700'}`}
                >
                  {shape.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(shape.id);
                  }}
                  className="p-1.5 rounded-lg hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default LayerList;
