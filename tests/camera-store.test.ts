import { describe, expect, test } from "vitest";

import { loadCameraRepository } from "../src/lib/camera-store.js";

describe("camera repository", async () => {
  const repository = await loadCameraRepository("data/cameras.sample.json");

  test("returns a single camera on exact match", () => {
    const result = repository.lookup("a-1234");
    expect(result.matched).toBe(true);
    expect(result.count).toBe(1);
    expect(result.results[0]?.cameraCode).toBe("A1234");
  });

  test("returns all cameras sharing the same last four digits", () => {
    const result = repository.lookup("1234");
    expect(result.matched).toBe(true);
    expect(result.count).toBe(3);
    expect(result.results.map((item) => item.cameraCode)).toEqual(["A1234", "B1234", "D1234"]);
  });

  test("returns an empty result on unknown code", () => {
    const result = repository.lookup("Z9999");
    expect(result.matched).toBe(false);
    expect(result.count).toBe(0);
  });
});
