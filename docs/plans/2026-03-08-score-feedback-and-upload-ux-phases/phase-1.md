# Phase 1: Toast Component [batch-eligible]

> Reusable floating notification rendered via `createPortal` to `document.body`.

## Objective

Create a `Toast` component that shows transient feedback above all UI — processing states, success messages, errors. Follows existing portal pattern from `InfoTooltip.tsx`.

## Changes

### 1.1 — Create `Toast.tsx` (`apps/web/components/Toast.tsx`)

```typescript
// New file — reusable toast notification

interface ToastProps {
  message: string;
  /** Optional secondary line (e.g. "Score: 58 → 61") */
  detail?: string;
  type: "loading" | "success" | "error" | "info";
  /** Auto-dismiss after ms. 0 = persistent until manually dismissed. Default: 4000 */
  duration?: number;
  onDismiss?: () => void;
}

export function Toast({ message, detail, type, duration = 4000, onDismiss }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration <= 0) return;
    const timer = setTimeout(() => {
      setVisible(false);
      // Delay onDismiss to let exit animation complete
      setTimeout(() => onDismiss?.(), 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  if (typeof document === "undefined") return null; // SSR guard

  const icon = TYPE_ICONS[type]; // loading spinner, checkmark, X, info
  const colorClass = TYPE_COLORS[type]; // terminal-green, terminal-red, amber, text-secondary

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`
        fixed top-5 right-5 z-[9998] flex items-start gap-3
        rounded-xl border border-stroke bg-card px-4 py-3
        shadow-xl shadow-stroke/20 backdrop-blur-sm
        max-w-sm min-w-[280px]
        ${visible ? "animate-scale-in" : "animate-toast-out"}
      `}
    >
      <span className={`mt-0.5 flex-shrink-0 ${colorClass}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{message}</p>
        {detail && (
          <p className="mt-0.5 text-xs text-text-secondary">{detail}</p>
        )}
      </div>
      {onDismiss && type !== "loading" && (
        <button
          onClick={() => { setVisible(false); onDismiss(); }}
          aria-label="Dismiss notification"
          className="flex-shrink-0 rounded-full p-1 text-text-secondary hover:text-text-primary transition-colors"
        >
          {/* X icon, 14x14 */}
        </button>
      )}
    </div>,
    document.body,
  );
}
```

**TYPE_ICONS map:**
- `loading`: spinning SVG (`animate-spin`, amber color)
- `success`: checkmark SVG (terminal-green)
- `error`: X-circle SVG (terminal-red)
- `info`: info-circle SVG (text-secondary)

**TYPE_COLORS map:**
- `loading`: `text-amber`
- `success`: `text-terminal-green`
- `error`: `text-terminal-red`
- `info`: `text-text-secondary`

### 1.2 — Add exit animation (`apps/web/styles/globals.css`)

```css
/* Add alongside existing keyframes */
@keyframes toast-out {
  from { opacity: 1; transform: scale(1) translateY(0); }
  to { opacity: 0; transform: scale(0.95) translateY(-8px); }
}
```

And register in `@theme`:
```css
--animate-toast-out: toast-out 0.3s ease-in forwards;
```

### 1.3 — Tests (`apps/web/components/Toast.test.tsx`)

```typescript
describe("Toast", () => {
  it("renders via portal to document.body", () => {
    render(<Toast message="Test" type="success" />);
    // Toast renders outside React root
    expect(document.body.querySelector('[role="status"]')).toBeTruthy();
  });

  it("shows message and detail text", () => {
    render(<Toast message="Uploaded!" detail="Score: 58 → 61" type="success" />);
    expect(screen.getByText("Uploaded!")).toBeTruthy();
    expect(screen.getByText("Score: 58 → 61")).toBeTruthy();
  });

  it("shows loading spinner for type=loading", () => {
    render(<Toast message="Processing…" type="loading" />);
    expect(document.body.querySelector('.animate-spin')).toBeTruthy();
  });

  it("auto-dismisses after duration", async () => {
    const onDismiss = vi.fn();
    render(<Toast message="Test" type="success" duration={100} onDismiss={onDismiss} />);
    await vi.advanceTimersByTimeAsync(500);
    expect(onDismiss).toHaveBeenCalled();
  });

  it("does not auto-dismiss when duration=0", async () => {
    const onDismiss = vi.fn();
    render(<Toast message="Test" type="info" duration={0} onDismiss={onDismiss} />);
    await vi.advanceTimersByTimeAsync(10000);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("shows dismiss button for non-loading types", () => {
    render(<Toast message="Done" type="success" onDismiss={() => {}} />);
    expect(screen.getByLabelText("Dismiss notification")).toBeTruthy();
  });

  it("hides dismiss button for loading type", () => {
    render(<Toast message="Loading…" type="loading" onDismiss={() => {}} />);
    expect(screen.queryByLabelText("Dismiss notification")).toBeNull();
  });

  it("has correct aria attributes", () => {
    render(<Toast message="Test" type="success" />);
    const toast = document.body.querySelector('[role="status"]');
    expect(toast?.getAttribute("aria-live")).toBe("polite");
  });
});
```

## Tests

### New tests:
1. Portal rendering — Toast renders to `document.body`, not inside parent
2. Message + detail display
3. Type-specific icon rendering (spinner for loading)
4. Auto-dismiss timing
5. Persistent mode (duration=0)
6. Dismiss button visibility by type
7. Accessibility attributes

## Verification

```bash
pnpm run typecheck 2>&1; pnpm run lint 2>&1; pnpm run test -- Toast 2>&1
```

## Success Criteria

### Automated
- [x] Toast renders via `createPortal` to `document.body`
- [x] 4 types with correct icons and colors
- [x] Auto-dismiss works with configurable duration
- [x] Exit animation plays before removal
- [x] Accessible: `role="status"`, `aria-live="polite"`
- [x] SSR-safe (no `document` access during SSR)
