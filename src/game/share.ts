import type { GameMode, RoundResult } from './types';

const INK = '#18181B';
const BG = '#F4F6F8';
const ACCENT = '#E11D48';

function drawDraftingBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(24, 24, 27, 0.055)';
  ctx.lineWidth = 1;
  const step = 36;
  for (let x = 0; x <= w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
}

function drawInkCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r = 24,
  fill = '#FFFFFF'
) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x + 8, y + 8, w, h, r);
  ctx.fill();

  ctx.fillStyle = fill;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
  ctx.stroke();
}

function drawSliceMotif(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  ctx.translate(cx, cy);
  const segs = [-72, -24, 24];
  for (const sx of segs) {
    ctx.fillStyle = '#FDE073';
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.roundRect(sx, -5, 40, 10, 5);
    ctx.fill();
    ctx.stroke();
  }
  for (const lx of [-28, 20]) {
    ctx.beginPath();
    ctx.moveTo(lx, -13);
    ctx.lineTo(lx, 13);
    ctx.strokeStyle = ACCENT;
    ctx.lineWidth = 2.6;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.restore();
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal membuat gambar PNG'));
    }, 'image/png');
  });
}

export async function generateRoundShareBlob(
  boardCanvas: HTMLCanvasElement | null,
  result: RoundResult,
  mode: GameMode
): Promise<Blob> {
  const w = 1200;
  const h = 900;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');

  drawDraftingBackground(ctx, w, h);
  drawInkCard(ctx, 48, 44, w - 96, h - 88, 28, '#FFFFFF');

  // Header
  drawSliceMotif(ctx, 175, 108);
  ctx.fillStyle = INK;
  ctx.font = '800 34px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('IRIS PRESISI', 278, 110);

  ctx.fillStyle = '#52525B';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'right';
  const modeLabel = mode === 'CAMPAIGN' ? `Tantangan · Ronde ${result.roundNumber}` : 'Latihan Bebas';
  ctx.fillText(`${modeLabel} · ${result.objectName} (${result.targetParts} bagian)`, w - 92, 110);

  // Divider
  ctx.strokeStyle = '#E4E4E7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(88, 154);
  ctx.lineTo(w - 88, 154);
  ctx.stroke();

  // Board screenshot area
  const frameX = 88;
  const frameY = 178;
  const frameW = w - 176;
  const frameH = 524;

  ctx.fillStyle = '#F4F6F8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(frameX, frameY, frameW, frameH, 18);
  ctx.fill();
  ctx.stroke();

  if (boardCanvas && boardCanvas.width > 0 && boardCanvas.height > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(frameX + 2, frameY + 2, frameW - 4, frameH - 4, 16);
    ctx.clip();

    // Crop-fit boardCanvas centered
    const srcAspect = boardCanvas.width / boardCanvas.height;
    const dstAspect = frameW / frameH;
    let drawW = frameW;
    let drawH = frameH;
    let drawX = frameX;
    let drawY = frameY;

    if (srcAspect > dstAspect) {
      drawH = frameH;
      drawW = drawH * srcAspect;
      drawX = frameX - (drawW - frameW) * 0.5;
    } else {
      drawW = frameW;
      drawH = drawW / srcAspect;
      drawY = frameY - (drawH - frameH) * 0.5;
    }
    ctx.drawImage(boardCanvas, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  // Footer Score Summary
  const footY = 732;
  ctx.fillStyle = '#F4F6F8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(88, footY, 130, 88, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#71717A';
  ctx.font = '600 15px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKOR', 153, footY + 24);

  ctx.fillStyle = result.score >= 95 ? '#047857' : result.score >= 80 ? '#1D4ED8' : ACCENT;
  ctx.font = '700 40px "JetBrains Mono", monospace';
  ctx.fillText(String(result.score), 153, footY + 60);

  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = '800 30px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.fillText(result.ratingLabel, 244, footY + 32);

  ctx.fillStyle = '#52525B';
  ctx.font = '600 20px "JetBrains Mono", monospace';
  const bonusStr =
    (result.streakBonus ?? 0) > 0
      ? `  ·  +${result.streakBonus} Bonus Streak (${result.streakCount}x)`
      : '';
  ctx.fillText(
    `Ideal ${(100 / result.targetParts).toFixed(1)}%  ·  Selisih ±${result.avgDeviationPercent.toFixed(1)}%${bonusStr}`,
    244,
    footY + 68
  );

  return canvasToBlob(canvas);
}

export async function generateCampaignShareBlob(params: {
  results: RoundResult[];
  totalScore: number;
  baseScore: number;
  streakBonus: number;
  maxStreak: number;
  rank: { grade: string; title: string };
}): Promise<Blob> {
  const { results, totalScore, baseScore, streakBonus, maxStreak, rank } = params;
  const w = 1080;
  const h = 1280;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas tidak tersedia');

  drawDraftingBackground(ctx, w, h);
  drawInkCard(ctx, 56, 52, w - 112, h - 104, 28, '#FFFFFF');

  // Top Header
  drawSliceMotif(ctx, 180, 122);
  ctx.fillStyle = INK;
  ctx.font = '800 32px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('IRIS PRESISI', 284, 124);

  ctx.fillStyle = '#71717A';
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Tantangan 10 Ronde', w - 104, 124);

  // Rank Banner
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = '800 46px "Bricolage Grotesque", system-ui, sans-serif';
  ctx.fillText(rank.title, 104, 214);

  // Rank Grade Box
  ctx.fillStyle = '#F4F6F8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(w - 208, 168, 104, 104, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#71717A';
  ctx.font = '700 14px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PERINGKAT', w - 156, 192);

  ctx.fillStyle = ACCENT;
  ctx.font = '700 50px "JetBrains Mono", monospace';
  ctx.fillText(rank.grade, w - 156, 238);

  // 3 Aggregate Stat Columns
  const statsY = 312;
  const colW = (w - 208) / 3;
  const stats = [
    { label: 'Total Skor', value: String(totalScore), color: INK },
    {
      label: 'Rata-rata Presisi',
      value: `${(baseScore / Math.max(1, results.length)).toFixed(1)}%`,
      color: '#047857',
    },
    {
      label: 'Streak Terbaik',
      value: `${maxStreak}x${streakBonus > 0 ? ` (+${streakBonus})` : ''}`,
      color: '#B45309',
    },
  ];

  stats.forEach((st, idx) => {
    const sx = 104 + idx * colW;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#71717A';
    ctx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(st.label, sx, statsY);

    ctx.fillStyle = st.color;
    ctx.font = '700 40px "JetBrains Mono", monospace';
    ctx.fillText(st.value, sx, statsY + 44);
  });

  // Divider before breakdown
  const listTop = 412;
  ctx.strokeStyle = '#E4E4E7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(104, listTop);
  ctx.lineTo(w - 104, listTop);
  ctx.stroke();

  // 10 Round Breakdown Rows
  const rowH = 72;
  results.forEach((res, idx) => {
    const ry = listTop + 38 + idx * rowH;

    if (idx > 0) {
      ctx.strokeStyle = '#F4F4F5';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(104, ry - rowH * 0.5);
      ctx.lineTo(w - 104, ry - rowH * 0.5);
      ctx.stroke();
    }

    ctx.textAlign = 'left';
    ctx.fillStyle = '#A1A1AA';
    ctx.font = '700 20px "JetBrains Mono", monospace';
    ctx.fillText(String(res.roundNumber).padStart(2, '0'), 108, ry);

    ctx.fillStyle = INK;
    ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(res.objectName, 162, ry);

    ctx.fillStyle = '#71717A';
    ctx.font = '500 17px "Plus Jakarta Sans", system-ui, sans-serif';
    const notes: string[] = [];
    if ((res.retryCount ?? 0) > 0) {
      notes.push(`Ulang ${res.retryCount}x (-${res.retryPenalty ?? 0})`);
    }
    if (res.usedItems && res.usedItems.length > 0) {
      notes.push(
        `Item: ${res.usedItems.map((id) => (id === 'grid' ? 'Grid' : id === 'undo' ? 'Undo' : 'Lurus')).join(', ')} (-${res.itemPenalty ?? 0})`
      );
    }
    const detailSuffix = notes.length > 0 ? ` · ${notes.join(' · ')}` : '';
    ctx.fillText(`${res.targetParts} bagian${detailSuffix}`, 395, ry);

    ctx.textAlign = 'right';
    if ((res.streakBonus ?? 0) > 0) {
      ctx.fillStyle = '#B45309';
      ctx.font = '700 20px "JetBrains Mono", monospace';
      ctx.fillText(`+${res.streakBonus}`, w - 255, ry);
    }

    ctx.fillStyle = '#71717A';
    ctx.font = '500 20px "JetBrains Mono", monospace';
    ctx.fillText(`±${res.avgDeviationPercent.toFixed(1)}%`, w - 168, ry);

    ctx.fillStyle = res.score >= 95 ? '#047857' : res.score >= 80 ? '#1D4ED8' : ACCENT;
    ctx.font = '700 26px "JetBrains Mono", monospace';
    ctx.fillText(String(res.score), w - 108, ry);
  });

  // Bottom item & retry penalty summary + attribution line
  const totalItemPenalty = results.reduce((sum, r) => sum + (r.itemPenalty ?? 0), 0);
  const totalItemsCount = results.reduce((sum, r) => sum + (r.usedItems?.length ?? 0), 0);
  const totalRetriesCount = results.reduce((sum, r) => sum + (r.retryCount ?? 0), 0);
  const totalRetryPenalty = results.reduce((sum, r) => sum + (r.retryPenalty ?? 0), 0);

  const summaryParts: string[] = [];
  if (totalItemsCount > 0) summaryParts.push(`Item: ${totalItemsCount}x (-${totalItemPenalty})`);
  if (totalRetriesCount > 0) summaryParts.push(`Ulang ronde: ${totalRetriesCount}x (-${totalRetryPenalty})`);

  ctx.textAlign = 'center';
  ctx.fillStyle = summaryParts.length > 0 ? '#B45309' : '#047857';
  ctx.font = '600 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(
    summaryParts.length > 0
      ? `Catatan Penalti: ${summaryParts.join(' · ')} poin`
      : 'Catatan: Tanpa item bantuan & tanpa ulang ronde (Murni Presisi)',
    w * 0.5,
    h - 118
  );

  ctx.fillStyle = '#71717A';
  ctx.font = '500 17px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Iris Presisi · Game Potong Presisi Ilustrasi Outline', w * 0.5, h - 86);

  return canvasToBlob(canvas);
}

export function downloadBlobAsPng(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export type ShareOutcome = 'shared' | 'copied_and_downloaded' | 'downloaded' | 'cancelled';

export async function shareResultImage(params: {
  blob: Blob;
  filename: string;
  title: string;
  text: string;
}): Promise<ShareOutcome> {
  const { blob, filename, title, text } = params;
  const file = new File([blob], filename, { type: 'image/png' });

  // 1. Native Web Share API with image file
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    const canShareFiles =
      typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    if (canShareFiles) {
      try {
        await navigator.share({ title, text, files: [file] });
        return 'shared';
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return 'cancelled';
        }
      }
    }
  }

  // 2. Fallback: copy PNG image to clipboard if permitted, and download PNG screenshot
  let copied = false;
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.write === 'function' &&
    typeof ClipboardItem !== 'undefined'
  ) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      copied = true;
    } catch {
      // Clipboard write may be blocked in sandboxed iframes; try text copy
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch {
        copied = false;
      }
    }
  }

  downloadBlobAsPng(blob, filename);
  return copied ? 'copied_and_downloaded' : 'downloaded';
}
