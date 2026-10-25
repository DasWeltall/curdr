import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { summarizePeaks, validPeaks } from '../data/audio';
import { useTheme } from '../theme';
function Bar({ value, played, live, color, maxHeight }: { maxHeight:number; value: number; played: boolean; live: boolean; color?: string }) {
  const { c, calm } = useTheme(); const height = useSharedValue(3);
  useEffect(() => { height.value = withTiming(3 + value * (maxHeight-6), { duration: calm ? 0 : live ? 75 : 140 }); }, [value, calm, live,maxHeight]);
  const style = useAnimatedStyle(() => ({ height: height.value }));
  return <Animated.View pointerEvents="none" style={[{ flex: 1, maxWidth: 4, minWidth: 0, borderRadius: 3, backgroundColor: color || (played || live ? c.ink : c.mute), opacity: played || live ? .9 : .3 }, style]} />;
}
export function Waveform({ peaks = [], progress = 0, live = false, onSeek, color, height=40 }: {height?:number; peaks?: number[]; progress?: number; live?: boolean; onSeek?: (fraction: number) => void; color?: string }) {
  const { c } = useTheme(); const [width, setWidth] = useState(1);
  const count=Math.min(36,Math.max(8,Math.floor(width/6)));
  const bars = useMemo(() => { const samples = validPeaks(peaks); return live ? [...Array(Math.max(0, count - samples.length)).fill(0), ...samples.slice(-count)] : summarizePeaks(samples, count); }, [peaks, live, count]);
  return <Pressable disabled={!onSeek} accessibilityRole={onSeek ? 'adjustable' : undefined} accessibilityLabel={live ? 'Microphone volume' : 'Voice message progress'} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} accessibilityActions={onSeek ? [{ name: 'increment', label: 'Seek forward' }, { name: 'decrement', label: 'Seek backward' }] : undefined} onAccessibilityAction={e => onSeek?.(Math.max(0, Math.min(1, progress + (e.nativeEvent.actionName === 'increment' ? .1 : -.1))))} onPress={e => onSeek?.(Math.max(0, Math.min(1, e.nativeEvent.locationX / width)))} onLayout={e => setWidth(e.nativeEvent.layout.width || 1)} style={{ width:'100%', minWidth:0, overflow:'hidden', height, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
    {bars.length ? bars.map((value, index) => <Bar key={index} value={value} played={index / bars.length < progress} live={live} color={color} maxHeight={height} />) : <View pointerEvents="none" style={{ height: 3, flex: 1, borderRadius: 2, backgroundColor: color || c.mute, opacity: .25 }} />}
  </Pressable>;
}
