import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { getCompanies, getPersonsFromAll } from './data/read.js';
import { fetchPersonsAndSaveCsv, enrichPerson, findPersonByCompanyAndName } from './api/prospeo.js';
import { selectDecisionMaker, writeOutboundMessage } from './api/bot.js';

/** 'companies' = read from data/companies.csv and pick decision maker per company; 'persons' = read from persons/all.csv and find each person by company + full name */
const INPUT_MODE = 'companies';

const CSV_HEADERS = ['company_name', 'full_name', 'country', 'email', 'mobile', 'linkedin_url', 'current_job_title', 'outbound_message'];

function csvCell(h, v) {
  const s = String(v ?? '');
  if (h === 'current_job_title' || h === 'outbound_message') return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toFilteredRow(companyName, person, outboundMessage = '') {
  return {
    company_name: companyName,
    full_name: person?.full_name,
    country: person?.location?.country,
    email: person?.email?.email ?? '',
    mobile: person?.mobile?.mobile ?? '',
    linkedin_url: person?.linkedin_url,
    current_job_title: person?.current_job_title,
    outbound_message: outboundMessage,
  };
}

const DELAY_BETWEEN_COMPANIES_MS = 2500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function personKey(companyName, fullName) {
  return `${(companyName ?? '').trim()}|${(fullName ?? '').trim()}`;
}

/** Returns a Set of keys 'company_name|full_name' for rows already in filtered.csv. Used in both modes to skip when that company+person pair exists. */
function getAlreadyInFiltered(filteredPath) {
  if (!fs.existsSync(filteredPath)) return new Set();
  const content = fs.readFileSync(filteredPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length <= 1) return new Set();
  return new Set(
    lines.slice(1).map((line) => {
      const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
      return personKey(parts[0], parts[1]);
    }),
  );
}

async function main() {
  const dataDir = path.join(process.cwd(), 'data');
  const filteredPath =
    INPUT_MODE === 'persons'
      ? path.join(process.cwd(), 'persons', 'filtered.csv')
      : path.join(dataDir, 'filtered.csv');
  const datetime = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filteredRows = [];
  const alreadyInFiltered = getAlreadyInFiltered(filteredPath);

  if (INPUT_MODE === 'companies') {
    const companyNames = getCompanies();
    console.log('Input: companies.csv →', companyNames);
    if (alreadyInFiltered.size) console.log('Already in filtered.csv:', alreadyInFiltered.size, 'company+person entries');

    for (const companyName of companyNames) {
      try {
        await sleep(DELAY_BETWEEN_COMPANIES_MS);
        const companySlug = companyName.replace(/\s+/g, '-');
        const outputDir = path.join(dataDir, `${companySlug}-${datetime}`);
        const { persons, csvPath } = await fetchPersonsAndSaveCsv(companyName, outputDir);
        if (persons.length === 0) {
          console.log(`${companyName}: not found (0 persons in Prospeo – try exact name e.g. "Tesla, Inc." or "Prospeo.io" in companies.csv)`);
          continue;
        }
        console.log(`${companyName}: ${persons.length} persons → ${path.relative(process.cwd(), csvPath)}`);

        const decisionMakerId = await selectDecisionMaker(companyName, persons);
        if (!decisionMakerId) {
          console.log(`${companyName}: no decision maker selected, skipping enrich`);
          continue;
        }
        const selectedPerson = persons.find((p) => p.person_id === decisionMakerId);
        if (selectedPerson && alreadyInFiltered.has(personKey(companyName, selectedPerson.full_name))) {
          console.log(`${companyName} / ${selectedPerson.full_name}: already in filtered.csv, skipping`);
          continue;
        }

        const { person, company } = await enrichPerson({
          person_id: decisionMakerId,
          enrich_mobile: true,
        });
        const outboundMessage = await writeOutboundMessage({
          companyName,
          person,
          company,
          inputMode: INPUT_MODE,
        });
        const row = toFilteredRow(companyName, person, outboundMessage);
        filteredRows.push(row);
        console.log(`${companyName}: decision maker ${person?.full_name} → outbound message written`);
      } catch (err) {
        console.log(`${companyName}: not found – ${err.message}`);
      }
    }
  } else {
    const persons = getPersonsFromAll();
    console.log('Input: persons/all.csv →', persons.length, 'persons');
    if (alreadyInFiltered.size) console.log('Already in filtered.csv:', alreadyInFiltered.size, 'entries');

    for (const { company_name: companyName, full_name: fullName } of persons) {
      const key = personKey(companyName, fullName);
      if (alreadyInFiltered.has(key)) {
        console.log(`${companyName} / ${fullName}: already in filtered.csv, skipping`);
        continue;
      }
      try {
        await sleep(DELAY_BETWEEN_COMPANIES_MS);
        const personMatch = await findPersonByCompanyAndName(companyName, fullName);
        if (!personMatch) {
          console.log(`${companyName} / ${fullName}: not found in Prospeo`);
          continue;
        }
        console.log(`${companyName} / ${fullName}: found in Prospeo`);

        const { person, company } = await enrichPerson({
          person_id: personMatch.person_id,
          enrich_mobile: true,
        });
        const outboundMessage = await writeOutboundMessage({
          companyName,
          person,
          company,
          inputMode: INPUT_MODE,
        });
        const row = toFilteredRow(companyName, person, outboundMessage);
        filteredRows.push(row);
        console.log(`${companyName} / ${person?.full_name} → outbound message written`);
      } catch (err) {
        console.log(`${companyName} / ${fullName}: error – ${err.message}`);
      }
    }
  }

  const newRowsCsv = filteredRows.map((row) => CSV_HEADERS.map((h) => csvCell(h, row[h])).join(',')).join('\n');
  let existingRowsCsv = '';
  if (fs.existsSync(filteredPath)) {
    const content = fs.readFileSync(filteredPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length > 1) {
      const header = lines[0];
      const dataLines = lines.slice(1);
      const hasOutboundColumn = header.includes('outbound_message');
      existingRowsCsv = hasOutboundColumn
        ? dataLines.join('\n')
        : dataLines.map((line) => `${line},""`).join('\n');
    }
  }
  fs.mkdirSync(path.dirname(filteredPath), { recursive: true });
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
