import { ActionType } from "../capabilities";
import { SYSTEM_PROMPT } from "../providers/prompts";
import { type BaseProvider, createProvider } from "../providers/registry";
import type { Profile } from "../types";

/**
 * Holds a dedicated (non-singleton) provider instance for a specific action type.
 * Each action type gets its own provider so they don't share state.
 */
class ActionHolder {
  private provider?: BaseProvider;
  private providerType?: string;

  getProvider(): BaseProvider | undefined {
    return this.provider;
  }

  applyProfile(profile: Profile | null, fallback: Profile | null): void {
    const effective = profile ?? fallback;
    if (!effective) {
      this.provider = undefined;
      this.providerType = undefined;
      return;
    }

    // Reuse existing instance if same provider type
    if (this.providerType !== effective.providerType) {
      this.provider = createProvider(effective.providerType);
      this.providerType = effective.providerType;
    }

    if (!this.provider) return;

    this.provider.setProvider({
      type: effective.providerType,
      name: effective.name,
      baseUrl: effective.baseUrl,
      key: effective.key,
    });
    this.provider.setSystemPrompt(SYSTEM_PROMPT);
    this.provider.setModelKey(effective.modelId);
    this.provider.isReasoning = effective.reasoning ?? false;
  }
}

const actionHolders = new Map<ActionType, ActionHolder>();

/**
 * Initialize action holders — call once at startup.
 */
export function initActionHolders(): void {
  for (const actionType of Object.values(ActionType)) {
    if (!actionHolders.has(actionType)) {
      actionHolders.set(actionType, new ActionHolder());
    }
  }
}

/**
 * Get the provider configured for a specific action type.
 * Returns undefined if not configured or provider type is unknown.
 */
export function getActionProvider(
  actionType: ActionType
): BaseProvider | undefined {
  return actionHolders.get(actionType)?.getProvider();
}

/**
 * Configure the provider for a specific action type.
 * Falls back to defaultProfile if taskProfile is null.
 */
export function applyProfileToAction(
  actionType: ActionType,
  taskProfile: Profile | null,
  defaultProfile: Profile | null
): void {
  const holder = actionHolders.get(actionType);
  if (!holder) return;

  holder.applyProfile(taskProfile, defaultProfile);
}
