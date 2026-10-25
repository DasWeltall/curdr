import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { summarizePeaks, validPeaks } from '../data/audio';
import { useTheme } from '../theme';
function Bar({ value, played, live, color }: { value: number; played: boolean; live: boolean; color?: string }) {
  const { c, calm } = useTheme(); const height = useSharedValue(3);
  useEffect(() => { height.value = withTiming(3 + value * 29, { duration: calm ? 0 : live ? 75 : 140 }); }, [value, calm, live]);
  const style = useAnimatedStyle(() => ({ height: height.value }));
  return <Animated.View pointerEvents="none" style={[{ flex: 1, maxWidth: 4, minWidth: 2, borderRadius: 3, backgroundColor: color || (played || live ? c.ink : c.mute), opacity: played || live ? .9 : .3 }, style]} />;
}
export function Waveform({ peaks = [], progress = 0, live = false, onSeek, color }: { peaks?: number[]; progress?: number; live?: boolean; onSeek?: (fraction: number) => void; color?: string }) {
  const { c } = useTheme(); const [width, setWidth] = useState(1);
  const bars = useMemo(() => { const samples = validPeaks(peaks); return live ? [...Array(Math.max(0, 32 - samples.length)).fill(0), ...samples.slice(-32)] : summarizePeaks(samples, 36); }, [peaks, live]);
  return <Pressable disabled={!onSeek} accessibilityRole={onSeek ? 'adjustable' : undefined} accessibilityLabel={live ? 'Microphone volume' : 'Voice message progress'} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} accessibilityActions={onSeek ? [{ name: 'increment', label: 'Seek forward' }, { name: 'decrement', label: 'Seek backward' }] : undefined} onAccessibilityAction={e => onSeek?.(Math.max(0, Math.min(1, progress + (e.nativeEvent.actionName === 'increment' ? .1 : -.1))))} onPress={e => onSeek?.(Math.max(0, Math.min(1, e.nativeEvent.locationX / width)))} onLayout={e => setWidth(e.nativeEvent.layout.width || 1)} style={{ flex: 1, height: 40, flexDirection: 'row', alignItems: 'center', gap: 3 }}>
    {bars.length ? bars.map((value, index) => <Bar key={index} value={value} played={index / bars.length < progress} live={live} color={color} />) : <View pointerEvents="none" style={{ height: 3, flex: 1, borderRadius: 2, backgroundColor: color || c.mute, opacity: .25 }} />}
  </Pressable>;
}
