import React from 'react';
import Animated,{FadeIn,FadeOut} from 'react-native-reanimated';
import {useTheme} from '../theme';
export function TabPane({id,children}:{id:string;children:React.ReactNode}){const {calm}=useTheme();return <Animated.View key={id} entering={calm?undefined:FadeIn.duration(180)} exiting={calm?undefined:FadeOut.duration(100)} style={{gap:18}}>{children}</Animated.View>;}
