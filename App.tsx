
import React, { useState, useEffect, useMemo } from 'react';
import { BankRecord, BookRecord, MatchStatus, ReconResult, DashboardStats } from './types';
import { parseBankCSV, parseBookCSV } from './utils/parser';
import { reconcileData } from './services/reconciliation';
import { BANK_CSV_DATA, BOOK_CSV_DATA } from './constants';

// --- Helpers ---
const formatCurrency = (amount: number | undefined) => {
  if (amount === undefined || amount === null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// --- Components ---

const StatusBadge = ({ status }: { status: MatchStatus }) => {
  const styles = {
    [MatchStatus.MATCHED]: 'bg-green-100 text-green-800 border-green-200',
    [MatchStatus.AMOUNT_MISMATCH]: 'bg-red-100 text-red-800 border-red-200',
    [MatchStatus.DATE_MISMATCH]: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    [MatchStatus.MISSING_IN_BOOK]: 'bg-orange-100 text-orange-800 border-orange-200',
    [MatchStatus.MISSING_IN_BANK]: 'bg-blue-100 text-blue-800 border-blue-200',
  };
  
  const labels = {
    [MatchStatus.MATCHED]: 'Matched',
    [MatchStatus.AMOUNT_MISMATCH]: 'Amount Diff',
    [MatchStatus.DATE_MISMATCH]: 'Date Diff',
    [MatchStatus.MISSING_IN_BOOK]: 'Missing in Book',
    [MatchStatus.MISSING_IN_BANK]: 'Missing in Bank',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || 'bg-gray-100 text-gray-800'}`}>
      {labels[status]}
    </span>
  );
};

const StatCard = ({ title, value, subtext, color = "blue" }: { title: string, value: string | number, subtext?: string, color?: string }) => (
  <div className={`bg-white rounded-lg shadow-sm p-6 border-l-4 border-${color}-500`}>
    <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
    <div className="mt-2 flex flex-col">
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtext && <p className="mt-1 text-xs text-gray-500">{subtext}</p>}
    </div>
  </div>
);

const App = () => {
  const [bankData, setBankData] = useState<BankRecord[]>([]);
  const [bookData, setBookData] = useState<BookRecord[]>([]);
  const [results, setResults] = useState<ReconResult[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'MATCHED' | 'MISMATCH' | 'MISSING'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Load default data on mount
    const bank = parseBankCSV(BANK_CSV_DATA);
    const book = parseBookCSV(BOOK_CSV_DATA);
    setBankData(bank);
    setBookData(book);
    
    const { results: res, stats: st } = reconcileData(bank, book);
    setResults(res);
    setStats(st);
  }, []);

  const filteredResults = useMemo(() => {
    let data = results;

    // Filter by Tab
    switch(activeTab) {
      case 'MATCHED': 
        data = results.filter(r => r.status === MatchStatus.MATCHED);
        break;
      case 'MISMATCH': 
        data = results.filter(r => r.status === MatchStatus.AMOUNT_MISMATCH || r.status === MatchStatus.DATE_MISMATCH);
        break;
      case 'MISSING': 
        data = results.filter(r => r.status === MatchStatus.MISSING_IN_BOOK || r.status === MatchStatus.MISSING_IN_BANK);
        break;
      default:
        data = results;
    }

    // Filter by Search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(r => 
        r.bankRecord?.invoice_number.toLowerCase().includes(term) ||
        r.bookRecord?.description.toLowerCase().includes(term) ||
        r.bankRecord?.total_amount.toString().includes(term) ||
        r.notes.toLowerCase().includes(term)
      );
    }

    return data;
  }, [results, activeTab, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">FleetCard Reconciliation</h1>
          <p className="text-gray-500 mt-1">Automated matching of Bank Statements vs GL Records</p>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard 
              title="Matched Transactions" 
              value={stats.matchedCount} 
              subtext={`${((stats.matchedCount / results.length) * 100).toFixed(1)}% Completion`}
              color="green"
            />
            <StatCard 
              title="Discrepancies" 
              value={stats.mismatchCount} 
              subtext="Amount or Date variances"
              color="yellow"
            />
            <StatCard 
              title="Missing Records" 
              value={stats.missingInBookCount + stats.missingInBankCount} 
              subtext={`${stats.missingInBookCount} in GL, ${stats.missingInBankCount} in Bank`}
              color="red"
            />
             <StatCard 
              title="Total Discrepancy" 
              value={formatCurrency(stats.totalDiscrepancy)} 
              subtext="Absolute Value Difference"
              color="gray"
            />
          </div>
        )}

        {/* Main Content Area */}
        <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
          
          {/* Controls */}
          <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-gray-50">
            <div className="flex space-x-1 bg-white p-1 rounded-md border border-gray-300">
              {(['ALL', 'MATCHED', 'MISMATCH', 'MISSING'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                    activeTab === tab 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
            
            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Search invoices or amounts..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Invoice / Doc No</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Date Comparison</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Bank Amount</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Book Amount</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Variance</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredResults.length > 0 ? (
                  filteredResults.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={result.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
                        {result.bankRecord?.invoice_number || result.bookRecord?.description || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {result.status === MatchStatus.MISSING_IN_BANK ? (
                          <span>Book: {result.bookRecord?.posting_date}</span>
                        ) : result.status === MatchStatus.MISSING_IN_BOOK ? (
                          <span>Bank: {result.bankRecord?.transaction_date}</span>
                        ) : (
                          <div className="flex flex-col">
                            <span className={result.status === MatchStatus.DATE_MISMATCH ? 'text-red-600 font-bold' : ''}>
                              Bank: {result.bankRecord?.transaction_date}
                            </span>
                            <span className={result.status === MatchStatus.DATE_MISMATCH ? 'text-red-600 font-bold' : 'text-xs text-gray-400'}>
                              Book: {result.bookRecord?.posting_date}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                        {formatCurrency(result.bankRecord?.total_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-mono">
                         {formatCurrency(result.bookRecord?.amount)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right font-mono font-bold ${Math.abs(result.amountDiff) > 0.01 ? 'text-red-600 bg-red-50' : 'text-gray-400'}`}>
                        {Math.abs(result.amountDiff) > 0.01 ? (result.amountDiff > 0 ? '+' : '') + formatCurrency(result.amountDiff) : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate" title={result.notes}>
                        {result.notes}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      No transactions found matching your filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="bg-gray-50 px-6 py-3 border-t border-gray-200 text-xs text-gray-500 flex justify-between">
             <span>Showing {filteredResults.length} records</span>
             <span>Generated by FleetCard Reconciler AI</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
