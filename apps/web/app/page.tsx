import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Root route. proxy.ts treats "/" as a protected path (the matcher only
 * excludes /api, _next assets, and SVGs) but the proxy redirect goes to
 * /login on missing auth. This component handles the authed case
 * explicitly: send signed-in users to /dashboard, anyone else to /login.
 */
export default async function Home(): Promise<never> {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  redirect(user ? '/dashboard' : '/login')
}
