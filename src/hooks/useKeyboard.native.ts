import { useKeyboardState } from 'react-native-keyboard-controller';

// The controller observes IME visibility even when Android Back dismisses the
// keyboard without blurring the focused composer (including Expo Go).
export function useKeyboard() {
  return useKeyboardState(state => state.isVisible);
}
