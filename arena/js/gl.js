// Small WebGL2 toolkit shared by the rooms.

export function createGL(canvas, extra = {}) {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    alpha: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: 'high-performance',
    ...extra,
  });
  if (!gl) throw new Error('WebGL2 is not available in this browser.');
  const caps = {
    float: !!gl.getExtension('EXT_color_buffer_float'),
    half: !!gl.getExtension('EXT_color_buffer_half_float'),
    floatLinear: !!gl.getExtension('OES_texture_float_linear'),
  };
  gl.caps = caps;
  return gl;
}

// Choose a renderable high precision format. Returns {internal, format, type}.
export function floatFormat(gl, channels = 4, prefer32 = true) {
  const c = gl.caps;
  const R = { 1: [gl.R32F, gl.R16F, gl.RED], 2: [gl.RG32F, gl.RG16F, gl.RG], 4: [gl.RGBA32F, gl.RGBA16F, gl.RGBA] }[channels];
  if (c.float && prefer32) return { internal: R[0], format: R[2], type: gl.FLOAT, bits: 32 };
  if (c.float || c.half) return { internal: R[1], format: R[2], type: gl.HALF_FLOAT, bits: 16 };
  return null;
}

export function texture(gl, w, h, opt = {}) {
  const t = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, t);
  const internal = opt.internal ?? gl.RGBA8;
  const format = opt.format ?? gl.RGBA;
  const type = opt.type ?? gl.UNSIGNED_BYTE;
  gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, opt.data ?? null);
  const f = opt.filter ?? gl.LINEAR;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  const wrap = opt.wrap ?? gl.CLAMP_TO_EDGE;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrap);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrap);
  t.w = w; t.h = h;
  return t;
}

export function framebuffer(gl, textures) {
  const list = Array.isArray(textures) ? textures : [textures];
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  const bufs = [];
  list.forEach((t, i) => {
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, t, 0);
    bufs.push(gl.COLOR_ATTACHMENT0 + i);
  });
  gl.drawBuffers(bufs);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  if (status !== gl.FRAMEBUFFER_COMPLETE) throw new Error('Framebuffer incomplete: 0x' + status.toString(16));
  fb.w = list[0].w; fb.h = list[0].h; fb.tex = list;
  return fb;
}

// A ping-pong pair of framebuffers (each possibly with several attachments).
export function pingpong(gl, w, h, specs) {
  const make = () => {
    const tex = specs.map((s) => texture(gl, w, h, s));
    return framebuffer(gl, tex);
  };
  const p = { read: make(), write: make() };
  p.swap = () => { const t = p.read; p.read = p.write; p.write = t; };
  return p;
}

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => (i + 1) + ': ' + l).join('\n');
    console.error(numbered);
    throw new Error('Shader compile error: ' + log);
  }
  return s;
}

export const FULLSCREEN_VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.0,1.0); }`;

export function program(gl, vsSrc, fsSrc, attribs = {}) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc));
  for (const [name, loc] of Object.entries(attribs)) gl.bindAttribLocation(p, loc, name);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(p));
  // uniform cache
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  p.u = {};
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    const name = info.name.replace(/\[0\]$/, '');
    p.u[name] = { loc: gl.getUniformLocation(p, info.name), type: info.type, size: info.size };
  }
  return p;
}

// Set uniforms by name. Textures are given as {tex, unit} or a texture object (auto units).
export function use(gl, p, uniforms = {}) {
  gl.useProgram(p);
  let unit = 0;
  for (const [name, v] of Object.entries(uniforms)) {
    const u = p.u[name];
    if (!u) continue;
    const L = u.loc;
    switch (u.type) {
      case gl.FLOAT: u.size > 1 ? gl.uniform1fv(L, v) : gl.uniform1f(L, v); break;
      case gl.FLOAT_VEC2: gl.uniform2fv(L, v); break;
      case gl.FLOAT_VEC3: gl.uniform3fv(L, v); break;
      case gl.FLOAT_VEC4: gl.uniform4fv(L, v); break;
      case gl.INT: case gl.BOOL: u.size > 1 ? gl.uniform1iv(L, v) : gl.uniform1i(L, v); break;
      case gl.FLOAT_MAT3: gl.uniformMatrix3fv(L, false, v); break;
      case gl.SAMPLER_2D: {
        gl.activeTexture(gl.TEXTURE0 + unit);
        gl.bindTexture(gl.TEXTURE_2D, v);
        gl.uniform1i(L, unit);
        unit++;
        break;
      }
      default: break;
    }
  }
}

// Fullscreen quad (two triangles) as a VAO.
export function quad(gl) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);
  return { draw() { gl.bindVertexArray(vao); gl.drawArrays(gl.TRIANGLES, 0, 6); } };
}

export function target(gl, fb) {
  if (fb) { gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, fb.w, fb.h); }
  else { gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight); }
}

// Shared GLSL snippets.
export const GLSL_NOISE = `
float hash12(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*.1031); p3 += dot(p3, p3.yzx+33.33); return fract((p3.x+p3.y)*p3.z); }
vec2 hash22(vec2 p){ vec3 p3 = fract(vec3(p.xyx)*vec3(.1031,.1030,.0973)); p3 += dot(p3,p3.yzx+33.33); return fract((p3.xx+p3.yz)*p3.zy); }
float vnoise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash12(i),hash12(i+vec2(1,0)),u.x), mix(hash12(i+vec2(0,1)),hash12(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<5;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return s; }
float fbm3(vec2 p){ float a=0.5, s=0.0; for(int i=0;i<3;i++){ s+=a*vnoise(p); p=p*2.03+vec2(17.1,9.2); a*=0.5; } return s; }
`;

// Read the drawing buffer of a framebuffer into a 2D canvas (flipped right side up).
export function readToCanvas(gl, fb, w, h) {
  target(gl, fb);
  const px = new Uint8Array(w * h * 4);
  gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    const src = (h - 1 - y) * w * 4;
    img.data.set(px.subarray(src, src + w * 4), y * w * 4);
  }
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = 255;
  ctx.putImageData(img, 0, 0);
  return c;
}
