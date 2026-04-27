/**
 * Frames a stream of concatenated JSON objects ({...}{...}{...}) into discrete
 * complete object strings. Tracks brace depth and string-literal state so it
 * can resume across chunk boundaries.
 */
export class JsonObjectFramer {
  private buf = "";

  push(chunk: string): void {
    if (chunk) {
      this.buf += chunk;
    }
  }

  drainObjects(): string[] {
    const out: string[] = [];
    let i = 0;
    let depth = 0;
    let inStr = false;
    let esc = false;
    let start = -1;
    const s = this.buf;
    while (i < s.length) {
      const ch = s[i];
      if (inStr) {
        if (esc) {
          esc = false;
        } else if (ch === "\\") {
          esc = true;
        } else if (ch === '"') {
          inStr = false;
        }
      } else {
        if (ch === '"') {
          inStr = true;
        } else if (ch === "{") {
          if (depth === 0) start = i;
          depth++;
        } else if (ch === "}") {
          depth--;
          if (depth === 0 && start !== -1) {
            out.push(s.slice(start, i + 1));
            start = -1;
          }
        }
      }
      i++;
    }
    this.buf = depth === 0 ? "" : s.slice(start >= 0 ? start : s.length);
    return out;
  }
}

export interface ParsedCmd {
  t: string;
  [key: string]: unknown;
}

export function parseCmd(str: string): ParsedCmd | null {
  try {
    const obj = JSON.parse(str) as ParsedCmd;
    if (!obj || typeof obj.t !== "string") {
      return null;
    }
    return obj;
  } catch {
    return null;
  }
}
