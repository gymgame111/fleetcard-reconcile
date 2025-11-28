
import { BankRecord, BookRecord, MatchStatus, ReconResult, DashboardStats } from '../types';
import { normalizeDate } from '../utils/parser';

export const reconcileData = (bankData: BankRecord[], bookData: BookRecord[]): { results: ReconResult[], stats: DashboardStats } => {
  const results: ReconResult[] = [];
  
  // Index Book data by description (which contains the invoice number)
  const bookMap = new Map<string, BookRecord[]>();
  
  bookData.forEach(record => {
    const key = record.description.trim();
    if (!bookMap.has(key)) {
      bookMap.set(key, []);
    }
    bookMap.get(key)!.push(record);
  });

  const matchedBookIds = new Set<string>();

  // Pass 1: Strict Match by Invoice Number (Description)
  bankData.forEach(bankRecord => {
    const key = bankRecord.invoice_number.trim();
    const potentialMatches = bookMap.get(key);

    if (potentialMatches && potentialMatches.length > 0) {
      // Find the best match
      let bestMatch: BookRecord | null = null;
      let status: MatchStatus = MatchStatus.AMOUNT_MISMATCH;

      const bankDateNorm = normalizeDate(bankRecord.transaction_date);

      // Strategy: 
      // 1. Exact Amount Match (Prioritize this even if dates differ slightly, usually amount is key)
      // 2. If no exact amount match, we take the first available one and flag it as AMOUNT_MISMATCH
      
      const exactAmountMatch = potentialMatches.find(b => {
        if (matchedBookIds.has(b.id)) return false;
        return Math.abs(b.amount - bankRecord.total_amount) < 0.01;
      });

      if (exactAmountMatch) {
        bestMatch = exactAmountMatch;
        const bookDateNorm = normalizeDate(bestMatch.posting_date);
        
        if (bankDateNorm === bookDateNorm) {
            status = MatchStatus.MATCHED;
        } else {
            status = MatchStatus.DATE_MISMATCH;
        }
      } else {
        // Fallback: No amount match found, but Invoice ID matches. 
        // We MUST match this to show the discrepancy.
        const availableMatch = potentialMatches.find(b => !matchedBookIds.has(b.id));
        if (availableMatch) {
          bestMatch = availableMatch;
          status = MatchStatus.AMOUNT_MISMATCH;
        }
      }

      if (bestMatch) {
        matchedBookIds.add(bestMatch.id);
        
        results.push({
          id: `recon-${bankRecord.id}-${bestMatch.id}`,
          status: status,
          bankRecord: bankRecord,
          bookRecord: bestMatch,
          amountDiff: bestMatch.amount - bankRecord.total_amount,
          notes: status === MatchStatus.MATCHED 
            ? 'Perfect Match' 
            : status === MatchStatus.DATE_MISMATCH
              ? `Date mismatch: Bank(${bankRecord.transaction_date}) vs Book(${bestMatch.posting_date})`
              : `Amount variance: Bank(${bankRecord.total_amount}) vs Book(${bestMatch.amount})`
        });
      }
    } 
    // If no match found by ID, we leave it for Pass 2 or mark as missing
  });

  // Pass 2: Inferred Matching for remaining items
  // Try to match Bank records that haven't been matched yet with remaining Book records
  // based on Exact Amount AND Exact Date.
  const unmatchedBankRecords = bankData.filter(b => !results.some(r => r.bankRecord?.id === b.id));
  
  unmatchedBankRecords.forEach(bankRecord => {
    // Find in bookData who are NOT matched yet
    const bankDateNorm = normalizeDate(bankRecord.transaction_date);
    
    const inferredMatch = bookData.find(b => {
      if (matchedBookIds.has(b.id)) return false;
      const bookDateNorm = normalizeDate(b.posting_date);
      return Math.abs(b.amount - bankRecord.total_amount) < 0.01 && bankDateNorm === bookDateNorm;
    });

    if (inferredMatch) {
      matchedBookIds.add(inferredMatch.id);
      results.push({
        id: `recon-inferred-${bankRecord.id}-${inferredMatch.id}`,
        status: MatchStatus.MATCHED, // Inferred match
        bankRecord: bankRecord,
        bookRecord: inferredMatch,
        amountDiff: 0,
        notes: 'Inferred Match: Invoice ID mismatch but Date and Amount match perfectly'
      });
    } else {
      // Truly missing
      results.push({
        id: `recon-orphan-bank-${bankRecord.id}`,
        status: MatchStatus.MISSING_IN_BOOK,
        bankRecord: bankRecord,
        amountDiff: -bankRecord.total_amount,
        notes: 'Invoice found in Bank Statement but not in GL'
      });
    }
  });

  // Find Missing in Bank (Orphaned Book Records)
  bookData.forEach(bookRecord => {
    if (!matchedBookIds.has(bookRecord.id)) {
      results.push({
        id: `recon-orphan-book-${bookRecord.id}`,
        status: MatchStatus.MISSING_IN_BANK,
        bookRecord: bookRecord,
        amountDiff: bookRecord.amount,
        notes: 'Entry exists in GL but not found in Bank Statement'
      });
    }
  });

  // Calculate Stats
  const stats: DashboardStats = {
    totalBank: bankData.length,
    totalBook: bookData.length,
    matchedCount: results.filter(r => r.status === MatchStatus.MATCHED).length,
    mismatchCount: results.filter(r => r.status === MatchStatus.AMOUNT_MISMATCH || r.status === MatchStatus.DATE_MISMATCH).length,
    missingInBookCount: results.filter(r => r.status === MatchStatus.MISSING_IN_BOOK).length,
    missingInBankCount: results.filter(r => r.status === MatchStatus.MISSING_IN_BANK).length,
    totalDiscrepancy: results.reduce((sum, r) => sum + Math.abs(r.amountDiff), 0)
  };

  return { results, stats };
};
