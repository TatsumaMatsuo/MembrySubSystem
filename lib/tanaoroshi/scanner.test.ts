import { describe, it, expect } from "vitest";
import { normalizeItemCode } from "./item-code";

describe("normalizeItemCode", () => {
  it("正常な6文字コードはそのまま", () => {
    expect(normalizeItemCode("F00015")).toBe("F00015");
    expect(normalizeItemCode("FS0005")).toBe("FS0005");
    expect(normalizeItemCode("HSR001")).toBe("HSR001");
  });
  it("Code39 の start/stop 文字(*)を除去", () => {
    expect(normalizeItemCode("*F00001*")).toBe("F00001");
    expect(normalizeItemCode("*F00001")).toBe("F00001");
  });
  it("小文字は大文字化", () => {
    expect(normalizeItemCode("f00015")).toBe("F00015");
  });
  it("全角英数字を半角化", () => {
    expect(normalizeItemCode("Ｆ０００１５")).toBe("F00015");
  });
  it("前後空白を除去", () => {
    expect(normalizeItemCode("  F00015 ")).toBe("F00015");
  });
  it("6文字でない（truncation誤読）は null", () => {
    expect(normalizeItemCode("F0001")).toBeNull(); // 5文字
    expect(normalizeItemCode("F000155")).toBeNull(); // 7文字
    expect(normalizeItemCode("")).toBeNull();
  });
  it("記号を含むものは null", () => {
    expect(normalizeItemCode("F-0015")).toBeNull();
    expect(normalizeItemCode("F 0015")).toBeNull();
  });
});
