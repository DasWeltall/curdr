import {request,useResource} from '../data/workspace';
import {Segments} from '../components/ui';
import {Routines} from './Routines';
import {TabPane} from '../components/TabPane';
import React, { useState, useEffect } from "react";
import { View, ScrollView, Pressable } from "react-native";
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  runOnJS,
} from "react-native-reanimated";
import { Sheet } from "../components/Sheet";
import { channelWorkspaces, channelId } from "../data/channels";
import { useTheme } from "../theme";
import { useStore } from "../data/store";
import { statusLabels, Status, Task } from "../data/types";
import { Button, Icon, IconButton, Txt, Input } from "../components/ui";
export function TaskRow({
  task: t,
  index = 0,
  onOpen,
  animate = false,
  onChannel,
}: {
  task: Task;
  index?: number;
  onOpen: () => void;
  animate?: boolean;
  onChannel?: (id: string) => void;
}) {
  const { c, calm } = useTheme();
  const { api, run } = useStore();
  const gone = useSharedValue(0);
  const [checked, setChecked] = useState(false);
  const animated = useAnimatedStyle(() => ({
    opacity: 1 - gone.value,
    transform: [{ translateX: gone.value * 300 }],
    maxHeight: 150 * (1 - gone.value),
    overflow: "hidden",
  }));
  async function finish() {
    const ok = await run(async () => {
      await api.task(t.id, "done");
      return true;
    });
    if (!ok) {
      gone.value = 0;
      setChecked(false);
    }
  }
  function check() {
    if (checked || t.status === "done") return;
    setChecked(true);
    gone.value = withTiming(1, { duration: calm ? 0 : 450 }, () =>
      runOnJS(finish)(),
    );
  }
  const color =
    t.status === "need" ? c.amb : t.status === "run" ? c.acc : c.mute;
  return (
    <Animated.View
      entering={
        animate && !calm ? FadeInUp.delay(index * 40).duration(400) : undefined
      }
    >
      <Animated.View style={animated}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "flex-start",
            paddingVertical: 16,
            borderBottomWidth: 1,
            borderBottomColor: c.line,
          }}
        >
          <Pressable
            accessibilityRole="checkbox"
            aria-checked={checked || t.status === "done"}
            hitSlop={4}
            accessibilityLabel={`${t.title} mark as done`}
            accessibilityState={{ checked: checked || t.status === "done" }}
            onPress={check}
            style={{
              minHeight: 44,
              width: 38,
              alignItems: "flex-start",
              justifyContent: "flex-start",
              paddingTop: 3,
            }}
          >
            <View
              style={{
                width: 21,
                height: 21,
                borderWidth: 1.5,
                borderColor: checked || t.status === "done" ? c.acc : c.line,
                borderRadius: 7,
                backgroundColor:
                  checked || t.status === "done" ? c.acc : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {(checked || t.status === "done") && (
                <Icon name="done" size={15} width={3} color="#fff" />
              )}
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={onOpen}
            style={{ flex: 1, minHeight: 66 }}
          >
            <Txt bold style={{ marginBottom: 3 }}>
              {t.title}
            </Txt>
            <Txt numberOfLines={1} size={13}>
              <Txt size={13} style={{ color }}>
                {statusLabels[t.status]}
              </Txt>
              <Txt size={13} muted>
                {t.status === "done" || t.status === "up"
                  ? ""
                  : ` · ${t.summary}`}
              </Txt>
            </Txt>
            <Pressable accessibilityRole="button" accessibilityLabel={`Open #${t.channel}`} onPress={event=>{event.stopPropagation();onChannel?.(t.channel);}} style={{flexDirection:"row",alignItems:"center",gap:5,marginTop:5,minHeight:28}}>
              <Icon name={t.source} size={13} color={c.mute} />
              <Txt size={12} muted>
                {t.channel}
              </Txt>
            </Pressable>
          </Pressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
export function Tasks({onOpen,onBraindump,top,bottom,channel,active=true,onChannel}:{onOpen:(t:Task)=>void;onBraindump:()=>void;top:number;bottom:number;channel?:string;active?:boolean;onChannel:(id:string)=>void}){
 const {c}=useTheme();const {state,api,run}=useStore();const [section,setSection]=useState<'active'|'next'|'channels'|'routines'>('active'),[query,setQuery]=useState(''),[resolved,setResolved]=useState(false);
 const ideas=useResource<{id:string;title:string;sub?:string;channel:string}[]>('/captures/parked',[]);
 const tasks=state.tasks.filter(t=>(!channel||t.channel===channel)&&(t.title+' '+t.summary).toLowerCase().includes(query.toLowerCase()));const workspaces=channelWorkspaces(state);const capture=(state.captures||[]).filter(item=>item.status&&!item.dismissed).at(-1);
 return <><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{paddingTop:channel?16:top+108,paddingHorizontal:20,paddingBottom:bottom+150,gap:20}}>{!channel&&<><Txt size={30} bold>Tasks</Txt>{capture&&<Pressable accessibilityRole="button" accessibilityLabel="Open saved brain dump" onPress={onBraindump} style={{padding:16,borderRadius:22,backgroundColor:c.tile,gap:6}}><Txt bold size={15}>{capture.status==='ready'?'Your brain dump plan is ready':'Brain dump · '+(capture.phase||capture.status)}</Txt><Txt muted numberOfLines={1} size={13}>{capture.text||'Voice recording'}</Txt></Pressable>}<Segments value={section} options={[["active","Active"],["next","Up next"],["channels","Channels"],["routines","Routines"]]} onChange={setSection}/></>}<TabPane key={section} id={section}>{section==='routines'&&!channel?<Routines/>:section==='channels'&&!channel?<><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between'}}><Txt size={25} bold>Channels</Txt><Button onPress={()=>{onChannel('main');void run(()=>api.message('/channel','main'));}}>New channel</Button></View>{workspaces.map(item=><Pressable key={item.id} accessibilityRole="button" accessibilityLabel={'Open channel '+item.id} onPress={()=>onChannel(item.id)} style={{padding:18,borderRadius:24,backgroundColor:c.tile,gap:10}}><View style={{flexDirection:'row',justifyContent:'space-between'}}><Txt size={19} bold>{item.name||item.id}</Txt><Icon name="chev" size={16}/></View><Txt size={14} muted numberOfLines={2}>{item.context||'A focused workspace with its own context.'}</Txt><Txt size={12} muted>{tasks.filter(t=>t.channel===item.id&&t.status==='need').length} need input · {tasks.filter(t=>t.channel===item.id&&t.status==='run').length} working</Txt></Pressable>)}{!workspaces.length&&<Txt muted>Give a part of your work its own context.</Txt>}</>:<><Input accessibilityLabel="Search tasks" placeholder="Search your work…" value={query} onChangeText={setQuery}/>{(section==='next'?['up','done']:['review','need','run','done'] as Status[]).map(status=>{const rows=tasks.filter(t=>t.status===status);if(!rows.length)return null;return <View key={status}><Pressable accessibilityRole="button" disabled={status!=='done'} onPress={()=>setResolved(!resolved)} style={{minHeight:42,flexDirection:'row',alignItems:'center',gap:8}}><Txt size={13} bold muted>{statusLabels[status as Status]} · {rows.length}</Txt>{status==='done'&&<Icon name={resolved?'down':'chev'} size={13}/>}</Pressable>{(status!=='done'||resolved)&&rows.map(t=><TaskRow key={t.id} task={t} onOpen={()=>onOpen(t)} onChannel={onChannel} animate/>)}</View>;})}{section==='next'&&!!ideas.value.length&&<View style={{gap:12}}><Txt bold>Ideas on the shelf</Txt>{ideas.value.map(idea=><View key={idea.id} style={{padding:18,borderRadius:20,backgroundColor:c.tile,gap:9}}><Txt bold>{idea.title}</Txt>{!!idea.sub&&<Txt size={13} muted>{idea.sub}</Txt>}<Button onPress={()=>{onChannel('main');void run(()=>api.message('/reality-check '+idea.title+' '+(idea.sub||'')));}}>Review this idea</Button></View>)}</View>}{!tasks.some(t=>section==='next'?t.status==='up':t.status!=='up'&&t.status!=='done')&&<View style={{paddingVertical:35,gap:10}}><Txt size={23} bold>{section==='next'?'Room for the next useful thing.':'A little more headspace.'}</Txt><Txt muted>{section==='next'?'Review a brain dump and park future work here.':'Capture what is on your mind. Choose what deserves action.'}</Txt><Button onPress={onBraindump}>Brain dump</Button></View>}</>}</TabPane></ScrollView>{!channel&&<Pressable accessibilityRole="button" accessibilityLabel="Open brain dump" onPress={onBraindump} style={{position:'absolute',right:18,bottom:bottom+84,width:54,height:54,borderRadius:27,backgroundColor:c.btn,justifyContent:'center',alignItems:'center'}}><Icon name="plus" size={25} color={c.btnfg}/></Pressable>}</>;
}
