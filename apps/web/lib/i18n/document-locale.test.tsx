// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import {
  DocumentLocaleMarker,
} from "./document-locale";
import { DOCUMENT_LOCALE_BOOTSTRAP } from "./document-locale-bootstrap";

describe("document locale synchronization", () => {
  let observer: MutationObserver | undefined;

  afterEach(() => {
    observer?.disconnect();
    observer = undefined;
    document.documentElement.lang = "";
    vi.restoreAllMocks();
  });

  it("updates the document language without client-rendering an executable script", async () => {
    document.documentElement.lang = "en";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<DocumentLocaleMarker locale="es" />);

    await waitFor(() => expect(document.documentElement.lang).toBe("es"));
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining(
        "Encountered a script tag while rendering React component",
      ),
    );

    rerender(<DocumentLocaleMarker locale="en" />);
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });

  it("restores the root locale when a nested route marker is removed", async () => {
    const { rerender } = render(
      <>
        <DocumentLocaleMarker locale="en" />
        <DocumentLocaleMarker locale="es" />
      </>,
    );
    await waitFor(() => expect(document.documentElement.lang).toBe("es"));

    rerender(<DocumentLocaleMarker locale="en" />);
    await waitFor(() => expect(document.documentElement.lang).toBe("en"));
  });

  it("applies a server-rendered marker during initial document parsing", () => {
    document.documentElement.lang = "en";
    const marker = document.createElement("template");
    marker.setAttribute("data-chapa-document-locale", "es");
    document.body.append(marker);

    observer = Function(`return ${DOCUMENT_LOCALE_BOOTSTRAP.trim()}`)();

    expect(document.documentElement.lang).toBe("es");
    marker.remove();
  });
});
