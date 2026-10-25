import React, { useMemo, useState } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useTheme } from '../theme';
import { audioTime } from '../data/audio';
import { Waveform } from './Waveform';
import { Txt, Icon } from './ui';
export { audioTime } from '../data/audio';
export function AudioBubble({ uri, duration, peaks, transcript, processing, compact = false, color }: { uri?: string; duration: number; peaks?: number[]; transcript?: string; processing?: string; compact?: boolean; color?: string }) {
  const { c } = useTheme(); const source = useMemo(() => uri ? { uri } : null, [uri]);
  const player = useAudioPlayer(source, { updateInterval: 100 }); const status = useAudioPlayerStatus(player);
  const [error, setError] = useState('');
  const total = status.duration || duration, position = Math.min(total, status.currentTime || 0);
  async function seek(fraction: number) { try { await player.seekTo(fraction * total); } catch { setError('This recording could not be played.'); } }
  async function toggle() { setError(''); try { if (status.playing) player.pause(); else { if (status.didJustFinish || position >= total) await player.seekTo(0); player.play(); } } catch { setError('This recording could not be played.'); } }
  return <View style={{ gap: 9, width: compact ? 220 : 275, maxWidth: '100%', minWidth: 0 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
    <Pressable disabled={!uri || !status.isLoaded} accessibilityRole="button" accessibilityLabel={status.playing ? 'Pause voice message' : 'Play voice message'} onPress={() => void toggle()} style={({ pressed }) => ({ flexShrink: 0, width: 44, height: 44, borderRadius: 22, backgroundColor: c.btn, alignItems: 'center', justifyContent: 'center', opacity: pressed ? .7 : 1, transform: [{ scale: pressed ? .94 : 1 }] })}>{uri && !status.isLoaded && !status.error ? <ActivityIndicator color={c.btnfg} size="small" /> : <Icon name={status.playing ? 'pause' : 'play'} size={19} color={c.btnfg} />}</Pressable>
    <View style={{ flex: 1, minWidth: 0 }}><Waveform color={color} peaks={peaks} progress={total ? position / total : 0} onSeek={status.isLoaded ? fraction => void seek(fraction) : undefined} /><View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: -2 }}><Txt size={11} muted style={{ color:color||c.mute, opacity:.8, fontVariant: ['tabular-nums'] }}>{audioTime(position)}</Txt><Txt size={11} muted style={{ color:color||c.mute, opacity:.8, fontVariant: ['tabular-nums'] }}>{audioTime(total)}</Txt></View></View>
  </View>{processing === 'transcribing' && <Txt size={12} style={{color:color||c.ink}}>Transcribing…</Txt>}{processing === 'failed' && <Txt size={12} style={{ color: c.amb }}>Transcription failed. Your recording is saved.</Txt>}{(!!error || !!status.error) && <Txt size={12} style={{ color: c.amb }}>{error || 'This recording could not be played.'}</Txt>}{!!transcript && <Txt size={14} style={{color:color||c.ink}}>{transcript}</Txt>}</View>;
}
