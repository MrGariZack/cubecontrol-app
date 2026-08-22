import type { PresetSlotId } from "@tonehub/cube-baby-protocol";
import type { LiveParamsSnapshot } from "../library/types";

export type LiveCheckpoint = {
  readonly label: string;
  readonly params: LiveParamsSnapshot;
  readonly slot: PresetSlotId;
};

const MAX = 40;

export function createLiveHistory() {
  let undo: LiveCheckpoint[] = [];
  let redo: LiveCheckpoint[] = [];

  function snapshotOf(item: LiveCheckpoint): LiveCheckpoint {
    return { label: item.label, params: { ...item.params }, slot: item.slot };
  }

  return {
    push(current: LiveCheckpoint): void {
      undo = [...undo, snapshotOf(current)].slice(-MAX);
      redo = [];
    },
    popUndo(current: LiveCheckpoint): LiveCheckpoint | null {
      const prev = undo[undo.length - 1];
      if (prev === undefined) return null;
      undo = undo.slice(0, -1);
      redo = [...redo, snapshotOf(current)].slice(-MAX);
      return prev;
    },
    popRedo(current: LiveCheckpoint): LiveCheckpoint | null {
      const next = redo[redo.length - 1];
      if (next === undefined) return null;
      redo = redo.slice(0, -1);
      undo = [...undo, snapshotOf(current)].slice(-MAX);
      return next;
    },
    clear(): void {
      undo = [];
      redo = [];
    },
    counts(): { readonly undo: number; readonly redo: number } {
      return { undo: undo.length, redo: redo.length };
    },
  };
}
