import express from 'express';
import cors from 'cors';

const app = express();
const port = 4000;

app.use(cors());
app.use(express.json());

// ── Dummy Data ──
let posts = [
  { id: 1, title: 'First Post', content: 'Hello World!' },
  { id: 2, title: 'Second Post', content: 'React Query is awesome.' },
];
let comments = [
  { id: 1, postId: 1, text: 'Great post!' },
];

// 1. Auth (Pure Fetch 테스트용)
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin') {
    res.json({ success: true, userId: 1 });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// 2. Notices (SWR 테스트용 - 지연시간 추가)
app.get('/api/notices', (req, res) => {
  setTimeout(() => {
    res.json([
      { id: 1, title: '[공지] 점검 안내' },
      { id: 2, title: '[이벤트] 신규 가입 이벤트' }
    ]);
  }, 1000); // 1초 딜레이
});

// 3. Posts (TanStack Query 테스트용)
app.get('/api/posts', (req, res) => {
  res.json(posts);
});

app.get('/api/posts/:id', (req, res) => {
  const post = posts.find(p => p.id === parseInt(req.params.id));
  if (post) res.json(post);
  else res.status(404).json({ message: 'Post not found' });
});

app.post('/api/posts', (req, res) => {
  const newPost = { id: Date.now(), ...req.body };
  posts.push(newPost);
  res.status(201).json(newPost);
});

app.put('/api/posts/:id', (req, res) => {
  const index = posts.findIndex(p => p.id === parseInt(req.params.id));
  if (index !== -1) {
    posts[index] = { ...posts[index], ...req.body };
    res.json(posts[index]);
  } else {
    res.status(404).json({ message: 'Post not found' });
  }
});

app.delete('/api/posts/:id', (req, res) => {
  posts = posts.filter(p => p.id !== parseInt(req.params.id));
  res.json({ success: true });
});

// 4. Comments (RTK Query 테스트용)
app.get('/api/comments', (req, res) => {
  const postId = parseInt(req.query.postId as string);
  const postComments = comments.filter(c => c.postId === postId);
  res.json(postComments);
});

app.post('/api/comments', (req, res) => {
  const newComment = { id: Date.now(), ...req.body };
  comments.push(newComment);
  res.status(201).json(newComment);
});

// 5. Upload (Pure Axios 테스트용)
app.post('/api/upload', (req, res) => {
  res.json({ success: true, message: 'File uploaded successfully' });
});

app.listen(port, () => {
  console.log(`Mock API Server running at http://localhost:${port}`);
});
