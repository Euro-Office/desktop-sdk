import type { ActionIconId } from "./icons";

export type CustomAiActionType =
  | "hint"
  | "replace"
  | "replace-hint"
  | "replace-in-chat"
  | "in-chat";

export interface CustomAiAction {
  id: string;
  name: string;
  query: string;
  type: CustomAiActionType;
  additionalAction: string;
  iconId: ActionIconId;
  profileId: string | null;
}
