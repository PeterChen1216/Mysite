/** Client entry for the voxel page: small, dependency-free enhancements. */
import { initClocks } from './clock';
import { initDismissible } from './dismiss';
import { initGlobes } from './globe';
import { initOffscreenPause } from './offscreen';
import { initParticles } from './particles';
import { initPrefs } from './prefs';
import { initScrollSpy } from './scrollspy';

const start = () => {
  // First: the loops below follow the motion state it keeps current.
  initPrefs();
  initGlobes();
  initOffscreenPause();
  initParticles();
  initClocks();
  initScrollSpy();
  initDismissible();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
