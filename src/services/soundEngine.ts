import { APP_CONFIG } from '../config';
import { BgmTrack } from '../config.example';

export enum SoundMode {
  ALL_ON = 'all_on',
  SFX_ONLY = 'sfx_only',
  MUTED = 'muted',
}

const SOUND_MODE_STORAGE_KEY = 'to_you_audio_mode_v2';
const MUSIC_VOLUME_STORAGE_KEY = 'to_you_music_vol_v2';
const TRACK_INDEX_STORAGE_KEY = 'to_you_bgm_track_idx_v1';

function resolveAssetUrl(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed) return '';
  if (/^(https?:|data:|blob:)/i.test(trimmed)) return trimmed;
  const cleanRel = trimmed.replace(/^\.?\//, '');
  const base = import.meta.env.BASE_URL || './';
  return base.endsWith('/') ? `${base}${cleanRel}` : `${base}/${cleanRel}`;
}

export function loadSavedSoundMode(): SoundMode {
  try {
    const raw = localStorage.getItem(SOUND_MODE_STORAGE_KEY);
    if (
      raw === SoundMode.ALL_ON ||
      raw === SoundMode.SFX_ONLY ||
      raw === SoundMode.MUTED
    ) {
      return raw;
    }
  } catch {
    // Ignore
  }
  return SoundMode.ALL_ON;
}

export function loadSavedMusicVolume(): number {
  try {
    const raw = localStorage.getItem(MUSIC_VOLUME_STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return 0.45;
}

function loadSavedTrackIndex(maxTracks: number): number {
  if (maxTracks <= 0) return 0;
  try {
    const raw = localStorage.getItem(TRACK_INDEX_STORAGE_KEY);
    if (raw !== null) {
      const parsed = Number(raw);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < maxTracks) {
        return parsed;
      }
    }
  } catch {
    // Ignore
  }
  return 0;
}

type AudioStateListener = () => void;

class InteractiveLetterSoundEngine {
  private ctx: AudioContext | null = null;
  private sfxBus: GainNode | null = null;
  private sharedPaperBuffer: AudioBuffer | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private loadedTrackUrl = '';
  private isPlayPending = false;
  private fadeTimerId: number | null = null;
  private foldTimers: number[] = [];
  private listeners = new Set<AudioStateListener>();

  private mode: SoundMode = loadSavedSoundMode();
  private musicVolume: number = loadSavedMusicVolume();
  private currentTrackIndex: number = loadSavedTrackIndex(
    APP_CONFIG.bgmTracks.length
  );
  private isUnlocked = false;
  private lastKeystrokeAtMs = 0;

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          if (this.bgmAudio && !this.bgmAudio.paused) {
            this.bgmAudio.pause();
          }
          if (this.ctx && this.ctx.state === 'running') {
            void this.ctx.suspend().catch(() => {});
          }
        } else if (this.isUnlocked) {
          if (this.ctx && this.mode !== SoundMode.MUTED) {
            void this.ctx.resume().catch(() => {});
          }
          if (this.mode === SoundMode.ALL_ON) {
            this.syncBgmPlayback();
          }
        }
      });
    }
  }

  public subscribe(listener: AudioStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    for (const fn of this.listeners) {
      fn();
    }
  }

  public getTracks(): BgmTrack[] {
    return APP_CONFIG.bgmTracks;
  }

  public getCurrentTrackIndex(): number {
    return this.currentTrackIndex;
  }

  public getCurrentTrack(): BgmTrack | null {
    const tracks = APP_CONFIG.bgmTracks;
    if (tracks.length === 0) return null;
    return tracks[this.currentTrackIndex % tracks.length] || tracks[0];
  }

  public getMode(): SoundMode {
    return this.mode;
  }

  public getMusicVolume(): number {
    return this.musicVolume;
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

      const sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.92;
      sfxBus.connect(ctx.destination);
      this.sfxBus = sfxBus;
    }
    return this.ctx;
  }

  private ensureBgmElement(): HTMLAudioElement | null {
    if (typeof window === 'undefined') return null;
    const track = this.getCurrentTrack();
    if (!track) return null;

    const resolvedUrl = resolveAssetUrl(track.url);
    if (!resolvedUrl) return null;

    if (!this.bgmAudio) {
      const audio = new Audio();
      audio.preload = 'none';
      audio.src = resolvedUrl;
      audio.loop = APP_CONFIG.bgmTracks.length <= 1;
      audio.volume = this.musicVolume;
      audio.addEventListener('ended', () => {
        if (APP_CONFIG.bgmTracks.length > 1) {
          this.nextTrack();
        } else {
          audio.currentTime = 0;
          void audio.play().catch(() => {});
        }
      });
      this.bgmAudio = audio;
      this.loadedTrackUrl = resolvedUrl;
    } else if (this.loadedTrackUrl !== resolvedUrl) {
      this.clearFadeTimer();
      this.isPlayPending = false;
      this.bgmAudio.pause();
      this.bgmAudio.src = resolvedUrl;
      this.bgmAudio.loop = APP_CONFIG.bgmTracks.length <= 1;
      this.loadedTrackUrl = resolvedUrl;
    }

    return this.bgmAudio;
  }

  private clearFadeTimer(): void {
    if (this.fadeTimerId !== null) {
      window.clearInterval(this.fadeTimerId);
      this.fadeTimerId = null;
    }
  }

  private syncBgmPlayback(): void {
    const audio = this.ensureBgmElement();
    if (!audio) return;

    this.clearFadeTimer();

    if (!this.isUnlocked || this.mode !== SoundMode.ALL_ON) {
      this.isPlayPending = false;
      if (!audio.paused) {
        audio.pause();
      }
      return;
    }

    const targetVol = this.musicVolume;
    if (audio.paused && !this.isPlayPending) {
      this.isPlayPending = true;
      audio.volume = Math.min(0.06, targetVol);
      void audio
        .play()
        .then(() => {
          this.isPlayPending = false;
          this.clearFadeTimer();
          this.fadeTimerId = window.setInterval(() => {
            if (!this.bgmAudio || this.bgmAudio.paused) {
              this.clearFadeTimer();
              return;
            }
            const next = Math.min(targetVol, this.bgmAudio.volume + 0.05);
            this.bgmAudio.volume = next;
            if (next >= targetVol) {
              this.clearFadeTimer();
            }
          }, 90);
        })
        .catch(() => {
          this.isPlayPending = false;
          // รอกดปุ่มจากผู้ใช้หากเบราว์เซอร์ยังล็อกอยู่
        });
    } else if (!audio.paused) {
      audio.volume = targetVol;
    }
  }

  public unlockAndStartIfEnabled(): void {
    const ctx = this.ensureContext();
    const wasUnlocked = this.isUnlocked;
    this.isUnlocked = true;

    if (ctx && ctx.state === 'suspended' && this.mode !== SoundMode.MUTED) {
      void ctx.resume().catch(() => {});
    }

    this.syncBgmPlayback();
    if (!wasUnlocked) {
      this.notifyListeners();
    }
  }

  public selectTrack(index: number): void {
    const tracks = APP_CONFIG.bgmTracks;
    if (tracks.length === 0) return;

    const safeIdx = ((index % tracks.length) + tracks.length) % tracks.length;
    this.currentTrackIndex = safeIdx;
    try {
      localStorage.setItem(TRACK_INDEX_STORAGE_KEY, String(safeIdx));
    } catch {
      // Ignore
    }

    if (this.mode !== SoundMode.ALL_ON) {
      this.mode = SoundMode.ALL_ON;
      try {
        localStorage.setItem(SOUND_MODE_STORAGE_KEY, SoundMode.ALL_ON);
      } catch {
        // Ignore
      }
    }

    this.unlockAndStartIfEnabled();
    this.syncBgmPlayback();
    this.notifyListeners();
  }

  public nextTrack(): void {
    this.selectTrack(this.currentTrackIndex + 1);
  }

  public prevTrack(): void {
    this.selectTrack(this.currentTrackIndex - 1);
  }

  public setMode(nextMode: SoundMode): void {
    this.mode = nextMode;
    try {
      localStorage.setItem(SOUND_MODE_STORAGE_KEY, nextMode);
    } catch {
      // Ignore
    }

    if (nextMode !== SoundMode.MUTED) {
      this.unlockAndStartIfEnabled();
    } else {
      for (const id of this.foldTimers) {
        window.clearTimeout(id);
      }
      this.foldTimers = [];
      this.syncBgmPlayback();
    }
    this.notifyListeners();
  }

  public setMusicVolume(nextVol: number): void {
    const clamped = Math.max(0, Math.min(1, nextVol));
    this.musicVolume = clamped;
    try {
      localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(clamped));
    } catch {
      // Ignore
    }

    if (this.bgmAudio) {
      this.clearFadeTimer();
      this.bgmAudio.volume = clamped;
    }

    if (clamped > 0 && this.mode === SoundMode.MUTED) {
      this.setMode(SoundMode.ALL_ON);
    } else if (clamped > 0 && this.mode === SoundMode.ALL_ON) {
      this.unlockAndStartIfEnabled();
    }
    this.notifyListeners();
  }

  private createPaperTextureBuffer(ctx: AudioContext, _durationSec: number): AudioBuffer {
    if (this.sharedPaperBuffer && this.sharedPaperBuffer.sampleRate === ctx.sampleRate) {
      return this.sharedPaperBuffer;
    }
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * 0.45));
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    let last = 0;
    for (let i = 0; i < sampleCount; i++) {
      const white = Math.random() * 2 - 1;
      const grain = 0.65 + 0.35 * Math.sin(i * 0.043) * Math.cos(i * 0.017);
      last = last * 0.58 + white * 0.42;
      data[i] = last * grain;
    }
    this.sharedPaperBuffer = buffer;
    return buffer;
  }

  /**
   * 1. เสียงเปิดซองจดหมายและดึงกระดาษออกมาอ่าน
   */
  public playPaperOpenSfx(): void {
    if (this.mode === SoundMode.MUTED) return;
    this.unlockAndStartIfEnabled();
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;

    const flapDur = 0.07;
    const flapSrc = ctx.createBufferSource();
    flapSrc.buffer = this.createPaperTextureBuffer(ctx, flapDur);

    const flapFilter = ctx.createBiquadFilter();
    flapFilter.type = 'highpass';
    flapFilter.frequency.setValueAtTime(1350, now);

    const flapGain = ctx.createGain();
    flapGain.gain.setValueAtTime(0.001, now);
    flapGain.gain.linearRampToValueAtTime(0.32, now + 0.012);
    flapGain.gain.exponentialRampToValueAtTime(0.001, now + flapDur);

    flapSrc.connect(flapFilter);
    flapFilter.connect(flapGain);
    flapGain.connect(dest);
    flapSrc.start(now);
    flapSrc.stop(now + flapDur + 0.01);

    const slideStart = now + 0.045;
    const slideDur = 0.38;
    const slideSrc = ctx.createBufferSource();
    slideSrc.buffer = this.createPaperTextureBuffer(ctx, slideDur);

    const slideBand = ctx.createBiquadFilter();
    slideBand.type = 'bandpass';
    slideBand.Q.setValueAtTime(1.25, slideStart);
    slideBand.frequency.setValueAtTime(680, slideStart);
    slideBand.frequency.exponentialRampToValueAtTime(2150, slideStart + 0.16);
    slideBand.frequency.exponentialRampToValueAtTime(1180, slideStart + slideDur);

    const slideGain = ctx.createGain();
    slideGain.gain.setValueAtTime(0.001, slideStart);
    slideGain.gain.linearRampToValueAtTime(0.45, slideStart + 0.07);
    slideGain.gain.setValueAtTime(0.38, slideStart + 0.19);
    slideGain.gain.exponentialRampToValueAtTime(0.001, slideStart + slideDur);

    slideSrc.connect(slideBand);
    slideBand.connect(slideGain);
    slideGain.connect(dest);
    slideSrc.start(slideStart);
    slideSrc.stop(slideStart + slideDur + 0.02);
  }

  /**
   * 2. เสียงพับเก็บกระดาษวางคืนบนโต๊ะไม้
   */
  public playPaperCloseSfx(): void {
    if (this.mode === SoundMode.MUTED) return;
    this.unlockAndStartIfEnabled();
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const dur = 0.25;

    const src = ctx.createBufferSource();
    src.buffer = this.createPaperTextureBuffer(ctx, dur);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.4;
    filter.frequency.setValueAtTime(1850, now);
    filter.frequency.exponentialRampToValueAtTime(680, now + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.34, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(now);
    src.stop(now + dur + 0.02);

    this.triggerWoodDeskPat(now + 0.16, 0.16);
  }

  /**
   * 3. เสียงพับจดหมายใส่ซองและปิดผนึกหัวใจ
   */
  public playPaperFoldSfx(): void {
    if (this.mode === SoundMode.MUTED) return;
    this.unlockAndStartIfEnabled();

    for (const id of this.foldTimers) {
      window.clearTimeout(id);
    }
    this.foldTimers = [];

    this.triggerPaperCrease(1050, 2350, 0.24, 0.42);

    const t1 = window.setTimeout(() => {
      if (this.mode === SoundMode.MUTED) return;
      this.triggerPaperCrease(1750, 760, 0.3, 0.38);
    }, 360);

    const t2 = window.setTimeout(() => {
      if (this.mode === SoundMode.MUTED) return;
      this.triggerPaperCrease(1300, 900, 0.15, 0.26);
      if (this.ctx) {
        this.triggerWoodDeskPat(this.ctx.currentTime + 0.05, 0.22);
      }
    }, 780);

    this.foldTimers.push(t1, t2);
  }

  private triggerPaperCrease(
    startFreq: number,
    endFreq: number,
    durSec: number,
    peakGain: number
  ): void {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.createPaperTextureBuffer(ctx, durSec);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.3;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(endFreq, now + durSec);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(peakGain, now + 0.045);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durSec);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    src.start(now);
    src.stop(now + durSec + 0.02);
  }

  private triggerWoodDeskPat(startTime: number, peakGain: number): void {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(165, startTime);
    osc.frequency.exponentialRampToValueAtTime(68, startTime + 0.075);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, startTime);
    gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.08);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(startTime);
    osc.stop(startTime + 0.09);
  }

  /**
   * 4. เสียงเขียนปากกาลงกระดาษและพิมพ์ข้อความ
   */
  public playWritingKeystrokeSfx(key?: string): void {
    if (this.mode === SoundMode.MUTED) return;

    const nowMs = performance.now();
    if (nowMs - this.lastKeystrokeAtMs < 28) {
      return;
    }
    this.lastKeystrokeAtMs = nowMs;

    this.unlockAndStartIfEnabled();
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;

    if (key === 'Enter') {
      this.triggerPaperCrease(950, 1550, 0.11, 0.25);
      this.triggerWoodDeskPat(now + 0.01, 0.12);
      return;
    }

    if (key === ' ') {
      this.triggerPaperCrease(1900, 1300, 0.055, 0.2);
      this.triggerWoodDeskPat(now, 0.14);
      return;
    }

    if (key === 'Backspace' || key === 'Delete') {
      this.triggerPaperCrease(1700, 950, 0.036, 0.18);
      return;
    }

    const nibDur = 0.034 + Math.random() * 0.016;
    const nibSrc = ctx.createBufferSource();
    nibSrc.buffer = this.createPaperTextureBuffer(ctx, nibDur);

    const nibFilter = ctx.createBiquadFilter();
    nibFilter.type = 'bandpass';
    nibFilter.Q.value = 1.9;
    const baseScratchFreq = 2400 + Math.random() * 1100;
    nibFilter.frequency.setValueAtTime(baseScratchFreq, now);
    nibFilter.frequency.exponentialRampToValueAtTime(
      baseScratchFreq * 0.72,
      now + nibDur
    );

    const nibGain = ctx.createGain();
    nibGain.gain.setValueAtTime(0.001, now);
    nibGain.gain.linearRampToValueAtTime(0.24, now + 0.006);
    nibGain.gain.exponentialRampToValueAtTime(0.001, now + nibDur);

    nibSrc.connect(nibFilter);
    nibFilter.connect(nibGain);
    nibGain.connect(dest);
    nibSrc.start(now);
    nibSrc.stop(now + nibDur + 0.01);

    const keyOsc = ctx.createOscillator();
    keyOsc.type = 'triangle';
    const startPitch = 215 + Math.random() * 55;
    keyOsc.frequency.setValueAtTime(startPitch, now);
    keyOsc.frequency.exponentialRampToValueAtTime(82, now + 0.024);

    const keyGain = ctx.createGain();
    keyGain.gain.setValueAtTime(0.11, now);
    keyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.026);

    keyOsc.connect(keyGain);
    keyGain.connect(dest);
    keyOsc.start(now);
    keyOsc.stop(now + 0.03);
  }

  /**
   * 5. เสียงแตะปุ่มทั่วไปอย่างนุ่มนวล
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
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.exponentialRampToValueAtTime(135, now + 0.05);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(now);
    osc.stop(now + 0.06);
  }
}

export const soundEngine = new InteractiveLetterSoundEngine();
