import { AgentEvent, Snapshot } from "./types";
function upsert<T extends { id: string }>(xs: T[], x: T) {
  return xs.some((v) => v.id === x.id)
    ? xs.map((v) => (v.id === x.id ? x : v))
    : [...xs, x];
}
export function reduce(state: Snapshot, event: AgentEvent): Snapshot {
  switch (event.type) {
    case "run": return {...state,runs:upsert(state.runs||[],event.data)};
    case "hermes": return {...state,hermes:event.data};
    case "channels": return { ...state, channels: event.data };
    case "activity": return { ...state, iconState: event.data.state, activityChannel: event.data.channel };
    case "snapshot":
      return { ...event.data, channels: event.data.channels || [] };
    case "message": {
      const previous=state.messages.find(m=>m.id===event.data.id);
      // A replayed partial must never replace a completed reply or its visual card.
      if(previous&&event.data.streaming&&(!previous.streaming||previous.kind==='text'&&event.data.kind==='text'&&previous.text.length>event.data.text.length))return state;
      return { ...state, messages: upsert(state.messages, event.data) };
    }
    case "task_update":
      return { ...state, tasks: upsert(state.tasks, event.data) };
    case "task_removed":
      return {
        ...state,
        tasks: state.tasks.filter((t) => t.id !== event.data.id),
      };
    case "file_added":
      return { ...state, files: upsert(state.files, event.data) };
    case "approval":
      return { ...state, approvals: upsert(state.approvals, event.data) };
    case "icon_state":
      return { ...state, iconState: event.data };
    case "settings":
      return { ...state, settings: event.data };
    case "skills":
      return { ...state, skills: event.data };
    case "log":
      return { ...state, logs: [...state.logs, event.data].slice(-100) };
  }
}
