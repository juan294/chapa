"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, RoundedBox, Text, Float } from "@react-three/drei";
import { useRef, useState, useMemo, useEffect } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MaterialPreset = "matte" | "metallic" | "glossy" | "holographic";

const MATERIAL_PRESETS: Record<
  MaterialPreset,
  {
    metalness: number;
    roughness: number;
    emissiveIntensity: number;
    iridescence?: number;
    clearcoat?: number;
  }
> = {
  matte: { metalness: 0.1, roughness: 0.9, emissiveIntensity: 0 },
  metallic: { metalness: 0.7, roughness: 0.3, emissiveIntensity: 0.05 },
  glossy: { metalness: 0.9, roughness: 0.1, emissiveIntensity: 0.08 },
  holographic: {
    metalness: 0.5,
    roughness: 0.15,
    emissiveIntensity: 0.12,
    iridescence: 1,
    clearcoat: 1,
  },
};

const PRESET_LABELS: Record<MaterialPreset, string> = {
  matte: "Matte",
  metallic: "Metallic",
  glossy: "Glossy",
  holographic: "Holographic",
};

/* ------------------------------------------------------------------ */
/*  Heatmap — single InstancedMesh (1 draw call instead of 91)        */
/* ------------------------------------------------------------------ */

function HeatmapInstanced() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const cellSize = 0.065;
  const gap = 0.015;
  const stride = cellSize + gap;
  const weeks = 13;
  const days = 7;
  const count = weeks * days;

  const colors = useMemo(
    () => [
      new THREE.Color("#13141E"),
      new THREE.Color("#3D2A0E"),
      new THREE.Color("#7A5518"),
      new THREE.Color("#5E4FCC"),
      new THREE.Color("#7C6AEF"),
    ],
    []
  );

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const colorArr = new Float32Array(count * 3);

    let i = 0;
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < days; d++) {
        dummy.position.set(w * stride, (6 - d) * stride, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);

        const seed = (w * 7 + d * 13 + 42) % 100;
        const level =
          seed < 25 ? 0 : seed < 50 ? 1 : seed < 75 ? 2 : seed < 90 ? 3 : 4;
        const c = colors[level];
        colorArr[i * 3] = c.r;
        colorArr[i * 3 + 1] = c.g;
        colorArr[i * 3 + 2] = c.b;
        i++;
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute(
      "color",
      new THREE.InstancedBufferAttribute(colorArr, 3)
    );
  }, [colors, stride]);

  return (
    <group position={[-1.65, -0.55, 0.05]}>
      <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[cellSize, cellSize, 0.01]} />
        <meshStandardMaterial vertexColors toneMapped={false} />
      </instancedMesh>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated Score Text                                                */
/* ------------------------------------------------------------------ */

function ScoreText() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const pulse = 1 + Math.sin(clock.elapsedTime * 2) * 0.02;
      meshRef.current.scale.set(pulse, pulse, 1);
    }
  });

  return (
    <Text
      ref={meshRef}
      position={[0.8, 0.05, 0.06]}
      fontSize={0.6}
      color="#7C6AEF"
      anchorX="center"
      anchorY="middle"
    >
      87
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/*  Badge Card                                                         */
/* ------------------------------------------------------------------ */

function BadgeCard({ preset }: { preset: MaterialPreset }) {
  const config = MATERIAL_PRESETS[preset];
  const isPhysical = preset === "holographic";

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <group>
        {/* Card body */}
        <RoundedBox args={[4, 2.1, 0.08]} radius={0.1} smoothness={4}>
          {isPhysical ? (
            <meshPhysicalMaterial
              color="#13141E"
              metalness={config.metalness}
              roughness={config.roughness}
              emissive="#7C6AEF"
              emissiveIntensity={config.emissiveIntensity}
              iridescence={config.iridescence ?? 0}
              clearcoat={config.clearcoat ?? 0}
            />
          ) : (
            <meshStandardMaterial
              color="#13141E"
              metalness={config.metalness}
              roughness={config.roughness}
              emissive="#7C6AEF"
              emissiveIntensity={config.emissiveIntensity}
            />
          )}
        </RoundedBox>

        {/* Card border frame */}
        <RoundedBox
          args={[4.06, 2.16, 0.06]}
          radius={0.11}
          smoothness={4}
          position={[0, 0, -0.02]}
        >
          <meshStandardMaterial
            color="#7C6AEF"
            metalness={0.8}
            roughness={0.2}
            emissive="#7C6AEF"
            emissiveIntensity={0.15}
          />
        </RoundedBox>

        {/* Key text only — handle, score, tier (3 Text instead of 8) */}
        <Text
          position={[-1.7, 0.75, 0.06]}
          fontSize={0.15}
          color="#E6EDF3"
          anchorX="left"
          anchorY="middle"
        >
          @juan294
        </Text>

        <ScoreText />

        <Text
          position={[0.8, 0.5, 0.06]}
          fontSize={0.13}
          color="#7C6AEF"
          anchorX="center"
          anchorY="middle"
        >
          Elite
        </Text>

        {/* Stats as a single Text line */}
        <Text
          position={[0, -0.85, 0.06]}
          fontSize={0.09}
          color="#9AA4B2"
          anchorX="center"
          anchorY="middle"
        >
          1.2k stars · 89 forks · 34 watchers
        </Text>

        {/* Heatmap — single instanced mesh */}
        <HeatmapInstanced />
      </group>
    </Float>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported Scene                                                     */
/* ------------------------------------------------------------------ */

export default function Badge3DScene() {
  const [preset, setPreset] = useState<MaterialPreset>("metallic");
  const [autoRotate, setAutoRotate] = useState(true);
  const [canvasKey, setCanvasKey] = useState(0);

  const webGLSupported = useMemo(() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      return false;
    }
  }, []);

  if (!webGLSupported) {
    return (
      <div className="flex h-[600px] w-full items-center justify-center rounded-2xl border border-warm-stroke bg-warm-card/50">
        <p className="font-heading text-xl font-bold text-text-primary">
          WebGL Not Available
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="relative h-[600px] w-full overflow-hidden rounded-2xl border border-warm-stroke bg-warm-card/50">
        <Canvas
          key={canvasKey}
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: "default",
            failIfMajorPerformanceCaveat: false,
          }}
          onCreated={({ gl }) => {
            gl.domElement.addEventListener("webglcontextlost", (e) => {
              e.preventDefault();
            });
            gl.domElement.addEventListener("webglcontextrestored", () => {
              setCanvasKey((k) => k + 1);
            });
          }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight
            position={[5, 5, 5]}
            intensity={0.8}
            color="#9D8FFF"
          />
          <pointLight position={[-3, 2, 4]} intensity={0.5} color="#7C6AEF" />
          <hemisphereLight
            intensity={0.3}
            color="#9D8FFF"
            groundColor="#13141E"
          />

          <BadgeCard preset={preset} />

          <OrbitControls
            enableZoom
            enablePan={false}
            minDistance={3}
            maxDistance={8}
            autoRotate={autoRotate}
            autoRotateSpeed={1}
          />
        </Canvas>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-secondary">
            Material:
          </span>
          {(Object.keys(MATERIAL_PRESETS) as MaterialPreset[]).map((key) => (
            <button
              key={key}
              onClick={() => setPreset(key)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                preset === key
                  ? "bg-amber text-warm-bg shadow-lg shadow-amber/25"
                  : "border border-warm-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
              }`}
            >
              {PRESET_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="h-6 w-px bg-warm-stroke" aria-hidden="true" />

        <button
          onClick={() => setAutoRotate((v) => !v)}
          className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
            autoRotate
              ? "bg-amber/10 text-amber border border-amber/20"
              : "border border-warm-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
          }`}
        >
          {autoRotate ? "Auto-Rotate: On" : "Auto-Rotate: Off"}
        </button>

        <button
          onClick={() => setCanvasKey((k) => k + 1)}
          className="rounded-full border border-warm-stroke px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
