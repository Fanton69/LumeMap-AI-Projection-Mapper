
import React, { useState } from 'react';
import { Save, History, Download, Upload, Trash2, Clock, FileJson, Check, Plus } from 'lucide-react';
import { Shape, ProjectVersion } from '../types.ts';

interface ProjectManagerProps {
  shapes: Shape[];
  versions: ProjectVersion[];
  onSaveVersion: (name: string) => void;
  onRestoreVersion: (version: ProjectVersion) => void;
  onDeleteVersion: (id: string) => void;
  onExport: () => void;
  onImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const ProjectManager: React.FC<ProjectManagerProps> = ({ 
  shapes, 
  versions, 
  onSaveVersion, 
  onRestoreVersion, 
  onDeleteVersion,
  onExport,
  onImport
}) => {
  const [newVersionName, setNewVersionName] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = () => {
    if (!newVersionName.trim()) return;
    onSaveVersion(newVersionName);
    setNewVersionName('');
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-500">
      <div className="space-y-4">
        <label className="text-[10px] text-slate-500 block uppercase font-black tracking-[0.2em]">Create Snapshot</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="e.g. Version 1.0"
            value={newVersionName}
            onChange={(e) => setNewVersionName(e.target.value)}
            className="flex-1 bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          <button 
            onClick={handleSave}
            disabled={!newVersionName.trim()}
            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${saveSuccess ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30'}`}
          >
            {saveSuccess ? <Check className="w-5 h-5" /> : <Save className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="pt-6 border-t border-white/5 space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-[10px] text-slate-500 block uppercase font-black tracking-[0.2em] flex items-center gap-2">
            <History className="w-3.5 h-3.5" /> Revision History
          </label>
          <span className="text-[9px] font-bold text-slate-600 uppercase tracking-widest">{versions.length} Saved</span>
        </div>

        <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
          {versions.length === 0 ? (
            <div className="py-8 text-center border border-dashed border-white/5 rounded-2xl bg-slate-950/20">
              <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">No versions saved yet</p>
            </div>
          ) : (
            [...versions].reverse().map((v) => (
              <div 
                key={v.id}
                className="group flex items-center justify-between p-3 bg-slate-950 border border-white/5 rounded-2xl hover:border-white/20 transition-all"
              >
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-black text-white uppercase tracking-wider truncate">{v.name}</span>
                  <span className="text-[8px] font-bold text-slate-500 uppercase flex items-center gap-1 mt-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    {new Date(v.timestamp).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => onRestoreVersion(v)}
                    className="p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500 hover:text-white transition-all text-[9px] font-black uppercase tracking-widest"
                  >
                    Restore
                  </button>
                  <button 
                    onClick={() => onDeleteVersion(v.id)}
                    className="p-2 rounded-lg text-slate-600 hover:text-red-500 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-white/5 space-y-4">
        <label className="text-[10px] text-slate-500 block uppercase font-black tracking-[0.2em]">Master Export</label>
        <div className="grid grid-cols-2 gap-3">
          <button 
            onClick={onExport}
            className="flex items-center justify-center gap-2 py-3 bg-slate-900 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
          >
            <Download className="w-3.5 h-3.5" /> Download .JSON
          </button>
          <label className="flex items-center justify-center gap-2 py-3 bg-slate-900 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-white hover:bg-slate-800 transition-all cursor-pointer">
            <Upload className="w-3.5 h-3.5" /> Import File
            <input type="file" className="hidden" accept=".json" onChange={onImport} />
          </label>
        </div>
        <p className="text-[8px] text-slate-600 font-bold uppercase text-center tracking-[0.1em]">
          Files contain all surfaces, paths, and styles
        </p>
      </div>
    </div>
  );
};

export default ProjectManager;
