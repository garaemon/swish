/**
 * Placeholder landing page. PR 7 replaces this with a Supabase-aware
 * redirect that routes signed-in users to /dashboard and everyone else
 * to /login.
 */
export default function Home(): React.JSX.Element {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Swish</h1>
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Personal RSS / bookmark manager focused on Inbox Zero. Setup in
          progress — see the repository README for next steps.
        </p>
      </div>
    </main>
  );
}
