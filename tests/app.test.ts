import { describe, expect, test } from "vitest";

import { createApp } from "../src/app.js";

describe("app routes", () => {
  const app = createApp("data/cameras.sample.json");

  test("serves exact camera lookups", async () => {
    const response = await app.request("/camera-link?cameraCode=A1234");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.matched).toBe(true);
    expect(payload.results[0]?.cameraCode).toBe("A1234");
  });

  test("serves suffix camera lookups", async () => {
    const response = await app.request("/camera-link?cameraCode=1234");
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.queryType).toBe("suffix");
    expect(payload.count).toBe(3);
  });

  test("rejects missing cameraCode", async () => {
    const response = await app.request("/camera-link");
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.matched).toBe(false);
  });
});
