import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeAgent } from './agent';
import { defaults } from './seed';
import { AgentEvent, Draft, Settings, Snapshot, Task, TaskAction, Transport, OutputFile, Upload, VoiceUpload } from './types';
export function emptyWorkspace(): Snapshot {
  return { channels: [], tasks: [], messages: [], files: [], skills: [], approvals: [], logs: [], iconState: 'idle', settings: { ...defaults, agent: normalizeAgent(), apps: { ...defaults.apps } } };
}
/** Real device preferences. No generated work, simulated answers or approvals. */
export class LocalTransport implements Transport {
  mode: Transport['mode'] = 'local';
  state = emptyWorkspace();
  listener?: (event: AgentEvent) => void;
  constructor(private preferences?: Settings) { if (preferences) this.state.settings = {...preferences}; }
  private writes = Promise.resolve();
  private key = 'curdr-workspace-v1';
  connect(onEvent: (event: AgentEvent) => void, onStatus: (status: string) => void) {
    let alive = true;
    this.listener = onEvent;
    void (async () => {
      const saved = await AsyncStorage.getItem(this.key);
      const old = saved ? undefined : await AsyncStorage.getItem('curdr-demo-v1');
      try {
        const parsed = JSON.parse(saved || old || 'null');
        if (parsed?.settings) {
          // Carry across personal appearance only, never fabricated tasks or results.
          const settings = { ...defaults, ...parsed.settings, ...this.preferences, agent: normalizeAgent(this.preferences?.agent || parsed.settings.agent), apps: { ...defaults.apps } };
          this.state = { ...emptyWorkspace(), settings, channels: saved && Array.isArray(parsed.channels) ? parsed.channels : [] };
        }
      } catch { /* An invalid old preference file is ignored. */ }
      if (this.preferences) await AsyncStorage.setItem(this.key,JSON.stringify(this.state));
      if (alive) { onEvent({ type: 'snapshot', data: this.state }); onStatus('Not connected'); }
    })().catch(() => { if (alive) {onEvent({type:'snapshot',data:this.state});onStatus('Could not load your settings.');} });
    return () => { alive = false; this.listener = undefined; };
  }
  async settings(patch: Partial<Settings>) {
    const settings = { ...this.state.settings, ...patch, ...(patch.agent ? { agent: normalizeAgent(patch.agent) } : {}) };
    this.state = { ...this.state, settings };
    this.listener?.({ type: 'settings', data: settings });
    const bytes = JSON.stringify(this.state);
    this.writes = this.writes.catch(() => {}).then(() => AsyncStorage.setItem(this.key, bytes));
    await this.writes;
  }
  private unavailable(): never { throw Error('Connect Hermes in Settings to send messages.'); }
  async message(_text: string, _channel?: string) { this.unavailable(); }
  async braindump(_text: string): Promise<Draft[]> { return this.unavailable(); }
  async commitDraft(_draft: Draft, _start: boolean): Promise<Task> { return this.unavailable(); }
  async task(_id: string, _action: TaskAction, _text?: string) { this.unavailable(); }
  async approval(_id: string, _decision: 'approve' | 'later' | 'session' | 'always') { this.unavailable(); }
  async skill(_id: string, _enabled: boolean) { this.unavailable(); }
  async upload(_file: Upload): Promise<OutputFile> { return this.unavailable(); }
  async audio(_file: VoiceUpload) { this.unavailable(); }
  async visual(_fileId:string,_block:number,_change:{value?:number;item?:number;done?:boolean}) {this.unavailable();}
  async transcribe(_file: VoiceUpload): Promise<string> { return this.unavailable(); }
  async channel(id: string, context: string) {
    const { channelId } = await import("./channels");
    id = channelId(id);
    if (!id || id === "main") throw Error("Choose a channel name.");
    const item = { id, name: id, context: context.slice(0, 4000), summary: "", createdAt: new Date().toISOString() };
    this.state = { ...this.state, channels: [...this.state.channels.filter(c => c.id !== id), item] };
    this.listener?.({ type: "channels", data: this.state.channels });
    await AsyncStorage.setItem(this.key, JSON.stringify(this.state));
  }
  async reset() { throw Error('Connect your workspace first.'); }
}
