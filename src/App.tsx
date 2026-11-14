import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import {
  clearAllBookmarks,
  deleteBookmark,
  listBookmarks,
  upsertBookmarks,
} from './db'
import { importFiles } from './importers'
import { createSampleBookmarks, unifiedTemplate } from './sampleData'
import type { Bookmark, PlatformFilter, View } from './types'
import './index.css'

const FILTERS: { id: PlatformFilter; label: string }[] = [
  { id: 'all', label: 'Alles' },
  { id: 'x', label: 'X' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'other', label: 'Overig' },
]

function formatDate(value: string | null): string {
  if (!value) return 'onbekend'
  try {
    return new Intl.DateTimeFormat('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'Europe/Amsterdam',
    }).format(new Date(value))
  } catch {
    return value.slice(0, 10)
  }
}

function platformLabel(platform: Bookmark['platform']): string {
  if (platform === 'x') return 'X'
  if (platform === 'instagram') return 'Instagram'
  if (platform === 'facebook') return 'Facebook'
  return 'Overig'
}

export default function App() {
  const [view, setView] = useState<View>('library')
  const [items, setItems] = useState<Bookmark[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<PlatformFilter>('all')
  const [ready, setReady] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string; details?: string[] } | null>(
    null,
  )
  const [toast, setToast] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const fileRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    const all = await listBookmarks()
    setItems(all)
    setReady(true)
  }

  useEffect(() => {
    void refresh()
  }, [])

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(t)
  }, [toast])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return items.filter((item) => {
      if (filter !== 'all' && item.platform !== filter) return false
      if (!q) return true
      const hay = `${item.title} ${item.author} ${item.text} ${item.url} ${item.tags.join(' ')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query, filter])

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || (Array.isArray(files) ? files.length === 0 : files.length === 0)) return
    setBusy(true)
    setStatus(null)
    try {
      const { bookmarks, result } = await importFiles(files)
      if (!bookmarks.length) {
        setStatus({
          kind: 'err',
          text: 'Geen bookmarks gevonden in dit bestand.',
          details: result.errors,
        })
        return
      }
      const saved = await upsertBookmarks(bookmarks)
      await refresh()
      setStatus({
        kind: 'ok',
        text: `${saved.added} toegevoegd${saved.skipped ? `, ${saved.skipped} overgeslagen (duplicaten)` : ''}.`,
        details: result.errors,
      })
      setToast(`${saved.added} items geïmporteerd`)
      startTransition(() => setView('library'))
    } catch (err) {
      setStatus({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Import mislukt',
      })
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function loadSamples() {
    const samples = createSampleBookmarks()
    const saved = await upsertBookmarks(samples)
    await refresh()
    setToast(`${saved.added} sample-items geladen`)
    setView('library')
  }

  async function removeItem(id: string) {
    await deleteBookmark(id)
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  async function wipeLibrary() {
    if (!window.confirm('Weet je zeker dat je de hele lokale library wilt wissen?')) return
    await clearAllBookmarks()
    setItems([])
    setToast('Library gewist')
  }

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(unifiedTemplate, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'saves-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/" onClick={(e) => { e.preventDefault(); setView('library') }}>
          <div className="brand-mark">
            Sav<span>es</span>
          </div>
          <div className="brand-sub">Social Media Bookmark Tool</div>
        </a>
        <nav className="nav" aria-label="Hoofdnavigatie">
          <button type="button" className={view === 'library' ? 'active' : ''} onClick={() => setView('library')}>
            Library
          </button>
          <button type="button" className={view === 'import' ? 'active' : ''} onClick={() => setView('import')}>
            Importer
          </button>
        </nav>
      </header>

      {view === 'library' && items.length === 0 && ready && (
        <section className="hero">
          <h1>
            Jouw saves.
            <br />
            <em>Eén plek.</em>
          </h1>
          <p>
            Lokale browser voor opgeslagen items van X, Instagram en Facebook.
            Importeer een export-ZIP of JSON — alles blijft op dit apparaat.
          </p>
          <div className="cta-row">
            <button type="button" className="btn btn-primary" onClick={() => setView('import')}>
              Importeer exports
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => void loadSamples()}>
              Laad sample-data
            </button>
          </div>
        </section>
      )}

      {view === 'library' && (items.length > 0 || !ready) && (
        <>
          <div className="toolbar">
            <input
              className="search"
              type="search"
              placeholder="Zoek in titel, tekst, auteur…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Zoeken"
            />
            <div className="filters" role="group" aria-label="Platformfilter">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`chip ${filter === f.id ? 'active' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="count">
              {filtered.length} / {items.length}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="empty">Geen items voor deze filter.</div>
          ) : (
            <div className="grid">
              {filtered.map((item, index) => (
                <article
                  key={item.id}
                  className="card"
                  style={{ animationDelay: `${Math.min(index, 12) * 0.03}s` }}
                >
                  <div className="card-meta">
                    <span className={`platform ${item.platform}`}>{platformLabel(item.platform)}</span>
                    <time dateTime={item.savedAt || item.importedAt}>
                      {formatDate(item.savedAt || item.importedAt)}
                    </time>
                  </div>
                  <h2>{item.title}</h2>
                  {item.author ? <div className="author">{item.author}</div> : null}
                  {item.text ? <p className="excerpt">{item.text}</p> : null}
                  <div className="card-actions">
                    {item.url.startsWith('http') ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        Open origineel
                      </a>
                    ) : null}
                    <button type="button" className="delete" onClick={() => void removeItem(item.id)}>
                      Verwijder
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="cta-row" style={{ marginTop: '1.5rem' }}>
              <button type="button" className="btn btn-ghost" onClick={() => setView('import')}>
                Meer importeren
              </button>
              <button type="button" className="btn btn-danger" onClick={() => void wipeLibrary()}>
                Wis library
              </button>
            </div>
          )}
        </>
      )}

      {view === 'import' && (
        <section className="import-layout">
          <div
            className={`dropzone ${dragging ? 'active' : ''}`}
            onDragEnter={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              void handleFiles(e.dataTransfer.files)
            }}
          >
            <h2>{busy ? 'Bezig met importeren…' : 'Drop je export hier'}</h2>
            <p>
              ZIP of JSON van Instagram, Facebook of X. Of ons eigen{' '}
              <button
                type="button"
                className="btn btn-ghost"
                style={{ padding: '0.15rem 0.55rem', display: 'inline' }}
                onClick={downloadTemplate}
              >
                saves-template.json
              </button>
              .
            </p>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => fileRef.current?.click()}>
              Kies bestanden
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".zip,.json,.js,application/zip,application/json"
              multiple
              onChange={(e) => void handleFiles(e.target.files)}
            />
          </div>

          {status && (
            <div className={`status ${status.kind}`}>
              <strong>{status.text}</strong>
              {status.details && status.details.length > 0 ? (
                <ul>
                  {status.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          )}

          <div className="help-grid">
            <div className="help-item">
              <h3>Instagram</h3>
              <ol>
                <li>Instellingen → Jouw activiteit</li>
                <li>Download jouw informatie</li>
                <li>Kies JSON, inclusief Saved</li>
                <li>Upload de ZIP hier</li>
              </ol>
            </div>
            <div className="help-item">
              <h3>Facebook</h3>
              <ol>
                <li>Instellingen → Jouw Facebook-informatie</li>
                <li>Download jouw informatie</li>
                <li>Selecteer Saved items (JSON)</li>
                <li>Upload de ZIP hier</li>
              </ol>
            </div>
            <div className="help-item">
              <h3>X</h3>
              <ol>
                <li>Settings → Your account</li>
                <li>Download an archive of your data</li>
                <li>Of plak bookmarks in ons JSON-template</li>
                <li>Upload ZIP/JSON hier</li>
              </ol>
            </div>
          </div>

          <div className="cta-row">
            <button type="button" className="btn btn-ghost" onClick={() => void loadSamples()}>
              Laad sample-data
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setView('library')}>
              Terug naar library
            </button>
          </div>
        </section>
      )}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  )
}
