import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from "react";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { seed, defaults } from "./seed";
import { reduce } from "./reducer";
import { HttpTransport } from "./http";
import { personalProfile } from "./profile";
import { gatewayAddress } from "./gateway";
import { LocalTransport } from "./local";
import { DemoTransport } from "./demo";
import { activityMood } from "./mood";
import { IconState, Snapshot, Transport, Settings } from "./types";
interface Context {
  state: Snapshot;
  api: Transport;
  status: string;
  ready: boolean;
  hydrated: boolean;
  composerFocused: boolean;
  setComposerFocused: (value: boolean) => void;
  setDemo: (enabled: boolean, preferences?: Settings) => Promise<void>;
  dismiss: () => void;
  error: string;
  notice: string;
  run: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  notify: (s: string) => void;
  connect: (url: string, token: string, preferences?: Partial<Settings>, profile?: "local" | "remote") => Promise<void>;
  pair: (url: string, code: string, preferences?: Partial<Settings>, profile?: "local" | "remote") => Promise<void>;
  disconnect: () => Promise<void>;
  mood: IconState;
  setActivity: (mood: IconState | null) => void;
  gatewayUrl: string;
}
const Store = createContext<Context>(null!);
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useState(seed),
    [api, setApi] = useState<Transport>(() => new LocalTransport()),
    [status, setStatus] = useState("Loading…"),
    [hydrated, setHydrated] = useState(false),
    [composerFocused, setComposerFocused] = useState(false),
    [activity, setActivity] = useState<IconState | null>(null),
    [successUntil, setSuccessUntil] = useState(0),
    [ready, setReady] = useState(false),
    [error, setError] = useState(""),
    [notice, notify] = useState(""),
    [gatewayUrl, setUrl] = useState("");
  const originalTransport = useRef<Transport | null>(null);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
      const url = await AsyncStorage.getItem("curdr-gateway");
      const token =
        Platform.OS === "web"
          ? sessionStorage.getItem("curdr-token")
          : await SecureStore.getItemAsync("curdr-token");
      if (alive && url && token) setUrl(url);
      const demoEnabled = await AsyncStorage.getItem("curdr-demo-enabled-v5");
      if (alive && demoEnabled === "1") {
        const preferences = await AsyncStorage.getItem("curdr-demo-preferences-v5");
        if (url && token) originalTransport.current = new HttpTransport(url, token);
        setApi(new DemoTransport(preferences ? JSON.parse(preferences) : undefined));
      } else if (alive && url && token) {
        setUrl(url);
        setApi(new HttpTransport(url, token));
      }
      } catch { if (alive) setError("Saved preferences could not be loaded. You can continue with a fresh local session."); }
      finally { if (alive) setReady(true); }
    })();
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    if (!ready) return;
    setHydrated(false);
    setStatus("Connecting…");
    if (api.mode === "gateway")
      dispatch({
        channels: [],
        tasks: [],
        messages: [],
        files: [],
        skills: [],
        approvals: [],
        logs: [],
        settings: { ...defaults },
        iconState: "idle",
      });
    let active=true;
    const stop=api.connect((e) => {
      if(!active)return;
      dispatch((s) => reduce(s, e));
      if (api.mode === "gateway" && (e.type === "settings" || e.type === "snapshot")) void AsyncStorage.setItem("curdr-remote-profile-cache",JSON.stringify(e.type === "snapshot" ? e.data.settings : e.data)).catch(()=>{});
      if (e.type === "snapshot") setHydrated(true);
      if (e.type === "message" && e.data.role === "agent" && !e.data.streaming || e.type === "task_update" && e.data.status === "review") setSuccessUntil(Date.now() + 3200);
    }, value=>{if(active)setStatus(value);});
    return()=>{active=false;stop();};
  }, [api, ready]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => notify(""), 3500);
    return () => clearTimeout(id);
  }, [notice]);
  useEffect(() => {
    if (!successUntil) return;
    const timer = setTimeout(() => setSuccessUntil(0), Math.max(0, successUntil - Date.now()));
    return () => clearTimeout(timer);
  }, [successUntil]);
  const run = useCallback(async <T,>(fn: () => Promise<T>) => {
    try {
      setError("");
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      return undefined;
    }
  }, []);
  async function connect(url: string, token: string, preferences?: Partial<Settings>, profile: "local" | "remote" = "local") {
    url = gatewayAddress(url, Platform.OS !== "web");
    const next = new HttpTransport(url, token.trim());
    const health = await next.request("/health");
    if (health.agent !== "hermes" || health.agent_status !== "ready") throw Error("Hermes is not ready on this server.");
    if (profile === "local") await next.settings(personalProfile({...state.settings,...preferences}));
    await AsyncStorage.setItem("curdr-gateway", url);
    if (Platform.OS === "web")
      sessionStorage.setItem("curdr-token", token.trim());
    else await SecureStore.setItemAsync("curdr-token", token.trim());
    await AsyncStorage.removeItem("curdr-demo-enabled-v5");
    originalTransport.current = null;
    setUrl(url);
    setApi(next);
  }
  async function pair(url: string, code: string, preferences?: Partial<Settings>, profile: "local" | "remote" = "local") {
    url = gatewayAddress(url, Platform.OS !== "web");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${url}/pair/exchange`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }), signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || typeof result.token !== "string")
        throw Error(typeof result.detail === "string" ? result.detail : "Invalid pairing code.");
      const next = new HttpTransport(url, result.token);
      const health = await next.request("/health");
      if (health.agent !== "hermes" || health.agent_status !== "ready")
        throw Error("The server is reachable, but Hermes is not ready. Check its setup and generate a new pairing code.");
      await connect(url, result.token, preferences, profile);
    } finally { clearTimeout(timeout); }
  }
  async function setDemo(enabled: boolean, preferences?: Settings) {
    if (enabled) {
      await AsyncStorage.setItem("curdr-demo-enabled-v5", "1");
      await AsyncStorage.setItem("curdr-demo-preferences-v5",JSON.stringify(preferences || state.settings));
      if (api.mode !== "demo") originalTransport.current = api;
      const next = new DemoTransport(preferences || state.settings); next.autoPlay = true; setApi(next);
    } else {
      await AsyncStorage.removeItem("curdr-demo-enabled-v5");
      const previous=originalTransport.current;
      if(previous?.mode==='gateway'){
        await previous.settings({name:state.settings.name,pic:state.settings.pic,agent:state.settings.agent,theme:state.settings.theme,icon:state.settings.icon,fs:1,ton:'kurz'});
        setApi(previous);
      }else setApi(new LocalTransport({...state.settings,sleeping:false}));
    }
    setError("");
  }
  async function disconnect() {
    let personal = state.settings;
    if (api.mode === "gateway" && !hydrated) {
      try { const cached = await AsyncStorage.getItem("curdr-remote-profile-cache"); if (cached) personal = JSON.parse(cached); } catch {}
    }
    await AsyncStorage.removeItem("curdr-gateway");
    if (Platform.OS === "web") sessionStorage.removeItem("curdr-token");
    else await SecureStore.deleteItemAsync("curdr-token");
    setUrl("");
    setApi(new LocalTransport(personal));
  }
  return (
    <Store.Provider
      value={{
        state,
        api,
        status,
        ready,
        hydrated,
        composerFocused, setComposerFocused,
        setDemo,
        dismiss: () => { setError(""); notify(""); },
        error,
        notice,
        run,
        notify,
        connect,
        pair,
        disconnect,
        mood: activityMood(state, error, activity, successUntil > Date.now()),
        setActivity,
        gatewayUrl,
      }}
    >
      {children}
    </Store.Provider>
  );
}
export const useStore = () => useContext(Store);
