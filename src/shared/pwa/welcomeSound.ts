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

export async function unlockAudioContext(): Promise<void> {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
  } catch {
    // Ignorar errores de desbloqueo de audio
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
      // Toque corto y limpio de "¡Listo!" al entrar al sistema: G5 -> E6 (~0.48 s)
      const notes = [783.99, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'sine';
        const startAt = now + idx * 0.085;
        osc.frequency.setValueAtTime(freq, startAt);

        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(idx === 0 ? 0.05 : 0.06, startAt + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.45);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(startAt);
        osc.stop(startAt + 0.48);
      });
    }
  } catch {
    // Silenciar bloqueos de autoplay del navegador
  }
}

export type StampSoundKind = 'stamp' | 'goal' | 'redeem' | 'pos_ok';

/**
 * Sonidos de confirmación en vivo al sellar, completar cartilla o canjear premio.
 * Respeta el silencio guardado por el usuario en localStorage.
 */
export async function playStampFeedbackSound(kind: StampSoundKind): Promise<void> {
  if (getSplashSoundMuted()) return;
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

    if (kind === 'pos_ok') {
      // Beep rápido de caja POS: A5 -> E6 (~0.24 s)
      const notes = [880, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'triangle';
        const startAt = now + idx * 0.065;
        osc.frequency.setValueAtTime(freq, startAt);

        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(0.065, startAt + 0.015);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.16);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(startAt);
        osc.stop(startAt + 0.18);
      });
      return;
    }

    if (kind === 'stamp') {
      // Tintineo alegre al sumar +1 sello: E5 -> G#5 -> B5
      const notes = [659.25, 830.61, 987.77];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = idx === 2 ? 'triangle' : 'sine';
        const startAt = now + idx * 0.075;
        osc.frequency.setValueAtTime(freq, startAt);

        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(0.06, startAt + 0.02);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.42);

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(startAt);
        osc.stop(startAt + 0.45);
      });
      return;
    }

    if (kind === 'goal') {
      // Fanfarria breve al completar la meta (10/10): C5 -> E5 -> G5 -> C6
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = idx === 3 ? 'triangle' : 'sine';
        const startAt = now + idx * 0.09;
        osc.frequency.setValueAtTime(freq, startAt);

        noteGain.gain.setValueAtTime(0.0001, startAt);
        noteGain.gain.exponentialRampToValueAtTime(idx === 3 ? 0.075 : 0.05, startAt + 0.025);
        noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + (idx === 3 ? 0.72 : 0.45));

        osc.connect(noteGain);
        noteGain.connect(masterGain);
        osc.start(startAt);
        osc.stop(startAt + 0.75);
      });
      return;
    }

    // kind === 'redeem': acorde cálido de premio canjeado (F5 -> A5 -> C6 -> F6)
    const notes = [698.46, 880, 1046.5, 1396.91];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const noteGain = ctx.createGain();
      osc.type = 'sine';
      const startAt = now + idx * 0.07;
      osc.frequency.setValueAtTime(freq, startAt);

      noteGain.gain.setValueAtTime(0.0001, startAt);
      noteGain.gain.exponentialRampToValueAtTime(0.05, startAt + 0.03);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.6);

      osc.connect(noteGain);
      noteGain.connect(masterGain);
      osc.start(startAt);
      osc.stop(startAt + 0.65);
    });
  } catch {
    // Silenciar bloqueos de audio
  }
}
