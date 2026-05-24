const FREE_DAILY_LIMIT = 10
const STORAGE_KEY = 'lai_usage'

interface UsageRecord {
  date: string
  count: number
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

export async function getUsageCount(): Promise<number> {
  return new Promise((resolve) => {
    chrome.storage.local.get(STORAGE_KEY, (result) => {
      const record = result[STORAGE_KEY] as UsageRecord | undefined
      if (!record || record.date !== today()) {
        resolve(0)
      } else {
        resolve(record.count)
      }
    })
  })
}

export async function incrementUsage(): Promise<void> {
  const count = await getUsageCount()
  const record: UsageRecord = { date: today(), count: count + 1 }
  chrome.storage.local.set({ [STORAGE_KEY]: record })
}

export async function canUse(): Promise<boolean> {
  const count = await getUsageCount()
  return count < FREE_DAILY_LIMIT
}

export function getRemainingUses(count: number): number {
  return Math.max(0, FREE_DAILY_LIMIT - count)
}
