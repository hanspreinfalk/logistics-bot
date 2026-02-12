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

- **Input:** `persons/all.csv` — one row per person: `company_name` and `full_name` (partial names like "Juan Pablo" work; Prospeo match can be "Juan Pablo Narchi").
- **Flow:** For each row, find that person in Prospeo by company + name → enrich → write casual Manifest-style message ("Hey I saw you were in Manifest too [Name]!...") → append to **`persons/filtered.csv`**.
- **Output:** `persons/filtered.csv`

**`persons/all.csv`** format:

```csv
company_name,full_name
ADL Final Mile,Monte Ohara
Some 3PL,Juan Pablo
```

## Run

```bash
npm i
npm start
```

Set `INPUT_MODE` in `src/main.js`, then run `npm start`. Existing company+person pairs in the relevant `filtered.csv` are skipped.
