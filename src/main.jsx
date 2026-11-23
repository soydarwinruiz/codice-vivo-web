import { render } from 'preact';
import { App } from './ui/App.jsx';
import './ui/styles.css';
const root = document.getElementById('app');
root.textContent = '';
render(<App />, root);
window.__codiceOk = true;
