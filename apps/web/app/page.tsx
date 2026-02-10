export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-4xl font-bold tracking-tight">
        <span className="text-mint">Chapa</span>
      </h1>
      <p className="text-text-secondary text-lg text-center max-w-md">
        Your developer impact, visualized. Coming soon.
      </p>
      <button
        disabled
        className="rounded-lg bg-mint/10 px-6 py-3 text-mint font-medium opacity-50 cursor-not-allowed"
      >
        Sign in with GitHub
      </button>
    </main>
  );
}
