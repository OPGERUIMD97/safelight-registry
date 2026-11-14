import type { Bookmark } from '../types'
import { makeBookmark, toIsoFromUnix } from './helpers'

function tweetUrl(id: string, screenName?: string): string {
  if (screenName) return `https://x.com/${screenName}/status/${id}`
  return `https://x.com/i/web/status/${id}`
}

function fromBookmarkEntry(entry: unknown, sourceFile: string): Bookmark | null {
  if (!entry || typeof entry !== 'object') return null
  const root = entry as Record<string, unknown>
  const bookmark = (root.bookmark || root) as Record<string, unknown>
  const tweet =
    (bookmark.tweet as Record<string, unknown> | undefined) ||
    (bookmark.tweetObject as Record<string, unknown> | undefined) ||
    bookmark

  const tweetId =
    (typeof bookmark.tweetId === 'string' && bookmark.tweetId) ||
    (typeof tweet.id_str === 'string' && tweet.id_str) ||
    (typeof tweet.id === 'string' && tweet.id) ||
    (typeof tweet.id === 'number' && String(tweet.id)) ||
    ''

  const user =
    (tweet.user as Record<string, unknown> | undefined) ||
    (tweet.author as Record<string, unknown> | undefined) ||
    {}
  const screenName =
    (typeof user.screen_name === 'string' && user.screen_name) ||
    (typeof user.username === 'string' && user.username) ||
    (typeof bookmark.userName === 'string' && bookmark.userName) ||
    ''

  const text =
    (typeof tweet.full_text === 'string' && tweet.full_text) ||
    (typeof tweet.text === 'string' && tweet.text) ||
    (typeof bookmark.text === 'string' && bookmark.text) ||
    ''

  const created =
    toIsoFromUnix(tweet.created_at as string | number | undefined) ||
    (typeof tweet.created_at === 'string' ? new Date(tweet.created_at).toISOString() : null) ||
    toIsoFromUnix(bookmark.createdAt as string | number | undefined)

  if (!tweetId && !text) {
    // Plain URL bookmark
    const url =
      (typeof bookmark.url === 'string' && bookmark.url) ||
      (typeof root.url === 'string' && root.url) ||
      ''
    if (!url) return null
    return makeBookmark({
      platform: 'x',
      url,
      title: text || 'X bookmark',
      author: screenName,
      text,
      savedAt: created,
      sourceFile,
    })
  }

  return makeBookmark({
    platform: 'x',
    url: tweetId ? tweetUrl(tweetId, screenName || undefined) : '',
    title: text ? text.slice(0, 80) : `Bookmark ${tweetId}`,
    author: screenName ? `@${screenName}` : '',
    text,
    savedAt: created,
    sourceFile,
  })
}

export function parseXJson(data: unknown, sourceFile: string): Bookmark[] {
  const out: Bookmark[] = []
  const pushList = (list: unknown) => {
    if (!Array.isArray(list)) return
    for (const entry of list) {
      const b = fromBookmarkEntry(entry, sourceFile)
      if (b) out.push(b)
    }
  }

  if (Array.isArray(data)) {
    pushList(data)
    return out
  }

  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['bookmarks', 'bookmark', 'items', 'data']) {
      if (obj[key]) pushList(obj[key])
    }
    // If object values look like bookmark parts
    for (const v of Object.values(obj)) {
      if (Array.isArray(v)) pushList(v)
    }
  }

  return out
}

export function looksLikeX(path: string, data: unknown): boolean {
  const p = path.toLowerCase()
  if (
    p.includes('bookmark') ||
    p.includes('/x/') ||
    p.includes('twitter') ||
    p.endsWith('bookmark.js')
  ) {
    return true
  }
  if (Array.isArray(data) && data[0] && typeof data[0] === 'object') {
    const first = data[0] as Record<string, unknown>
    return 'bookmark' in first || 'tweetId' in first
  }
  return false
}
