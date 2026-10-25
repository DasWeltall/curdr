export const MAX_PEAKS = 1200;
/** Missing microphone metering is silence, never fabricated audio. */
export function levelFromDb(db?: number) {
  if (db === undefined || !Number.isFinite(db)) return 0;
  return Math.pow(Math.max(0, Math.min(1, (db + 60) / 60)), 1.7);
}
export function validPeaks(value: unknown): number[] {
  return Array.isArray(value) ? value.slice(0, MAX_PEAKS).map(n => typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 0) : [];
}
export function summarizePeaks(samples: number[], count = 40) {
  if (!samples.length) return [];
  const size = Math.min(count, samples.length);
  return Array.from({ length: size }, (_, i) => Math.max(0, ...samples.slice(Math.floor(i * samples.length / size), Math.ceil((i + 1) * samples.length / size))));
}
export const audioTime = (value: number) => {
  const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};
