declare module 'd3-delaunay' {
  export class Delaunay<P = [number, number]> {
    static from(points: ArrayLike<P>, fx?: (p: P) => number, fy?: (p: P) => number, that?: any): Delaunay<P>;
    points: Float64Array;
    halfedges: Int32Array;
    hull: Uint32Array;
    triangles: Uint32Array;
    inedges: Int32Array;
    find(x: number, y: number, i?: number): number;
    neighbors(i: number): IterableIterator<number>;
    render(context?: any): any;
    renderHull(context?: any): any;
    renderTriangle(i: number, context?: any): any;
    renderPoints(context?: any, r?: number): any;
    trianglePolygons(): IterableIterator<[[number, number], [number, number], [number, number]]>;
    trianglePolygon(i: number): [[number, number], [number, number], [number, number]];
    update(): this;
    voronoi(bounds?: [number, number, number, number]): Voronoi<P>;
  }

  export class Voronoi<P = [number, number]> {
    delaunay: Delaunay<P>;
    circumcenters: Float64Array;
    vectors: Float64Array;
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    contains(i: number, x: number, y: number): boolean;
    neighbors(i: number): IterableIterator<number>;
    render(context?: any): any;
    renderBounds(context?: any): any;
    renderCell(i: number, context?: any): any;
    cellPolygons(): IterableIterator<Array<[number, number]>>;
    cellPolygon(i: number): Array<[number, number]> | null;
    update(): this;
  }
}
