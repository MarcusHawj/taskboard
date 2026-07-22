import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  console.warn(
    'Supabase is not configured. Copy .env.example to .env and add your project URL and anon key.',
  )
}

// Falls back to harmless placeholders so the app can render a config screen
// instead of crashing at import time.
export const supabase = createClient(
  url ?? 'https://placeholder.supabase.co',
  anonKey ?? 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      storageKey: 'taskboard.guest.session',
    },
  },
)

/**
 * Returns the current guest user, creating an anonymous session on first launch.
 * The session persists in localStorage, so a returning visitor keeps their board.
 */
export async function ensureGuestSession(): Promise<string> {
  const { data: existing, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  if (existing.session?.user) return existing.session.user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  if (!data.user) throw new Error('Could not start a guest session.')
  return data.user.id
}
