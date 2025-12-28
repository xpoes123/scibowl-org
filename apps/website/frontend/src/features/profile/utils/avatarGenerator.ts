import { Delaunay } from 'd3-delaunay';

// ============================================================================
// CONSTANTS
// ============================================================================

const AVATAR_VERSION = 1;
const AVATAR_SALT = 'nsb-arena-avatar-v1';

// Restrained color palettes (4 colors each for graph coloring: darkest, dark, mid, light)
// Dark theme matching the site's purple/slate aesthetic
// Named after advanced science terms
const PALETTES = [
  { name: 'Voronoi', colors: ['#0f172a', '#1e293b', '#7c3aed', '#a78bfa'] },
  { name: 'Matrix', colors: ['#1e293b', '#334155', '#8b5cf6', '#c4b5fd'] },
  { name: 'Auger', colors: ['#0f172a', '#1e293b', '#6366f1', '#a5b4fc'] },
  { name: 'Benzene', colors: ['#0c0a09', '#0f172a', '#7c3aed', '#c084fc'] },
  { name: 'Supernova', colors: ['#1e1b4b', '#312e81', '#8b5cf6', '#a78bfa'] },
  { name: 'Azeotrope', colors: ['#1e1b4b', '#312e81', '#a78bfa', '#c4b5fd'] },
  { name: 'Lagrange', colors: ['#0f172a', '#1e293b', '#6366f1', '#818cf8'] },
  { name: 'Fourier', colors: ['#1e293b', '#334155', '#7c3aed', '#a855f7'] },
  { name: 'Quantum', colors: ['#0c0a09', '#0f172a', '#8b5cf6', '#a78bfa'] },
  { name: 'Heisenberg', colors: ['#1e1b4b', '#1e293b', '#6366f1', '#818cf8'] },
];

// Cache for generated avatars
const avatarCache = new Map<string, string>();
const MAX_CACHE_SIZE = 5000;

// ============================================================================
// HASH AND PRNG
// ============================================================================

/**
 * cyrb53 hash - simple, fast, deterministic 53-bit hash
 */
function hashStringToUint32(str: string): number {
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

/**
 * mulberry32 PRNG - simple, fast, deterministic random number generator
 */
function createPRNG(seed: number) {
  return function() {
    seed |= 0;
    seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ============================================================================
// GEOMETRY HELPERS
// ============================================================================

interface Point {
  x: number;
  y: number;
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate polygon area using shoelace formula
 */
function polygonArea(points: number[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 2) {
    const j = (i + 2) % points.length;
    area += points[i] * points[j + 1];
    area -= points[j] * points[i + 1];
  }
  return Math.abs(area) / 2;
}

/**
 * Calculate polygon centroid
 */
function polygonCentroid(points: number[]): Point {
  let cx = 0;
  let cy = 0;
  const numPoints = points.length / 2;

  for (let i = 0; i < points.length; i += 2) {
    cx += points[i];
    cy += points[i + 1];
  }

  return { x: cx / numPoints, y: cy / numPoints };
}

/**
 * Clamp value to bounds
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ============================================================================
// SITE GENERATION
// ============================================================================

/**
 * Generate sites using jittered grid to prevent clustering and slivers
 */
function generateSites(seed: number): Point[] {
  const rng = createPRNG(seed);

  // Number of sites: 10-16
  const k = 10 + Math.floor(rng() * 7);

  // Create jittered grid
  const g = Math.ceil(Math.sqrt(k));
  const cellSize = 100 / g;
  const jitterRange = cellSize * 0.25;

  const sites: Point[] = [];

  for (let i = 0; i < k; i++) {
    const row = Math.floor(i / g);
    const col = i % g;

    // Base point at cell center
    const baseX = col * cellSize + cellSize / 2;
    const baseY = row * cellSize + cellSize / 2;

    // Add jitter
    const jx = (rng() - 0.5) * 2 * jitterRange;
    const jy = (rng() - 0.5) * 2 * jitterRange;

    sites.push({
      x: clamp(baseX + jx, 2, 98),
      y: clamp(baseY + jy, 2, 98)
    });
  }

  return sites;
}

/**
 * Enforce minimum separation between points
 */
function enforceMinimumSeparation(sites: Point[], minDist: number = 6): void {
  for (let i = 0; i < sites.length; i++) {
    for (let j = i + 1; j < sites.length; j++) {
      const dist = distance(sites[i], sites[j]);

      if (dist < minDist) {
        // Push point j away from point i
        const dx = sites[j].x - sites[i].x;
        const dy = sites[j].y - sites[i].y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;

        const pushDist = minDist - dist;
        sites[j].x += (dx / len) * pushDist;
        sites[j].y += (dy / len) * pushDist;

        // Clamp to bounds
        sites[j].x = clamp(sites[j].x, 2, 98);
        sites[j].y = clamp(sites[j].y, 2, 98);
      }
    }
  }
}

/**
 * Lloyd relaxation - replace each site with centroid of its cell
 */
function lloydRelaxation(sites: Point[], iterations: number = 1): Point[] {
  let currentSites = sites.map(p => ({ ...p }));

  for (let iter = 0; iter < iterations; iter++) {
    const points = currentSites.flatMap(p => [p.x, p.y]);
    const delaunay = Delaunay.from(points.map((_, i) => i % 2 === 0 ? [points[i], points[i + 1]] : []).filter(p => p.length));
    const voronoi = delaunay.voronoi([0, 0, 100, 100]);

    const newSites: Point[] = [];

    for (let i = 0; i < currentSites.length; i++) {
      const cell = voronoi.cellPolygon(i);

      if (cell) {
        const centroid = polygonCentroid(cell.flat());
        newSites.push({
          x: clamp(centroid.x, 2, 98),
          y: clamp(centroid.y, 2, 98)
        });
      } else {
        newSites.push({ ...currentSites[i] });
      }
    }

    currentSites = newSites;
  }

  return currentSites;
}

// ============================================================================
// VORONOI COMPUTATION
// ============================================================================

interface VoronoiCell {
  polygon: number[];
  area: number;
  centroid: Point;
  index: number;
}

/**
 * Compute Voronoi polygons using d3-delaunay
 */
function computeVoronoiPolygons(sites: Point[]): VoronoiCell[] {
  const delaunay = Delaunay.from(sites.map(p => [p.x, p.y]));
  const voronoi = delaunay.voronoi([0, 0, 100, 100]);

  const cells: VoronoiCell[] = [];

  for (let i = 0; i < sites.length; i++) {
    const polygon = voronoi.cellPolygon(i);

    if (polygon) {
      const flatPolygon = polygon.flat();
      const area = polygonArea(flatPolygon);
      const centroid = polygonCentroid(flatPolygon);

      cells.push({
        polygon: flatPolygon,
        area,
        centroid,
        index: i
      });
    }
  }

  // Sort deterministically: area DESC, then centroid.x ASC, then centroid.y ASC
  cells.sort((a, b) => {
    if (Math.abs(a.area - b.area) > 0.001) {
      return b.area - a.area;
    }
    if (Math.abs(a.centroid.x - b.centroid.x) > 0.001) {
      return a.centroid.x - b.centroid.x;
    }
    return a.centroid.y - b.centroid.y;
  });

  return cells;
}

// ============================================================================
// SVG GENERATION
// ============================================================================

/**
 * Find adjacent cells (cells that share an edge)
 */
function findAdjacencies(cells: VoronoiCell[]): Map<number, Set<number>> {
  const adjacencies = new Map<number, Set<number>>();

  // Initialize adjacency sets
  for (let i = 0; i < cells.length; i++) {
    adjacencies.set(i, new Set<number>());
  }

  // Check all pairs of cells for shared edges
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) {
      if (cellsAreAdjacent(cells[i], cells[j])) {
        adjacencies.get(i)!.add(j);
        adjacencies.get(j)!.add(i);
      }
    }
  }

  return adjacencies;
}

/**
 * Check if two cells share an edge (are adjacent)
 */
function cellsAreAdjacent(cell1: VoronoiCell, cell2: VoronoiCell): boolean {
  const poly1 = cell1.polygon;
  const poly2 = cell2.polygon;

  let sharedVertices = 0;

  for (let i = 0; i < poly1.length; i += 2) {
    const x1 = poly1[i];
    const y1 = poly1[i + 1];

    for (let j = 0; j < poly2.length; j += 2) {
      const x2 = poly2[j];
      const y2 = poly2[j + 1];

      // Check if vertices are the same (within floating point tolerance)
      if (Math.abs(x1 - x2) < 0.01 && Math.abs(y1 - y2) < 0.01) {
        sharedVertices++;
        if (sharedVertices >= 2) {
          return true; // Share an edge
        }
      }
    }
  }

  return false;
}

/**
 * Greedy graph coloring algorithm to ensure no adjacent cells have the same color
 */
function assignColors(cells: VoronoiCell[], numColors: number): number[] {
  const adjacencies = findAdjacencies(cells);
  const colors = new Array(cells.length).fill(-1);

  // Color cells in order (already sorted by area)
  for (let i = 0; i < cells.length; i++) {
    const neighbors = adjacencies.get(i)!;
    const usedColors = new Set<number>();

    // Find colors used by neighbors
    for (const neighbor of neighbors) {
      if (colors[neighbor] !== -1) {
        usedColors.add(colors[neighbor]);
      }
    }

    // Assign the first available color
    for (let c = 0; c < numColors; c++) {
      if (!usedColors.has(c)) {
        colors[i] = c;
        break;
      }
    }

    // Fallback if all colors are used (shouldn't happen with 4 colors for planar graphs)
    if (colors[i] === -1) {
      colors[i] = 0;
    }
  }

  return colors;
}

/**
 * Build SVG string from Voronoi cells
 */
function buildSvg(cells: VoronoiCell[], palette: typeof PALETTES[0], hash: number): string {
  const clipId = `clip-${hash}`;
  const colors = palette.colors;

  // Assign colors using graph coloring
  const cellColors = assignColors(cells, colors.length);

  let paths = '';

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    const colorIndex = cellColors[i];
    const color = colors[colorIndex];

    // Build path data
    const pathData = cell.polygon.reduce((acc, val, idx) => {
      if (idx % 2 === 0) {
        const x = val;
        const y = cell.polygon[idx + 1];
        return acc + (idx === 0 ? `M${x},${y}` : `L${x},${y}`);
      }
      return acc;
    }, '') + 'Z';

    // No stroke to avoid white lines between polygons
    paths += `<path d="${pathData}" fill="${color}" stroke="none" />`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <clipPath id="${clipId}">
      <circle cx="50" cy="50" r="50" />
    </clipPath>
  </defs>
  <rect width="100" height="100" fill="${colors[0]}" />
  <g clip-path="url(#${clipId})" shape-rendering="crispEdges">
    ${paths}
  </g>
</svg>`;
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Generate a deterministic SVG avatar from a username
 */
export function generateAvatarSvg(username: string): string {
  const normalizedUsername = username.toLowerCase().trim();
  const cacheKey = `${AVATAR_VERSION}:${normalizedUsername}`;

  // Check cache
  if (avatarCache.has(cacheKey)) {
    return avatarCache.get(cacheKey)!;
  }

  // Clear cache if too large
  if (avatarCache.size >= MAX_CACHE_SIZE) {
    avatarCache.clear();
  }

  // Generate seed
  const seedStr = `${AVATAR_VERSION}:${AVATAR_SALT}:${normalizedUsername}`;
  const hash = hashStringToUint32(seedStr);

  // Select palette
  const paletteIndex = hash % PALETTES.length;
  const palette = PALETTES[paletteIndex];

  // Generate sites
  let sites = generateSites(hash);

  // Enforce minimum separation
  enforceMinimumSeparation(sites, 6);

  // Apply Lloyd relaxation
  sites = lloydRelaxation(sites, 1);

  // Compute Voronoi cells
  const cells = computeVoronoiPolygons(sites);

  // Build SVG
  const svg = buildSvg(cells, palette, hash);

  // Cache and return
  avatarCache.set(cacheKey, svg);
  return svg;
}

/**
 * Generate a data URI for the avatar SVG
 */
export function avatarDataUri(username: string): string {
  const svg = generateAvatarSvg(username);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Get cached avatar data URI (with size parameter for compatibility)
 * Note: SVGs scale perfectly, so size is informational only
 */
export function getCachedAvatar(username: string, _size?: number): string {
  return avatarDataUri(username);
}

/**
 * Sample usernames for previewing different avatar styles
 * Using advanced science terminology
 */
export const SAMPLE_USERNAMES = [
  'Voronoi',
  'Matrix',
  'Auger',
  'Benzene',
  'Supernova',
  'Azeotrope',
  'Lagrange',
  'Fourier',
  'Quantum',
  'Heisenberg',
];
