const MUTE_STORAGE_KEY = 'olivia_splash_sound_muted_v1';

let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new Ctx();
  }
  return sharedAudioCtx;
}

export function getSplashSoundMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setSplashSoundMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, muted ? '1' : '0');
  } catch {
    // Ignorar errores de almacenamiento
  }
}

/**
 * Genera un acorde cálido y cristalino con Web Audio API (0 KB, funciona offline).
 * En móviles, los navegadores pueden suspender el audio hasta el primer toque;
 * por eso intenta sonar en 'reveal' sin errores y garantiza el sonido en 'enter'.
 */
export async function playWarmCoffeeChime(
  variant: 'reveal' | 'enter',
  muted = false
): Promise<void> {
  if (muted) return;
  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (ctx.state !== 'running') return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    if (variant === 'reveal') {
      // Acorde cálido tipo Disney/Apple suave: C5 - E5 - G5 - B5
      const notes = [523.25, 659.25, 783.99, 987.77];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.085);

        const startAt = now + idx * 0.085;
        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(0.045 / (idx * 0.3 + 1), startAt + 0.04);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 1.05);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(startAt);
        osc.stop(startAt + 1.1);
      });
    } else {
      // Campanita ascendente dorada al pulsar "Empezar": G5 -> D6
      const notes = [783.99, 1174.66];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'sine';
        const startAt = now + idx * 0.09;
        osc.frequency.setValueAtTime(freq, startAt);

        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(0.065, startAt + 0.025);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.72);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(startAt);
        osc.stop(startAt + 0.76);
      });
    }
  } catch {
    // Silenciar bloqueos de autoplay del navegador
  }
}
