/**
 * Animated loading indicator with a beautiful spinner + pulse.
 *
 * Usage:
 *   <Loading />
 *   <Loading size={48} text="Loading members..." />
 *   <Loading center />
 *   <Loading full />
 *   <Loading inline size={18} text="" />
 */
export default function Loading({
  size = 36,
  text = "Loading...",
  center = false,
  inline = false,
  full = false,
  className = "",
}) {
  const spinner = (
    <div
      className="page-loading-spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label={text}
    >
      <span className="page-loading-ring" />
      <span className="page-loading-ring page-loading-ring-2" />
      <span className="page-loading-ring page-loading-ring-3" />
      <span className="page-loading-core" />
    </div>
  );

  if (full) {
    return (
      <div className="page-loading-full">
        <div className="page-loading-center">
          {spinner}
          {text && <div className="page-loading-text">{text}</div>}
        </div>
      </div>
    );
  }

  if (inline) {
    return (
      <span
        className={`page-loading-inline ${className}`}
        style={{ width: size, height: size }}
        role="status"
        aria-label={text}
      >
        {spinner}
      </span>
    );
  }

  return (
    <div className={`page-loading ${center ? "page-loading-center" : ""} ${className}`}>
      {spinner}
      {text && <div className="page-loading-text">{text}</div>}
    </div>
  );
}