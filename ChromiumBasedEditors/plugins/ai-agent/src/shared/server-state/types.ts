import type { ActionType, Profile, ProviderType } from "@onlyoffice/ai-chat";

export type ServerProviderSpecBasedOn = {
  name: string;
  basedOn: ProviderType;
};

export type ServerProviderSpecSource = {
  name: string;
  source: string;
};

export type ServerProviderSpec =
  | ServerProviderSpecBasedOn
  | ServerProviderSpecSource;

export type ServerProfileSpec = {
  id: string;
  name: string;
  providerType: ProviderType | string;
  baseUrl: string;
  key?: string;
  modelId: string;
  capabilities?: number;
  reasoning?: boolean;
};

export type ServerInitPayload = {
  providers?: ServerProviderSpec[];
  profiles?: ServerProfileSpec[];
  assignments?: Partial<Record<ActionType, string>>;
  assignmentsOverride?: boolean;
};

export type ServerProvidersPayload = {
  providers: ServerProviderSpec[];
};

export type ServerSettingsEnvelope =
  | { kind: "serverInit"; data: ServerInitPayload }
  | { kind: "serverProviders"; data: ServerProvidersPayload };

export type ServerStateSnapshot = {
  profiles: ServerProfileSpec[];
  assignments: Partial<Record<ActionType, string>>;
  override: boolean;
};

export type ServerManagedProfile = Profile & { isServerManaged: true };
