# logistics-bot

## Structure

```
logistics-bot/
├── src/
│   ├── main.js             # Entry point: get companies → fetch persons per company → save to data/{company}{datetime}/
│   ├── api/
│   │   └── prospeo.js       # Prospeo API client (searchCompany, searchPerson, fetchPersonsAndSaveCsv)
│   ├── data/
│   │   └── read.js         # getCompanies() – reads company list from data/companies.csv
│   └── bot.js              # AI bot script (Claude + web search), writes to runs/
├── data/
│   ├── companies.csv       # Input: list of company names (one per line, header: company_name)
│   └── {CompanyName}-{datetime}/   # Output: one folder per company run, each with persons.csv
│       └── persons.csv
└── runs/                   # Output: AI bot run results (.md files)
```

## Commands

- **Fetch persons for all companies and save CSVs:** `npm start` or `node src/main.js`
- **Run AI bot (web search, save to runs/):** `node src/bot.js`

## Data

- Edit `data/companies.csv` to change the list of companies (header row required).
- Person CSVs are written to `data/{CompanyName}-{datetime}/persons.csv` (e.g. `data/Microsoft-2026-02-12T14-30-52/persons.csv`).

## Getting full email and mobile (Prospeo)

**Search Person** returns **masked** email and mobile (e.g. `w****@company.com`, `+1 617-8**-****`). To get **revealed** values you must call the **Enrich Person API** after search:

1. **Identify the person** using one of:
   - **`person_id`** from Search Person results (recommended)
   - Or `first_name` + `last_name` + `company_website` (or `company_name`)
   - Or `full_name` + `company_website`
   - Or `linkedin_url` alone

2. **Call `enrichPerson()`** from `src/api/prospeo.js`:
   - **Email:** returned by default when matched (1 credit per match). Use `only_verified_email: true` to only get verified emails.
   - **Mobile:** set `enrich_mobile: true` to reveal mobile when present (**10 credits** per match).

3. **Example** (after you have search results with `person_id`):

```js
import { enrichPerson } from './src/api/prospeo.js';

const { person, company } = await enrichPerson({
  person_id: 'aaaae9c8f9da02cb8e485220',  // from Search Person result
  only_verified_email: true,
  enrich_mobile: true,   // optional, costs 10 credits per match
});
// person.email.email, person.mobile.mobile are now revealed (if available)
```

For many persons, use the [Bulk Enrich Person API](https://prospeo.io/api-docs/bulk-enrich-person) (up to 50 per request) to save credits and time.
