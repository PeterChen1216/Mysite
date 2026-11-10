/**
 * The scene's three programs: instanced cubes (the Earth, blocks, islands, rings), instanced
 * sprites (stars, motes, glows, XP orbs) and the background grid. Colours come only from the
 * palette uniform (palette.ts, read from the theme tokens).
 */

/** Instanced cube: per-instance pos, size, quat, tiles (top/side/bottom/flags), anim (phase/spin). */
export const CUBE_VS = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNormal;
layout(location=2) in vec2 aUv;
layout(location=3) in vec3 iPos;
layout(location=4) in vec3 iSize;
layout(location=5) in vec4 iQuat;
layout(location=6) in vec4 iTiles;
layout(location=7) in vec2 iAnim;
uniform mat4 uViewProj;
uniform mat4 uModel;
uniform vec3 uEye;
uniform float uTime;
uniform vec3 uSun;
uniform float uSweep;
out vec2 vUv;
out float vDepth;
flat out float vTile;
flat out float vShade;
flat out float vDay;
flat out float vLit;
vec3 qrot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
vec3 roty(float a, vec3 v) { float c = cos(a); float s = sin(a); return vec3(c * v.x + s * v.z, v.y, -s * v.x + c * v.z); }
void main() {
  int flags = int(iTiles.w + 0.5);
  vec3 local = qrot(iQuat, aPos * iSize);
  vec3 n = qrot(iQuat, aNormal);
  if (iAnim.y != 0.0) {
    float a = uTime * iAnim.y + iAnim.x * 6.2832;
    local = roty(a, local);
    n = roty(a, n);
  }
  vec3 p = iPos + local;
  if ((flags & 4) != 0) p.y += sin(uTime * 0.9 + iAnim.x * 6.2832) * 0.35;
  vec4 world = uModel * vec4(p, 1.0);
  vec3 wn = normalize(mat3(uModel) * n);
  vec3 up = (flags & 1) != 0 ? normalize(iPos) : vec3(0.0, 1.0, 0.0);
  float facing = dot(n, up);
  vTile = facing > 0.55 ? iTiles.x : (facing < -0.55 ? iTiles.z : iTiles.y);
  // One light from the upper right, in steps: a voxel face is one flat colour.
  float d = clamp(dot(wn, normalize(vec3(0.45, 0.8, 0.4))), 0.0, 1.0);
  vShade = 0.6 + 0.4 * floor(d * 4.0 + 0.5) / 4.0;
  vDay = 1.0;
  if ((flags & 1) != 0) {
    float s = dot(normalize(iPos), uSun);
    vDay = s > 0.1 ? 1.0 : (s > -0.1 ? 0.55 : 0.0);
  }
  vLit = -1.0;
  if ((flags & 2) != 0) {
    float da = mod(uSweep - iAnim.x, 6.2832);
    vLit = da < 1.4 ? 1.0 - da / 1.4 : 0.0;
  }
  vUv = aUv;
  vDepth = distance(world.xyz, uEye);
  gl_Position = uViewProj * world;
}`;

export const CUBE_FS = `#version 300 es
precision highp float;
precision highp int;
uniform highp usampler2D uAtlas;
uniform vec3 uPalette[16];
uniform vec2 uFog;
uniform float uFade;
uniform float uNight;
// The scrim (renderer.ts): behind the page's free-standing text the scene gives way to its sky,
// so text keeps the contrast of its token background. Rects in device px (gl_FragCoord space).
uniform vec4 uScrim[12];
uniform int uScrimN;
uniform float uScrimEdge;
float scrim() {
  float s = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= uScrimN) break;
    vec4 r = uScrim[i];
    vec2 d = max(max(r.xy - gl_FragCoord.xy, gl_FragCoord.xy - r.zw), vec2(0.0));
    s = max(s, 1.0 - smoothstep(0.0, uScrimEdge, length(d)));
  }
  return s * 0.94;
}
in vec2 vUv;
in float vDepth;
flat in float vTile;
flat in float vShade;
flat in float vDay;
flat in float vLit;
out vec4 outColor;
void main() {
  vec3 sky = uPalette[0];
  vec3 color;
  float glow = 0.0;
  if (vTile >= 32.0) {
    color = uPalette[int(vTile - 32.0 + 0.5)];
  } else {
    int t = int(vTile + 0.5);
    ivec2 texel = ivec2(t % 4, t / 4) * 8 + ivec2(min(floor(vUv * 8.0), vec2(7.0)));
    uvec4 s = texelFetch(uAtlas, texel, 0);
    color = uPalette[int(s.r / 16u)] * (float(s.g) / 128.0);
    glow = float(s.b) / 255.0;
  }
  vec3 night = mix(color * uNight, sky, 0.2);
  color = mix(night, color, max(vDay, glow));
  color *= mix(vShade, 1.0, glow);
  // Radar ring: dim at rest, lit in the sweep's colour as it passes.
  if (vLit >= 0.0) color = mix(color * 0.45, uPalette[7], vLit);
  float f = smoothstep(uFog.x, uFog.y, vDepth);
  outColor = vec4(mix(color, sky, max(max(f, uFade), scrim())), 1.0);
}`;

/** Instanced camera-facing sprite: pos; size, slot, alpha, shape; flags, phase, speed, range. */
export const SPRITE_VS = `#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec2 aCorner;
layout(location=1) in vec3 iPos;
layout(location=2) in vec4 iA;
layout(location=3) in vec4 iB;
uniform mat4 uView;
uniform mat4 uProj;
uniform float uTime;
uniform float uSkyArt;
uniform float uMotes;
uniform float uGlow;
out vec2 vCorner;
out float vAlpha;
out float vDepth;
flat out float vSlot;
flat out float vShape;
void main() {
  vec3 p = iPos;
  float alpha = iA.z;
  int flags = int(iB.x + 0.5);
  if ((flags & 1) != 0) {
    float f = fract(uTime * iB.z / iB.w + iB.y);
    p.y += f * iB.w;
    alpha *= smoothstep(0.0, 0.15, f) * (1.0 - smoothstep(0.7, 1.0, f)) * uMotes;
  }
  if ((flags & 2) != 0) alpha *= uSkyArt;
  if (iA.w > 0.5 && iA.w < 1.5) alpha *= uGlow;
  vec4 v = uView * vec4(p, 1.0);
  v.xy += aCorner * iA.x;
  vCorner = aCorner;
  vAlpha = alpha;
  vDepth = -v.z;
  vSlot = iA.y;
  vShape = iA.w;
  gl_Position = uProj * v;
}`;

export const SPRITE_FS = `#version 300 es
precision highp float;
precision highp int;
uniform vec3 uPalette[16];
uniform vec2 uFog;
uniform float uFade;
// The scrim (renderer.ts): behind the page's free-standing text the scene gives way to its sky,
// so text keeps the contrast of its token background. Rects in device px (gl_FragCoord space).
uniform vec4 uScrim[12];
uniform int uScrimN;
uniform float uScrimEdge;
float scrim() {
  float s = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= uScrimN) break;
    vec4 r = uScrim[i];
    vec2 d = max(max(r.xy - gl_FragCoord.xy, gl_FragCoord.xy - r.zw), vec2(0.0));
    s = max(s, 1.0 - smoothstep(0.0, uScrimEdge, length(d)));
  }
  return s * 0.94;
}
in vec2 vCorner;
in float vAlpha;
in float vDepth;
flat in float vSlot;
flat in float vShape;
out vec4 outColor;
void main() {
  vec3 color = uPalette[int(vSlot + 0.5)];
  float a = vAlpha;
  float r = length(vCorner) * 2.0;
  if (vShape > 1.5) {
    // XP orb: a pixel disc (6 × 6 grid) with a lighter core.
    vec2 q = (floor((vCorner + 0.5) * 6.0) + 0.5) / 6.0 - 0.5;
    float d = length(q) * 2.0;
    if (d > 0.95) discard;
    color = mix(color, uPalette[12], d < 0.45 ? 0.55 : 0.0);
  } else if (vShape > 0.5) {
    // Soft glow.
    a *= pow(max(0.0, 1.0 - r * r), 2.0) * 0.55;
  }
  a *= 1.0 - max(max(smoothstep(uFog.x, uFog.y, vDepth), uFade), scrim());
  if (a <= 0.003) discard;
  outColor = vec4(color * a, a);
}`;

/** The background grid: a big plane far behind, lines of one device pixel every `uCell` units. */
export const GRID_VS = `#version 300 es
precision highp float;
layout(location=0) in vec2 aCorner;
uniform mat4 uViewProj;
uniform vec3 uCenter;
uniform float uSize;
out vec2 vWorld;
void main() {
  vec3 p = uCenter + vec3(aCorner * uSize, 0.0);
  vWorld = p.xy;
  gl_Position = uViewProj * vec4(p, 1.0);
}`;

export const GRID_FS = `#version 300 es
precision highp float;
uniform vec3 uLine;
uniform float uAlpha;
uniform float uCell;
// The scrim (renderer.ts): behind the page's free-standing text the scene gives way to its sky,
// so text keeps the contrast of its token background. Rects in device px (gl_FragCoord space).
uniform vec4 uScrim[12];
uniform int uScrimN;
uniform float uScrimEdge;
float scrim() {
  float s = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= uScrimN) break;
    vec4 r = uScrim[i];
    vec2 d = max(max(r.xy - gl_FragCoord.xy, gl_FragCoord.xy - r.zw), vec2(0.0));
    s = max(s, 1.0 - smoothstep(0.0, uScrimEdge, length(d)));
  }
  return s * 0.94;
}
in vec2 vWorld;
out vec4 outColor;
void main() {
  vec2 g = vWorld / uCell;
  vec2 w = fwidth(g);
  vec2 d = abs(fract(g - 0.5) - 0.5) / max(w, vec2(1e-4));
  float line = 1.0 - min(min(d.x, d.y), 1.0);
  float a = line * uAlpha * (1.0 - scrim());
  if (a <= 0.003) discard;
  outColor = vec4(uLine * a, a);
}`;
