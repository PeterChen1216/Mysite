/** Client entry for the voxel page: small, dependency-free enhancements. */
import { initClocks } from './clock';
import { initGlobes } from './globe';
import { initOffscreenPause } from './offscreen';
import { initParticles } from './particles';
import { initScrollSpy } from './scrollspy';

const start = () => {
  initGlobes();
  initOffscreenPause();
  initParticles();
  initClocks();
  initScrollSpy();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
