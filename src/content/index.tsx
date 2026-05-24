import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Panel } from './Panel'
function inject(): boolean {
  if (document.getElementById('lai-root')) return true
  if (!/linkedin\.com\/in\//.test(window.location.href)) return true

  const anchor =
    document.querySelector('main') ||
    document.querySelector('.scaffold-layout__main')

  if (!anchor) return false

  const container = document.createElement('div')
  container.id = 'lai-root'
  container.style.cssText = 'max-width:700px;margin:0 auto;'
  anchor.insertAdjacentElement('afterend', container)

  createRoot(container).render(
    <StrictMode>
      <Panel />
    </StrictMode>
  )
  return true
}

// Retry with delays — LinkedIn SPA loads content asynchronously
function tryInject(delays: number[] = [0, 500, 1000, 2000, 4000]) {
  if (delays.length === 0) return
  const [delay, ...rest] = delays
  setTimeout(() => { if (!inject()) tryInject(rest) }, delay)
}

tryInject()

// Re-inject on LinkedIn SPA navigation
let lastUrl = location.href
new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href
    document.getElementById('lai-root')?.remove()
    tryInject([1000, 2000, 3500])
  }
}).observe(document.body, { childList: true, subtree: true })
