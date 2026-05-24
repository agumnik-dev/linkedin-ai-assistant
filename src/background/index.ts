import { createClient } from '@supabase/supabase-js'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string

const chromeStorage = {
  getItem: (key: string) =>
    chrome.storage.local.get(key).then((r) => (r[key] as string) ?? null),
  setItem: (key: string, value: string) =>
    chrome.storage.local.set({ [key]: value }),
  removeItem: (key: string) => chrome.storage.local.remove(key),
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: chromeStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function signIn(): Promise<void> {
  const redirectTo = chrome.identity.getRedirectURL()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo, skipBrowserRedirect: true },
  })
  if (error || !data.url) throw error ?? new Error('No auth URL returned')

  const callbackUrl = await new Promise<string>((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url: data.url, interactive: true }, (url) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
      else if (!url) reject(new Error('Auth cancelled'))
      else resolve(url)
    })
  })

  await chrome.storage.local.remove('lai_debug_callback')

  const parsed = new URL(callbackUrl)
  const hashParams = new URLSearchParams(parsed.hash.slice(1))

  // PKCE flow: code in search params
  const code = parsed.searchParams.get('code')
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) throw new Error(`Exchange failed: ${exchangeError.message}`)
    return
  }

  // Implicit flow: tokens in hash fragment
  const accessToken = hashParams.get('access_token')
  const refreshToken = hashParams.get('refresh_token')
  if (!accessToken || !refreshToken) {
    throw new Error(`No tokens in callback: ${callbackUrl.slice(0, 200)}`)
  }

  const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
  if (sessionError) throw new Error(`Set session failed: ${sessionError.message}`)
}

async function getAuthState(): Promise<{ userId: string | null; email: string | null; isPro: boolean }> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return { userId: null, email: null, isPro: false }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', session.user.id)
    .single()

  return {
    userId: session.user.id,
    email: session.user.email ?? null,
    isPro: profile?.is_pro ?? false,
  }
}

// ── Claude prompts ────────────────────────────────────────────────────────────

type ActionType = 'outreach' | 'summary' | 'subject' | 'rewrite'

interface ProfileData {
  name: string
  headline: string
  about: string
  experience: string
  tone?: string
  originalMessage?: string
}

const prompts: Record<ActionType, (p: ProfileData) => string> = {
  outreach: (p) => `You are a professional recruiter writing a LinkedIn connection request.
Write a personalized, friendly outreach message (max 300 chars).

Name: ${p.name}
Headline: ${p.headline}
About: ${p.about}
Experience: ${p.experience}

Write only the message text, no quotes.`,

  summary: (p) => `Summarize this LinkedIn profile in exactly 3 bullet points (use • symbol).
Each bullet should be one concise sentence highlighting a key strength.

Name: ${p.name}
Headline: ${p.headline}
About: ${p.about}
Experience: ${p.experience}

Write only the 3 bullets, nothing else.`,

  subject: (p) => `Write a compelling InMail subject line for this profile (max 60 chars).
Make it specific to their background, not generic.

Name: ${p.name}
Headline: ${p.headline}

Write only the subject line, no quotes.`,

  rewrite: (p) => `Rewrite this message in a ${p.tone ?? 'professional'} tone, same intent.

Original: ${p.originalMessage}

Write only the rewritten message.`,
}

// ── Message handler ───────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CLAUDE_REQUEST') {
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        messages: [{ role: 'user', content: prompts[message.action as ActionType](message.profile) }],
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) sendResponse({ success: false, error: `API error: ${data.error.message}` })
        else if (!data.content?.[0]?.text) sendResponse({ success: false, error: `Unexpected response: ${JSON.stringify(data)}` })
        else sendResponse({ success: true, result: data.content[0].text.trim() })
      })
      .catch((err) => sendResponse({ success: false, error: err.message }))
    return true
  }

  if (message.type === 'AUTH_SIGN_IN') {
    signIn()
      .then(() => getAuthState())
      .then(async (state) => {
        // Persist auth state so popup can read it even after it closed during OAuth
        await chrome.storage.local.set({ lai_auth: state })
        sendResponse({ success: true, ...state })
      })
      .catch(async (err) => {
        await chrome.storage.local.set({ lai_auth: { userId: null, email: null, isPro: false, error: err.message } })
        sendResponse({ success: false, error: err.message })
      })
    return true
  }

  if (message.type === 'AUTH_SIGN_OUT') {
    supabase.auth.signOut()
      .then(async () => {
        await chrome.storage.local.remove('lai_auth')
        sendResponse({ success: true })
      })
      .catch((err) => sendResponse({ success: false, error: err.message }))
    return true
  }

  if (message.type === 'AUTH_GET_STATE') {
    getAuthState()
      .then(async (state) => {
        await chrome.storage.local.set({ lai_auth: state })
        sendResponse({ success: true, ...state })
      })
      .catch((err) => sendResponse({ success: false, error: err.message }))
    return true
  }
})
