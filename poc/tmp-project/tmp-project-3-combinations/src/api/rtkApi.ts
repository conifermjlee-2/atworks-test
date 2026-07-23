import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const comboApi = createApi({
  baseQuery: fetchBaseQuery({ baseUrl: '/api/combo' }),
  endpoints: (builder) => ({
    getTest4: builder.query<void, void>({ query: () => '/test4' }),
    getTest6: builder.query<void, void>({ query: () => '/test6' }),
    getTest7: builder.query<void, void>({ query: () => '/test7' }),
    getTest8: builder.query<void, void>({ query: () => '/test8' }),
  }),
});

export const {
  useGetTest4Query,
  useGetTest6Query,
  useGetTest7Query,
  useGetTest8Query,
} = comboApi;
