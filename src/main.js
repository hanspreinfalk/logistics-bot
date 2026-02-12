import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { getCompanies, getPersonsFromAll } from './data/read.js';
import { fetchPersonsAndSaveCsv, enrichPerson, findPersonByCompanyAndName } from './api/prospeo.js';
import { selectDecisionMaker, writeOutboundMessage } from './api/bot.js';

/** 'companies' = read from data/companies.csv and pick decision maker per company; 'persons' = read from persons/all.csv and find each person by company + full name */
const INPUT_MODE = 'persons';

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

const norm = (s) => (s ?? '').toLowerCase().trim();

/** Names match if exact or one is a prefix of the other (e.g. "Juan Pablo" matches "Juan Pablo Narchi"). */
function namesMatch(nameA, nameB) {
  const a = norm(nameA);
  const b = norm(nameB);
  return a === b || b.startsWith(a) || a.startsWith(b);
}

/** Returns rows already in filtered.csv as [{ companyName, fullName }]. Used with isPersonAlreadyInFiltered for non-literal skip check. */
function getAlreadyInFiltered(filteredPath) {
  if (!fs.existsSync(filteredPath)) return [];
  const content = fs.readFileSync(filteredPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    return { companyName: parts[0] ?? '', fullName: parts[1] ?? '' };
  });
}

/** True if this company+person is already in filtered (company match + name match, with partial name allowed). */
function isPersonAlreadyInFiltered(companyName, fullName, entries) {
  const nCompany = norm(companyName);
  return entries.some(
    (e) => norm(e.companyName) === nCompany && namesMatch(e.fullName, fullName),
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
    if (alreadyInFiltered.length) console.log('Already in filtered.csv:', alreadyInFiltered.length, 'company+person entries');

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
        if (selectedPerson && isPersonAlreadyInFiltered(companyName, selectedPerson.full_name, alreadyInFiltered)) {
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
    if (alreadyInFiltered.length) console.log('Already in filtered.csv:', alreadyInFiltered.length, 'entries');

    for (const { company_name: companyName, full_name: fullName } of persons) {
      if (isPersonAlreadyInFiltered(companyName, fullName, alreadyInFiltered)) {
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
