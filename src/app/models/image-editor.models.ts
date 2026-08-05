export interface ImageAdjustments {
  brightness: number;  // -100 to 100
  contrast: number;    // -100 to 100
  saturation: number;  // -100 to 100
  exposure: number;    // -100 to 100
  vibrance: number;    // -100 to 100
  warmth: number;      // -100 to 100
  tint: number;        // -100 to 100
  sepia: number;       // 0 to 100
  blur: number;        // 0 to 20
  sharpen: number;     // 0 to 10
  vignette: number;    // 0 to 100
  hueShift: number;    // -180 to 180
  invert: number;      // 0 to 100
  grayscale: number;   // 0 to 100
}

export type FilterId =
  | 'none'
  | 'vintage'
  | 'cinematic'
  | 'noir'
  | 'cyberpunk'
  | 'vibrant'
  | 'cool'
  | 'warmGlow'
  | 'pastel'
  | 'duotone'
  | 'dramatic'
  | 'hdr';

export interface FilterPreset {
  id: FilterId;
  name: string;
  description: string;
  adjustments: Partial<ImageAdjustments>;
}

export interface TransformState {
  rotation: number;      // 0, 90, 180, 270 or custom angle
  fineAngle: number;     // -45 to 45
  flipH: boolean;
  flipV: boolean;
  cropBox: { x: number; y: number; width: number; height: number } | null;
  aspectRatio: 'free' | '1:1' | '4:3' | '16:9' | '9:16' | '3:2' | 'circle';
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingPath {
  id: string;
  points: DrawingPoint[];
  color: string;
  size: number;
  opacity: number;
  isEraser: boolean;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number; // percentage (0-100)
  y: number; // percentage (0-100)
  color: string;
  fontSize: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  backgroundColor?: string;
}

export type ActiveTool = 'adjust' | 'filters' | 'crop' | 'draw' | 'text' | 'ai' | 'export';

export interface HistoryState {
  adjustments: ImageAdjustments;
  filter: FilterId;
  filterIntensity: number;
  transform: TransformState;
  drawings: DrawingPath[];
  textItems: TextOverlay[];
  imageDataUrl: string; // source snapshot data URL
}

export interface AiAnalysisResult {
  brightness: number;
  contrast: number;
  saturation: number;
  exposure: number;
  warmth: number;
  vignette: number;
  recommendedFilter: string;
  filterIntensity: number;
  explanation: string;
  caption: string;
  tags: string[];
  subjectAnalysis: string;
}

export interface SampleImage {
  id: string;
  name: string;
  category: string;
  url: string;
  thumb: string;
}
