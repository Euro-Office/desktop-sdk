import type { ActionType, AssignmentsStorage } from "@onlyoffice/ai-chat";

const KEY = "storage:assignments";

function read(): Partial<Record<ActionType, string>> {
  const raw = localStorage.getItem(KEY);
  return raw ? (JSON.parse(raw) as Partial<Record<ActionType, string>>) : {};
}

function write(map: Partial<Record<ActionType, string>>): void {
  localStorage.setItem(KEY, JSON.stringify(map));
}

export class LocalStorageAssignmentsStorage implements AssignmentsStorage {
  async create(actionType: ActionType, profileId: string): Promise<void> {
    const map = read();
    map[actionType] = profileId;
    write(map);
  }

  async readByType(actionType: ActionType): Promise<string | null> {
    return read()[actionType] ?? null;
  }

  async readAll(): Promise<Partial<Record<ActionType, string>>> {
    return read();
  }

  async update(actionType: ActionType, profileId: string): Promise<void> {
    const map = read();
    map[actionType] = profileId;
    write(map);
  }

  async upsertMany(
    assignments: Partial<Record<ActionType, string>>
  ): Promise<void> {
    const map = read();
    for (const [key, value] of Object.entries(assignments)) {
      if (value !== undefined) {
        map[key as ActionType] = value;
      }
    }
    write(map);
  }

  async delete(actionType: ActionType): Promise<void> {
    const map = read();
    delete map[actionType];
    write(map);
  }

  async deleteMany(actionTypes: ActionType[]): Promise<void> {
    const map = read();
    for (const t of actionTypes) {
      delete map[t];
    }
    write(map);
  }
}
