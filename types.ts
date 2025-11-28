export interface BankRecord {
  id: string; // generated
  account_no: string;
  transaction_date: string;
  invoice_number: string;
  total_amount: number;
  merchant_id: string;
  fuel_brand: string;
  original_row: any;
}

export interface BookRecord {
  id: string; // generated
  document_no: string;
  posting_date: string;
  description: string; // maps to invoice_number
  amount: number;
  original_row: any;
}

export enum MatchStatus {
  MATCHED = 'MATCHED',
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  DATE_MISMATCH = 'DATE_MISMATCH', // Optional logic
  MISSING_IN_BOOK = 'MISSING_IN_BOOK',
  MISSING_IN_BANK = 'MISSING_IN_BANK',
}

export interface ReconResult {
  id: string;
  status: MatchStatus;
  bankRecord?: BankRecord;
  bookRecord?: BookRecord;
  amountDiff: number;
  notes: string;
}

export interface DashboardStats {
  totalBank: number;
  totalBook: number;
  matchedCount: number;
  mismatchCount: number;
  missingInBookCount: number;
  missingInBankCount: number;
  totalDiscrepancy: number;
}