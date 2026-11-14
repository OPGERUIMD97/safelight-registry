import type { Bookmark } from '../types'
import { makeBookmark, toIsoFromUnix } from './helpers'

function fromSavedMediaEntry(entry: unknown, sourceFile: string): Bookmark | null {
  if (!entry || typeof entry !== 'object') return null
  const e = entry as Record<string, unknown>

  // Format A: string_map_data["Saved on"].href
  const smd = e.string_map_data as Record<string, { href?: string; timestamp?: number; value?: string }> | undefined
  if (smd) {
    const savedOn = smd['Saved on'] || smd['Saved'] || Object.values(smd)[0]
    const href = savedOn?.href || ''
    const title = typeof e.title === 'string' ? e.title : ''
    return makeBookmark({
      platform: 'instagram',
      url: href,
      title: title || 'Instagram save',
      author: title,
      savedAt: toIsoFromUnix(savedOn?.timestamp),
      sourceFile,
    })
  }

  // Format B: direct fields
  const href =
    (typeof e.href === 'string' && e.href) ||
    (typeof e.url === 'string' && e.url) ||
    (typeof e.link === 'string' && e.link) ||
    ''
  const title = typeof e.title === 'string' ? e.title : typeof e.name === 'string' ? e.name : ''
  return makeBookmark({
    platform: 'instagram',
    url: href,
    title: title || 'Instagram save',
    author: title,
    savedAt: toIsoFromUnix(e.timestamp as number | string | undefined),
    sourceFile,
  })
}

export function parseInstagramJson(data: unknown, sourceFile: string): Bookmark[] {
  const out: Bookmark[] = []

  const pushList = (list: unknown) => {
    if (!Array.isArray(list)) return
    for (const entry of list) {
      const b = fromSavedMediaEntry(entry, sourceFile)
      if (b) out.push(b)
    }
  }

  if (Array.isArray(data)) {
    pushList(data)
    return out
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    // Common IG export keys
    for (const key of [
      'saved_saved_media',
      'saved_media',
      'saved_posts',
      'saved_saved_posts',
      'media',
    ]) {
      if (obj[key]) pushList(obj[key])
    }
    // Collections: { collections: [ { media: [...] } ] }
    if (Array.isArray(obj.collections)) {
      for (const col of obj.collections) {
        if (col && typeof col === 'object') {
          const c = col as Record<string, unknown>
          pushList(c.media || c.saved_media || c.items)
        }
      }
    }
  }

  return out
}

export function looksLikeInstagram(path: string, data: unknown): boolean {
  const p = path.toLowerCase()
  if (p.includes('instagram') || p.includes('saved_posts') || p.includes('saved_media')) return true
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data as object)
    return keys.some((k) => /saved_.*media|saved_posts/i.test(k))
  }
  return false
}
