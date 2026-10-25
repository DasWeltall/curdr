import EventSource from "react-native-sse";
import {
  AgentEvent,
  OutputFile, Upload, VoiceUpload,
  Draft,
  Settings,
  Task,
  TaskAction,
  Transport,
} from "./types";
export class HttpTransport implements Transport {
  mode = "gateway" as const;
  constructor(
    public url: string,
    private token: string,
  ) {
    this.url = url.replace(/\/$/, "");
  }
  async request(path: string, method = "GET", body?: unknown) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), path === "/message" || path === "/audio" || path === "/transcribe" ? 3600000 : 120000);
    try {
    const res = await fetch(`${this.url}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
      },
      body:
        body === undefined
          ? undefined
          : body instanceof FormData
            ? body
            : JSON.stringify(body),
    });
    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ detail: "Server unavailable." }));
      throw Error(
        typeof error.detail === "string"
          ? error.detail
          : `Gateway: ${res.status}`,
      );
    }
    return res.status === 204 ? undefined : await res.json();
    } finally { clearTimeout(timeout); }
  }
  connect(onEvent: (e: AgentEvent) => void, onStatus: (s: string) => void) {
    const es = new EventSource(`${this.url}/stream`, {
      headers: { Authorization: `Bearer ${this.token}` },
      pollingInterval: 3000,
    });
    es.addEventListener("open", () => onStatus("Connected"));
    es.addEventListener("message", (e) => {
      if (e.data) {
        try {
          onEvent(JSON.parse(e.data));
        } catch {
          onStatus("Invalid server event");
        }
      }
    });
    es.addEventListener("error", () =>
      onStatus("Disconnected · reconnecting"),
    );
    return () => es.close();
  }
  async message(text: string, channel?: string, attachments?: string[]) {
    await this.request("/message", "POST", { text, channel, attachments });
  }
  async braindump(text: string): Promise<Draft[]> {
    return (await this.request("/braindump", "POST", { text })).tasks;
  }
  async commitDraft(draft: Draft, start: boolean): Promise<Task> {
    return this.request("/tasks", "POST", { draft_id: draft.id, start, title:draft.title,sub:draft.sub,channel:draft.channel });
  }
  async task(id: string, action: TaskAction, text?: string) {
    await this.request(`/task/${encodeURIComponent(id)}/${action}`, "POST", {
      text,
    });
  }
  async approval(id: string, decision: "approve" | "later") {
    await this.request(`/approval/${encodeURIComponent(id)}`, "POST", {
      decision,
    });
  }
  async settings(patch: Partial<Settings>) {
    await this.request("/settings", "PUT", patch);
  }
  async skill(id: string, enabled: boolean) {
    await this.request(`/skills/${encodeURIComponent(id)}`, "PUT", { enabled });
  }
  async upload(file: Upload): Promise<OutputFile> {
    const form = new FormData();
    if (file.file) form.append("file", file.file);
    else
      form.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? "application/octet-stream",
      } as unknown as Blob);
    if (file.channel) form.append("channel", file.channel);
    return this.request("/files", "POST", form);
  }
  async audio(file: VoiceUpload) {
    const form = new FormData();
    if (file.file) form.append("file", file.file);
    else form.append("file", {uri:file.uri,name:file.name,type:file.mimeType || "audio/mp4"} as unknown as Blob);
    form.append("duration", String(file.duration));
    form.append("channel", file.channel || "main");
    form.append("peaks", JSON.stringify(file.peaks || []));
    await this.request("/audio", "POST", form);
  }
  async refreshHermes(){await this.request('/runtime/refresh','POST',{});}
  async stopRun(id:string){await this.request('/runs/'+encodeURIComponent(id)+'/stop','POST',{});}
  async clarify(id:string,answer:string){await this.request('/approval/'+encodeURIComponent(id)+'/answer','POST',{text:answer});}
  async jobControl(id:string,action:'pause'|'resume'|'run'){await this.request('/runtime/jobs/'+encodeURIComponent(id)+'/'+action,'POST',{});}
  async visual(fileId:string,block:number,change:{value?:number;item?:number;done?:boolean}) {await this.request('/visuals/'+encodeURIComponent(fileId),'PUT',{block,...change});}
  async transcribe(file: VoiceUpload): Promise<string> {
    const form = new FormData();
    if (file.file) form.append("file", file.file);
    else form.append("file", {uri:file.uri,name:file.name,type:file.mimeType || "audio/mp4"} as unknown as Blob);
    form.append("duration",String(file.duration));
    return (await this.request("/transcribe","POST",form)).text;
  }
  async channel(id: string, context: string) { await this.request("/channels/" + encodeURIComponent(id), "PUT", {context}); }
  async reset() {
    throw Error("This workspace cannot be reset here.");
  }
}
