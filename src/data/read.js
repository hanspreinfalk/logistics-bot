import fs from 'fs';
import path from 'path';

/**
 * Returns all company names from data/companies.csv as an array.
 * @returns {string[]}
 */
export function getCompanies() {
  const csvPath = path.join(process.cwd(), 'data', 'companies.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const companyNames = lines.slice(1).map((line) => line.split(',')[0].trim()).filter(Boolean);
  return companyNames;
}

/**
 * Returns rows from persons/all.csv as an array of { company_name, full_name }.
 * CSV format: company_name,full_name (header on first line).
 * @returns {{ company_name: string, full_name: string }[]}
 */
export function getPersonsFromAll() {
  const csvPath = path.join(process.cwd(), 'persons', 'all.csv');
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  return lines.slice(1).map((line) => {
    const parts = line.split(',').map((p) => p.replace(/^"|"$/g, '').replace(/""/g, '"').trim());
    return { company_name: parts[0] ?? '', full_name: parts[1] ?? '' };
  }).filter((row) => row.company_name && row.full_name);
}
