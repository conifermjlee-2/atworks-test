import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import CommentSection from './CommentSection';

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

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

  const updateMutation = useMutation({
    mutationFn: (updatedPost: { title: string; content: string }) => 
      axios.put(`http://localhost:4000/api/posts/${id}`, updatedPost),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['post', id] });
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      setIsEditing(false);
    },
  });

  useEffect(() => {
    if (post && !isEditing) {
      setEditTitle(post.title);
      setEditContent(post.content);
    }
  }, [post, isEditing]);

  if (isLoading) return <div>Loading post...</div>;
  if (isError) return <div>Error: {(error as any)?.message || 'Failed to load post'}</div>;
  if (!post) return <div>Post not found</div>;

  return (
    <div className="glass-panel">
      {isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '24px' }}>
          <input 
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="form-input"
            style={{ fontSize: '1.5rem', fontWeight: 'bold' }}
            placeholder="Title"
          />
          <textarea 
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="form-input"
            rows={5}
            placeholder="Content"
          />
          <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
            <button 
              onClick={() => updateMutation.mutate({ title: editTitle, content: editContent })} 
              className="btn" 
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
            </button>
            <button onClick={() => setIsEditing(false)} className="btn btn-danger" style={{ background: 'var(--panel-bg)', color: 'var(--text-color)', border: '1px solid var(--border-color)' }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 style={{ marginBottom: '10px' }}>{post.title}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.6 }}>{post.content}</p>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => navigate('/')} className="btn" style={{ background: 'var(--panel-bg)', border: '1px solid var(--border-color)' }}>
              Back to List
            </button>
            <button onClick={() => setIsEditing(true)} className="btn" style={{ background: 'var(--primary-hover)' }}>
              Edit Post
            </button>
            <button onClick={() => deleteMutation.mutate()} className="btn btn-danger">
              Delete Post
            </button>
          </div>
        </>
      )}

      <hr style={{ margin: '30px 0', border: 'none', borderBottom: '1px solid var(--border-color)' }} />
      
      <CommentSection postId={parseInt(id!)} />
    </div>
  );
}
