import { describe, it, expect } from "vitest";

// LandingTerminal.tsx is a pure re-export shim (see its own comment) with no
// logic of its own — importing both symbols and asserting reference equality
// is a real, strictly-better check than regexing the re-export's source: it
// would catch e.g. a re-export under the right name pointing at the wrong
// module, which a substring match on "GlobalCommandBarLazy" would miss.
//
// #1104: the GlobalCommandBar behavioral assertions that used to live here
// (reading components/GlobalCommandBar.tsx's source — the wrong file for
// this test to be touching in the first place) are already covered by real
// render+interaction tests in components/GlobalCommandBar.render.test.tsx.
describe("LandingTerminal", () => {
  it("re-exports GlobalCommandBarLazy as LandingTerminal", async () => {
    const { LandingTerminal } = await import("./LandingTerminal");
    const { GlobalCommandBarLazy } = await import(
      "@/components/GlobalCommandBarLazy"
    );
    expect(LandingTerminal).toBe(GlobalCommandBarLazy);
  });
});
