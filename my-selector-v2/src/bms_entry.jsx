import React from 'react';
import { createRoot } from 'react-dom/client';
import BmsViewer from './bms/BmsViewer';
import './style.css'; // Tailwind CSSを適用するために必要

// bms.html の <div id="root"> に BMSViewer を表示する
const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<BmsViewer />);
}