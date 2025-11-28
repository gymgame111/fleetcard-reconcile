import { BankRecord, BookRecord } from '../types';

// Helper to clean currency strings like "2,080.00" or 2080.00
const parseAmount = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  // Remove quotes, commas
  const cleaned = val.toString().replace(/["',]/g, '');
  return parseFloat(cleaned);
};

// Simple CSV Line Parser that handles quoted strings containing commas
const parseCSVLine = (text: string): string[] => {
  const result: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  result.push(cell);
  return result;
};

// Helper to normalize dates from d/m/y to YYYY-MM-DD for easier comparison
export const normalizeDate = (dateStr: string): string => {
  if (!dateStr) return '';
  const parts = dateStr.trim().split('/');
  if (parts.length === 3) {
    const day = parts[0].padStart(2, '0');
    const month = parts[1].padStart(2, '0');
    const year = parts[2];
    return `${year}-${month}-${day}`;
  }
  return dateStr;
};

export const parseBankCSV = (csvText: string): BankRecord[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse Header to confirm structure (optional validation could go here)
  const records: BankRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = parseCSVLine(line);
    if (values.length < 5) continue;

    const record: BankRecord = {
      id: `bank-${i}`,
      account_no: values[0],
      transaction_date: values[2], // Keep original string for display
      invoice_number: values[4],
      total_amount: parseAmount(values[10]),
      merchant_id: values[13] || '',
      fuel_brand: values[14] || '',
      original_row: values
    };
    records.push(record);
  }
  return records;
};

export const parseBookCSV = (csvText: string): BookRecord[] => {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const records: BookRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    
    const record: BookRecord = {
      id: `book-${i}`,
      document_no: values[0],
      posting_date: values[1],
      description: values[2], // Treating description as invoice number reference
      amount: parseAmount(values[3]),
      original_row: values
    };
    records.push(record);
  }
  return records;
};