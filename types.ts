
export interface Vector2 {
  x: number;
  y: number;
}

export interface Sprite {
  id: string;
  boneId: string;
  name: string;
  imageUrl: string; // Blob URL or Base64
  offsetX: number;
  offsetY: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  opacity: number;
  zIndex: number;
}

export interface Bone {
  id: string;
  parentId: string | null;
  name: string;
  length: number;
  // Local transforms
  rotation: number; // Degrees
  x: number; // Only relevant for root or disconnected bones
  y: number; // Only relevant for root or disconnected bones
  color?: string;
  // UI States
  locked?: boolean;
  visible?: boolean;
}

export interface DerivedBone extends Bone {
  // Calculated World transforms for rendering/IK
  worldStart: Vector2;
  worldEnd: Vector2;
  worldRotation: number;
}

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export interface Keyframe {
  time: number; // Frame number
  value: number;
  easing: EasingType;
}

export interface Track {
  boneId: string;
  property: 'rotation' | 'x' | 'y';
  keyframes: Keyframe[];
}

export interface AnimationClip {
  id: string;
  name: string;
  duration: number; // Total frames
  fps: number; // Frames per second
  tracks: Track[];
}

export interface ProjectFile {
  version: string;
  bones: Bone[];
  sprites: Sprite[];
  clips: AnimationClip[];
}

export enum ToolMode {
  SELECT = 'SELECT',
  CAMERA = 'CAMERA',
}

export type TransformMode = 'ROTATE' | 'TRANSLATE';

export enum TimelineMode {
  CLIP = 'CLIP',
  GRAPH = 'GRAPH',
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
  rotation: number;
}

export interface AppSettings {
  showGrid: boolean;
  snapToGrid: boolean;
  showBones: boolean;
  onionSkin: boolean;
  onionSkinFrames: number; // How many frames back to show
  backgroundColor: string;
}

export type SelectionType = 'BONE' | 'SPRITE';

export interface Selection {
  type: SelectionType;
  id: string;
}

// History State for Undo/Redo
export interface HistoryState {
  bones: Bone[];
  sprites: Sprite[];
  currentClip: AnimationClip;
}
