import '@backstage/cli/asset-types';
import ReactDOM from 'react-dom/client';
import '@backstage/canon/css/styles.css';
import '@backstage/ui/css/styles.css';

// Uncomment the lines below if you want to use the old version of the app
// import App from './App';

// ReactDOM.createRoot(document.getElementById('root')!).render(<App />);

// Uncomment the lines below if you want to use the alpha version of the app
import AppAlpha from './App-Alpha';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <div data-theme={localStorage.getItem('theme') ?? 'light'}>{AppAlpha}</div>,
);
