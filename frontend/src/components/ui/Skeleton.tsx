interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = '', style }: SkeletonProps) {
  return (
    <div className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded-lg ${className}`}
      style={{ animation: 'shimmer 1.5s ease-in-out infinite', ...style }}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-20" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-3 flex gap-6">
        {[...Array(cols)].map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
      </div>
      <div className="divide-y divide-gray-100">
        {[...Array(rows)].map((_, i) => (
          <div key={i} className="px-6 py-4 flex gap-6">
            {[...Array(cols)].map((_, j) => (
              <Skeleton key={j} className="h-4 flex-1" style={{ animationDelay: `${(i * cols + j) * 0.05}s` } as React.CSSProperties} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return <Skeleton className="h-16 w-full rounded-xl" />;
}
