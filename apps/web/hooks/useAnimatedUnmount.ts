import { useReducer, useEffect } from "react";

type State = {
  shouldRender: boolean;
  isAnimatingOut: boolean;
};

type Action = "open" | "start_exit" | "unmounted";

function reducer(state: State, action: Action): State {
  if (action === "open") return { shouldRender: true, isAnimatingOut: false };
  if (action === "start_exit") return { shouldRender: true, isAnimatingOut: true };
  if (action === "unmounted") return { shouldRender: false, isAnimatingOut: false };
  return state;
}

/**
 * Delays unmounting until an exit animation completes.
 *
 * @param isOpen - The logical open/closed state from the parent
 * @param duration - Exit animation duration in ms (default: 200)
 * @returns { shouldRender, isAnimatingOut }
 *   - shouldRender: true while the component should be in the DOM
 *   - isAnimatingOut: true during the exit phase (apply exit animation classes)
 */
export function useAnimatedUnmount(isOpen: boolean, duration = 200) {
  const [{ shouldRender, isAnimatingOut }, dispatch] = useReducer(reducer, {
    shouldRender: isOpen,
    isAnimatingOut: false,
  });

  useEffect(() => {
    if (isOpen) {
      dispatch("open");
    } else if (shouldRender) {
      dispatch("start_exit");
      const timer = setTimeout(() => {
        dispatch("unmounted");
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, shouldRender]);

  return { shouldRender, isAnimatingOut };
}
