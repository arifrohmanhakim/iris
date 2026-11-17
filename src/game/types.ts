export type GameState = 'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'ROUND_SUMMARY' | 'GAME_OVER';

export type GameMode = 'CAMPAIGN' | 'FREE_PLAY';

export interface Point {
  x: number;
  y: number;
}

export interface CutEdge {
  a: Point;
  b: Point;
}

export interface Piece {
  id: string;
  points: Point[];
  offset: Point;
  targetOffset: Point;
  angle: number;
  targetAngle: number;
  cutEdges: CutEdge[];
  area: number;
}

export type ParticleKind = 'crumb' | 'spark' | 'streak';

export interface Particle {
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  rotation: number;
  vr: number;
}

export interface SlashEffect {
  a: Point;
  b: Point;
  mid: Point;
  life: number;
  maxLife: number;
}

export interface FloatingNotice {
  text: string;
  x: number;
  y: number;
  life: number;
  maxLife: number;
  tone: 'error' | 'perfect' | 'info';
}

export type ObjectShape = 'elongated' | 'block' | 'round';

export type ObjectCategory = 'Roti & Kue' | 'Sayuran' | 'Keju & Gurih' | 'Buah & Manis';

export interface ObjectDef {
  id: string;
  name: string;
  category: ObjectCategory;
  shape: ObjectShape;
  cutFaceColor: string;
  crumbColors: string[];
  generatePolygon: () => Point[];
  drawInterior: (ctx: CanvasRenderingContext2D) => void;
}

export interface RoundConfig {
  roundNumber: number;
  objectId: string;
  targetParts: number;
  hint?: string;
}

export interface PieceBreakdown {
  id: string;
  sharePercent: number;
  deviationPercent: number;
  centroid: Point;
  status: 'perfect' | 'good' | 'off';
}

export type HelperItemId = 'grid' | 'undo' | 'straight';

export interface HelperItemDef {
  id: HelperItemId;
  name: string;
  shortDesc: string;
  penalty: number;
}

export interface RoundResult {
  roundNumber: number;
  objectId: string;
  objectName: string;
  targetParts: number;
  score: number;
  rawScore?: number;
  itemPenalty?: number;
  usedItems?: HelperItemId[];
  retryCount?: number;
  retryPenalty?: number;
  streakCount?: number;
  streakBonus?: number;
  avgDeviationPercent: number;
  ratingLabel: string;
  ratingTier: 'S' | 'A' | 'B' | 'C';
  pieces: PieceBreakdown[];
}
