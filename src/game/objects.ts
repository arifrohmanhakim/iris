import {
  createCirclePolygon,
  createRoundedRectPolygon,
  createTaperedCapsulePolygon,
} from './geometry';
import type { ObjectDef, Point } from './types';

const INK = '#18181B';

function drawInkLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  width = 2,
  color = INK
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function drawHatching(
  ctx: CanvasRenderingContext2D,
  xStart: number,
  xEnd: number,
  yBase: number,
  height: number,
  step = 14
) {
  ctx.save();
  ctx.strokeStyle = 'rgba(24, 24, 27, 0.22)';
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  for (let x = xStart; x <= xEnd; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, yBase);
    ctx.lineTo(x - 6, yBase + height);
    ctx.stroke();
  }
  ctx.restore();
}

export const CULINARY_OBJECTS: ObjectDef[] = [
  {
    id: 'roti_tawar',
    name: 'Roti Tawar',
    category: 'Roti & Kue',
    shape: 'block',
    cutFaceColor: '#FFFBEB',
    crumbColors: ['#FEF3C7', '#D97706', '#FFFBEB'],
    generatePolygon: (): Point[] => createRoundedRectPolygon(420, 170, 28, 7),
    drawInterior: (ctx) => {
      // Soft cream bread body
      ctx.fillStyle = '#FEF3C7';
      ctx.fillRect(-240, -110, 480, 220);

      // Golden crust rim around top and sides
      ctx.fillStyle = '#E5A952';
      ctx.fillRect(-220, -95, 440, 34);
      ctx.fillRect(-220, 62, 440, 34);
      ctx.fillRect(-220, -95, 24, 190);
      ctx.fillRect(196, -95, 24, 190);

      // Inner crust outline
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(-186, -54, 372, 108);

      // Subtle bread crumb pores (deterministic)
      const pores: Array<[number, number, number]> = [
        [-140, -22, 3.5], [-105, 16, 4.5], [-68, -10, 3], [-24, 26, 4],
        [15, -24, 5], [58, 12, 3.5], [102, -16, 4], [148, 20, 3],
        [-152, 28, 2.5], [-45, -32, 3], [78, 32, 2.8], [130, -28, 3.2],
      ];
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.32)';
      ctx.lineWidth = 1.5;
      for (const [px, py, r] of pores) {
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      drawHatching(ctx, -195, 195, 68, 14, 16);
    },
  },
  {
    id: 'timun',
    name: 'Timun Hijau',
    category: 'Sayuran',
    shape: 'elongated',
    cutFaceColor: '#ECFDF5',
    crumbColors: ['#4ADE80', '#BBF7D0', '#166534'],
    generatePolygon: (): Point[] => createTaperedCapsulePolygon(480, 56, 52, 14),
    drawInterior: (ctx) => {
      // Deep fresh cucumber skin
      ctx.fillStyle = '#4D9E5B';
      ctx.fillRect(-260, -80, 520, 160);

      // Lighter top highlight band
      ctx.fillStyle = '#74C27D';
      ctx.fillRect(-250, -56, 500, 32);

      // Darker bottom shadow band
      ctx.fillStyle = '#387C44';
      ctx.fillRect(-250, 26, 500, 40);

      // Longitudinal cucumber ridges in ink
      const ridges = [-26, -6, 14, 32];
      for (const ry of ridges) {
        ctx.beginPath();
        ctx.moveTo(-215, ry);
        ctx.quadraticCurveTo(0, ry + (ry % 4 === 0 ? 3 : -2), 215, ry);
        ctx.strokeStyle = 'rgba(24, 24, 27, 0.5)';
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Small cucumber bumps / stipples
      const bumps: Array<[number, number]> = [
        [-170, -18], [-115, 22], [-60, -30], [-10, 6],
        [45, -16], [105, 26], [155, -24], [190, 10],
      ];
      ctx.fillStyle = INK;
      for (const [bx, by] of bumps) {
        ctx.beginPath();
        ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Stem nub on left end
      ctx.beginPath();
      ctx.arc(-222, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#2E6938';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();

      drawHatching(ctx, -200, 200, 36, 15, 14);
    },
  },
  {
    id: 'baguette',
    name: 'Roti Baguette',
    category: 'Roti & Kue',
    shape: 'elongated',
    cutFaceColor: '#FEF9C3',
    crumbColors: ['#E5A952', '#FDE68A', '#92400E'],
    generatePolygon: (): Point[] => createTaperedCapsulePolygon(530, 56, 56, 14),
    drawInterior: (ctx) => {
      // Golden baked crust
      ctx.fillStyle = '#DFA355';
      ctx.fillRect(-280, -80, 560, 160);

      // Top lighter baked belly
      ctx.fillStyle = '#F0C27B';
      ctx.fillRect(-270, -60, 540, 56);

      // Diagonal artisan bakery slashes
      const slashCenters = [-165, -75, 15, 105, 185];
      for (const sx of slashCenters) {
        ctx.save();
        ctx.translate(sx, -4);
        ctx.rotate(-0.42);
        ctx.beginPath();
        ctx.ellipse(0, 0, 34, 11, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FBE8BD';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Inner slash shadow line
        drawInkLine(ctx, -22, 2, 22, -2, 1.4, 'rgba(24, 24, 27, 0.45)');
        ctx.restore();
      }

      // Flour / sesame ink flecks
      const flecks: Array<[number, number]> = [
        [-210, 22], [-130, 28], [-35, -34], [58, 30], [148, -32], [220, 16],
      ];
      ctx.fillStyle = INK;
      for (const [fx, fy] of flecks) {
        ctx.beginPath();
        ctx.ellipse(fx, fy, 3, 1.6, 0.4, 0, Math.PI * 2);
        ctx.fill();
      }

      drawHatching(ctx, -225, 225, 34, 16, 15);
    },
  },
  {
    id: 'wortel',
    name: 'Wortel Segar',
    category: 'Sayuran',
    shape: 'elongated',
    cutFaceColor: '#FFEDD5',
    crumbColors: ['#F97316', '#FDBA74', '#16A34A'],
    generatePolygon: (): Point[] => createTaperedCapsulePolygon(480, 62, 22, 14),
    drawInterior: (ctx) => {
      // Vibrant flat carrot orange
      ctx.fillStyle = '#F27D32';
      ctx.fillRect(-260, -80, 520, 160);

      // Top highlight band
      ctx.fillStyle = '#FB9C5A';
      ctx.fillRect(-250, -64, 500, 40);

      // Green leafy crown accent inside wide left end
      ctx.fillStyle = '#3DA35D';
      ctx.fillRect(-255, -70, 32, 140);
      drawInkLine(ctx, -223, -65, -223, 65, 2.2, INK);

      // Carrot horizontal ink crease marks (organic sketch lines)
      const marks: Array<[number, number, number]> = [
        [-180, -34, 28], [-150, 14, 34], [-102, -16, 26],
        [-60, 26, 22], [-18, -28, 24], [30, 8, 26],
        [78, -16, 20], [125, 10, 18], [168, -8, 14],
      ];
      for (const [mx, my, len] of marks) {
        ctx.beginPath();
        ctx.moveTo(mx, my);
        ctx.quadraticCurveTo(mx + 4, my + len * 0.5, mx - 1, my + len);
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.9;
        ctx.lineCap = 'round';
        ctx.stroke();
      }

      drawHatching(ctx, -210, 195, 24, 20, 14);
    },
  },
  {
    id: 'kue_gulung',
    name: 'Kue Gulung Stroberi',
    category: 'Roti & Kue',
    shape: 'elongated',
    cutFaceColor: '#FFF1F2',
    crumbColors: ['#FDA4AF', '#FDE68A', '#E11D48'],
    generatePolygon: (): Point[] => createRoundedRectPolygon(450, 142, 34, 7),
    drawInterior: (ctx) => {
      // Golden sponge cake base
      ctx.fillStyle = '#F7CF8B';
      ctx.fillRect(-240, -85, 480, 170);

      // Strawberry cream icing ribbon across the top
      ctx.fillStyle = '#F898A8';
      ctx.fillRect(-240, -85, 480, 56);
      ctx.beginPath();
      ctx.moveTo(-235, -29);
      for (let x = -235; x <= 235; x += 40) {
        ctx.quadraticCurveTo(x + 10, -14, x + 20, -29);
        ctx.quadraticCurveTo(x + 30, -40, x + 40, -29);
      }
      ctx.lineTo(240, -85);
      ctx.lineTo(-240, -85);
      ctx.closePath();
      ctx.fillStyle = '#F4728A';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Spiral end indicator & strawberry jam dots
      const berries: Array<[number, number]> = [
        [-160, -50], [-85, -48], [-10, -52], [65, -48], [140, -50],
      ];
      for (const [bx, by] of berries) {
        ctx.beginPath();
        ctx.arc(bx, by, 7, 0, Math.PI * 2);
        ctx.fillStyle = '#E11D48';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }

      // Decorative cream line along lower body
      drawInkLine(ctx, -195, 12, 195, 12, 1.8, 'rgba(24, 24, 27, 0.3)');
      drawHatching(ctx, -200, 200, 48, 16, 15);
    },
  },
  {
    id: 'keju_cheddar',
    name: 'Keju Cheddar',
    category: 'Keju & Gurih',
    shape: 'block',
    cutFaceColor: '#FEF9C3',
    crumbColors: ['#FACC15', '#FEF08A', '#CA8A04'],
    generatePolygon: (): Point[] => createRoundedRectPolygon(400, 176, 18, 5),
    drawInterior: (ctx) => {
      // Rich flat swiss-cheddar yellow
      ctx.fillStyle = '#F7C948';
      ctx.fillRect(-220, -105, 440, 210);

      // Top facet lighter shade
      ctx.fillStyle = '#FDE073';
      ctx.fillRect(-220, -105, 440, 46);
      drawInkLine(ctx, -210, -58, 210, -58, 2, 'rgba(24, 24, 27, 0.45)');

      // Iconic ink-outlined Swiss cheese holes
      const holes: Array<[number, number, number]> = [
        [-145, -18, 16], [-72, 26, 20], [-12, -26, 13],
        [45, 18, 17], [118, -14, 21], [160, 42, 11],
        [-162, 48, 12], [2, 52, 10], [-95, -78, 9], [85, -78, 11],
      ];
      for (const [hx, hy, hr] of holes) {
        ctx.beginPath();
        ctx.arc(hx, hy, hr, 0, Math.PI * 2);
        ctx.fillStyle = '#E0A82E';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Inner crescent highlight inside hole
        ctx.beginPath();
        ctx.arc(hx + 2, hy + 2, Math.max(3, hr - 4), -0.3, 1.8);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
    },
  },
  {
    id: 'sushi_roll',
    name: 'Sushi Roll',
    category: 'Keju & Gurih',
    shape: 'elongated',
    cutFaceColor: '#FFFFFF',
    crumbColors: ['#18181B', '#FB7185', '#4ADE80'],
    generatePolygon: (): Point[] => createRoundedRectPolygon(470, 128, 28, 6),
    drawInterior: (ctx) => {
      // Dark roasted nori seaweed wrap
      ctx.fillStyle = '#243B32';
      ctx.fillRect(-250, -80, 500, 160);

      // Subtle glossy highlight along top nori
      ctx.fillStyle = '#335246';
      ctx.fillRect(-240, -58, 480, 26);

      // Visible rice & salmon ends on both sides
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(side * 208, 0);
        ctx.beginPath();
        ctx.ellipse(0, 0, 24, 56, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#F8FAFC';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.2;
        ctx.stroke();

        // Salmon + avocado core
        ctx.beginPath();
        ctx.ellipse(0, -6, 10, 16, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FB7185';
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(0, 16, 8, 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#84CC16';
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // Nori horizontal texture bands & sesame flecks
      drawInkLine(ctx, -170, -24, 170, -24, 1.6, 'rgba(255,255,255,0.22)');
      drawInkLine(ctx, -170, 20, 170, 20, 1.6, 'rgba(255,255,255,0.22)');

      const seeds: Array<[number, number]> = [
        [-140, -10], [-95, 15], [-45, -32], [12, 28],
        [58, -14], [105, 12], [148, -28], [-120, 36],
      ];
      ctx.fillStyle = '#FEF3C7';
      for (const [sx, sy] of seeds) {
        ctx.beginPath();
        ctx.ellipse(sx, sy, 3.5, 1.8, 0.35, 0, Math.PI * 2);
        ctx.fill();
      }
    },
  },
  {
    id: 'terong',
    name: 'Terong Ungu',
    category: 'Sayuran',
    shape: 'elongated',
    cutFaceColor: '#FAF5FF',
    crumbColors: ['#9333EA', '#D8B4FE', '#4D7C0F'],
    generatePolygon: (): Point[] => createTaperedCapsulePolygon(460, 44, 70, 14),
    drawInterior: (ctx) => {
      // Deep glossy eggplant purple
      ctx.fillStyle = '#6D3B8E';
      ctx.fillRect(-250, -85, 500, 170);

      // Gloss highlight strip
      ctx.fillStyle = '#8E58B2';
      ctx.fillRect(-220, -48, 440, 20);

      // Green calyx cap on left stem end
      ctx.beginPath();
      ctx.moveTo(-240, -55);
      ctx.lineTo(-175, -36);
      ctx.lineTo(-190, -8);
      ctx.lineTo(-165, 8);
      ctx.lineTo(-188, 34);
      ctx.lineTo(-240, 55);
      ctx.closePath();
      ctx.fillStyle = '#4F8A47';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Glossy cartoon highlight capsule
      ctx.beginPath();
      ctx.roundRect(-80, -44, 150, 11, 5.5);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fill();

      drawHatching(ctx, -155, 195, 42, 18, 15);
    },
  },
  {
    id: 'jagung',
    name: 'Jagung Manis',
    category: 'Sayuran',
    shape: 'elongated',
    cutFaceColor: '#FEF9C3',
    crumbColors: ['#FACC15', '#FDE047', '#4D7C0F'],
    generatePolygon: (): Point[] => createTaperedCapsulePolygon(480, 58, 44, 14),
    drawInterior: (ctx) => {
      // Warm golden corn base
      ctx.fillStyle = '#F4C430';
      ctx.fillRect(-260, -75, 520, 150);

      // Top highlight
      ctx.fillStyle = '#FBE06B';
      ctx.fillRect(-250, -56, 500, 36);

      // Staggered kernel rows (not aligned uniformly so player can't cheat by counting exact rows!)
      const rowY = [-38, -19, 0, 19, 38];
      ctx.strokeStyle = 'rgba(24, 24, 27, 0.55)';
      ctx.lineWidth = 1.6;
      for (const y of rowY) {
        drawInkLine(ctx, -230, y, 230, y, 1.5, 'rgba(24, 24, 27, 0.5)');
      }

      // Irregular organic kernel dividers
      for (let rowIdx = 0; rowIdx < rowY.length - 1; rowIdx++) {
        const yTop = rowY[rowIdx];
        const yBot = rowY[rowIdx + 1];
        const offset = (rowIdx % 2) * 9;
        for (let x = -215 + offset; x < 215; x += 19) {
          drawInkLine(ctx, x, yTop, x + (rowIdx % 2 === 0 ? 1 : -1), yBot, 1.4, 'rgba(24, 24, 27, 0.48)');
        }
      }

      // Green husk collar on left end
      ctx.fillStyle = '#5B9A4C';
      ctx.fillRect(-255, -70, 28, 140);
      drawInkLine(ctx, -227, -68, -227, 68, 2.2, INK);
    },
  },
  {
    id: 'pizza_klasik',
    name: 'Pizza Klasik',
    category: 'Keju & Gurih',
    shape: 'round',
    cutFaceColor: '#FEF3C7',
    crumbColors: ['#F59E0B', '#EF4444', '#FEF08A'],
    generatePolygon: (): Point[] => createCirclePolygon(162, 48),
    drawInterior: (ctx) => {
      // Baked golden crust outer ring
      ctx.beginPath();
      ctx.arc(0, 0, 162, 0, Math.PI * 2);
      ctx.fillStyle = '#E09F4B';
      ctx.fill();

      // Tomato sauce + mozzarella inner disc
      ctx.beginPath();
      ctx.arc(0, 0, 134, 0, Math.PI * 2);
      ctx.fillStyle = '#FCD34D';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.4;
      ctx.stroke();

      // Tomato sauce peeks along inner rim
      ctx.beginPath();
      ctx.arc(0, 0, 130, 0, Math.PI * 2);
      ctx.strokeStyle = '#DC2626';
      ctx.lineWidth = 5;
      ctx.stroke();

      // Pepperoni slices in symmetric 4-quadrant balance
      const pepperonis: Array<[number, number, number]> = [
        [-62, -62, 20], [62, -62, 20],
        [-62, 62, 20], [62, 62, 20],
        [0, -90, 16], [0, 90, 16],
        [-90, 0, 16], [90, 0, 16],
        [0, 0, 18],
      ];
      for (const [px, py, pr] of pepperonis) {
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fillStyle = '#D94336';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Pepperoni fat specks
        ctx.fillStyle = '#FCA5A5';
        ctx.beginPath();
        ctx.arc(px - 5, py - 4, 2.2, 0, Math.PI * 2);
        ctx.arc(px + 6, py + 4, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Basil leaves
      const basils: Array<[number, number, number]> = [
        [-32, -32, 0.6], [32, -32, -0.5], [-32, 32, -0.7], [32, 32, 0.5],
      ];
      for (const [bx, by, rot] of basils) {
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, 11, 5.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#4D9E5B';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.6;
        ctx.stroke();
        ctx.restore();
      }
    },
  },
  {
    id: 'cokelat_slab',
    name: 'Cokelat Artisan',
    category: 'Buah & Manis',
    shape: 'block',
    cutFaceColor: '#78350F',
    crumbColors: ['#5C3A21', '#92400E', '#FDE68A'],
    generatePolygon: (): Point[] => createRoundedRectPolygon(440, 150, 16, 5),
    drawInterior: (ctx) => {
      // Rich dark cocoa base
      ctx.fillStyle = '#5C3A28';
      ctx.fillRect(-240, -90, 480, 180);

      // Bevel frame inside chocolate slab
      ctx.fillStyle = '#714934';
      ctx.fillRect(-220, -75, 440, 32);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.strokeRect(-200, -56, 400, 112);

      // Diagonal white-chocolate drizzle ribbon
      ctx.beginPath();
      ctx.moveTo(-210, 48);
      ctx.bezierCurveTo(-90, -55, 60, 55, 210, -42);
      ctx.strokeStyle = '#F5E6CA';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Roasted almond & sea-salt flakes
      const nuts: Array<[number, number, number]> = [
        [-145, -18, 0.3], [-75, 22, -0.4], [-10, -22, 0.5],
        [68, 20, -0.2], [138, -16, 0.4], [165, 26, -0.5],
      ];
      for (const [nx, ny, rot] of nuts) {
        ctx.save();
        ctx.translate(nx, ny);
        ctx.rotate(rot);
        ctx.beginPath();
        ctx.ellipse(0, 0, 9, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#E5C396';
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 1.7;
        ctx.stroke();
        ctx.restore();
      }
    },
  },
  {
    id: 'semangka',
    name: 'Semangka Bulat',
    category: 'Buah & Manis',
    shape: 'round',
    cutFaceColor: '#FECDD3',
    crumbColors: ['#FB7185', '#16A34A', '#18181B'],
    generatePolygon: (): Point[] => createCirclePolygon(156, 48),
    drawInterior: (ctx) => {
      // Crisp outer green rind
      ctx.beginPath();
      ctx.arc(0, 0, 156, 0, Math.PI * 2);
      ctx.fillStyle = '#3B8E4C';
      ctx.fill();

      // Pale inner rind ring
      ctx.beginPath();
      ctx.arc(0, 0, 140, 0, Math.PI * 2);
      ctx.fillStyle = '#D9F99D';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Bright watermelon flesh
      ctx.beginPath();
      ctx.arc(0, 0, 128, 0, Math.PI * 2);
      ctx.fillStyle = '#F25F6E';
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Radial black seeds
      const seedCount = 12;
      for (let i = 0; i < seedCount; i++) {
        const a = (i / seedCount) * Math.PI * 2 + 0.15;
        const r = i % 2 === 0 ? 74 : 92;
        const sx = Math.cos(a) * r;
        const sy = Math.sin(a) * r;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, 0, 6.5, 3.4, 0, 0, Math.PI * 2);
        ctx.fillStyle = INK;
        ctx.fill();
        ctx.restore();
      }
    },
  },
];

export function getObjectById(id: string): ObjectDef {
  return CULINARY_OBJECTS.find((obj) => obj.id === id) ?? CULINARY_OBJECTS[0];
}
