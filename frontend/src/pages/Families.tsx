import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { familiesApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import EmptyState from '../components/ui/EmptyState';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useDebounce } from '../hooks/useDebounce';
import type { Family } from '../types';

type FamilyFormData = { familyName: string; address: string; status: Family['status']; notes: string };

const STATUS_COLORS: Record<string, string> = {
  active: 'badge-success',
  inactive: 'badge-neutral',
  transferred: 'badge-info',
  deceased: 'badge-danger',
};

export default function Families() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editFamily, setEditFamily] = useState<Family | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Family | null>(null);
  const [deleting, setDeleting] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FamilyFormData>({ defaultValues: { status: 'active' } });
  const editForm = useForm<FamilyFormData>();

  const load = async (p = 1, q = debouncedSearch) => {
    setLoading(true);
    try {
      const r = await familiesApi.list({ page: p, limit: 20, search: q || undefined });
      setFamilies(r.data.data);
      setTotal(r.data.total);
    } catch { toast.error('Failed to load families'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(1, ''); }, []);
  useEffect(() => { setPage(1); load(1, debouncedSearch); }, [debouncedSearch]);

  useEffect(() => {
    if (editFamily) {
      editForm.reset({
        familyName: editFamily.family_name ?? editFamily.familyName,
        address: editFamily.address ?? '',
        status: editFamily.status,
        notes: editFamily.notes ?? '',
      });
    }
  }, [editFamily]);

  const onSubmit = async (data: FamilyFormData) => {
    setSaving(true);
    try {
      await familiesApi.create(data);
      toast.success('Family created successfully');
      reset();
      setShowModal(false);
      load(1);
    } catch { toast.error('Failed to create family'); }
    finally { setSaving(false); }
  };

  const onEditSubmit = async (data: FamilyFormData) => {
    if (!editFamily) return;
    setSaving(true);
    try {
      await familiesApi.update(editFamily.id, data);
      toast.success('Family updated successfully');
      setEditFamily(null);
      load(page, debouncedSearch);
    } catch { toast.error('Failed to update family'); }
    finally { setSaving(false); }
  };

  const onDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await familiesApi.delete(deleteTarget.id);
      toast.success('Family deleted');
      setDeleteTarget(null);
      load(page, debouncedSearch);
    } catch { toast.error('Failed to delete family'); }
    finally { setDeleting(false); }
  };

  const canEdit = hasRole('parish_admin', 'sacramental_clerk');

  const FamilyForm = ({ form, onSubmitFn, submitLabel }: { form: ReturnType<typeof useForm<FamilyFormData>>; onSubmitFn: (data: FamilyFormData) => void; submitLabel: string }) => (
    <form onSubmit={form.handleSubmit(onSubmitFn)} className="p-6 space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Family Name <span className="text-red-400">*</span></label>
        <input {...form.register('familyName', { required: 'Family name is required' })} className="input w-full" placeholder="e.g. De la Cruz" />
        {form.formState.errors.familyName && <p className="text-red-500 text-xs mt-1">{form.formState.errors.familyName.message}</p>}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
        <textarea {...form.register('address')} rows={2} className="input w-full" />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
        <select {...form.register('status')} className="input w-full">
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="transferred">Transferred</option>
          <option value="deceased">Deceased</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
        <textarea {...form.register('notes')} rows={2} className="input w-full" />
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={() => { setShowModal(false); setEditFamily(null); reset(); }} className="btn-secondary flex-1">Cancel</button>
        <button type="submit" disabled={saving} className="btn-primary flex-1">
          {saving ? 'Saving...' : submitLabel}
        </button>
      </div>
    </form>
  );

  return (
    <div>
      <PageHeader
        title="Families"
        subtitle={`${total} family record${total !== 1 ? 's' : ''}`}
        actions={
          canEdit ? (
            <button onClick={() => setShowModal(true)} className="btn-primary">+ New Family</button>
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
            placeholder="Search families..."
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

        {/* Table */}
        {loading ? (
          <SkeletonTable rows={5} cols={4} />
        ) : families.length === 0 ? (
          <EmptyState
            icon={
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z" />
              </svg>
            }
            title={search ? `No results for "${search}"` : 'No families yet'}
            description={canEdit ? 'Get started by adding the first family to your parish.' : undefined}
            action={canEdit ? <button onClick={() => setShowModal(true)} className="btn-primary">+ New Family</button> : undefined}
          />
        ) : (
          <motion.div
            className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="table-header">Family Name</th>
                  <th className="table-header">Address</th>
                  <th className="table-header">Members</th>
                  <th className="table-header">Status</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {families.map((f, i) => (
                  <motion.tr
                    key={f.id}
                    className="hover:bg-gray-50/80 cursor-pointer transition-colors"
                    onClick={() => navigate(`/families/${f.id}`)}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <td className="table-cell font-medium text-navy-800">{f.family_name ?? f.familyName}</td>
                    <td className="table-cell text-gray-600 max-w-xs truncate">{f.address || '--'}</td>
                    <td className="table-cell text-gray-600">{f.member_count ?? f.memberCount ?? '--'}</td>
                    <td className="table-cell">
                      <span className={`badge capitalize ${STATUS_COLORS[f.status] || 'badge-neutral'}`}>{f.status}</span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canEdit && (
                          <>
                            <button
                              onClick={e => { e.stopPropagation(); setEditFamily(f); }}
                              className="btn-ghost text-xs text-blue-600"
                            >Edit</button>
                            <button
                              onClick={e => { e.stopPropagation(); setDeleteTarget(f); }}
                              className="btn-ghost text-xs text-red-500"
                            >Delete</button>
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

        {/* Pagination */}
        {total > 20 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button disabled={page === 1 || loading} onClick={() => { setPage(p => p - 1); load(page - 1, debouncedSearch); }} className="btn-secondary text-sm disabled:opacity-40">
              <svg className="w-4 h-4 mr-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              Previous
            </button>
            <span className="px-4 py-2 text-sm text-gray-500 font-medium">Page {page} of {Math.ceil(total / 20)}</span>
            <button disabled={page * 20 >= total || loading} onClick={() => { setPage(p => p + 1); load(page + 1, debouncedSearch); }} className="btn-secondary text-sm disabled:opacity-40">
              Next
              <svg className="w-4 h-4 ml-1 inline" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
        )}
      </div>

      {/* Create Family Modal */}
      <Modal open={showModal} onClose={() => { setShowModal(false); reset(); }} title="New Family" subtitle="Add a new family to the parish">
        <FamilyForm form={{ register, handleSubmit, reset, formState: { errors } } as ReturnType<typeof useForm<FamilyFormData>>} onSubmitFn={onSubmit} submitLabel="Create Family" />
      </Modal>

      {/* Edit Family Modal */}
      <Modal open={!!editFamily} onClose={() => setEditFamily(null)} title="Edit Family">
        <FamilyForm form={editForm} onSubmitFn={onEditSubmit} submitLabel="Save Changes" />
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete Family"
        message={<>Are you sure you want to delete <strong>{deleteTarget?.family_name ?? deleteTarget?.familyName}</strong>? This action cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
