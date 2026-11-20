import { useCallback, useEffect, useState } from "react";
import teamApi from "../services/teamApi";
import type { BackendHealthState } from "../types";

const INITIAL_STATE: BackendHealthState = {
  loading: true,
  apiReachable: false,
  healthStatus: null,
  moduleStatus: null,
  error: null,
  lastCheckedAt: null,
};

async function queryBackendHealth(): Promise<BackendHealthState> {
  const checkedAt = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  try {
    const [health, moduleStatus] = await Promise.all([
      teamApi.getHealth(),
      teamApi.getModuleStatus(),
    ]);

    return {
      loading: false,
      apiReachable: true,
      healthStatus: health.status,
      moduleStatus,
      error: null,
      lastCheckedAt: checkedAt,
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.message
        : "Unable to reach the FastAPI backend service.";

    return {
      loading: false,
      apiReachable: false,
      healthStatus: null,
      moduleStatus: null,
      error: message,
      lastCheckedAt: checkedAt,
    };
  }
}

export function useBackendHealth() {
  const [state, setState] = useState<BackendHealthState>(INITIAL_STATE);

  useEffect(() => {
    let active = true;

    void queryBackendHealth().then((nextState) => {
      if (active) {
        setState(nextState);
      }
    });

    return () => {
      active = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    const nextState = await queryBackendHealth();
    setState(nextState);
  }, []);

  return {
    ...state,
    refresh,
  };
}
