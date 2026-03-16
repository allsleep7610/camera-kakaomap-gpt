import { describe, expect, test } from "vitest";

import {
  classifyCameraQuery,
  extractLastFourDigits,
  normalizeCameraCode,
} from "../src/lib/camera-code.js";

describe("camera code helpers", () => {
  test("normalizes spaces and hyphens", () => {
    expect(normalizeCameraCode(" a-1234 ")).toBe("A1234");
  });

  test("classifies four digits as suffix query", () => {
    expect(classifyCameraQuery("1234").queryType).toBe("suffix");
  });

  test("extracts the last four digits", () => {
    expect(extractLastFourDigits("AB-91234")).toBe("1234");
  });
});
