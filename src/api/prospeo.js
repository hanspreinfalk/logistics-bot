import fs from 'fs';
import path from 'path';

const SEARCH_COMPANY_URL = 'https://api.prospeo.io/search-company';
const SEARCH_PERSON_URL = 'https://api.prospeo.io/search-person';
const ENRICH_PERSON_URL = 'https://api.prospeo.io/enrich-person';

const headers = {
  'Content-Type': 'application/json',
  'X-KEY': process.env.PROSPEO_API_KEY ?? '',
};

async function searchCompany(filters, page = 1) {
  const response = await fetch(SEARCH_COMPANY_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ filters, page }),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.filter_error || data.error_code || response.statusText);
    err.status = response.status;
    err.code = data.error_code;
    err.filter_error = data.filter_error;
    throw err;
  }

  return data;
}

async function searchPerson(filters, page = 1) {
  const response = await fetch(SEARCH_PERSON_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ filters, page }),
  });

  const data = await response.json();

  if (!response.ok) {
    const err = new Error(data.filter_error || data.error_code || response.statusText);
    err.status = response.status;
    err.code = data.error_code;
    err.filter_error = data.filter_error;
    throw err;
  }

  return data;
}

async function enrichPerson(options) {
  const {
    person_id,
    first_name,
    last_name,
    full_name,
    linkedin_url,
    company_website,
    company_name,
    company_linkedin_url,
    only_verified_email = false,
    enrich_mobile = false,
    only_verified_mobile = false,
  } = options;

  const data = {
    ...(person_id && { person_id }),
    ...(first_name && { first_name }),
    ...(last_name && { last_name }),
    ...(full_name && { full_name }),
    ...(linkedin_url && { linkedin_url }),
    ...(company_website && { company_website }),
    ...(company_name && { company_name }),
    ...(company_linkedin_url && { company_linkedin_url }),
  };

  const response = await fetch(ENRICH_PERSON_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      only_verified_email,
      enrich_mobile,
      only_verified_mobile,
      data,
    }),
  });

  const result = await response.json();
  if (result.error || !response.ok) {
    const err = new Error(result.error_code || result.message || response.statusText);
    err.code = result.error_code;
    throw err;
  }
  return { person: result.person, company: result.company ?? null };
}

const PERSONS_PER_PAGE = 25;
const MAX_PERSONS_PER_COMPANY = 200;
const DELAY_BETWEEN_PAGES_MS = 1500;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch persons for a company and save to the given output directory as persons.csv
 * Fetches up to MAX_PERSONS_PER_COMPANY (200) persons via pagination (25 per page).
 * @param {string} companyName
 * @param {string} outputDir - Full path to folder (e.g. data/Microsoft-2026-02-12T143052)
 * @returns {Promise<{ persons: object[], csvPath: string }>}
 */
async function fetchPersonsAndSaveCsv(companyName, outputDir) {
  const name = companyName.trim();
  const filters = { company: { names: { include: [name] } } };
  const persons = [];
  const maxPages = Math.ceil(MAX_PERSONS_PER_COMPANY / PERSONS_PER_PAGE); // 8 pages for 200

  for (let page = 1; page <= maxPages; page++) {
    const personData = await searchPerson(filters, page);
    if (personData.error) {
      throw new Error(personData.filter_error || personData.error_code);
    }
    const results = personData.results ?? [];
    for (const r of results) {
      const p = r.person;
      persons.push({
        person_id: p?.person_id,
        company_name: name,
        full_name: p?.full_name,
        country: p?.location?.country,
        email: p?.email?.email,
        mobile: p?.mobile?.mobile,
        linkedin_url: p?.linkedin_url,
        current_job_title: p?.current_job_title,
      });
    }
    if (results.length < PERSONS_PER_PAGE) break;
    if (persons.length >= MAX_PERSONS_PER_COMPANY) break;
    if (page < maxPages && results.length > 0) await sleep(DELAY_BETWEEN_PAGES_MS);
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const csvPath = path.join(outputDir, 'persons.csv');

  const csvCell = (h, v) => {
    const s = String(v ?? '');
    if (h === 'current_job_title') return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csvHeaders = ['company_name', 'full_name', 'country', 'email', 'mobile', 'linkedin_url', 'current_job_title'];
  const csv = [
    csvHeaders.join(','),
    ...persons.map((row) => csvHeaders.map((h) => csvCell(h, row[h])).join(',')),
  ].join('\n');
  fs.writeFileSync(csvPath, csv, 'utf-8');
  return { persons, csvPath };
}

export { searchCompany, searchPerson, enrichPerson, fetchPersonsAndSaveCsv };
