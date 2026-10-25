import { KeyboardAvoidingView } from './KeyboardLayout';
import React from "react";
import {
  View,
  Modal,
  ScrollView,
  Platform,
} from "react-native";
import Animated, { SlideInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../theme";
import { Toast } from "./Toast";
import { useStore } from "../data/store";
import { Txt, IconButton } from "./ui";
export function Sheet({
  title,
  onClose,
  children,
  scroll = true,
  contentPadding = 20,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  scroll?: boolean;
  contentPadding?: number;
}) {
  const { c, calm } = useTheme();
  const { error, notice, dismiss } = useStore();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "web" ? undefined : "padding"}
        style={{ flex: 1, backgroundColor: c.bg }}
      >
        <Animated.View
          entering={calm ? undefined : SlideInRight.duration(500)}
          style={{
            width: "100%",
            maxWidth: 460,
            flex: 1,
            alignSelf: "center",
            paddingTop: insets.top,
            backgroundColor: c.bg,
          }}
        >
          <View
            style={{
              height: 66,
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 10,
              borderBottomColor: c.line,
              borderBottomWidth: 0,
            }}
          >
            <IconButton name="back" label="Back" onPress={onClose} />
            <Txt bold size={18}>
              {title}
            </Txt>
          </View>
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: contentPadding,
                paddingBottom: insets.bottom + 32,
              }}
            >
              {children}
            </ScrollView>
          ) : (
            <View
              style={{
                flex: 1,
                paddingHorizontal: contentPadding,
                paddingBottom: insets.bottom + 16,
              }}
            >
              {children}
            </View>
          )}
          {(error||notice)&&<Toast message={error||notice} error={!!error} onClose={dismiss} top={insets.top+70}/>}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
