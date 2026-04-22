import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { adminApi, authApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { SkeletonTable, SkeletonCard } from '../components/ui/Skeleton';
import { ROLES } from '../types';
import type { AuditLog } from '../types';

const AVAILABLE_ROLES = [
  { value: 'parish_admin', label: 'Parish Admin' },
  { value: 'sacramental_clerk', label: 'Sacramental Clerk' },
  { value: 'priest', label: 'Priest' },
  { value: 'auditor', label: 'Auditor' },
];

interface ParishSettings {
  id: string;
  name: string;
  address: string;
  diocese: string;
  contact_info: Record<string, string>;
  logo_path?: string;
}

interface StaffUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  roles: string[];
  created_at: string;
}

export default function Admin() {
  const { hasRole } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'parish' | 'users' | 'audit'>('parish');
  const [parish, setParish] = useState<ParishSettings | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [parishForm, setParishForm] = useState({ name: '', address: '', diocese: '', email: '', phone: '' });
  const [logoUploading, setLogoUploading] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState<StaffUser | null>(null);
  const [deleteUserTarget, setDeleteUserTarget] = useState<StaffUser | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);
  const [userForm, setUserForm] = useState({ firstName: '', lastName: '', email: '', password: '', roles: [] as string[], isActive: true });
  const [userFormError, setUserFormError] = useState('');

  useEffect(() => {
    if (!hasRole(ROLES.ADMIN, ROLES.AUDITOR)) { navigate('/dashboard'); return; }
    loadTab(activeTab);
  }, []);

  const loadTab = async (tab: string) => {
    setLoading(true);
    try {
      if (tab === 'parish') {
        const r = await adminApi.parishSettings();
        setParish(r.data);
        setParishForm({
          name: r.data.name,
          address: r.data.address || '',
          diocese: r.data.diocese || '',
          email: r.data.contact_info?.email || '',
          phone: r.data.contact_info?.phone || '',
        });
      } else if (tab === 'users') {
        const r = await authApi.getUsers();
        setUsers(r.data);
      } else if (tab === 'audit') {
        const r = await adminApi.auditLog({ limit: 100 });
        setAuditLogs(r.data.data);
      }
    } catch { toast.error('Failed to load data'); }
    finally { setLoading(false); }
  };

  const handleTabChange = (tab: 'parish' | 'users' | 'audit') => {
    setActiveTab(tab);
    loadTab(tab);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const r = await adminApi.uploadLogo(file);
      setParish(p => p ? { ...p, logo_path: r.data.logoPath } : p);
      toast.success('Logo uploaded');
    } catch { toast.error('Logo upload failed'); }
    finally { setLogoUploading(false); e.target.value = ''; }
  };

  const saveParish = async () => {
    setSaving(true);
    try {
      const { email, phone, ...rest } = parishForm;
      await adminApi.updateParishSettings({ ...rest, contactInfo: { email, phone } });
      toast.success('Parish settings saved');
    } catch { toast.error('Failed to save settings'); }
    finally { setSaving(false); }
  };

  const openAddUser = () => {
    setEditUser(null);
    setUserForm({ firstName: '', lastName: '', email: '', password: '', roles: [], isActive: true });
    setUserFormError('');
    setShowUserModal(true);
  };

  const openEditUser = (u: StaffUser) => {
    setEditUser(u);
    setUserForm({ firstName: u.first_name, lastName: u.last_name, email: u.email, password: '', roles: (u.roles || []).filter(Boolean), isActive: u.is_active });
    setUserFormError('');
    setShowUserModal(true);
  };

  const saveUser = async () => {
    if (!userForm.firstName || !userForm.lastName || !userForm.email) { setUserFormError('Name and email are required.'); return; }
    if (!editUser && userForm.password.length < 8) { setUserFormError('Password must be at least 8 characters.'); return; }
    if (userForm.roles.length === 0) { setUserFormError('At least one role is required.'); return; }
    setSaving(true);
    setUserFormError('');
    try {
      if (editUser) {
        const payload: Record<string, unknown> = { firstName: userForm.firstName, lastName: userForm.lastName, roles: userForm.roles, isActive: userForm.isActive };
        if (userForm.password) payload.password = userForm.password;
        await authApi.updateUser(editUser.id, payload);
        toast.success('User updated');
      } else {
        await authApi.createUser({ firstName: userForm.firstName, lastName: userForm.lastName, email: userForm.email, password: userForm.password, roles: userForm.roles });
        toast.success('User created');
      }
      setShowUserModal(false);
      loadTab('users');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to save user.';
      setUserFormError(msg);
    } finally { setSaving(false); }
  };

  const deleteUser = async () => {
    if (!deleteUserTarget) return;
    setDeletingUser(true);
    try {
      await authApi.deleteUser(deleteUserTarget.id);
      toast.success('User deleted');
      setDeleteUserTarget(null);
      loadTab('users');
    } catch { toast.error('Failed to delete user'); }
    finally { setDeletingUser(false); }
  };

  const TAB_ITEMS = [
    { id: 'parish' as const, label: 'Parish Settings', icon: <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 3 1m1.5.5-1.5-.5M6.75 7.364V3h-3v18m3-13.636 10.5-3.819" /></svg> },
    { id: 'users' as const, label: 'Users & Roles', icon: <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" /></svg> },
    { id: 'audit' as const, label: 'Audit Log', icon: <svg className="w-4 h-4 mr-1.5 inline" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" /></svg> },
  ];

  return (
    <div>
      <PageHeader title="Administration" subtitle="Manage parish settings, users, and audit logs" />

      <div className="p-8">
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          {TAB_ITEMS.map(t => (
            <button
              key={t.id}
              onClick={() => handleTabChange(t.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-navy-700 text-navy-800' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {loading ? (
          activeTab === 'parish' ? (
            <SkeletonCard />
          ) : (
            <SkeletonTable rows={4} cols={5} />
          )
        ) : activeTab === 'parish' && parish ? (
          <motion.div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl shadow-sm"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-serif text-lg font-semibold text-navy-900 mb-5">Parish Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parish Name</label>
                <input value={parishForm.name} onChange={e => setParishForm(f => ({ ...f, name: e.target.value }))} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea value={parishForm.address} onChange={e => setParishForm(f => ({ ...f, address: e.target.value }))} rows={2} className="input w-full" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Diocese</label>
                <input value={parishForm.diocese} onChange={e => setParishForm(f => ({ ...f, diocese: e.target.value }))} className="input w-full" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={parishForm.email} onChange={e => setParishForm(f => ({ ...f, email: e.target.value }))} className="input w-full" placeholder="office@example.org" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input type="tel" value={parishForm.phone} onChange={e => setParishForm(f => ({ ...f, phone: e.target.value }))} className="input w-full" placeholder="+1 (555) 000-0000" />
                </div>
              </div>
              {hasRole(ROLES.ADMIN) && (
                <button onClick={saveParish} disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>

            {/* Logo Upload */}
            {hasRole(ROLES.ADMIN) && (
              <div className="mt-8 pt-6 border-t border-gray-200">
                <h3 className="font-serif text-lg font-semibold text-navy-900 mb-4">Parish Logo</h3>
                <p className="text-xs text-gray-500 mb-4">Used in certificates and the sidebar. Recommended: square image, PNG or JPG, max 5 MB.</p>
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
                    {parish?.logo_path
                      ? <img src={parish.logo_path} alt="Parish logo" className="w-full h-full object-contain p-1" />
                      : <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" /></svg>}
                  </div>
                  <div>
                    <label className={`cursor-pointer inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition-colors ${logoUploading ? 'opacity-50 pointer-events-none' : 'border-navy-700 text-navy-800 hover:bg-navy-50'}`}>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>
                      {logoUploading ? 'Uploading...' : 'Upload Logo'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
                    </label>
                    {parish?.logo_path && <p className="text-xs text-green-600 mt-2 flex items-center gap-1"><svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg> Logo uploaded</p>}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : activeTab === 'users' ? (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={openAddUser} className="btn-primary">+ Add User</button>
            </div>
            <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th className="table-header">Name</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Roles</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Since</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {users.map((u, i) => (
                    <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                      <td className="table-cell font-medium text-navy-800">{u.first_name} {u.last_name}</td>
                      <td className="table-cell text-gray-600">{u.email}</td>
                      <td className="table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(u.roles || []).filter(Boolean).map(r => (
                            <span key={r} className="badge badge-info capitalize">{r.replace('_', ' ')}</span>
                          ))}
                        </div>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                          {u.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEditUser(u)} className="btn-ghost text-xs text-blue-600">Edit</button>
                          <button onClick={() => setDeleteUserTarget(u)} className="btn-ghost text-xs text-red-500">Delete</button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </div>
        ) : (
          /* Audit Log */
          <motion.div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm"
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="table-header">Time</th>
                  <th className="table-header">User</th>
                  <th className="table-header">Action</th>
                  <th className="table-header">Entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {auditLogs.map((log, i) => (
                  <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.01 }}>
                    <td className="table-cell text-gray-500 whitespace-nowrap text-xs">{new Date(log.timestamp).toLocaleString()}</td>
                    <td className="table-cell text-gray-700">{log.first_name ? `${log.first_name} ${log.last_name}` : (log.email ?? 'System')}</td>
                    <td className="table-cell">
                      <span className={`badge ${
                        log.action === 'CREATE' ? 'badge-success' :
                        log.action === 'UPDATE' ? 'badge-info' :
                        log.action === 'GENERATE' ? 'badge-warning' :
                        'badge-neutral'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="table-cell text-gray-600 capitalize">{log.entity_type}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {auditLogs.length === 0 && (
              <div className="text-center py-12 text-gray-400">No audit entries yet.</div>
            )}
          </motion.div>
        )}
      </div>

      {/* Add / Edit User Modal */}
      <Modal open={showUserModal} onClose={() => { setShowUserModal(false); setEditUser(null); setUserForm({ firstName: '', lastName: '', email: '', password: '', roles: [], isActive: true }); setUserFormError(''); }} title={editUser ? 'Edit User' : 'Add User'} size="lg">
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name <span className="text-red-400">*</span></label>
              <input value={userForm.firstName} onChange={e => setUserForm(f => ({ ...f, firstName: e.target.value }))} className="input w-full" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name <span className="text-red-400">*</span></label>
              <input value={userForm.lastName} onChange={e => setUserForm(f => ({ ...f, lastName: e.target.value }))} className="input w-full" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-400">*</span></label>
            <input type="email" value={userForm.email} onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))} disabled={!!editUser} className="input w-full disabled:bg-gray-50 disabled:text-gray-400" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</label>
            <input type="password" value={userForm.password} onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))} className="input w-full" placeholder={editUser ? 'Leave blank to keep current' : 'Min 8 characters'} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Roles <span className="text-red-400">*</span></label>
            <div className="flex flex-wrap gap-3">
              {AVAILABLE_ROLES.map(r => (
                <label key={r.value} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userForm.roles.includes(r.value)}
                    onChange={e => setUserForm(f => ({ ...f, roles: e.target.checked ? [...f.roles, r.value] : f.roles.filter(x => x !== r.value) }))}
                    className="rounded border-gray-300 text-navy-700 focus:ring-navy-500"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>
          {editUser && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={userForm.isActive} onChange={() => setUserForm(f => ({ ...f, isActive: true }))} className="text-navy-700 focus:ring-navy-500" /> Active
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="radio" checked={!userForm.isActive} onChange={() => setUserForm(f => ({ ...f, isActive: false }))} className="text-navy-700 focus:ring-navy-500" /> Inactive
                </label>
              </div>
            </div>
          )}
          {userFormError && <p className="text-red-500 text-xs bg-red-50 p-2 rounded-lg">{userFormError}</p>}
          <div className="flex gap-3 pt-2">
            <button onClick={() => setShowUserModal(false)} className="btn-secondary flex-1">Cancel</button>
            <button onClick={saveUser} disabled={saving} className="btn-primary flex-1">
              {saving ? 'Saving...' : editUser ? 'Save Changes' : 'Add User'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete User Confirmation */}
      <ConfirmDialog
        open={!!deleteUserTarget}
        title="Delete User"
        message={<>Are you sure you want to delete <strong>{deleteUserTarget?.first_name} {deleteUserTarget?.last_name}</strong>? This cannot be undone.</>}
        confirmLabel="Delete"
        variant="danger"
        loading={deletingUser}
        onConfirm={deleteUser}
        onCancel={() => setDeleteUserTarget(null)}
      />
    </div>
  );
}
