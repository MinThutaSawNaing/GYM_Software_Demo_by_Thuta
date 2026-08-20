import { useEffect, useState, useCallback, useRef } from "react";
import {
  ATTENDANCE_SCAN_CONTROL_STORAGE_KEY,
  getAttendanceScanControlStatus,
  readAttendanceScanControlLocal,
  saveAttendanceScanControlLocal,
} from "../api/attendanceApi";

/**
 * Global scanner state hook for Admin-controlled attendance scanning.
 *
 * - Only Admin can toggle scanning ON/OFF
 * - User and Trainer pages use this hook to respect the global state
 * - State is synchronized across tabs via localStorage + storage events
 * - Fails OPEN: defaults to ON if no localStorage value exists (for offline support)
 *
 * @returns {Object} {
 *   isScanningEnabled: boolean - whether admin has enabled scanning globally
 *   isLoading: boolean - whether we're fetching the initial state
 *   error: string|null - any error message
 *   refresh: function - manually refresh the scanner status
 *   setIsScanningEnabled: function - manually set scanner state (for admin use)
 * }
 */
export function useGlobalScanner() {
  // Initialize from localStorage immediately to avoid flicker
  const getInitialState = () => {
    const cached = readAttendanceScanControlLocal();
    // Default to ON if no cached value exists
    return cached ? !!cached.isActive : true;
  };

  const [isScanningEnabled, setIsScanningEnabledState] = useState(getInitialState);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastValueRef = useRef(isScanningEnabled);

  // Update state + localStorage ONLY when the value actually changed.
  // This avoids pointless localStorage writes / storage events on every
  // 3s poll tick and keeps React re-renders to a minimum.
  const applyValue = useCallback((value) => {
    const boolValue = !!value;
    if (lastValueRef.current === boolValue) return;
    lastValueRef.current = boolValue;
    setIsScanningEnabledState(boolValue);
    saveAttendanceScanControlLocal(boolValue);
  }, []);

  // Wrapper to update both state and localStorage
  const setIsScanningEnabled = useCallback((value) => {
    applyValue(value);
  }, [applyValue]);

  const refresh = useCallback(async () => {
    try {
      const result = await getAttendanceScanControlStatus();
      applyValue(!!result?.isActive);
      setError(null);
    } catch {
      // On API error, read from localStorage (set by admin panel)
      const cached = readAttendanceScanControlLocal();
      applyValue(cached ? !!cached.isActive : true);
      setError("Failed to load scanner status");
    }
  }, [applyValue]);

  useEffect(() => {
    let alive = true;

    const loadScanControl = async () => {
      try {
        const result = await getAttendanceScanControlStatus();
        if (!alive) return;
        applyValue(!!result?.isActive);
      } catch {
        if (!alive) return;
        // On API error, read from localStorage (set by admin panel)
        const cached = readAttendanceScanControlLocal();
        applyValue(cached ? !!cached.isActive : true);
      } finally {
        if (alive) setIsLoading(false);
      }
    };

    loadScanControl();

    // Poll every 3 seconds to sync with admin changes (faster sync).
    // Skip ticks while the tab is hidden to avoid pointless network churn.
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      loadScanControl();
    }, 3000);

    // Also refresh immediately when the user returns to the tab.
    const onFocus = () => {
      if (document.visibilityState === "visible") loadScanControl();
    };
    window.addEventListener("focus", onFocus);

    // Listen for storage events to sync across tabs
    const onStorage = (event) => {
      if (event.key !== ATTENDANCE_SCAN_CONTROL_STORAGE_KEY) return;
      try {
        const next = event.newValue ? JSON.parse(event.newValue) : null;
        applyValue(next ? !!next.isActive : true);
      } catch {
        applyValue(true);
      }
    };

    window.addEventListener("storage", onStorage);

    return () => {
      alive = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [applyValue]);

  return {
    isScanningEnabled,
    isLoading,
    error,
    refresh,
    setIsScanningEnabled,
  };
}

export default useGlobalScanner;
