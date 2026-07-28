'use client';

import React from 'react';
import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  text?: string;
  fullScreen?: boolean;
}

/**
 * [공통 컴포넌트: Spinner - src/components/common/Spinner.tsx]
 * API 호출 및 로딩 상태 시 사용되는 세련된 회전 로딩 스피너
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 24,
  text,
  fullScreen = false,
}) => {
  const spinnerElement = (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        color: 'var(--accent-color)',
      }}
    >
      <Loader2
        size={size}
        style={{
          animation: 'spin 1s linear infinite',
        }}
      />
      {text && (
        <span style={{ fontSize: '0.9rem', color: 'var(--text-sub)', fontWeight: 500 }}>
          {text}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 999,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {spinnerElement}
      </div>
    );
  }

  return spinnerElement;
};

export default Spinner;
