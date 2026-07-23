import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const nextApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/next' }),
  endpoints: (builder) => ({
    getRtkNextEndpoint: builder.query<void, void>({
      query: () => '/rtk-endpoint',
    }),
  }),
});

export const { useGetRtkNextEndpointQuery } = nextApi;
