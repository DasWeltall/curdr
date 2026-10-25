import { ChannelWorkspace, Message, Snapshot } from './types';
export const MAIN_CHANNEL = 'main';
export const channelId = (value: string) => value.toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
export function mentions(text: string): string[] {
  return [...new Set([...text.matchAll(/(?:^|\s)#([a-zA-Z0-9_-]{1,48})/g)].map(match => match[1]!.toLowerCase()))].slice(0, 3);
}
export function conversation(messages: Message[], channel = MAIN_CHANNEL) {
  return messages.filter(message => (message.channel === 'inbox' || !message.channel ? MAIN_CHANNEL : message.channel) === channel);
}
export function channelWorkspaces(state: Snapshot): ChannelWorkspace[] {
  const known = new Map((state.channels || []).map(channel => [channel.id, channel]));
  for (const task of state.tasks) if (task.channel !== MAIN_CHANNEL && task.channel !== 'inbox' && !known.has(task.channel)) known.set(task.channel, { id: task.channel, name: task.channel, context: '', summary: '', createdAt: task.updatedAt });
  return [...known.values()];
}
