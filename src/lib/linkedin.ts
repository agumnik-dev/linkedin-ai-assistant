export interface ProfileData {
  name: string
  headline: string
  about: string
  experience: string
}

function getText(selector: string, context: Document | Element = document): string {
  return context.querySelector(selector)?.textContent?.trim() ?? ''
}

export function scrapeProfile(): ProfileData | null {
  const lazyColumn = document.querySelector('[data-testid="lazy-column"]')
  if (!lazyColumn) return null

  // Name is always in the first H2 inside the profile column
  const name = getText('h2', lazyColumn)
  if (!name) return null

  // Headline: first <p> in the column with enough text, skipping badge/action labels
  const skipPhrases = ['Add verification', 'Contact info', 'connections', 'followers']
  const headline = Array.from(lazyColumn.querySelectorAll('p'))
    .map(el => el.textContent?.trim() ?? '')
    .find(t => t.length > 10 && !skipPhrases.some(s => t.includes(s))) ?? ''

  // About: first expandable text box on the page (profile summary)
  const aboutBoxes = document.querySelectorAll('[data-testid="expandable-text-box"]')
  const about = aboutBoxes[0]?.textContent?.trim() ?? ''

  // Experience: look for a section whose heading contains "Experience"
  const sections = Array.from(document.querySelectorAll('section'))
  const expSection = sections.find(s => {
    const heading = s.querySelector('h2, h3')
    return heading?.textContent?.trim().toLowerCase().includes('experience')
  })
  const experience = expSection
    ? Array.from(expSection.querySelectorAll('p, span'))
        .map(el => el.textContent?.trim() ?? '')
        .filter(t => t.length > 3 && t.length < 100)
        .slice(0, 10)
        .join(' | ')
        .slice(0, 600)
    : ''

  return { name, headline, about: about.slice(0, 600), experience }
}

export function isProfilePage(): boolean {
  return /linkedin\.com\/in\//.test(window.location.href)
}
