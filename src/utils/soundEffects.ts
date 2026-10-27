/**
 * Zero-dependency Financial Web Audio Sound Synthesizer
 * Generates tactile, institutional trading sounds natively using Web Audio API
 */

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

let isMuted = false

export function getSoundEnabled(): boolean {
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('finora_sound_enabled')
    if (stored !== null) return stored === 'true'
  }
  return !isMuted
}

export function setSoundEnabled(enabled: boolean): void {
  isMuted = !enabled
  if (typeof window !== 'undefined') {
    localStorage.setItem('finora_sound_enabled', enabled ? 'true' : 'false')
  }
}

/**
 * Order Filled sound: clean, positive dual-tone chime (880Hz -> 1320Hz)
 */
export function playOrderFilledSound(): void {
  if (!getSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const gain = ctx.createGain()

  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(880, now) // A5
  osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12) // E6

  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(1320, now + 0.06)

  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.12, now + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)

  osc1.connect(gain)
  osc2.connect(gain)
  gain.connect(ctx.destination)

  osc1.start(now)
  osc2.start(now + 0.06)
  osc1.stop(now + 0.28)
  osc2.stop(now + 0.28)
}

/**
 * Take Profit Hit: uplifting, triumphant triad arpeggio (C6, E6, G6)
 */
export function playTakeProfitSound(): void {
  if (!getSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const notes = [1046.50, 1318.51, 1567.98] // C6, E6, G6

  notes.forEach((freq, idx) => {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    const start = now + idx * 0.07

    osc.type = 'sine'
    osc.frequency.setValueAtTime(freq, start)

    gain.gain.setValueAtTime(0.001, start)
    gain.gain.linearRampToValueAtTime(0.1, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)

    osc.connect(gain)
    gain.connect(ctx.destination)

    osc.start(start)
    osc.stop(start + 0.3)
  })
}

/**
 * Stop Loss Hit: gentle warning thud (low-pass damped tone)
 */
export function playStopLossSound(): void {
  if (!getSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(260, now)
  osc.frequency.exponentialRampToValueAtTime(140, now + 0.22)

  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.14, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.25)
}

/**
 * Price Alert Trigger: crystal clear bell ring
 */
export function playAlertPingSound(): void {
  if (!getSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(1760, now) // A6
  osc.frequency.exponentialRampToValueAtTime(2200, now + 0.08)

  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.15, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.45)
}

/**
 * Micro tactile click for button navigation
 */
export function playClickSound(): void {
  if (!getSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(800, now)
  osc.frequency.exponentialRampToValueAtTime(400, now + 0.04)

  gain.gain.setValueAtTime(0.04, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.04)
}

/**
 * Connection Restored: crisp rising dual-tone chime (523Hz -> 659Hz, C5 -> E5)
 */
export function playNetworkRestoredSound(): void {
  if (!getSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const gain = ctx.createGain()

  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(523.25, now)
  osc1.frequency.exponentialRampToValueAtTime(659.25, now + 0.15)

  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(659.25, now + 0.08)

  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.08, now + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)

  osc1.connect(gain)
  osc2.connect(gain)
  gain.connect(ctx.destination)

  osc1.start(now)
  osc2.start(now + 0.08)
  osc1.stop(now + 0.3)
  osc2.stop(now + 0.3)
}

/**
 * Connection Lost: gentle low-frequency descending warning tone
 */
export function playNetworkLostSound(): void {
  if (!getSoundEnabled()) return
  const ctx = getAudioContext()
  if (!ctx) return

  const now = ctx.currentTime
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(440, now)
  osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.22)

  gain.gain.setValueAtTime(0.001, now)
  gain.gain.linearRampToValueAtTime(0.1, now + 0.03)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28)

  osc.connect(gain)
  gain.connect(ctx.destination)

  osc.start(now)
  osc.stop(now + 0.28)
}

