import { createAudioPlayer, useAudioPlayer, setAudioModeAsync } from 'expo-audio';

const notificationSound = require('@/assets/sounds/notification.m4a');
let providerOrderLoop: ReturnType<typeof createAudioPlayer> | null = null;

export async function configureAudioModeForUiSounds() {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'mixWithOthers',
  });
}

export async function playProviderOrderSfx() {
  const player = createAudioPlayer(notificationSound);
  try {
    await player.seekTo(0);
    player.play();
  } finally {
    setTimeout(() => player.remove(), 4000);
  }
}

export async function startProviderOrderLoop() {
  stopProviderOrderLoop();
  const player = createAudioPlayer(notificationSound);
  providerOrderLoop = player;
  await player.seekTo(0);
  player.loop = true;
  player.play();
}

export function stopProviderOrderLoop() {
  if (!providerOrderLoop) return;
  providerOrderLoop.pause();
  providerOrderLoop.remove();
  providerOrderLoop = null;
}

export function useSuccessSfx() {
  return useAudioPlayer(undefined);
}

export function useErrorSfx() {
  return useAudioPlayer(undefined);
}
