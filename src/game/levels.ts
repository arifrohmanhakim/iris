import { polygonArea, polygonCentroid } from './geometry';
import { getObjectById } from './objects';
import type { Piece, PieceBreakdown, RoundConfig, RoundResult } from './types';

export const CAMPAIGN_ROUNDS: RoundConfig[] = [
  { roundNumber: 1, objectId: 'roti_tawar', targetParts: 2, hint: 'Potong tepat di tengah menjadi 2 bagian sama besar' },
  { roundNumber: 2, objectId: 'timun', targetParts: 2, hint: 'Belah timun menjadi 2 potong sama panjang' },
  { roundNumber: 3, objectId: 'baguette', targetParts: 3, hint: 'Bagi roti baguette menjadi 3 bagian seimbang' },
  { roundNumber: 4, objectId: 'wortel', targetParts: 3, hint: 'Perhatikan ujung wortel yang meruncing agar luasnya seimbang' },
  { roundNumber: 5, objectId: 'kue_gulung', targetParts: 3, hint: 'Iris kue gulung stroberi menjadi 3 potong sama rata' },
  { roundNumber: 6, objectId: 'keju_cheddar', targetParts: 4, hint: 'Potong blok keju menjadi 4 bagian sama besar' },
  { roundNumber: 7, objectId: 'sushi_roll', targetParts: 4, hint: 'Iris sushi roll menjadi 4 potongan presisi' },
  { roundNumber: 8, objectId: 'terong', targetParts: 4, hint: 'Bagi terong ungu menjadi 4 bagian setara' },
  { roundNumber: 9, objectId: 'jagung', targetParts: 5, hint: 'Tantangan tinggi: bagi jagung menjadi 5 bagian sama rata' },
  { roundNumber: 10, objectId: 'pizza_klasik', targetParts: 4, hint: 'Ronde final: potong pizza bulat menjadi 4 bagian sama besar' },
];

export function evaluateRound(
  roundNumber: number,
  objectId: string,
  targetParts: number,
  pieces: Piece[]
): RoundResult {
  const objDef = getObjectById(objectId);
  const areas = pieces.map((p) => polygonArea(p.points));
  const totalArea = areas.reduce((sum, a) => sum + a, 0) || 1;
  const idealShare = 1 / targetParts;

  let totalDeviation = 0;
  const breakdowns: PieceBreakdown[] = pieces.map((piece, idx) => {
    const share = areas[idx] / totalArea;
    const dev = Math.abs(share - idealShare);
    totalDeviation += dev;

    const sharePercent = share * 100;
    const deviationPercent = dev * 100;
    const centroid = polygonCentroid(piece.points);

    let status: 'perfect' | 'good' | 'off' = 'off';
    if (deviationPercent <= 2.2) {
      status = 'perfect';
    } else if (deviationPercent <= 6.0) {
      status = 'good';
    }

    return {
      id: piece.id,
      sharePercent,
      deviationPercent,
      centroid: {
        x: centroid.x + piece.targetOffset.x,
        y: centroid.y + piece.targetOffset.y,
      },
      status,
    };
  });

  let score = 100;
  if (totalDeviation > 0.012) {
    score = Math.round(Math.max(0, Math.min(100, 100 - (totalDeviation - 0.012) * 145)));
  }

  const avgDeviationPercent = (totalDeviation / targetParts) * 100;

  let ratingLabel = 'Kurang Rata';
  let ratingTier: 'S' | 'A' | 'B' | 'C' = 'C';

  if (score >= 98) {
    ratingLabel = 'Sempurna!';
    ratingTier = 'S';
  } else if (score >= 88) {
    ratingLabel = 'Sangat Presisi';
    ratingTier = 'A';
  } else if (score >= 70) {
    ratingLabel = 'Cukup Baik';
    ratingTier = 'B';
  }

  return {
    roundNumber,
    objectId,
    objectName: objDef.name,
    targetParts,
    score,
    avgDeviationPercent,
    ratingLabel,
    ratingTier,
    pieces: breakdowns,
  };
}

export function getFinalRank(totalScore: number, maxScore: number): { grade: string; title: string } {
  const pct = maxScore > 0 ? (totalScore / maxScore) * 100 : 0;
  if (pct >= 94) return { grade: 'S', title: 'Master Koki Presisi' };
  if (pct >= 85) return { grade: 'A', title: 'Ahli Pisau Handal' };
  if (pct >= 72) return { grade: 'B', title: 'Juru Masak Terampil' };
  if (pct >= 55) return { grade: 'C', title: 'Koki Pemula' };
  return { grade: 'D', title: 'Perlu Latihan Lagi' };
}

export const STREAK_SCORE_THRESHOLD = 90;

export function calculateStreakBonus(streakCount: number): number {
  if (streakCount < 2) return 0;
  return (streakCount - 1) * 5;
}

export const RETRY_ROUND_PENALTY = 10;

export const HELPER_ITEMS: Array<{
  id: 'grid' | 'undo' | 'straight';
  name: string;
  shortDesc: string;
  penalty: number;
}> = [
  {
    id: 'grid',
    name: 'Grid Bantu',
    shortDesc: 'Tampilkan garis kisi ukur di layar',
    penalty: 5,
  },
  {
    id: 'straight',
    name: 'Pisau Lurus',
    shortDesc: 'Kunci sudut potong kelipatan 45°',
    penalty: 4,
  },
  {
    id: 'undo',
    name: 'Undo 1x',
    shortDesc: 'Batalkan 1 potongan terakhir',
    penalty: 8,
  },
];

export function getHelperItemsPenalty(usedItems: Array<'grid' | 'undo' | 'straight'>): number {
  return usedItems.reduce((sum, id) => {
    const item = HELPER_ITEMS.find((h) => h.id === id);
    return sum + (item ? item.penalty : 0);
  }, 0);
}

export function getHelperItemName(id: 'grid' | 'undo' | 'straight'): string {
  return HELPER_ITEMS.find((h) => h.id === id)?.name ?? id;
}

const BEST_CAMPAIGN_KEY = 'iris_presisi_best_campaign';

export interface BestRecord {
  score: number;
  avgAccuracy: number;
}

export function loadBestCampaign(): BestRecord | null {
  try {
    const raw = localStorage.getItem(BEST_CAMPAIGN_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BestRecord;
  } catch {
    return null;
  }
}

export function saveBestCampaign(score: number, avgAccuracy: number): BestRecord {
  const prev = loadBestCampaign();
  const next: BestRecord =
    prev && prev.score > score
      ? prev
      : { score, avgAccuracy };
  try {
    localStorage.setItem(BEST_CAMPAIGN_KEY, JSON.stringify(next));
  } catch {
    // ignore storage failure
  }
  return next;
}
