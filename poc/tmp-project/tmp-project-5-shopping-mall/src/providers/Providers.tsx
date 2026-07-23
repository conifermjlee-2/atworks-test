'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Provider as ReduxProvider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { shopApi } from '@/store/rtkApi';

/**
 * [최상위 클라이언트 Provider 래퍼 - src/providers/Providers.tsx]
 * - React Query (QueryClientProvider): 메인 페이지 useQuery 캐시 저장소
 * - Redux + RTK Query (ReduxProvider): 결제 페이지 useGetCartItemsQuery 캐시 저장소
 * ※ 비즈니스 상태(Context) 관리 용도가 아닌, 통신 캐시 초기화 목적
 */
const store = configureStore({
  reducer: {
    [shopApi.reducerPath]: shopApi.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(shopApi.middleware),
});

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000, // 30초
        refetchOnWindowFocus: false,
      },
    },
  }));

  return (
    <ReduxProvider store={store}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </ReduxProvider>
  );
}
