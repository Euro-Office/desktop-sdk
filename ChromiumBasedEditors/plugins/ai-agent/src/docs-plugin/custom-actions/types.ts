import type { ActionIconId } from "./icons";

export type CustomAiActionType =
  | "replace"
  | "replace-in-chat"
  | "in-chat"
  | "as-review"
  | "in-comment"
  | "to-end";

export interface CustomAiAction {
  id: string;
  name: string;
  query: string;
  type: CustomAiActionType;
  iconId: ActionIconId;
  profileId: string | null;
}
