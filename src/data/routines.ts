import type {Routine} from './workspace';

/** Hermes jobs may contain a structured schedule; React text inputs require strings. */
export function routineView(value: unknown): Routine | null {
  if (!value || typeof value !== 'object') return null;
  const row=value as Record<string,unknown>;
  if (typeof row.id!=='string' || !row.id) return null;
  const text=(v:unknown,fallback='')=>typeof v==='string'?v:fallback;
  const schedule=typeof row.schedule==='string'?row.schedule:row.schedule && typeof row.schedule==='object'?JSON.stringify(row.schedule):'';
  return {...row,id:row.id,name:text(row.name,'Routine'),schedule,prompt:text(row.prompt),last_status:text(row.last_status)||undefined} as Routine;
}
export function routineViews(value: unknown): Routine[] {
  return Array.isArray(value)?value.map(routineView).filter((r):r is Routine=>r!==null):[];
}
