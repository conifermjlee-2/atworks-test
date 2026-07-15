import React from 'react';

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

interface ApiBadgeProps {
  method: Method;
  path?: string;
  className?: string;
}

const methodColors: Record<Method, string> = {
  GET: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800',
  POST: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800',
  PUT: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800',
  DELETE: 'text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800',
  PATCH: 'text-purple-600 bg-purple-50 border-purple-200 dark:text-purple-400 dark:bg-purple-900/30 dark:border-purple-800',
};

const dotColors: Record<Method, string> = {
  GET: 'bg-blue-500',
  POST: 'bg-emerald-500',
  PUT: 'bg-amber-500',
  DELETE: 'bg-rose-500',
  PATCH: 'bg-purple-500',
};

export const ApiBadge: React.FC<ApiBadgeProps> = ({ method, path, className = '' }) => {
  return (
    <div className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm font-medium shadow-sm transition-all hover:shadow-md ${methodColors[method]} ${className}`}>
      <span className={`h-2 w-2 rounded-full ${dotColors[method]} animate-pulse`} />
      <span className="tracking-wide font-bold">{method}</span>
      {path && (
        <>
          <span className="text-current opacity-30">|</span>
          <code className="font-mono text-xs font-semibold text-current opacity-90">
            {path}
          </code>
        </>
      )}
    </div>
  );
};
