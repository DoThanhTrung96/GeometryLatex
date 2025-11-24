// FR-5: LaTeX Template System
// Template-based TikZ code generation for different geometry types

import type { GeometryData, Edge, Angle, Annotation } from '../types';

export interface LatexTemplate {
  name: string;
  documentClass: string;
  packages: string[];
  tikzLibraries: string[];
  scale: number;
  structure: string;
}

/**
 * Base template for all geometry types
 */
const BASE_TEMPLATE: LatexTemplate = {
  name: 'base',
  documentClass: '\\documentclass[border=2mm]{standalone}',
  packages: ['tikz', 'amsmath'],
  tikzLibraries: ['angles', 'quotes', 'calc', 'arrows.meta', 'patterns', 'decorations.markings'],
  scale: 0.05,
  structure: `
% === COORDINATES ===
{{COORDINATES}}

% === EDGES ===
{{EDGES}}

% === ANGLES ===
{{ANGLES}}

% === ANNOTATIONS ===
{{ANNOTATIONS}}
`
};

/**
 * Triangle-specific template
 */
const TRIANGLE_TEMPLATE: LatexTemplate = {
  ...BASE_TEMPLATE,
  name: 'triangle',
  structure: `
% Triangle with vertices and angles

% === COORDINATES ===
{{COORDINATES}}

% === EDGES ===
{{EDGES}}

% === ANGLES ===
{{ANGLES}}

% === LABELS ===
{{ANNOTATIONS}}
`
};

/**
 * Circle-specific template
 */
const CIRCLE_TEMPLATE: LatexTemplate = {
  ...BASE_TEMPLATE,
  name: 'circle',
  structure: `
% Circle with center and radius

% === CENTER POINT ===
{{COORDINATES}}

% === CIRCLE ===
{{CIRCLE}}

% === ANNOTATIONS ===
{{ANNOTATIONS}}
`
};

/**
 * Polygon-specific template
 */
const POLYGON_TEMPLATE: LatexTemplate = {
  ...BASE_TEMPLATE,
  name: 'polygon',
  structure: `
% Polygon with multiple vertices

% === COORDINATES ===
{{COORDINATES}}

% === EDGES ===
{{EDGES}}

% === ANGLES ===
{{ANGLES}}

% === ANNOTATIONS ===
{{ANNOTATIONS}}
`
};

/**
 * Composite template for complex figures
 */
const COMPOSITE_TEMPLATE: LatexTemplate = {
  ...BASE_TEMPLATE,
  name: 'composite',
  tikzLibraries: [...BASE_TEMPLATE.tikzLibraries, 'shapes.geometric', '3d'],
  structure: `
% Complex composite figure

% === COORDINATES ===
{{COORDINATES}}

% === EDGES AND SHAPES ===
{{EDGES}}

% === ANGLES ===
{{ANGLES}}

% === ANNOTATIONS ===
{{ANNOTATIONS}}

% === SPECIAL FEATURES ===
{{SPECIAL}}
`
};

/**
 * Selects appropriate template based on figure type
 */
export function selectTemplate(figureType: string): LatexTemplate {
  switch (figureType.toLowerCase()) {
    case 'triangle':
      return TRIANGLE_TEMPLATE;
    case 'circle':
      return CIRCLE_TEMPLATE;
    case 'polygon':
      return POLYGON_TEMPLATE;
    case 'composite':
    case '3d-shape':
      return COMPOSITE_TEMPLATE;
    default:
      return BASE_TEMPLATE;
  }
}

/**
 * Fills template with geometry data
 */
export function fillTemplate(template: LatexTemplate, geometryData: GeometryData): string {
  let code = '';
  
  // Document preamble
  code += template.documentClass + '\n';
  template.packages.forEach(pkg => {
    code += `\\usepackage{${pkg}}\n`;
  });
  code += `\\usetikzlibrary{${template.tikzLibraries.join(', ')}}\n\n`;
  
  code += '\\begin{document}\n';
  code += `\\begin{tikzpicture}[scale=${template.scale}]\n\n`;
  
  // Generate sections
  const coordinates = generateCoordinates(geometryData.vertices);
  const edges = generateEdges(geometryData.edges || geometryData.lines || []);
  const angles = generateAngles(geometryData.angles || []);
  const annotations = generateAnnotations(geometryData.annotations || []);
  
  // Fill structure
  let structure = template.structure;
  structure = structure.replace('{{COORDINATES}}', coordinates);
  structure = structure.replace('{{EDGES}}', edges);
  structure = structure.replace('{{ANGLES}}', angles);
  structure = structure.replace('{{ANNOTATIONS}}', annotations);
  structure = structure.replace('{{CIRCLE}}', '');  // TODO: Handle circles
  structure = structure.replace('{{SPECIAL}}', '');  // TODO: Handle special features
  
  code += structure;
  
  code += '\n\\end{tikzpicture}\n';
  code += '\\end{document}\n';
  
  return code;
}

/**
 * Generates coordinate definitions
 */
function generateCoordinates(vertices: Array<{ label: string; x: number; y: number }>): string {
  if (!vertices || vertices.length === 0) {
    return '% No vertices defined\n';
  }
  
  let code = '';
  vertices.forEach(v => {
    code += `\\coordinate (${v.label}) at (${v.x}, ${v.y});\n`;
  });
  return code;
}

/**
 * Generates edge drawing commands
 */
function generateEdges(edges: Array<Edge | { from: string; to: string; style: string }>): string {
  if (!edges || edges.length === 0) {
    return '% No edges defined\n';
  }
  
  let code = '';
  edges.forEach(edge => {
    const style = mapEdgeStyle(edge.style);
    const label = 'label' in edge && edge.label ? `node[midway, above] {$${edge.label}$}` : '';
    code += `\\draw${style} (${edge.from}) -- (${edge.to}) ${label};\n`;
  });
  return code;
}

/**
 * Maps edge style to TikZ options
 */
function mapEdgeStyle(style: string): string {
  switch (style) {
    case 'dashed':
      return '[dashed, dash pattern=on 3pt off 2pt]';
    case 'dotted':
      return '[dotted]';
    case 'thick':
      return '[thick]';
    case 'double':
      return '[double]';
    case 'solid':
    default:
      return '';
  }
}

/**
 * Generates angle marker commands
 */
function generateAngles(angles: Angle[]): string {
  if (!angles || angles.length === 0) {
    return '% No angles defined\n';
  }
  
  let code = '';
  angles.forEach(angle => {
    const [arm1, arm2] = angle.arms;
    const measure = angle.measure ? `, "$${angle.measure}$"` : '';
    
    if (angle.marker === 'right-angle') {
      code += `\\pic [draw, angle radius=3mm] {right angle = ${arm1}--${angle.vertex}--${arm2}};\n`;
    } else if (angle.marker === 'arc' || angle.marker === 'double-arc') {
      const radius = angle.marker === 'double-arc' ? '5mm' : '4mm';
      code += `\\pic [draw, angle radius=${radius}${measure}] {angle = ${arm1}--${angle.vertex}--${arm2}};\n`;
    }
  });
  return code;
}

/**
 * Generates annotation commands
 */
function generateAnnotations(annotations: Annotation[]): string {
  if (!annotations || annotations.length === 0) {
    return '% No annotations\n';
  }
  
  let code = '';
  annotations.forEach(ann => {
    const pos = Array.isArray(ann.position) 
      ? `(${ann.position[0]}, ${ann.position[1]})` 
      : ann.position;
    
    switch (ann.type) {
      case 'perpendicular':
        code += `\\node at ${pos} {$\\perp$};\n`;
        break;
      case 'parallel':
        code += `\\node at ${pos} {$\\parallel$};\n`;
        break;
      case 'congruent':
        code += `\\node at ${pos} {$\\cong$};\n`;
        break;
      case 'midpoint':
        code += `\\node at ${pos} {$\\cdot$};\n`;
        break;
      case 'text':
        const content = ann.content || ann.label || '';
        code += `\\node at ${pos} {${content}};\n`;
        break;
      default:
        if (ann.label || ann.content) {
          const text = ann.content || ann.label || '';
          code += `\\node at ${pos} {${text}};\n`;
        }
    }
  });
  return code;
}

/**
 * Validates generated LaTeX code for common errors
 */
export function validateLatexCode(code: string): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for required document structure
  if (!code.includes('\\documentclass')) {
    errors.push('Missing \\documentclass');
  }
  if (!code.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document}');
  }
  if (!code.includes('\\end{document}')) {
    errors.push('Missing \\end{document}');
  }
  if (!code.includes('\\begin{tikzpicture}')) {
    errors.push('Missing \\begin{tikzpicture}');
  }
  
  // Check for required packages
  if (!code.includes('\\usepackage{tikz}')) {
    errors.push('Missing \\usepackage{tikz}');
  }
  
  // Check for coordinate definitions before usage
  const coordinateMatches = code.match(/\\coordinate\s*\((\w+)\)/g);
  const usageMatches = code.match(/\((\w+)\)/g);
  
  if (coordinateMatches && usageMatches) {
    const definedCoords = new Set(
      coordinateMatches.map(m => m.match(/\((\w+)\)/)?.[1]).filter(Boolean)
    );
    const usedCoords = usageMatches
      .map(m => m.match(/\((\w+)\)/)?.[1])
      .filter(c => c && !/^\d+$/.test(c));  // Exclude numeric coordinates
    
    usedCoords.forEach(coord => {
      if (coord && !definedCoords.has(coord)) {
        errors.push(`Undefined coordinate: ${coord}`);
      }
    });
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
