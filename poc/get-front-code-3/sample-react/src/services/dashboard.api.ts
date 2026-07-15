import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (builder) => ({
    getNotices: builder.query<Array<{ id: string; title: string }>, void>({
      query: () => '/notices',
    }),
    updateUser: builder.mutation<void, { userId: string; name: string }>({
      query: ({ userId, ...body }) => ({
        url: `/users/${userId}`,
        method: 'PATCH',
        body,
      }),
    }),
  }),
});

export const { useGetNoticesQuery, useUpdateUserMutation } = dashboardApi;
