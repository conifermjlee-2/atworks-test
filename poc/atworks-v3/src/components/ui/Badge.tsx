import React from 'react';

type BadgeVariant = 'default' | 'primary' | 'success' | 'destructive' | 'outline';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ variant = 'default', className = '', children, ...props }: BadgeProps) {
  let variantClasses = '';
  
  switch (variant) {
    case 'primary':
      variantClasses = 'bg-blue-900/40 text-blue-300 border-blue-700/40';
      break;
    case 'success':
      variantClasses = 'bg-green-900/40 text-green-300 border-green-700/40';
      break;
    case 'destructive':
      variantClasses = 'bg-red-900/40 text-red-300 border-red-700/40';
      break;
    case 'outline':
      variantClasses = 'bg-transparent text-gray-300 border-gray-600';
      break;
    case 'default':
    default:
      variantClasses = 'bg-gray-800 text-gray-300 border-gray-700';
      break;
  }

  return (
    <span 
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono border ${variantClasses} ${className}`}
      {...props}
    >
      {children}
    </span>
  );
}
