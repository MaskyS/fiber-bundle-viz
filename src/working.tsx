// @ts-nocheck
import React, { useEffect, useRef, useState } from 'react';

// Matrix math utilities
const mat4 = {
  create: function() {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1
    ]);
  },
  
  perspective: function(out, fovy, aspect, near, far) {
    const f = 1.0 / Math.tan(fovy / 2);
    out[0] = f / aspect;
    out[1] = 0;
    out[2] = 0;
    out[3] = 0;
    out[4] = 0;
    out[5] = f;
    out[6] = 0;
    out[7] = 0;
    out[8] = 0;
    out[9] = 0;
    out[10] = (far + near) / (near - far);
    out[11] = -1;
    out[12] = 0;
    out[13] = 0;
    out[14] = (2 * far * near) / (near - far);
    out[15] = 0;
    return out;
  },
  
  translate: function(out, a, v) {
    const x = v[0], y = v[1], z = v[2];
    out[12] = a[0] * x + a[4] * y + a[8] * z + a[12];
    out[13] = a[1] * x + a[5] * y + a[9] * z + a[13];
    out[14] = a[2] * x + a[6] * y + a[10] * z + a[14];
    out[15] = a[3] * x + a[7] * y + a[11] * z + a[15];
    return out;
  },
  
  rotate: function(out, a, rad, axis) {
    let x = axis[0], y = axis[1], z = axis[2];
    let len = Math.hypot(x, y, z);
    len = 1 / len;
    x *= len;
    y *= len;
    z *= len;
    
    const s = Math.sin(rad);
    const c = Math.cos(rad);
    const t = 1 - c;
    
    const b00 = x * x * t + c;
    const b01 = y * x * t + z * s;
    const b02 = z * x * t - y * s;
    const b10 = x * y * t - z * s;
    const b11 = y * y * t + c;
    const b12 = z * y * t + x * s;
    const b20 = x * z * t + y * s;
    const b21 = y * z * t - x * s;
    const b22 = z * z * t + c;
    
    const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
    const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
    const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
    
    out[0] = a00 * b00 + a10 * b01 + a20 * b02;
    out[1] = a01 * b00 + a11 * b01 + a21 * b02;
    out[2] = a02 * b00 + a12 * b01 + a22 * b02;
    out[3] = a03 * b00 + a13 * b01 + a23 * b02;
    out[4] = a00 * b10 + a10 * b11 + a20 * b12;
    out[5] = a01 * b10 + a11 * b11 + a21 * b12;
    out[6] = a02 * b10 + a12 * b11 + a22 * b12;
    out[7] = a03 * b10 + a13 * b11 + a23 * b12;
    out[8] = a00 * b20 + a10 * b21 + a20 * b22;
    out[9] = a01 * b20 + a11 * b21 + a21 * b22;
    out[10] = a02 * b20 + a12 * b21 + a22 * b22;
    out[11] = a03 * b20 + a13 * b21 + a23 * b22;
    
    if (a !== out) {
      out[12] = a[12];
      out[13] = a[13];
      out[14] = a[14];
      out[15] = a[15];
    }
    return out;
  }
};

// Vertex shader
const vsSource = `
  attribute vec4 aVertexPosition;
  attribute vec4 aVertexColor;
  uniform mat4 uModelViewMatrix;
  uniform mat4 uProjectionMatrix;
  uniform float uDeformation;
  uniform vec3 uFiberPosition;
  varying lowp vec4 vColor;

  void main(void) {
    vec4 position = aVertexPosition;
    
    // Get original position before transformations
    float originalDistFromCenter = length(uFiberPosition.xy);
    
    // Constants to prevent overlap
    const float MAX_EXPANSION = 2.1; // Maximum expansion factor for center
    const float MIN_SPACING = 0.1; // Minimum space between fibers
    
    // Get the fiber's base position (center point)
    vec3 fiberCenter = uFiberPosition;
    // Convert position to local coordinates (relative to fiber center)
    vec3 localPos = position.xyz - fiberCenter;
    
    // Apply deformation based on fiber position
    if (originalDistFromCenter < 0.1) {
      // Center fiber: controlled expansion in xy
      float expansionFactor = 1.0 + (uDeformation * (MAX_EXPANSION - 1.0));
      localPos.xy *= expansionFactor;
      // Only move bottom face up, preserving top face position
      if (localPos.z < 0.0) {
        localPos.z *= (1.0 / (expansionFactor * expansionFactor));
      }
    } else {
      // Calculate area taken by center fiber
      float centerExpansion = 1.0 + (uDeformation * (MAX_EXPANSION - 1.0));
      float centerArea = centerExpansion * centerExpansion;
      float remainingArea = 9.0 - centerArea;
      
      // Calculate safe contraction factor that prevents overlap
      float maxContraction = length(uFiberPosition.xy) - (centerExpansion * 0.2) - MIN_SPACING;
      float areaBasedContraction = sqrt(remainingArea / 8.0);
      float contractionFactor = max(maxContraction / length(uFiberPosition.xy), areaBasedContraction);
      
      // Contract xy while maintaining center position
      localPos.xy *= contractionFactor;
      
      // Adjust z similarly to center fiber - only bottom face moves
      if (localPos.z < 0.0) {
        localPos.z *= 1.0 / (contractionFactor * contractionFactor);
      }
    }
    
    // Convert back to world coordinates
    position.xyz = localPos + fiberCenter;
    
    gl_Position = uProjectionMatrix * uModelViewMatrix * position;
    vColor = aVertexColor;
  }
`;

// Fragment shader
const fsSource = `
  varying lowp vec4 vColor;
  void main(void) {
    gl_FragColor = vColor;
  }
`;

function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  return shaderProgram;
}

function loadShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function initBuffers(gl) {
  const positions = [];
  const colors = [];
  const indices = [];
  
  // Create 3x3 grid of fibers
  for (let i = 0; i < 9; i++) {
    const x = (i % 3 - 1) * 0.5;
    const y = (Math.floor(i / 3) - 1) * 0.5;
    createFiber(positions, colors, indices, x, y, positions.length / 3);
  }

  return {
    position: createBuffer(gl, positions),
    color: createBuffer(gl, colors),
    indices: createIndexBuffer(gl, indices),
    count: indices.length,
  };
}

function createFiber(positions, colors, indices, x, y, indexOffset) {
  const size = 0.2;
  const height = 0.5;
  
  // Add vertices
  positions.push(
    // Bottom face
    x - size, y - size, -height,
    x + size, y - size, -height,
    x + size, y + size, -height,
    x - size, y + size, -height,
    // Top face
    x - size, y - size, height,
    x + size, y - size, height,
    x + size, y + size, height,
    x - size, y + size, height
  );
  
  // Add colors
  const isCenter = Math.abs(x) < 0.1 && Math.abs(y) < 0.1;
  const color = isCenter ? [1, 0, 0, 0.8] : [0, 0, 1, 0.8];
  for (let i = 0; i < 8; i++) {
    colors.push(...color);
  }
  
  // Add indices for faces
  const faces = [
    0, 1, 2,    0, 2, 3,  // bottom
    4, 5, 6,    4, 6, 7,  // top
    0, 1, 5,    0, 5, 4,  // sides
    1, 2, 6,    1, 6, 5,
    2, 3, 7,    2, 7, 6,
    3, 0, 4,    3, 4, 7
  ];
  
  for (const i of faces) {
    indices.push(i + indexOffset);
  }
}

function createBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
  return buffer;
}

function createIndexBuffer(gl, data) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(data), gl.STATIC_DRAW);
  return buffer;
}

function FiberBundleVisualization() {
  const canvasRef = useRef(null);
  const [deformation, setDeformation] = useState(0);
  const glRef = useRef(null);
  const buffersRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const shaderProgram = initShaderProgram(gl, vsSource, fsSource);
    const programInfo = {
      program: shaderProgram,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
        vertexColor: gl.getAttribLocation(shaderProgram, 'aVertexColor'),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
        modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
        deformation: gl.getUniformLocation(shaderProgram, 'uDeformation'),
        fiberPosition: gl.getUniformLocation(shaderProgram, 'uFiberPosition'),
      },
    };

    glRef.current = { gl, programInfo };
    buffersRef.current = initBuffers(gl);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  }, []);

  useEffect(() => {
    if (!glRef.current || !buffersRef.current) return;

    const { gl, programInfo } = glRef.current;
    const buffers = buffersRef.current;

    gl.clearColor(0.9, 0.9, 0.9, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const projectionMatrix = mat4.create();
    const modelViewMatrix = mat4.create();

    mat4.perspective(projectionMatrix, 45 * Math.PI / 180, gl.canvas.width / gl.canvas.height, 0.1, 100.0);
    mat4.translate(modelViewMatrix, modelViewMatrix, [0, 0, -5]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, -Math.PI / 4, [1, 0, 0]);
    mat4.rotate(modelViewMatrix, modelViewMatrix, Math.PI / 4, [0, 1, 0]);

    gl.useProgram(programInfo.program);

    gl.uniformMatrix4fv(programInfo.uniformLocations.projectionMatrix, false, projectionMatrix);
    gl.uniformMatrix4fv(programInfo.uniformLocations.modelViewMatrix, false, modelViewMatrix);
    gl.uniform1f(programInfo.uniformLocations.deformation, deformation);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexPosition, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexPosition);

    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.color);
    gl.vertexAttribPointer(programInfo.attribLocations.vertexColor, 4, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(programInfo.attribLocations.vertexColor);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buffers.indices);

    // Draw center fiber
    gl.uniform3f(programInfo.uniformLocations.fiberPosition, 0.0, 0.0, 0.0);
    const verticesPerFiber = 36; // 6 faces * 2 triangles * 3 vertices
    const centerOffset = 4 * verticesPerFiber; // Center fiber is the 5th fiber (index 4)
    gl.drawElements(gl.TRIANGLES, verticesPerFiber, gl.UNSIGNED_SHORT, centerOffset * 2);

    // Draw surrounding fibers
    const positions = [
      [-0.5, -0.5], [0, -0.5], [0.5, -0.5],
      [-0.5, 0], [0.5, 0],
      [-0.5, 0.5], [0, 0.5], [0.5, 0.5]
    ];
    
    for (let i = 0; i < positions.length; i++) {
      const [x, y] = positions[i];
      gl.uniform3f(programInfo.uniformLocations.fiberPosition, x, y, 0.0);
      const offset = (i < 4 ? i : i + 1) * verticesPerFiber; // Skip center fiber
      gl.drawElements(gl.TRIANGLES, verticesPerFiber, gl.UNSIGNED_SHORT, offset * 2);
    }
  }, [deformation]);

  return (
    <div className="flex flex-col items-center space-y-4">
      <canvas
        ref={canvasRef}
        className="w-96 h-96 border border-gray-300"
        width={400}
        height={400}
      />
      <div className="w-96 flex items-center space-x-4">
        <span className="text-sm">Deformation:</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={deformation}
          onChange={(e) => setDeformation(parseFloat(e.target.value))}
          className="flex-1"
        />
        <span className="text-sm">{(deformation * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

export default FiberBundleVisualization;