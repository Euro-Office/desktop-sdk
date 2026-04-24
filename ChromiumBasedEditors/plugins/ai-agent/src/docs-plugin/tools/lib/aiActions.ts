import { type ActionType, getActionProvider } from "@onlyoffice/ai-chat";
import { editor } from "../../library/editor";

/** User-facing label for editor block-action indicator (shown while AI runs). */
export function getAiBlockLabel(action: ActionType): string {
  const provider = getActionProvider(action);
  const modelName = provider?.modelKey || provider?.getName() || "AI";
  return `AI (${modelName})`;
}

/** Model identifier used for attribution (e.g. comment author, AI revision name). */
export function getModelAttribution(action: ActionType): string {
  const provider = getActionProvider(action);
  return provider?.modelKey || provider?.getName() || "AI";
}

export interface BlockActionGuard {
  /** Idempotent: sends EndAction only once even if called multiple times. */
  end: () => Promise<void>;
}

/**
 * Starts a "Block" action with the given label (shown as a long-running
 * indicator in the editor) and returns a guard whose `end()` is idempotent.
 * Mirrors the `checkEndAction` / `isSendedEndLongAction` pattern from the
 * legacy plugin.
 */
export async function startBlockAction(
  label: string
): Promise<BlockActionGuard> {
  await editor.callMethod("StartAction", ["Block", label]);
  let ended = false;
  return {
    end: async () => {
      if (ended) return;
      ended = true;
      await editor.callMethod("EndAction", ["Block", label]);
    },
  };
}

export async function startGroupActions(): Promise<void> {
  await editor.callMethod("StartAction", ["GroupActions"]);
}

export async function endGroupActions(): Promise<void> {
  await editor.callMethod("EndAction", ["GroupActions"]);
}

/** Cancels the current GroupActions (undoes all edits made inside it). */
export async function cancelGroupActions(): Promise<void> {
  await editor.callMethod("EndAction", ["GroupActions", "", "cancel"]);
}
