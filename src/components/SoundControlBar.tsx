import React, { useEffect, useRef, useState } from 'react';
import { BgmTrack } from '../config.example';
import { useSiteCopy } from '../context/SiteCopyContext';
import { SoundMode } from '../services/soundEngine';
import {
  ChevronDown,
  Feather,
  Music,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface SoundControlBarProps {
  soundMode: SoundMode;
  musicVolume: number;
  tracks: BgmTrack[];
  currentTrackIndex: number;
  isAudioUnlocked: boolean;
  onChangeSoundMode: (mode: SoundMode) => void;
  onChangeMusicVolume: (vol: number) => void;
  onSelectTrack: (index: number) => void;
  onNextTrack: () => void;
}

export function SoundControlBar({
  soundMode,
  musicVolume,
  tracks,
  currentTrackIndex,
  isAudioUnlocked,
  onChangeSoundMode,
  onChangeMusicVolume,
  onSelectTrack,
  onNextTrack,
}: SoundControlBarProps) {
  const copy = useSiteCopy();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [menuOpen]);

  const isMuted = soundMode === SoundMode.MUTED;
  const activeTrack = tracks[currentTrackIndex] || tracks[0];

  const getButtonLabel = () => {
    if (isMuted) return copy.globalBars.soundMutedBtn;
    if (!isAudioUnlocked) return copy.globalBars.soundTapToPlayBtn;
    if (soundMode === SoundMode.SFX_ONLY) {
      return copy.globalBars.soundPlayingSfxOnlyBtn;
    }
    return activeTrack ? `เพลง: ${activeTrack.title}` : 'เสียงเพลง & จดหมาย';
  };

  const handlePrimaryToggle = () => {
    if (isMuted) {
      onChangeSoundMode(SoundMode.ALL_ON);
    } else if (!isAudioUnlocked) {
      onChangeSoundMode(soundMode);
    } else {
      setMenuOpen((prev) => !prev);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed top-4 right-4 z-30 flex flex-col items-end"
    >
      <div className="flex items-center gap-1.5">
        {!isMuted &&
          isAudioUnlocked &&
          soundMode === SoundMode.ALL_ON &&
          tracks.length > 1 && (
            <button
              type="button"
              onClick={onNextTrack}
              title="เปลี่ยนเพลงถัดไป"
              aria-label="เปลี่ยนเพลงถัดไป"
              className="night-glass-btn inline-flex items-center justify-center min-h-[42px] w-[42px] cursor-pointer shadow-lg shrink-0"
            >
              <SkipForward className="w-4 h-4 text-[#F6EFE6]" aria-hidden="true" />
            </button>
          )}

        <button
          type="button"
          onClick={handlePrimaryToggle}
          aria-expanded={menuOpen}
          aria-label="ตั้งค่าเสียงเพลงและเสียงเอฟเฟกต์จดหมาย"
          className="night-glass-btn inline-flex items-center gap-2 min-h-[42px] max-w-[235px] sm:max-w-[290px] px-4 py-2 text-xs sm:text-sm font-medium cursor-pointer shadow-lg"
        >
          {isMuted ? (
            <VolumeX className="w-4 h-4 text-[#E8DDD0]/75 shrink-0" aria-hidden="true" />
          ) : !isMuted && isAudioUnlocked && soundMode === SoundMode.ALL_ON ? (
            <span
              aria-hidden="true"
              className="inline-flex items-end gap-[2.5px] h-3.5 w-4 shrink-0 justify-center"
            >
              <span className="w-[2.5px] h-full rounded-full bg-[#F5CA7B] animate-eq-1" />
              <span className="w-[2.5px] h-full rounded-full bg-[#F6EFE6] animate-eq-2" />
              <span className="w-[2.5px] h-full rounded-full bg-[#F5CA7B] animate-eq-3" />
            </span>
          ) : (
            <Volume2 className="w-4 h-4 text-[#F6EFE6] shrink-0" aria-hidden="true" />
          )}
          <span className="truncate">{getButtonLabel()}</span>
          {!isMuted && isAudioUnlocked && (
            <ChevronDown
              className={`w-3.5 h-3.5 text-[#E8DDD0]/75 shrink-0 transition-transform duration-150 ${
                menuOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          )}
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="mt-2 w-72 rounded-2xl bg-[#1C1612]/95 backdrop-blur-md border border-[#EBD8C0]/35 py-2 shadow-2xl text-left overflow-hidden"
        >
          {/* รายการเพลงให้เลือกฟัง */}
          {tracks.length > 0 && (
            <div className="pb-1.5 border-b border-[#EBD8C0]/15">
              <p className="px-4 py-1 text-[11px] text-[#E8DDD0]/60">
                เลือกเพลงประกอบ ({tracks.length} เพลง · เล่นวนต่อเนื่อง)
              </p>
              {tracks.map((track, idx) => {
                const isSelected =
                  soundMode === SoundMode.ALL_ON && currentTrackIndex === idx;
                return (
                  <button
                    key={track.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      onSelectTrack(idx);
                    }}
                    className={`w-full px-4 py-2 min-h-[42px] flex items-center gap-2.5 text-xs sm:text-sm transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#EBD8C0]/22 text-white font-medium'
                        : 'text-[#E8DDD0]/85 hover:bg-[#EBD8C0]/10'
                    }`}
                  >
                    <Music className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span className="truncate">
                      {idx + 1}. {track.title}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* โหมดเสียง */}
          <div className="py-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onChangeSoundMode(SoundMode.SFX_ONLY);
                setMenuOpen(false);
              }}
              className={`w-full px-4 py-2.5 min-h-[42px] flex items-center gap-2.5 text-xs sm:text-sm transition-colors cursor-pointer ${
                soundMode === SoundMode.SFX_ONLY
                  ? 'bg-[#EBD8C0]/20 text-white font-medium'
                  : 'text-[#E8DDD0]/85 hover:bg-[#EBD8C0]/10'
              }`}
            >
              <Feather className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>เฉพาะเสียงเปิดซอง / เขียน / พิมพ์</span>
            </button>
          </div>

          {/* แถบปรับความดังเสียงเพลง */}
          <div className="px-4 py-2.5 border-t border-[#EBD8C0]/15 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-[#E8DDD0]/80 tabular-nums">
              <label htmlFor="bgm-vol-slider">ระดับเสียงเพลง</label>
              <span>{Math.round(musicVolume * 100)}%</span>
            </div>
            <input
              id="bgm-vol-slider"
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(musicVolume * 100)}
              onChange={(e) => onChangeMusicVolume(Number(e.target.value) / 100)}
              className="w-full accent-[#E5B968] cursor-pointer"
            />
          </div>

          <div className="border-t border-[#EBD8C0]/15 pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onChangeSoundMode(SoundMode.MUTED);
                setMenuOpen(false);
              }}
              className="w-full px-4 py-2.5 min-h-[42px] flex items-center gap-2.5 text-xs sm:text-sm text-[#E8DDD0]/75 hover:bg-[#EBD8C0]/10 hover:text-white transition-colors cursor-pointer"
            >
              <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>ปิดเสียงทั้งหมด</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
