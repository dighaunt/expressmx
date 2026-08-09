import { useAudioPlayer, setAudioModeAsync } from 'expo-audio';

export async function configureAudioModeForUiSounds() {
  await setAudioModeAsync({
    playsInSilentMode: false,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  });
}

export function useSuccessSfx() {
  return useAudioPlayer(undefined);
}

export function useErrorSfx() {
  return useAudioPlayer(undefined);
}
