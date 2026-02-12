# logistics-bot

Choose how you want to run: by **companies** (AI picks the decision maker per company) or by **persons** (you list specific people; bot finds them in Prospeo and writes a Manifest-style message).

## Input mode: companies vs persons

In **`src/main.js`** set:

```js
const INPUT_MODE = 'companies';  // or 'persons'
```

### Companies mode (`INPUT_MODE = 'companies'`)

- **Input:** `data/companies.csv` — one company name per line (header: `company_name`).
- **Flow:** For each company, fetch persons from Prospeo → AI picks the decision maker → enrich → write professional outbound message → append to **`data/filtered.csv`**.
- **Output:** `data/filtered.csv`

**`data/companies.csv`** format:

```csv
company_name
Microsoft
Amazon
Apple
```

### Persons mode (`INPUT_MODE = 'persons'`)

- **Input:** `persons/all.csv` — one row per person: `company_name`, `full_name`, and optional `position` (e.g. job title). Fully AI: no Prospeo; AI finds LinkedIn URL and writes Manifest-style message.
- **Flow:** For each row, AI uses web search to find the person’s LinkedIn URL and writes the outbound message → append to **`persons/filtered.csv`**.
- **Output:** `persons/filtered.csv` with columns: `company_name`, `full_name`, `position`, `linkedin_url`, `outbound_message`. The `position` column is taken from `all.csv` (leave empty if you don’t have it).

**`persons/all.csv`** format:

```csv
company_name,full_name,position
ADL Final Mile,Monte Ohara,Chief Executive Officer
Some 3PL,Juan Pablo,Cofundador y COO
```

## Run

```bash
npm i
npm start
```

Set `INPUT_MODE` in `src/main.js`, then run `npm start`. Existing company+person pairs in the relevant `filtered.csv` are skipped.
