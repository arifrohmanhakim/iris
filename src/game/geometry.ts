import type { CutEdge, Point } from './types';

export function signedPolygonArea(pts: Point[]): number {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return sum * 0.5;
}

export function polygonArea(pts: Point[]): number {
  return Math.abs(signedPolygonArea(pts));
}

export function polygonCentroid(pts: Point[]): Point {
  const signedArea = signedPolygonArea(pts);
  if (Math.abs(signedArea) < 1e-6) {
    const avg = pts.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    return { x: avg.x / Math.max(1, pts.length), y: avg.y / Math.max(1, pts.length) };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const cross = p1.x * p2.y - p2.x * p1.y;
    cx += (p1.x + p2.x) * cross;
    cy += (p1.y + p2.y) * cross;
  }
  const factor = 1 / (6 * signedArea);
  return { x: cx * factor, y: cy * factor };
}

export function isPointInPolygon(pt: Point, pts: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x;
    const yi = pts[i].y;
    const xj = pts[j].x;
    const yj = pts[j].y;

    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function segmentIntersection(a: Point, b: Point, c: Point, d: Point): { point: Point; t: number; u: number } | null {
  const rX = b.x - a.x;
  const rY = b.y - a.y;
  const sX = d.x - c.x;
  const sY = d.y - c.y;

  const denom = rX * sY - rY * sX;
  if (Math.abs(denom) < 1e-8) return null;

  const qpx = c.x - a.x;
  const qpy = c.y - a.y;

  const t = (qpx * sY - qpy * sX) / denom;
  const u = (qpx * rY - qpy * rX) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      point: { x: a.x + t * rX, y: a.y + t * rY },
      t,
      u,
    };
  }
  return null;
}

export function getSegmentPolygonIntersections(a: Point, b: Point, pts: Point[]): Point[] {
  const hits: Array<{ point: Point; t: number }> = [];
  for (let i = 0; i < pts.length; i++) {
    const c = pts[i];
    const d = pts[(i + 1) % pts.length];
    const hit = segmentIntersection(a, b, c, d);
    if (hit) {
      // Deduplicate near-vertex hits
      const duplicate = hits.some(
        (existing) => Math.hypot(existing.point.x - hit.point.x, existing.point.y - hit.point.y) < 1.5
      );
      if (!duplicate) {
        hits.push({ point: hit.point, t: hit.t });
      }
    }
  }
  hits.sort((h1, h2) => h1.t - h2.t);
  return hits.map((h) => h.point);
}

function signedSide(p: Point, a: Point, b: Point): number {
  return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}

function lineIntersection(p1: Point, p2: Point, a: Point, b: Point): Point {
  const dx1 = p2.x - p1.x;
  const dy1 = p2.y - p1.y;
  const dx2 = b.x - a.x;
  const dy2 = b.y - a.y;
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-8) {
    return { x: (p1.x + p2.x) * 0.5, y: (p1.y + p2.y) * 0.5 };
  }
  const t = ((a.x - p1.x) * dy2 - (a.y - p1.y) * dx2) / denom;
  return {
    x: p1.x + t * dx1,
    y: p1.y + t * dy1,
  };
}

function clipHalfPlane(pts: Point[], a: Point, b: Point, keepPositive: boolean): Point[] {
  const out: Point[] = [];
  const sign = keepPositive ? 1 : -1;
  const eps = 1e-5;

  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i];
    const prev = pts[(i + pts.length - 1) % pts.length];
    const dCurr = signedSide(curr, a, b) * sign;
    const dPrev = signedSide(prev, a, b) * sign;

    const currIn = dCurr >= -eps;
    const prevIn = dPrev >= -eps;

    if (currIn) {
      if (!prevIn) {
        out.push(lineIntersection(prev, curr, a, b));
      }
      out.push(curr);
    } else if (prevIn) {
      out.push(lineIntersection(prev, curr, a, b));
    }
  }

  // Clean near-duplicate consecutive vertices
  const cleaned: Point[] = [];
  for (const p of out) {
    const last = cleaned[cleaned.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) > 0.4) {
      cleaned.push(p);
    }
  }
  if (cleaned.length > 2) {
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 0.4) {
      cleaned.pop();
    }
  }
  return cleaned;
}

export interface SplitResult {
  positivePoly: Point[];
  negativePoly: Point[];
  cutEdge: CutEdge;
  normal: Point;
}

export function splitPolygonBySegment(pts: Point[], a: Point, b: Point): SplitResult | null {
  // Endpoints must not lie inside the polygon (must slice cleanly through)
  if (isPointInPolygon(a, pts) || isPointInPolygon(b, pts)) {
    return null;
  }

  const hits = getSegmentPolygonIntersections(a, b, pts);
  if (hits.length !== 2) {
    return null;
  }

  const positivePoly = clipHalfPlane(pts, a, b, true);
  const negativePoly = clipHalfPlane(pts, a, b, false);

  if (positivePoly.length < 3 || negativePoly.length < 3) {
    return null;
  }

  const areaPos = polygonArea(positivePoly);
  const areaNeg = polygonArea(negativePoly);
  const total = areaPos + areaNeg;

  // Reject grazing corner nicks (< 1.5% of piece area)
  if (total < 10 || Math.min(areaPos, areaNeg) / total < 0.015) {
    return null;
  }

  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  // Normal pointing toward positive half-plane
  const normal = { x: -dy / len, y: dx / len };

  return {
    positivePoly,
    negativePoly,
    cutEdge: { a: hits[0], b: hits[1] },
    normal,
  };
}

export function worldToLocal(pt: Point, offset: Point, angle: number): Point {
  const dx = pt.x - offset.x;
  const dy = pt.y - offset.y;
  const cos = Math.cos(-angle);
  const sin = Math.sin(-angle);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

export function localToWorld(pt: Point, offset: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: pt.x * cos - pt.y * sin + offset.x,
    y: pt.x * sin + pt.y * cos + offset.y,
  };
}

export function createRoundedRectPolygon(width: number, height: number, radius: number, segmentsPerCorner = 6): Point[] {
  const hw = width * 0.5;
  const hh = height * 0.5;
  const r = Math.min(radius, hw - 1, hh - 1);
  const pts: Point[] = [];
  const corners = [
    { cx: hw - r, cy: -hh + r, start: -Math.PI / 2 },
    { cx: hw - r, cy: hh - r, start: 0 },
    { cx: -hw + r, cy: hh - r, start: Math.PI / 2 },
    { cx: -hw + r, cy: -hh + r, start: Math.PI },
  ];

  for (const c of corners) {
    for (let i = 0; i <= segmentsPerCorner; i++) {
      const a = c.start + (i / segmentsPerCorner) * (Math.PI / 2);
      pts.push({
        x: c.cx + Math.cos(a) * r,
        y: c.cy + Math.sin(a) * r,
      });
    }
  }
  return pts;
}

export function createCirclePolygon(radius: number, segments = 48): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    pts.push({
      x: Math.cos(a) * radius,
      y: Math.sin(a) * radius,
    });
  }
  return pts;
}

export function createTaperedCapsulePolygon(
  length: number,
  leftRadius: number,
  rightRadius: number,
  arcSegments = 12
): Point[] {
  const pts: Point[] = [];
  const leftCx = -length * 0.5 + leftRadius;
  const rightCx = length * 0.5 - rightRadius;

  // Right cap (-PI/2 to +PI/2)
  for (let i = 0; i <= arcSegments; i++) {
    const a = -Math.PI / 2 + (i / arcSegments) * Math.PI;
    pts.push({
      x: rightCx + Math.cos(a) * rightRadius,
      y: Math.sin(a) * rightRadius,
    });
  }

  // Left cap (+PI/2 to 3*PI/2)
  for (let i = 0; i <= arcSegments; i++) {
    const a = Math.PI / 2 + (i / arcSegments) * Math.PI;
    pts.push({
      x: leftCx + Math.cos(a) * leftRadius,
      y: Math.sin(a) * leftRadius,
    });
  }

  return pts;
}
