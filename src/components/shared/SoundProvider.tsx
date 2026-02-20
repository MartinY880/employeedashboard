// ProConnect — SoundProvider
// Context provider for UI sound effects using use-sound with WAV files

"use client";

import {
  createContext,
  useContext,
  useCallback,
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import useSound from "use-sound";

interface SoundContextType {
  playClick: () => void;
  playNotify: () => void;
  playSuccess: () => void;
  playPop: () => void;
  muted: boolean;
  toggleMute: () => void;
}

const SoundContext = createContext<SoundContextType>({
  playClick: () => {},
  playNotify: () => {},
  playSuccess: () => {},
  playPop: () => {},
  muted: false,
  toggleMute: () => {},
});

export function useSounds() {
  return useContext(SoundContext);
}

interface SoundProviderProps {
  children: ReactNode;
}

export function SoundProvider({ children }: SoundProviderProps) {
  const [muted, setMuted] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("proconnect-sound-muted") === "true";
  });

  // Persist mute preference
  useEffect(() => {
    localStorage.setItem("proconnect-sound-muted", String(muted));
  }, [muted]);

  const soundOptions = { volume: 0.4, soundEnabled: !muted };

  const [playClickSound] = useSound("/sounds/click.wav", { ...soundOptions, volume: 0.3 });
  const [playNotifySound] = useSound("/sounds/notify.wav", { ...soundOptions, volume: 0.5 });
  const [playSuccessSound] = useSound("/sounds/success.wav", soundOptions);
  const [playPopSound] = useSound("/sounds/pop.wav", { ...soundOptions, volume: 0.35 });

  // Debounce rapid-fire sounds (e.g. multiple clicks) — 50ms minimum between same sound
  const lastPlayRef = useRef<Record<string, number>>({});

  const throttledPlay = useCallback((key: string, fn: () => void) => {
    const now = Date.now();
    if (now - (lastPlayRef.current[key] || 0) < 50) return;
    lastPlayRef.current[key] = now;
    fn();
  }, []);

  const playClick = useCallback(() => throttledPlay("click", playClickSound), [throttledPlay, playClickSound]);
  const playNotify = useCallback(() => throttledPlay("notify", playNotifySound), [throttledPlay, playNotifySound]);
  const playSuccess = useCallback(() => throttledPlay("success", playSuccessSound), [throttledPlay, playSuccessSound]);
  const playPop = useCallback(() => throttledPlay("pop", playPopSound), [throttledPlay, playPopSound]);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);

  return (
    <SoundContext.Provider
      value={{ playClick, playNotify, playSuccess, playPop, muted, toggleMute }}
    >
      {children}
    </SoundContext.Provider>
  );
}
