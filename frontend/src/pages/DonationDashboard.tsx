import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { donationsApi } from '../api/client';
import { DonationDashboardData } from '../types';
import { L, formatINR } from '../utils/donationLabels';
import PageHeader from '../components/PageHeader';
import { SkeletonCard } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

const PIE_COLORS = ['#800020', '#D4AF37', '#b45309', '#486581', '#9b1c1c', '#334e68'];

export default function DonationDashboard() {
  const navigate = useNavigate();
  const [year, setYear] = useState(new Date().getFullYear());
  const [exportMonth, setExportMonth] = useState(new Date().getMonth() + 1);
  const [data, setData] = useState<DonationDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = async (y: number) => {
    setLoading(true);
    try {
      const r = await donationsApi.dashboard({ year: y });
      setData(r.data);
    } catch { toast.error('Failed to load donation data'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(year); }, [year]);

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);

  const handleExport = async () => {
    setExporting(true);
    try {
      const r = await donationsApi.exportRegister({ year, month: exportMonth });
      const url = window.URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `donations-${year}-${String(exportMonth).padStart(2, '0')}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  return (
    <div>
      <PageHeader
        title={L.donationDashboard}
        subtitle="Parish Donation Management"
        actions={
          <div className="flex items-center gap-3">
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input text-sm bg-white">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={() => navigate('/donations/register')}
              className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors shadow-sm">
              + {L.recordDonation}
            </button>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-6">
        {loading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <SkeletonCard /><SkeletonCard />
            </div>
          </div>
        ) : data && (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: <svg className="w-6 h-6 text-maroon-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg>, label: L.annualCollection, value: formatINR(data.annualTotal) },
                { icon: <svg className="w-6 h-6 text-navy-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>, label: L.totalFamilies, value: String(data.totalFamilies) },
                { icon: <svg className="w-6 h-6 text-gold-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>, label: L.activeDonors, value: String(data.activeDonors) },
                { icon: <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>, label: L.defaulters, value: String(data.defaulterCount), danger: data.defaulterCount > 0 },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  className={`bg-white rounded-2xl border p-5 shadow-sm transition-all ${stat.danger ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center">{stat.icon}</div>
                    <div>
                      <p className="text-2xl font-bold text-maroon-900">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <motion.div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                <h3 className="text-sm font-semibold text-maroon-800 mb-3">{L.monthlyCollection}</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.monthlyTotals} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="monthName" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                    <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                    <Bar dataKey="total" fill="#800020" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                <h3 className="text-sm font-semibold text-maroon-800 mb-3">{L.donationType}</h3>
                {data.typeBreakdown.some(t => t.total > 0) ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={data.typeBreakdown.filter(t => t.total > 0)}
                        dataKey="total"
                        nameKey="name"
                        cx="50%" cy="50%" outerRadius={80}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {data.typeBreakdown.filter(t => t.total > 0).map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: number) => formatINR(v)} contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[250px] flex items-center justify-center text-gray-400 text-sm">
                    No donations recorded for {year}
                  </div>
                )}
              </motion.div>
            </div>

            {/* Top 10 Donors */}
            <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-maroon-800">{L.topDonors}</h3>
              </div>
              {data.topDonors.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No donations recorded yet</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-maroon-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">#</th>
                      <th className="text-left px-6 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{L.familyName}</th>
                      <th className="text-right px-6 py-3 text-xs font-semibold text-maroon-700 uppercase tracking-wider">{L.total}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.topDonors.map((d, i) => (
                      <motion.tr key={d.familyId} className="hover:bg-cream cursor-pointer transition-colors"
                        onClick={() => navigate(`/families/${d.familyId}`)}
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 + i * 0.03 }}>
                        <td className="px-6 py-3 text-gray-500">{i + 1}</td>
                        <td className="px-6 py-3 font-medium text-maroon-900">{d.familyName}</td>
                        <td className="px-6 py-3 text-right font-semibold text-maroon-800">{formatINR(d.total)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </motion.div>

            {/* Export Excel */}
            <motion.div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <h3 className="text-sm font-semibold text-maroon-800 mb-3">{L.export}</h3>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{L.month}</label>
                  <select value={exportMonth} onChange={e => setExportMonth(parseInt(e.target.value))} className="input text-sm">
                    {L.months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{L.year}</label>
                  <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="input text-sm">
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <button onClick={handleExport} disabled={exporting}
                  className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 disabled:opacity-50 transition-colors shadow-sm">
                  {exporting ? 'Exporting...' : L.export}
                </button>
              </div>
            </motion.div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: <svg className="w-7 h-7 text-maroon-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>, label: L.recordDonation, desc: 'Add a new donation entry', to: '/donations/register' },
                { icon: <svg className="w-7 h-7 text-maroon-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" /></svg>, label: L.reports, desc: 'View collection & analysis', to: '/donations/reports' },
                { icon: <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>, label: L.defaulters, desc: 'Track overdue pledges', to: '/donations/reports?tab=defaulters' },
                { icon: <svg className="w-7 h-7 text-gold-600" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>, label: L.receipts, desc: 'View & download receipts', to: '/donations/receipts' },
              ].map((nav, i) => (
                <motion.button key={nav.label} onClick={() => navigate(nav.to)}
                  className="bg-white rounded-2xl border border-gray-200 p-5 text-left hover:shadow-md hover:border-maroon-300 transition-all group"
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 + i * 0.1 }}>
                  {nav.icon}
                  <p className="mt-2 text-sm font-semibold text-maroon-800 group-hover:text-maroon-900">{nav.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{nav.desc}</p>
                </motion.button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
