import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { familiesApi, peopleApi, donationsApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Breadcrumb from '../components/ui/Breadcrumb';
import Modal from '../components/ui/Modal';
import { SkeletonCard } from '../components/ui/Skeleton';
import { SACRAMENT_COLORS } from '../types';
import type { Family, Person, DonationFamilyInfo, DonationType, DonationGridData, DonationFamilySummary } from '../types';
import { L, formatINR } from '../utils/donationLabels';

export default function FamilyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [family, setFamily] = useState<Family & { members: Person[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchResults, setSearchResults] = useState<Person[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [relationship, setRelationship] = useState('');
  const [adding, setAdding] = useState(false);
  const [searched, setSearched] = useState(false);

  // Donation state
  const [donInfo, setDonInfo] = useState<DonationFamilyInfo | null>(null);
  const [donTypes, setDonTypes] = useState<DonationType[]>([]);
  const [donGrid, setDonGrid] = useState<DonationGridData | null>(null);
  const [donSummary, setDonSummary] = useState<DonationFamilySummary | null>(null);
  const [donYear, setDonYear] = useState(new Date().getFullYear());
  const [showRecordDonModal, setShowRecordDonModal] = useState(false);
  const [recDonDeleting, setRecDonDeleting] = useState(false);
  const [recDonEditId, setRecDonEditId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<'card' | 'phone' | null>(null);
  const [editCardVal, setEditCardVal] = useState('');
  const [editPhoneVal, setEditPhoneVal] = useState('');
  const [savingField, setSavingField] = useState(false);
  const recDonForm = useForm<{ typeId: string; amount: number; donationDate: string; remarks: string }>();

  const saveInfoField = async (field: 'card' | 'phone', value: string) => {
    setSavingField(true);
    try {
      const payload = field === 'card' ? { cardNumber: value } : { phone: value };
      if (donInfo?.id) {
        // Record exists — use PUT (only send the changing field; COALESCE keeps the rest)
        await donationsApi.updateFamilyInfo(id!, payload);
      } else {
        // No record yet — create it with POST
        await donationsApi.upsertFamilyInfo({ familyId: id, ...payload });
      }
      toast.success('Saved');
      setEditingField(null);
      loadDonations(donYear);
    } catch { toast.error('Failed to save'); }
    finally { setSavingField(false); }
  };

  const loadDonations = async (y: number) => {
    if (!id) return;
    try {
      const [infoR, typesR, gridR, summaryR] = await Promise.all([
        donationsApi.getFamilyInfo(id),
        donationsApi.getTypes(),
        donationsApi.familyGrid(id, y),
        donationsApi.familySummary(id, { year: y }),
      ]);
      setDonInfo(infoR.data);
      let types: DonationType[] = Array.isArray(typesR.data) ? typesR.data : [];
      if (types.length === 0) {
        try { const seedR = await donationsApi.seedTypes(); types = Array.isArray(seedR.data) ? seedR.data : []; }
        catch { /* non-admin: types stay empty */ }
      }
      setDonTypes(types);
      setDonGrid(gridR.data);
      setDonSummary(summaryR.data);
    } catch (e) { console.error(e); }
  };

  const load = async () => {
    try {
      const r = await familiesApi.get(id!);
      setFamily(r.data);
    } catch { navigate('/families'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); loadDonations(donYear); }, [id]);
  useEffect(() => { loadDonations(donYear); }, [donYear]);

  const searchPeople = async (q: string) => {
    if (q.length < 2) { setSearchResults([]); setSearched(false); return; }
    const r = await peopleApi.list({ search: q, limit: 10 });
    setSearchResults(r.data.data);
    setSearched(true);
  };

  const addMember = async () => {
    if (!selectedPerson || !relationship) return;
    setAdding(true);
    try {
      await familiesApi.addMember(id!, { personId: selectedPerson.id, relationship });
      toast.success('Member added to family');
      setShowAddMember(false);
      setSelectedPerson(null);
      setRelationship('');
      setSearchQuery('');
      setSearchResults([]);
      setSearched(false);
      load();
    } catch { toast.error('Failed to add member'); }
    finally { setAdding(false); }
  };

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
  if (!family) return null;

  const familyDisplayName = family.family_name ?? family.familyName;

  return (
    <div>
      <Breadcrumb items={[{ label: 'Families', to: '/families' }, { label: `${familyDisplayName} Family` }]} />
      <PageHeader
        title={`${familyDisplayName} Family`}
        subtitle={family.address || 'No address recorded'}
        actions={
          <div className="flex gap-3">
            {hasRole('parish_admin', 'sacramental_clerk') && (
              <button onClick={() => setShowAddMember(true)} className="btn-primary">+ Add Member</button>
            )}
            <button onClick={() => navigate('/families')} className="btn-secondary">
              <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              Back
            </button>
          </div>
        }
      />

      <div className="p-8">
        {/* Family info card */}
        <motion.div className="card mb-6" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500 text-xs">Status</span><p className="font-medium capitalize mt-0.5"><span className={`badge ${family.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{family.status}</span></p></div>
            <div><span className="text-gray-500 text-xs">Members</span><p className="font-semibold text-navy-900 mt-0.5">{family.members?.length ?? 0}</p></div>
            {family.notes && <div><span className="text-gray-500 text-xs">Notes</span><p className="mt-0.5">{family.notes}</p></div>}
          </div>
        </motion.div>

        {/* Members */}
        <h3 className="font-serif text-lg font-semibold text-navy-900 mb-4">Family Members</h3>
        {!family.members?.length ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-dashed border-gray-200 text-gray-400">
            <svg className="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>
            <p>No members yet. Add the first member to this family.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {family.members.map((member, i) => (
              <motion.div key={member.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link
                  to={`/people/${member.id}`}
                  className="bg-white rounded-2xl border border-gray-200 p-5 hover:border-navy-300 hover:shadow-md transition-all block group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm ${member.gender === 'female' ? 'bg-pink-400' : 'bg-blue-400'}`}>
                        {(member.first_name ?? member.firstName)?.[0]}{(member.last_name ?? member.lastName)?.[0]}
                      </div>
                      <div>
                        <p className="font-medium text-navy-800 group-hover:text-navy-900">{member.first_name ?? member.firstName} {member.last_name ?? member.lastName}</p>
                        <p className="text-xs text-gray-500 capitalize">{member.relationship}</p>
                      </div>
                    </div>
                    <span className={`badge ${member.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{member.status}</span>
                  </div>
                  {(member.dob) && <p className="text-xs text-gray-400 ml-[52px]">Born: {new Date(member.dob).toLocaleDateString()}</p>}
                  {member.sacraments?.length ? (
                    <div className="flex flex-wrap gap-1.5 mt-2 ml-[52px]">
                      {(member.sacraments as Array<{ code: string; name: string; status: string }>).map(s => (
                        <span key={s.code} className={`px-2 py-0.5 rounded-full text-xs font-medium ${SACRAMENT_COLORS[s.code] || 'bg-gray-100 text-gray-600'}`}>
                          {s.name?.split(' ')[0]}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 ml-[52px] mt-2">No sacraments recorded</p>
                  )}
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Donation Section */}
      <div className="px-8 pb-8">
        <div className="border-t-2 border-maroon-200 pt-6 mt-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-serif text-lg font-semibold text-maroon-900">{L.donationInfo}</h3>
            <div className="flex items-center gap-2">
              <button onClick={async () => {
                try {
                  const r = await donationsApi.familyExport(id!, donYear);
                  const url = window.URL.createObjectURL(new Blob([r.data]));
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${familyDisplayName || 'family'}_donations_${donYear}.xlsx`;
                  a.click();
                  window.URL.revokeObjectURL(url);
                  toast.success('Excel exported');
                } catch { toast.error('Export failed'); }
              }} className="btn-secondary text-sm">
                <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                Export
              </button>
              <button onClick={() => setDonYear(y => y - 1)} className="btn-secondary text-sm px-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </button>
              <span className="text-sm font-semibold px-2">{donYear}</span>
              <button onClick={() => setDonYear(y => y + 1)} className="btn-secondary text-sm px-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              </button>
            </div>
          </div>

          {/* Donation Family Info */}
          <div className="bg-cream rounded-2xl border border-maroon-200 p-5 mb-4">
            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              {/* Family Card No — inline edit */}
              <div>
                <span className="text-gray-500 text-xs block mb-1">{L.cardNumber}</span>
                {editingField === 'card' ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editCardVal}
                      onChange={e => setEditCardVal(e.target.value)}
                      className="input flex-1 py-1.5 text-sm"
                      placeholder="Card number..."
                    />
                    <button disabled={savingField} onClick={() => saveInfoField('card', editCardVal)}
                      className="px-3 py-1.5 bg-maroon-600 text-white rounded-lg text-xs font-medium hover:bg-maroon-700 transition-colors disabled:opacity-50">
                      {savingField ? '...' : 'Save'}
                    </button>
                    <button onClick={() => saveInfoField('card', '')}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors">
                      Remove
                    </button>
                    <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{donInfo?.card_number || '--'}</span>
                    {hasRole('parish_admin', 'sacramental_clerk') && (
                      <button onClick={() => { setEditCardVal(donInfo?.card_number || ''); setEditingField('card'); }}
                        className="text-maroon-500 hover:text-maroon-700 text-xs underline">Edit</button>
                    )}
                  </div>
                )}
              </div>
              {/* Phone — inline edit */}
              <div>
                <span className="text-gray-500 text-xs block mb-1">{L.phone}</span>
                {editingField === 'phone' ? (
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={editPhoneVal}
                      onChange={e => setEditPhoneVal(e.target.value)}
                      className="input flex-1 py-1.5 text-sm"
                      placeholder="Phone number..."
                    />
                    <button disabled={savingField} onClick={() => saveInfoField('phone', editPhoneVal)}
                      className="px-3 py-1.5 bg-maroon-600 text-white rounded-lg text-xs font-medium hover:bg-maroon-700 transition-colors disabled:opacity-50">
                      {savingField ? '...' : 'Save'}
                    </button>
                    <button onClick={() => saveInfoField('phone', '')}
                      className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-medium hover:bg-red-200 transition-colors">
                      Remove
                    </button>
                    <button onClick={() => setEditingField(null)} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{donInfo?.phone || '--'}</span>
                    {hasRole('parish_admin', 'sacramental_clerk') && (
                      <button onClick={() => { setEditPhoneVal(donInfo?.phone || ''); setEditingField('phone'); }}
                        className="text-maroon-500 hover:text-maroon-700 text-xs underline">Edit</button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {hasRole('parish_admin', 'sacramental_clerk') && (
              <div className="flex items-center gap-4 pt-3 border-t border-maroon-100">
                <button onClick={() => {
                  setRecDonEditId(null);
                  recDonForm.reset({ typeId: '', amount: 0, donationDate: new Date().toISOString().split('T')[0], remarks: '' });
                  setShowRecordDonModal(true);
                }} className="inline-flex items-center gap-1.5 px-4 py-2 bg-maroon-700 text-white rounded-xl text-sm font-medium hover:bg-maroon-800 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                  Record Donation
                </button>
              </div>
            )}
          </div>

          {/* Payment Grid */}
          {donTypes.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto mb-4 shadow-sm">
              <table className="w-full text-sm">
                <thead className="bg-maroon-50">
                  <tr>
                    <th className="text-left px-3 py-2.5 text-xs font-semibold text-maroon-700">{L.month}</th>
                    {donTypes.map(t => (
                      <th key={t.id} className="text-right px-3 py-2.5 text-xs font-semibold text-maroon-700">{t.name}</th>
                    ))}
                    <th className="text-right px-3 py-2.5 text-xs font-semibold text-maroon-700">{L.total}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
                    const rowTotal = donTypes.reduce((sum, t) => {
                      const cell = donGrid?.grid.find(g => g.month === m && g.donation_type_id === t.id);
                      return sum + (cell ? parseFloat(cell.amount) : 0);
                    }, 0);
                    return (
                      <tr key={m} className="hover:bg-cream transition-colors">
                        <td className="px-3 py-2 font-medium text-maroon-800">{L.months[m - 1]}</td>
                        {donTypes.map(t => {
                          const cells = donGrid?.grid.filter(g => g.month === m && g.donation_type_id === t.id) || [];
                          const amt = cells.reduce((s, c) => s + parseFloat(c.amount), 0);
                          const existingCell = cells[0];
                          return (
                            <td key={t.id} className="text-right px-3 py-2">
                              {hasRole('parish_admin', 'sacramental_clerk') ? (
                                <button
                                  onClick={() => {
                                    setRecDonEditId(existingCell?.id || null);
                                    recDonForm.reset({ typeId: t.id, amount: amt || 0, donationDate: existingCell?.donation_date?.split('T')[0] || new Date().toISOString().split('T')[0], remarks: existingCell?.remarks || '' });
                                    setShowRecordDonModal(true);
                                  }}
                                  className={`px-2 py-0.5 rounded-lg text-xs hover:bg-maroon-100 transition-colors ${amt > 0 ? 'font-medium text-maroon-800' : 'text-gray-300'}`}
                                >
                                  {amt > 0 ? formatINR(amt) : '--'}
                                </button>
                              ) : (
                                <span className={amt > 0 ? 'font-medium' : 'text-gray-300'}>{amt > 0 ? formatINR(amt) : '--'}</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="text-right px-3 py-2 font-bold text-maroon-900">{rowTotal > 0 ? formatINR(rowTotal) : '--'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Annual Summary */}
          {donSummary && (
            <motion.div className="card" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <h4 className="text-sm font-semibold text-maroon-800 mb-3">{L.annualSummary} -- {donYear}</h4>
              <div className="space-y-2 text-sm">
                {donSummary.byType.map(t => (
                  <div key={t.name} className="flex justify-between">
                    <span className="text-gray-600">{t.name}</span>
                    <span className="font-medium tabular-nums">{formatINR(parseFloat(t.total))}</span>
                  </div>
                ))}
                <div className="border-t border-gray-200 pt-2 flex justify-between font-bold">
                  <span>{L.grandTotal}</span>
                  <span className="text-maroon-800">{formatINR(donSummary.grandTotal)}</span>
                </div>
                {donSummary.annualPledge > 0 && (
                  <>
                    <div className="flex justify-between text-gray-500">
                      <span>{L.annualPledge}</span>
                      <span>{formatINR(donSummary.annualPledge)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>{L.balanceDue}</span>
                      <span className={donSummary.balance > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                        {donSummary.balance > 0 ? formatINR(donSummary.balance) : 'Paid'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Record / Edit Donation Modal */}
      <Modal open={showRecordDonModal} onClose={() => { setShowRecordDonModal(false); setRecDonEditId(null); }} title={recDonEditId ? 'Edit Donation' : L.recordDonation}>
        <form onSubmit={recDonForm.handleSubmit(async (data) => {
          if (!data.typeId) { toast.error('Please select a donation type'); return; }
          try {
            if (recDonEditId) {
              await donationsApi.update(recDonEditId, { amount: Number(data.amount), donationDate: data.donationDate, remarks: data.remarks });
              toast.success('Donation updated');
            } else {
              const d = new Date(data.donationDate);
              await donationsApi.create({ familyId: id, donationTypeId: data.typeId, donationDate: data.donationDate, month: d.getMonth() + 1, year: d.getFullYear(), amount: Number(data.amount), remarks: data.remarks });
              toast.success('Donation recorded');
            }
            setShowRecordDonModal(false); setRecDonEditId(null); loadDonations(donYear);
          } catch { toast.error('Failed to save donation'); }
        })} className="px-6 py-4 space-y-4">
          {/* Family info display */}
          <div className="grid grid-cols-2 gap-3 bg-cream rounded-xl p-3 text-sm border border-maroon-100">
            <div>
              <span className="text-gray-500 text-xs">Family Name</span>
              <p className="font-medium mt-0.5 text-navy-900">{familyDisplayName}</p>
            </div>
            <div>
              <span className="text-gray-500 text-xs">{L.cardNumber}</span>
              <p className="font-medium mt-0.5 text-navy-900">{donInfo?.card_number || '--'}</p>
            </div>
          </div>
          {/* Donation type dropdown — populated from loaded donTypes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Donation Type <span className="text-red-400">*</span></label>
            <select {...recDonForm.register('typeId', { required: true })} className="input w-full" disabled={!!recDonEditId}>
              <option value="">-- Select Type --</option>
              {(['MEMBER', 'PETERS_PENCE', 'FESTIVAL'] as const).map(code => {
                const t = donTypes.find(dt => dt.code === code);
                if (!t) return null;
                const labels: Record<string, string> = {
                  MEMBER: 'Family Card (Monthly Pledge)',
                  PETERS_PENCE: 'Punya Pita Chanda (Pop\'s Offering) — Yearly Pledge',
                  FESTIVAL: 'Festive Occasion',
                };
                return <option key={t.id} value={t.id}>{labels[code]}</option>;
              })}
              {/* Fallback: show any type not in the 3 above */}
              {donTypes.filter(t => !['MEMBER', 'PETERS_PENCE', 'FESTIVAL'].includes(t.code)).map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.amount} <span className="text-red-400">*</span></label>
            <input type="number" step="0.01" {...recDonForm.register('amount', { required: true, valueAsNumber: true, min: 0.01 })} className="input w-full" placeholder="₹" />
          </div>
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.date} <span className="text-red-400">*</span></label>
            <input type="date" {...recDonForm.register('donationDate', { required: true })} className="input w-full" />
          </div>
          {/* Note */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <input {...recDonForm.register('remarks')} className="input w-full" placeholder="Optional note..." />
          </div>
          {/* Action buttons */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            {recDonEditId && hasRole('parish_admin') ? (
              <button type="button" disabled={recDonDeleting} onClick={async () => {
                setRecDonDeleting(true);
                try {
                  await donationsApi.delete(recDonEditId);
                  toast.success('Donation deleted');
                  setShowRecordDonModal(false); setRecDonEditId(null); loadDonations(donYear);
                } catch { toast.error('Failed to delete'); }
                finally { setRecDonDeleting(false); }
              }} className="px-4 py-2.5 bg-red-100 text-red-700 rounded-xl text-sm font-medium hover:bg-red-200 transition-colors">
                {recDonDeleting ? 'Deleting...' : 'Delete'}
              </button>
            ) : <span />}
            <div className="flex gap-3">
              <button type="button" onClick={() => { setShowRecordDonModal(false); setRecDonEditId(null); }} className="btn-secondary">{L.cancel}</button>
              <button type="submit" className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">
                {recDonEditId ? 'Update' : L.save}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      {/* Add Member Modal */}
      <Modal open={showAddMember} onClose={() => { setShowAddMember(false); setSelectedPerson(null); setSearchQuery(''); setRelationship(''); setSearched(false); setSearchResults([]); }} title="Add Member to Family">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Person</label>
            <input
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); searchPeople(e.target.value); }}
              className="input w-full"
              placeholder="Type a name..."
            />
            {searchResults.length > 0 && !selectedPerson && (
              <div className="border border-gray-200 rounded-xl mt-1 divide-y max-h-40 overflow-y-auto shadow-lg">
                {searchResults.map(p => (
                  <button key={p.id} onClick={() => { setSelectedPerson(p); setSearchQuery(`${p.first_name ?? p.firstName} ${p.last_name ?? p.lastName}`); setSearchResults([]); setSearched(false); }}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors">
                    {p.first_name ?? p.firstName} {p.last_name ?? p.lastName}
                  </button>
                ))}
              </div>
            )}
            {searched && searchResults.length === 0 && !selectedPerson && (
              <div className="border border-amber-200 bg-amber-50 rounded-xl mt-1 px-3 py-2.5 text-sm text-amber-800">
                No person found. <a href="/people" className="underline font-medium text-amber-900">Create a new person first</a>, then add them here.
              </div>
            )}
            {selectedPerson && (
              <div className="flex items-center gap-2 mt-1 bg-emerald-50 rounded-lg px-3 py-2 text-sm text-emerald-700">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                Selected: {selectedPerson.first_name ?? selectedPerson.firstName} {selectedPerson.last_name ?? selectedPerson.lastName}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Relationship <span className="text-red-400">*</span></label>
            <select value={relationship} onChange={e => setRelationship(e.target.value)} className="input w-full">
              <option value="">Select relationship</option>
              <option value="head">Head of Household</option>
              <option value="spouse">Spouse</option>
              <option value="child">Child</option>
              <option value="parent">Parent</option>
              <option value="grandparent">Grandparent</option>
              <option value="sibling">Sibling</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={() => { setShowAddMember(false); setSelectedPerson(null); setSearchQuery(''); setRelationship(''); setSearched(false); setSearchResults([]); }} className="btn-secondary flex-1">Cancel</button>
            <button onClick={addMember} disabled={!selectedPerson || !relationship || adding} className="btn-primary flex-1">
              {adding ? 'Adding...' : 'Add Member'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
