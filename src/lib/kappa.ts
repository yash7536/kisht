/** Inter-rater agreement: raw percent agreement and Cohen's kappa for two labellers. */

export interface Agreement {
  n: number;
  agreement: number | null;
  kappa: number | null;
}

export function cohensKappa<T extends string | boolean>(a: T[], b: T[]): Agreement {
  if (a.length !== b.length) throw new Error('label arrays must be the same length');
  const n = a.length;
  if (n === 0) return { n, agreement: null, kappa: null };
  const cats = [...new Set([...a, ...b].map(String))];
  let agree = 0;
  const ca: Record<string, number> = {};
  const cb: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const x = String(a[i]);
    const y = String(b[i]);
    if (x === y) agree++;
    ca[x] = (ca[x] ?? 0) + 1;
    cb[y] = (cb[y] ?? 0) + 1;
  }
  const po = agree / n;
  const pe = cats.reduce((s, c) => s + ((ca[c] ?? 0) / n) * ((cb[c] ?? 0) / n), 0);
  // If both raters used one identical category throughout, kappa is undefined; report null.
  const kappa = pe === 1 ? null : (po - pe) / (1 - pe);
  return { n, agreement: po, kappa };
}

export function kappaLabel(k: number | null): string {
  if (k === null) return 'undefined';
  if (k < 0) return 'worse than chance';
  if (k < 0.2) return 'slight';
  if (k < 0.4) return 'fair';
  if (k < 0.6) return 'moderate';
  if (k < 0.8) return 'substantial';
  return 'almost perfect';
}

/** Deterministic sample of ~fraction of items (seeded, so both labellers get the same set). */
export function sampleIds(ids: string[], fraction: number, seed = 42): string[] {
  let s = seed >>> 0;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  const arr = [...ids].sort();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, Math.ceil(arr.length * fraction)).sort();
}
