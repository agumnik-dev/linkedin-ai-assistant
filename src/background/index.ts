const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY as string

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== 'CLAUDE_REQUEST') return

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
      if (data.error) {
        sendResponse({ success: false, error: `API error: ${data.error.message}` })
      } else if (!data.content?.[0]?.text) {
        sendResponse({ success: false, error: `Unexpected response: ${JSON.stringify(data)}` })
      } else {
        sendResponse({ success: true, result: data.content[0].text.trim() })
      }
    })
    .catch((err) => sendResponse({ success: false, error: err.message }))

  return true // keeps the message channel open for async response
})
