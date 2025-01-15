// src/FiberBundleVisualization.tsx
import React, { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import {
  Vector2,
  Vector3,
  InstancedMesh,
  Object3D,
  Raycaster,
  InstancedBufferAttribute,
  Color,
} from 'three';
import { OrbitControls, Html } from '@react-three/drei';

interface FiberBundleVisualizationProps {
  fiberCount?: number;
  fiberResolution?: number;
  fiberSpacing?: number;
  baseSize?: number;
}

const FiberBundleVisualization: React.FC<FiberBundleVisualizationProps> = ({
  fiberCount = 20,
  fiberResolution = 16,
  fiberSpacing = 1,
  baseSize = 10,
}) => {
  const [selectedFiber, setSelectedFiber] = useState<{ i: number; j: number } | null>(null);
  const [deformationValue, setDeformationValue] = useState(1); // Slider value

  // Handler to update deformation value
  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(event.target.value);
    setDeformationValue(value);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {/* Slider UI */}
      {selectedFiber && (
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(255, 255, 255, 0.8)',
            padding: '10px',
            borderRadius: '5px',
            zIndex: 1, // Ensure the slider is on top
          }}
        >
          <label>
            Deformation:
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.01"
              value={deformationValue}
              onChange={handleSliderChange}
              style={{ width: '200px', marginLeft: '10px' }}
            />
          </label>
        </div>
      )}
      <Canvas
        onPointerMissed={() => setSelectedFiber(null)}
        camera={{ position: [0, 15, 25], fov: 50 }}
        style={{ width: '100%', height: '100%' }}
      >
        <Suspense
          fallback={
            <Html center>
              Loading...
            </Html>
          }
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[0, 10, 0]} intensity={0.7} />
          <FiberBundle
            fiberCount={fiberCount}
            fiberResolution={fiberResolution}
            fiberSpacing={fiberSpacing}
            baseSize={baseSize}
            selectedFiber={selectedFiber}
            setSelectedFiber={setSelectedFiber}
            deformationValue={deformationValue}
          />
          <OrbitControls enableDamping dampingFactor={0.1} rotateSpeed={0.5} />
        </Suspense>
      </Canvas>
    </div>
  );
};

interface FiberBundleProps {
  fiberCount: number;
  fiberResolution: number;
  fiberSpacing: number;
  baseSize: number;
  selectedFiber: { i: number; j: number } | null;
  setSelectedFiber: React.Dispatch<React.SetStateAction<{ i: number; j: number } | null>>;
  deformationValue: number;
}

const FiberBundle: React.FC<FiberBundleProps> = ({
    fiberCount,
    fiberResolution,
    fiberSpacing,
    baseSize,
    selectedFiber,
    setSelectedFiber,
    deformationValue,
  }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const { camera, gl } = useThree();
    const raycaster = new Raycaster();
    const pointer = new Vector2();
  
    // Mutable deformation data
    const deformations = useRef<number[][]>(
      Array.from({ length: fiberCount }, () => Array(fiberCount).fill(1))
    );
  
    const tempObject = new Object3D();
  
    // Define colors
    const normalColor = new Color('teal');
    const selectedColor = new Color('orange');
    const colorsRef = useRef<Float32Array | null>(null);
  
    // Refs to store posX and posZ (initialized with zeros)
    const posXRef = useRef<number[][]>(
      Array.from({ length: fiberCount }, () => Array(fiberCount).fill(0))
    );
    const posZRef = useRef<number[][]>(
      Array.from({ length: fiberCount }, () => Array(fiberCount).fill(0))
    );
  
    // Initialize instance colors
    useEffect(() => {
      if (meshRef.current) {
        const colors = new Float32Array(fiberCount * fiberCount * 3);
        for (let i = 0; i < fiberCount * fiberCount; i++) {
          colors[i * 3 + 0] = normalColor.r;
          colors[i * 3 + 1] = normalColor.g;
          colors[i * 3 + 2] = normalColor.b;
        }
        meshRef.current.geometry.setAttribute('instanceColor', new InstancedBufferAttribute(colors, 3));
        colorsRef.current = colors;
      }
    }, [fiberCount, normalColor]);
  
    // Update colors when selectedFiber changes
    useEffect(() => {
      if (meshRef.current && colorsRef.current) {
        // Reset all colors to normal
        for (let i = 0; i < fiberCount * fiberCount; i++) {
          colorsRef.current[i * 3 + 0] = normalColor.r;
          colorsRef.current[i * 3 + 1] = normalColor.g;
          colorsRef.current[i * 3 + 2] = normalColor.b;
        }
        // Highlight selected fiber
        if (selectedFiber) {
          const instanceId = selectedFiber.i * fiberCount + selectedFiber.j;
          colorsRef.current[instanceId * 3 + 0] = selectedColor.r;
          colorsRef.current[instanceId * 3 + 1] = selectedColor.g;
          colorsRef.current[instanceId * 3 + 2] = selectedColor.b;
        }
        meshRef.current.geometry.attributes.instanceColor.needsUpdate = true;
      }
    }, [selectedFiber, normalColor, selectedColor, fiberCount]);
  
    // Handle click events for fiber selection
    const handlePointerDown = (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation();
  
      const { clientX, clientY } = event as unknown as PointerEvent;
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
  
      pointer.x = ((clientX - rect.left) / canvas.clientWidth) * 2 - 1;
      pointer.y = -((clientY - rect.top) / canvas.clientHeight) * 2 + 1;
  
      raycaster.setFromCamera(pointer, camera);
  
      if (!meshRef.current) return;
  
      const intersects = raycaster.intersectObject(meshRef.current, false);
  
      if (intersects.length > 0) {
        const instanceId = intersects[0].instanceId!;
        const i = Math.floor(instanceId / fiberCount);
        const j = instanceId % fiberCount;
        setSelectedFiber({ i, j });
      }
    };
  
    useFrame(() => {
      if (!meshRef.current) return;
  
      // Update deformations based on the selected fiber and deformationValue
      if (selectedFiber) {
        const { i, j } = selectedFiber;
        deformations.current[i][j] = deformationValue;
  
        // Update neighboring fibers
        for (let rowIndex = 0; rowIndex < fiberCount; rowIndex++) {
          for (let colIndex = 0; colIndex < fiberCount; colIndex++) {
            if (rowIndex === i && colIndex === j) continue;
            const distance = Math.hypot(rowIndex - i, colIndex - j);
            const influence = Math.exp(-distance * 1.5); // Adjust influence factor as needed
            const deformation = 1 + (deformationValue - 1) * influence;
            deformations.current[rowIndex][colIndex] = deformation;
          }
        }
      } else {
        // Reset deformations when no fiber is selected
        for (let rowIndex = 0; rowIndex < fiberCount; rowIndex++) {
          for (let colIndex = 0; colIndex < fiberCount; colIndex++) {
            deformations.current[rowIndex][colIndex] = 1;
          }
        }
      }
  
      // Access posX and posZ from refs
      const posX = posXRef.current;
      const posZ = posZRef.current;
  
      const initialX = -((fiberCount - 1) / 2) * fiberSpacing;
      const initialZ = -((fiberCount - 1) / 2) * fiberSpacing;
  
      for (let j = 0; j < fiberCount; j++) {
        for (let i = 0; i < fiberCount; i++) {
          // Compute positions along x
          if (i === 0) {
            posX[i][j] = initialX;
          } else {
            const avgDeformation = (deformations.current[i - 1][j] + deformations.current[i][j]) / 2;
            posX[i][j] = posX[i - 1][j] + fiberSpacing * avgDeformation;
          }
  
          // Compute positions along z
          if (j === 0) {
            posZ[i][j] = initialZ;
          } else {
            const avgDeformation = (deformations.current[i][j - 1] + deformations.current[i][j]) / 2;
            posZ[i][j] = posZ[i][j - 1] + fiberSpacing * avgDeformation;
          }
        }
      }
  
      // Update the transformations of fibers
      let index = 0;
      for (let i = 0; i < fiberCount; i++) {
        for (let j = 0; j < fiberCount; j++) {
          const scale = deformations.current[i][j];
          tempObject.position.set(posX[i][j], 0, posZ[i][j]);
          tempObject.scale.set(scale, 1 / (scale * scale), scale);
          tempObject.updateMatrix();
          meshRef.current!.setMatrixAt(index, tempObject.matrix);
          index++;
        }
      }
  
      meshRef.current.instanceMatrix.needsUpdate = true;
    });
  
    // Access posX and posZ from refs in the render function
    const posX = posXRef.current;
    const posZ = posZRef.current;
  
    return (
      <>
        {/* Fibers */}
        <instancedMesh
          ref={meshRef}
          args={[undefined, undefined, fiberCount * fiberCount]}
          onPointerDown={handlePointerDown}
        >
          <cylinderGeometry
            attach="geometry"
            args={[0.4, 0.4, baseSize, fiberResolution]}
          />
          <meshStandardMaterial color="white" vertexColors />
        </instancedMesh>
  
        {/* Base Space Grid */}
        <group>
          {/* Horizontal Lines */}
          {Array.from({ length: fiberCount }, (_, j) => (
            <lineSegments key={`h-${j}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array(
                      Array.from({ length: fiberCount - 1 }, (_, i) => [
                        posX[i][j],
                        0,
                        posZ[i][j],
                        posX[i + 1][j],
                        0,
                        posZ[i + 1][j],
                      ]).flat()
                    ),
                    3, // itemSize
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="gray" />
            </lineSegments>
          ))}
  
          {/* Vertical Lines */}
          {Array.from({ length: fiberCount }, (_, i) => (
            <lineSegments key={`v-${i}`}>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  args={[
                    new Float32Array(
                      Array.from({ length: fiberCount - 1 }, (_, j) => [
                        posX[i][j],
                        0,
                        posZ[i][j],
                        posX[i][j + 1],
                        0,
                        posZ[i][j + 1],
                      ]).flat()
                    ),
                    3, // itemSize
                  ]}
                />
              </bufferGeometry>
              <lineBasicMaterial color="gray" />
            </lineSegments>
          ))}
        </group>
      </>
    );
  };
export default FiberBundleVisualization;