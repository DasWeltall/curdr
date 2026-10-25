import { AgentCharacter } from "./AgentCharacter";
import { useStore } from "../data/store";
import React, { useEffect } from "react";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
  ReduceMotion,
  cancelAnimation,
} from "react-native-reanimated";
import Svg, { Circle, Path, G } from "react-native-svg";
import { useTheme } from "../theme";
import { IconState, Settings } from "../data/types";
export function Avatar({
  size = 56,
  state = "idle",
  kind = "fleck",
}: {
  size?: number;
  state?: IconState;
  kind?: Settings["icon"];
}) {
  const { c, calm } = useTheme();
  const { state: store } = useStore();
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  useEffect(() => {
    cancelAnimation(scale);
    cancelAnimation(rotation);
    if (calm || kind === "character") {
      scale.value = 1;
      rotation.value = 0;
      return;
    }
    const duration =
      state === "think"
        ? 900
        : state === "work"
          ? 600
          : state === "need"
            ? 1500
            : 2800;
    scale.value = withRepeat(
      withSequence(
        withTiming(state === "work" ? 1.12 : 1.06, { duration: duration / 2 }),
        withTiming(1, { duration: duration / 2 }),
      ),
      -1,
    );
    if (kind === "orbit")
      rotation.value = withRepeat(
        withTiming(360, { duration: duration * 3 }),
        -1,
        false,
      );
    return () => {
      cancelAnimation(scale);
      cancelAnimation(rotation);
    };
  }, [calm, state, kind]);
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { rotate: `${rotation.value}deg` }],
  }));
  if (kind === "character")
    return (
      <AgentCharacter config={store.settings.agent} size={size} state={state} />
    );
  return (
    <Animated.View
      accessibilityLabel={`curdr: ${state}`}
      style={[{ width: size, height: size }, style]}
    >
      <Animated.View
        key={`${kind}-${state}`}
        entering={calm ? undefined : FadeIn.duration(350)}
      >
        <Svg width={size} height={size} viewBox="0 0 68 68">
          {kind === "punkte" ? (
            Array.from({ length: 9 }, (_, i) => (
              <Circle
                key={i}
                cx={14 + (i % 3) * 20}
                cy={14 + Math.floor(i / 3) * 20}
                r={5.5}
                fill={c.acc}
              />
            ))
          ) : kind === "ring" ? (
            <>
              <Circle
                cx={34}
                cy={34}
                r={20}
                fill="none"
                stroke={c.acc}
                strokeWidth={4}
              />
              <Circle cx={34} cy={34} r={7} fill={c.acc} />
            </>
          ) : kind === "orbit" ? (
            <>
              <Circle
                cx={34}
                cy={34}
                r={22}
                fill="none"
                stroke={c.line}
                strokeWidth={2}
              />
              <Circle cx={34} cy={34} r={8} fill={c.acc} />
              <Circle cx={34} cy={12} r={4.5} fill={c.acc} />
            </>
          ) : (
            <>
              <Path
                d="M34 18c9 0 15 6 15 15s-6 15-15 15-15-6-15-15 6-15 15-15z"
                fill={c.acc}
              />
              <Path
                d={
                  state === "think"
                    ? "M6 40L26 40C32 40 36 32 32 28 28 24 22 30 28 38 30 41 36 40 42 40L62 40"
                    : state === "work"
                      ? "M5 36q6-9 12 0t12 0 12 0 12 0 12 0"
                      : "M6 36C16 26 24 26 34 36S52 46 62 36"
                }
                fill="none"
                stroke={c.ink}
                strokeWidth={3.2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </>
          )}
        </Svg>
      </Animated.View>
    </Animated.View>
  );
}
