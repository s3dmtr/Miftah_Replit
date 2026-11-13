import { createRoot } from 'react-dom/client';
import './index.css';
import { StoreProvider } from './lib/store';
import { MobileApp } from './mobile/App';

// The MIFTAH mobile app experience. The earlier desktop web pages remain in src/pages for reference.
createRoot(document.getElementById('root')!).render(<StoreProvider><MobileApp /></StoreProvider>);
