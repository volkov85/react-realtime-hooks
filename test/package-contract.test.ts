import * as React from "react";
import { describe, expect, it } from "vitest";

import packageJson from "../package.json";

describe("package compatibility contract", () => {
  it("declares React 19.2 as the minimum peer version", () => {
    expect(packageJson.peerDependencies.react).toBe("^19.2.0");
  });

  it("runs against a React build that provides useEffectEvent", () => {
    expect(typeof React.useEffectEvent).toBe("function");
  });
});
