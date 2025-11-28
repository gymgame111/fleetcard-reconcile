
import { useState, useEffect, useMemo } from 'react';
import { MatchStatus, ReconResult, DashboardStats } from './types';
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
  const [results, setResults] = useState<ReconResult[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<'ALL' | 'MATCHED' | 'MISMATCH' | 'MISSING'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // Load default data on mount
    const bank = parseBankCSV(BANK_CSV_DATA);
    const book = parseBookCSV(BOOK_CSV_DATA);
    
    // Perform reconciliation immediately
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
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(r => 
        r.id.toLowerCase().includes(lower) || 
        r.notes.toLowerCase().includes(lower) ||
        r.bankRecord?.invoice_number.toLowerCase().includes(lower) ||
        r.bookRecord?.description.toLowerCase().includes(lower)
      );
    }
    return data;
  }, [results, activeTab, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
              F
            </div>
            <h1 className="text-xl font-semibold text-slate-800 tracking-tight">
              {import.meta.env?.VITE_APP_TITLE || 'FleetCard Reconciler'}
            </h1>
          </div>
          <div className="text-sm text-slate-500">
             Vercel Ready
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Grid */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard 
              title="Total Transactions" 
              value={stats.totalBank + stats.totalBook} 
              subtext={`Bank: ${stats.totalBank} | Book: ${stats.totalBook}`}
              color="blue"
            />
            <StatCard 
              title="Matched Successfully" 
              value={`${((stats.matchedCount / stats.totalBank) * 100).toFixed(1)}%`} 
              subtext={`${stats.matchedCount} records matched`}
              color="green"
            />
            <StatCard 
              title="Discrepancies" 
              value={stats.mismatchCount} 
              subtext="Amount or Date mismatches"
              color="yellow"
            />
            <StatCard 
              title="Missing Entries" 
              value={stats.missingInBookCount + stats.missingInBankCount} 
              subtext={`In Book: ${stats.missingInBookCount} | In Bank: ${stats.missingInBankCount}`}
              color="red"
            />
          </div>
        )}

        {/* Controls */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6">
          <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
            {['ALL', 'MATCHED', 'MISMATCH', 'MISSING'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab 
                    ? 'bg-blue-50 text-blue-700 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.charAt(0) + tab.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Search invoice, ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Bank Record (Statement)</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Book Record (GL)</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Variance</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200 text-sm">
                {filteredResults.length > 0 ? (
                  filteredResults.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <StatusBadge status={row.status} />
                      </td>
                      <td className="px-6 py-4">
                        {row.bankRecord ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900">{row.bankRecord.invoice_number}</span>
                            <span className="text-slate-500 text-xs">{row.bankRecord.transaction_date} • {row.bankRecord.fuel_brand}</span>
                            <span className="text-slate-700 font-mono mt-1">{formatCurrency(row.bankRecord.total_amount)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not found in Bank</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {row.bookRecord ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900">{row.bookRecord.document_no}</span>
                            <span className="text-slate-500 text-xs">{row.bookRecord.posting_date} • {row.bookRecord.description}</span>
                            <span className="text-slate-700 font-mono mt-1">{formatCurrency(row.bookRecord.amount)}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not found in GL</span>
                        )}
                      </td>
                      <td className={`px-6 py-4 text-right font-mono font-medium ${row.amountDiff !== 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {row.amountDiff > 0 ? '+' : ''}{formatCurrency(row.amountDiff)}
                      </td>
                      <td className="px-6 py-4 text-slate-600 max-w-xs truncate" title={row.notes}>
                        {row.notes}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No records found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 text-xs text-slate-500 flex justify-between">
             <span>Showing {filteredResults.length} records</span>
             <span>Generated locally</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
