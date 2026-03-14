export default function RootLoading() {
  return (
    <main
      id="main-content"
      className="flex min-h-screen items-center justify-center bg-bg px-6"
      role="status"
      aria-label="Loading"
    >
      <span className="sr-only">Loading Chapa...</span>

      <div className="w-full max-w-md">
        {/* Terminal window chrome */}
        <div className="rounded-xl border border-stroke bg-card overflow-hidden">
          {/* Title bar with traffic light dots */}
          <div className="flex items-center gap-2 border-b border-stroke px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-terminal-red/60" aria-hidden="true" />
            <div className="h-3 w-3 rounded-full bg-terminal-yellow/60" aria-hidden="true" />
            <div className="h-3 w-3 rounded-full bg-terminal-green/60" aria-hidden="true" />
            <span className="ml-2 font-heading text-xs text-terminal-dim">chapa</span>
          </div>

          {/* Terminal body */}
          <div className="space-y-3 p-4">
            {/* Command line 1: initializing */}
            <div className="animate-terminal-fade-in font-heading text-sm">
              <span className="text-terminal-dim select-none">$ </span>
              <span className="text-text-secondary">chapa init</span>
            </div>

            {/* Output lines (skeleton) */}
            <div className="motion-reduce:animate-none animate-terminal-fade-in space-y-2 pl-4 border-l border-stroke [animation-delay:200ms]">
              <div className="flex items-center gap-2">
                <span className="font-heading text-xs text-terminal-dim">&gt;</span>
                <div className="h-3 w-24 rounded bg-text-secondary/15" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-xs text-terminal-dim">&gt;</span>
                <div className="h-3 w-36 rounded bg-text-secondary/10" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-heading text-xs text-terminal-dim">&gt;</span>
                <div className="h-3 w-20 rounded bg-text-secondary/10" />
              </div>
            </div>

            {/* Command line 2: loading profile */}
            <div className="animate-terminal-fade-in font-heading text-sm [animation-delay:400ms]">
              <span className="text-amber">chapa &gt;</span>{" "}
              <span className="text-text-secondary">loading profile</span>
              <span className="ml-1 inline-block h-4 w-2 animate-cursor-blink motion-reduce:hidden bg-amber" />
            </div>

            {/* Score skeleton */}
            <div className="animate-terminal-fade-in motion-reduce:animate-none flex items-center gap-3 pl-4 border-l border-stroke [animation-delay:600ms]">
              <div className="h-3 w-16 rounded bg-amber/15" />
              <div className="h-3 w-10 rounded bg-text-secondary/10" />
            </div>
          </div>
        </div>

        {/* Subtle loading indicator below terminal */}
        <div className="mt-4 flex justify-center">
          <div className="animate-shimmer motion-reduce:animate-none h-1 w-24 rounded-full bg-amber/10" />
        </div>
      </div>
    </main>
  );
}
