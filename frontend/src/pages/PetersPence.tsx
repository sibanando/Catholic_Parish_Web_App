import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { donationsApi, familiesApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/ui/Modal';
import type { DonationType } from '../types';
import { L, formatINR } from '../utils/donationLabels';

interface PetersPenceEntry {
  id: string;
  family_name: string;
  card_number: string;
  ward_name: string;
  unit_name: string;
  amount: string;
  donation_date: string;
  year: number;
  remarks: string;
}

interface PetersPenceForm {
  familySearch: string;
  familyId: string;
  amount: number;
  donationDate: string;
  year: number;
  remarks: string;
}

export default function PetersPence() {
  const { hasRole } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [entries, setEntries] = useState<PetersPenceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [petersPenceType, setPetersPenceType] = useState<DonationType | null>(null);
  const [familyResults, setFamilyResults] = useState<Array<{ id: string; family_name: string; card_number?: string }>>([]);
  const [selectedFamily, setSelectedFamily] = useState<{ id: string; family_name: string; card_number?: string } | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<PetersPenceForm>();

  const loadData = async () => {
    setLoading(true);
    try {
      const typesR = await donationsApi.getTypes();
      const ppType = typesR.data.find((t: DonationType) => t.code === 'PETERS_PENCE');
      setPetersPenceType(ppType || null);

      if (ppType) {
        const r = await donationsApi.list({ typeId: ppType.id, year, limit: 1000 });
        setEntries(r.data.data || r.data || []);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [year]);

  const searchFamilies = async (q: string) => {
    if (q.length < 2) { setFamilyResults([]); return; }
    try {
      const r = await familiesApi.list({ search: q, limit: 10 });
      const families = r.data.data || r.data || [];
      // Enrich with card numbers
      const enriched = await Promise.all(families.map(async (f: { id: string; family_name?: string; familyName?: string }) => {
        try {
          const info = await donationsApi.getFamilyInfo(f.id);
          return { id: f.id, family_name: f.family_name || f.familyName, card_number: info.data?.card_number };
        } catch {
          return { id: f.id, family_name: f.family_name || f.familyName, card_number: undefined };
        }
      }));
      setFamilyResults(enriched);
    } catch { setFamilyResults([]); }
  };

  const openCreate = () => {
    setEditId(null);
    setSelectedFamily(null);
    setFamilyResults([]);
    reset({ familySearch: '', familyId: '', amount: 0, donationDate: new Date().toISOString().split('T')[0], year, remarks: '' });
    setShowModal(true);
  };

  const onSubmit = async (data: PetersPenceForm) => {
    if (!petersPenceType) { toast.error("Peter's Pence donation type not found. Please seed donation types first."); return; }
    if (!selectedFamily && !editId) { toast.error('Please select a family'); return; }
    try {
      if (editId) {
        await donationsApi.update(editId, { amount: Number(data.amount), donationDate: data.donationDate, remarks: data.remarks });
        toast.success('Updated successfully');
      } else {
        await donationsApi.create({
          familyId: selectedFamily!.id,
          donationTypeId: petersPenceType.id,
          donationDate: data.donationDate,
          month: new Date(data.donationDate).getMonth() + 1,
          year: data.year,
          amount: Number(data.amount),
          remarks: data.remarks,
        });
        toast.success("Peter's Pence recorded");
      }
      setShowModal(false);
      loadData();
    } catch { toast.error('Failed to save'); }
  };

  const totalAmount = entries.reduce((sum, e) => sum + parseFloat(e.amount || '0'), 0);

  return (
    <div>
      <PageHeader
        title="Peter's Pence"
        subtitle="Holy Father's Offering (Yearly)"
        actions={
          hasRole('parish_admin', 'sacramental_clerk') ? (
            <button onClick={openCreate} className="btn-primary">+ Record Offering</button>
          ) : undefined
        }
      />

      <div className="p-8">
        {/* Year selector */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setYear(y => y - 1)} className="btn-secondary text-sm px-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          <span className="text-lg font-semibold">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="btn-secondary text-sm px-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
          </button>
        </div>

        {!petersPenceType && !loading && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 mb-6 text-amber-800">
            Peter's Pence donation type not found. Please go to Donations and seed the default donation types first.
          </div>
        )}

        {/* Table */}
        <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <table className="w-full text-sm">
            <thead className="bg-navy-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy-700">Sl. No.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy-700">{L.cardNumber}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy-700">{L.familyName}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy-700">{L.ward}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy-700">{L.unit}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy-700">{L.date}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-navy-700">{L.amount}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-navy-700">{L.remarks}</th>
                {hasRole('parish_admin', 'sacramental_clerk') && (
                  <th className="text-center px-4 py-3 text-xs font-semibold text-navy-700">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">No Peter's Pence offerings recorded for {year}</td></tr>
              ) : (
                entries.map((e, i) => (
                  <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600">{i + 1}</td>
                    <td className="px-4 py-3 font-medium">{e.card_number || '--'}</td>
                    <td className="px-4 py-3">{e.family_name}</td>
                    <td className="px-4 py-3 text-gray-600">{e.ward_name || '--'}</td>
                    <td className="px-4 py-3 text-gray-600">{e.unit_name || '--'}</td>
                    <td className="px-4 py-3 text-gray-600">{e.donation_date ? new Date(e.donation_date).toLocaleDateString() : '--'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatINR(parseFloat(e.amount))}</td>
                    <td className="px-4 py-3 text-gray-500">{e.remarks || '--'}</td>
                    {hasRole('parish_admin', 'sacramental_clerk') && (
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => {
                          setEditId(e.id);
                          setSelectedFamily({ id: '', family_name: e.family_name, card_number: e.card_number });
                          reset({ familySearch: e.family_name, familyId: '', amount: parseFloat(e.amount), donationDate: e.donation_date?.split('T')[0] || '', year, remarks: e.remarks || '' });
                          setShowModal(true);
                        }} className="text-navy-600 hover:text-navy-800 text-xs font-medium">Edit</button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
            {entries.length > 0 && (
              <tfoot className="bg-navy-50">
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-right font-semibold text-navy-800">{L.total}</td>
                  <td className="px-4 py-3 text-right font-bold text-navy-900">{formatINR(totalAmount)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </motion.div>
      </div>

      {/* Record / Edit Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editId ? "Edit Peter's Pence" : "Record Peter's Pence"} subtitle="Holy Father's Offering">
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 py-4 space-y-3">
          {!editId && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.familyName}</label>
              <input
                {...register('familySearch')}
                onChange={e => { setValue('familySearch', e.target.value); setSelectedFamily(null); searchFamilies(e.target.value); }}
                className="input w-full"
                placeholder="Search family name..."
              />
              {familyResults.length > 0 && !selectedFamily && (
                <div className="border border-gray-200 rounded-xl mt-1 divide-y max-h-40 overflow-y-auto shadow-lg">
                  {familyResults.map(f => (
                    <button key={f.id} type="button" onClick={() => {
                      setSelectedFamily(f);
                      setValue('familySearch', `${f.family_name} ${f.card_number ? `(${f.card_number})` : ''}`);
                      setFamilyResults([]);
                    }} className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors">
                      {f.family_name} {f.card_number && <span className="text-gray-400 ml-2">Card: {f.card_number}</span>}
                    </button>
                  ))}
                </div>
              )}
              {selectedFamily && (
                <div className="flex items-center gap-2 mt-1 bg-emerald-50 rounded-lg px-3 py-2 text-sm text-emerald-700">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                  {selectedFamily.family_name} {selectedFamily.card_number && `(Card: ${selectedFamily.card_number})`}
                </div>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.amount} <span className="text-red-400">*</span></label>
              <input type="number" step="0.01" {...register('amount', { required: true, valueAsNumber: true, min: 0.01 })} className="input w-full" />
              {errors.amount && <p className="text-xs text-red-500 mt-1">Amount is required</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.date} <span className="text-red-400">*</span></label>
              <input type="date" {...register('donationDate', { required: true })} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.year}</label>
            <input type="number" {...register('year', { valueAsNumber: true })} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.remarks}</label>
            <input {...register('remarks')} className="input w-full" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowModal(false)} className="btn-secondary">{L.cancel}</button>
            <button type="submit" className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">{L.save}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
