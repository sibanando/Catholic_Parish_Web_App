import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { peopleApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import type { Person } from '../types';

type PersonFormData = Omit<Person, 'id' | 'families' | 'sacraments'>;

export default function People() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editPerson, setEditPerson] = useState<Person | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Person | null>(null);
  const [deleting, setDeleting] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<PersonFormData>({ defaultValues: { status: 'active' } });
  const editForm = useForm<PersonFormData>({ defaultValues: { status: 'active' } });

  const load = async (q = '') => {
    setLoading(true);
    try {
      const r = await peopleApi.list({ search: q || undefined, limit: 50 });
      setPeople(r.data.data);
    } catch { toast.error('Failed to load people'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { load(debouncedSearch); }, [debouncedSearch]);

  useEffect(() => {
    if (editPerson) {
      editForm.reset({
        firstName: editPerson.first_name ?? editPerson.firstName,
        middleName: editPerson.middle_name ?? editPerson.middleName,
        lastName: editPerson.last_name ?? editPerson.lastName,
        maidenName: editPerson.maiden_name ?? editPerson.maidenName,
        baptismalName: editPerson.baptismal_name ?? editPerson.baptismalName,
        fatherName: editPerson.father_name ?? editPerson.fatherName,
        motherName: editPerson.mother_name ?? editPerson.motherName,
        dob: editPerson.dob ? editPerson.dob.slice(0, 10) : '',
        gender: editPerson.gender,
        email: editPerson.email,
        phone: editPerson.phone,
        status: editPerson.status,
      });
    }
  }, [editPerson]);

  const onSubmit = async (data: unknown) => {
    setSaving(true);
    try {
      await peopleApi.create(data);
      toast.success('Person created successfully');
      reset();
      setShowModal(false);
      load(debouncedSearch);
    } catch { toast.error('Failed to create person'); }
    finally { setSaving(false); }
  };

  const onEditSubmit = async (data: unknown) => {
    if (!editPerson) return;
    setSaving(true);
    try {
      await peopleApi.update(editPerson.id, data);
      toast.success('Person updated successfully');
      setEditPerson(null);
      load(debouncedSearch);
    } catch { toast.error('Failed to update person'); }
    finally { setSaving(false); }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await peopleApi.delete(deleteTarget.id);
      toast.success('Person deleted');
      setDeleteTarget(null);
      load(debouncedSearch);
    } catch { toast.error('Failed to delete person'); }
    finally { setDeleting(false); }
  };

  const canEdit = hasRole('parish_admin', 'sacramental_clerk');

  const PersonFormFields = ({ f, errs }: { f: ReturnType<typeof useForm<PersonFormData>>['register']; errs: Record<string, { message?: string }> }) => (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-400">*</span></label>
          <input {...f('firstName', { required: 'Required' })} className="input w-full" />
          {errs.firstName && <p className="text-red-500 text-xs mt-1">{errs.firstName.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-400">*</span></label>
          <input {...f('lastName', { required: 'Required' })} className="input w-full" />
          {errs.lastName && <p className="text-red-500 text-xs mt-1">{errs.lastName.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Middle Name</label>
          <input {...f('middleName')} className="input w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Baptismal Name</label>
          <input {...f('baptismalName')} className="input w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
          <input {...f('dob')} type="date" className="input w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
          <select {...f('gender')} className="input w-full">
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Father Name <span className="text-red-400">*</span></label>
          <input {...f('fatherName', { required: 'Required' })} className="input w-full" />
          {errs.fatherName && <p className="text-red-500 text-xs mt-1">{errs.fatherName.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mother Name <span className="text-red-400">*</span></label>
          <input {...f('motherName', { required: 'Required' })} className="input w-full" />
          {errs.motherName && <p className="text-red-500 text-xs mt-1">{errs.motherName.message}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input {...f('email')} type="email" className="input w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input {...f('phone')} className="input w-full" />
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <PageHeader
        title="People"
        subtitle="Search and manage individual parishioners"
        actions={
          canEdit ? (
            <button onClick={() => setShowModal(true)} className="btn-primary">+ New Person</button>
          ) : undefined
        }
      />

      <div className="p-8">
        {/* Search */}
        <div className="relative max-w-md mb-6">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, baptismal name, or maiden name..."
            className="input w-full pl-9"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {loading ? (
          <SkeletonTable rows={8} cols={4} />
        ) : people.length === 0 ? (
          <EmptyState
            icon={<svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" /></svg>}
            title={search ? `No results for "${search}"` : 'No people found'}
            description={canEdit ? 'Start by adding parishioners to the system.' : undefined}
            action={canEdit ? <button onClick={() => setShowModal(true)} className="btn-primary">+ New Person</button> : undefined}
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
                  <th className="table-header">Name</th>
                  <th className="table-header">Family</th>
                  <th className="table-header">Date of Birth</th>
                  <th className="table-header">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {people.map((p, i) => (
                  <motion.tr key={p.id} className="hover:bg-gray-50/80 cursor-pointer transition-colors" onClick={() => navigate(`/people/${p.id}`)}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
                    <td className="table-cell">
                      <div>
                        <p className="font-medium text-navy-800">{p.first_name ?? p.firstName} {p.last_name ?? p.lastName}</p>
                        {(p.baptismal_name ?? p.baptismalName) && <p className="text-xs text-gray-400 mt-0.5">Baptismal: {p.baptismal_name ?? p.baptismalName}</p>}
                      </div>
                    </td>
                    <td className="table-cell text-gray-600">{(p.family_name ?? p.familyName) || '--'}</td>
                    <td className="table-cell text-gray-600">{p.dob ? new Date(p.dob).toLocaleDateString() : '--'}</td>
                    <td className="table-cell">
                      <span className={`badge capitalize ${p.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>{p.status}</span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button onClick={e => { e.stopPropagation(); setEditPerson(p); }} className="btn-ghost text-xs text-blue-600">Edit</button>
                            <button onClick={e => { e.stopPropagation(); setDeleteTarget(p); }} className="btn-ghost text-xs text-red-500">Delete</button>
                          </>
                        )}
                        <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                        </svg>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        )}
      </div>

      {/* Create Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); reset(); }} title="New Person" subtitle="Add a parishioner" size="lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <PersonFormFields f={register} errs={errors as Record<string, { message?: string }>} />
          <div className="flex gap-3 px-6 pb-6">
            <button type="button" onClick={() => { setShowModal(false); reset(); }} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Create Person'}</button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editPerson} onClose={() => setEditPerson(null)} title="Edit Person" size="lg">
        <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
          <PersonFormFields f={editForm.register} errs={editForm.formState.errors as Record<string, { message?: string }>} />
          <div className="px-6 pb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select {...editForm.register('status')} className="input w-full">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="deceased">Deceased</option>
                <option value="transferred">Transferred</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 px-6 pb-6">
            <button type="button" onClick={() => setEditPerson(null)} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving...' : 'Save Changes'}</button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Person"
        message={<>Are you sure you want to delete <strong>{deleteTarget?.first_name ?? deleteTarget?.firstName} {deleteTarget?.last_name ?? deleteTarget?.lastName}</strong>? This cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
