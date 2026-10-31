import {useLocalSearchParams} from "expo-router";
import {FounderInterview} from '../src/screens/FounderInterview';
import { KeyboardAvoidingView } from '../src/components/KeyboardLayout';
import { Markdown } from "../src/components/Markdown";
import { channelId } from "../src/data/channels";
import { VisualView } from "../src/components/VisualView";
import { parseVisual } from "../src/data/visual";
import { ConnectHermes } from "../src/screens/ConnectHermes";
import { Onboarding } from "../src/screens/Onboarding";
import { ChannelWorkspace } from "../src/screens/ChannelWorkspace";
import { Toast } from "../src/components/Toast";
import { useKeyboard } from "../src/hooks/useKeyboard";
import { AgentStudio } from "../src/screens/AgentStudio";
import React, { useRef, useState, useEffect } from "react";
import {
  View,
  ActivityIndicator,
  Pressable,
  Image,
  Platform,
  BackHandler,
  useWindowDimensions,
  ScrollView,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useTheme } from "../src/theme";
import { useStore } from "../src/data/store";
import { Task } from "../src/data/types";
import { Avatar } from "../src/components/Avatar";
import {
  Button,
  Icon,
  IconButton,
  Txt,
  Input,
  shadow,
} from "../src/components/ui";
import { Sheet } from "../src/components/Sheet";
import { Chat } from "../src/screens/Chat";
import { Tasks, TaskRow } from "../src/screens/Tasks";
import { Braindump } from "../src/screens/Braindump";
import { Computer, ComputerTab } from "../src/screens/Computer";
import { Settings } from "../src/screens/Settings";
import { saveOutput } from "../src/files";
const tabs = [
  ["chat", "Chat"],
  ["tasks", "Tasks"],
  ["comp", "Computer"],
] as const;
type Tab = (typeof tabs)[number][0];
function Pane({
  active,
  index,
  selected,
  children,
}: {
  active: boolean;
  index: number;
  selected: number;
  children: React.ReactNode;
}) {
  const { calm } = useTheme();
  const offset = useSharedValue((index - selected) * 30);
  const opacity = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    offset.value = withTiming((index - selected) * 30, {
      duration: calm ? 0 : 500,
    });
    opacity.value = withTiming(active ? 1 : 0, { duration: calm ? 0 : 350 });
  }, [active, index, selected, calm]);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: offset.value }],
  }));
  return (
    <Animated.View
      aria-hidden={!active}
      pointerEvents={active ? "auto" : "none"}
      accessibilityElementsHidden={!active}
      importantForAccessibility={active ? "auto" : "no-hide-descendants"}
      style={[
        { position: "absolute", inset: 0, zIndex: active ? 1 : 0 },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}
function TaskDetail({
  id,
  onClose,
  onChat,
}: {
  id: string;
  onClose: () => void;
  onChat: () => void;
}) {
  const { state, api, run, notify } = useStore();
  const { c } = useTheme();
  const task = state.tasks.find((t) => t.id === id);
  const [instruction, setInstruction] = useState("");
  if (!task)
    return (
      <Sheet title="Task" onClose={onClose}>
        <Txt>This task was deleted.</Txt>
      </Sheet>
    );
  async function action(name: "done" | "start" | "pause" | "delete") {
    await run(() => api.task(id, name));
    if (name === "delete") {
      onClose();
      onChat();
      notify("Review the deletion request in chat.");
    } else onClose();
  }
  return (
    <Sheet title="Task" onClose={onClose}>
      <Txt serif size={30} style={{ marginBottom: 10 }}>
        {task.title}
      </Txt>
      <Txt
        size={14}
        style={{
          color:
            task.status === "need"
              ? c.amb
              : task.status === "run"
                ? c.acc
                : c.mute,
        }}
      >
        {
          {
            need: "Needs you",
            review: "Ready for review",
            run: "Working",
            up: "Up next",
            done: "Done",
          }[task.status]
        }
      </Txt>
      <Txt muted style={{ marginVertical: 14 }}>
        {task.summary}
      </Txt>
      <Txt size={13} style={{ color: c.acc, marginBottom: 24 }}>
        #{task.channel}
      </Txt>
      {task.external&&task.status!=="review"&&task.status!=="done"?<Button primary onPress={()=>{onClose();onChat();}}>Open conversation</Button>:task.status === "need" ? (
        <Button
          primary
          onPress={() => {
            onClose();
            onChat();
          }}
        >
          Review in chat
        </Button>
      ) : task.status === "review" ? (
        <Button primary onPress={() => void action("done")}>
          Mark as done
        </Button>
      ) : task.status === "up" ? (
        <Button primary onPress={() => void action("start")}>
          Start now
        </Button>
      ) : task.status === "run" ? (
        <Button onPress={() => void action("pause")}>Pause</Button>
      ) : null}
      <Txt size={13} bold muted style={{ marginTop: 24, marginBottom: 8 }}>
        Instructions
      </Txt>
      <Input
        accessibilityLabel="Instructions"
        placeholder="For example: shorter and more casual"
        value={instruction}
        onChangeText={setInstruction}
        multiline
      />
      <Button
        disabled={!instruction.trim()}
        onPress={() =>
          void run(async () => {
            await api.task(id, "instruction", instruction);
            setInstruction("");
            notify("Instructions saved");
          })
        }
        style={{ marginTop: 10 }}
      >
        Save
      </Button>
      <Pressable
        accessibilityRole="button"
        onPress={() => void action("delete")}
        style={{ minHeight: 50, justifyContent: "center", marginTop: 10 }}
      >
        <Txt style={{ color: c.amb }}>Delete task</Txt>
      </Pressable>
    </Sheet>
  );
}
export default function App() {
  const { c, calm, isDark } = useTheme();
  const { state, error, notice, api, run, mood, dismiss, ready, hydrated, composerFocused, disconnect } = useStore();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboard();
  const hideNavigation = keyboard;
  const { width: windowWidth } = useWindowDimensions();
  const navSize = Math.min(380, Math.min(460, windowWidth) - 64);
  const [tab, setTab] = useState<Tab>("chat"),
    [computerTab, setComputer] = useState<ComputerTab>("live"),
    [overlay, setOverlay] = useState<
      | { kind: "settings" }
      | {kind:"founder"}
      | { kind: "connect" }
      | { kind: "agent" }
      | { kind: "channel"; tag: string }
      | { kind: "task"; id: string }
      | { kind: "file"; id: string }
      | null
    >(null),
    [braindump, setBrain] = useState(false),
    [navWidth, setNavWidth] = useState(0);
  const interviewed=useRef(false);
  useEffect(()=>{if(ready&&hydrated&&state.settings.onboarded&&!state.settings.founderInterviewDone&&api.mode!=='demo'&&!interviewed.current){interviewed.current=true;setOverlay({kind:'founder'});}},[ready,hydrated,state.settings.onboarded,state.settings.founderInterviewDone,api]);
  const seen = useRef(new Set<string>());
  const selected = tabs.findIndex((t) => t[0] === tab);
  const indicator = useSharedValue(0);
  const indexStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicator.value }],
  }));
  useEffect(() => {
    indicator.value = calm
      ? (selected * (navWidth - 8)) / 3
      : withSpring((selected * (navWidth - 8)) / 3, {
          damping: 19,
          stiffness: 150,
          mass: 0.8,
        });
  }, [selected, navWidth, calm]);
  const pendingCapture=(state.captures||[]).filter(item=>item.status&&!item.dismissed).at(-1);
  const need = state.tasks.filter((t) => t.status === "need").length;
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (overlay) {
        setOverlay(null);
        return true;
      }
      if (tab !== "chat") {
        setTab("chat");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [overlay, tab]);
  useEffect(() => {
    if (
      Platform.OS === "web" &&
      "serviceWorker" in navigator &&
      location.protocol === "https:"
    )
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  const openChannel = (input: string) => { const tag=channelId(input); if (tag === "main" || tag === "inbox") {setOverlay(null);setTab("chat");} else setOverlay({ kind: "channel", tag }); };
  const pushParams=useLocalSearchParams<{channel?:string}>();
  useEffect(()=>{if(pushParams.channel&&/^[a-z0-9_-]{1,48}$/.test(pushParams.channel))openChannel(pushParams.channel);},[pushParams.channel]);
  const openTask = (t: Task) => setOverlay({ kind: "task", id: t.id });
  const onFiles = () => {
    setTab("comp");
    setComputer("files");
  };
  const file =
    overlay?.kind === "file"
      ? state.files.find((f) => f.id === overlay.id)
      : undefined;
  if (!ready || !hydrated) return <View style={{flex:1,alignItems:"center",justifyContent:"center",backgroundColor:c.bg,gap:20,padding:30}}><ActivityIndicator color={c.ink}/>{ready&&api.mode==="gateway"&&<><Txt>Connecting to Hermes…</Txt><Button onPress={()=>void run(disconnect)}>Disconnect</Button></>}</View>;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: c.bg }}
      behavior={Platform.OS === "web" ? undefined : "padding"}
    >
      <StatusBar style={isDark ? "light" : "dark"} />
      <View
        style={{
          flex: 1,
          width: "100%",
          maxWidth: 460,
          alignSelf: "center",
          backgroundColor: c.bg,
          overflow: "hidden",
        }}
      >
        <View style={{flex:1}} aria-hidden={!state.settings.onboarded} accessibilityElementsHidden={!state.settings.onboarded} importantForAccessibility={state.settings.onboarded?"auto":"no-hide-descendants"}>
        <Pane active={tab === "chat"} index={0} selected={selected}>
          <Chat
            onChannel={openChannel}
            onFiles={onFiles}
            top={insets.top}
            bottom={insets.bottom}
            seen={seen.current}
            onConnect={() => setOverlay({ kind: "connect" })}
          />
        </Pane>
        <Pane active={tab === "tasks"} index={1} selected={selected}>
          <Tasks
            active={tab === "tasks"}
            onChannel={openChannel}
            onOpen={openTask}
            onBraindump={() => setBrain(true)}
            top={insets.top}
            bottom={insets.bottom}
          />
        </Pane>
        <Pane active={tab === "comp"} index={2} selected={selected}>
          <Computer
            onChat={()=>setTab("chat")}
            tab={computerTab}
            setTab={setComputer}
            onFile={(id) => setOverlay({ kind: "file", id })}
            top={insets.top}
            bottom={insets.bottom}
          />
        </Pane>
        <LinearGradient
          pointerEvents="box-none"
          colors={[c.bg, c.bg, `${c.bg}00`]}
          locations={[0, 0.55, 1]}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: insets.top + 96,
            zIndex: 5,
            paddingTop: insets.top + 8,
            paddingHorizontal: 16,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          {pendingCapture?<Pressable accessibilityRole="button" accessibilityLabel={pendingCapture.status==='ready'?'Review brain dump plan':'Open brain dump progress'} onPress={()=>setBrain(true)} style={{width:42,height:42,borderRadius:21,backgroundColor:c.tile,alignItems:'center',justifyContent:'center'}}>{['queued','planning','transcribing'].includes(pendingCapture.status||'')?<ActivityIndicator size="small" color={c.ink}/>:<Icon name="tasks" size={22} color={c.ink}/>}<View style={{position:'absolute',right:0,top:0,width:8,height:8,borderRadius:4,backgroundColor:pendingCapture.status==='ready'?c.ok:c.acc}}/></Pressable>:<View style={{width:42}}/>}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Customizing"
            onPress={() => setOverlay({ kind: "agent" })}
            style={{
              width: 82,
              height: 82,
              borderRadius: 34,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Avatar
              size={84}
              state={mood}
              kind={state.settings.icon}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open settings"
            onPress={() => setOverlay({ kind: "settings" })}
            style={{
              width: 42,
              height: 42,
              marginTop: 18,
              borderRadius: 21,
              borderWidth: 0,
              backgroundColor: c.tile,
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              ...shadow,
            }}
          >
            {state.settings.pic ? (
              <Image
                source={{ uri: state.settings.pic }}
                style={{ width: 42, height: 42 }}
              />
            ) : (
              state.settings.name ? <Txt bold size={17}>{state.settings.name.trim().split(/\s+/).map(word=>word[0]).slice(0,2).join('').toUpperCase()}</Txt> : <Icon name="person" size={23} color={c.ink} />
            )}
          </Pressable>
        </LinearGradient>
        <View
          onLayout={(e) => setNavWidth(e.nativeEvent.layout.width)}
          style={{
            position: "absolute",
            display: hideNavigation ? "none" : "flex",
            bottom: insets.bottom + 12,
            left: (Math.min(460, windowWidth) - navSize) / 2,
            width: navSize,
            maxWidth: 380,
            height: 60,
            alignSelf: "center",
            borderRadius: 999,
            borderWidth: 1,
            borderColor: c.line,
            backgroundColor: c.bg,
            padding: 4,
            flexDirection: "row",
            zIndex: 6,
            ...shadow,
          }}
        >
          <Animated.View
            style={[
              {
                position: "absolute",
                top: 4,
                bottom: 4,
                left: 4,
                width: Math.max(0, (navWidth - 8) / 3),
                borderRadius: 999,
                backgroundColor: c.tile,
              },
              indexStyle,
            ]}
          />
          {tabs.map(([key, label], i) => (
            <Pressable
              key={key}
              accessibilityRole="tab"
              accessibilityLabel={label}
              aria-selected={tab === key}
              accessibilityState={{ selected: tab === key }}
              onPress={() => setTab(key)}
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                gap: 0,
              }}
            >
              <Icon name={key} color={tab === key ? c.ink : c.mute} size={22} />
              <Txt
                size={12}
                bold={tab === key}
                style={{ color: tab === key ? c.ink : c.mute }}
              >
                {label}
              </Txt>
              {key === "tasks" && need > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: 3,
                    left: "57%",
                    minWidth: 16,
                    height: 16,
                    paddingHorizontal: 4,
                    borderRadius: 8,
                    backgroundColor: c.acc,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Txt size={10} style={{ color: "#fff", lineHeight: 16 }}>
                    {need}
                  </Txt>
                </View>
              )}
            </Pressable>
          ))}
        </View>
        {!overlay&&!braindump&&state.settings.onboarded&&(error||notice)&&<Toast message={error||notice} error={!!error} onClose={dismiss} top={insets.top+96}/>}
        {overlay?.kind === 'founder'&&<FounderInterview onClose={()=>setOverlay(null)}/>}
        {overlay?.kind === "connect" && <ConnectHermes onClose={()=>setOverlay(null)} onConnected={()=>setTab("chat")}/>}
        {overlay?.kind === "agent" && (
          <Sheet
            title="Customizing"
            scroll={false}
            onClose={() => setOverlay(null)}
          >
            <AgentStudio onClose={() => setOverlay(null)} />
          </Sheet>
        )}
        {overlay?.kind === "settings" && (
          <Sheet title="Settings" onClose={() => setOverlay(null)}>
            <Settings onAgent={() => setOverlay({ kind: "agent" })} onDemo={()=>{setOverlay(null);setTab("chat");}} />
          </Sheet>
        )}
        {overlay?.kind === "channel" && <Sheet title={`#${overlay.tag}`} scroll={false} contentPadding={0} onClose={()=>setOverlay(null)}><ChannelWorkspace id={overlay.tag} onChannel={openChannel} onTask={openTask} onFiles={()=>{setOverlay(null);onFiles();}} seen={seen.current}/></Sheet>}
        {overlay?.kind === "task" && (
          <TaskDetail
            id={overlay.id}
            onClose={() => setOverlay(null)}
            onChat={() => openChannel(state.tasks.find(task=>task.id===((overlay as {id:string}).id))?.channel||"main")}
          />
        )}
        {overlay?.kind === "file" && file && (
          <Sheet title={file.name} onClose={() => setOverlay(null)}>
            <Txt size={13} style={{ color: c.acc, marginBottom: 16 }}>
              #{file.channel}
            </Txt>
            {parseVisual(file.content)?<VisualView visual={parseVisual(file.content)!} onChange={(block,change)=>void run(()=>api.visual(file.id,block,change))}/>:<>{file.mime?.startsWith("image/")&&file.base64?<Image source={{uri:`data:${file.mime};base64,${file.base64}`}} style={{width:"100%",height:320}} resizeMode="contain"/>:file.content?<Markdown text={file.content} color={c.ink} onChannel={openChannel}/>:<Txt>Download this file to open it.</Txt>}</>}
            <Button
              onPress={() => void run(() => saveOutput(file))}
              style={{ marginTop: 24 }}
            >
              Save file
            </Button>
          </Sheet>
        )}
        {braindump && <Braindump onClose={() => setBrain(false)} />}
        </View>
        {!state.settings.onboarded && <Onboarding/>}
      </View>
    </KeyboardAvoidingView>
  );
}
