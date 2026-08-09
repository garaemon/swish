import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loginErrorMessage } from '@/lib/auth/login-errors';
import { getSessionUser } from '@/lib/auth/session';
import { GoogleSignInButton } from './_components/google-button';
import { LoginForm } from './_components/login-form';

export const metadata: Metadata = {
  title: 'Sign in — Swish',
};

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[] }>
}

export default async function LoginPage({
  searchParams,
}: LoginPageProps): Promise<React.JSX.Element> {
  const user = await getSessionUser();
  if (user) {
    redirect('/dashboard');
  }

  // Next 16 hands searchParams over as a promise; awaited after the session
  // check so the already-signed-in path stays a plain redirect.
  const { error } = await searchParams;
  const errorMessage = loginErrorMessage(Array.isArray(error) ? error[0] : error);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sign in to Swish</h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Continue with Google, or use an email and password.
        </p>
        {errorMessage ? (
          <p
            role="alert"
            className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
          >
            {errorMessage}
          </p>
        ) : null}
        <LoginForm />
        <div className="my-4 flex items-center gap-3 text-xs uppercase tracking-wide text-zinc-400">
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          or
          <span className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <GoogleSignInButton />
      </div>
    </main>
  );
}
