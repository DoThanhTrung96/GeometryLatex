// Coordinate Transformation Service
// Transforms image coordinates (0-100, Y-down) to TikZ coordinates (Y-up, scaled)

import type { GeometryData, Vertex, Edge, Annotation, ShapeElement } from '../types';

/**
 * Configuration for coordinate transformation
 */
export interface TransformConfig {
  scale: number;           // Division factor (default: 20 → 0-5 range)
  invertY: boolean;        // Invert Y axis for TikZ (default: true)
  maxCoord: number;        // Maximum input coordinate (default: 100)
  precision: number;       // Decimal places to round to (default: 2)
}

const DEFAULT_CONFIG: TransformConfig = {
  scale: 20,
  invertY: true,
  maxCoord: 100,
  precision: 2
};

/**
 * Transform a single coordinate value
 */
function transformValue(value: number, config: TransformConfig, isY: boolean = false): number {
  let result = value;
  
  // Invert Y if needed (image Y=0 is top, TikZ Y=0 is bottom)
  if (isY && config.invertY) {
    result = config.maxCoord - result;
  }
  
  // Scale down
  result = result / config.scale;
  
  // Round to precision
  return Number(result.toFixed(config.precision));
}

/**
 * Transform a vertex to TikZ coordinates
 */
export function transformVertex(vertex: Vertex, config: Partial<TransformConfig> = {}): Vertex {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  return {
    ...vertex,
    x: transformValue(vertex.x, cfg, false),
    y: transformValue(vertex.y, cfg, true),
    // Keep z if present
    z: vertex.z !== undefined ? transformValue(vertex.z, cfg, false) : undefined
  };
}

/**
 * Transform all vertices in geometry data
 */
export function transformVertices(vertices: Vertex[], config: Partial<TransformConfig> = {}): Vertex[] {
  return vertices.map(v => transformVertex(v, config));
}

/**
 * Calculate sphere/circle radius from center and vertices on surface
 */
export function calculateRadius(
  center: Vertex, 
  surfaceVertices: Vertex[],
  config: Partial<TransformConfig> = {}
): number {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Transform center
  const tcx = transformValue(center.x, cfg, false);
  const tcy = transformValue(center.y, cfg, true);
  
  // Calculate distances from center to each surface vertex
  const distances = surfaceVertices.map(v => {
    const tvx = transformValue(v.x, cfg, false);
    const tvy = transformValue(v.y, cfg, true);
    return Math.sqrt((tvx - tcx) ** 2 + (tvy - tcy) ** 2);
  });
  
  // Return average radius (they should all be similar for a sphere)
  const avgRadius = distances.reduce((a, b) => a + b, 0) / distances.length;
  return Number(avgRadius.toFixed(cfg.precision));
}

/**
 * Calculate ellipse dimensions for 3D sphere projection
 * Returns { rx, ry } for horizontal and vertical radii
 */
export function calculateEllipseDimensions(
  center: Vertex,
  surfaceVertices: Vertex[],
  config: Partial<TransformConfig> = {}
): { rx: number; ry: number } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  const tcx = transformValue(center.x, cfg, false);
  const tcy = transformValue(center.y, cfg, true);
  
  // Find max horizontal and vertical distances
  let maxHorizontal = 0;
  let maxVertical = 0;
  
  surfaceVertices.forEach(v => {
    const tvx = transformValue(v.x, cfg, false);
    const tvy = transformValue(v.y, cfg, true);
    
    const hDist = Math.abs(tvx - tcx);
    const vDist = Math.abs(tvy - tcy);
    
    if (hDist > maxHorizontal) maxHorizontal = hDist;
    if (vDist > maxVertical) maxVertical = vDist;
  });
  
  // Add small padding (10%)
  return {
    rx: Number((maxHorizontal * 1.1).toFixed(cfg.precision)),
    ry: Number((maxVertical * 1.1).toFixed(cfg.precision))
  };
}

/**
 * Transform complete GeometryData to TikZ-ready coordinates
 */
export function transformGeometryData(
  data: GeometryData, 
  config: Partial<TransformConfig> = {}
): GeometryData {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  
  // Transform vertices
  const transformedVertices = transformVertices(data.vertices, cfg);
  
  // Calculate sphere dimensions if shapes include sphere
  let enhancedShapes = data.shapes;
  if (data.shapes) {
    enhancedShapes = data.shapes.map(shape => {
      if (shape.type === 'sphere' || shape.type === 'circle') {
        const centerVertex = data.vertices.find(v => v.label === shape.center);
        const surfaceVertices = data.vertices.filter(v => 
          shape.vertices?.includes(v.label) && v.label !== shape.center
        );
        
        if (centerVertex && surfaceVertices.length > 0) {
          const { rx, ry } = calculateEllipseDimensions(centerVertex, surfaceVertices, cfg);
          const radius = calculateRadius(centerVertex, surfaceVertices, cfg);
          
          return {
            ...shape,
            radius: radius.toString(),
            // Store ellipse dimensions as custom property
            _ellipseRx: rx,
            _ellipseRy: ry
          } as ShapeElement & { _ellipseRx?: number; _ellipseRy?: number };
        }
      }
      return shape;
    });
  }
  
  return {
    ...data,
    vertices: transformedVertices,
    shapes: enhancedShapes,
    // Mark as transformed
    _coordinatesTransformed: true,
    _transformConfig: cfg
  } as GeometryData & { _coordinatesTransformed?: boolean; _transformConfig?: TransformConfig };
}

/**
 * Generate TikZ coordinate definitions from transformed vertices
 */
export function generateTikZCoordinates(vertices: Vertex[]): string {
  return vertices.map(v => {
    const comment = v.spatialRelation ? ` % ${v.spatialRelation}` : '';
    return `  \\coordinate (${v.label}) at (${v.x}, ${v.y});${comment}`;
  }).join('\n');
}

/**
 * Get sphere drawing command from shape data
 */
export function generateSphereCommand(
  shape: ShapeElement & { _ellipseRx?: number; _ellipseRy?: number },
  fillColor: string = 'orange!70'
): string {
  const rx = shape._ellipseRx || 2;
  const ry = shape._ellipseRy || 2;
  const center = shape.center || 'O';
  
  return `  % ${shape.geometricDescription || 'Sphere'}
  \\shade[ball color=${fillColor}, opacity=0.6] (${center}) ellipse (${rx}cm and ${ry}cm);
  \\draw[orange!80!brown, opacity=0.7, line width=0.8pt] (${center}) ellipse (${rx}cm and ${ry}cm);`;
}
