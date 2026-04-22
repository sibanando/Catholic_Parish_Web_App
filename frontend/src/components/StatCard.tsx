import { motion } from 'framer-motion';

interface Props {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  onClick?: () => void;
  delay?: number;
}

export default function StatCard({ label, value, icon, color = 'bg-navy-50', onClick, delay = 0 }: Props) {
  return (
    <motion.div
      className={`${color} rounded-2xl p-6 flex items-center gap-4 border border-transparent ${onClick ? 'cursor-pointer hover:shadow-lg hover:border-gray-200 hover:-translate-y-0.5' : ''} transition-all duration-200`}
      onClick={onClick}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: 'easeOut' }}
      whileHover={onClick ? { scale: 1.02 } : undefined}
      whileTap={onClick ? { scale: 0.98 } : undefined}
    >
      <div className="text-3xl w-12 h-12 rounded-xl bg-white/60 flex items-center justify-center shadow-sm">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-navy-900 tabular-nums">{value}</p>
        <p className="text-sm text-gray-600">{label}</p>
      </div>
    </motion.div>
  );
}
