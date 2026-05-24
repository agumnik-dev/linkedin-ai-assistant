import { useEffect, useState } from 'react'

const FREE_LIMIT = 10

function today() {
  return new Date().toISOString().split('T')[0]
}

export function Popup() {
  const [used, setUsed] = useState(0)

  useEffect(() => {
    chrome.storage.local.get('lai_usage', (result) => {
      const record = result['lai_usage'] as { date: string; count: number } | undefined
      if (record && record.date === today()) {
        setUsed(record.count)
      }
    })
  }, [])

  const remaining = Math.max(0, FREE_LIMIT - used)
  const pct = (used / FREE_LIMIT) * 100

  return (
    <div style={styles.container}>
      <div style={styles.logo}>✦ LinkedIn AI Assistant</div>
      <div style={styles.subtitle}>Navigate to a LinkedIn profile to use.</div>

      <div style={styles.usageSection}>
        <div style={styles.usageLabel}>
          <span>Today's usage</span>
          <span style={{ fontWeight: 600 }}>{used} / {FREE_LIMIT}</span>
        </div>
        <div style={styles.bar}>
          <div style={{ ...styles.fill, width: `${pct}%` }} />
        </div>
        <div style={styles.remaining}>{remaining} requests remaining today</div>
      </div>

      <div style={styles.features}>
        <div style={styles.feature}>✓ Write outreach messages</div>
        <div style={styles.feature}>✓ Summarize profiles</div>
        <div style={styles.feature}>✓ Generate InMail subjects</div>
        <div style={styles.feature}>✓ Rewrite in any tone</div>
      </div>

      {remaining === 0 && (
        <div style={styles.limitReached}>
          Daily limit reached. Upgrade to Pro for unlimited access.
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
  logo: {
    fontWeight: 700,
    fontSize: '15px',
    color: '#0a66c2',
    marginBottom: '4px',
  },
  subtitle: {
    color: '#888',
    fontSize: '11px',
    marginBottom: '16px',
  },
  usageSection: {
    marginBottom: '16px',
  },
  usageLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '6px',
    fontSize: '12px',
  },
  bar: {
    height: '6px',
    backgroundColor: '#e0e0e0',
    borderRadius: '3px',
    overflow: 'hidden',
    marginBottom: '4px',
  },
  fill: {
    height: '100%',
    backgroundColor: '#0a66c2',
    borderRadius: '3px',
    transition: 'width 0.3s',
  },
  remaining: {
    fontSize: '11px',
    color: '#666',
  },
  features: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginBottom: '12px',
  },
  feature: {
    fontSize: '12px',
    color: '#555',
  },
  limitReached: {
    padding: '8px',
    backgroundColor: '#fff3cd',
    borderRadius: '6px',
    fontSize: '11px',
    color: '#856404',
    textAlign: 'center',
  },
}
