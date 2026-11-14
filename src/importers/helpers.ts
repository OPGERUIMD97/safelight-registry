import type { Bookmark, Platform } from '../types'

export function hashId(parts: string[]): string {
  const raw = parts.filter(Boolean).join('|')
  let h = 2166136261
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `b_${(h >>> 0).toString(16)}`
}

export function toIsoFromUnix(ts: number | string | undefined | null): string | null {
  if (ts == null || ts === '') return null
  const n = typeof ts === 'string' ? Number(ts) : ts
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = n > 1e12 ? n : n * 1000
  try {
    return new Date(ms).toISOString()
  } catch {
    return null
  }
}

export function safeUrl(href: unknown): string {
  if (typeof href !== 'string') return ''
  const t = href.trim()
  if (!t) return ''
  if (t.startsWith('http://') || t.startsWith('https://')) return t
  if (t.startsWith('www.')) return `https://${t}`
  return t
}

export function stripJsWrapper(text: string): string {
  const trimmed = text.trim()
  const eq = trimmed.indexOf('=')
  if (eq === -1) return trimmed
  // Twitter YTD style: window.YTD.bookmark.part0 = [...]
  if (/^window\.YTD\./.test(trimmed) || /^window\./.test(trimmed)) {
    return trimmed.slice(eq + 1).trim().replace(/;$/, '')
  }
  return trimmed
}

export function parseJsonLenient(text: string): unknown {
  const cleaned = stripJsWrapper(text)
  return JSON.parse(cleaned)
}

export function makeBookmark(input: {
  platform: Platform
  url: string
  title?: string
  author?: string
  text?: string
  savedAt?: string | null
  sourceFile?: string
  tags?: string[]
}): Bookmark | null {
  const url = safeUrl(input.url)
  const title = (input.title || '').trim()
  const author = (input.author || '').trim()
  const text = (input.text || '').trim()
  if (!url && !title && !text) return null
  const id = hashId([input.platform, url || title, author, input.savedAt || ''])
  return {
    id,
    platform: input.platform,
    url: url || `local://${id}`,
    title: title || author || 'Opgeslagen item',
    author,
    text,
    savedAt: input.savedAt ?? null,
    importedAt: new Date().toISOString(),
    tags: input.tags || [],
    sourceFile: input.sourceFile,
  }
}

export function guessPlatformFromUrl(url: string): Platform {
  const u = url.toLowerCase()
  if (u.includes('instagram.com') || u.includes('instagr.am')) return 'instagram'
  if (u.includes('facebook.com') || u.includes('fb.com') || u.includes('fb.watch')) return 'facebook'
  if (u.includes('x.com/') || u.includes('twitter.com') || u.includes('t.co/')) return 'x'
  return 'other'
}

export function walkStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') {
    out.push(value)
    return out
  }
  if (Array.isArray(value)) {
    for (const v of value) walkStrings(v, out)
    return out
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) walkStrings(v, out)
  }
  return out
}
