/**
 * Reusable transition wrapper.
 * Uses React's `key` prop to force a fresh DOM element whenever
 * `transitionKey` changes — this guarantees the CSS entrance
 * animation restarts on every route/tab switch.
 */
export default function PageTransition({
  children,
  transitionKey,
  animation = "fade-up",
  className = "",
  ...props
}) {
  return (
    <div
      key={transitionKey}
      className={`page-transition page-${animation} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}