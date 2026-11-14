import JSZip from 'jszip'
import type { Bookmark, ImportResult, Platform } from '../types'
import { guessPlatformFromUrl, makeBookmark, parseJsonLenient } from './helpers'
import { looksLikeFacebook, parseFacebookJson } from './facebook'
import { looksLikeInstagram, parseInstagramJson } from './instagram'
import { looksLikeX, parseXJson } from './x'

function parseUnified(data: unknown, sourceFile: string): Bookmark[] {
  if (!data || typeof data !== 'object') return []
  const obj = data as Record<string, unknown>
  const items = obj.items || obj.bookmarks || obj.saves
  if (!Array.isArray(items)) return []

  const out: Bookmark[] = []
  for (const raw of items) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as Record<string, unknown>
    const url = typeof r.url === 'string' ? r.url : ''
    const platformRaw = typeof r.platform === 'string' ? r.platform.toLowerCase() : ''
    let platform: Platform = 'other'
    if (platformRaw === 'x' || platformRaw === 'twitter') platform = 'x'
    else if (platformRaw === 'instagram' || platformRaw === 'ig') platform = 'instagram'
    else if (platformRaw === 'facebook' || platformRaw === 'fb') platform = 'facebook'
    else platform = guessPlatformFromUrl(url)

    const b = makeBookmark({
      platform,
      url,
      title: typeof r.title === 'string' ? r.title : '',
      author: typeof r.author === 'string' ? r.author : '',
      text: typeof r.text === 'string' ? r.text : typeof r.description === 'string' ? r.description : '',
      savedAt: typeof r.savedAt === 'string' ? r.savedAt : null,
      sourceFile,
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === 'string') : [],
    })
    if (b) out.push(b)
  }
  return out
}

function parseByHeuristic(path: string, data: unknown): Bookmark[] {
  const file = path.split('/').pop() || path

  // Explicit unified schema
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    const keys = Object.keys(data as object)
    if (keys.includes('items') || keys.includes('bookmarks') || keys.includes('saves')) {
      const unified = parseUnified(data, file)
      if (unified.length) return unified
    }
  }

  if (looksLikeInstagram(path, data)) {
    const ig = parseInstagramJson(data, file)
    if (ig.length) return ig
  }
  if (looksLikeFacebook(path, data)) {
    const fb = parseFacebookJson(data, file)
    if (fb.length) return fb
  }
  if (looksLikeX(path, data)) {
    const x = parseXJson(data, file)
    if (x.length) return x
  }

  // Try all parsers, take the richest result
  const candidates = [
    parseInstagramJson(data, file),
    parseFacebookJson(data, file),
    parseXJson(data, file),
    parseUnified(data, file),
  ]
  return candidates.reduce((best, cur) => (cur.length > best.length ? cur : best), [] as Bookmark[])
}

function isUsefulPath(path: string): boolean {
  const p = path.toLowerCase()
  if (p.endsWith('/')) return false
  if (p.includes('__macosx')) return false
  if (!(p.endsWith('.json') || p.endsWith('.js'))) return false
  // Prefer saved/bookmark related files; still allow small root json
  if (
    p.includes('saved') ||
    p.includes('bookmark') ||
    p.includes('saves') ||
    p.includes('instagram') ||
    p.includes('facebook') ||
    p.includes('/data/')
  ) {
    return true
  }
  // Allow top-level simple json names
  const base = p.split('/').pop() || ''
  return ['items.json', 'bookmarks.json', 'saves.json', 'export.json', 'library.json'].includes(base)
}

async function parseTextFile(path: string, text: string): Promise<Bookmark[]> {
  try {
    const data = parseJsonLenient(text)
    return parseByHeuristic(path, data)
  } catch {
    return []
  }
}

export async function importFiles(files: FileList | File[]): Promise<{
  bookmarks: Bookmark[]
  result: ImportResult
}> {
  const list = Array.from(files)
  const collected: Bookmark[] = []
  const errors: string[] = []
  const platforms = new Set<Platform>()

  for (const file of list) {
    const name = file.name.toLowerCase()
    try {
      if (name.endsWith('.zip')) {
        const zip = await JSZip.loadAsync(file)
        let entries = Object.keys(zip.files).filter(isUsefulPath)
        if (!entries.length) {
          // Fallback: try any json/js
          entries = Object.keys(zip.files).filter((p) => {
            const l = p.toLowerCase()
            return (l.endsWith('.json') || l.endsWith('.js')) && !l.includes('__macosx')
          })
        }
        for (const path of entries) {
          const entry = zip.files[path]
          if (!entry || entry.dir) continue
          const text = await entry.async('string')
          const parsed = await parseTextFile(path, text)
          for (const b of parsed) {
            collected.push(b)
            platforms.add(b.platform)
          }
        }
        if (!entries.length) {
          errors.push(`${file.name}: geen JSON/JS bestanden gevonden in ZIP`)
        }
      } else if (name.endsWith('.json') || name.endsWith('.js')) {
        const text = await file.text()
        const parsed = await parseTextFile(file.name, text)
        for (const b of parsed) {
          collected.push(b)
          platforms.add(b.platform)
        }
        if (!parsed.length) {
          errors.push(`${file.name}: geen herkenbare opgeslagen items gevonden`)
        }
      } else {
        errors.push(`${file.name}: ondersteund zijn ZIP, JSON of JS exports`)
      }
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof Error ? err.message : 'kon niet gelezen worden'}`)
    }
  }

  // Dedupe within this batch by url+id
  const seen = new Set<string>()
  const unique: Bookmark[] = []
  for (const b of collected) {
    const key = `${b.platform}|${b.url}|${b.title}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(b)
  }

  let platformGuess: ImportResult['platformGuess'] = 'unknown'
  if (platforms.size === 1) platformGuess = [...platforms][0]
  else if (platforms.size > 1) platformGuess = 'mixed'

  return {
    bookmarks: unique,
    result: {
      added: unique.length,
      skipped: 0,
      platformGuess,
      errors,
    },
  }
}

export { parseUnified }
