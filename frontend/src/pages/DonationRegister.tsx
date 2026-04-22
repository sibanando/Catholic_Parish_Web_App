import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { donationsApi, familiesApi } from '../api/client';
import { Donation, DonationType, Family, Ward } from '../types';
import { L, formatINR } from '../utils/donationLabels';
import PageHeader from '../components/PageHeader';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';

interface DonationForm {
  familyId: string;
  donationTypeId: string;
  donationDate: string;
  month: number;
  year: number;
  amount: number;
  remarks: string;
}

export default function DonationRegister() {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [types, setTypes] = useState<DonationType[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [filterMonth, setFilterMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [familySearch, setFamilySearch] = useState('');
  const [familyResults, setFamilyResults] = useState<Family[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<Family | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Donation | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterWard, setFilterWard] = useState('');
  const [filterType, setFilterType] = useState('');
  const [wards, setWards] = useState<Ward[]>([]);
  const [downloadingPdf, setDownloadingPdf] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [generatingReceipt, setGeneratingReceipt] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<DonationForm>();

  const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
  const months = L.monthsShort;

  const load = async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = { month: filterMonth, year: filterYear, page: p, limit: 30 };
      if (filterWard) params.wardId = filterWard;
      if (filterType) params.typeId = filterType;
      const r = await donationsApi.list(params);
      setDonations(r.data.data);
      setTotal(r.data.total);
    } catch { toast.error('Failed to load donations'); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    donationsApi.getTypes().then(r => setTypes(r.data)).catch(() => {});
    donationsApi.getWards().then(r => setWards(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => { setPage(1); load(1); }, [filterMonth, filterYear, filterWard, filterType]);

  const searchFamilies = async (q: string) => {
    setFamilySearch(q);
    if (q.length < 2) { setFamilyResults([]); return; }
    try {
      const r = await familiesApi.list({ search: q, limit: 10 });
      setFamilyResults(r.data.data);
    } catch { setFamilyResults([]); }
  };

  const openCreate = () => {
    setEditId(null);
    setSelectedFamily(null);
    setFamilySearch('');
    setFamilyResults([]);
    reset({
      familyId: '', donationTypeId: types[0]?.id || '', donationDate: new Date().toISOString().split('T')[0],
      month: filterMonth, year: filterYear, amount: 0, remarks: '',
    });
    setShowModal(true);
  };

  const openEdit = (d: Donation) => {
    setEditId(d.id);
    setSelectedFamily({ id: d.family_id, familyName: d.family_name || '', family_name: d.family_name } as Family);
    reset({
      familyId: d.family_id, donationTypeId: d.donation_type_id, donationDate: d.donation_date?.split('T')[0],
      month: d.month, year: d.year, amount: d.amount, remarks: d.remarks || '',
    });
    setShowModal(true);
  };

  const onSubmit = async (form: DonationForm) => {
    setSaving(true);
    try {
      if (editId) {
        await donationsApi.update(editId, form);
        toast.success('Donation updated');
      } else {
        await donationsApi.create(form);
        toast.success('Donation recorded');
      }
      setShowModal(false);
      load(page);
    } catch { toast.error('Failed to save donation'); }
    finally { setSaving(false); }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await donationsApi.delete(deleteTarget.id);
      toast.success('Donation deleted');
      setDeleteTarget(null);
      load(page);
    } catch { toast.error('Failed to delete donation'); }
    finally { setDeleting(false); }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const r = await donationsApi.exportRegister({ month: filterMonth, year: filterYear });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `register-${filterYear}-${filterMonth}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); }
    finally { setExporting(false); }
  };

  const generateReceipt = async (d: Donation) => {
    setGeneratingReceipt(d.id);
    try {
      await donationsApi.createReceipt({
        donationId: d.id, familyId: d.family_id, amount: d.amount,
        dateIssued: d.donation_date?.split('T')[0] || new Date().toISOString().split('T')[0],
      });
      toast.success('Receipt generated');
      load(page);
    } catch { toast.error('Failed to generate receipt'); }
    finally { setGeneratingReceipt(null); }
  };

  const downloadReceiptPdf = async (receiptId: string) => {
    setDownloadingPdf(receiptId);
    try {
      const r = await donationsApi.downloadReceiptPdf(receiptId);
      const url = URL.createObjectURL(new Blob([r.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${receiptId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download PDF'); }
    finally { setDownloadingPdf(null); }
  };

  return (
    <div>
      <PageHeader
        title={L.register}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <select value={filterMonth} onChange={e => setFilterMonth(parseInt(e.target.value))} className="input text-sm bg-white">
              {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={filterYear} onChange={e => setFilterYear(parseInt(e.target.value))} className="input text-sm bg-white">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {wards.length > 0 && (
              <select value={filterWard} onChange={e => setFilterWard(e.target.value)} className="input text-sm bg-white">
                <option value="">All Wards</option>
                {wards.map(w => <option key={w.id} value={w.id}>{w.ward_name}</option>)}
              </select>
            )}
            {types.length > 0 && (
              <select value={filterType} onChange={e => setFilterType(e.target.value)} className="input text-sm bg-white">
                <option value="">All Types</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            <button onClick={exportExcel} disabled={exporting} className="btn-secondary disabled:opacity-50">
              <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
              {exporting ? 'Exporting...' : L.export}
            </button>
            <button onClick={openCreate} className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors shadow-sm">
              + {L.recordDonation}
            </button>
          </div>
        }
      />

      <div className="px-8 py-6">
        {loading ? (
          <SkeletonTable rows={5} cols={7} />
        ) : donations.length === 0 ? (
          <EmptyState
            icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" /></svg>}
            title={`No donations for ${months[filterMonth - 1]} ${filterYear}`}
            description="Start by recording a donation."
            action={<button onClick={openCreate} className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">+ {L.recordDonation}</button>}
          />
        ) : (
          <motion.div
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <table className="w-full text-sm">
              <thead className="bg-maroon-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.date}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.familyName}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">Card #</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.donationType}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.amount}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">Receipt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.remarks}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {donations.map((d, i) => (
                  <motion.tr key={d.id} className="hover:bg-cream transition-colors"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                    <td className="px-4 py-3">{new Date(d.donation_date).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 font-medium text-maroon-900">{d.family_name}</td>
                    <td className="px-4 py-3 text-gray-500">{d.card_number || '--'}</td>
                    <td className="px-4 py-3">
                      <span className="badge bg-maroon-100 text-maroon-700">{d.donation_type_name}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">{formatINR(d.amount)}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {d.receipt_number ? (
                        <span className="text-maroon-600 font-medium">{d.receipt_number}</span>
                      ) : '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{d.remarks || ''}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        {!d.receipt_number && (
                          <button onClick={() => generateReceipt(d)} disabled={generatingReceipt === d.id} className="btn-ghost text-xs text-gold-700 disabled:opacity-50" title="Generate Receipt">
                            {generatingReceipt === d.id
                              ? <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                            }
                          </button>
                        )}
                        <button onClick={() => openEdit(d)} className="btn-ghost text-xs text-blue-600">Edit</button>
                        <button onClick={() => setDeleteTarget(d)} className="btn-ghost text-xs text-red-500">Del</button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}

        {total > 30 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button disabled={page === 1 || loading} onClick={() => { setPage(p => p - 1); load(page - 1); }} className="btn-secondary text-sm disabled:opacity-40">
              <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-500 font-medium">Page {page} of {Math.ceil(total / 30)}</span>
            <button disabled={page * 30 >= total || loading} onClick={() => { setPage(p => p + 1); load(page + 1); }} className="btn-secondary text-sm disabled:opacity-40">
              Next
              <svg className="w-4 h-4 ml-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? 'Edit Donation' : L.recordDonation} size="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {/* Family Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.familyName} <span className="text-red-400">*</span></label>
            {selectedFamily ? (
              <div className="flex items-center gap-2">
                <span className="flex-1 px-3 py-2 bg-maroon-50 rounded-lg text-sm font-medium">{selectedFamily.familyName || selectedFamily.family_name}</span>
                <button type="button" onClick={() => { setSelectedFamily(null); setValue('familyId', ''); }}
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
                        onClick={() => { setSelectedFamily(f); setValue('familyId', f.id); setFamilyResults([]); }}
                        className="w-full text-left px-3 py-2 hover:bg-maroon-50 text-sm transition-colors first:rounded-t-xl last:rounded-b-xl">
                        {f.familyName || f.family_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <input type="hidden" {...register('familyId', { required: true })} />
            {errors.familyId && <p className="text-red-500 text-xs mt-1">Family is required</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.donationType} <span className="text-red-400">*</span></label>
              <select {...register('donationTypeId', { required: true })} className="input w-full">
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.amount} <span className="text-red-400">*</span></label>
              <input type="number" step="0.01" {...register('amount', { required: true, valueAsNumber: true, min: 0.01 })}
                className="input w-full" placeholder="₹" />
              {errors.amount && <p className="text-red-500 text-xs mt-1">Amount required</p>}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.date} <span className="text-red-400">*</span></label>
              <input type="date" {...register('donationDate', { required: true })} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.month}</label>
              <select {...register('month', { valueAsNumber: true })} className="input w-full">
                {months.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.year}</label>
              <select {...register('year', { valueAsNumber: true })} className="input w-full">
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.remarks}</label>
            <input type="text" {...register('remarks')} className="input w-full" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1">{L.cancel}</button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : L.save}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Donation"
        message={<>Are you sure you want to delete this donation record for <strong>{deleteTarget?.family_name}</strong>? This cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
