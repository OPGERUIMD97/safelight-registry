import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { Bookmark } from './types'

interface SavesDB extends DBSchema {
  bookmarks: {
    key: string
    value: Bookmark
    indexes: {
      'by-platform': string
      'by-savedAt': string
      'by-url': string
    }
  }
}

const DB_NAME = 'saves-bookmark-tool'
const DB_VERSION = 1

let dbPromise: Promise<IDBPDatabase<SavesDB>> | null = null

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<SavesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const store = db.createObjectStore('bookmarks', { keyPath: 'id' })
        store.createIndex('by-platform', 'platform')
        store.createIndex('by-savedAt', 'savedAt')
        store.createIndex('by-url', 'url')
      },
    })
  }
  return dbPromise
}

export async function listBookmarks(): Promise<Bookmark[]> {
  const db = await getDb()
  const all = await db.getAll('bookmarks')
  return all.sort((a, b) => {
    const at = a.savedAt || a.importedAt
    const bt = b.savedAt || b.importedAt
    return bt.localeCompare(at)
  })
}

export async function upsertBookmarks(items: Bookmark[]): Promise<{ added: number; skipped: number }> {
  const db = await getDb()
  let added = 0
  let skipped = 0
  const tx = db.transaction('bookmarks', 'readwrite')
  for (const item of items) {
    const existing = await tx.store.index('by-url').get(item.url)
    if (existing && item.url) {
      skipped += 1
      continue
    }
    const byId = await tx.store.get(item.id)
    if (byId) {
      skipped += 1
      continue
    }
    await tx.store.put(item)
    added += 1
  }
  await tx.done
  return { added, skipped }
}

export async function deleteBookmark(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('bookmarks', id)
}

export async function clearAllBookmarks(): Promise<void> {
  const db = await getDb()
  await db.clear('bookmarks')
}

export async function updateBookmarkTags(id: string, tags: string[]): Promise<void> {
  const db = await getDb()
  const item = await db.get('bookmarks', id)
  if (!item) return
  await db.put('bookmarks', { ...item, tags })
}
