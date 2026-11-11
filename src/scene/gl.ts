/**
 * WebGL 2 plumbing for the scene: programs, the unit cube, instance buffers. One context for the
 * whole page (PLAN-EXPERIENCE §1.4.5: one renderer).
 */
export type GL = WebGL2RenderingContext;

export function program(gl: GL, vs: string, fs: string): WebGLProgram {
  const shader = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS) && !gl.isContextLost())
      throw new Error(`shader: ${gl.getShaderInfoLog(s)}`);
    return s;
  };
  const p = gl.createProgram()!;
  gl.attachShader(p, shader(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS) && !gl.isContextLost())
    throw new Error(`program: ${gl.getProgramInfoLog(p)}`);
  return p;
}

/** Uniform locations by name. */
export function uniforms<T extends string>(
  gl: GL,
  p: WebGLProgram,
  names: readonly T[],
): Record<T, WebGLUniformLocation | null> {
  return Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)])) as Record<
    T,
    WebGLUniformLocation | null
  >;
}

/**
 * The unit cube: 6 faces × 4 corners (position, normal, uv), 36 indices. Face order +x −x +y −y
 * +z −z; uv (0,0) at the face's top-left as seen from outside, v down.
 */
export function cubeGeometry(): { vertices: Float32Array; indices: Uint16Array } {
  const faces: Array<{
    n: [number, number, number];
    u: [number, number, number];
    v: [number, number, number];
  }> = [
    { n: [1, 0, 0], u: [0, 0, -1], v: [0, -1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1], v: [0, -1, 0] },
    { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
    { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
    { n: [0, 0, 1], u: [1, 0, 0], v: [0, -1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, -1, 0] },
  ];
  const vertices: number[] = [];
  const indices: number[] = [];
  faces.forEach(({ n, u, v }, f) => {
    for (const [a, b] of [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ] as const) {
      const p = [0, 1, 2].map((k) => n[k]! * 0.5 + u[k]! * (a - 0.5) + v[k]! * (b - 0.5));
      vertices.push(...p, ...n, a, b);
    }
    const o = f * 4;
    // u × v = −n for every face, so these two triangles wind counter-clockwise from outside.
    indices.push(o, o + 2, o + 1, o, o + 3, o + 2);
  });
  return { vertices: new Float32Array(vertices), indices: new Uint16Array(indices) };
}

export interface InstanceLayout {
  /** [location, components, offset in floats] */
  attrs: Array<[number, number, number]>;
  stride: number;
}

/** A VAO for instanced drawing: a shared vertex buffer + one instance buffer. */
export function instancedVao(
  gl: GL,
  geometry: WebGLBuffer,
  geometryAttrs: Array<[number, number, number]>,
  geometryStride: number,
  index: WebGLBuffer | null,
  instances: WebGLBuffer,
  layout: InstanceLayout,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray()!;
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, geometry);
  for (const [loc, size, offset] of geometryAttrs) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, geometryStride * 4, offset * 4);
  }
  if (index) gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
  gl.bindBuffer(gl.ARRAY_BUFFER, instances);
  for (const [loc, size, offset] of layout.attrs) {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, layout.stride * 4, offset * 4);
    gl.vertexAttribDivisor(loc, 1);
  }
  gl.bindVertexArray(null);
  return vao;
}

export function buffer(
  gl: GL,
  data: AllowSharedBufferSource,
  target: number,
  usage: number,
): WebGLBuffer {
  const b = gl.createBuffer()!;
  gl.bindBuffer(target, b);
  gl.bufferData(target, data, usage);
  return b;
}
