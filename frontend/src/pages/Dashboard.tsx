import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { adminApi, donationsApi } from '../api/client';
import { useAuth } from '../contexts/AuthContext';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import { SkeletonCard } from '../components/ui/Skeleton';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface Report {
  summary: {
    total_families: string;
    total_people: string;
    total_sacraments: string;
  };
  sacramentsPerType: Array<{ name: string; count: string }>;
  pendingFirstCommunionConfirmation: Array<{
    first_name: string;
    last_name: string;
    sacrament_name: string;
  }>;
}

export default function Dashboard() {
  const { user, hasRole } = useAuth();
  const navigate = useNavigate();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [donationTotal, setDonationTotal] = useState<string>('--');

  useEffect(() => {
    adminApi.reports().then(r => setReport(r.data)).catch(console.error).finally(() => setLoading(false));
    donationsApi.dashboard({ year: new Date().getFullYear() })
      .then(r => setDonationTotal('\u20B9' + (r.data.annualTotal || 0).toLocaleString('en-IN')))
      .catch(() => {});
  }, []);

  const s = report?.summary;

  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.firstName}`}
        subtitle={`${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`}
        actions={
          hasRole('parish_admin', 'sacramental_clerk') ? (
            <button onClick={() => navigate('/families')} className="btn-primary">
              + Add Family
            </button>
          ) : undefined
        }
      />

      <div className="p-8 space-y-8">
        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Families" value={s?.total_families ?? '--'} icon="👨‍👩‍👧‍👦" color="bg-blue-50" onClick={() => navigate('/families')} delay={0} />
            <StatCard label="People" value={s?.total_people ?? '--'} icon="👤" color="bg-purple-50" onClick={() => navigate('/people')} delay={0.1} />
            <StatCard label="Sacraments" value={s?.total_sacraments ?? '--'} icon="✝️" color="bg-amber-50" onClick={() => navigate('/sacraments')} delay={0.2} />
            <StatCard label="YTD Donations" value={donationTotal} icon="💰" color="bg-emerald-50" onClick={() => navigate('/donations')} delay={0.3} />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Sacraments Chart */}
          <motion.div
            className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <h3 className="font-serif text-lg font-semibold text-navy-900 mb-4">Sacraments by Type</h3>
            {report?.sacramentsPerType ? (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report.sacramentsPerType} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                  <Bar dataKey="count" fill="#334e68" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-44 bg-gray-50 rounded-xl animate-pulse" />
            )}
          </motion.div>

          {/* Quick Actions */}
          {hasRole('parish_admin', 'sacramental_clerk') && (
            <motion.div
              className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <h3 className="font-serif text-lg font-semibold text-navy-900 mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Add Family', icon: '👨‍👩‍👧‍👦', to: '/families', desc: 'Register a new parish family' },
                  { label: 'Add Person', icon: '👤', to: '/people', desc: 'Add an individual parishioner' },
                  { label: 'Record Sacrament', icon: '✝️', to: '/sacraments', desc: 'Log a sacramental event' },
                  { label: 'Record Donation', icon: '💰', to: '/donations/register', desc: 'Enter a donation record' },
                ].map((action, i) => (
                  <motion.button
                    key={action.label}
                    onClick={() => navigate(action.to)}
                    className="flex flex-col items-start gap-2 p-4 rounded-xl border-2 border-dashed border-gray-200 hover:border-navy-300 hover:bg-navy-50/50 transition-all text-left group"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                  >
                    <span className="text-2xl">{action.icon}</span>
                    <div>
                      <span className="text-sm font-semibold text-navy-800 group-hover:text-navy-900">{action.label}</span>
                      <p className="text-[11px] text-gray-400 mt-0.5">{action.desc}</p>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </div>

      </div>
    </div>
  );
}
