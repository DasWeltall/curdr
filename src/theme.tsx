import { messageInk } from "./data/messageColors";
import React, { createContext, useContext, useEffect, useState } from "react";
import { AccessibilityInfo, Platform, useColorScheme } from "react-native";
import { useStore } from "./data/store";
export const light = {
  bg: "#F9F8F5",
  ink: "#141412",
  mute: "#8B8982",
  me: "#DDE7D6",
  meInk: "#141412", aiInk: "#141412",
  ai: "#EDEDEB",
  card: "#FFFFFF",
  tile: "#F1F0EC",
  line: "#E4E2DC",
  acc: "#476849",
  accb: "#E3EAD9",
  ok: "#2F8F4E",
  amb: "#A9691C",
  ambb: "#FBE6BE",
  btn: "#141412",
  btnfg: "#FFFFFF",
};
export const dark: typeof light = {
  bg: "#161614",
  ink: "#F2F1ED",
  mute: "#8F8D86",
  me: "#34412D",
  meInk: "#F2F1ED", aiInk: "#F2F1ED",
  ai: "#252523",
  card: "#1E1E1C",
  tile: "#2A2A27",
  line: "#33332F",
  acc: "#C2DA9D",
  accb: "#303C27",
  ok: "#5FCB86",
  amb: "#E9B25A",
  ambb: "#4A3912",
  btn: "#F2F1ED",
  btnfg: "#141412",
};
interface Theme {
  c: typeof light;
  fs: number;
  calm: boolean;
  isDark: boolean;
}
const ThemeContext = createContext<Theme>({
  c: light,
  fs: 1,
  calm: false,
  isDark: false,
});
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { state } = useStore();
  const system = useColorScheme();
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduced);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => sub.remove();
  }, []);
  const s = state.settings;
  const isDark =
    s.theme === "dark" || (s.theme === "system" && system === "dark");
  const base = isDark ? dark : light;
  const me = /^#[0-9a-f]{6}$/i.test(s.userMessageColor||"")?s.userMessageColor!:base.me;
  const ai = /^#[0-9a-f]{6}$/i.test(s.agentMessageColor||"")?s.agentMessageColor!:base.ai;
  const target = {...base,me,ai,meInk:messageInk(me),aiInk:messageInk(ai)};
  const [c,setPalette]=useState(target);
  useEffect(()=>{
    if(s.calm||reduced){setPalette(target);return;}
    const from=c;let frame=0,start=0;const blend=(a:string,b:string,t:number)=>'#'+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,'0')).join('');
    const tick=(time:number)=>{if(!start)start=time;const p=Math.min(1,(time-start)/220),t=p*p*(3-2*p);setPalette(Object.fromEntries(Object.entries(target).map(([key,value])=>[key,blend(from[key as keyof typeof from],value,t)])) as typeof target);if(p<1)frame=requestAnimationFrame(tick);};
    frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame);
  },[isDark,me,ai,s.calm,reduced]);
  useEffect(() => {
    if (Platform.OS === "web") {
      document.documentElement.style.background = c.bg;
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content',c.bg);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    }
  }, [c, isDark]);
  return (
    <ThemeContext.Provider
      value={{ c, fs: 1, calm: s.calm || reduced, isDark }}
    >
      {children}
    </ThemeContext.Provider>
  );
}
export const useTheme = () => useContext(ThemeContext);
