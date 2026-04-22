import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { peopleApi, sacramentsApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Breadcrumb from '../components/ui/Breadcrumb';
import Modal from '../components/ui/Modal';
import { SkeletonCard } from '../components/ui/Skeleton';
import { SACRAMENT_COLORS } from '../types';
import type { Person, SacramentRecord, SacramentType } from '../types';

export default function PersonDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasRole } = useAuth();
  const [person, setPerson] = useState<Person | null>(null);
  const [sacramentTypes, setSacramentTypes] = useState<SacramentType[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSacramentModal, setShowSacramentModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showBrideModal, setShowBrideModal] = useState(false);
  const [brideForSacramentId, setBrideForSacramentId] = useState<string | null>(null);
  const [brideForm, setBrideForm] = useState({ name: '', fatherName: '', motherName: '', address: '' });
  const [savingBride, setSavingBride] = useState(false);

  const { register, handleSubmit, reset, watch } = useForm<Partial<SacramentRecord> & {
    godfather: string; godmother: string;
    brideName: string; brideFatherName: string; brideMotherName: string; brideAddress: string;
  }>();

  const load = async () => {
    try {
      const [personRes, typesRes] = await Promise.all([
        peopleApi.get(id!),
        sacramentsApi.types(),
      ]);
      setPerson(personRes.data);
      setSacramentTypes(typesRes.data);
    } catch { navigate('/people'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  const onSacramentSubmit = async (data: Partial<SacramentRecord> & {
    godfather: string; godmother: string;
    brideName: string; brideFatherName: string; brideMotherName: string; brideAddress: string;
  }) => {
    setSaving(true);
    try {
      const sponsors: { name: string; role: string }[] = [];
      if (data.godfather?.trim()) sponsors.push({ name: data.godfather.trim(), role: 'godfather' });
      if (data.godmother?.trim()) sponsors.push({ name: data.godmother.trim(), role: 'godmother' });
      const { godfather, godmother, brideName, brideFatherName, brideMotherName, brideAddress, ...rest } = data;
      const payload: Record<string, unknown> = { ...rest, personId: id, sponsors };
      const type = sacramentTypes.find(t => t.id === data.sacramentTypeId);
      if (type?.code === 'MATRIMONY' && brideName?.trim()) {
        payload.brideData = {
          name: brideName.trim(),
          fatherName: brideFatherName?.trim() || undefined,
          motherName: brideMotherName?.trim() || undefined,
          address: brideAddress?.trim() || undefined,
        };
      }
      await sacramentsApi.create(payload);
      toast.success('Sacrament recorded successfully');
      reset();
      setShowSacramentModal(false);
      load();
    } catch { toast.error('Failed to record sacrament'); }
    finally { setSaving(false); }
  };

  const onBrideSubmit = async () => {
    if (!brideForSacramentId || !brideForm.name.trim()) { toast.error('Bride name is required'); return; }
    setSavingBride(true);
    try {
      await sacramentsApi.updateBride(brideForSacramentId, brideForm);
      toast.success('Bride information saved');
      setShowBrideModal(false);
    } catch { toast.error('Failed to save bride information'); }
    finally { setSavingBride(false); }
  };

  const generateCertificate = (sacrament: SacramentRecord) => {
    window.open(`/certificates/print/${sacrament.id}`, '_blank');
  };

  if (loading) return (
    <div className="p-8 space-y-4">
      {[...Array(3)].map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );
  if (!person) return null;

  const completedSacraments = new Set((person.sacraments || []).filter(s => s.status === 'completed').map(s => s.sacrament_type_id ?? s.sacramentTypeId));
  const personName = `${person.first_name ?? person.firstName} ${person.last_name ?? person.lastName}`;
  const familyName = person.family_name ?? person.familyName;
  const watchedTypeId = watch('sacramentTypeId');
  const selectedType = sacramentTypes.find(t => t.id === watchedTypeId);

  return (
    <div>
      <Breadcrumb items={[{ label: 'People', to: '/people' }, { label: personName }]} />
      <PageHeader
        title={personName}
        subtitle={familyName ? `${familyName} Family` : 'No family assigned'}
        actions={
          <div className="flex gap-3">
            {hasRole('parish_admin', 'sacramental_clerk', 'priest') && (
              <button onClick={() => setShowSacramentModal(true)} className="px-4 py-2.5 bg-gold-700 text-white rounded-xl text-sm font-medium hover:bg-gold-800 transition-colors shadow-sm">
                + Record Sacrament
              </button>
            )}
            <button onClick={() => navigate(-1)} className="btn-secondary">
              <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              Back
            </button>
          </div>
        }
      />

      <div className="p-8 space-y-6">
        {/* Personal Info */}
        <motion.div className="card" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <h3 className="font-serif text-base font-semibold text-navy-900 mb-4">Personal Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {[
              { label: 'Date of Birth', value: person.dob ? new Date(person.dob).toLocaleDateString() : '--' },
              { label: 'Gender', value: person.gender ?? '--' },
              { label: 'Baptismal Name', value: person.baptismal_name ?? person.baptismalName ?? '--' },
              { label: 'Maiden Name', value: person.maiden_name ?? person.maidenName ?? '--' },
              { label: 'Email', value: person.email ?? '--' },
              { label: 'Phone', value: person.phone ?? '--' },
            ].map(field => (
              <div key={field.label}>
                <p className="text-gray-500 text-xs mb-0.5">{field.label}</p>
                <p className="font-medium text-navy-800 capitalize">{field.value}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Sacramental Timeline */}
        <div>
          <h3 className="font-serif text-lg font-semibold text-navy-900 mb-4">Sacramental Journey</h3>
          <div className="relative">
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-navy-200 via-gray-200 to-transparent" />
            <div className="space-y-4">
              {sacramentTypes.map((type, i) => {
                const record = (person.sacraments || []).find(s => (s.sacrament_type_id ?? s.sacramentTypeId) === type.id);
                const completed = record?.status === 'completed';
                return (
                  <motion.div
                    key={type.id}
                    className="flex items-start gap-4 relative"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 transition-all ${
                      completed
                        ? 'bg-gradient-to-br from-navy-700 to-navy-900 border-navy-800 text-white shadow-lg shadow-navy-900/20'
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {completed ? (
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                      ) : (
                        <span className="w-2.5 h-2.5 rounded-full bg-gray-300" />
                      )}
                    </div>

                    <div className={`flex-1 rounded-2xl border p-4 transition-all ${
                      completed ? 'bg-white border-navy-200 shadow-sm' : 'bg-gray-50 border-gray-100 opacity-50'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className={`badge mb-2 ${SACRAMENT_COLORS[type.code] || 'badge-neutral'}`}>{type.name}</span>
                          {completed && record ? (
                            <div className="text-sm text-gray-600 space-y-1 mt-1">
                              {record.date && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
                                  {new Date(record.date).toLocaleDateString()}
                                </div>
                              )}
                              {record.place && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>
                                  {record.place}
                                </div>
                              )}
                              {record.celebrant && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>
                                  {record.celebrant}
                                </div>
                              )}
                              {record.register_volume && (
                                <div className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" /></svg>
                                  Vol. {record.register_volume}, Pg. {record.register_page}
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-gray-400 mt-1">Not yet recorded</p>
                          )}
                        </div>
                        {completed && record && hasRole('parish_admin', 'sacramental_clerk', 'priest') && (
                          <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                            {type.code === 'MATRIMONY' && (
                              <button
                                onClick={() => {
                                  setBrideForSacramentId((record as SacramentRecord).id!);
                                  setBrideForm({ name: '', fatherName: '', motherName: '', address: '' });
                                  setShowBrideModal(true);
                                }}
                                className="text-xs bg-maroon-500 text-white px-3 py-1.5 rounded-xl hover:bg-maroon-600 transition-colors shadow-sm"
                              >
                                Edit Bride
                              </button>
                            )}
                            <button
                              onClick={() => generateCertificate(record as SacramentRecord)}
                              className="text-xs bg-gold-600 text-white px-3 py-1.5 rounded-xl hover:bg-gold-700 transition-colors shadow-sm"
                            >
                              <svg className="w-3.5 h-3.5 inline mr-1" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" /></svg>
                              Certificate
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bride Info Modal */}
      <Modal open={showBrideModal} onClose={() => setShowBrideModal(false)} title="Bride Information" subtitle="Matrimony — Bride Details">
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bride's Name <span className="text-red-400">*</span></label>
            <input
              value={brideForm.name}
              onChange={e => setBrideForm(f => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Maria Santos"
              className="input w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
              <input
                value={brideForm.fatherName}
                onChange={e => setBrideForm(f => ({ ...f, fatherName: e.target.value }))}
                className="input w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name</label>
              <input
                value={brideForm.motherName}
                onChange={e => setBrideForm(f => ({ ...f, motherName: e.target.value }))}
                className="input w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address / Parish</label>
            <input
              value={brideForm.address}
              onChange={e => setBrideForm(f => ({ ...f, address: e.target.value }))}
              className="input w-full"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => setShowBrideModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button type="button" onClick={onBrideSubmit} disabled={savingBride} className="btn-primary flex-1">
              {savingBride ? 'Saving...' : 'Save Bride Info'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Record Sacrament Modal */}
      <Modal open={showSacramentModal} onClose={() => { setShowSacramentModal(false); reset(); }} title="Record Sacrament" subtitle={`For ${personName}`} size="lg">
        <form onSubmit={handleSubmit(onSacramentSubmit)} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Sacrament <span className="text-red-400">*</span></label>
            <select {...register('sacramentTypeId', { required: true })} className="input w-full">
              <option value="">Select sacrament</option>
              {sacramentTypes.map(t => (
                <option key={t.id} value={t.id} disabled={completedSacraments.has(t.id)}>
                  {t.name}{completedSacraments.has(t.id) ? ' (recorded)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input {...register('date')} type="date" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select {...register('status')} className="input w-full">
                <option value="completed">Completed</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Minister</label>
            <input {...register('celebrant')} placeholder="e.g. Fr. Thomas Aquino" className="input w-full" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Place / Church</label>
            <input {...register('place')} placeholder="e.g. St. Mary's Parish" className="input w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Register Volume</label>
              <input {...register('registerVolume')} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Register Page</label>
              <input {...register('registerPage')} className="input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Godfather</label>
              <input {...register('godfather')} placeholder="e.g. Juan Santos" className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Godmother</label>
              <input {...register('godmother')} placeholder="e.g. Maria Reyes" className="input w-full" />
            </div>
          </div>
          {selectedType?.code === 'MATRIMONY' && (
            <div className="border-t border-gray-100 pt-4 space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Bride</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bride's Name <span className="text-red-400">*</span></label>
                <input {...register('brideName')} placeholder="e.g. Maria Santos" className="input w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Father's Name</label>
                  <input {...register('brideFatherName')} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Mother's Name</label>
                  <input {...register('brideMotherName')} className="input w-full" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address / Parish</label>
                <input {...register('brideAddress')} className="input w-full" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea {...register('notes')} rows={2} className="input w-full" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => { setShowSacramentModal(false); reset(); }} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Record Sacrament'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
