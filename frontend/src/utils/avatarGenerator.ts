// Deterministic Avatar Generation System
// Version 1 - Based on scalar field + marching squares

const AVATAR_VERSION = 1;
const GLOBAL_SALT = 'scibowl-arena-v1';

// ============================================================================
// 1. Hash Function (cyrb53-based)
// ============================================================================
function hashString(str: string): number {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

// ============================================================================
// 2. PRNG (mulberry32)
// ============================================================================
function createPRNG(seed: number) {
  let state = seed;

  return function() {
    state |= 0;
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ============================================================================
// 3. Value Noise Generation (Smooth Scalar Field)
// ============================================================================
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function generateValueNoise(width: number, height: number, rng: () => number, octaves = 3, persistence = 0.6): number[][] {
  const field: number[][] = Array(height).fill(0).map(() => Array(width).fill(0));

  // Generate multiple octaves of noise
  for (let octave = 0; octave < octaves; octave++) {
    const frequency = Math.pow(2, octave);
    const amplitude = Math.pow(persistence, octave);
    const gridSize = Math.max(4, Math.floor(width / frequency));

    // Generate random values at grid points
    const grid: number[][] = [];
    for (let y = 0; y <= Math.ceil(height / gridSize) + 1; y++) {
      grid[y] = [];
      for (let x = 0; x <= Math.ceil(width / gridSize) + 1; x++) {
        grid[y][x] = rng();
      }
    }

    // Interpolate between grid points
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const gx = x / gridSize;
        const gy = y / gridSize;

        const x0 = Math.floor(gx);
        const x1 = x0 + 1;
        const y0 = Math.floor(gy);
        const y1 = y0 + 1;

        const sx = smoothstep(gx - x0);
        const sy = smoothstep(gy - y0);

        const n0 = grid[y0][x0];
        const n1 = grid[y0][x1];
        const n2 = grid[y1][x0];
        const n3 = grid[y1][x1];

        const nx0 = lerp(n0, n1, sx);
        const nx1 = lerp(n2, n3, sx);
        const value = lerp(nx0, nx1, sy);

        field[y][x] += value * amplitude;
      }
    }
  }

  // Normalize to [0, 1]
  let min = Infinity;
  let max = -Infinity;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      min = Math.min(min, field[y][x]);
      max = Math.max(max, field[y][x]);
    }
  }

  const range = max - min;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      field[y][x] = (field[y][x] - min) / range;
    }
  }

  return field;
}

// ============================================================================
// 4. Marching Squares Implementation
// ============================================================================
interface Point {
  x: number;
  y: number;
}

function marchingSquares(field: number[][], threshold: number): string {
  const height = field.length;
  const width = field[0].length;
  const paths: Point[][] = [];

  // Helper to get interpolated edge point
  function getEdgePoint(x1: number, y1: number, v1: number, x2: number, y2: number, v2: number): Point {
    const t = (threshold - v1) / (v2 - v1);
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  // Process each cell
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      const v00 = field[y][x];
      const v10 = field[y][x + 1];
      const v01 = field[y + 1][x];
      const v11 = field[y + 1][x + 1];

      // Calculate marching squares case (0-15)
      let caseId = 0;
      if (v00 >= threshold) caseId |= 1;
      if (v10 >= threshold) caseId |= 2;
      if (v11 >= threshold) caseId |= 4;
      if (v01 >= threshold) caseId |= 8;

      // Skip empty or full cells
      if (caseId === 0 || caseId === 15) continue;

      // Edge midpoints
      const top = getEdgePoint(x, y, v00, x + 1, y, v10);
      const right = getEdgePoint(x + 1, y, v10, x + 1, y + 1, v11);
      const bottom = getEdgePoint(x, y + 1, v01, x + 1, y + 1, v11);
      const left = getEdgePoint(x, y, v00, x, y + 1, v01);

      // Build line segments based on case
      const segments: Point[][] = [];
      switch (caseId) {
        case 1: case 14: segments.push([left, top]); break;
        case 2: case 13: segments.push([top, right]); break;
        case 3: case 12: segments.push([left, right]); break;
        case 4: case 11: segments.push([right, bottom]); break;
        case 5: segments.push([left, top], [right, bottom]); break;
        case 6: case 9: segments.push([top, bottom]); break;
        case 7: case 8: segments.push([left, bottom]); break;
        case 10: segments.push([top, right], [left, bottom]); break;
      }

      segments.forEach(seg => paths.push(seg));
    }
  }

  // Convert segments to SVG path (simplified - just draw all segments)
  if (paths.length === 0) return '';

  const pathStrings = paths.map(seg =>
    `M ${seg[0].x} ${seg[0].y} L ${seg[1].x} ${seg[1].y}`
  );

  return pathStrings.join(' ');
}

// ============================================================================
// 5. Color Palettes (Restrained, Brand-Aligned)
// ============================================================================
interface ColorPalette {
  background: string;
  mid: string;
  high: string;
}

const PALETTES: ColorPalette[] = [
  {
    background: '#1e1b4b', // deep purple
    mid: '#7c3aed',        // purple-600
    high: '#a78bfa'        // purple-400
  },
  {
    background: '#0f172a', // slate-900
    mid: '#6366f1',        // indigo-500
    high: '#818cf8'        // indigo-400
  },
  {
    background: '#1e293b', // slate-800
    mid: '#8b5cf6',        // violet-500
    high: '#c4b5fd'        // violet-300
  },
  {
    background: '#312e81', // indigo-900
    mid: '#ec4899',        // pink-500
    high: '#f9a8d4'        // pink-300
  },
  {
    background: '#1e3a8a', // blue-900
    mid: '#3b82f6',        // blue-500
    high: '#93c5fd'        // blue-300
  }
];

// ============================================================================
// 6. Main Avatar Generation Function
// ============================================================================
export function generateAvatar(userId: number | string, size = 64): string {
  // Create deterministic seed
  const seedString = `${AVATAR_VERSION}:${GLOBAL_SALT}:${userId}`;
  const seed = hashString(seedString);
  const rng = createPRNG(seed);

  // Select palette deterministically
  const paletteIndex = Math.floor(rng() * PALETTES.length);
  const palette = PALETTES[paletteIndex];

  // Generate thresholds
  const t1 = 0.40 + rng() * 0.12; // [0.40, 0.52]
  const t2 = Math.max(t1 + 0.12, 0.58 + rng() * 0.12); // [0.58, 0.70], ensure gap

  // Generate scalar field
  const field = generateValueNoise(size, size, rng, 3, 0.6);

  // Create filled regions approach:
  // Fill all cells based on their band
  let lowBandPath = '';
  let midBandPath = '';
  let highBandPath = '';

  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const value = field[y][x];

      // Determine which band this cell belongs to
      if (value >= t2) {
        // High band
        highBandPath += `M ${x} ${y} h 1 v 1 h -1 Z `;
      } else if (value >= t1) {
        // Mid band
        midBandPath += `M ${x} ${y} h 1 v 1 h -1 Z `;
      } else {
        // Low band (background)
        lowBandPath += `M ${x} ${y} h 1 v 1 h -1 Z `;
      }
    }
  }

  // Generate SVG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="100%" height="100%">
  <defs>
    <clipPath id="circle-clip-${userId}">
      <circle cx="${size/2}" cy="${size/2}" r="${size/2}"/>
    </clipPath>
  </defs>
  <g clip-path="url(#circle-clip-${userId})">
    <rect width="${size}" height="${size}" fill="${palette.background}"/>
    ${midBandPath ? `<path d="${midBandPath}" fill="${palette.mid}" fill-rule="evenodd"/>` : ''}
    ${highBandPath ? `<path d="${highBandPath}" fill="${palette.high}" fill-rule="evenodd"/>` : ''}
  </g>
</svg>`;

  return svg;
}

// ============================================================================
// 7. Data URL Helper
// ============================================================================
export function generateAvatarDataURL(userId: number | string, size = 64): string {
  const svg = generateAvatar(userId, size);
  const encoded = encodeURIComponent(svg)
    .replace(/'/g, '%27')
    .replace(/"/g, '%22');
  return `data:image/svg+xml,${encoded}`;
}

// ============================================================================
// 8. Caching Layer
// ============================================================================
const avatarCache = new Map<string, string>();
const MAX_CACHE_SIZE = 5000;

export function getCachedAvatar(userId: number | string, size = 64): string {
  const cacheKey = `${userId}:${size}`;

  if (avatarCache.has(cacheKey)) {
    return avatarCache.get(cacheKey)!;
  }

  const dataURL = generateAvatarDataURL(userId, size);

  // LRU eviction: if cache is full, delete oldest entry
  if (avatarCache.size >= MAX_CACHE_SIZE) {
    const firstKey = avatarCache.keys().next().value;
    avatarCache.delete(firstKey);
  }

  avatarCache.set(cacheKey, dataURL);
  return dataURL;
}
