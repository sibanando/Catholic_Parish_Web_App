import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { sacramentsApi } from '../api/client';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { SACRAMENT_COLORS } from '../types';
import type { SacramentRecord, SacramentType } from '../types';

export default function Sacraments() {
  const navigate = useNavigate();
  const [sacraments, setSacraments] = useState<SacramentRecord[]>([]);
  const [types, setTypes] = useState<SacramentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [celebrantSearch, setCelebrantSearch] = useState('');
  const [personSearch, setPersonSearch] = useState('');

  const debouncedPerson = useDebounce(personSearch, 300);
  const debouncedCelebrant = useDebounce(celebrantSearch, 300);

  const load = async (typeCode = activeTab, from = dateFrom, to = dateTo, cel = debouncedCelebrant, person = debouncedPerson) => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (typeCode && typeCode !== 'all') params.typeCode = typeCode;
      if (from) params.dateFrom = from;
      if (to) params.dateTo = to;
      if (cel) params.celebrant = cel;
      if (person) params.personName = person;

      const [sacRes, typesRes] = await Promise.all([
        sacramentsApi.list(params),
        types.length ? Promise.resolve({ data: types }) : sacramentsApi.types(),
      ]);
      setSacraments(sacRes.data.data);
      if (!types.length) setTypes(typesRes.data);
    } catch { toast.error('Failed to load sacraments'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { load(activeTab, dateFrom, dateTo, debouncedCelebrant, debouncedPerson); }, [debouncedPerson, debouncedCelebrant]);

  const handleTabChange = (code: string) => {
    setActiveTab(code);
    load(code, dateFrom, dateTo, debouncedCelebrant, debouncedPerson);
  };

  const applyFilters = () => load(activeTab, dateFrom, dateTo, debouncedCelebrant, debouncedPerson);
  const clearFilters = () => {
    setDateFrom(''); setDateTo(''); setCelebrantSearch(''); setPersonSearch('');
    load(activeTab, '', '', '', '');
  };

  const exportCSV = () => {
    const headers = ['Person', 'Sacrament', 'Date', 'Celebrant', 'Place', 'Status'];
    const rows = sacraments.map(s => [
      `${s.first_name ?? s.firstName} ${s.last_name ?? s.lastName}`,
      s.sacrament_name ?? s.sacramentName ?? '',
      s.date ?? '',
      s.celebrant ?? '',
      s.place ?? '',
      s.status,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'sacraments.csv'; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const allTabs = [{ id: 'all', code: 'all', name: 'All Sacraments' }, ...types.map(t => ({ id: t.id, code: t.code, name: t.name }))];

  return (
    <div>
      <PageHeader
        title="Sacraments"
        subtitle="View and manage all sacramental records"
        actions={
          <button onClick={exportCSV} className="btn-secondary">
            <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
            Export CSV
          </button>
        }
      />

      <div className="p-8">
        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto mb-6 bg-gray-100 p-1 rounded-xl">
          {allTabs.map(tab => (
            <button
              key={tab.code}
              onClick={() => handleTabChange(tab.code)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.code ? 'bg-white text-navy-800 shadow-sm' : 'text-gray-600 hover:text-navy-700'
              }`}
            >
              {tab.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">From:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="input text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500">To:</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="input text-sm" />
          </div>
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
            <input
              value={personSearch}
              onChange={e => setPersonSearch(e.target.value)}
              placeholder="Search by person name..."
              className="input text-sm pl-8"
            />
          </div>
          <input
            value={celebrantSearch}
            onChange={e => setCelebrantSearch(e.target.value)}
            placeholder="Filter by celebrant..."
            className="input text-sm"
          />
          <button onClick={applyFilters} className="btn-primary text-sm">Apply</button>
          <button onClick={clearFilters} className="btn-ghost text-sm text-gray-500">Clear</button>
        </div>

        {/* Table */}
        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : sacraments.length === 0 ? (
          <EmptyState
            icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>}
            title="No sacramental records found"
            description="Try adjusting your filters or date range."
          />
        ) : (
          <motion.div
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="table-header">Person</th>
                  <th className="table-header">Sacrament</th>
                  <th className="table-header">Date</th>
                  <th className="table-header">Celebrant</th>
                  <th className="table-header">Place</th>
                  <th className="table-header">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {sacraments.map((s, i) => (
                  <motion.tr
                    key={s.id}
                    className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/people/${s.person_id ?? s.personId}`)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <td className="table-cell font-medium text-navy-800">{s.first_name ?? s.firstName} {s.last_name ?? s.lastName}</td>
                    <td className="table-cell">
                      <span className={`badge ${SACRAMENT_COLORS[s.code ?? ''] || 'badge-neutral'}`}>
                        {s.sacrament_name ?? s.sacramentName}
                      </span>
                    </td>
                    <td className="table-cell text-gray-600">{s.date ? new Date(s.date).toLocaleDateString() : '--'}</td>
                    <td className="table-cell text-gray-600">{s.celebrant || '--'}</td>
                    <td className="table-cell text-gray-600 max-w-xs truncate">{s.place || '--'}</td>
                    <td className="table-cell">
                      <span className={`badge capitalize ${
                        s.status === 'completed' ? 'badge-success' :
                        s.status === 'scheduled' ? 'badge-info' : 'badge-danger'
                      }`}>{s.status}</span>
                    </td>
                    <td className="table-cell text-right">
                      <svg className="w-4 h-4 text-gray-400 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            <div className="px-6 py-3 bg-gray-50/80 border-t border-gray-200 text-xs text-gray-500">
              {sacraments.length} record{sacraments.length !== 1 ? 's' : ''}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
