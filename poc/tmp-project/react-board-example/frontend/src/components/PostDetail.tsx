import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import CommentSection from './CommentSection';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: post, isLoading, isError, error } = useQuery({ 
    queryKey: ['post', id], 
    queryFn: async () => {
      const { data } = await axios.get(`http://localhost:4000/api/posts/${id}`);
      return data;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: () => axios.delete(`http://localhost:4000/api/posts/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      navigate('/');
    },
  });

  if (isLoading) return <div>Loading post...</div>;
  if (isError) return <div>Error: {(error as any)?.message || 'Failed to load post'}</div>;
  if (!post) return <div>Post not found</div>;

  return (
    <div className="glass-panel">
      <h2 style={{ marginBottom: '10px' }}>{post.title}</h2>
      <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>{post.content}</p>
      
      <div style={{ display: 'flex', gap: '10px' }}>
        <button onClick={() => navigate('/')} className="btn" style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)' }}>
          Back to List
        </button>
        <button onClick={() => deleteMutation.mutate()} className="btn btn-danger">
          Delete Post
        </button>
      </div>

      <hr style={{ margin: '30px 0', border: 'none', borderBottom: '1px solid var(--border-color)' }} />
      
      <CommentSection postId={parseInt(id!)} />
    </div>
  );
}
