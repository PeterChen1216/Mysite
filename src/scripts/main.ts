/** Client entry for the voxel page: small, dependency-free enhancements. */
import { initClocks } from './clock';
import { initGlobes } from './globe';
import { initParticles } from './particles';

const start = () => {
  initGlobes();
  initParticles();
  initClocks();
};

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
