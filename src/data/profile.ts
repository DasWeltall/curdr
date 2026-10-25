import { Settings } from './types';
/** Copy personal preferences only. Never replace server model, budget, permissions or work. */
export function personalProfile(settings: Settings): Partial<Settings> {
  const { founderProfile,founderInterviewDone,name, pic, icon, agent, theme, calm, brief, quiet, sleeping, timezone, userMessageColor, agentMessageColor, replyLanguage } = settings;
  return { founderProfile,founderInterviewDone,name, pic, icon, agent, theme, calm, brief, quiet, sleeping, timezone, userMessageColor, agentMessageColor, replyLanguage, fs: 1, ton: 'kurz', pro: 'aktiv', onboarded: true };
}
