import { describe, expect, it, vi } from "vitest";
import { MONACO_VS_PATH, configureSelfHostedMonaco } from "./monaco";

describe("configureSelfHostedMonaco", () => {
  it("loads Monaco from the app's own copy, never from a CDN", () => {
    const loader = { config: vi.fn() };
    configureSelfHostedMonaco(loader);
    expect(loader.config).toHaveBeenCalledWith({ paths: { vs: "/monaco/vs" } });
    expect(MONACO_VS_PATH).toBe("/monaco/vs");
  });
});
