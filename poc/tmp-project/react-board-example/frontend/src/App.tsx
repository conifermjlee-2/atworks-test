import { Routes, Route, Link } from 'react-router-dom';
import NoticeBanner from './components/NoticeBanner';
import PostList from './components/PostList';
import PostDetail from './components/PostDetail';
import LoginForm from './components/LoginForm';

function App() {
  return (
    <div className="container">
      <header className="app-header">
        <h1><Link to="/">React Board Example</Link></h1>
        <nav className="nav-links">
          <Link to="/">Home</Link>
          <Link to="/login">Login</Link>
        </nav>
      </header>
      
      <NoticeBanner />
      
      <main>
        <Routes>
          <Route path="/" element={<PostList />} />
          <Route path="/posts/:id" element={<PostDetail />} />
          <Route path="/login" element={<LoginForm />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
