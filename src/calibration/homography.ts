import type { Point } from '../core/types';

export type Matrix3 = [number, number, number, number, number, number, number, number, number];

const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const segmentsCross = (a: Point, b: Point, c: Point, d: Point) => cross(a, b, c) * cross(a, b, d) <= 0 && cross(c, d, a) * cross(c, d, b) <= 0;
export function polygonArea(points: Point[]): number {
  return Math.abs(points.reduce((sum, point, index) => {
    const next = points[(index + 1) % points.length]; return sum + point.x * next.y - next.x * point.y;
  }, 0)) / 2;
}
export function validateQuadrilateral(points: Point[]): void {
  if (points.length !== 4 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('Calibration requires four finite corner points.');
  if (polygonArea(points) < 0.002) throw new Error('Calibration corners enclose too little area. Spread them farther apart.');
  if (segmentsCross(points[0], points[1], points[2], points[3]) || segmentsCross(points[1], points[2], points[3], points[0])) throw new Error('Calibration corners cross. Capture them in the requested order.');
  for (let i = 0; i < 4; i++) if (Math.hypot(points[i].x - points[(i + 1) % 4].x, points[i].y - points[(i + 1) % 4].y) < 0.02) throw new Error('Two calibration corners are too close together.');
  const signs = points.map((p, i) => Math.sign(cross(p, points[(i + 1) % 4], points[(i + 2) % 4])));
  if (signs.some(sign => sign === 0 || sign !== signs[0])) throw new Error('Calibration quadrilateral must be convex.');
}

function solve(matrix: number[][]): number[] {
  const n = matrix.length;
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) if (Math.abs(matrix[row][column]) > Math.abs(matrix[pivot][column])) pivot = row;
    if (Math.abs(matrix[pivot][column]) < 1e-10) throw new Error('Calibration is numerically degenerate.');
    [matrix[column], matrix[pivot]] = [matrix[pivot], matrix[column]];
    const divisor = matrix[column][column];
    for (let j = column; j <= n; j++) matrix[column][j] /= divisor;
    for (let row = 0; row < n; row++) if (row !== column) {
      const factor = matrix[row][column];
      for (let j = column; j <= n; j++) matrix[row][j] -= factor * matrix[column][j];
    }
  }
  return matrix.map(row => row[n]);
}

export function homographyFromQuad(source: Point[], destination: Point[] = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }]): Matrix3 {
  validateQuadrilateral(source); validateQuadrilateral(destination);
  const rows: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = source[i], { x: u, y: v } = destination[i];
    rows.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    rows.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  const h = solve(rows);
  return [...h, 1] as Matrix3;
}

export function applyHomography(matrix: Matrix3, point: Point): Point {
  const denominator = matrix[6] * point.x + matrix[7] * point.y + matrix[8];
  if (Math.abs(denominator) < 1e-10) throw new Error('Point maps to infinity under calibration.');
  return { x: (matrix[0] * point.x + matrix[1] * point.y + matrix[2]) / denominator, y: (matrix[3] * point.x + matrix[4] * point.y + matrix[5]) / denominator };
}

export function invertHomography(m: Matrix3): Matrix3 {
  const [a,b,c,d,e,f,g,h,i] = m;
  const A=e*i-f*h, B=c*h-b*i, C=b*f-c*e, D=f*g-d*i, E=a*i-c*g, F=c*d-a*f, G=d*h-e*g, H=b*g-a*h, I=a*e-b*d;
  const det=a*A+b*D+c*G;
  if (Math.abs(det) < 1e-10) throw new Error('Calibration transform is not invertible.');
  return [A/det,B/det,C/det,D/det,E/det,F/det,G/det,H/det,I/det];
}

export class PlaneMapper {
  private key = '';
  private matrix: Matrix3 | null = null;
  map(point: Point, points: Point[] | null): Point | null {
    if (!points) return null;
    const key = JSON.stringify(points);
    if (key !== this.key) { this.matrix = homographyFromQuad(points); this.key = key; }
    return applyHomography(this.matrix!, point);
  }
  reset(): void { this.key = ''; this.matrix = null; }
}
