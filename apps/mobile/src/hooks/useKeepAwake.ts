import { useEffect } from "react";
import { NativeModules } from "react-native";

type KeepAwakeNative = {
  activate?: (tag: string) => void;
  deactivate?: (tag: string) => void;
  activateAsync?: (tag: string) => Promise<void>;
  deactivateAsync?: (tag: string) => Promise<void>;
};

/**
 * Keep the screen on during a set. Uses ExpoKeepAwake if the native module
 * is in this build; otherwise a no-op (no extra native dep).
 */
export function useKeepAwake(active: boolean, tag = "cubecontrol"): void {
  useEffect(() => {
    if (!active) return;
    const native = NativeModules.ExpoKeepAwake as KeepAwakeNative | undefined;
    if (!native) return;
    void native.activateAsync?.(tag);
    native.activate?.(tag);
    return () => {
      void native.deactivateAsync?.(tag);
      native.deactivate?.(tag);
    };
  }, [active, tag]);
}
