import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { SignupForm } from './_components/signup-form';

export const metadata: Metadata = {
  title: 'Create account — Swish',
};

export const dynamic = 'force-dynamic';

export default async function SignupPage(): Promise<React.JSX.Element> {
  const user = await getSessionUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Create a Swish account</h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Only email addresses listed in SIGNUP_ALLOWED_EMAILS can sign up.
        </p>
        <SignupForm />
        <p className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          Already have an account?{' '}
          <Link href="/login" className="underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
