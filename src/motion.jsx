// motion.jsx — the motion layer.
//
// Design rules encoded here:
//   • Nothing animates that the OS has asked not to. Every hook checks
//     prefers-reduced-motion and degrades to the finished state.
//   • Nothing is hidden by an animation that cannot run. If
//     IntersectionObserver is missing (jsdom, very old browsers, a crawler
//     that executes some JS), content is revealed immediately rather than
//     staying at opacity 0 forever.
//   • No animation library. IntersectionObserver plus CSS keyframes costs
//     ~1.5 KB and keeps the 87 KB bundle budget intact.
//   • Transform and opacity only, so every animation stays on the
//     compositor and never triggers layout.

import {
  useCallback, useEffect, useMemo, useRef, useState,
} from "react";

const canObserve = () =>
  typeof window !== "undefined" && typeof window.IntersectionObserver === "function";

export function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
  } catch {
    return false;
  }
}

/**
 * Reveals `.reveal` descendants (and the container itself if it carries the
 * class) as they scroll into view, once each. Returns a ref to attach.
 *
 * rootMargin pulls the trigger 12% up from the bottom edge so an element
 * animates as it comes into comfortable reading position, not the instant
 * one pixel crosses the fold.
 */
export function useReveal({ threshold = 0.12, margin = "0px 0px -8% 0px" } = {}) {
  const ref = useRef(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return undefined;

    const collect = (node) => [
      ...(node.classList?.contains("reveal") ? [node] : []),
      ...(node.querySelectorAll?.(".reveal") ?? []),
    ];

    // No observer, or motion is unwelcome: show everything, now and later.
    if (!canObserve() || prefersReducedMotion()) {
      const showAll = () =>
        collect(root).forEach((el) => el.classList.add("is-in", "is-done"));
      showAll();
      if (typeof MutationObserver !== "function") return undefined;
      const mutations = new MutationObserver(showAll);
      mutations.observe(root, { childList: true, subtree: true });
      return () => mutations.disconnect();
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          // Drop will-change once the animation has had time to finish, so
          // long pages do not hold dozens of composited layers alive.
          window.setTimeout(() => entry.target.classList.add("is-done"), 1200);
          observer.unobserve(entry.target);
        });
      },
      { threshold, rootMargin: margin },
    );

    const watch = (node) =>
      collect(node).forEach((el) => {
        if (!el.classList.contains("is-in")) observer.observe(el);
      });

    watch(root);

    // A section whose content arrives asynchronously — the hero stat rail,
    // the rated-courses strip — mounts its `.reveal` children AFTER this
    // effect has run. Without watching for them they are observed by nothing
    // and stay at opacity 0 permanently: the animation silently eats the
    // content. This is the failure mode that makes scroll-reveal libraries
    // dangerous, so it is handled explicitly rather than assumed away.
    if (typeof MutationObserver !== "function") return () => observer.disconnect();
    const mutations = new MutationObserver((records) => {
      records.forEach((record) => {
        record.addedNodes.forEach((node) => {
          if (node.nodeType === 1) watch(node);
        });
      });
    });
    mutations.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [threshold, margin]);

  return ref;
}

/**
 * A single revealed block. `delay` is a stagger index, not milliseconds —
 * the CSS multiplies it by 70ms so rhythm stays consistent everywhere.
 * `as` lets a reveal be a <li>, <section> … without an extra wrapper div.
 */
export function Reveal({
  as: Tag = "div", anim = "up", delay = 0, className = "", style, children, ...rest
}) {
  return (
    <Tag
      className={`reveal ${className}`}
      data-anim={anim}
      style={{ "--i": delay, ...style }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/**
 * Counts from 0 to `to` once `active` becomes true. Eased, frame-budgeted,
 * and instant when motion is reduced (the final number is what matters).
 */
export function useCountUp(to, active, { duration = 1500 } = {}) {
  const target = Number(to) || 0;
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0));
  const done = useRef(false);

  useEffect(() => {
    if (!active || done.current) return undefined;
    if (prefersReducedMotion() || typeof window.requestAnimationFrame !== "function") {
      setValue(target);
      done.current = true;
      return undefined;
    }

    let frame = 0;
    let start = 0;
    const step = (now) => {
      if (!start) start = now;
      const progress = Math.min(1, (now - start) / duration);
      // easeOutExpo — fast commit, long settle. Reads as confident.
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setValue(Math.round(target * eased));
      if (progress < 1) frame = window.requestAnimationFrame(step);
      else done.current = true;
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [active, target, duration]);

  // A target that arrives late (async data) must not be stuck at a stale count.
  useEffect(() => {
    if (done.current) setValue(target);
  }, [target]);

  return value;
}

/** Fires once when the element first enters view — the trigger for counters. */
export function useInView({ threshold = 0.35 } = {}) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (!canObserve()) {
      setInView(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return [ref, inView];
}

/**
 * Publishes the pointer position as --mx/--my on the element, which the
 * `edge-glow` utility reads to light the card rim under the cursor.
 * Pointer-only: touch devices get no glow rather than a stuck highlight.
 */
export function usePointerGlow() {
  const ref = useRef(null);

  const onPointerMove = useCallback((event) => {
    const el = ref.current;
    if (!el || event.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }, []);

  return { ref, onPointerMove };
}

/**
 * Magnetic hover: the element leans a few pixels toward the cursor and
 * springs back on leave. `strength` is capped low on purpose — the brief
 * asked for subtle, and anything past ~8px starts to feel gimmicky.
 */
export function useMagnetic(strength = 6) {
  const ref = useRef(null);
  const reduced = useMemo(prefersReducedMotion, []);

  const onPointerMove = useCallback((event) => {
    const el = ref.current;
    if (!el || reduced || event.pointerType === "touch") return;
    const rect = el.getBoundingClientRect();
    const dx = (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    const dy = (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
    el.style.transform =
      `translate3d(${(dx * strength).toFixed(2)}px, ${(dy * strength * 0.6).toFixed(2)}px, 0)`;
  }, [reduced, strength]);

  const onPointerLeave = useCallback(() => {
    const el = ref.current;
    if (el) el.style.transform = "";
  }, []);

  return { ref, onPointerMove, onPointerLeave };
}

/**
 * Parallax drift for decorative layers. Reads scroll on rAF, writes a
 * transform, and never touches layout. `speed` is a fraction of scroll
 * distance; keep it under 0.2 or the page starts to feel seasick.
 */
export function useParallax(speed = 0.12) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return undefined;
    if (typeof window.requestAnimationFrame !== "function") return undefined;

    let frame = 0;
    let ticking = false;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * -speed;
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`;
      ticking = false;
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      frame = window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      window.cancelAnimationFrame(frame);
    };
  }, [speed]);

  return ref;
}

/**
 * A very slow drift of the aurora layer with the pointer, so the hero feels
 * responsive without anything visibly "following the mouse". Attached to a
 * container; writes --px/--py as 0–1 fractions.
 */
export function usePointerAmbience() {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || prefersReducedMotion()) return undefined;
    if (!window.matchMedia?.("(hover: hover)")?.matches) return undefined;

    let frame = 0;
    const onMove = (event) => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        el.style.setProperty("--px", (event.clientX / window.innerWidth).toFixed(3));
        el.style.setProperty("--py", (event.clientY / window.innerHeight).toFixed(3));
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.cancelAnimationFrame(frame);
    };
  }, []);

  return ref;
}
