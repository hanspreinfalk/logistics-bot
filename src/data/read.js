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
