
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Square as SquareIcon, 
  Trash2, 
  Maximize2, 
  Camera, 
  Sparkles, 
  Plus, 
  Circle as CircleIcon,
  Monitor,
  PanelRightClose,
  Grid3X3,
  Settings2,
  Cast,
  X,
  Expand,
  RotateCcw,
  Check,
  FolderOpen,
  Menu
} from 'lucide-react';
import { Shape, EditorMode, Point, EffectType, ShapeStyle, FillType, MappingMode, ShapeType as TShapeType, ProjectVersion } from './types';
import Canvas from './components/Canvas';
import LayerList from './components/LayerList';
import PropertyPanel from './components/PropertyPanel';
import AIAssistant from './components/AIAssistant';
import ProjectManager from './components/ProjectManager';

const ProjectorPortal: React.FC<{ children: React.ReactNode, onClose: () => void }> = ({ children, onClose }) => {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const newWindow = useRef<Window | null>(null);

  useEffect(() => {
    const win = window.open('', 'LumeMapProjector', 'width=1280,height=720,menubar=no,toolbar=no,location=no,status=no,popup=yes');
    if (!win) {
      alert("Pop-up blocked! Please allow pop-ups to use the projector window.");
      onClose();
      return;
    }

    newWindow.current = win;
    const doc = win.document;
    const div = doc.createElement('div');
    div.id = "projector-root";
    doc.body.style.margin = '0';
    doc.body.style.padding = '0';
    doc.body.style.backgroundColor = 'black';
    doc.body.style.overflow = 'hidden';
    doc.title = "LumeMap: PROJECTOR OUTPUT";
    doc.body.appendChild(div);

    const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
    styles.forEach(style => {
      doc.head.appendChild(style.cloneNode(true));
    });

    setContainer(div);

    const handleFsChange = () => {
      setIsFullscreen(!!doc.fullscreenElement);
    };
    win.addEventListener('fullscreenchange', handleFsChange);

    const checkClosed = setInterval(() => {
      if (win.closed) {
        clearInterval(checkClosed);
        onClose();
      }
    }, 1000);

    return () => {
      clearInterval(checkClosed);
      win.removeEventListener('fullscreenchange', handleFsChange);
      win.close();
    };
  }, [onClose]);

  const requestFullscreen = async () => {
    if (newWindow.current && container) {
      try {
        await newWindow.current.document.documentElement.requestFullscreen();
      } catch (err) {
        console.error("Fullscreen request failed:", err);
      }
    }
  };

  return container ? createPortal(
    <div className="w-screen h-screen bg-black overflow-hidden relative font-sans">
      {!isFullscreen && (
        <div 
          onClick={requestFullscreen}
          className="absolute inset-0 z-[10000] bg-slate-950 flex flex-col items-center justify-center cursor-pointer p-12 text-center group"
        >
          <div className="w-32 h-32 rounded-full bg-indigo-600/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
            <Expand className="w-16 h-16 text-indigo-400 animate-pulse" />
          </div>
          <h1 className="text-5xl font-black text-white uppercase tracking-tighter mb-4">Calibrate Output</h1>
          <p className="text-slate-400 font-medium max-w-sm text-lg leading-relaxed">
            Move this window to your projector screen, then <span className="text-indigo-400 font-bold">click anywhere</span> to hide browser bars.
          </p>
        </div>
      )}
      <div className={`${isFullscreen ? 'cursor-none' : 'cursor-default'} w-full h-full`}>
        {children}
      </div>
    </div>, 
    container
  ) : null;
};

const App: React.FC = () => {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [mode, setMode] = useState<EditorMode>('IDLE');
  const [showCamera, setShowCamera] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showLayers, setShowLayers] = useState(false);
  const [showProject, setShowProject] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [globalTestPattern, setGlobalTestPattern] = useState(false);
  const [uiVisible, setUiVisible] = useState(true);
  const [projectorActive, setProjectorActive] = useState(false);
  const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  // Responsive handling
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Persistence Logic
  useEffect(() => {
    const saved = localStorage.getItem('lumemap_current_draft');
    if (saved) setShapes(JSON.parse(saved));
    const savedVersions = localStorage.getItem('lumemap_versions');
    if (savedVersions) setVersions(JSON.parse(savedVersions));
  }, []);

  useEffect(() => {
    if (shapes.length > 0) {
      localStorage.setItem('lumemap_current_draft', JSON.stringify(shapes));
    }
  }, [shapes]);

  useEffect(() => {
    localStorage.setItem('lumemap_versions', JSON.stringify(versions));
  }, [versions]);

  const saveVersion = (name: string) => {
    const newVersion: ProjectVersion = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      timestamp: Date.now(),
      shapes: JSON.parse(JSON.stringify(shapes)) // deep clone
    };
    setVersions(prev => [...prev, newVersion]);
  };

  const restoreVersion = (v: ProjectVersion) => {
    if (confirm(`Restore "${v.name}"? Current unsaved changes will be overwritten.`)) {
      setShapes(JSON.parse(JSON.stringify(v.shapes)));
      setSelectedShapeId(null);
      setMode('IDLE');
    }
  };

  const deleteVersion = (id: string) => {
    setVersions(prev => prev.filter(v => v.id !== id));
  };

  const exportProject = () => {
    const data = {
      app: "LumeMap",
      version: "1.0",
      timestamp: Date.now(),
      shapes
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `LumeMap_Project_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const importProject = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.shapes) {
          setShapes(data.shapes);
          alert("Project imported successfully!");
        }
      } catch (err) {
        alert("Failed to import project. Invalid file format.");
      }
    };
    reader.readAsText(file);
  };

  const handleProjectorClose = useCallback(() => {
    setProjectorActive(false);
  }, []);

  const addShape = useCallback((type: TShapeType, customPoints?: Point[]) => {
    const id = Math.random().toString(36).substr(2, 9);
    let points: Point[] = customPoints || [];
    
    if (!customPoints) {
      if (type === 'square') {
        points = [
          { x: 0.3, y: 0.3 },
          { x: 0.7, y: 0.3 },
          { x: 0.7, y: 0.7 },
          { x: 0.3, y: 0.7 },
        ];
      } else if (type === 'circle') {
        const segments = 32;
        const radius = 0.15;
        const cx = 0.5, cy = 0.5;
        for (let i = 0; i < segments; i++) {
          const angle = (i / segments) * Math.PI * 2;
          points.push({
            x: cx + Math.cos(angle) * radius,
            y: cy + Math.sin(angle) * radius
          });
        }
      }
    }

    const shape: Shape = {
      id,
      name: customPoints ? `Poly ${shapes.length + 1}` : `${type === 'square' ? 'Quad' : type.charAt(0).toUpperCase() + type.slice(1)} ${shapes.length + 1}`,
      type,
      points,
      visible: true,
      isClosed: true,
      style: {
        color: '#ffffff',
        opacity: 1.0,
        strokeColor: '#ffffff',
        strokeWidth: 0,
        effect: EffectType.NONE,
        effectSpeed: 5,
        fillType: FillType.GRID,
        mappingMode: MappingMode.STRETCH, 
      },
    };

    setShapes(prev => [...prev, shape]);
    setSelectedShapeId(id);
    setMode('EDITING');
    setShowLayers(true);
    setShowAddMenu(false);
    return id;
  }, [shapes.length]);

  const deleteShape = (id: string) => {
    setShapes(prev => prev.filter(s => s.id !== id));
    if (selectedShapeId === id) setSelectedShapeId(null);
  };

  const updateShape = (id: string, updates: Partial<Shape>) => {
    setShapes(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  const updateShapeStyle = (id: string, styleUpdates: Partial<ShapeStyle>) => {
    setShapes(prev => prev.map(s => 
      s.id === id ? { ...s, style: { ...s.style, ...styleUpdates } } : s
    ));
  };

  const handlePointsUpdate = (points: Point[], isClosed: boolean) => {
    if (mode === 'DRAWING' && isClosed) {
      addShape('polygon', points);
      setDrawingPoints([]);
      setMode('EDITING');
    } else if (selectedShapeId) {
      updateShape(selectedShapeId, { points, isClosed });
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const undoDrawingPoint = () => {
    setDrawingPoints(prev => prev.slice(0, -1));
  };

  const cancelDrawing = () => {
    setDrawingPoints([]);
    setMode('IDLE');
  };

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-slate-200 overflow-hidden font-sans select-none">
      
      <button 
        onClick={() => setUiVisible(!uiVisible)}
        className={`fixed top-6 left-6 z-[100] w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 shadow-2xl ${uiVisible ? 'bg-white text-black' : 'bg-slate-900 text-white border border-white/10'}`}
      >
        {uiVisible ? <X className="w-6 h-6" /> : <Monitor className="w-6 h-6" />}
      </button>

      {/* Top Toolbar */}
      <div className={`fixed top-6 left-24 right-6 h-12 flex items-center justify-between z-50 transition-all duration-700 ${uiVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-12 pointer-events-none'}`}>
        <div className="flex items-center gap-2 lg:gap-3 px-3 lg:px-4 py-1.5 bg-slate-900/90 backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl">
          <button onClick={() => setShowAddMenu(!showAddMenu)} className="flex items-center gap-2 px-2 lg:px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white transition-all">
            <Plus className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Add Surface</span>
          </button>
          {!isMobile && <div className="w-px h-4 bg-white/10" />}
          {!isMobile && (
            <button onClick={() => setGlobalTestPattern(!globalTestPattern)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${globalTestPattern ? 'text-blue-400' : 'text-slate-400 hover:text-white'}`}>
              <Grid3X3 className="w-3.5 h-3.5" /> Test Grid
            </button>
          )}
          {!isMobile && <div className="w-px h-4 bg-white/10" />}
          <button onClick={() => setShowCamera(!showCamera)} className={`flex items-center gap-2 px-2 lg:px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${showCamera ? 'text-emerald-400' : 'text-slate-400 hover:text-white'}`}>
            <Camera className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Live Input</span>
          </button>
        </div>

        <div className="flex items-center gap-2 lg:gap-3">
          <button 
            onClick={() => { setShowProject(!showProject); setShowLayers(false); }}
            className={`w-10 lg:w-12 h-10 lg:h-12 bg-slate-900 border border-white/10 rounded-2xl flex items-center justify-center transition-all ${showProject ? 'border-blue-500 text-blue-400' : 'text-slate-400'}`}
          >
            <FolderOpen className="w-4 lg:w-5 h-4 lg:h-5" />
          </button>
          
          <button 
            onClick={() => setProjectorActive(!projectorActive)} 
            className={`px-3 lg:px-4 py-1.5 border rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${projectorActive ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-900 border-white/10 text-indigo-400 hover:bg-indigo-500/10'}`}
          >
            <Cast className={`w-3.5 h-3.5 ${projectorActive ? 'animate-pulse' : ''}`} /> 
            <span className="hidden md:inline">{projectorActive ? 'Projector Active' : 'Launch Projector'}</span>
          </button>

          <button onClick={() => setShowAI(!showAI)} className={`px-3 lg:px-4 py-1.5 bg-slate-900 border border-white/10 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all ${showAI ? 'border-purple-500 text-purple-400' : 'text-slate-400'}`}>
            <Sparkles className="w-3.5 h-3.5" /> <span className="hidden lg:inline">Magic AI</span>
          </button>
          
          {!isMobile && (
            <button onClick={toggleFullscreen} className="w-12 h-12 bg-slate-900 border border-white/10 text-white rounded-2xl flex items-center justify-center hover:bg-slate-800 transition-all">
              <Maximize2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Add Menu */}
      {showAddMenu && uiVisible && (
        <div className="fixed top-20 left-24 w-52 bg-slate-900/95 backdrop-blur-3xl border border-white/10 rounded-3xl p-3 shadow-2xl z-[70] animate-in fade-in slide-in-from-top-4">
          <div className="grid grid-cols-1 gap-1">
             <button onClick={() => addShape('square')} className="flex items-center gap-3 px-4 py-3 hover:bg-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group text-left">
                <SquareIcon className="w-4 h-4 text-slate-400 group-hover:text-black" /> Rectangle Quad
             </button>
             <button onClick={() => addShape('circle')} className="flex items-center gap-3 px-4 py-3 hover:bg-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group text-left">
                <CircleIcon className="w-4 h-4 text-slate-400 group-hover:text-black" /> Circle Mesh
             </button>
             <button onClick={() => { setMode('DRAWING'); setShowAddMenu(false); setSelectedShapeId(null); }} className="flex items-center gap-3 px-4 py-3 hover:bg-blue-500 hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all group border-t border-white/5 mt-1 pt-4 text-left">
                <Plus className="w-4 h-4 text-blue-500 group-hover:text-black" /> Custom Poly
             </button>
          </div>
        </div>
      )}

      <main className="relative flex-1 flex overflow-hidden">
        <div className="flex-1 relative bg-black">
          <Canvas 
            shapes={shapes}
            selectedShapeId={selectedShapeId}
            mode={mode}
            showCamera={showCamera}
            globalTestPattern={globalTestPattern}
            currentDrawingPoints={drawingPoints}
            onPointsUpdate={handlePointsUpdate}
            onModeChange={setMode}
            onSelectShape={(id) => {
              setSelectedShapeId(id);
              if (id) { 
                setMode('EDITING'); 
                setShowLayers(true); 
                setUiVisible(true);
                setShowProject(false);
              }
            }}
            onDrawingUpdate={setDrawingPoints}
          />
          
          {/* Surface Indicator HUD */}
          {selectedShapeId && uiVisible && mode !== 'DRAWING' && (
             <div className="absolute bottom-6 sm:bottom-12 left-1/2 -translate-x-1/2 w-[90%] sm:w-[400px] h-16 sm:h-20 bg-slate-900/80 backdrop-blur-2xl border border-white/10 rounded-[40px] shadow-2xl flex items-center p-2 animate-in slide-in-from-bottom-8 duration-500 group z-40">
                <div className="flex-1 flex flex-col justify-center px-4 sm:px-10 border-r border-white/10">
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Surface</span>
                  <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider mt-0.5 sm:mt-1 truncate">
                    {shapes.find(s => s.id === selectedShapeId)?.name}
                  </span>
                </div>
                <div className="flex-1 flex flex-col justify-center px-4 sm:px-8">
                  <span className="text-[8px] sm:text-[9px] text-blue-400 font-black uppercase tracking-widest">Controls</span>
                  <div className="text-[9px] sm:text-[10px] text-slate-300 font-bold uppercase tracking-wide">
                    {isMobile ? 'Touch to Map' : 'Drag Nodes to Map'}
                  </div>
                </div>
                <button onClick={() => deleteShape(selectedShapeId)} className="absolute -top-3 -right-3 w-10 h-10 bg-red-600 rounded-full flex items-center justify-center text-white shadow-xl opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all scale-100">
                  <Trash2 className="w-4 h-4" />
                </button>
             </div>
          )}

          {/* Drawing Controls HUD */}
          {mode === 'DRAWING' && (
            <div className="absolute inset-x-0 top-24 flex justify-center z-50 pointer-events-none px-4">
              <div className="flex items-center gap-2 sm:gap-3 bg-slate-900/90 backdrop-blur-2xl border border-blue-500/30 rounded-[32px] p-2 pl-4 sm:pl-6 shadow-2xl pointer-events-auto animate-in slide-in-from-top-12 duration-500">
                <div className="flex flex-col pr-4 sm:pr-6 border-r border-white/10">
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Drawing</span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-white uppercase tracking-wider">
                    {drawingPoints.length === 0 ? "Tap Canvas" : `${drawingPoints.length} Point${drawingPoints.length === 1 ? '' : 's'}`}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 sm:gap-2">
                  <button 
                    onClick={undoDrawingPoint}
                    disabled={drawingPoints.length === 0}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest text-slate-300 hover:bg-white hover:text-black disabled:opacity-30 disabled:pointer-events-none transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Back</span>
                  </button>
                  <button 
                    onClick={cancelDrawing}
                    className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest text-red-400 hover:bg-red-500 hover:text-white transition-all"
                  >
                    <X className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Cancel</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Floating Side Panel for Mobile/Desktop */}
        <div className={`transition-all duration-700 ease-in-out fixed lg:relative right-0 top-0 h-full ${(showLayers || showProject) && uiVisible ? 'w-full lg:w-80 translate-x-0' : 'w-full lg:w-0 translate-x-full lg:translate-x-0'} overflow-hidden bg-slate-950/98 lg:bg-slate-950/95 border-l border-white/5 z-[60] lg:z-[60] backdrop-blur-3xl shadow-2xl`}>
          <div className="w-full lg:w-80 h-full flex flex-col p-6 lg:p-8 overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between mb-8 lg:mb-10 pt-8 lg:pt-0">
               <h2 className="text-[11px] font-black text-white uppercase tracking-[0.4em] flex items-center gap-3">
                 {showProject ? <FolderOpen className="w-4 h-4 text-blue-400" /> : <Settings2 className="w-4 h-4 text-blue-400" />}
                 {showProject ? 'Project Center' : 'Settings'}
               </h2>
               <button onClick={() => { setShowLayers(false); setShowProject(false); }} className="text-slate-500 hover:text-white p-2 bg-white/5 rounded-xl">
                 <PanelRightClose className="w-5 h-5" />
               </button>
            </div>

            {showProject ? (
              <ProjectManager 
                shapes={shapes}
                versions={versions}
                onSaveVersion={saveVersion}
                onRestoreVersion={restoreVersion}
                onDeleteVersion={deleteVersion}
                onExport={exportProject}
                onImport={importProject}
              />
            ) : (
              <>
                <LayerList 
                  shapes={shapes}
                  selectedShapeId={selectedShapeId}
                  onSelect={(id) => { 
                    setSelectedShapeId(id); 
                    setMode('EDITING'); 
                    if (isMobile) setShowLayers(false); // Close menu on select for mobile
                  }}
                  onDelete={deleteShape}
                  onToggleVisibility={(id, visible) => updateShape(id, { visible })}
                  onAddClick={() => setShowAddMenu(true)}
                />
                
                {selectedShapeId && (
                  <div className="mt-10 pt-10 border-t border-white/10">
                    <PropertyPanel 
                      shape={shapes.find(s => s.id === selectedShapeId)!}
                      onUpdateStyle={(style) => updateShapeStyle(selectedShapeId, style)}
                      onUpdateName={(name) => updateShape(selectedShapeId, { name })}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* AI Overlay */}
        {showAI && uiVisible && (
          <AIAssistant 
            onClose={() => setShowAI(false)}
            onShapesGenerated={(newShapes) => {
              newShapes.forEach(ns => {
                addShape('polygon', ns.points);
              });
              setMode('IDLE');
            }}
          />
        )}

        {/* Projector Mirror Portal */}
        {projectorActive && (
          <ProjectorPortal onClose={handleProjectorClose}>
            <div className="w-full h-full bg-black">
              <Canvas 
                shapes={shapes}
                selectedShapeId={null}
                mode="PROJECTING"
                showCamera={false}
                globalTestPattern={globalTestPattern}
                currentDrawingPoints={[]}
                isProjector={true}
                onPointsUpdate={() => {}}
                onModeChange={() => {}}
                onSelectShape={() => {}}
                onDrawingUpdate={() => {}}
              />
            </div>
          </ProjectorPortal>
        )}
      </main>

      {/* Footer Mobile Toggle for Layers */}
      {uiVisible && isMobile && !showLayers && !showProject && !selectedShapeId && (
        <button 
          onClick={() => setShowLayers(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-2xl z-50 animate-bounce"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}
    </div>
  );
};

export default App;
