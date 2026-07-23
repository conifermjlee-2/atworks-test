'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

/**
 * [최상위 클라이언트 Provider 래퍼 - src/providers/Providers.tsx]
 * 실무 표준: React Query QueryClientProvider 단독 사용
 * - Redux/RTK Query Provider 완전 제거
 * - 모든 서버 데이터 통신은 useQuery / useMutation 으로 통일
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,        // 30초 동안 캐시 데이터를 신선하다고 간주
        refetchOnWindowFocus: false,  // 탭 전환 시 자동 재요청 비활성화
        retry: 1,                     // 실패 시 1회 재시도
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
