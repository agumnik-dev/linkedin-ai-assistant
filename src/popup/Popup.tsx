import { useEffect, useState } from 'react'

const FREE_LIMIT = 10
const CHECKOUT_URL = import.meta.env.VITE_LEMONSQUEEZY_CHECKOUT_URL as string

function today() {
  return new Date().toISOString().split('T')[0]
}

function sendMsg(type: string): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type }, resolve)
  })
}

type AuthState = {
  userId: string | null
  email: string | null
  isPro: boolean
}

export function Popup() {
  const [auth, setAuth] = useState<AuthState | null>(null)
  const [used, setUsed] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    // Read auth state from storage — survives popup close during OAuth
    chrome.storage.local.get(['lai_auth', 'lai_usage'], (result) => {
      const stored = result['lai_auth'] as AuthState & { error?: string } | undefined
      if (stored?.userId) {
        setAuth({ userId: stored.userId, email: stored.email, isPro: stored.isPro })
        if (stored.error) setError(stored.error)
      } else {
        // Fallback: ask background (handles first load before any sign-in)
        sendMsg('AUTH_GET_STATE').then((res) => {
          setAuth({ userId: res.userId as string | null, email: res.email as string | null, isPro: (res.isPro as boolean) ?? false })
        })
      }
      const record = result['lai_usage'] as { date: string; count: number } | undefined
      if (record && record.date === today()) setUsed(record.count)
    })

    // Live-update popup if auth state changes while popup is open
    const listener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
      if (area === 'local' && changes['lai_auth']) {
        const s = changes['lai_auth'].newValue as AuthState | undefined
        if (s) setAuth({ userId: s.userId, email: s.email, isPro: s.isPro })
      }
    }
    chrome.storage.onChanged.addListener(listener)
    return () => chrome.storage.onChanged.removeListener(listener)
  }, [])

  async function handleSignIn() {
    setLoading(true)
    setError('')
    // Fire and forget — popup may close when Google auth window opens.
    // Background stores result in lai_auth; storage.onChanged updates popup if still open.
    chrome.runtime.sendMessage({ type: 'AUTH_SIGN_IN' }, (res) => {
      if (res && !res.success) setError(res.error ?? 'Sign in failed')
      setLoading(false)
    })
  }

  async function handleSignOut() {
    await sendMsg('AUTH_SIGN_OUT')
    setAuth({ userId: null, email: null, isPro: false })
  }

  function openCheckout() {
    chrome.tabs.create({ url: CHECKOUT_URL })
  }

  if (auth === null) {
    return <div style={styles.container}><div style={styles.logo}>✦ LinkedIn AI Assistant</div><div style={styles.muted}>Loading...</div></div>
  }

  const remaining = Math.max(0, FREE_LIMIT - used)
  const pct = (used / FREE_LIMIT) * 100

  return (
    <div style={styles.container}>
      <div style={styles.logo}>✦ LinkedIn AI Assistant</div>

      {!auth.userId ? (
        // ── Not signed in ──
        <div>
          <div style={styles.subtitle}>Sign in to track your usage and upgrade to Pro.</div>
          <div style={styles.features}>
            <div style={styles.feature}>✓ Write outreach messages</div>
            <div style={styles.feature}>✓ Summarize profiles</div>
            <div style={styles.feature}>✓ Generate InMail subjects</div>
            <div style={styles.feature}>✓ Rewrite in any tone</div>
            <div style={{ ...styles.feature, color: '#888' }}>Free: 10 requests/day</div>
          </div>
          <button style={styles.primaryBtn} onClick={handleSignIn} disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>
          {error && <div style={styles.errorText}>{error}</div>}
        </div>
      ) : auth.isPro ? (
        // ── Pro user ──
        <div>
          <div style={styles.proBadge}>⚡ Pro</div>
          <div style={styles.muted}>{auth.email}</div>
          <div style={{ ...styles.muted, marginTop: 8 }}>Unlimited requests</div>
          <button style={styles.secondaryBtn} onClick={handleSignOut}>Sign out</button>
        </div>
      ) : (
        // ── Free user ──
        <div>
          <div style={styles.emailRow}>
            <span style={styles.muted}>{auth.email}</span>
            <button style={styles.linkBtn} onClick={handleSignOut}>Sign out</button>
          </div>
          <div style={styles.usageSection}>
            <div style={styles.usageLabel}>
              <span>Today's usage</span>
              <span style={{ fontWeight: 600 }}>{used} / {FREE_LIMIT}</span>
            </div>
            <div style={styles.bar}>
              <div style={{ ...styles.fill, width: `${pct}%`, backgroundColor: remaining === 0 ? '#e53935' : '#0a66c2' }} />
            </div>
            <div style={styles.muted}>{remaining} requests remaining today</div>
          </div>
          <button style={styles.primaryBtn} onClick={openCheckout}>
            ⚡ Upgrade to Pro — $15/mo
          </button>
          <div style={styles.proNote}>Unlimited requests · Cancel anytime</div>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '260px',
    padding: '16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    color: '#333',
  },
  logo: { fontWeight: 700, fontSize: '15px', color: '#0a66c2', marginBottom: '12px' },
  subtitle: { color: '#555', fontSize: '12px', marginBottom: '12px', lineHeight: '1.5' },
  muted: { color: '#888', fontSize: '11px' },
  features: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' },
  feature: { fontSize: '12px', color: '#555' },
  primaryBtn: {
    width: '100%', padding: '9px', backgroundColor: '#0a66c2', color: '#fff',
    border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px',
    fontWeight: 600, marginTop: '4px',
  },
  secondaryBtn: {
    width: '100%', padding: '8px', backgroundColor: 'transparent', color: '#666',
    border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '12px',
    marginTop: '12px',
  },
  linkBtn: {
    background: 'none', border: 'none', color: '#0a66c2', cursor: 'pointer',
    fontSize: '11px', padding: 0,
  },
  emailRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' },
  usageSection: { marginBottom: '14px' },
  usageLabel: { display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px' },
  bar: { height: '6px', backgroundColor: '#e0e0e0', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' },
  fill: { height: '100%', borderRadius: '3px', transition: 'width 0.3s' },
  proNote: { textAlign: 'center', fontSize: '11px', color: '#888', marginTop: '6px' },
  proBadge: {
    display: 'inline-block', padding: '3px 10px', backgroundColor: '#fff3cd',
    color: '#856404', borderRadius: '20px', fontWeight: 600, fontSize: '13px', marginBottom: '8px',
  },
  errorText: { color: '#d32f2f', fontSize: '11px', marginTop: '6px' },
}
