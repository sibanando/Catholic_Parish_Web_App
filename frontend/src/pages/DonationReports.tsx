import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { donationsApi } from '../api/client';
import { L, formatINR } from '../utils/donationLabels';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';

const TABS = [
  { key: 'ward', label: L.wardCollection },
  { key: 'family', label: L.familySummary },
  { key: 'defaulters', label: L.defaulters },
  { key: 'festival', label: L.festivalCollection },
  { key: 'petersPence', label: L.petersPence },
  { key: 'comparison', label: L.yearComparison },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function DonationReports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<TabKey>((searchParams.get('tab') as TabKey) || 'ward');
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(true);
  const [compYear1, setCompYear1] = useState(new Date().getFullYear() - 1);
  const [compYear2, setCompYear2] = useState(new Date().getFullYear());
  const [compData, setCompData] = useState<unknown[]>([]);
  const [festivalTotal, setFestivalTotal] = useState(0);
  const [ppData, setPpData] = useState<{ id: string; family_name: string; card_number: string; ward_name: string; unit_name: string; donation_date: string; amount: string; remarks: string }[]>([]);
  const [ppTotal, setPpTotal] = useState(0);

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'ward') {
        const r = await donationsApi.wardCollection({ year });
        setData(r.data.data);
      } else if (tab === 'family') {
        const r = await donationsApi.familySummaryReport({ year });
        setData(r.data.data);
      } else if (tab === 'defaulters') {
        const r = await donationsApi.defaulters({ year });
        setData(r.data.data);
      } else if (tab === 'festival') {
        const r = await donationsApi.festivalCollection({ year });
        setData(r.data.data);
        setFestivalTotal(r.data.total);
      } else if (tab === 'petersPence') {
        const typesR = await donationsApi.getTypes();
        const ppType = typesR.data.find((t: { code: string }) => t.code === 'PETERS_PENCE');
        if (ppType) {
          const r = await donationsApi.list({ typeId: ppType.id, year, limit: 1000 });
          const rows = r.data.data || r.data || [];
          setPpData(rows);
          setPpTotal(rows.reduce((s: number, e: { amount: string }) => s + parseFloat(e.amount || '0'), 0));
        } else {
          setPpData([]);
          setPpTotal(0);
        }
      } else if (tab === 'comparison') {
        const r = await donationsApi.yearComparison({ year1: compYear1, year2: compYear2 });
        const monthNames = L.monthsShort;
        setCompData(r.data.data.map((d: { month: number; year1_total: string; year2_total: string }) => ({
          month: monthNames[d.month - 1],
          [compYear1]: parseFloat(d.year1_total),
          [compYear2]: parseFloat(d.year2_total),
        })));
      }
    } catch { toast.error('Failed to load report'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [tab, year, compYear1, compYear2]);

  const changeTab = (t: TabKey) => {
    setTab(t);
    setSearchParams({ tab: t });
  };

  const exportReport = async () => {
    try {
      let type = '';
      if (tab === 'ward') type = 'ward-collection';
      else if (tab === 'family') type = 'family-summary';
      else if (tab === 'defaulters') type = 'defaulters';
      else if (tab === 'festival') type = 'festival-collection';
      else if (tab === 'petersPence') type = 'peters-pence';
      else return;

      const r = await donationsApi.exportReport(type, { year });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${year}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch { toast.error('Export failed'); }
  };

  const printReport = () => window.print();

  return (
    <div>
      <PageHeader
        title={L.reports}
        actions={
          <div className="flex items-center gap-3">
            {tab !== 'comparison' && (
              <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input text-sm bg-white">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            )}
            {['ward', 'family', 'defaulters', 'festival', 'petersPence'].includes(tab) && (
              <button onClick={exportReport} className="btn-secondary">
                <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                {L.export}
              </button>
            )}
            <button onClick={printReport} className="btn-secondary">
              <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m0 0a48.159 48.159 0 0 1 10.5 0m-10.5 0V3.375c0-.621.504-1.125 1.125-1.125h9.75c.621 0 1.125.504 1.125 1.125v3.659M9.75 21h4.5" /></svg>
              {L.print}
            </button>
          </div>
        }
      />

      <div className="px-8 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto border-b border-gray-200">
          {TABS.map(t => (
            <button key={t.key} onClick={() => changeTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-maroon-500 text-maroon-700'
                  : 'border-transparent text-gray-500 hover:text-maroon-600'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : (
          <>
            {/* Ward Collection */}
            {tab === 'ward' && (
              <ReportTable
                headers={['Ward', 'Unit', 'Families', 'Total']}
                rows={(data as { ward_name: string; unit_name: string; families: string; total: string }[]).map(d => [
                  d.ward_name, d.unit_name || '--', d.families, formatINR(parseFloat(d.total)),
                ])}
              />
            )}

            {/* Family Summary */}
            {tab === 'family' && (
              <ReportTable
                headers={['Family', 'Card #', 'Ward', 'Unit', 'Pledge/Mo', 'YTD Total']}
                rows={(data as { family_name: string; card_number: string; ward_name: string; unit_name: string; monthly_pledge: string; ytd_total: string }[]).map(d => [
                  d.family_name, d.card_number || '--', d.ward_name || '--', d.unit_name || '--',
                  d.monthly_pledge ? formatINR(parseFloat(d.monthly_pledge)) : '--',
                  formatINR(parseFloat(d.ytd_total)),
                ])}
              />
            )}

            {/* Defaulters */}
            {tab === 'defaulters' && (
              (data as unknown[]).length === 0 ? (
                <EmptyState
                  icon={<svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                  title={`No defaulters for ${year}`}
                />
              ) : (
                <DefaulterTable
                  data={data as { family_name: string; card_number: string; ward_name: string; phone: string; monthly_pledge: string; ytd_total: string; balance_due: string }[]}
                />
              )
            )}

            {/* Festival Collection */}
            {tab === 'festival' && (
              <>
                <motion.div className="mb-4 bg-white rounded-2xl border border-gray-200 p-4 inline-block shadow-sm"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="text-sm text-gray-500">{L.total}: </span>
                  <span className="text-lg font-bold text-maroon-800">{formatINR(festivalTotal)}</span>
                </motion.div>
                <ReportTable
                  headers={['Date', 'Family', 'Card #', 'Amount', 'Remarks']}
                  rows={(data as { donation_date: string; family_name: string; card_number: string; amount: string; remarks: string }[]).map(d => [
                    new Date(d.donation_date).toLocaleDateString('en-IN'),
                    d.family_name, d.card_number || '--', formatINR(parseFloat(d.amount)), d.remarks || '',
                  ])}
                />
              </>
            )}

            {/* Peter's Pence */}
            {tab === 'petersPence' && (
              <>
                <motion.div className="mb-4 bg-white rounded-2xl border border-gray-200 p-4 inline-block shadow-sm"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <span className="text-sm text-gray-500">{L.total}: </span>
                  <span className="text-lg font-bold text-maroon-800">{formatINR(ppTotal)}</span>
                  <span className="text-sm text-gray-400 ml-3">({ppData.length} offerings)</span>
                </motion.div>
                {ppData.length === 0 ? (
                  <EmptyState
                    icon={<svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>}
                    title={`No Peter's Pence offerings for ${year}`}
                  />
                ) : (
                  <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <table className="w-full text-sm">
                      <thead className="bg-maroon-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">Sl.</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{L.cardNumber}</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{L.familyName}</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{L.ward}</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{L.unit}</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{L.date}</th>
                          <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{L.amount}</th>
                          <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{L.remarks}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {ppData.map((e, i) => (
                          <tr key={e.id} className="hover:bg-cream transition-colors">
                            <td className="px-4 py-3 text-gray-500">{i + 1}</td>
                            <td className="px-4 py-3 font-medium">{e.card_number || '--'}</td>
                            <td className="px-4 py-3">{e.family_name}</td>
                            <td className="px-4 py-3 text-gray-600">{e.ward_name || '--'}</td>
                            <td className="px-4 py-3 text-gray-600">{e.unit_name || '--'}</td>
                            <td className="px-4 py-3 text-gray-600">{e.donation_date ? new Date(e.donation_date).toLocaleDateString('en-IN') : '--'}</td>
                            <td className="px-4 py-3 text-right font-medium">{formatINR(parseFloat(e.amount))}</td>
                            <td className="px-4 py-3 text-gray-500">{e.remarks || '--'}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="bg-maroon-50">
                        <tr>
                          <td colSpan={6} className="px-4 py-3 text-right font-semibold text-maroon-800">{L.total}</td>
                          <td className="px-4 py-3 text-right font-bold text-maroon-900">{formatINR(ppTotal)}</td>
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </motion.div>
                )}
              </>
            )}

            {/* Year Comparison */}
            {tab === 'comparison' && (
              <>
                <div className="flex gap-3 mb-4">
                  <select value={compYear1} onChange={e => setCompYear1(parseInt(e.target.value))} className="input text-sm bg-white">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span className="self-center text-gray-400 font-medium">vs</span>
                  <select value={compYear2} onChange={e => setCompYear2(parseInt(e.target.value))} className="input text-sm bg-white">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <motion.div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={compData as Record<string, unknown>[]} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                      <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                      <Legend />
                      <Bar dataKey={String(compYear1)} fill="#800020" radius={[6, 6, 0, 0]} />
                      <Bar dataKey={String(compYear2)} fill="#D4AF37" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </motion.div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ReportTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <table className="w-full text-sm">
        <thead className="bg-maroon-50 border-b border-gray-200">
          <tr>
            {headers.map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {rows.length === 0 ? (
            <tr><td colSpan={headers.length} className="text-center py-10 text-gray-400">No data</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={i} className="hover:bg-cream transition-colors">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3">{cell}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </motion.div>
  );
}

function DefaulterTable({ data }: { data: { family_name: string; card_number: string; ward_name: string; phone: string; monthly_pledge: string; ytd_total: string; balance_due: string }[] }) {
  return (
    <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <table className="w-full text-sm">
        <thead className="bg-maroon-50 border-b border-gray-200">
          <tr>
            {['Family', 'Card #', 'Ward', 'Phone', 'Pledge/Mo', 'YTD Paid', 'Balance Due'].map(h => (
              <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.map((d, i) => (
            <tr key={i} className="hover:bg-cream transition-colors">
              <td className="px-4 py-3">{d.family_name}</td>
              <td className="px-4 py-3">{d.card_number || '--'}</td>
              <td className="px-4 py-3">{d.ward_name || '--'}</td>
              <td className="px-4 py-3">{d.phone || '--'}</td>
              <td className="px-4 py-3">{formatINR(parseFloat(d.monthly_pledge))}</td>
              <td className="px-4 py-3">{formatINR(parseFloat(d.ytd_total))}</td>
              <td className="px-4 py-3">
                <span className="badge badge-danger font-bold">{formatINR(parseFloat(d.balance_due))}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </motion.div>
  );
}
