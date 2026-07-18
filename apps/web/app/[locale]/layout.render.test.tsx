// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import LocaleSegmentLayout, { generateStaticParams, dynamicParams } from "./layout";

afterEach(cleanup);

describe("generateStaticParams", () => {
  it("pre-renders both supported locales", () => {
    expect(generateStaticParams()).toEqual([{ locale: "en" }, { locale: "es" }]);
  });
});

describe("dynamicParams", () => {
  it("rejects any locale outside the pre-rendered set", () => {
    expect(dynamicParams).toBe(false);
  });
});

describe("LocaleSegmentLayout", () => {
  it("renders its children unchanged, as a pure pass-through", () => {
    render(
      <LocaleSegmentLayout>
        <div data-testid="child">content</div>
      </LocaleSegmentLayout>,
    );
    expect(screen.getByTestId("child")).toBeDefined();
    expect(screen.getByText("content")).toBeDefined();
  });
});
