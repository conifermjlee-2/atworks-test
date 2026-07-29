import { useState } from 'react';
import { useGetCommentsQuery, useAddCommentMutation } from '../api/rtkApi';

export default function CommentSection({ postId }: { postId: number }) {
  const { data: comments = [], isLoading } = useGetCommentsQuery(postId);
  const [addComment] = useAddCommentMutation();
  const [text, setText] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text) return;
    await addComment({ postId, text }).unwrap();
    setText('');
  };

  if (isLoading) return <div>Loading comments...</div>;

  return (
    <div>
      <h3 style={{ marginBottom: '16px', color: 'var(--text-main)' }}>💬 Comments (RTK Query)</h3>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
        <input 
          type="text" 
          value={text} 
          onChange={e => setText(e.target.value)} 
          placeholder="Add a comment..."
          className="input-field"
        />
        <button type="submit" className="btn">Submit</button>
      </form>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {comments.map((comment: any) => (
          <div key={comment.id} className="comment-item">
            {comment.text}
          </div>
        ))}
      </div>
    </div>
  );
}
