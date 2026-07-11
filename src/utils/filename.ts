// Filename helpers: suggestion, sanitization, duplicate handling.

// Characters not allowed in filenames on common filesystems (Windows is the strictest).
// Spaces and dashes are intentionally preserved; whitespace is collapsed separately.
// eslint-disable-next-line no-control-regex
const INVALID_CHARS = /[<>:"/\\|?*\x00-\x1f]/g;

const RESERVED_WINDOWS_NAMES = new Set([
  'con',
  'prn',
  'aux',
  'nul',
  ...Array.from({ length: 9 }, (_, i) => `com${i + 1}`),
  ...Array.from({ length: 9 }, (_, i) => `lpt${i + 1}`),
]);

/** Remove the trailing `.pdf` (case-insensitive) if present. */
export function stripPdfExtension(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

/**
 * Sanitize a user-entered filename base (without extension). Strips invalid characters,
 * collapses whitespace, trims dots/spaces, and guards against reserved names.
 * Returns a safe, non-empty base name.
 */
export function sanitizeFilenameBase(input: string): string {
  let base = stripPdfExtension(input ?? '')
    .replace(INVALID_CHARS, '')
    .replace(/\s+/g, ' ')
    .trim()
    // Windows disallows trailing dots/spaces.
    .replace(/[. ]+$/, '')
    .replace(/^[. ]+/, '');

  if (base.length === 0) {
    base = 'Scan';
  }
  if (RESERVED_WINDOWS_NAMES.has(base.toLowerCase())) {
    base = `${base}_file`;
  }
  // Keep filenames reasonable; extremely long names break some filesystems.
  return base.slice(0, 120);
}

/** Ensure a `.pdf` extension (exactly one, lowercase). */
export function ensurePdfExtension(base: string): string {
  return `${sanitizeFilenameBase(base)}.pdf`;
}

/** Zero-pad a number to two digits. */
function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

/**
 * Suggest a filename base from a date, e.g. "Scan_2026-07-11_1430".
 * The `.pdf` extension is added at save time via {@link ensurePdfExtension}.
 */
export function suggestFilenameBase(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `Scan_${y}-${m}-${d}_${hh}${mm}`;
}

/**
 * Given a desired base name and a set of names already used in the folder (with or
 * without `.pdf`), return a unique base name by appending "(n)" when needed.
 */
export function incrementFilename(desiredBase: string, existingNames: Iterable<string>): string {
  const taken = new Set<string>();
  for (const n of existingNames) {
    taken.add(stripPdfExtension(n).toLowerCase());
  }
  const base = sanitizeFilenameBase(desiredBase);
  if (!taken.has(base.toLowerCase())) {
    return base;
  }
  let counter = 2;
  // Strip an existing "(n)" suffix so we don't produce "name (2) (2)".
  const rootMatch = base.match(/^(.*?)\s*\((\d+)\)$/);
  const root = rootMatch ? rootMatch[1] : base;
  while (taken.has(`${root} (${counter})`.toLowerCase())) {
    counter++;
  }
  return `${root} (${counter})`;
}

/** True if any existing name (ignoring .pdf and case) matches the desired base. */
export function isDuplicateName(desiredBase: string, existingNames: Iterable<string>): boolean {
  const base = sanitizeFilenameBase(desiredBase).toLowerCase();
  for (const n of existingNames) {
    if (stripPdfExtension(n).toLowerCase() === base) {
      return true;
    }
  }
  return false;
}
