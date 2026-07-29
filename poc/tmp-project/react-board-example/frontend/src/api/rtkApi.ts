import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

export const commentsApi = createApi({
  reducerPath: 'commentsApi',
  baseQuery: fetchBaseQuery({ baseUrl: 'http://localhost:4000/api/' }),
  tagTypes: ['Comment'],
  endpoints: (builder) => ({
    getComments: builder.query<any[], number>({
      query: (postId) => `comments?postId=${postId}`,
      providesTags: (result, error, postId) => [{ type: 'Comment', id: postId }],
    }),
    addComment: builder.mutation<any, Partial<any>>({
      query: (body) => ({
        url: 'comments',
        method: 'POST',
        body,
      }),
      invalidatesTags: (result, error, { postId }) => [{ type: 'Comment', id: postId }],
    }),
  }),
});

export const { useGetCommentsQuery, useAddCommentMutation } = commentsApi;
