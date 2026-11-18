import type { GameMode, HelperItemId } from './types';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID: string | undefined =
  import.meta.env.VITE_GA_MEASUREMENT_ID || 'G-8JMV77REWE';

export function initAnalytics(): void {
  if (typeof window === 'undefined') return;

  if (window.gtag) {
    return;
  }

  if (!MEASUREMENT_ID || MEASUREMENT_ID === 'G-XXXXXXXXXX') {
    return;
  }

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() {
    window.dataLayer?.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    send_page_view: true,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(MEASUREMENT_ID)}`;
  document.head.appendChild(script);
}

export function trackEvent(
  eventName: string,
  eventParams: Record<string, string | number | boolean | undefined> = {}
): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') {
    return;
  }

  window.gtag('event', eventName, eventParams);
}

export function trackGameStart(gameMode: GameMode): void {
  trackEvent('game_start', {
    game_mode: gameMode,
  });
}

export interface RoundCompletedParams {
  mode: GameMode;
  roundNumber: number;
  objectId: string;
  score: number;
  ratingTier: string;
  avgDeviationPercent: number;
}

export function trackRoundCompleted(params: RoundCompletedParams): void {
  trackEvent('round_completed', {
    game_mode: params.mode,
    round_number: params.roundNumber,
    object_id: params.objectId,
    score: params.score,
    rating_tier: params.ratingTier,
    avg_deviation_pct: Number(params.avgDeviationPercent.toFixed(2)),
  });
}

export interface CampaignCompletedParams {
  totalScore: number;
  grade: string;
  rankTitle: string;
  maxStreak: number;
}

export function trackCampaignCompleted(params: CampaignCompletedParams): void {
  trackEvent('campaign_completed', {
    total_score: params.totalScore,
    grade: params.grade,
    rank_title: params.rankTitle,
    max_streak: params.maxStreak,
  });
}

export function trackHelperItemUsed(itemId: HelperItemId): void {
  trackEvent('helper_item_used', {
    item_id: itemId,
  });
}

export function trackShareOutcome(
  action: 'share' | 'download',
  totalScore: number
): void {
  trackEvent('share_result', {
    action_type: action,
    total_score: totalScore,
  });
}
