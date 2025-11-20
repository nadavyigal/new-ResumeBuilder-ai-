/**
 * Field Path Resolver - Navigate and modify nested resume data structures
 *
 * Handles JSON paths like:
 * - Simple: "summary"
 * - Nested: "contact.email"
 * - Array: "experiences[0].title"
 * - Latest: "experiences[latest].title"
 *
 * @module lib/resume/field-path-resolver
 */

/**
 * Path segment types
 */
export type PathSegment =
  | { type: 'property'; key: string }
  | { type: 'index'; index: number }
  | { type: 'latest'; index: number }; // Latest always resolves to 0 (most recent)

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  suggestions?: string[];
}

/**
 * Parse a field path string into structured segments
 *
 * @param path - Field path (e.g., "experiences[0].title")
 * @returns Array of path segments
 * @throws Error if path syntax is invalid
 *
 * @example
 * parseFieldPath("experiences[0].title")
 * // Returns: [
 * //   { type: 'property', key: 'experiences' },
 * //   { type: 'index', index: 0 },
 * //   { type: 'property', key: 'title' }
 * // ]
 */
export function parseFieldPath(path: string): PathSegment[] {
  if (!path || path.trim() === '') {
    throw new Error('Field path cannot be empty');
  }

  const trimmedPath = path.trim();
  const segments: PathSegment[] = [];

  // Split by dots, but preserve array brackets
  const parts = trimmedPath.split(/\.(?![^\[]*\])/);

  for (const part of parts) {
    // Check if part contains array index
    const arrayMatch = part.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\[(.+?)\]$/);

    if (arrayMatch) {
      const [, propertyName, indexStr] = arrayMatch;

      // Add property segment
      segments.push({ type: 'property', key: propertyName });

      // Handle array index
      if (indexStr === 'latest') {
        segments.push({ type: 'latest', index: 0 });
      } else {
        const index = parseInt(indexStr, 10);
        if (isNaN(index) || index < 0) {
          throw new Error(`Invalid array index: ${indexStr}`);
        }
        segments.push({ type: 'index', index });
      }
    } else if (part.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
      // Simple property
      segments.push({ type: 'property', key: part });
    } else if (part.includes('[') || part.includes(']')) {
      // Malformed array syntax
      throw new Error(`Invalid path syntax: ${part}`);
    } else {
      throw new Error(`Invalid path segment: ${part}`);
    }
  }

  return segments;
}

/**
 * Get value from resume data using field path
 *
 * @param data - Resume data object
 * @param path - Field path string
 * @returns Field value or undefined if not found
 *
 * @example
 * getFieldValue(resume, "experiences[0].title")
 * // Returns: "Software Engineer"
 */
export function getFieldValue(data: any, path: string): any {
  try {
    const segments = parseFieldPath(path);
    let current = data;

    for (const segment of segments) {
      if (current === null || current === undefined) {
        return undefined;
      }

      if (segment.type === 'property') {
        current = current[segment.key];
      } else if (segment.type === 'index' || segment.type === 'latest') {
        if (!Array.isArray(current)) {
          return undefined;
        }
        if (segment.index >= current.length) {
          return undefined;
        }
        current = current[segment.index];
      }
    }

    return current;
  } catch (error) {
    return undefined;
  }
}

/**
 * Set value in resume data using field path
 *
 * Creates a deep copy with the modification. Does not mutate original.
 *
 * @param data - Resume data object
 * @param path - Field path string
 * @param value - New value to set
 * @returns Modified copy of data
 * @throws Error if path is invalid or index out of bounds
 *
 * @example
 * setFieldValue(resume, "experiences[0].title", "Senior Engineer")
 * // Returns: resume copy with updated title
 */
export function setFieldValue(data: any, path: string, value: any): any {
  if (!path || path.trim() === '') {
    throw new Error('Field path cannot be empty');
  }

  const segments = parseFieldPath(path);

  // Deep clone the data to avoid mutations
  const result = JSON.parse(JSON.stringify(data));

  // Navigate to parent of target field
  let current = result;
  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i];

    if (segment.type === 'property') {
      // Create intermediate object if it doesn't exist
      if (!current[segment.key]) {
        // Check next segment to determine if we need array or object
        const nextSegment = segments[i + 1];
        if (nextSegment.type === 'index' || nextSegment.type === 'latest') {
          current[segment.key] = [];
        } else {
          current[segment.key] = {};
        }
      }
      current = current[segment.key];
    } else if (segment.type === 'index' || segment.type === 'latest') {
      if (!Array.isArray(current)) {
        throw new Error(`Cannot access array index on non-array field`);
      }
      if (segment.index >= current.length) {
        throw new Error(`Array index out of bounds: ${segment.index}`);
      }
      current = current[segment.index];
    }
  }

  // Set the final value
  const lastSegment = segments[segments.length - 1];
  if (lastSegment.type === 'property') {
    current[lastSegment.key] = value;
  } else if (lastSegment.type === 'index' || lastSegment.type === 'latest') {
    if (!Array.isArray(current)) {
      throw new Error(`Cannot set array index on non-array field`);
    }
    if (lastSegment.index >= current.length) {
      throw new Error(`Array index out of bounds: ${lastSegment.index}`);
    }
    current[lastSegment.index] = value;
  }

  return result;
}

/**
 * Validate field path against resume schema
 *
 * @param path - Field path to validate
 * @param schema - Resume schema definition
 * @returns Validation result with error message and suggestions
 *
 * @example
 * validateFieldPath("contact.email", resumeSchema)
 * // Returns: { valid: true }
 *
 * validateFieldPath("contact.emial", resumeSchema)
 * // Returns: { valid: false, error: "Field 'emial' not found", suggestions: ["email"] }
 */
export function validateFieldPath(path: string, schema: any): ValidationResult {
  try {
    const segments = parseFieldPath(path);
    let currentSchema = schema;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      if (segment.type === 'property') {
        // Check if property exists in schema
        if (!currentSchema || typeof currentSchema !== 'object') {
          return {
            valid: false,
            error: `Cannot access property '${segment.key}' on non-object`,
          };
        }

        if (!(segment.key in currentSchema)) {
          // Try to find similar field names (typo detection)
          const suggestions = Object.keys(currentSchema).filter(key =>
            levenshteinDistance(key, segment.key) <= 2
          );

          return {
            valid: false,
            error: `Field '${segment.key}' not found in schema`,
            suggestions: suggestions.length > 0 ? suggestions : undefined,
          };
        }

        currentSchema = currentSchema[segment.key];
      } else if (segment.type === 'index' || segment.type === 'latest') {
        // Check if current schema is array
        if (!Array.isArray(currentSchema)) {
          return {
            valid: false,
            error: `Cannot use array index on non-array field`,
          };
        }

        // Get array element schema (first element defines schema for all)
        currentSchema = currentSchema[0];
      }
    }

    return { valid: true };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : 'Invalid path syntax',
    };
  }
}

/**
 * Check if a path points to an array field
 *
 * @param data - Resume data
 * @param path - Field path (without array index)
 * @returns True if field is an array
 */
export function isArrayField(data: any, path: string): boolean {
  try {
    const value = getFieldValue(data, path);
    return Array.isArray(value);
  } catch {
    return false;
  }
}

/**
 * Get array length at path
 *
 * @param data - Resume data
 * @param path - Field path to array
 * @returns Array length or 0 if not array
 */
export function getArrayLength(data: any, path: string): number {
  try {
    const value = getFieldValue(data, path);
    return Array.isArray(value) ? value.length : 0;
  } catch {
    return 0;
  }
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for typo detection in field names
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}
