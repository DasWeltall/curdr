import type { AgentConfig } from "./agent";
export type Status = "review" | "need" | "run" | "up" | "done";
export type IconState = "idle" | "think" | "work" | "need" | "success" | "error" | "sleep" | "listen";
export interface ChannelWorkspace {
  id: string; name: string; context: string; summary: string; createdAt: string;
}
export interface Upload { uri: string; name: string; mimeType?: string; file?: File; channel?: string; clientId?:string; }
export interface VoiceUpload extends Upload { duration: number; peaks?: number[]; }
export interface Task {
  id: string;
  title: string;
  sub?: string;
  channel: string;
  status: Status;
  source: "mail" | "cal" | "chat";
  summary: string;
  updatedAt: string;
  instruction?: string; external?: boolean; hermesRunId?: string;
}
export interface OutputFile {
  previewKind?:"browser";runId?:string;
  id: string;
  name: string;
  channel: string;
  updatedAt: string;
  content?: string;
  mime?: string;
  base64?: string;
  origin?: string;
}
export interface BrainCapture {id:string;text:string;createdAt:string;updatedAt?:string;status?:'queued'|'transcribing'|'planning'|'ready'|'failed'|'interrupted';phase?:string;drafts?:Draft[];activities?:{id:string;title:string;detail?:string;state:string;at:string}[];runId?:string;dismissed?:boolean;saved?:string[];error?:string;}
export interface RunActivity { id: string; type: string; title: string; detail?: string; at: string; failed?: boolean; }
export interface AgentRun { captureId?:string;browser?:{url?:string;action?:string;fileId?:string;capturedAt?:string;updatedAt:string}; title?:string;resultPreview?:string; id: string; channel: string; status: string; detail: string; startedAt: string; updatedAt: string; taskId?: string; sessionId?: string; activities: RunActivity[]; error?: string; }
export interface HermesInfo { connected: boolean; streaming: boolean; approvals: boolean; models: {model:string;provider:string}[]; model?: string; provider?: string; toolsets: {name:string;enabled:boolean;configured:boolean;tools:string[]}[]; jobs: {id:string;name:string;enabled?:boolean;last_status?:string;next_run_at?:string}[]; error?: string; workspace?:string; }
export interface Skill {
  id: string;
  title: string;
  source: string;
  description?: string; category?: string; readOnly?: boolean;
  enabled: boolean;
}
export interface Approval {
  id: string;
  taskId: string;
  kind: "send" | "pay" | "delete" | "tool" | "clarify";
  runId?: string; requestId?: string; executionGeneration?: number; command?: string; choices?: string[]; channel?: string;
  allowedChoices?: ("once" | "session" | "always" | "deny")[];
  title: string;
  amount?: string;
  expiresAt: string;
  decision?: "approve" | "later" | "session" | "always";
  state?: "pending" | "approved" | "deferred" | "expired" | "denied";
  recipient?: string;
  subject?: string;
  body?: string;
}
export type Message = {
  id: string;
  role: "user" | "agent";
  channel?: string;
  createdAt: string;
  streaming?: boolean; failed?: string; runId?: string; delivery?:"sending"|"failed"|"unknown";
} & (
  | { kind: "text"; text: string }
  | { kind: "artifact"; fileId: string; title: string; description?: string }
  | { kind: "audio"; fileId: string; localUri?:string; duration: number; peaks?: number[]; transcript?: string; processing?: "transcribing" | "ready" | "failed" }
  | { kind: "attachment"; fileIds: string[]; text?: string }
  | { kind: "brief"; items: [string, string][] }
  | {
      kind: "result";
      title: string;
      subtitle: string;
      tiles: [string, string][];
      fileId?: string;
    }
  | { kind: "quick"; taskId: string; options: string[]; used?: boolean }
  | { kind: "approval"; approvalId: string }
);
export interface Settings {
  founderProfile?:Record<string,string>; founderInterviewDone?:boolean; morningPrompt?:string;checkPrompt?:string;
  name: string;
  timezone?: string;
  userMessageColor?: string; agentMessageColor?: string;
  replyLanguage?: "auto" | "en" | "de";
  proactiveChecks?: boolean; proactiveInterval?: number; briefingEnabled?: boolean;
  hermesModel?: string; hermesProvider?: string;
  onboarded: boolean;
  pic: string;
  icon: "fleck" | "punkte" | "ring" | "orbit" | "character";
  agent: AgentConfig;
  theme: "system" | "light" | "dark";
  fs: number;
  calm: boolean;
  ton: "kurz" | "lang";
  pro: "ruhig" | "normal" | "aktiv";
  brief: string;
  quiet: boolean;
  sleeping: boolean;
  model: string;
  budget: number;
  used: number;
  aPay: boolean;
  aSend: boolean;
  aDel: boolean;
  sbx: boolean;
  filesystem: boolean;
  network: boolean;
  browser: boolean;
  apps: Record<string, boolean>;
}
export interface Snapshot {
  captures?:BrainCapture[];
  runs?: AgentRun[]; hermes?: HermesInfo;
  channels: ChannelWorkspace[];
  activityChannel?: string;
  tasks: Task[];
  messages: Message[];
  files: OutputFile[];
  skills: Skill[];
  settings: Settings;
  approvals: Approval[];
  iconState: IconState;
  logs: string[];
}
export type AgentEvent =
  | {type:"capture";data:BrainCapture}
  | { type: "run"; data: AgentRun }
  | { type: "hermes"; data: HermesInfo }
  | { type: "channels"; data: ChannelWorkspace[] }
  | { type: "activity"; data: {channel: string; state: IconState} }
  | { type: "snapshot"; data: Snapshot }
  | { type: "message"; data: Message }
  | { type: "task_update"; data: Task }
  | { type: "task_removed"; data: { id: string } }
  | { type: "file_added"; data: OutputFile }
  | { type: "approval"; data: Approval }
  | { type: "icon_state"; data: IconState }
  | { type: "settings"; data: Settings }
  | { type: "skills"; data: Skill[] }
  | { type: "log"; data: string };
export interface Draft { kind?:"task"|"idea"|"note";
  id: string;
  title: string;
  sub: string;
  channel: string;
}
export type TaskAction =
  "start" | "pause" | "done" | "instruction" | "answer" | "delete";
export interface Transport {
  mode: "local" | "gateway" | "demo";
  connect: (
    onEvent: (event: AgentEvent) => void,
    onStatus: (status: string) => void,
  ) => () => void;
  message: (text: string, channel?: string, attachments?: string[], clientId?:string) => Promise<void>;
  startCapture?: (text:string,voice?:VoiceUpload,clientId?:string)=>Promise<BrainCapture>;
  braindump: (text: string) => Promise<Draft[]>;
  commitDraft: (draft: Draft, start: boolean) => Promise<Task>;
  task: (id: string, action: TaskAction, text?: string) => Promise<void>;
  approval: (id: string, decision: "approve" | "later" | "session" | "always") => Promise<void>;
  settings: (patch: Partial<Settings>) => Promise<void>;
  skill: (id: string, enabled: boolean) => Promise<void>;
  upload: (file: Upload) => Promise<OutputFile>;
  audio: (file: VoiceUpload) => Promise<void>;
  visual: (fileId:string,block:number,change:{value?:number;item?:number;done?:boolean})=>Promise<void>;
  transcribe: (file: VoiceUpload) => Promise<string>;
  channel: (id: string, context: string) => Promise<void>;
  demoControl?: (action: "play" | "pause" | "restart") => void;
  refreshHermes?: () => Promise<void>;
  stopRun?: (id:string) => Promise<void>;
  clarify?: (id:string,answer:string) => Promise<void>;
  jobControl?: (id:string,action:"pause"|"resume"|"run") => Promise<void>;
  reset: () => Promise<void>;
}
export const statusLabels: Record<Status, string> = {
  review: "Ready for review",
  need: "Needs input",
  run: "Working",
  up: "Up next",
  done: "Resolved",
};
export function channelStatus(tasks: Task[], channel: string): Status {
  const ts = tasks.filter((t) => t.channel === channel);
  return ts.some((t) => t.status === "need")
    ? "need"
    : ts.some((t) => t.status === "run")
      ? "run"
      : ts.some((t) => t.status === "review")
        ? "review"
        : "done";
}
export const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
