import * as React from "react";
import { describe, expect, it } from "vitest";

import packageJson from "../package.json";

describe("package compatibility contract", () => {
  it("supports React 18 and 19 via the peer dependency range", () => {
    expect(packageJson.peerDependencies.react).toBe(">=18.0.0 <20.0.0");
  });

  it("runs against a React build that provides useSyncExternalStore", () => {
    expect(typeof React.useSyncExternalStore).toBe("function");
  });
});
