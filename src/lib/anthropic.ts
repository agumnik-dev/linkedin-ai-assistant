export type ActionType = 'outreach' | 'summary' | 'subject' | 'rewrite'

interface ProfileData {
  name: string
  headline: string
  about: string
  experience: string
  tone?: string
  originalMessage?: string
}

export async function callClaude(action: ActionType, profile: ProfileData): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'CLAUDE_REQUEST', action, profile },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
          return
        }
        if (response?.success) {
          resolve(response.result)
        } else {
          reject(new Error(response?.error ?? 'Claude API error'))
        }
      }
    )
  })
}
