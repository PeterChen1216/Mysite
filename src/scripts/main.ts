/** Client entry for the voxel page: small, dependency-free enhancements. */
import { initClocks } from './clock';
import { initDismissible } from './dismiss';
import { initEntrances } from './enter';
import { initGlobes } from './globe';
import { initInteractions } from './interact';
import { initLang } from './lang';
import { initOffscreenPause } from './offscreen';
import { initParticles } from './particles';
import { initPrefs } from './prefs';
import { initScene } from './scene-loader';
import { initScrollSpy } from './scrollspy';
import { initSlots } from './slots';
import { initWindowLinks } from './window-links';

const start = () => {
  // First: the loops below follow the motion state it keeps current.
  initPrefs();
  initGlobes();
  initOffscreenPause();
  initParticles();
  initInteractions();
  initSlots();
  initEntrances();
  initClocks();
  initScrollSpy();
  initDismissible();
  initLang();
  initWindowLinks();
  // Last, and only once the page is usable: the WebGL scene, at graphics tier 3.
  initScene();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
