import React from 'react';
import { View } from 'react-native';
import { AgentConfig, normalizeAgent } from '../data/agent';
import { IconState } from '../data/types';
import { useTheme } from '../theme';
import { AvatarSurface } from './AvatarSurface';
import { AvatarPreviewRequest } from './avatarHtml';
export function AgentCharacter({ config, size = 88, state = 'idle', onPress, animate = true, action, previews, onPreview, background }: {
  config?: AgentConfig; size?: number; state?: IconState; onPress?: () => void; animate?: boolean; action?: string;
  previews?: AvatarPreviewRequest[]; onPreview?: (id: string, uri: string) => void; background?: string;
}) {
  const { calm, c, isDark } = useTheme();
  return <View accessibilityLabel={`curdr, ${state}`}><AvatarSurface size={size} onPreview={onPreview}
    settings={{ config: normalizeAgent(config), calm: calm || !animate, state, action, interactive: !!onPress, background: 'transparent', dark: isDark, previews }} /></View>;
}
