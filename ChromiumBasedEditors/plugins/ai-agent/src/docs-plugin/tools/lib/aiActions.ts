import type { ActionType } from "@onlyoffice/ai-chat";
import { editor } from "../../library/editor";

export function getAiBlockLabel(_action: ActionType): string {
  return "AI";
}

export function getModelAttribution(_action: ActionType): string {
  return "AI";
}

export interface BlockActionGuard {
  end: () => Promise<void>;
}

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

export async function cancelGroupActions(): Promise<void> {
  await editor.callMethod("EndAction", ["GroupActions", "", "cancel"]);
}
