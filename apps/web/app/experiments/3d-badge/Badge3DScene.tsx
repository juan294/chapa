"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  OrbitControls,
  RoundedBox,
  Text,
  Environment,
  Float,
} from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import * as THREE from "three";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Generate deterministic heatmap intensity grid (13 weeks x 7 days). */
function generateHeatmapData(): number[][] {
  const weeks = 13;
  const days = 7;
  const data: number[][] = [];
  for (let w = 0; w < weeks; w++) {
    const week: number[] = [];
    for (let d = 0; d < days; d++) {
      const seed = (w * 7 + d * 13 + 42) % 100;
      week.push(
        seed < 25 ? 0 : seed < 50 ? 1 : seed < 75 ? 2 : seed < 90 ? 3 : 4
      );
    }
    data.push(week);
  }
  return data;
}

/** Check WebGL support synchronously (safe on client). */
function checkWebGLSupport(): boolean {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
    return gl != null;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type MaterialPreset = "matte" | "metallic" | "glossy" | "holographic";

interface MaterialConfig {
  metalness: number;
  roughness: number;
  color: string;
  emissiveIntensity: number;
  iridescence?: number;
  clearcoat?: number;
  clearcoatRoughness?: number;
}

const MATERIAL_PRESETS: Record<MaterialPreset, MaterialConfig> = {
  matte: {
    metalness: 0.1,
    roughness: 0.9,
    color: "#1A1610",
    emissiveIntensity: 0,
  },
  metallic: {
    metalness: 0.7,
    roughness: 0.3,
    color: "#1A1610",
    emissiveIntensity: 0.05,
  },
  glossy: {
    metalness: 0.9,
    roughness: 0.1,
    color: "#1A1610",
    emissiveIntensity: 0.08,
  },
  holographic: {
    metalness: 0.5,
    roughness: 0.15,
    color: "#1A1610",
    emissiveIntensity: 0.12,
    iridescence: 1,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  },
};

const PRESET_LABELS: Record<MaterialPreset, string> = {
  matte: "Matte",
  metallic: "Metallic",
  glossy: "Glossy",
  holographic: "Holographic",
};

/* ------------------------------------------------------------------ */
/*  Heatmap Grid                                                       */
/* ------------------------------------------------------------------ */

function HeatmapGrid() {
  const cellSize = 0.065;
  const gap = 0.015;
  const startX = -1.65;
  const startY = -0.55;

  const intensities = useMemo(() => generateHeatmapData(), []);

  const colors = ["#1A1610", "#3D2A0E", "#7A5518", "#C28A2E", "#E2A84B"];

  return (
    <group position={[startX, startY, 0.05]}>
      {intensities.map((week, w) =>
        week.map((intensity, d) => (
          <mesh
            key={`${w}-${d}`}
            position={[w * (cellSize + gap), (6 - d) * (cellSize + gap), 0]}
          >
            <boxGeometry args={[cellSize, cellSize, 0.01]} />
            <meshStandardMaterial
              color={colors[intensity]}
              emissive={colors[intensity]}
              emissiveIntensity={intensity > 2 ? 0.3 : 0}
            />
          </mesh>
        ))
      )}
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Pill                                                          */
/* ------------------------------------------------------------------ */

function StatPill({
  position,
  label,
  value,
}: {
  position: [number, number, number];
  label: string;
  value: string;
}) {
  return (
    <group position={position}>
      <Text fontSize={0.08} color="#9AA4B2" anchorX="left" anchorY="middle">
        {label}
      </Text>
      <Text
        position={[0, -0.12, 0]}
        fontSize={0.11}
        color="#E6EDF3"
        anchorX="left"
        anchorY="middle"
      >
        {value}
      </Text>
    </group>
  );
}

/* ------------------------------------------------------------------ */
/*  Badge Card (3D object)                                             */
/* ------------------------------------------------------------------ */

function BadgeCard({ preset }: { preset: MaterialPreset }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const config = MATERIAL_PRESETS[preset];

  const isPhysical = preset === "holographic";

  return (
    <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
      <group>
        {/* Card body */}
        <RoundedBox
          args={[4, 2.1, 0.08]}
          radius={0.1}
          smoothness={4}
          ref={meshRef}
        >
          {isPhysical ? (
            <meshPhysicalMaterial
              color={config.color}
              metalness={config.metalness}
              roughness={config.roughness}
              emissive="#E2A84B"
              emissiveIntensity={config.emissiveIntensity}
              iridescence={config.iridescence ?? 0}
              clearcoat={config.clearcoat ?? 0}
              clearcoatRoughness={config.clearcoatRoughness ?? 0}
            />
          ) : (
            <meshStandardMaterial
              color={config.color}
              metalness={config.metalness}
              roughness={config.roughness}
              emissive="#E2A84B"
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
            color="#E2A84B"
            metalness={0.8}
            roughness={0.2}
            emissive="#E2A84B"
            emissiveIntensity={0.15}
          />
        </RoundedBox>

        {/* ---- Text content ---- */}

        {/* Handle */}
        <Text
          position={[-1.7, 0.8, 0.06]}
          fontSize={0.15}
          color="#E6EDF3"
          anchorX="left"
          anchorY="middle"
        >
          @juan294
        </Text>

        {/* "Impact Score" label */}
        <Text
          position={[-1.7, 0.55, 0.06]}
          fontSize={0.09}
          color="#9AA4B2"
          anchorX="left"
          anchorY="middle"
        >
          IMPACT SCORE
        </Text>

        {/* Score */}
        <ScoreText />

        {/* Tier label */}
        <Text
          position={[0.8, 0.55, 0.06]}
          fontSize={0.12}
          color="#E2A84B"
          anchorX="center"
          anchorY="middle"
        >
          Elite
        </Text>

        {/* Confidence */}
        <Text
          position={[0.8, -0.55, 0.06]}
          fontSize={0.09}
          color="#9AA4B2"
          anchorX="center"
          anchorY="middle"
        >
          95% confidence
        </Text>

        {/* Stats */}
        <StatPill position={[-1.7, -0.15, 0.06]} label="Commits" value="487" />
        <StatPill
          position={[-1.0, -0.15, 0.06]}
          label="PRs Merged"
          value="38"
        />
        <StatPill
          position={[-0.3, -0.15, 0.06]}
          label="Reviews"
          value="124"
        />

        {/* Heatmap */}
        <HeatmapGrid />
      </group>
    </Float>
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
      color="#E2A84B"
      anchorX="center"
      anchorY="middle"
    >
      87
    </Text>
  );
}

/* ------------------------------------------------------------------ */
/*  Reset Camera Helper                                                */
/* ------------------------------------------------------------------ */

function CameraResetter({ trigger }: { trigger: number }) {
  const { camera } = useThree();
  const initialPos = useRef(new THREE.Vector3(0, 0, 5));

  useEffect(() => {
    if (trigger > 0) {
      camera.position.copy(initialPos.current);
      camera.lookAt(0, 0, 0);
    }
  }, [trigger, camera]);

  return null;
}

/* ------------------------------------------------------------------ */
/*  FPS Counter                                                        */
/* ------------------------------------------------------------------ */

function FPSCounter({ onFPS }: { onFPS: (fps: number) => void }) {
  const frameCount = useRef(0);
  const lastTime = useRef(0);

  useEffect(() => {
    lastTime.current = performance.now();
  }, []);

  useFrame(() => {
    frameCount.current++;
    const now = performance.now();
    if (lastTime.current > 0 && now - lastTime.current >= 1000) {
      onFPS(frameCount.current);
      frameCount.current = 0;
      lastTime.current = now;
    }
  });

  return null;
}

/* ------------------------------------------------------------------ */
/*  Exported Scene Component                                           */
/* ------------------------------------------------------------------ */

export default function Badge3DScene() {
  const [preset, setPreset] = useState<MaterialPreset>("metallic");
  const [autoRotate, setAutoRotate] = useState(true);
  const [resetTrigger, setResetTrigger] = useState(0);
  const [fps, setFPS] = useState(0);

  // This component is only loaded client-side (ssr: false), so synchronous
  // check is safe and avoids the eslint set-state-in-effect warning.
  const webGLSupported = useMemo(() => checkWebGLSupport(), []);

  const handleFPS = useCallback((value: number) => {
    setFPS(value);
  }, []);

  if (!webGLSupported) {
    return (
      <div className="flex h-[600px] w-full items-center justify-center rounded-2xl border border-warm-stroke bg-warm-card/50">
        <div className="text-center">
          <p className="font-heading text-xl font-bold text-text-primary">
            WebGL Not Available
          </p>
          <p className="mt-2 text-text-secondary">
            Your browser does not support WebGL, which is required for the 3D
            badge viewer.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 3D Canvas */}
      <div className="relative h-[600px] w-full overflow-hidden rounded-2xl border border-warm-stroke bg-warm-card/50">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.4} />
          <directionalLight
            position={[5, 5, 5]}
            intensity={0.8}
            color="#F0C97D"
          />
          <pointLight position={[-3, 2, 4]} intensity={0.5} color="#E2A84B" />

          <BadgeCard preset={preset} />

          <OrbitControls
            enableZoom={true}
            enablePan={false}
            minDistance={3}
            maxDistance={8}
            autoRotate={autoRotate}
            autoRotateSpeed={1}
          />

          <Environment preset="city" />

          <EffectComposer>
            <Bloom
              luminanceThreshold={0.8}
              luminanceSmoothing={0.9}
              intensity={0.5}
            />
          </EffectComposer>

          <CameraResetter trigger={resetTrigger} />
          <FPSCounter onFPS={handleFPS} />
        </Canvas>

        {/* FPS overlay */}
        <div className="absolute right-3 top-3 rounded-lg border border-warm-stroke bg-warm-card/80 px-3 py-1.5 text-xs font-medium text-text-secondary backdrop-blur-sm">
          {fps} FPS
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Material presets */}
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

        {/* Divider */}
        <div className="h-6 w-px bg-warm-stroke" aria-hidden="true" />

        {/* Auto-rotate toggle */}
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

        {/* Reset view */}
        <button
          onClick={() => setResetTrigger((v) => v + 1)}
          className="rounded-full border border-warm-stroke px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:border-amber/20 hover:text-text-primary hover:bg-amber/[0.04]"
        >
          Reset View
        </button>
      </div>
    </div>
  );
}
