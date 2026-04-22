import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { donationsApi } from '../api/client';
import { Ward, Unit, DonationType } from '../types';
import { L } from '../utils/donationLabels';
import PageHeader from '../components/PageHeader';
import Modal from '../components/ui/Modal';
import { SkeletonTable } from '../components/ui/Skeleton';
import EmptyState from '../components/ui/EmptyState';

const TABS = [
  { key: 'wards', label: L.wards },
  { key: 'units', label: L.units },
  { key: 'types', label: L.donationTypes },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function DonationSettings() {
  const [tab, setTab] = useState<TabKey>('wards');

  // Wards
  const [wards, setWards] = useState<Ward[]>([]);
  const [wardsLoading, setWardsLoading] = useState(true);
  const [showWardModal, setShowWardModal] = useState(false);
  const [editWard, setEditWard] = useState<Ward | null>(null);
  const [wardForm, setWardForm] = useState({ wardName: '', wardNameOdia: '', sortOrder: 0 });

  // Units
  const [units, setUnits] = useState<Unit[]>([]);
  const [unitsLoading, setUnitsLoading] = useState(true);
  const [showUnitModal, setShowUnitModal] = useState(false);
  const [editUnit, setEditUnit] = useState<Unit | null>(null);
  const [unitForm, setUnitForm] = useState({ wardId: '', unitName: '', unitNameOdia: '', sortOrder: 0 });
  const [unitWardFilter, setUnitWardFilter] = useState('');

  // Donation Types
  const [types, setTypes] = useState<DonationType[]>([]);
  const [typesLoading, setTypesLoading] = useState(true);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [editType, setEditType] = useState<DonationType | null>(null);
  const [typeForm, setTypeForm] = useState({ code: '', name: '', nameOdia: '', isRecurring: false, sortOrder: 0 });

  const [saving, setSaving] = useState(false);

  // Load data
  const loadWards = async () => {
    setWardsLoading(true);
    try { const r = await donationsApi.getWards(); setWards(r.data || []); }
    catch { toast.error('Failed to load wards'); }
    finally { setWardsLoading(false); }
  };

  const loadUnits = async () => {
    setUnitsLoading(true);
    try {
      const params: Record<string, unknown> = {};
      if (unitWardFilter) params.wardId = unitWardFilter;
      const r = await donationsApi.getUnits(params);
      setUnits(r.data || []);
    } catch { toast.error('Failed to load units'); }
    finally { setUnitsLoading(false); }
  };

  const loadTypes = async () => {
    setTypesLoading(true);
    try { const r = await donationsApi.getTypes(); setTypes(r.data || []); }
    catch { toast.error('Failed to load donation types'); }
    finally { setTypesLoading(false); }
  };

  useEffect(() => { loadWards(); }, []);
  useEffect(() => { if (tab === 'units') { loadWards(); loadUnits(); } }, [tab, unitWardFilter]);
  useEffect(() => { if (tab === 'types') loadTypes(); }, [tab]);

  // Ward CRUD
  const openWardCreate = () => { setEditWard(null); setWardForm({ wardName: '', wardNameOdia: '', sortOrder: 0 }); setShowWardModal(true); };
  const openWardEdit = (w: Ward) => { setEditWard(w); setWardForm({ wardName: w.ward_name, wardNameOdia: w.ward_name_odia || '', sortOrder: w.sort_order || 0 }); setShowWardModal(true); };
  const saveWard = async () => {
    if (!wardForm.wardName.trim()) { toast.error('Ward name required'); return; }
    setSaving(true);
    try {
      if (editWard) {
        await donationsApi.updateWard(editWard.id, wardForm);
        toast.success('Ward updated');
      } else {
        await donationsApi.createWard(wardForm);
        toast.success('Ward created');
      }
      setShowWardModal(false);
      loadWards();
    } catch { toast.error('Failed to save ward'); }
    finally { setSaving(false); }
  };

  // Unit CRUD
  const openUnitCreate = () => { setEditUnit(null); setUnitForm({ wardId: wards[0]?.id || '', unitName: '', unitNameOdia: '', sortOrder: 0 }); setShowUnitModal(true); };
  const openUnitEdit = (u: Unit) => { setEditUnit(u); setUnitForm({ wardId: u.ward_id, unitName: u.unit_name, unitNameOdia: u.unit_name_odia || '', sortOrder: u.sort_order || 0 }); setShowUnitModal(true); };
  const saveUnit = async () => {
    if (!unitForm.unitName.trim()) { toast.error('Unit name required'); return; }
    if (!unitForm.wardId) { toast.error('Select a ward'); return; }
    setSaving(true);
    try {
      if (editUnit) {
        await donationsApi.updateUnit(editUnit.id, { unitName: unitForm.unitName, unitNameOdia: unitForm.unitNameOdia, sortOrder: unitForm.sortOrder });
        toast.success('Unit updated');
      } else {
        await donationsApi.createUnit(unitForm);
        toast.success('Unit created');
      }
      setShowUnitModal(false);
      loadUnits();
    } catch { toast.error('Failed to save unit'); }
    finally { setSaving(false); }
  };

  // Type CRUD
  const openTypeCreate = () => { setEditType(null); setTypeForm({ code: '', name: '', nameOdia: '', isRecurring: false, sortOrder: 0 }); setShowTypeModal(true); };
  const openTypeEdit = (t: DonationType) => { setEditType(t); setTypeForm({ code: t.code, name: t.name, nameOdia: t.name_odia || '', isRecurring: t.is_recurring || false, sortOrder: t.sort_order || 0 }); setShowTypeModal(true); };
  const saveType = async () => {
    if (!typeForm.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      if (editType) {
        await donationsApi.updateType(editType.id, { name: typeForm.name, nameOdia: typeForm.nameOdia, isRecurring: typeForm.isRecurring, sortOrder: typeForm.sortOrder });
        toast.success('Donation type updated');
      } else {
        if (!typeForm.code.trim()) { toast.error('Code required'); setSaving(false); return; }
        await donationsApi.createType(typeForm);
        toast.success('Donation type created');
      }
      setShowTypeModal(false);
      loadTypes();
    } catch { toast.error('Failed to save donation type'); }
    finally { setSaving(false); }
  };

  const seedDefaults = async () => {
    try {
      await donationsApi.seedTypes();
      toast.success('Default donation types seeded');
      loadTypes();
    } catch { toast.error('Failed to seed types'); }
  };

  return (
    <div>
      <PageHeader title={L.settings} subtitle="Manage wards, units, and donation types" />

      <div className="px-8 py-6">
        {/* Tab bar */}
        <div className="flex items-center gap-1 mb-6 border-b border-gray-200">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-maroon-500 text-maroon-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Wards Tab */}
        {tab === 'wards' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-navy-900">{L.wards}</h3>
              <button onClick={openWardCreate} className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">
                + {L.addWard}
              </button>
            </div>
            {wardsLoading ? <SkeletonTable rows={3} cols={4} /> : wards.length === 0 ? (
              <EmptyState
                icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 0h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Zm0 3h.008v.008h-.008v-.008Z" /></svg>}
                title="No wards yet"
                description="Create wards to organize families geographically."
                action={<button onClick={openWardCreate} className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">+ {L.addWard}</button>}
              />
            ) : (
              <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <table className="w-full text-sm">
                  <thead className="bg-maroon-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.name}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.odiaName}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.sortOrder}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {wards.map(w => (
                      <tr key={w.id} className="hover:bg-cream transition-colors">
                        <td className="px-4 py-3 font-medium">{w.ward_name}</td>
                        <td className="px-4 py-3 text-gray-600 font-odia">{w.ward_name_odia || '--'}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{w.sort_order}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openWardEdit(w)} className="btn-ghost text-xs text-blue-600">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </div>
        )}

        {/* Units Tab */}
        {tab === 'units' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-semibold text-navy-900">{L.units}</h3>
                <select value={unitWardFilter} onChange={e => setUnitWardFilter(e.target.value)}
                  className="input text-sm bg-white">
                  <option value="">All Wards</option>
                  {wards.map(w => <option key={w.id} value={w.id}>{w.ward_name}</option>)}
                </select>
              </div>
              <button onClick={openUnitCreate} disabled={wards.length === 0}
                className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 disabled:opacity-50 transition-colors">
                + {L.addUnit}
              </button>
            </div>
            {wards.length === 0 && !wardsLoading && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-4 text-amber-800 text-sm">
                Create wards first before adding units.
              </div>
            )}
            {unitsLoading ? <SkeletonTable rows={3} cols={5} /> : units.length === 0 ? (
              <EmptyState
                icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" /></svg>}
                title="No units yet"
                description="Create units within wards to further organize families."
              />
            ) : (
              <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <table className="w-full text-sm">
                  <thead className="bg-maroon-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.name}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.odiaName}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.ward}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.sortOrder}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {units.map(u => (
                      <tr key={u.id} className="hover:bg-cream transition-colors">
                        <td className="px-4 py-3 font-medium">{u.unit_name}</td>
                        <td className="px-4 py-3 text-gray-600 font-odia">{u.unit_name_odia || '--'}</td>
                        <td className="px-4 py-3 text-gray-600">{u.ward_name || '--'}</td>
                        <td className="px-4 py-3 text-center text-gray-500">{u.sort_order}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openUnitEdit(u)} className="btn-ghost text-xs text-blue-600">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </div>
        )}

        {/* Donation Types Tab */}
        {tab === 'types' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-navy-900">{L.donationTypes}</h3>
              <div className="flex items-center gap-2">
                {types.length === 0 && (
                  <button onClick={seedDefaults} className="btn-secondary text-sm">
                    {L.seedDefaults}
                  </button>
                )}
                <button onClick={openTypeCreate} className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">
                  + {L.addType}
                </button>
              </div>
            </div>
            {typesLoading ? <SkeletonTable rows={3} cols={6} /> : types.length === 0 ? (
              <EmptyState
                icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" /></svg>}
                title="No donation types configured"
                description="Seed default types or create custom ones."
                action={<button onClick={seedDefaults} className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 transition-colors">{L.seedDefaults}</button>}
              />
            ) : (
              <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <table className="w-full text-sm">
                  <thead className="bg-maroon-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.code}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.name}</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.odiaName}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.isRecurring}</th>
                      <th className="text-center px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.sortOrder}</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-maroon-700 uppercase">{L.actions}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {types.map(t => (
                      <tr key={t.id} className="hover:bg-cream transition-colors">
                        <td className="px-4 py-3"><span className="badge bg-gray-100 text-gray-700">{t.code}</span></td>
                        <td className="px-4 py-3 font-medium">{t.name}</td>
                        <td className="px-4 py-3 text-gray-600 font-odia">{t.name_odia || '--'}</td>
                        <td className="px-4 py-3 text-center">
                          {t.is_recurring ? (
                            <span className="badge badge-success">Yes</span>
                          ) : (
                            <span className="badge badge-neutral">No</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{t.sort_order}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => openTypeEdit(t)} className="btn-ghost text-xs text-blue-600">Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Ward Modal */}
      <Modal open={showWardModal} onClose={() => setShowWardModal(false)} title={editWard ? 'Edit Ward' : L.addWard} size="sm">
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.name} <span className="text-red-400">*</span></label>
            <input value={wardForm.wardName} onChange={e => setWardForm(f => ({ ...f, wardName: e.target.value }))} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.odiaName}</label>
            <input value={wardForm.wardNameOdia} onChange={e => setWardForm(f => ({ ...f, wardNameOdia: e.target.value }))} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.sortOrder}</label>
            <input type="number" value={wardForm.sortOrder} onChange={e => setWardForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} className="input w-full" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowWardModal(false)} className="btn-secondary">{L.cancel}</button>
            <button onClick={saveWard} disabled={saving}
              className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : L.save}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unit Modal */}
      <Modal open={showUnitModal} onClose={() => setShowUnitModal(false)} title={editUnit ? 'Edit Unit' : L.addUnit} size="sm">
        <div className="px-6 py-4 space-y-3">
          {!editUnit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.ward} <span className="text-red-400">*</span></label>
              <select value={unitForm.wardId} onChange={e => setUnitForm(f => ({ ...f, wardId: e.target.value }))} className="input w-full">
                <option value="">Select Ward</option>
                {wards.map(w => <option key={w.id} value={w.id}>{w.ward_name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.name} <span className="text-red-400">*</span></label>
            <input value={unitForm.unitName} onChange={e => setUnitForm(f => ({ ...f, unitName: e.target.value }))} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.odiaName}</label>
            <input value={unitForm.unitNameOdia} onChange={e => setUnitForm(f => ({ ...f, unitNameOdia: e.target.value }))} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.sortOrder}</label>
            <input type="number" value={unitForm.sortOrder} onChange={e => setUnitForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} className="input w-full" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowUnitModal(false)} className="btn-secondary">{L.cancel}</button>
            <button onClick={saveUnit} disabled={saving}
              className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : L.save}
            </button>
          </div>
        </div>
      </Modal>

      {/* Type Modal */}
      <Modal open={showTypeModal} onClose={() => setShowTypeModal(false)} title={editType ? 'Edit Donation Type' : L.addType} size="sm">
        <div className="px-6 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.code} {!editType && <span className="text-red-400">*</span>}</label>
            <input value={typeForm.code} onChange={e => setTypeForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
              className="input w-full" disabled={!!editType} placeholder="e.g. MEMBER" />
            {editType && <p className="text-xs text-gray-400 mt-0.5">Code cannot be changed after creation</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.name} <span className="text-red-400">*</span></label>
            <input value={typeForm.name} onChange={e => setTypeForm(f => ({ ...f, name: e.target.value }))} className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{L.odiaName}</label>
            <input value={typeForm.nameOdia} onChange={e => setTypeForm(f => ({ ...f, nameOdia: e.target.value }))} className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{L.sortOrder}</label>
              <input type="number" value={typeForm.sortOrder} onChange={e => setTypeForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} className="input w-full" />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={typeForm.isRecurring} onChange={e => setTypeForm(f => ({ ...f, isRecurring: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-maroon-600 focus:ring-maroon-500" />
                <span className="text-sm text-gray-700">{L.isRecurring}</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={() => setShowTypeModal(false)} className="btn-secondary">{L.cancel}</button>
            <button onClick={saveType} disabled={saving}
              className="px-4 py-2.5 bg-maroon-500 text-white rounded-xl text-sm font-medium hover:bg-maroon-600 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : L.save}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
