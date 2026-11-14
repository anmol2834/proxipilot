# ProxiPilot — Scroll Animation System & Primitives Guide

This document specifies the lightweight, high-performance scroll animation system built for the **ProxiPilot Landing Page**.

---

## 1. Core Principles

1. **Zero Scroll Listeners**: No continuous `window.addEventListener('scroll', ...)` loops that trigger expensive React state updates or layout recalculations.
2. **IntersectionObserver Native Hooks**: Uses browser-native `IntersectionObserver` via [`useInView`](file:///src/lib/animations/useInView.ts).
3. **One-Time Triggers**: Elements observe until intersecting, set their active state once, and immediately disconnect (`triggerOnce: true` by default) to free browser resources.
4. **Transform & Opacity Only**: All animations modify exclusively `transform` and `opacity`. Layout properties (`width`, `height`, `top`, `left`, `margin`, `padding`) are strictly forbidden in animation definitions.
5. **Hardware Acceleration**: Elements use CSS `will-change: opacity, transform` and run on the GPU compositing layer without main-thread jank.
6. **Strict Accessibility (Reduced Motion)**: Full support for `prefers-reduced-motion: reduce` using React 19's `useSyncExternalStore` and CSS overrides.

---

## 2. Animation Primitives

Located in `src/components/landing/animations/`:

### `<FadeUp>`

- **Behavior**: Translates up by `24px` and transitions from `opacity: 0` to `opacity: 1` over `600ms`.
- **Props**:
  - `delayMs` (optional): Delay before transition starts (useful for sequence timing).
  - `className` (optional): Custom CSS class extensions.
- **Example Usage**:
  ```tsx
  <FadeUp delayMs={200}>
    <h2>Evidence-Gated RAG Generation</h2>
  </FadeUp>
  ```

### `<FadeIn>`

- **Behavior**: Pure opacity transition from `0` to `1` over `500ms`.
- **Example Usage**:
  ```tsx
  <FadeIn delayMs={100}>
    <TrustStripLogos />
  </FadeIn>
  ```

### `<ScaleIn>`

- **Behavior**: Scales from `0.96` to `1.0` with opacity reveal over `600ms`.
- **Example Usage**:
  ```tsx
  <ScaleIn delayMs={300}>
    <ProductCockpitMockup />
  </ScaleIn>
  ```

### `<Stagger>`

- **Behavior**: Container component that applies an automated sequential transition delay (`80ms * index`) to immediate child elements up to 12 items.
- **Example Usage**:
  ```tsx
  <Stagger>
    <FeatureCard title="Zero Hallucinations" />
    <FeatureCard title="Multi-Turn Threads" />
    <FeatureCard title="Model Routing" />
  </Stagger>
  ```

---

## 3. Reduced Motion Support

When a visitor has enabled "Reduce Motion" in their operating system:

1. **CSS Layer**:
   ```scss
   @media (prefers-reduced-motion: reduce) {
     .anim-fade-up,
     .anim-fade-in,
     .anim-scale-in,
     .anim-slide-left,
     .anim-slide-right,
     .anim-stagger > * {
       opacity: 1 !important;
       transform: none !important;
       transition: none !important;
     }
   }
   ```
2. **React Hook**:
   [`useReducedMotion()`](file:///src/lib/animations/useReducedMotion.ts) utilizes `useSyncExternalStore` to immediately return `true`, allowing dynamic components to skip procedural animations without cascading renders.

---

## 4. Guidelines for Section Visual Mockups

When implementing future visual mockups from reference images:

- Do NOT animate entire giant SVG trees simultaneously.
- Animate high-level cards or visual nodes as unified composited layers.
- Avoid persistent infinite looping animations unless strictly subtle (e.g. ambient gradient pulse).
