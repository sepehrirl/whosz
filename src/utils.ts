import { randomBytes } from "node:crypto";

export function makeId(prefix: string): string {
  return prefix + "_" + randomBytes(9).toString("base64url");
}

export function makeInviteToken(): string {
  return randomBytes(12).toString("base64url");
}

export function percent(correct: number, total: number): number {
  return total === 0 ? 0 : Math.round((correct / total) * 100);
}
