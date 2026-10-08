# Archived party programmes

One folder per party and edition: `sources/programs/{party}/{edition}/`, e.g. `sources/programs/pp/2023-general/`.

Each folder holds the official programme file exactly as downloaded, plus `source.json`:

```json
{
  "url": "original address",
  "retrievedAt": "YYYY-MM-DD",
  "sha256": "sha256:…",
  "waybackUrl": "https://web.archive.org/web/…",
  "languages": ["es"],
  "pages": 0
}
```

The same `url`, `waybackUrl`, `retrievedAt`, file path and hash are recorded in `data/parties/parties.json` under the party's `programEditions`; validation fails if the file is missing or its hash differs. Proposal quotes cite `program-{party}-{edition}` with a page number.

When a new general election is called, add a new edition folder; old editions stay archived.
