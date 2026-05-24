import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string

// Chrome storage adapter — service workers have no localStorage
const chromeStorage = {
  getItem: (key: string) =>
    chrome.storage.local.get(key).then((r) => (r[key] as string) ?? null),
  setItem: (key: string, value: string) =>
    chrome.storage.local.set({ [key]: value }),
  removeItem: (key: string) => chrome.storage.local.remove(key),
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: chromeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

export async function getProfile(userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', userId)
    .single()
  return data
}
