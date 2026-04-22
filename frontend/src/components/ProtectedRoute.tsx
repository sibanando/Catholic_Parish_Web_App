import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  roles?: string[];
}

export default function ProtectedRoute({ children, roles = [] }: Props) {
  const { user, isLoading, hasRole } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-ivory">
        <div className="text-center">
          <div className="text-4xl mb-4">✝</div>
          <p className="text-navy-600">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (roles.length > 0 && !hasRole(...roles)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
