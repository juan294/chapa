"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type EasingFn = (t: number) => number;

export const easings: { linear: EasingFn; easeOut: EasingFn; easeInOut: EasingFn; spring: EasingFn; [key: string]: EasingFn } = {
  linear: (t) => t,
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeInOut: (t) =>
    t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  spring: (t) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0
      ? 0
      : t === 1
        ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

export function useAnimatedCounter(
  target: number,
  duration: number = 2000,
  easing: string = "easeOut",
  startOnMount: boolean = false,
) {
  const [value, setValue] = useState(startOnMount ? 0 : target);
  const [isAnimating, setIsAnimating] = useState(false);
  const rafRef = useRef<number>(0);
  const prefersReducedMotion = useRef(false);
  const mountedRef = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
  }, []);

  const runAnimation = useCallback(
    (t: number, dur: number, ease: string) => {
      cancelAnimationFrame(rafRef.current);

      if (prefersReducedMotion.current) {
        setValue(t);
        return;
      }

      setIsAnimating(true);
      setValue(0);
      const start = performance.now();
      const easeFn = easings[ease] ?? easings["easeOut"]!;

      const frame = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / dur, 1);
        const easedProgress = easeFn(progress);
        setValue(Math.round(easedProgress * t));

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(frame);
        } else {
          setValue(t);
          setIsAnimating(false);
        }
      };

      rafRef.current = requestAnimationFrame(frame);
    },
    [],
  );

  const animate = useCallback(() => {
    runAnimation(target, duration, easing);
  }, [runAnimation, target, duration, easing]);

  useEffect(() => {
    if (startOnMount && !mountedRef.current) {
      mountedRef.current = true;
      const id = requestAnimationFrame(() => {
        runAnimation(target, duration, easing);
      });
      return () => cancelAnimationFrame(id);
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { value, isAnimating, animate };
}
