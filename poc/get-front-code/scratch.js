const code = `
import { Provider } from 'react-redux';
import { Route, Routes } from 'react-router';

import { AuthWrapper } from './components/auth-wrapper';
import { MainPage } from './features/main';
import { store } from './store';

import './index.css';

function App() {
  return (
    <Provider store={store}>
      <AuthWrapper>
        <Routes>
          {/* Keep MainPage mounted when moving between / and /:taskCode */}
          <Route path="/:taskCode?" element={<MainPage />} />
        </Routes>
      </AuthWrapper>
    </Provider>
  );
}

export default App;
`;

const routeRegex = /<Route\s+[^>]*path=['"]([^'"]+)['"][^>]*element=\{<([A-Za-z0-9_]+)/g;
let match;
while ((match = routeRegex.exec(code)) !== null) {
  console.log('Route matched:', match[1], match[2]);
  
  const componentName = match[2];
  const importRegex = new RegExp(`import\\s+.*?\\b${componentName}\\b.*?\\s+from\\s+['"]([^'"]+)['"]`);
  const importMatch = code.match(importRegex);
  
  console.log('Import matched:', importMatch ? importMatch[1] : null);
}
