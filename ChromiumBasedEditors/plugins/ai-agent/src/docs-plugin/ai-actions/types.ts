export interface CustomAiAction {
  id: string;
  name: string;
  query: string;
  additionalAction: string;
  iconId: string;
  profileId: string | null;
}
