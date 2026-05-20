import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { LoginForm } from './_components/login-form'

export const metadata: Metadata = {
  title: 'Sign in — Swish',
}

export default async function LoginPage(): Promise<React.JSX.Element> {
  const user = await getSessionUser()
  if (user) redirect('/dashboard')

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-lg border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="mb-1 text-2xl font-semibold tracking-tight">Sign in to Swish</h1>
        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Email and password on the local Supabase stack.
        </p>
        <LoginForm />
      </div>
    </main>
  )
}
