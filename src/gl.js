// gl.js — a thin WebGL2 kit: programs with cached uniforms, buffers, render targets, a full-screen triangle.

function createGL(canvas) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: true, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  if (!gl) return null;
  const floatRT = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  gl.getExtension('OES_texture_float_linear');

  function shader(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      const log = gl.getShaderInfoLog(s), lines = src.split('\n');
      const m = /ERROR: \d+:(\d+)/.exec(log); const ln = m ? +m[1] : 0;
      throw new Error('shader: ' + log + '\n' + lines.slice(Math.max(0, ln - 3), ln + 2).map((l, k) => (ln - 2 + k) + ': ' + l).join('\n'));
    }
    return s;
  }
  function program(vs, fs) {
    const p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link: ' + gl.getProgramInfoLog(p));
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const info = gl.getActiveUniform(p, i); u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name); }
    p.u = u; return p;
  }
  function buffer(data, usage) { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, usage || gl.STATIC_DRAW); return b; }
  // attribs: [{buf, loc, size, stride, offset, divisor, type}]
  function vao(attribs, index) {
    const v = gl.createVertexArray(); gl.bindVertexArray(v);
    for (const a of attribs) {
      gl.bindBuffer(gl.ARRAY_BUFFER, a.buf); gl.enableVertexAttribArray(a.loc);
      gl.vertexAttribPointer(a.loc, a.size, a.type || gl.FLOAT, false, a.stride || 0, a.offset || 0);
      if (a.divisor) gl.vertexAttribDivisor(a.loc, a.divisor);
    }
    if (index) { const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, index, gl.STATIC_DRAW); }
    gl.bindVertexArray(null); return v;
  }
  function texture(w, h, internal, format, type, filter) {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, type, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function target(w, h, withDepth) {
    const t = makeTarget(w, h, withDepth, floatRT);
    if (t.ok || !floatRT) return t;
    t.free(); return makeTarget(w, h, withDepth, false);
  }
  function makeTarget(w, h, withDepth, hdr) {
    const tex = texture(w, h, hdr ? gl.RGBA16F : gl.RGBA8, gl.RGBA, hdr ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE);
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    let depth = null;
    if (withDepth) { depth = texture(w, h, gl.DEPTH_COMPONENT24, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, gl.NEAREST); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, depth, 0); }
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fbo, depth, w, h, ok, free() { gl.deleteTexture(tex); if (depth) gl.deleteTexture(depth); gl.deleteFramebuffer(fbo); } };
  }
  // a multisampled colour+depth target to draw the scene into; resolved into a texture target afterwards
  function msaaTarget(w, h, samples, hdr) {
    const fbo = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    const c = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, c); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, hdr ? gl.RGBA16F : gl.RGBA8, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
    const d = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, d); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, samples, gl.DEPTH_COMPONENT24, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { fbo, w, h, ok, free() { gl.deleteRenderbuffer(c); gl.deleteRenderbuffer(d); gl.deleteFramebuffer(fbo); } };
  }
  const tri = vao([{ buf: buffer(new Float32Array([-1, -1, 3, -1, -1, 3])), loc: 0, size: 2 }]);
  const FS_VERT = `#version 300 es
layout(location=0) in vec2 aPos; out vec2 vUv;
void main(){ vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }`;
  function fullscreen() { gl.bindVertexArray(tri); gl.drawArrays(gl.TRIANGLES, 0, 3); }
  return { gl, floatRT, program, buffer, vao, texture, target, msaaTarget, fullscreen, FS_VERT, maxSamples: gl.getParameter(gl.MAX_SAMPLES) || 0 };
}
