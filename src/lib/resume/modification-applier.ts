/**
 * Modification Applier - Apply structured modifications to resume data
 *
 * Supports 6 operation types:
 * - replace: Replace entire field value
 * - prefix: Add text to beginning of string field
 * - suffix: Add text to end of string field
 * - append: Add item to end of array
 * - insert: Insert item at specific array position
 * - remove: Remove field or array item
 *
 * @module lib/resume/modification-applier
 */

import {
  getFieldValue,
  setFieldValue,
  parseFieldPath,
} from './field-path-resolver';

/**
 * Modification operation types
 */
export type ModificationOperationType =
  | 'replace'
  | 'prefix'
  | 'suffix'
  | 'append'
  | 'insert'
  | 'remove';

/**
 * Modification operation structure
 */
export interface ModificationOperation {
  operation: ModificationOperationType;
  field_path: string;
  new_value?: any;
  old_value?: any;
}

/**
 * Apply a modification operation to resume data
 *
 * Creates a deep copy with modifications. Does not mutate original.
 *
 * @param resume - Resume data object
 * @param modification - Modification operation to apply
 * @returns Modified copy of resume
 * @throws Error if operation is invalid or fails
 *
 * @example
 * applyModification(resume, {
 *   operation: 'prefix',
 *   field_path: 'experiences[0].title',
 *   new_value: 'Senior '
 * })
 * // Returns resume with title "Senior Software Engineer"
 */
export function applyModification(
  resume: any,
  modification: ModificationOperation
): any {
  // Validate inputs
  if (!modification.field_path) {
    throw new Error('field_path is required for modification operation');
  }

  const { operation, field_path, new_value } = modification;

  // Validate operation type
  const validOperations: ModificationOperationType[] = [
    'replace',
    'prefix',
    'suffix',
    'append',
    'insert',
    'remove',
  ];
  if (!validOperations.includes(operation)) {
    throw new Error(`Invalid operation type: ${operation}`);
  }

  // Deep clone to avoid mutations
  const result = JSON.parse(JSON.stringify(resume));

  try {
    switch (operation) {
      case 'replace':
        return applyReplace(result, field_path, new_value);

      case 'prefix':
        return applyPrefix(result, field_path, new_value);

      case 'suffix':
        return applySuffix(result, field_path, new_value);

      case 'append':
        return applyAppend(result, field_path, new_value);

      case 'insert':
        return applyInsert(result, field_path, new_value);

      case 'remove':
        return applyRemove(result, field_path);

      default:
        throw new Error(`Unsupported operation: ${operation}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(`Failed to apply modification: ${error}`);
  }
}

/**
 * Replace entire field value
 */
function applyReplace(data: any, path: string, value: any): any {
  if (value === undefined) {
    throw new Error('new_value is required for replace operation');
  }
  return setFieldValue(data, path, value);
}

/**
 * Add text to beginning of string field
 */
function applyPrefix(data: any, path: string, prefix: string): any {
  if (prefix === undefined) {
    throw new Error('new_value is required for prefix operation');
  }

  const currentValue = getFieldValue(data, path);

  if (typeof currentValue !== 'string') {
    const typeLabel = Array.isArray(currentValue) ? 'array' : typeof currentValue;
    throw new Error(
      `Cannot prefix non-string field. Current value type: ${typeLabel}`
    );
  }

  const newValue = currentValue === '' ? prefix : prefix + currentValue;
  return setFieldValue(data, path, newValue);
}

/**
 * Add text to end of string field
 */
function applySuffix(data: any, path: string, suffix: string): any {
  if (suffix === undefined) {
    throw new Error('new_value is required for suffix operation');
  }

  const currentValue = getFieldValue(data, path);

  if (typeof currentValue !== 'string') {
    const typeLabel = Array.isArray(currentValue) ? 'array' : typeof currentValue;
    throw new Error(
      `Cannot suffix non-string field. Current value type: ${typeLabel}`
    );
  }

  const newValue = currentValue === '' ? suffix : currentValue + suffix;
  return setFieldValue(data, path, newValue);
}

/**
 * Append item to end of array
 */
function applyAppend(data: any, path: string, item: any): any {
  if (item === undefined) {
    throw new Error('new_value is required for append operation');
  }

  const currentValue = getFieldValue(data, path);

  // Create array if field doesn't exist
  if (currentValue === undefined) {
    return setFieldValue(data, path, [item]);
  }

  if (!Array.isArray(currentValue)) {
    throw new Error(
      `Cannot append to non-array field. Current value type: ${typeof currentValue}`
    );
  }

  const newArray = [...currentValue, item];
  return setFieldValue(data, path, newArray);
}

/**
 * Insert item at specific position in array
 */
function applyInsert(data: any, path: string, item: any): any {
  if (item === undefined) {
    throw new Error('new_value is required for insert operation');
  }

  // Parse path to extract array path and index
  const segments = parseFieldPath(path);
  const lastSegment = segments[segments.length - 1];

  if (lastSegment.type !== 'index' && lastSegment.type !== 'latest') {
    throw new Error('Insert operation requires array index in path');
  }

  // Get array path (without index)
  const arrayPath = path.substring(0, path.lastIndexOf('['));
  const insertIndex = lastSegment.index;

  const currentArray = getFieldValue(data, arrayPath);

  if (!Array.isArray(currentArray)) {
    throw new Error(
      `Cannot insert into non-array field. Current value type: ${typeof currentArray}`
    );
  }

  if (insertIndex < 0 || insertIndex > currentArray.length) {
    throw new Error(
      `Invalid array index for insert: ${insertIndex}. Array length: ${currentArray.length}`
    );
  }

  // Insert item at specified index
  const newArray = [
    ...currentArray.slice(0, insertIndex),
    item,
    ...currentArray.slice(insertIndex),
  ];

  return setFieldValue(data, arrayPath, newArray);
}

/**
 * Remove field or array item
 */
function applyRemove(data: any, path: string): any {
  const currentValue = getFieldValue(data, path);

  // If field doesn't exist, return unchanged
  if (currentValue === undefined) {
    return data;
  }

  // Check if path ends with array index
  const segments = parseFieldPath(path);
  const lastSegment = segments[segments.length - 1];

  if (lastSegment.type === 'index' || lastSegment.type === 'latest') {
    // Remove array element
    const arrayPath = path.substring(0, path.lastIndexOf('['));
    const removeIndex = lastSegment.index;

    const currentArray = getFieldValue(data, arrayPath);

    if (!Array.isArray(currentArray)) {
      throw new Error('Cannot remove index from non-array field');
    }

    const newArray = currentArray.filter((_, index) => index !== removeIndex);
    return setFieldValue(data, arrayPath, newArray);
  } else {
    // Remove entire field
    const result = JSON.parse(JSON.stringify(data));

    // Navigate to parent and delete property
    if (segments.length === 1) {
      // Top-level property
      const onlySegment = segments[0];
      if (onlySegment.type !== 'property') {
        throw new Error('Cannot remove array index at root');
      }
      delete result[onlySegment.key];
    } else {
      // Nested property
      const parentPath = segments.slice(0, -1);
      let current = result;

      for (const segment of parentPath) {
        if (segment.type === 'property') {
          current = current[segment.key];
        } else if (segment.type === 'index' || segment.type === 'latest') {
          current = current[segment.index];
        }
      }

      if (lastSegment.type !== 'property') {
        throw new Error('Cannot remove array index without a property target');
      }
      delete current[lastSegment.key];
    }

    return result;
  }
}

/**
 * Validate modification before applying
 *
 * @param modification - Modification to validate
 * @returns Validation errors (empty array if valid)
 */
export function validateModification(
  modification: ModificationOperation
): string[] {
  const errors: string[] = [];

  if (!modification.operation) {
    errors.push('Operation type is required');
  }

  if (!modification.field_path) {
    errors.push('Field path is required');
  }

  const requiresValue: ModificationOperationType[] = [
    'replace',
    'prefix',
    'suffix',
    'append',
    'insert',
  ];

  if (
    requiresValue.includes(modification.operation) &&
    modification.new_value === undefined
  ) {
    errors.push(`new_value is required for ${modification.operation} operation`);
  }

  return errors;
}

/**
 * Apply multiple modifications in sequence
 *
 * @param resume - Resume data
 * @param modifications - Array of modifications to apply
 * @returns Resume with all modifications applied
 * @throws Error if any modification fails
 */
export function applyModifications(
  resume: any,
  modifications: ModificationOperation[]
): any {
  let result = resume;

  for (const modification of modifications) {
    result = applyModification(result, modification);
  }

  return result;
}
