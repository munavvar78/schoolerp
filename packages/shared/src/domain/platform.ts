import { MODULES, type ModuleKey } from '../roles.js';

const ALLOWED = new Set<string>(MODULES);

/** Keeps only known module keys, in MODULES order, with duplicates removed. */
export function sanitizeEnabledModules(requested: readonly string[]): ModuleKey[] {
  const wanted = new Set(requested);
  return MODULES.filter((module) => wanted.has(module));
}

export function assertEnabledModules(requested: readonly string[]):
  | { ok: true; modules: ModuleKey[] }
  | { ok: false; message: string } {
  if (requested.length > MODULES.length) {
    return { ok: false, message: 'Too many modules' };
  }
  const unknown = requested.filter((module) => !ALLOWED.has(module));
  if (unknown.length) {
    return { ok: false, message: 'Unknown module' };
  }
  const modules = sanitizeEnabledModules(requested);
  if (!modules.length) return { ok: false, message: 'Choose at least one module' };
  return { ok: true, modules };
}
