
export type Point = {
  x: number;
  y: number;
};

export enum EffectType {
  NONE = 'none',
  STROBE = 'strobe',
  BREATHE = 'breathe',
  RAINBOW = 'rainbow',
  WARP = 'warp',
}

export enum FillType {
  SOLID = 'solid',
  CHECKERBOARD = 'checkerboard',
  GRID = 'grid',
  VIDEO = 'video',
  IMAGE = 'image',
}

export enum MappingMode {
  MASK = 'mask',
  STRETCH = 'stretch',
}

export type ShapeType = 'polygon' | 'circle' | 'square';

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
  videoMuted?: boolean;
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

export type EditorMode = 'IDLE' | 'DRAWING' | 'EDITING' | 'PROJECTING';

export interface AppState {
  shapes: Shape[];
  selectedShapeId: string | null;
  mode: EditorMode;
  showCamera: boolean;
  globalTestPattern: boolean;
}

export interface ProjectVersion {
  id: string;
  name: string;
  timestamp: number;
  shapes: Shape[];
}

export interface Project {
  id: string;
  name: string;
  versions: ProjectVersion[];
}
