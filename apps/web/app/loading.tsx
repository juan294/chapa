export default function RootLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-6 h-8 w-8 animate-pulse rounded-full bg-amber/20" />
        <p className="font-heading text-sm text-text-secondary">Loading...</p>
      </div>
    </main>
  );
}
