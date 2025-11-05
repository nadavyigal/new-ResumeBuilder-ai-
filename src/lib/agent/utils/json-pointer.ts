export type JSONPointer = string;

function decodeSegment(segment: string): string {
  return segment.replace(/~1/g, '/').replace(/~0/g, '~');
}

function encodeSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function normalizePointer(pointer: JSONPointer): string[] {
  if (!pointer || pointer === '/') return [''];
  if (pointer[0] !== '/') {
    throw new Error(`Invalid JSON pointer: ${pointer}`);
  }
  if (pointer === '/') return [''];
  return pointer
    .split('/')
    .slice(1)
    .map(decodeSegment);
}

function isNumericKey(key: string): boolean {
  return /^\d+$/.test(key);
}

function ensureContainer(container: any, key: string): any {
  if (container[key] === undefined) {
    container[key] = isNumericKey(key) ? [] : {};
  }
  return container[key];
}

export function getByPointer<T = any>(target: unknown, pointer: JSONPointer): T | undefined {
  if (pointer === '' || pointer === '/') {
    return target as T;
  }

  const segments = normalizePointer(pointer);
  let current: any = target;

  for (const segment of segments) {
    if (current === undefined || current === null) {
      return undefined;
    }
    if (segment === '') {
      continue;
    }
    if (Array.isArray(current)) {
      const index = segment === '-' ? current.length : parseInt(segment, 10);
      if (Number.isNaN(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
    } else {
      current = (current as Record<string, any>)[segment];
    }
  }

  return current as T;
}

export function setByPointer(target: any, pointer: JSONPointer, value: unknown): any {
  if (pointer === '' || pointer === '/') {
    return value;
  }

  const segments = normalizePointer(pointer);
  if (!segments.length) return target;

  const cloned = target === undefined ? {} : JSON.parse(JSON.stringify(target));
  let current: any = cloned;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment === '') {
      continue;
    }

    const isLast = i === segments.length - 1;

    if (isLast) {
      if (Array.isArray(current)) {
        if (segment === '-') {
          current.push(value);
        } else {
          const index = parseInt(segment, 10);
          if (Number.isNaN(index)) {
            throw new Error(`Invalid array index '${segment}' in pointer ${pointer}`);
          }
          current[index] = value;
        }
      } else {
        current[segment] = value;
      }
      break;
    }

    if (Array.isArray(current)) {
      const index = segment === '-' ? current.length : parseInt(segment, 10);
      if (Number.isNaN(index)) {
        throw new Error(`Invalid array index '${segment}' in pointer ${pointer}`);
      }
      current[index] = ensureContainer(current, index.toString());
      current = current[index];
    } else {
      current[segment] = ensureContainer(current, segment);
      current = current[segment];
    }
  }

  return cloned;
}

export function removeByPointer(target: any, pointer: JSONPointer): any {
  if (pointer === '' || pointer === '/') {
    return undefined;
  }

  const segments = normalizePointer(pointer);
  if (!segments.length) return target;

  const cloned = target === undefined ? undefined : JSON.parse(JSON.stringify(target));
  let current: any = cloned;

  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    if (segment === '') continue;
    const isLast = i === segments.length - 1;

    if (isLast) {
      if (Array.isArray(current)) {
        const index = segment === '-' ? current.length - 1 : parseInt(segment, 10);
        if (!Number.isNaN(index) && index >= 0 && index < current.length) {
          current.splice(index, 1);
        }
      } else if (current && typeof current === 'object') {
        delete current[segment];
      }
      break;
    }

    if (Array.isArray(current)) {
      const index = segment === '-' ? current.length - 1 : parseInt(segment, 10);
      if (Number.isNaN(index) || index < 0 || index >= current.length) {
        return cloned;
      }
      current = current[index];
    } else {
      current = current?.[segment];
    }

    if (current === undefined) {
      break;
    }
  }

  return cloned;
}

export function pointerExists(target: unknown, pointer: JSONPointer): boolean {
  return getByPointer(target, pointer) !== undefined;
}

export function joinPointer(base: JSONPointer, ...segments: string[]): JSONPointer {
  const normalized = base === '/' ? '' : base;
  const encoded = segments.map(encodeSegment).join('/');
  return `${normalized}/${encoded}`.replace(/^\/+/, '/');
}

