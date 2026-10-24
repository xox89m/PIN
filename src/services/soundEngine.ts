import { APP_CONFIG } from '../config';

export enum SoundMode {
  MELODY_AND_RAIN = 'melody_rain',
  RAIN_ONLY = 'rain_only',
  MUTED = 'muted',
}

const SOUND_MODE_STORAGE_KEY = 'to_you_sound_mode_v1';

// โน้ตดนตรี (Hz) สำหรับคอร์ดเปียโนอุ่น ๆ ในคีย์ F Major / D Minor
const NOTE = {
  F3: 174.61,
  G3: 196.0,
  A3: 220.0,
  Bb3: 233.08,
  C4: 261.63,
  D4: 293.66,
  E4: 329.63,
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99,
};

function B4_NATURAL(): number {
  return 493.88;
}

// ลำดับโน้ตเปียโนบรรเลงช้า ๆ อบอุ่นใจในคีย์ F Major / D Minor
const CLEAN_PIANO_PHRASES: number[][] = [
  [NOTE.F3, NOTE.C4, NOTE.A4, NOTE.E4, NOTE.C5, NOTE.A4], // Fmaj7
  [NOTE.G3, NOTE.E4, B4_NATURAL(), NOTE.G4, NOTE.E4, NOTE.C4], // Em7 / Cmaj7
  [NOTE.D4, NOTE.A3, NOTE.F4, NOTE.C5, NOTE.A4, NOTE.F4], // Dm7
  [NOTE.Bb3, NOTE.F4, NOTE.A4, NOTE.D5, NOTE.C5, NOTE.A4], // Bbmaj7
  [NOTE.G3, NOTE.D4, NOTE.F4, NOTE.Bb4, NOTE.A4, NOTE.G4], // Gm7
  [NOTE.C4, NOTE.G3, NOTE.F4, NOTE.E4, NOTE.G4, NOTE.C4], // Csus4 -> C
];

// ทำนองกล่องดนตรี Happy Birthday นุ่ม ๆ เมื่อเปิดซองวันเกิด
const BIRTHDAY_MOTIF_STEPS: Array<{ freq: number; delayMs: number; durSec: number }> = [
  { freq: NOTE.C5, delayMs: 0, durSec: 0.45 },
  { freq: NOTE.C5, delayMs: 380, durSec: 0.35 },
  { freq: NOTE.D5, delayMs: 720, durSec: 0.75 },
  { freq: NOTE.C5, delayMs: 1450, durSec: 0.75 },
  { freq: NOTE.F5, delayMs: 2180, durSec: 0.75 },
  { freq: NOTE.E5, delayMs: 2920, durSec: 1.35 },

  { freq: NOTE.C5, delayMs: 4350, durSec: 0.45 },
  { freq: NOTE.C5, delayMs: 4730, durSec: 0.35 },
  { freq: NOTE.D5, delayMs: 5070, durSec: 0.75 },
  { freq: NOTE.C5, delayMs: 5800, durSec: 0.75 },
  { freq: NOTE.G5, delayMs: 6530, durSec: 0.8 },
  { freq: NOTE.F5, delayMs: 7300, durSec: 1.6 },
];

export function loadSavedSoundMode(): SoundMode {
  try {
    const raw = localStorage.getItem(SOUND_MODE_STORAGE_KEY);
    if (
      raw === SoundMode.MELODY_AND_RAIN ||
      raw === SoundMode.RAIN_ONLY ||
      raw === SoundMode.MUTED
    ) {
      return raw;
    }
  } catch {
    // Ignore
  }
  return SoundMode.MELODY_AND_RAIN;
}

export function persistSoundMode(mode: SoundMode): void {
  try {
    localStorage.setItem(SOUND_MODE_STORAGE_KEY, mode);
  } catch {
    // Ignore
  }
}

class WarmAtmosphereSoundEngine {
  private ctx: AudioContext | null = null;
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private pianoBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;

  private customAudioEl: HTMLAudioElement | null = null;
  private melodyIntervalId: number | null = null;
  private birthdayTimers: number[] = [];
  private isPlayingBirthdayMotif = false;

  private phraseIdx = 0;
  private noteIdx = 0;
  private mode: SoundMode = loadSavedSoundMode();
  private isUnlocked = false;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) {
          void this.ctx.suspend().catch(() => {});
          if (this.customAudioEl && !this.customAudioEl.paused) {
            this.customAudioEl.pause();
          }
        } else if (this.isUnlocked && this.mode !== SoundMode.MUTED) {
          void this.ctx.resume().catch(() => {});
          if (this.customAudioEl && this.mode === SoundMode.MELODY_AND_RAIN) {
            void this.customAudioEl.play().catch(() => {});
          }
        }
      });
    }
  }

  public getMode(): SoundMode {
    return this.mode;
  }

  public getIsUnlocked(): boolean {
    return this.isUnlocked;
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;

      const ctx = new AudioCtx();
      this.ctx = ctx;

      // สร้าง Bus สำหรับเสียงเปียโน พร้อม Echo นุ่ม ๆ เหมือนห้องไม้ยามค่ำคืน
      const pianoBus = ctx.createGain();
      pianoBus.gain.value = 0.0001;

      const delay = ctx.createDelay(1.0);
      delay.delayTime.value = 0.38;
      const delayFeedback = ctx.createGain();
      delayFeedback.gain.value = 0.24;
      const delayFilter = ctx.createBiquadFilter();
      delayFilter.type = 'lowpass';
      delayFilter.frequency.value = 950;

      pianoBus.connect(ctx.destination);
      pianoBus.connect(delay);
      delay.connect(delayFilter);
      delayFilter.connect(delayFeedback);
      delayFeedback.connect(delay);
      delayFilter.connect(ctx.destination);
      this.pianoBus = pianoBus;

      // สร้าง Bus สำหรับเสียงกระดาษและปุ่มกด
      const sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.65;
      sfxBus.connect(ctx.destination);
      this.sfxBus = sfxBus;

      // สร้างเสียงฝนตกกระทบหน้าต่างแบบนุ่มนวล (Warm Pink/Brown Filtered Rain)
      this.setupRainLoop(ctx);
    }
    return this.ctx;
  }

  private setupRainLoop(ctx: AudioContext): void {
    const durationSec = 5;
    const bufferSize = ctx.sampleRate * durationSec;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);

    for (let ch = 0; ch < 2; ch++) {
      const output = buffer.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        output[i] = (b0 + b1 + b2 + white * 0.1848) * 0.045;
      }

      // Crossfade หัวท้ายให้ Loop เนียนสนิทไม่มีเสียงสะดุด
      const fadeSamples = Math.floor(ctx.sampleRate * 0.25);
      for (let i = 0; i < fadeSamples; i++) {
        const alpha = i / fadeSamples;
        output[i] =
          output[i] * alpha + output[bufferSize - fadeSamples + i] * (1 - alpha);
      }
    }

    const rainSource = ctx.createBufferSource();
    rainSource.buffer = buffer;
    rainSource.loop = true;

    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 640;

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 130;

    const rainGain = ctx.createGain();
    rainGain.gain.value = 0.0001;

    rainSource.connect(highpass);
    highpass.connect(lowpass);
    lowpass.connect(rainGain);
    rainGain.connect(ctx.destination);

    rainSource.start();
    this.rainSource = rainSource;
    this.rainGain = rainGain;
  }

  private syncGainsAndLoops(): void {
    const ctx = this.ctx;
    if (!ctx || !this.rainGain || !this.pianoBus) return;

    const now = ctx.currentTime;
    const customUrl = APP_CONFIG.customBgmUrl?.trim();

    if (this.mode === SoundMode.MUTED || !this.isUnlocked) {
      this.rainGain.gain.setTargetAtTime(0.0001, now, 0.25);
      this.pianoBus.gain.setTargetAtTime(0.0001, now, 0.25);
      this.stopMelodyLoop();
      if (this.customAudioEl) {
        this.customAudioEl.pause();
      }
      return;
    }

    // เปิดเสียงฝนเบา ๆ สบายหู
    const targetRainVol = this.mode === SoundMode.RAIN_ONLY ? 0.24 : 0.17;
    this.rainGain.gain.setTargetAtTime(targetRainVol, now, 0.6);

    if (this.mode === SoundMode.MELODY_AND_RAIN) {
      if (customUrl) {
        this.pianoBus.gain.setTargetAtTime(0.0001, now, 0.3);
        this.stopMelodyLoop();
        if (!this.customAudioEl) {
          this.customAudioEl = new Audio(customUrl);
          this.customAudioEl.loop = true;
          this.customAudioEl.volume = 0.45;
        }
        void this.customAudioEl.play().catch(() => {});
      } else {
        this.pianoBus.gain.setTargetAtTime(0.32, now, 0.6);
        this.startMelodyLoop();
      }
    } else {
      // RAIN_ONLY
      this.pianoBus.gain.setTargetAtTime(0.0001, now, 0.35);
      this.stopMelodyLoop();
      if (this.customAudioEl) {
        this.customAudioEl.pause();
      }
    }
  }

  private startMelodyLoop(): void {
    if (this.melodyIntervalId !== null) return;

    // เล่นโน้ตแรกเบา ๆ หลังเริ่มเล็กน้อย
    this.playNextAmbientPianoNote();

    this.melodyIntervalId = window.setInterval(() => {
      if (
        !this.ctx ||
        this.ctx.state !== 'running' ||
        this.mode !== SoundMode.MELODY_AND_RAIN ||
        this.isPlayingBirthdayMotif
      ) {
        return;
      }
      this.playNextAmbientPianoNote();
    }, 1050);
  }

  private stopMelodyLoop(): void {
    if (this.melodyIntervalId !== null) {
      window.clearInterval(this.melodyIntervalId);
      this.melodyIntervalId = null;
    }
  }

  private playNextAmbientPianoNote(): void {
    if (!this.ctx || !this.pianoBus || this.isPlayingBirthdayMotif) return;

    const phrase = CLEAN_PIANO_PHRASES[this.phraseIdx % CLEAN_PIANO_PHRASES.length];
    const freq = phrase[this.noteIdx % phrase.length];

    // โน้ตตัวแรกของห้องให้มีน้ำหนักนุ่มลึกขึ้นเล็กน้อย
    const velocity = this.noteIdx === 0 ? 0.22 : 0.14 + Math.random() * 0.04;
    const durationSec = this.noteIdx === 0 ? 3.2 : 2.3;

    this.triggerFeltPianoTone(freq, velocity, durationSec);

    this.noteIdx += 1;
    if (this.noteIdx >= phrase.length) {
      this.noteIdx = 0;
      this.phraseIdx = (this.phraseIdx + 1) % CLEAN_PIANO_PHRASES.length;
    }
  }

  private triggerFeltPianoTone(
    freq: number,
    peakGain: number,
    durationSec: number,
    isMusicBox = false
  ): void {
    const ctx = this.ctx;
    const dest = this.pianoBus;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;

    const oscMain = ctx.createOscillator();
    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(freq, now);

    const oscWarm = ctx.createOscillator();
    oscWarm.type = 'triangle';
    oscWarm.frequency.setValueAtTime(isMusicBox ? freq * 2 : freq, now);

    const warmMix = ctx.createGain();
    warmMix.gain.setValueAtTime(isMusicBox ? 0.08 : 0.16, now);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isMusicBox ? 2400 : 1350, now);
    filter.frequency.exponentialRampToValueAtTime(520, now + durationSec);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(peakGain, now + 0.035);
    env.gain.exponentialRampToValueAtTime(0.0008, now + durationSec);

    oscMain.connect(filter);
    oscWarm.connect(warmMix);
    warmMix.connect(filter);
    filter.connect(env);
    env.connect(dest);

    oscMain.start(now);
    oscWarm.start(now);
    oscMain.stop(now + durationSec + 0.05);
    oscWarm.stop(now + durationSec + 0.05);
  }

  /**
   * เรียกเมื่อผู้ใช้แตะปุ่มครั้งแรก (เช่น ปุ่ม "เริ่มต้น" หรือปุ่มเปิดเสียง) เพื่อปลดล็อกเสียงตามกฎเบราว์เซอร์
   */
  public unlockAndStartIfEnabled(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.isUnlocked = true;
    if (ctx.state === 'suspended') {
      void ctx.resume().then(() => {
        this.syncGainsAndLoops();
      });
    } else {
      this.syncGainsAndLoops();
    }
  }

  public setMode(nextMode: SoundMode): void {
    this.mode = nextMode;
    persistSoundMode(nextMode);

    if (nextMode !== SoundMode.MUTED) {
      this.unlockAndStartIfEnabled();
    } else {
      this.clearBirthdayTimers();
      this.syncGainsAndLoops();
    }
  }

  private clearBirthdayTimers(): void {
    for (const id of this.birthdayTimers) {
      window.clearTimeout(id);
    }
    this.birthdayTimers = [];
    this.isPlayingBirthdayMotif = false;
  }

  /**
   * เล่นทำนองกล่องดนตรี Happy Birthday นุ่ม ๆ เมื่อเปิดอ่านซองจดหมายวันเกิด
   */
  public playBirthdayMusicBoxChime(): void {
    if (this.mode !== SoundMode.MELODY_AND_RAIN) return;
    if (APP_CONFIG.customBgmUrl?.trim()) return;

    this.unlockAndStartIfEnabled();
    if (!this.ctx) return;

    this.clearBirthdayTimers();
    this.isPlayingBirthdayMotif = true;

    for (const step of BIRTHDAY_MOTIF_STEPS) {
      const timerId = window.setTimeout(() => {
        if (this.mode !== SoundMode.MELODY_AND_RAIN) return;
        this.triggerFeltPianoTone(step.freq, 0.2, step.durSec, true);
      }, step.delayMs);
      this.birthdayTimers.push(timerId);
    }

    const endId = window.setTimeout(() => {
      this.isPlayingBirthdayMotif = false;
    }, 9200);
    this.birthdayTimers.push(endId);
  }

  /**
   * เสียงคลี่ซองจดหมาย / เลื่อนกระดาษวินเทจออกอ่านเบา ๆ
   */
  public playPaperOpenSfx(): void {
    if (this.mode === SoundMode.MUTED) return;
    this.unlockAndStartIfEnabled();
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const dur = 0.22;
    const sampleCount = Math.floor(ctx.sampleRate * dur);
    const noiseBuf = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.35;
    }

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(850, now);
    filter.frequency.exponentialRampToValueAtTime(1750, now + dur);
    filter.Q.value = 1.6;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    src.start(now);
    src.stop(now + dur + 0.02);
  }

  /**
   * เสียงพับกระดาษจดหมายลงซองอย่างทะนุถนอม
   */
  public playPaperFoldSfx(): void {
    if (this.mode === SoundMode.MUTED) return;
    this.playPaperOpenSfx();
    window.setTimeout(() => {
      if (this.mode !== SoundMode.MUTED) {
        this.playSoftTapSfx();
      }
    }, 320);
  }

  /**
   * เสียงแตะปุ่มนุ่ม ๆ
   */
  public playSoftTapSfx(): void {
    if (this.mode === SoundMode.MUTED) return;
    this.unlockAndStartIfEnabled();
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.055);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

export const soundEngine = new WarmAtmosphereSoundEngine();
