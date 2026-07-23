import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const reactApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/react' }),
  endpoints: (builder) => ({
    getRtkEndpoint: builder.query<void, void>({
      query: () => '/rtk-endpoint',
    }),
  }),
});

export const { useGetRtkEndpointQuery } = reactApi;
