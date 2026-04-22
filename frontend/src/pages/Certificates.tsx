import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { sacramentsApi, certificatesApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import { SACRAMENT_COLORS } from '../types';
import type { CertificateRequest } from '../types';

const TYPE_CODES = ['ALL', 'BAPTISM', 'EUCHARIST', 'PENANCE', 'CONFIRMATION', 'MATRIMONY', 'HOLY_ORDERS', 'ANOINTING'] as const;
const TYPE_LABELS: Record<string, string> = {
  ALL: 'All', BAPTISM: 'Baptism', EUCHARIST: 'Communion', PENANCE: 'Confession',
  CONFIRMATION: 'Confirmation', MATRIMONY: 'Marriage', HOLY_ORDERS: 'Holy Orders', ANOINTING: 'Anointing',
};

interface SacramentRow {
  id: string;
  person_id: string;
  first_name: string;
  last_name: string;
  code: string;
  sacrament_name: string;
  date?: string;
  place?: string;
  celebrant?: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending: 'badge-warning',
  approved: 'badge-info',
  rejected: 'badge-danger',
  fulfilled: 'badge-success',
};

export default function Certificates() {
  const { hasRole } = useAuth();
  const [activeTab, setActiveTab] = useState<'generate' | 'requests'>('generate');

  const [sacraments, setSacraments] = useState<SacramentRow[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [requests, setRequests] = useState<CertificateRequest[]>([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const debouncedSearch = useDebounce(search, 300);

  const loadSacraments = async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { status: 'completed', page, limit: 20 };
      if (debouncedSearch) params.personName = debouncedSearch;
      if (typeFilter !== 'ALL') params.typeCode = typeFilter;
      const res = await sacramentsApi.list(params);
      setSacraments(res.data.data);
    } catch { toast.error('Failed to load sacraments'); }
    finally { setLoading(false); }
  };

  const loadRequests = async () => {
    setReqLoading(true);
    try {
      const res = await certificatesApi.getRequests();
      setRequests(res.data);
    } catch { toast.error('Failed to load requests'); }
    finally { setReqLoading(false); }
  };

  useEffect(() => { loadSacraments(); }, [debouncedSearch, typeFilter, page]);
  useEffect(() => { if (activeTab === 'requests') loadRequests(); }, [activeTab]);

  const updateRequest = async (id: string, status: string) => {
    setUpdatingId(id);
    try {
      await certificatesApi.updateRequest(id, { status });
      toast.success(`Request ${status}`);
      loadRequests();
    } catch { toast.error('Failed to update request'); }
    finally { setUpdatingId(null); }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div>
      <PageHeader title="Certificates" subtitle="Generate and manage sacrament certificates" />

      <div className="p-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('generate')}
            className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'generate' ? 'border-navy-700 text-navy-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            Generate Certificates
          </button>
          {hasRole('parish_admin', 'sacramental_clerk') && (
            <button
              onClick={() => setActiveTab('requests')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'requests' ? 'border-navy-700 text-navy-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              Requests
              {pendingCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </button>
          )}
        </div>

        {activeTab === 'generate' ? (
          <>
            {/* Search & Filters */}
            <div className="mb-4 space-y-3">
              <div className="relative max-w-md">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" /></svg>
                <input
                  type="text"
                  placeholder="Search by person name..."
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="input w-full pl-9"
                />
                {search && (
                  <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {TYPE_CODES.map(code => (
                  <button
                    key={code}
                    onClick={() => { setTypeFilter(code); setPage(1); }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      typeFilter === code
                        ? 'bg-navy-800 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {TYPE_LABELS[code]}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <SkeletonTable rows={5} cols={5} />
            ) : sacraments.length === 0 ? (
              <EmptyState
                icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
                title="No completed sacraments found"
                description="Try adjusting your search or filters."
              />
            ) : (
              <>
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
                        <th className="table-header">Place</th>
                        <th className="table-header text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {sacraments.map((s, i) => (
                        <motion.tr key={s.id} className="hover:bg-gray-50/80 transition-colors"
                          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                          <td className="table-cell font-medium text-navy-800">{s.first_name} {s.last_name}</td>
                          <td className="table-cell">
                            <span className={`badge ${SACRAMENT_COLORS[s.code] || 'badge-neutral'}`}>{s.sacrament_name}</span>
                          </td>
                          <td className="table-cell text-gray-600">{s.date ? new Date(s.date).toLocaleDateString() : '--'}</td>
                          <td className="table-cell text-gray-600">{s.place || '--'}</td>
                          <td className="table-cell text-right">
                            <button
                              onClick={() => window.open(`/certificates/print/${s.id}`, '_blank')}
                              className="text-xs bg-gold-600 text-white px-3 py-1.5 rounded-xl hover:bg-gold-700 inline-flex items-center gap-1 transition-colors shadow-sm"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M9.75 8.25h.008v.008H9.75V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>
                              Print Certificate
                            </button>
                          </td>
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
                <div className="flex items-center justify-center gap-2 mt-6">
                  <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="btn-secondary text-sm disabled:opacity-40">
                    <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-500 font-medium">Page {page}</span>
                  <button disabled={sacraments.length < 20} onClick={() => setPage(p => p + 1)} className="btn-secondary text-sm disabled:opacity-40">
                    Next
                    <svg className="w-4 h-4 ml-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          /* Requests Tab */
          reqLoading ? (
            <SkeletonTable rows={4} cols={6} />
          ) : requests.length === 0 ? (
            <EmptyState
              icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg>}
              title="No certificate requests yet"
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
                    <th className="table-header">Reason</th>
                    <th className="table-header">Submitted</th>
                    <th className="table-header">Status</th>
                    <th className="table-header text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {requests.map((req, i) => (
                    <motion.tr key={req.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <td className="table-cell font-medium text-navy-800">{req.first_name ?? req.firstName} {req.last_name ?? req.lastName}</td>
                      <td className="table-cell text-gray-600">{req.sacrament_name ?? req.sacramentName}</td>
                      <td className="table-cell text-gray-600 max-w-xs truncate">{req.reason || '--'}</td>
                      <td className="table-cell text-gray-500">{new Date(req.createdAt ?? req.created_at).toLocaleDateString()}</td>
                      <td className="table-cell">
                        <span className={`badge capitalize ${STATUS_BADGE[req.status] || 'badge-neutral'}`}>{req.status}</span>
                      </td>
                      <td className="table-cell text-right">
                        {req.status === 'pending' && (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => updateRequest(req.id, 'approved')} disabled={updatingId === req.id} className="text-xs bg-green-600 text-white px-2.5 py-1 rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors">Approve</button>
                            <button onClick={() => updateRequest(req.id, 'rejected')} disabled={updatingId === req.id} className="text-xs bg-red-600 text-white px-2.5 py-1 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors">Reject</button>
                          </div>
                        )}
                        {req.status === 'approved' && (
                          <button onClick={() => updateRequest(req.id, 'fulfilled')} disabled={updatingId === req.id} className="text-xs bg-navy-700 text-white px-2.5 py-1 rounded-lg hover:bg-navy-800 disabled:opacity-50 transition-colors">Mark Fulfilled</button>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}
