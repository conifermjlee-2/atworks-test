import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { Link } from 'react-router-dom';

const fetchPosts = async () => {
  const { data } = await axios.get('http://localhost:4000/api/posts');
  return data;
};

export default function PostList() {
  const queryClient = useQueryClient();
  const { data: posts, isLoading } = useQuery({ queryKey: ['posts'], queryFn: fetchPosts });

  const createPostMutation = useMutation({
    mutationFn: (newPost: { title: string; content: string }) => {
      return axios.post('http://localhost:4000/api/posts', newPost);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
    },
  });

  if (isLoading) return <div>Loading posts...</div>;

  return (
    <div className="glass-panel">
      <h2 style={{ marginBottom: '20px' }}>Posts (TanStack Query + Axios)</h2>
      <button 
        onClick={() => createPostMutation.mutate({ title: 'New Post', content: 'Auto generated' })}
        className="btn"
        style={{ marginBottom: '20px' }}
      >
        + Create Random Post
      </button>
      
      <div className="post-list">
        {posts?.map((post: any) => (
          <div key={post.id} className="post-card">
            <h3><Link to={`/posts/${post.id}`}>{post.title}</Link></h3>
            <p>{post.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
