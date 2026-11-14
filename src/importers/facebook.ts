import type { Bookmark } from '../types'
import { makeBookmark, safeUrl, toIsoFromUnix, walkStrings } from './helpers'

function extractUrlFromAttachments(attachments: unknown): string {
  if (!Array.isArray(attachments)) return ''
  for (const att of attachments) {
    if (!att || typeof att !== 'object') continue
    const a = att as Record<string, unknown>
    const data = a.data
    if (Array.isArray(data)) {
      for (const d of data) {
        if (d && typeof d === 'object') {
          const ext = (d as Record<string, unknown>).external_context as
            | { url?: string }
            | undefined
          if (ext?.url) return safeUrl(ext.url)
          if (typeof (d as Record<string, unknown>).url === 'string') {
            return safeUrl((d as Record<string, unknown>).url as string)
          }
        }
      }
    }
    if (typeof a.url === 'string') return safeUrl(a.url)
  }
  return ''
}

function fromSaveEntry(entry: unknown, sourceFile: string): Bookmark | null {
  if (!entry || typeof entry !== 'object') return null
  const e = entry as Record<string, unknown>

  const title = typeof e.title === 'string' ? e.title : typeof e.name === 'string' ? e.name : ''
  let url =
    extractUrlFromAttachments(e.attachments) ||
    (typeof e.uri === 'string' ? e.uri : '') ||
    (typeof e.url === 'string' ? e.url : '') ||
    (typeof e.href === 'string' ? e.href : '')

  // Fallback: first facebook/http url in the subtree
  if (!url) {
    const strings = walkStrings(e)
    url =
      strings.find((s) => /https?:\/\/(www\.)?(facebook|fb)\.com\//i.test(s)) ||
      strings.find((s) => /^https?:\/\//i.test(s)) ||
      ''
  }

  let text = ''
  if (Array.isArray(e.data)) {
    for (const d of e.data) {
      if (d && typeof d === 'object') {
        const post = (d as Record<string, unknown>).post
        if (typeof post === 'string') text = post
      }
    }
  }
  if (!text && typeof e.description === 'string') text = e.description

  return makeBookmark({
    platform: 'facebook',
    url,
    title: title || 'Facebook save',
    text,
    savedAt: toIsoFromUnix(e.timestamp as number | string | undefined),
    sourceFile,
  })
}

export function parseFacebookJson(data: unknown, sourceFile: string): Bookmark[] {
  const out: Bookmark[] = []
  const pushList = (list: unknown) => {
    if (!Array.isArray(list)) return
    for (const entry of list) {
      const b = fromSaveEntry(entry, sourceFile)
      if (b) out.push(b)
    }
  }

  if (Array.isArray(data)) {
    pushList(data)
    return out
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of [
      'saves_v2',
      'saves',
      'saved_items',
      'saved_items_v2',
      'label_values',
    ]) {
      if (obj[key]) pushList(obj[key])
    }
    // Sometimes wrapped once more
    for (const v of Object.values(obj)) {
      if (Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && 'title' in (v[0] as object)) {
        pushList(v)
      }
    }
  }

  return out
}

export function looksLikeFacebook(path: string, data: unknown): boolean {
  const p = path.toLowerCase()
  if (p.includes('facebook') || p.includes('saved_items') || p.includes('your_saved')) return true
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data as object)
    return keys.some((k) => /saves_v2|saved_items/i.test(k))
  }
  return false
}
