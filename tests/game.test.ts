import { describe, expect, it } from "vitest";
import { percent, makeInviteToken } from "../src/utils.js";

describe("WHOZ scoring",()=>{
  it("calculates percentages",()=>{
    expect(percent(10,10)).toBe(100);
    expect(percent(8,10)).toBe(80);
    expect(percent(0,10)).toBe(0);
  });
  it("creates opaque invite tokens",()=>{
    const token=makeInviteToken();
    expect(token.length).toBeGreaterThan(10);
    expect(token).not.toMatch(/^\d+$/);
  });
});
