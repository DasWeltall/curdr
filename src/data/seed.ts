import { defaultAgent } from "./agent";
import { Snapshot, Settings } from "./types";
export const defaults: Settings = {
  name: "",founderProfile:{},founderInterviewDone:false,morningPrompt:"",checkPrompt:"",
  onboarded: false,
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone||'Europe/Berlin',
  userMessageColor: "", agentMessageColor: "", replyLanguage: "auto", proactiveChecks: false, proactiveInterval: 60, briefingEnabled: false, hermesModel: "", hermesProvider: "",
  pic: "",
  icon: "character",
  agent: { ...defaultAgent },
  theme: "system",
  fs: 1,
  calm: false,
  ton: "kurz",
  pro: "aktiv",
  brief: "07:00",
  quiet: true,
  sleeping: false,
  model: "openai/gpt-4.1-mini",
  budget: 20,
  used: 0,
  aPay: true,
  aSend: true,
  aDel: true,
  sbx: true,
  filesystem: false,
  network: false,
  browser: false,
  apps: { Gmail: false, Kalender: false, Drive: false, Notion: false },
};
export function seed(): Snapshot {
  return { channels: [], settings: { ...defaults, agent: { ...defaultAgent }, apps: { ...defaults.apps } }, iconState: "idle", logs: [], tasks: [], messages: [], approvals: [], files: [], skills: [] };
}
