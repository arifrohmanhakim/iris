import React, { useEffect, useRef } from 'react';
import { soundEngine } from '../game/audio';
import {
  localToWorld,
  polygonArea,
  splitPolygonBySegment,
  worldToLocal,
} from '../game/geometry';
import { evaluateRound } from '../game/levels';
import { getObjectById } from '../game/objects';
import type {
  FloatingNotice,
  GameState,
  Particle,
  Piece,
  Point,
  RoundResult,
  SlashEffect,
} from '../game/types';

interface SliceCanvasProps {
  roundKey: string;
  roundNumber: number;
  objectId: string;
  targetParts: number;
  gameState: GameState;
  roundResult: RoundResult | null;
  gridActive?: boolean;
  straightSnapActive?: boolean;
  undoTrigger?: number;
  boardCanvasRef?: React.MutableRefObject<HTMLCanvasElement | null>;
  onPieceCountChange: (count: number) => void;
  onCanUndoChange?: (canUndo: boolean) => void;
  onRoundComplete: (result: RoundResult) => void;
}

interface SimState {
  pieces: Piece[];
  historyStack: Piece[][];
  particles: Particle[];
  slashes: SlashEffect[];
  notices: FloatingNotice[];
  dragStart: Point | null;
  dragCurrent: Point | null;
  hoverPos: Point | null;
  shakeTime: number;
  shakeAmp: number;
  hitstopTime: number;
  completedTriggered: boolean;
  completeDelayTimer: number | null;
}

const INK = '#18181B';

export const SliceCanvas: React.FC<SliceCanvasProps> = ({
  roundKey,
  roundNumber,
  objectId,
  targetParts,
  gameState,
  roundResult,
  gridActive = false,
  straightSnapActive = false,
  undoTrigger = 0,
  boardCanvasRef,
  onPieceCountChange,
  onCanUndoChange,
  onRoundComplete,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (boardCanvasRef) {
      boardCanvasRef.current = canvasRef.current;
    }
    return () => {
      if (boardCanvasRef) {
        boardCanvasRef.current = null;
      }
    };
  }, [boardCanvasRef]);

  const propsRef = useRef({
    roundNumber,
    objectId,
    targetParts,
    gameState,
    roundResult,
    gridActive,
    straightSnapActive,
    onPieceCountChange,
    onCanUndoChange,
    onRoundComplete,
  });
  propsRef.current = {
    roundNumber,
    objectId,
    targetParts,
    gameState,
    roundResult,
    gridActive,
    straightSnapActive,
    onPieceCountChange,
    onCanUndoChange,
    onRoundComplete,
  };

  const simRef = useRef<SimState>({
    pieces: [],
    historyStack: [],
    particles: [],
    slashes: [],
    notices: [],
    dragStart: null,
    dragCurrent: null,
    hoverPos: null,
    shakeTime: 0,
    shakeAmp: 0,
    hitstopTime: 0,
    completedTriggered: false,
    completeDelayTimer: null,
  });

  const viewTransformRef = useRef({
    width: 1200,
    height: 700,
    scale: 1,
    centerX: 600,
    centerY: 350,
  });

  // Reset simulation whenever roundKey changes
  useEffect(() => {
    if (simRef.current.completeDelayTimer !== null) {
      window.clearTimeout(simRef.current.completeDelayTimer);
    }
    const def = getObjectById(objectId);
    const poly = def.generatePolygon();
    const initialPiece: Piece = {
      id: `piece-0-${Date.now()}`,
      points: poly,
      offset: { x: 0, y: -12 },
      targetOffset: { x: 0, y: 0 },
      angle: 0,
      targetAngle: 0,
      cutEdges: [],
      area: polygonArea(poly),
    };

    simRef.current = {
      pieces: [initialPiece],
      historyStack: [],
      particles: [],
      slashes: [],
      notices: [],
      dragStart: null,
      dragCurrent: null,
      hoverPos: simRef.current.hoverPos,
      shakeTime: 0,
      shakeAmp: 0,
      hitstopTime: 0,
      completedTriggered: false,
      completeDelayTimer: null,
    };
    onPieceCountChange(1);
    onCanUndoChange?.(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundKey, objectId]);

  // Execute 1-step undo when undoTrigger increments
  const lastUndoTriggerRef = useRef(undoTrigger);
  useEffect(() => {
    if (undoTrigger === lastUndoTriggerRef.current) return;
    lastUndoTriggerRef.current = undoTrigger;

    const sim = simRef.current;
    if (sim.completedTriggered || sim.historyStack.length === 0) return;

    const prevSnapshot = sim.historyStack.pop();
    if (!prevSnapshot) return;

    sim.pieces = prevSnapshot;
    sim.dragStart = null;
    sim.dragCurrent = null;
    sim.notices.push({
      text: 'Potongan terakhir dibatalkan',
      x: 0,
      y: -140,
      life: 1.15,
      maxLife: 1.15,
      tone: 'info',
    });
    soundEngine.playClick();
    propsRef.current.onPieceCountChange(sim.pieces.length);
    propsRef.current.onCanUndoChange?.(sim.historyStack.length > 0);
  }, [undoTrigger]);

  // Cancel active drag on Escape or window blur
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && simRef.current.dragStart) {
        simRef.current.dragStart = null;
        simRef.current.dragCurrent = null;
      }
    };
    const handleBlur = () => {
      simRef.current.dragStart = null;
      simRef.current.dragCurrent = null;
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('blur', handleBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);

  // Main 60fps canvas loop & ResizeObserver
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const updateSize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const scaleX = (rect.width - 36) / 760;
      const scaleY = (rect.height - 170) / 420;
      const scale = Math.max(0.45, Math.min(scaleX, scaleY, 1.32));

      viewTransformRef.current = {
        width: rect.width,
        height: rect.height,
        scale,
        centerX: rect.width * 0.5,
        centerY: rect.height * 0.48,
      };
    };

    updateSize();
    const ro = new ResizeObserver(updateSize);
    ro.observe(container);

    let rafId = 0;
    let lastTime = performance.now();

    const renderFrame = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(rawDt, 0.05);

      const sim = simRef.current;
      const { objectId: activeObjId, gameState: activeState, roundResult: activeResult } = propsRef.current;
      const objDef = getObjectById(activeObjId);
      const { width, height, scale, centerX, centerY } = viewTransformRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);

      // Update simulation (respect brief hitstop)
      if (sim.hitstopTime > 0) {
        sim.hitstopTime = Math.max(0, sim.hitstopTime - dt);
      } else {
        // Spring pieces toward target offset and angle
        const spring = 1 - Math.exp(-16 * dt);
        for (const p of sim.pieces) {
          p.offset.x += (p.targetOffset.x - p.offset.x) * spring;
          p.offset.y += (p.targetOffset.y - p.offset.y) * spring;
          p.angle += (p.targetAngle - p.angle) * spring;
        }

        // Update particles
        for (let i = sim.particles.length - 1; i >= 0; i--) {
          const pt = sim.particles[i];
          pt.life -= dt;
          if (pt.life <= 0) {
            sim.particles.splice(i, 1);
            continue;
          }
          if (pt.kind === 'crumb') {
            pt.vy += 460 * dt;
            pt.vx *= Math.pow(0.28, dt);
          } else if (pt.kind === 'streak') {
            pt.vx *= Math.pow(0.08, dt);
            pt.vy *= Math.pow(0.08, dt);
          } else {
            // spark
            pt.vx *= Math.pow(0.14, dt);
            pt.vy *= Math.pow(0.14, dt);
          }
          pt.x += pt.vx * dt;
          pt.y += pt.vy * dt;
          pt.rotation += pt.vr * dt;
          pt.alpha = Math.max(0, pt.life / pt.maxLife);
        }

        // Update slashes
        for (let i = sim.slashes.length - 1; i >= 0; i--) {
          sim.slashes[i].life -= dt;
          if (sim.slashes[i].life <= 0) {
            sim.slashes.splice(i, 1);
          }
        }

        // Update floating notices
        for (let i = sim.notices.length - 1; i >= 0; i--) {
          const n = sim.notices[i];
          n.life -= dt;
          n.y -= 18 * dt;
          if (n.life <= 0) {
            sim.notices.splice(i, 1);
          }
        }
      }

      if (sim.shakeTime > 0) {
        sim.shakeTime = Math.max(0, sim.shakeTime - dt);
      }

      // Draw frame
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      // Camera shake offset
      let shakeX = 0;
      let shakeY = 0;
      if (sim.shakeTime > 0) {
        const strength = (sim.shakeTime / 0.16) * sim.shakeAmp;
        shakeX = (Math.random() * 2 - 1) * strength;
        shakeY = (Math.random() * 2 - 1) * strength;
      }

      ctx.translate(centerX + shakeX, centerY + shakeY);
      ctx.scale(scale, scale);

      // 1. Outline-illustrated Cutting Board
      drawCuttingBoard(ctx);

      // 1b. Measurement Grid overlay (under pieces)
      if (propsRef.current.gridActive) {
        drawBoardGrid(ctx, false);
      }

      // 2. Render each culinary piece
      for (const piece of sim.pieces) {
        drawPiece(ctx, piece, objDef);
      }

      // 2b. Subtle translucent Grid guide over object for visual alignment
      if (propsRef.current.gridActive) {
        drawBoardGrid(ctx, true);
      }

      // 3. Render slash flashes & expanding impact rings
      for (const slash of sim.slashes) {
        const t = Math.max(0, slash.life / slash.maxLife);
        const progress = 1 - t;
        ctx.save();
        ctx.globalAlpha = t;

        // Tapered outline slash ribbon
        const dx = slash.b.x - slash.a.x;
        const dy = slash.b.y - slash.a.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = (-dy / len) * (7 * t);
        const ny = (dx / len) * (7 * t);
        const midX = (slash.a.x + slash.b.x) * 0.5;
        const midY = (slash.a.y + slash.b.y) * 0.5;

        ctx.beginPath();
        ctx.moveTo(slash.a.x, slash.a.y);
        ctx.lineTo(midX + nx, midY + ny);
        ctx.lineTo(slash.b.x, slash.b.y);
        ctx.lineTo(midX - nx, midY - ny);
        ctx.closePath();
        ctx.fillStyle = '#FFFFFF';
        ctx.fill();
        ctx.strokeStyle = '#E11D48';
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Central razor flash line
        ctx.beginPath();
        ctx.moveTo(slash.a.x, slash.a.y);
        ctx.lineTo(slash.b.x, slash.b.y);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.4;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Expanding comic impact ring at cut midpoint
        const ringRadius = 10 + progress * 44;
        ctx.beginPath();
        ctx.arc(slash.mid.x, slash.mid.y, ringRadius, 0, Math.PI * 2);
        ctx.strokeStyle = '#E11D48';
        ctx.lineWidth = 2.4 * t;
        ctx.setLineDash([6, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.restore();
      }

      // 4. Render outline crumbs, star sparks, and line streaks
      for (const pt of sim.particles) {
        ctx.save();
        ctx.globalAlpha = pt.alpha;

        if (pt.kind === 'streak') {
          const speed = Math.hypot(pt.vx, pt.vy);
          const angle = speed > 1 ? Math.atan2(pt.vy, pt.vx) : pt.rotation;
          const length = pt.size * (0.4 + 0.85 * pt.alpha);
          ctx.translate(pt.x, pt.y);
          ctx.rotate(angle);
          ctx.beginPath();
          ctx.moveTo(-length, 0);
          ctx.lineTo(length * 0.45, 0);
          ctx.strokeStyle = INK;
          ctx.lineWidth = 4.2 * pt.alpha + 1;
          ctx.lineCap = 'round';
          ctx.stroke();

          ctx.strokeStyle = pt.color;
          ctx.lineWidth = 2.2 * pt.alpha + 0.6;
          ctx.stroke();
        } else if (pt.kind === 'spark') {
          const s = pt.size * (0.55 + 0.45 * pt.alpha);
          ctx.translate(pt.x, pt.y);
          ctx.rotate(pt.rotation);
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const rad = i % 2 === 0 ? s : s * 0.34;
            const a = (i / 8) * Math.PI * 2;
            const px = Math.cos(a) * rad;
            const py = Math.sin(a) * rad;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fillStyle = pt.color;
          ctx.fill();
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.6;
          ctx.lineJoin = 'round';
          ctx.stroke();
        } else {
          ctx.translate(pt.x, pt.y);
          ctx.rotate(pt.rotation);
          ctx.fillStyle = pt.color;
          ctx.strokeStyle = INK;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.roundRect(-pt.size * 0.5, -pt.size * 0.42, pt.size, pt.size * 0.84, 2);
          ctx.fill();
          ctx.stroke();
        }

        ctx.restore();
      }

      // 5. Render active drag slice guide & custom outline knife cursor
      if (activeState === 'PLAYING' && sim.dragStart && sim.dragCurrent) {
        drawActiveSliceGuide(ctx, sim.dragStart, sim.dragCurrent, propsRef.current.straightSnapActive);
      } else if (activeState === 'PLAYING' && sim.hoverPos && !sim.dragStart) {
        drawKnifeReticle(ctx, sim.hoverPos, propsRef.current.straightSnapActive);
      }

      // 6. Render post-round piece percentage tags directly on the board
      if (activeResult && (activeState === 'ROUND_SUMMARY' || activeState === 'PLAYING')) {
        drawPieceBreakdowns(ctx, activeResult);
      }

      // 7. Render floating validation notices
      for (const notice of sim.notices) {
        const alpha = Math.min(1, (notice.life / notice.maxLife) * 2.2);
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.font = '600 14px "Plus Jakarta Sans", sans-serif';
        const textWidth = ctx.measureText(notice.text).width;
        const bw = textWidth + 24;
        const bh = 32;
        ctx.fillStyle = notice.tone === 'error' ? '#FFF1F2' : '#FFFFFF';
        ctx.strokeStyle = notice.tone === 'error' ? '#E11D48' : INK;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(notice.x - bw * 0.5, notice.y - bh * 0.5, bw, bh, 8);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = notice.tone === 'error' ? '#BE123C' : INK;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(notice.text, notice.x, notice.y + 0.5);
        ctx.restore();
      }

      ctx.restore();
      rafId = requestAnimationFrame(renderFrame);
    };

    rafId = requestAnimationFrame(renderFrame);
    return () => {
      cancelAnimationFrame(rafId);
      ro.disconnect();
    };
  }, []);

  const clientToWorld = (clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const { scale, centerX, centerY } = viewTransformRef.current;
    return {
      x: (clientX - rect.left - centerX) / scale,
      y: (clientY - rect.top - centerY) / scale,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.button === 2) {
      simRef.current.dragStart = null;
      simRef.current.dragCurrent = null;
      return;
    }
    const { gameState: state, targetParts: target } = propsRef.current;
    if (state !== 'PLAYING' || simRef.current.completedTriggered) return;
    if (simRef.current.pieces.length >= target) return;

    e.currentTarget.setPointerCapture(e.pointerId);
    const pt = clientToWorld(e.clientX, e.clientY);
    simRef.current.dragStart = pt;
    simRef.current.dragCurrent = pt;
    simRef.current.hoverPos = pt;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rawPt = clientToWorld(e.clientX, e.clientY);
    if (e.pointerType !== 'touch' || simRef.current.dragStart) {
      simRef.current.hoverPos = rawPt;
    }
    if (simRef.current.dragStart) {
      simRef.current.dragCurrent = propsRef.current.straightSnapActive
        ? snapPoint45Deg(simRef.current.dragStart, rawPt)
        : rawPt;
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }

    const sim = simRef.current;
    const start = sim.dragStart;
    const rawEnd = clientToWorld(e.clientX, e.clientY);
    const end =
      start && propsRef.current.straightSnapActive
        ? snapPoint45Deg(start, rawEnd)
        : rawEnd;
    sim.dragStart = null;
    sim.dragCurrent = null;
    if (e.pointerType === 'touch') {
      sim.hoverPos = null;
    }

    if (!start || propsRef.current.gameState !== 'PLAYING' || sim.completedTriggered) return;

    const dragDist = Math.hypot(end.x - start.x, end.y - start.y);
    if (dragDist < 22) return;

    performSlice(start, end);
  };

  const performSlice = (worldA: Point, worldB: Point) => {
    const sim = simRef.current;
    const { objectId: activeObjId, targetParts: target, roundNumber: rNum } = propsRef.current;
    const objDef = getObjectById(activeObjId);

    const nextPieces: Piece[] = [];
    let splitCount = 0;
    const spawnedCutSegments: Array<{ a: Point; b: Point; mid: Point; normal: Point }> = [];

    for (const piece of sim.pieces) {
      const localA = worldToLocal(worldA, piece.offset, piece.angle);
      const localB = worldToLocal(worldB, piece.offset, piece.angle);
      const res = splitPolygonBySegment(piece.points, localA, localB);

      if (!res) {
        nextPieces.push(piece);
        continue;
      }

      splitCount += 1;
      const worldNormalX = res.normal.x * Math.cos(piece.angle) - res.normal.y * Math.sin(piece.angle);
      const worldNormalY = res.normal.x * Math.sin(piece.angle) + res.normal.y * Math.cos(piece.angle);

      const gap = 9;
      const tilt = 0.018;

      const posPiece: Piece = {
        id: `${piece.id}-p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        points: res.positivePoly,
        offset: { ...piece.offset },
        targetOffset: {
          x: piece.targetOffset.x + worldNormalX * gap,
          y: piece.targetOffset.y + worldNormalY * gap,
        },
        angle: piece.angle,
        targetAngle: piece.targetAngle + (worldNormalX >= 0 ? 1 : -1) * tilt,
        cutEdges: [...piece.cutEdges, res.cutEdge],
        area: polygonArea(res.positivePoly),
      };

      const negPiece: Piece = {
        id: `${piece.id}-n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        points: res.negativePoly,
        offset: { ...piece.offset },
        targetOffset: {
          x: piece.targetOffset.x - worldNormalX * gap,
          y: piece.targetOffset.y - worldNormalY * gap,
        },
        angle: piece.angle,
        targetAngle: piece.targetAngle - (worldNormalX >= 0 ? 1 : -1) * tilt,
        cutEdges: [...piece.cutEdges, res.cutEdge],
        area: polygonArea(res.negativePoly),
      };

      nextPieces.push(posPiece, negPiece);

      const worldEdgeA = localToWorld(res.cutEdge.a, piece.offset, piece.angle);
      const worldEdgeB = localToWorld(res.cutEdge.b, piece.offset, piece.angle);
      spawnedCutSegments.push({
        a: worldEdgeA,
        b: worldEdgeB,
        mid: {
          x: (worldEdgeA.x + worldEdgeB.x) * 0.5,
          y: (worldEdgeA.y + worldEdgeB.y) * 0.5,
        },
        normal: { x: worldNormalX, y: worldNormalY },
      });
    }

    const mid = { x: (worldA.x + worldB.x) * 0.5, y: (worldA.y + worldB.y) * 0.5 };

    if (splitCount === 0) {
      soundEngine.playInvalidCut();
      sim.notices.push({
        text: 'Potong menembus bagian utama benda',
        x: mid.x,
        y: mid.y - 20,
        life: 1.05,
        maxLife: 1.05,
        tone: 'error',
      });
      return;
    }

    if (nextPieces.length > target) {
      soundEngine.playInvalidCut();
      sim.shakeTime = 0.12;
      sim.shakeAmp = 4;
      sim.notices.push({
        text: `Melebihi target ${target} bagian — potong satu bagian saja`,
        x: mid.x,
        y: mid.y - 24,
        life: 1.35,
        maxLife: 1.35,
        tone: 'error',
      });
      return;
    }

    // Save snapshot for 1-step Undo before applying valid cut
    const snapshot: Piece[] = sim.pieces.map((p) => ({
      ...p,
      points: p.points.map((pt) => ({ ...pt })),
      offset: { ...p.offset },
      targetOffset: { ...p.targetOffset },
      cutEdges: p.cutEdges.map((edge) => ({ a: { ...edge.a }, b: { ...edge.b } })),
    }));
    sim.historyStack.push(snapshot);
    propsRef.current.onCanUndoChange?.(true);

    // Valid cut!
    sim.pieces = nextPieces;
    sim.hitstopTime = 0.038;
    sim.shakeTime = 0.14;
    sim.shakeAmp = 3.8;
    const primaryMid = spawnedCutSegments[0]?.mid ?? mid;
    sim.slashes.push({ a: worldA, b: worldB, mid: primaryMid, life: 0.26, maxLife: 0.26 });
    soundEngine.playSlice();

    // Spawn crumbs, percikan garis (line streaks), and outline star sparks along cut edges
    for (const seg of spawnedCutSegments) {
      // 1. Velocity-aligned line streaks (percikan garis) shooting outward from cut
      const streakOrigins = [seg.a, seg.mid, seg.b];
      for (const origin of streakOrigins) {
        for (let i = 0; i < 4; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const baseAngle = Math.atan2(seg.normal.y * side, seg.normal.x * side);
          const angle = baseAngle + (Math.random() - 0.5) * 1.15;
          const speed = 260 + Math.random() * 240;
          const life = 0.22 + Math.random() * 0.14;
          sim.particles.push({
            kind: 'streak',
            x: origin.x + (Math.random() - 0.5) * 6,
            y: origin.y + (Math.random() - 0.5) * 6,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            size: 16 + Math.random() * 14,
            color: i % 3 === 0 ? '#E11D48' : i % 3 === 1 ? '#FACC15' : '#FFFFFF',
            alpha: 1,
            life,
            maxLife: life,
            rotation: angle,
            vr: 0,
          });
        }
      }

      // 2. Outline star sparks popping at cut entry/exit & center
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const sx = seg.a.x + (seg.b.x - seg.a.x) * t;
        const sy = seg.a.y + (seg.b.y - seg.a.y) * t;
        const angle = Math.random() * Math.PI * 2;
        const speed = 90 + Math.random() * 140;
        const life = 0.32 + Math.random() * 0.18;
        sim.particles.push({
          kind: 'spark',
          x: sx,
          y: sy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 7 + Math.random() * 5,
          color: i % 2 === 0 ? '#FDE047' : '#FFFFFF',
          alpha: 1,
          life,
          maxLife: life,
          rotation: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 8,
        });
      }

      // 3. Ink-outlined food crumbs distributed along the cut segment
      for (let i = 0; i < 14; i++) {
        const t = Math.random();
        const cx = seg.a.x + (seg.b.x - seg.a.x) * t;
        const cy = seg.a.y + (seg.b.y - seg.a.y) * t;
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 185;
        const color = objDef.crumbColors[i % objDef.crumbColors.length];
        const life = 0.44 + Math.random() * 0.28;
        sim.particles.push({
          kind: 'crumb',
          x: cx + (Math.random() - 0.5) * 10,
          y: cy + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 75,
          size: 5 + Math.random() * 6,
          color,
          alpha: 1,
          life,
          maxLife: life,
          rotation: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 11,
        });
      }
    }

    propsRef.current.onPieceCountChange(nextPieces.length);

    if (nextPieces.length === target) {
      sim.completedTriggered = true;
      // Gently fan pieces slightly further apart for clear % inspection
      for (const p of sim.pieces) {
        p.targetOffset.x *= 1.35;
        p.targetOffset.y *= 1.35;
      }
      const result = evaluateRound(rNum, activeObjId, target, sim.pieces);

      // Extra celebratory precision spark burst for high scores
      if (result.score >= 90) {
        for (const br of result.pieces) {
          for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 + Math.random() * 0.4;
            const speed = 110 + Math.random() * 120;
            const life = 0.48 + Math.random() * 0.2;
            sim.particles.push({
              kind: i % 2 === 0 ? 'spark' : 'streak',
              x: br.centroid.x,
              y: br.centroid.y,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed,
              size: i % 2 === 0 ? 9 + Math.random() * 4 : 18,
              color: result.score >= 98 ? '#10B981' : '#3B82F6',
              alpha: 1,
              life,
              maxLife: life,
              rotation: angle,
              vr: 4,
            });
          }
        }
      }

      sim.completeDelayTimer = window.setTimeout(() => {
        soundEngine.playRoundScore(result.score);
        propsRef.current.onRoundComplete(result);
      }, 240);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full select-none overflow-hidden"
      onContextMenu={(e) => e.preventDefault()}
    >
      <canvas
        ref={canvasRef}
        onPointerEnter={(e) => {
          if (e.pointerType !== 'touch') {
            simRef.current.hoverPos = clientToWorld(e.clientX, e.clientY);
          }
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => {
          simRef.current.hoverPos = null;
        }}
        className={`block w-full h-full touch-none ${
          gameState === 'PLAYING' ? 'cursor-none' : 'cursor-default'
        }`}
      />
    </div>
  );
};

function drawCuttingBoard(ctx: CanvasRenderingContext2D) {
  const bw = 690;
  const bh = 360;
  const r = 28;

  // Offset solid architectural shadow
  ctx.save();
  ctx.fillStyle = '#CBD5E1';
  ctx.beginPath();
  ctx.roundRect(-bw * 0.5 + 8, -bh * 0.5 + 8, bw, bh, r);
  ctx.fill();

  // Board main white surface
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, r);
  ctx.fill();

  // Subtle organic board contour inset line (no countable ticks!)
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.roundRect(-bw * 0.5 + 14, -bh * 0.5 + 14, bw - 28, bh - 28, r - 10);
  ctx.stroke();

  // Handle cutout on the right side of the board
  ctx.fillStyle = '#F4F6F8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.roundRect(bw * 0.5 - 38, -42, 16, 84, 8);
  ctx.fill();
  ctx.stroke();

  // Bold outer ink outline
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.roundRect(-bw * 0.5, -bh * 0.5, bw, bh, r);
  ctx.stroke();
  ctx.restore();
}

function drawPiece(
  ctx: CanvasRenderingContext2D,
  piece: Piece,
  objDef: ReturnType<typeof getObjectById>
) {
  if (piece.points.length < 3) return;

  ctx.save();
  ctx.translate(piece.offset.x, piece.offset.y);
  ctx.rotate(piece.angle);

  // Subtle piece drop shadow
  ctx.save();
  ctx.translate(4, 5);
  ctx.beginPath();
  ctx.moveTo(piece.points[0].x, piece.points[0].y);
  for (let i = 1; i < piece.points.length; i++) {
    ctx.lineTo(piece.points[i].x, piece.points[i].y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(24, 24, 27, 0.14)';
  ctx.fill();
  ctx.restore();

  // Build polygon path for clipping & stroking
  const tracePoly = () => {
    ctx.beginPath();
    ctx.moveTo(piece.points[0].x, piece.points[0].y);
    for (let i = 1; i < piece.points.length; i++) {
      ctx.lineTo(piece.points[i].x, piece.points[i].y);
    }
    ctx.closePath();
  };

  // Clip & draw interior illustration
  ctx.save();
  tracePoly();
  ctx.clip();
  objDef.drawInterior(ctx);

  // Draw freshly-cut interior bevel along cut edges
  if (piece.cutEdges.length > 0) {
    ctx.lineCap = 'round';
    for (const edge of piece.cutEdges) {
      ctx.beginPath();
      ctx.moveTo(edge.a.x, edge.a.y);
      ctx.lineTo(edge.b.x, edge.b.y);
      ctx.strokeStyle = objDef.cutFaceColor;
      ctx.lineWidth = 7;
      ctx.stroke();
    }
  }
  ctx.restore();

  // Bold crisp ink outline around the piece
  tracePoly();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.restore();
}

function snapPoint45Deg(start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 1) return end;
  const step = Math.PI / 4;
  const snappedAngle = Math.round(Math.atan2(dy, dx) / step) * step;
  return {
    x: start.x + Math.cos(snappedAngle) * dist,
    y: start.y + Math.sin(snappedAngle) * dist,
  };
}

function drawBoardGrid(ctx: CanvasRenderingContext2D, overObject: boolean) {
  const halfW = 318;
  const halfH = 158;
  const step = 36;

  ctx.save();
  ctx.strokeStyle = overObject ? 'rgba(37, 99, 235, 0.24)' : 'rgba(37, 99, 235, 0.28)';
  ctx.lineWidth = overObject ? 1 : 1.15;

  for (let x = -step * 8; x <= step * 8; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, -halfH);
    ctx.lineTo(x, halfH);
    ctx.stroke();
  }

  for (let y = -step * 4; y <= step * 4; y += step) {
    ctx.beginPath();
    ctx.moveTo(-halfW, y);
    ctx.lineTo(halfW, y);
    ctx.stroke();
  }

  // Center crosshair reference axes
  ctx.strokeStyle = overObject ? 'rgba(37, 99, 235, 0.42)' : 'rgba(37, 99, 235, 0.52)';
  ctx.lineWidth = 1.6;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(0, -halfH);
  ctx.lineTo(0, halfH);
  ctx.moveTo(-halfW, 0);
  ctx.lineTo(halfW, 0);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawOutlineKnifeShape(
  ctx: CanvasRenderingContext2D,
  accentColor: string,
  showPrecisionDot: boolean
) {
  // Canonical chef knife with sharp tip anchored at (0, 0),
  // handle trailing toward -x, spine along top (-y), belly along bottom (+y).
  const drawSilhouette = () => {
    ctx.beginPath();
    // Blade tip -> spine -> bolster top -> handle top -> handle butt -> handle bottom -> bolster bottom -> heel -> curved belly -> tip
    ctx.moveTo(0, 0);
    ctx.lineTo(-32, -2.5);
    ctx.lineTo(-37, -2.5);
    ctx.lineTo(-58, -3.5);
    ctx.quadraticCurveTo(-63, -3.5, -63, 1.5);
    ctx.quadraticCurveTo(-63, 6.5, -58, 6);
    ctx.lineTo(-37, 4.5);
    ctx.lineTo(-32, 4.5);
    ctx.lineTo(-30, 10.5);
    ctx.quadraticCurveTo(-15, 11.5, 0, 0);
    ctx.closePath();
  };

  // Offset architectural shadow
  ctx.save();
  ctx.translate(2.5, 3.5);
  drawSilhouette();
  ctx.fillStyle = 'rgba(24, 24, 27, 0.16)';
  ctx.fill();
  ctx.restore();

  // Blade steel body
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-32, -2.5);
  ctx.lineTo(-32, 4.5);
  ctx.lineTo(-30, 10.5);
  ctx.quadraticCurveTo(-15, 11.5, 0, 0);
  ctx.closePath();
  ctx.fillStyle = '#E2E8F0';
  ctx.fill();

  // Crisp bright bevel edge along cutting belly
  ctx.beginPath();
  ctx.moveTo(-1.5, 0.4);
  ctx.quadraticCurveTo(-15, 10.2, -29.5, 9.2);
  ctx.lineTo(-29.8, 7.2);
  ctx.quadraticCurveTo(-15.5, 8.2, -1.5, 0.4);
  ctx.closePath();
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();

  // Subtle metallic highlight stripe near spine
  ctx.beginPath();
  ctx.moveTo(-6, -0.5);
  ctx.lineTo(-29, -2);
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Bolster (metallic collar between blade and handle)
  ctx.beginPath();
  ctx.moveTo(-32, -2.5);
  ctx.lineTo(-37, -2.5);
  ctx.lineTo(-37, 4.5);
  ctx.lineTo(-32, 4.5);
  ctx.closePath();
  ctx.fillStyle = accentColor;
  ctx.fill();

  // Dark charcoal handle
  ctx.beginPath();
  ctx.moveTo(-37, -2.5);
  ctx.lineTo(-58, -3.5);
  ctx.quadraticCurveTo(-63, -3.5, -63, 1.5);
  ctx.quadraticCurveTo(-63, 6.5, -58, 6);
  ctx.lineTo(-37, 4.5);
  ctx.closePath();
  ctx.fillStyle = '#27272A';
  ctx.fill();

  // Handle rivets
  for (const rx of [-43.5, -53.5]) {
    ctx.beginPath();
    ctx.arc(rx, 1.2, 1.45, 0, Math.PI * 2);
    ctx.fillStyle = '#F4F6F8';
    ctx.fill();
  }

  // Bold ink outer outline & bolster seam
  drawSilhouette();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.1;
  ctx.lineJoin = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-32, -2.5);
  ctx.lineTo(-32, 4.5);
  ctx.moveTo(-37, -2.5);
  ctx.lineTo(-37, 4.5);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Precision pinpoint indicator directly at the blade tip hotspot (0, 0)
  if (showPrecisionDot) {
    ctx.beginPath();
    ctx.arc(0, 0, 2.3, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.3;
    ctx.stroke();
  }
}

function drawActiveSliceGuide(
  ctx: CanvasRenderingContext2D,
  a: Point,
  b: Point,
  snapped = false
) {
  const accent = snapped ? '#2563EB' : '#E11D48';
  ctx.save();
  // Crisp dashed vermilion/cobalt cut trajectory
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.4;
  ctx.setLineDash([7, 6]);
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.setLineDash([]);

  // Start anchor circle
  ctx.beginPath();
  ctx.arc(a.x, a.y, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // Chef knife aligned along the active cut trajectory with tip at b
  const angle = Math.atan2(b.y - a.y, b.x - a.x);
  ctx.translate(b.x, b.y);
  ctx.rotate(angle);
  if (Math.cos(angle) < 0) {
    ctx.scale(1, -1);
  }
  drawOutlineKnifeShape(ctx, accent, true);
  ctx.restore();
}

function drawKnifeReticle(ctx: CanvasRenderingContext2D, pt: Point, snapped = false) {
  ctx.save();
  ctx.translate(pt.x, pt.y);
  // Mirror horizontally and angle handle up-right so sharp tip points down-left at exact cursor hotspot
  ctx.scale(-1, 1);
  ctx.rotate(0.68);
  drawOutlineKnifeShape(ctx, snapped ? '#2563EB' : '#E11D48', true);
  ctx.restore();
}

function drawPieceBreakdowns(ctx: CanvasRenderingContext2D, result: RoundResult) {
  ctx.save();
  ctx.font = '700 13px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (const piece of result.pieces) {
    const label = `${piece.sharePercent.toFixed(1)}%`;
    const icon = piece.status === 'perfect' ? '✓' : piece.status === 'good' ? '≈' : '!';
    const text = `${icon} ${label}`;
    const w = ctx.measureText(text).width + 18;
    const h = 26;
    const x = piece.centroid.x;
    const y = piece.centroid.y;

    const bg =
      piece.status === 'perfect'
        ? '#ECFDF5'
        : piece.status === 'good'
          ? '#EFF6FF'
          : '#FFF1F2';
    const fg =
      piece.status === 'perfect'
        ? '#047857'
        : piece.status === 'good'
          ? '#1D4ED8'
          : '#BE123C';

    ctx.fillStyle = INK;
    ctx.beginPath();
    ctx.roundRect(x - w * 0.5 + 2, y - h * 0.5 + 2, w, h, 6);
    ctx.fill();

    ctx.fillStyle = bg;
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x - w * 0.5, y - h * 0.5, w, h, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = fg;
    ctx.fillText(text, x, y + 0.5);
  }
  ctx.restore();
}
