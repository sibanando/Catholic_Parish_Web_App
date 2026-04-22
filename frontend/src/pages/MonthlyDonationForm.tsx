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

interface MonthlyRow {
  month: number;
  member: number;
  special: number;
  festival: number;
  others: number;
  total: number;
  cells: Record<string, { id: string; amount: string }[]>;
}

interface CellForm {
  amount: number;
  donationDate: string;
  remarks: string;
}

export default function MonthlyDonationForm() {
  const { hasRole } = useAuth();
  const [year, setYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [grandTotal, setGrandTotal] = useState(0);

  // Family search
  const [familySearch, setFamilySearch] = useState('');
  const [familyResults, setFamilyResults] = useState<Array<{ id: string; family_name: string; card_number?: string }>>([]);
  const [selectedFamily, setSelectedFamily] = useState<{ id: string; family_name: string; card_number?: string } | null>(null);
  const [cardNumber, setCardNumber] = useState('--');

  // Donation types
  const [donTypes, setDonTypes] = useState<DonationType[]>([]);
  const typeCodeMap: Record<string, string> = {};
  donTypes.forEach(t => { typeCodeMap[t.code] = t.id; });

  // Cell edit modal
  const [showCellModal, setShowCellModal] = useState(false);
  const [cellMonth, setCellMonth] = useState(1);
  const [cellTypeCode, setCellTypeCode] = useState('');
  const [cellEditId, setCellEditId] = useState<string | null>(null);
  const cellForm = useForm<CellForm>();

  useEffect(() => {
    donationsApi.getTypes().then(r => setDonTypes(r.data)).catch(console.error);
  }, []);

  const loadGrid = async () => {
    if (!selectedFamily) { setRows([]); setLoading(false); return; }
    setLoading(true);
    try {
      const r = await donationsApi.familyGrid(selectedFamily.id, year);
      const grid = r.data?.grid || [];

      const monthRows: MonthlyRow[] = Array.from({ length: 12 }, (_, i) => {
        const m = i + 1;
        const memberCells = grid.filter((g: { month: number; donation_type_id: string }) => g.month === m && g.donation_type_id === typeCodeMap['MEMBER']);
        const specialCells = grid.filter((g: { month: number; donation_type_id: string }) => g.month === m && g.donation_type_id === typeCodeMap['SPECIAL']);
        const festivalCells = grid.filter((g: { month: number; donation_type_id: string }) => g.month === m && g.donation_type_id === typeCodeMap['FESTIVAL']);
        const otherCells = grid.filter((g: { month: number; donation_type_id: string }) => g.month === m && g.donation_type_id === typeCodeMap['OTHER']);

        const sumCells = (cells: Array<{ amount: string }>) => cells.reduce((s: number, c: { amount: string }) => s + parseFloat(c.amount || '0'), 0);

        const member = sumCells(memberCells);
        const special = sumCells(specialCells);
        const festival = sumCells(festivalCells);
        const others = sumCells(otherCells);

        return {
          month: m,
          member,
          special,
          festival,
          others,
          total: member + special + festival + others,
          cells: {
            MEMBER: memberCells,
            SPECIAL: specialCells,
            FESTIVAL: festivalCells,
            OTHER: otherCells,
          },
        };
      });

      setRows(monthRows);
      setGrandTotal(monthRows.reduce((s, r) => s + r.total, 0));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (selectedFamily && donTypes.length > 0) loadGrid(); }, [selectedFamily, year, donTypes]);

  const searchFamilies = async (q: string) => {
    setFamilySearch(q);
    if (q.length < 2) { setFamilyResults([]); return; }
    try {
      const r = await familiesApi.list({ search: q, limit: 10 });
      const families = r.data.data || r.data || [];
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

  const selectFamily = (f: { id: string; family_name: string; card_number?: string }) => {
    setSelectedFamily(f);
    setCardNumber(f.card_number || '--');
    setFamilySearch(`${f.family_name} ${f.card_number ? `(${f.card_number})` : ''}`);
    setFamilyResults([]);
  };

  const openCell = (month: number, typeCode: string) => {
    const cells = rows[month - 1]?.cells[typeCode] || [];
    const existing = cells[0];
    setCellMonth(month);
    setCellTypeCode(typeCode);
    setCellEditId(existing?.id || null);
    cellForm.reset({
      amount: existing ? parseFloat(existing.amount) : 0,
      donationDate: new Date().toISOString().split('T')[0],
      remarks: '',
    });
    setShowCellModal(true);
  };

  const onCellSubmit = async (data: CellForm) => {
    if (!selectedFamily || !typeCodeMap[cellTypeCode]) return;
    try {
      if (cellEditId) {
        await donationsApi.update(cellEditId, { amount: Number(data.amount), donationDate: data.donationDate, remarks: data.remarks });
      } else {
        await donationsApi.create({
          familyId: selectedFamily.id,
          donationTypeId: typeCodeMap[cellTypeCode],
          donationDate: data.donationDate,
          month: cellMonth,
          year,
          amount: Number(data.amount),
          remarks: data.remarks,
        });
      }
      toast.success('Donation saved');
      setShowCellModal(false);
      loadGrid();
    } catch { toast.error('Failed to save'); }
  };

  return (
    <div>
      <PageHeader
        title="Monthly Donation Entry"
        subtitle="Family-wise monthly donation record"
      />

      <div className="p-8">
        {/* Family search */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-6 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.familyName}</label>
              <input
                value={familySearch}
                onChange={e => searchFamilies(e.target.value)}
                className="input w-full"
                placeholder="Search family name..."
              />
              {familyResults.length > 0 && !selectedFamily && (
                <div className="border border-gray-200 rounded-xl mt-1 divide-y max-h-40 overflow-y-auto shadow-lg relative z-10 bg-white">
                  {familyResults.map(f => (
                    <button key={f.id} type="button" onClick={() => selectFamily(f)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors">
                      {f.family_name} {f.card_number && <span className="text-gray-400 ml-2">Card: {f.card_number}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.cardNumber}</label>
              <div className="input w-full bg-gray-50 text-gray-700 cursor-default">{cardNumber}</div>
            </div>
          </div>
          {selectedFamily && (
            <div className="flex items-center gap-2 mt-3">
              <span className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                {selectedFamily.family_name} {selectedFamily.card_number && `(Card: ${selectedFamily.card_number})`}
              </span>
              <button onClick={() => { setSelectedFamily(null); setFamilySearch(''); setCardNumber('--'); setRows([]); }}
                className="text-xs text-gray-400 hover:text-red-500">Clear</button>
            </div>
          )}
        </div>

        {/* Year selector */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setYear(y => y - 1)} className="btn-secondary text-sm px-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          <span className="text-lg font-semibold">{year}</span>
          <button onClick={() => setYear(y => y + 1)} className="btn-secondary text-sm px-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
          </button>
        </div>

        {/* Monthly donation table */}
        <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto shadow-sm" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <table className="w-full text-sm">
            <thead className="bg-maroon-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700">Sl. No.</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700">{L.month}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700">{L.memberDonation}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700">{L.specialDonation}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700">{L.festivalDonation}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700">{L.others}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700">{L.total}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {!selectedFamily ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Select a family to view monthly donations</td></tr>
              ) : loading ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">Loading...</td></tr>
              ) : (
                rows.map((r, i) => (
                  <tr key={r.month} className="hover:bg-cream transition-colors">
                    <td className="px-4 py-2.5 text-gray-500">{i + 1}</td>
                    <td className="px-4 py-2.5 font-medium text-maroon-800">{L.months[r.month - 1]}</td>
                    {(['MEMBER', 'SPECIAL', 'FESTIVAL', 'OTHER'] as const).map(code => {
                      const val = code === 'MEMBER' ? r.member : code === 'SPECIAL' ? r.special : code === 'FESTIVAL' ? r.festival : r.others;
                      return (
                        <td key={code} className="text-right px-4 py-2.5">
                          {hasRole('parish_admin', 'sacramental_clerk') ? (
                            <button onClick={() => openCell(r.month, code)}
                              className={`px-2 py-0.5 rounded-lg text-xs hover:bg-maroon-100 transition-colors ${val > 0 ? 'font-medium text-maroon-800' : 'text-gray-300'}`}>
                              {val > 0 ? formatINR(val) : '--'}
                            </button>
                          ) : (
                            <span className={val > 0 ? 'font-medium' : 'text-gray-300'}>{val > 0 ? formatINR(val) : '--'}</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right px-4 py-2.5 font-bold text-maroon-900">{r.total > 0 ? formatINR(r.total) : '--'}</td>
                  </tr>
                ))
              )}
            </tbody>
            {selectedFamily && rows.length > 0 && (
              <tfoot className="bg-maroon-50">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right font-semibold text-maroon-800">{L.grandTotal}</td>
                  <td className="text-right px-4 py-3 font-bold text-maroon-900">{formatINR(rows.reduce((s, r) => s + r.member, 0))}</td>
                  <td className="text-right px-4 py-3 font-bold text-maroon-900">{formatINR(rows.reduce((s, r) => s + r.special, 0))}</td>
                  <td className="text-right px-4 py-3 font-bold text-maroon-900">{formatINR(rows.reduce((s, r) => s + r.festival, 0))}</td>
                  <td className="text-right px-4 py-3 font-bold text-maroon-900">{formatINR(rows.reduce((s, r) => s + r.others, 0))}</td>
                  <td className="text-right px-4 py-3 font-bold text-maroon-900">{formatINR(grandTotal)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </motion.div>
      </div>

      {/* Cell Edit Modal */}
      <Modal open={showCellModal} onClose={() => setShowCellModal(false)} title={cellEditId ? 'Edit Donation' : L.recordDonation}
        subtitle={`${L.months[cellMonth - 1]} - ${cellTypeCode === 'MEMBER' ? L.memberDonation : cellTypeCode === 'SPECIAL' ? L.specialDonation : cellTypeCode === 'FESTIVAL' ? L.festivalDonation : L.others}`} size="sm">
        <form onSubmit={cellForm.handleSubmit(onCellSubmit)} className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.amount} <span className="text-red-400">*</span></label>
            <input type="number" step="0.01" {...cellForm.register('amount', { required: true, valueAsNumber: true, min: 0.01 })} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.date} <span className="text-red-400">*</span></label>
            <input type="date" {...cellForm.register('donationDate', { required: true })} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.remarks}</label>
            <input {...cellForm.register('remarks')} className="input w-full" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={() => setShowCellModal(false)} className="btn-secondary">{L.cancel}</button>
            <button type="submit" className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">{L.save}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
