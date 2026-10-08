import {mountPanel} from './gui.js';
window.__ghostPanel?.destroy?.();
window.__ghostPanel = mountPanel(document);
