// Shared Motion presets (house style from the apple-design skill).
//
// Springs, not durations: every animation is interruptible and re-targets from
// the current on-screen value with its velocity, so motion never hits a "brick
// wall" when interrupted. `duration` here is the spring's *response* (how fast
// it settles), not a fixed animation length.
//
// Defaults are critically damped (Apple's damping 1.0): they settle without
// overshooting. Overshoot (`springMomentum`) is reserved for motion that was
// physically thrown — a flick, drag release or swipe — never for a menu or
// dialog that simply appears.
//
// All Motion usage runs under `<MotionConfig reducedMotion="user">` (root
// layout), so transform animations collapse to cross-fades automatically for
// `prefers-reduced-motion`.

import type { Transition, Variants } from "motion/react"

/** Default UI spring: critically damped, response ~0.4s. */
export const spring: Transition = { type: "spring", bounce: 0, duration: 0.4 }

/** Snappier settle for small UI (badges, tabs, inline confirmations). */
export const springSnappy: Transition = { type: "spring", bounce: 0, duration: 0.25 }

/** Momentum spring (damping ~0.8) — only after a flick/drag release. */
export const springMomentum: Transition = { type: "spring", bounce: 0.2, duration: 0.4 }

/** Opacity-only enter/exit pair — the reduced-motion-safe default. */
export const fade: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
}

/** Enter fading in and rising 8px — for lists, cards and step content. */
export const fadeRise: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
}
