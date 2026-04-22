import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { donationsApi, familiesApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { L, formatINR } from '../utils/donationLabels';
import PageHeader from '../components/PageHeader';
import Modal from '../components/ui/Modal';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';

interface Receipt {
  id: string;
  receipt_number: string;
  family_id: string;
  family_name?: string;
  amount: number;
  amount_in_words_english?: string;
  amount_in_words_odia?: string;
  date_issued: string;
  donation_id?: string;
}

export default function DonationReceipts() {
  const { hasRole } = useAuth();
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [viewReceipt, setViewReceipt] = useState<Receipt | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  // Generate receipt form
  const [familySearch, setFamilySearch] = useState('');
  const [familyResults, setFamilyResults] = useState<Array<{ id: string; family_name?: string; familyName?: string }>>([]);
  const [selectedFamily, setSelectedFamily] = useState<{ id: string; family_name?: string; familyName?: string } | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptDate, setReceiptDate] = useState(new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const r = await donationsApi.listReceipts({ page: p, limit: 20 });
      setReceipts(r.data.data || r.data || []);
      setTotal(r.data.total || 0);
    } catch { toast.error('Failed to load receipts'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1); }, []);

  const searchFamilies = async (q: string) => {
    setFamilySearch(q);
    if (q.length < 2) { setFamilyResults([]); return; }
    try {
      const r = await familiesApi.list({ search: q, limit: 10 });
      setFamilyResults(r.data.data || r.data || []);
    } catch { setFamilyResults([]); }
  };

  const openCreate = () => {
    setSelectedFamily(null);
    setFamilySearch('');
    setFamilyResults([]);
    setReceiptAmount('');
    setReceiptDate(new Date().toISOString().split('T')[0]);
    setShowModal(true);
  };

  const onCreateReceipt = async () => {
    if (!selectedFamily) { toast.error('Select a family'); return; }
    if (!receiptAmount || parseFloat(receiptAmount) <= 0) { toast.error('Enter a valid amount'); return; }
    setSaving(true);
    try {
      await donationsApi.createReceipt({
        familyId: selectedFamily.id,
        amount: parseFloat(receiptAmount),
        dateIssued: receiptDate,
      });
      toast.success('Receipt generated');
      setShowModal(false);
      load(page);
    } catch { toast.error('Failed to generate receipt'); }
    finally { setSaving(false); }
  };

  const downloadPdf = async (id: string) => {
    setDownloading(id);
    try {
      const r = await donationsApi.downloadReceiptPdf(id);
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch { toast.error('Failed to download PDF'); }
    finally { setDownloading(null); }
  };

  const viewDetails = async (receipt: Receipt) => {
    try {
      const r = await donationsApi.getReceipt(receipt.id);
      setViewReceipt(r.data);
    } catch {
      setViewReceipt(receipt);
    }
  };

  return (
    <div>
      <PageHeader
        title={L.receipts}
        subtitle="View and generate donation receipts"
        actions={
          hasRole('parish_admin', 'sacramental_clerk') ? (
            <button onClick={openCreate} className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors shadow-sm">
              + {L.generateReceipt}
            </button>
          ) : undefined
        }
      />

      <div className="px-8 py-6">
        {loading ? (
          <SkeletonTable rows={5} cols={5} />
        ) : receipts.length === 0 ? (
          <EmptyState
            icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>}
            title="No receipts yet"
            description="Generate a receipt to get started."
            action={
              hasRole('parish_admin', 'sacramental_clerk') ? (
                <button onClick={openCreate} className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">
                  + {L.generateReceipt}
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <table className="w-full text-sm">
                <thead className="bg-maroon-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.receiptNumber}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.familyName}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.amount}</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.dateIssued}</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.actions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receipts.map((r, i) => (
                    <motion.tr key={r.id} className="hover:bg-cream transition-colors"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                      <td className="px-4 py-3 font-medium text-maroon-900">{r.receipt_number}</td>
                      <td className="px-4 py-3">{r.family_name || '--'}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatINR(r.amount)}</td>
                      <td className="px-4 py-3 text-gray-600">{r.date_issued ? new Date(r.date_issued).toLocaleDateString('en-IN') : '--'}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => viewDetails(r)} className="btn-ghost text-xs text-blue-600" title={L.viewReceipt}>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                          </button>
                          <button onClick={() => downloadPdf(r.id)} disabled={downloading === r.id}
                            className="btn-ghost text-xs text-gold-700" title={L.downloadReceipt}>
                            {downloading === r.id ? (
                              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                            ) : (
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                            )}
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>

            {total > 20 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button disabled={page === 1} onClick={() => { setPage(p => p - 1); load(page - 1); }} className="btn-secondary text-sm disabled:opacity-40">Previous</button>
                <span className="px-4 py-2 text-sm text-gray-500 font-medium">Page {page}</span>
                <button disabled={page * 20 >= total} onClick={() => { setPage(p => p + 1); load(page + 1); }} className="btn-secondary text-sm disabled:opacity-40">Next</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Generate Receipt Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={L.generateReceipt} subtitle="Create a new donation receipt">
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.familyName} <span className="text-red-400">*</span></label>
            {selectedFamily ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 bg-maroon-50 rounded-lg text-sm font-medium">{selectedFamily.family_name || selectedFamily.familyName}</span>
                <button type="button" onClick={() => { setSelectedFamily(null); setFamilySearch(''); }}
                  className="text-sm text-red-500 hover:text-red-700 p-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ) : (
              <div className="relative">
                <input type="text" value={familySearch} onChange={e => searchFamilies(e.target.value)}
                  placeholder="Search family..." className="input w-full" />
                {familyResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {familyResults.map(f => (
                      <button key={f.id} type="button"
                        onClick={() => { setSelectedFamily(f); setFamilySearch(f.family_name || f.familyName || ''); setFamilyResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-maroon-50 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl">
                        {f.family_name || f.familyName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.amount} <span className="text-red-400">*</span></label>
              <input type="number" step="0.01" min="0.01" value={receiptAmount} onChange={e => setReceiptAmount(e.target.value)}
                className="input w-full" placeholder="0.00" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.dateIssued} <span className="text-red-400">*</span></label>
              <input type="date" value={receiptDate} onChange={e => setReceiptDate(e.target.value)} className="input w-full" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{L.cancel}</button>
            <button onClick={onCreateReceipt} disabled={saving}
              className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 disabled:opacity-50 transition-colors">
              {saving ? 'Generating...' : L.generateReceipt}
            </button>
          </div>
        </div>
      </Modal>

      {/* View Receipt Modal */}
      <Modal open={!!viewReceipt} onClose={() => setViewReceipt(null)} title="Receipt Details" subtitle={viewReceipt?.receipt_number}>
        {viewReceipt && (
          <div className="px-6 py-4 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{L.receiptNumber}</p>
                <p className="font-semibold text-maroon-900">{viewReceipt.receipt_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{L.dateIssued}</p>
                <p className="font-medium">{viewReceipt.date_issued ? new Date(viewReceipt.date_issued).toLocaleDateString('en-IN') : '--'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{L.familyName}</p>
                <p className="font-medium">{viewReceipt.family_name || '--'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-0.5">{L.amount}</p>
                <p className="font-bold text-lg text-maroon-900">{formatINR(viewReceipt.amount)}</p>
              </div>
            </div>
            {viewReceipt.amount_in_words_english && (
              <div className="bg-cream rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">Amount in Words (English)</p>
                <p className="text-sm font-medium">{viewReceipt.amount_in_words_english}</p>
              </div>
            )}
            {viewReceipt.amount_in_words_odia && (
              <div className="bg-cream rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-0.5">Amount in Words (Odia)</p>
                <p className="text-sm font-medium font-odia">{viewReceipt.amount_in_words_odia}</p>
              </div>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setViewReceipt(null)} className="btn-secondary">{L.cancel}</button>
              <button onClick={() => { downloadPdf(viewReceipt.id); setViewReceipt(null); }}
                className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">
                <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                {L.downloadReceipt}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
