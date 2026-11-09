/** Client entry for the voxel page: small, dependency-free enhancements. */
import { initClocks } from './clock';
import { initGlobes } from './globe';
import { initParticles } from './particles';
import { initScrollSpy } from './scrollspy';

const start = () => {
  initGlobes();
  initParticles();
  initClocks();
  initScrollSpy();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
