import { useEffect, useState } from "react";
import Loading from "./Loading";

/**
 * Full-screen animated loading overlay.
 *
 * - Shows ONLY once on the initial mount — i.e. a real page refresh/reload.
 * - Does NOT re-show when navigating between tabs/pages, so tag-to-tag
 *   navigation stays instant with no loading flash.
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
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);

  // Show the overlay only on the very first mount (page refresh).
  // Route changes (tag-to-tag navigation) must NOT show it again.
  useEffect(() => {
    let fadeTimer = null;

    const showTimer = window.setTimeout(() => {
      setFading(true);
      fadeTimer = window.setTimeout(() => {
        setVisible(false);
        setFading(false);
      }, 260); // match overlay fade-out duration
    }, minMs);

    return () => {
      window.clearTimeout(showTimer);
      if (fadeTimer) window.clearTimeout(fadeTimer);
    };
  }, [minMs]);

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