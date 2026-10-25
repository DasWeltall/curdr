import { IconState, Snapshot } from './types';
export function activityMood(state: Snapshot, error: string, activity: IconState | null, celebrating = false): IconState {
  if (error) return 'error';
  if (state.settings.sleeping) return 'sleep';
  if (activity) return activity;
  const active=(state.runs||[]).filter(r=>!['completed','cancelled','failed','interrupted','unknown','partial'].includes(r.status));
  if(active.some(r=>r.status==='waiting'))return 'need';
  if(active.some(r=>['working','running','responding','stopping'].includes(r.status)))return 'work';
  if (state.iconState === 'think') return 'think';
  if (state.iconState === 'work' || state.tasks.some(t => t.status === 'run')) return 'work';
  if (state.iconState === 'need' || state.tasks.some(t => t.status === 'need') || state.approvals.some(a => a.state === 'pending')) return 'need';
  if (celebrating || state.iconState === 'success') return 'success';
  return state.iconState === 'sleep' ? 'sleep' : 'idle';
}
