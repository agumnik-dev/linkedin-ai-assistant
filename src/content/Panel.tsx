import { useState, useEffect } from 'react'
import { scrapeProfile, isProfilePage } from '../lib/linkedin'
import { callClaude, type ActionType } from '../lib/anthropic'
import { canUse, incrementUsage, getUsageCount, getRemainingUses } from '../lib/usage'

const ACTIONS: { id: ActionType; label: string }[] = [
  { id: 'outreach', label: 'Write Outreach' },
  { id: 'summary', label: 'Summarize Profile' },
  { id: 'subject', label: 'InMail Subject' },
  { id: 'rewrite', label: 'Rewrite Message' },
]

export function Panel() {
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [remaining, setRemaining] = useState<number | null>(null)
  const [rewriteTone, setRewriteTone] = useState('professional')
  const [rewriteInput, setRewriteInput] = useState('')
  const [activeAction, setActiveAction] = useState<ActionType | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    getUsageCount().then((c) => setRemaining(getRemainingUses(c)))
  }, [])

  async function run(action: ActionType) {
    setError('')
    setResult('')
    setCopied(false)
    setActiveAction(action)

    const allowed = await canUse()
    if (!allowed) {
      setError('Daily limit reached (10/day on free plan). Upgrade to Pro for unlimited.')
      return
    }

    const profile = scrapeProfile()
    if (!profile) {
      setError('Could not read profile data. Make sure you are on a LinkedIn profile page.')
      return
    }

    if (action === 'rewrite' && !rewriteInput.trim()) {
      setError('Paste your original message in the box below first.')
      return
    }

    setLoading(true)
    try {
      const text = await callClaude(action, {
        ...profile,
        tone: rewriteTone,
        originalMessage: rewriteInput,
      })
      setResult(text)
      await incrementUsage()
      const count = await getUsageCount()
      setRemaining(getRemainingUses(count))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function copyResult() {
    navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!isProfilePage()) return null

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.logo}>✦ AI Assistant</span>
        {remaining !== null && (
          <span style={styles.badge}>{remaining} left today</span>
        )}
      </div>

      <div style={styles.buttons}>
        {ACTIONS.map(({ id, label }) => (
          <button
            key={id}
            style={{ ...styles.btn, ...(activeAction === id && !loading ? styles.btnActive : {}) }}
            onClick={() => run(id)}
            disabled={loading}
          >
            {loading && activeAction === id ? '...' : label}
          </button>
        ))}
      </div>

      {activeAction === 'rewrite' && (
        <div style={styles.rewriteSection}>
          <textarea
            style={styles.textarea}
            placeholder="Paste your original message here..."
            value={rewriteInput}
            onChange={(e) => setRewriteInput(e.target.value)}
            rows={3}
          />
          <select
            style={styles.select}
            value={rewriteTone}
            onChange={(e) => setRewriteTone(e.target.value)}
          >
            <option value="professional">Professional</option>
            <option value="casual">Casual</option>
            <option value="friendly">Friendly</option>
            <option value="direct">Direct</option>
            <option value="enthusiastic">Enthusiastic</option>
          </select>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}

      {result && (
        <div style={styles.resultBox}>
          <pre style={styles.resultText}>{result}</pre>
          <button style={styles.copyBtn} onClick={copyResult}>
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    backgroundColor: '#fff',
    border: '1px solid #e0e0e0',
    borderRadius: '12px',
    padding: '16px',
    margin: '16px 0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    maxWidth: '100%',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  logo: {
    fontWeight: 600,
    fontSize: '14px',
    color: '#0a66c2',
  },
  badge: {
    fontSize: '11px',
    color: '#666',
    backgroundColor: '#f3f3f3',
    padding: '2px 8px',
    borderRadius: '20px',
  },
  buttons: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '8px',
    marginBottom: '12px',
  },
  btn: {
    padding: '8px 12px',
    border: '1px solid #0a66c2',
    borderRadius: '6px',
    background: 'transparent',
    color: '#0a66c2',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    transition: 'all 0.15s',
  },
  btnActive: {
    background: '#0a66c2',
    color: '#fff',
  },
  rewriteSection: {
    marginBottom: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  textarea: {
    width: '100%',
    resize: 'vertical',
    border: '1px solid #ccc',
    borderRadius: '6px',
    padding: '8px',
    fontSize: '12px',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
  },
  select: {
    padding: '6px 8px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    fontSize: '12px',
    background: '#fff',
  },
  error: {
    color: '#d32f2f',
    fontSize: '12px',
    padding: '8px',
    backgroundColor: '#fff3f3',
    borderRadius: '6px',
  },
  resultBox: {
    position: 'relative',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    padding: '12px',
    marginTop: '8px',
  },
  resultText: {
    margin: 0,
    fontSize: '12px',
    lineHeight: '1.6',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#333',
    fontFamily: 'inherit',
  },
  copyBtn: {
    marginTop: '8px',
    padding: '5px 14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    background: '#fff',
    cursor: 'pointer',
    fontSize: '11px',
    color: '#555',
  },
}
