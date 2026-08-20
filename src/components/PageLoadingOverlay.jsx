import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import Loading from "./Loading";

/**
 * Full-screen animated loading overlay.
 *
 * - Shows briefly on every page refresh (initial mount).
 * - Re-shows briefly whenever the route changes (tag-to-tag navigation),
 *   giving the user a clear loading transition.
 * - Fades out smoothly via CSS transition.
 *
 * Usage: wrap once around <Routes> in App.jsx
 *   <PageLoadingOverlay minMs={300}>
 *     <Routes>...</Routes>
 *   </PageLoadingOverlay>
 */
export default function PageLoadingOverlay({
  children,
  minMs = 300,
  text = "Loading...",
}) {
  const location = useLocation();
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  // skip the very first effect run if pathname effect below handles it
  const firstRenderRef = useRef(true);

  const hide = useCallback(() => {
    setFading(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      setFading(false);
    }, 260); // match overlay fade-out duration
    return () => window.clearTimeout(t);
  }, []);

  // Re-show overlay whenever the route changes (also fires on mount = refresh)
  useEffect(() => {
    if (firstRenderRef.current) {
      firstRenderRef.current = false;
    } else {
      setVisible(true);
      setFading(false);
    }

    const showTimer = window.setTimeout(hide, minMs);

    return () => window.clearTimeout(showTimer);
  }, [location.pathname, minMs, hide]);

  if (!visible) return children;

  return (
    <>
      {children}
      <div
        className={`page-loading-overlay ${fading ? "page-loading-overlay-fade" : ""}`}
        aria-hidden="true"
      >
        <Loading text={text} size={44} />
      </div>
    </>
  );
}