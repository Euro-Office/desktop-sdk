export type CustomAiActionType = 0 | 1 | 2;

export interface CustomAiAction {
  id: string;
  name: string;
  query: string;
  type: CustomAiActionType;
  additionalAction: string;
  iconId: string;
  profileId: string | null;
}
