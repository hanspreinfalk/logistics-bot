import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { getCompanies } from './data/read.js';
import { fetchPersonsAndSaveCsv, enrichPerson } from './api/prospeo.js';
import { selectDecisionMaker } from './api/bot.js';

const CSV_HEADERS = ['company_name', 'full_name', 'country', 'email', 'mobile', 'linkedin_url', 'current_job_title'];

function escapeCsv(v) {
  const s = String(v ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toFilteredRow(companyName, person) {
  return {
    company_name: companyName,
    full_name: person?.full_name,
    country: person?.location?.country,
    email: person?.email?.email ?? '',
    mobile: person?.mobile?.mobile ?? '',
    linkedin_url: person?.linkedin_url,
    current_job_title: person?.current_job_title,
  };
}

function getCompaniesAlreadyInFiltered(filteredPath) {
  if (!fs.existsSync(filteredPath)) return new Set();
  const content = fs.readFileSync(filteredPath, 'utf-8');
  const lines = content.split('\n').filter((line) => line.trim());
  if (lines.length <= 1) return new Set();
  const names = lines.slice(1).map((line) => {
    const first = line.split(',')[0] ?? '';
    return first.replace(/^"|"$/g, '').replace(/""/g, '"').trim();
  });
  return new Set(names);
}

async function main() {
  const companyNames = getCompanies();
  console.log('Companies:', companyNames);

  const dataDir = path.join(process.cwd(), 'data');
  const filteredPath = path.join(dataDir, 'filtered.csv');
  const alreadyInFiltered = getCompaniesAlreadyInFiltered(filteredPath);
  if (alreadyInFiltered.size) console.log('Already in filtered.csv:', [...alreadyInFiltered]);

  const datetime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filteredRows = [];

  for (const companyName of companyNames) {
    if (alreadyInFiltered.has(companyName)) {
      console.log(`${companyName}: already in filtered.csv, skipping`);
      continue;
    }
    try {
      const companySlug = companyName.replace(/\s+/g, '-');
      const outputDir = path.join(dataDir, `${companySlug}-${datetime}`);
      const { persons, csvPath } = await fetchPersonsAndSaveCsv(companyName, outputDir);
      if (persons.length === 0) {
        console.log(`${companyName}: not found`);
        continue;
      }
      console.log(`${companyName}: ${persons.length} persons → ${path.relative(process.cwd(), csvPath)}`);

      const decisionMakerId = await selectDecisionMaker(companyName, persons);
      if (!decisionMakerId) {
        console.log(`${companyName}: no decision maker selected, skipping enrich`);
        continue;
      }

      const { person, company } = await enrichPerson({
        person_id: decisionMakerId,
        enrich_mobile: true,
      });
      const row = toFilteredRow(companyName, person);
      filteredRows.push(row);
      console.log(`${companyName}: decision maker ${person?.full_name} → enriched`);
    } catch (err) {
      console.log(`${companyName}: not found`);
    }
  }

  const newRowsCsv = filteredRows.map((row) => CSV_HEADERS.map((h) => escapeCsv(row[h])).join(',')).join('\n');
  let existingRowsCsv = '';
  if (fs.existsSync(filteredPath)) {
    const content = fs.readFileSync(filteredPath, 'utf-8');
    const lines = content.split('\n').filter((line) => line.trim());
    if (lines.length > 1) existingRowsCsv = lines.slice(1).join('\n');
  }
  const csv =
    CSV_HEADERS.join(',') +
    '\n' +
    existingRowsCsv +
    (existingRowsCsv ? '\n' : '') +
    newRowsCsv;
  fs.writeFileSync(filteredPath, csv, 'utf-8');
  console.log(`\nSaved ${filteredRows.length} decision makers to ${path.relative(process.cwd(), filteredPath)}${existingRowsCsv ? ' (appended)' : ''}`);
}

main();
