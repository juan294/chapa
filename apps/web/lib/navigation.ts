/** App-owned client navigation may be handed to a mounted editor's unload guard. */
export const APP_NAVIGATION_EVENT = "chapa:app-navigation";

export function navigateInApp(href: string, push: (href: string) => void): void {
  const event = new CustomEvent<string>(APP_NAVIGATION_EVENT, {
    detail: href,
    cancelable: true,
  });
  if (window.dispatchEvent(event)) push(href);
}

export function navigateDocument(href: string): void {
  window.location.assign(href);
}
