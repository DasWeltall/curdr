import "react-native-gesture-handler";
import React from "react";
import { KeyboardProvider } from "../src/components/KeyboardLayout";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import { Gabarito_400Regular } from "@expo-google-fonts/gabarito/400Regular";
import { Gabarito_600SemiBold } from "@expo-google-fonts/gabarito/600SemiBold";
import { Gabarito_700Bold } from "@expo-google-fonts/gabarito/700Bold";
import { StoreProvider } from "../src/data/store";
import { ThemeProvider } from "../src/theme";
export default function Layout() {
  const [loaded, error] = useFonts({
    Gabarito_400Regular,
    Gabarito_600SemiBold,
    Gabarito_700Bold,
  });
  if (!loaded && !error) return null;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider><SafeAreaProvider>
        <StoreProvider>
          <ThemeProvider>
            <Stack screenOptions={{ headerShown: false, animation: "none" }} />
          </ThemeProvider>
        </StoreProvider>
      </SafeAreaProvider></KeyboardProvider>
    </GestureHandlerRootView>
  );
}
