# Saves — Social Media Bookmark Tool

Lokale browser + importer voor opgeslagen items van **X**, **Instagram** en **Facebook**.

Alles blijft in IndexedDB op dit apparaat. Geen extensie, geen cloud-sync.

## Starten

```bash
npm install
npm run dev
```

## Importeren

1. Download je data-export bij Instagram / Facebook / X (JSON).
2. Open **Importer** in de app.
3. Drop de ZIP of JSON.

Je kunt ook `saves-template.json` gebruiken voor handmatige items:

```json
{
  "items": [
    {
      "platform": "x",
      "url": "https://x.com/…",
      "title": "…",
      "author": "@…",
      "text": "…",
      "savedAt": "2025-01-15T12:00:00.000Z",
      "tags": []
    }
  ]
}
```

## Wat het doet

- Importeert platform-exports (best-effort parsers)
- Dedupliceert op URL
- Zoeken + filteren op platform
- Sample-data om de UI te proberen zonder export
