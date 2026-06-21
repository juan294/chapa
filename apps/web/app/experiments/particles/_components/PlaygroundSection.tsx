"use client";

import { useState } from "react";
import { type ParticleConfig } from "./particle-core";
import { ParticleCanvas } from "./ParticleCanvas";
import { ToggleSwitch } from "./controls";

/* ------------------------------------------------------------------ */
/*  Interactive Playground                                             */
/* ------------------------------------------------------------------ */

type ColorPreset = "amber" | "gold" | "mixed";

const COLOR_PRESETS: Record<ColorPreset, string[]> = {
  amber: ["#8B5CF6"],
  gold: ["#A78BFA", "#8B5CF6"],
  mixed: ["#8B5CF6", "#A78BFA", "#7C3AED"],
};

export function PlaygroundSection() {
  const [count, setCount] = useState(50);
  const [speed, setSpeed] = useState(0.4);
  const [minRadius, setMinRadius] = useState(1);
  const [maxRadius, setMaxRadius] = useState(3);
  const [connections, setConnections] = useState(false);
  const [mouseRepulsion, setMouseRepulsion] = useState(true);
  const [colorPreset, setColorPreset] = useState<ColorPreset>("mixed");

  // Build config from state -- use a stable reference via JSON key
  const config: ParticleConfig = {
    count,
    colors: COLOR_PRESETS[colorPreset],
    minRadius,
    maxRadius,
    speed,
    minOpacity: 0.1,
    maxOpacity: 0.4,
    connections,
    connectionDistance: 150,
    mouseRepulsion,
    mouseRadius: 120,
    sparkle: false,
  };

  // We need to remount the canvas when config changes to reinit particles.
  // Use a key derived from config values.
  const configKey = `${count}-${speed}-${minRadius}-${maxRadius}-${connections}-${mouseRepulsion}-${colorPreset}`;

  return (
    <section className="rounded-2xl border border-stroke bg-card/50 overflow-hidden">
      <div className="p-6 border-b border-stroke">
        <h2 className="text-lg font-bold font-heading text-text-primary tracking-tight mb-1">
          Interactive Playground
        </h2>
        <p className="text-text-secondary text-sm leading-relaxed">
          Tweak the parameters and interact with the canvas. Move your mouse
          over the particles.
        </p>
      </div>

      {/* Controls */}
      <div className="p-6 border-b border-stroke bg-card/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Particle count */}
          <div>
            <label
              htmlFor="pg-count"
              className="block text-text-secondary text-sm mb-2"
            >
              Particles:{" "}
              <span className="text-amber font-semibold">{count}</span>
            </label>
            <input
              id="pg-count"
              type="range"
              min={10}
              max={150}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className="w-full accent-amber"
            />
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>10</span>
              <span>150</span>
            </div>
          </div>

          {/* Speed */}
          <div>
            <label
              htmlFor="pg-speed"
              className="block text-text-secondary text-sm mb-2"
            >
              Speed:{" "}
              <span className="text-amber font-semibold">
                {speed.toFixed(1)}
              </span>
            </label>
            <input
              id="pg-speed"
              type="range"
              min={0.1}
              max={1.0}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-full accent-amber"
            />
            <div className="flex justify-between text-xs text-text-secondary mt-1">
              <span>0.1</span>
              <span>1.0</span>
            </div>
          </div>

          {/* Min/Max Radius */}
          <div>
            <label
              htmlFor="pg-min-radius"
              className="block text-text-secondary text-sm mb-2"
            >
              Size:{" "}
              <span className="text-amber font-semibold">
                {minRadius}-{maxRadius}px
              </span>
            </label>
            <div className="flex gap-2">
              <input
                id="pg-min-radius"
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={minRadius}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMinRadius(v);
                  if (v > maxRadius) setMaxRadius(v);
                }}
                className="w-full accent-amber"
              />
              <input
                type="range"
                min={0.5}
                max={8}
                step={0.5}
                value={maxRadius}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMaxRadius(v);
                  if (v < minRadius) setMinRadius(v);
                }}
                className="w-full accent-amber"
                aria-label="Max radius"
              />
            </div>
          </div>

          {/* Color preset */}
          <div>
            <p className="text-text-secondary text-sm mb-2">Color Preset</p>
            <div className="flex gap-2">
              {(["amber", "gold", "mixed"] as ColorPreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setColorPreset(p)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                    colorPreset === p
                      ? "bg-amber text-white"
                      : "border border-stroke text-text-secondary hover:border-amber/20 hover:text-text-primary"
                  }`}
                >
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-col gap-3">
            <ToggleSwitch
              id="pg-connections"
              label="Connections"
              checked={connections}
              onChange={setConnections}
            />
            <ToggleSwitch
              id="pg-mouse"
              label="Mouse Repulsion"
              checked={mouseRepulsion}
              onChange={setMouseRepulsion}
            />
          </div>
        </div>
      </div>

      {/* Canvas */}
      <ParticleCanvas key={configKey} config={config} height="h-[460px]" />
    </section>
  );
}
