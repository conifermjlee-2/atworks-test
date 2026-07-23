import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const dashboardApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api/v1' }),
  endpoints: (builder) => ({
    getDashboardStats: builder.query<void, void>({
      query: () => '/rtk/stats',
    }),
  }),
});

export const { useGetDashboardStatsQuery } = dashboardApi;
