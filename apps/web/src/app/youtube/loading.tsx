// CR-2026-11-16-11: skeleton while /youtube (and its country/video pages) load on the server.
export default function Loading() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6" aria-busy="true" aria-label="Chargement">
      <div className="mx-auto max-w-6xl animate-pulse">
        <div className="h-4 w-32 rounded bg-neutral-800" />
        <div className="mt-6 h-9 w-3/4 max-w-xl rounded bg-neutral-800" />
        <div className="mt-3 h-4 w-full max-w-2xl rounded bg-neutral-900" />
        <div className="mt-6 h-28 rounded-2xl bg-neutral-900" />
        <ul className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => <li key={i} className="h-40 rounded-xl bg-neutral-900" />)}
        </ul>
        <p className="sr-only">Chargement des chaînes…</p>
      </div>
    </main>
  );
}
