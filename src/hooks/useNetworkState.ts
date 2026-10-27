import { useState, useEffect, useCallback } from 'react'
import {
  defaultNetworkManager,
  type NetworkState,
  type NetworkSnapshot,
} from '../services/networkManager'

export interface UseNetworkStateReturn {
  state: NetworkState
  latencyMs: number
  retryAttempts: number
  maxRetries: number
  countdownSec: number
  isBrowserOnline: boolean
  lastConnectedTimestamp: number | null
  reconnectNow: () => void
  recordLatency: (ms: number) => number
}

export function useNetworkState(): UseNetworkStateReturn {
  const [snapshot, setSnapshot] = useState<NetworkSnapshot>(() =>
    defaultNetworkManager.getSnapshot()
  )

  useEffect(() => {
    return defaultNetworkManager.subscribe((updated) => {
      setSnapshot(updated)
    })
  }, [])

  const reconnectNow = useCallback(() => {
    defaultNetworkManager.reconnectNow()
  }, [])

  const recordLatency = useCallback((ms: number) => {
    return defaultNetworkManager.recordLatency(ms)
  }, [])

  return {
    state: snapshot.state,
    latencyMs: snapshot.latencyMs,
    retryAttempts: snapshot.retryAttempts,
    maxRetries: snapshot.maxRetries,
    countdownSec: snapshot.countdownSec,
    isBrowserOnline: snapshot.isBrowserOnline,
    lastConnectedTimestamp: snapshot.lastConnectedTimestamp,
    reconnectNow,
    recordLatency,
  }
}
