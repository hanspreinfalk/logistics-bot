# logistics-bot

Add your company list in **`data/companies.csv`** in this format:

```csv
company_name
Microsoft
Amazon
Apple
Google
Meta
Tesla
Prospeo.io
Mercor
Cursor
OpenAI
```

(Header row `company_name`, then one company name per line.)

## Run

```bash
npm i
npm start
```

`npm start` reads `data/companies.csv`, finds decision makers per company (Prospeo + AI), writes personalized outbound messages, and appends results to **`data/filtered.csv`**.
