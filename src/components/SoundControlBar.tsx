import React, { useEffect, useRef, useState } from 'react';
import { SoundMode } from '../services/soundEngine';
import { ChevronDown, CloudRain, Music, Volume2, VolumeX } from 'lucide-react';

interface SoundControlBarProps {
  soundMode: SoundMode;
  isAudioUnlocked: boolean;
  onChangeSoundMode: (mode: SoundMode) => void;
}

export function SoundControlBar({
  soundMode,
  isAudioUnlocked,
  onChangeSoundMode,
}: SoundControlBarProps) {
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

  const getButtonLabel = () => {
    if (isMuted) return 'ปิดเสียงอยู่';
    if (!isAudioUnlocked) return 'แตะเพื่อเปิดเสียง';
    if (soundMode === SoundMode.RAIN_ONLY) return 'เสียงฝนเบา ๆ';
    return 'เสียงเปียโน & ฝน';
  };

  const handlePrimaryToggle = () => {
    if (isMuted) {
      onChangeSoundMode(SoundMode.MELODY_AND_RAIN);
    } else if (!isAudioUnlocked) {
      // หากเบราว์เซอร์ยังไม่ปลดล็อกเสียง ให้ปลดล็อกและเริ่มเล่นทันที
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
      <button
        type="button"
        onClick={handlePrimaryToggle}
        aria-expanded={menuOpen}
        aria-label="ตั้งค่าเสียงบรรยากาศ"
        className="night-glass-btn inline-flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer shadow-lg"
      >
        {isMuted ? (
          <VolumeX className="w-4 h-4 text-[#E8DDD0]/75" aria-hidden="true" />
        ) : (
          <Volume2 className="w-4 h-4 text-[#F6EFE6]" aria-hidden="true" />
        )}
        <span>{getButtonLabel()}</span>
        {!isMuted && isAudioUnlocked && (
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#E8DDD0]/75 transition-transform duration-150 ${
              menuOpen ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        )}
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="mt-2 w-56 rounded-2xl bg-[#1C1612]/92 backdrop-blur-md border border-[#EBD8C0]/35 py-1.5 shadow-2xl text-left overflow-hidden"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onChangeSoundMode(SoundMode.MELODY_AND_RAIN);
              setMenuOpen(false);
            }}
            className={`w-full px-4 py-2.5 min-h-[44px] flex items-center gap-2.5 text-xs sm:text-sm transition-colors cursor-pointer ${
              soundMode === SoundMode.MELODY_AND_RAIN
                ? 'bg-[#EBD8C0]/20 text-white font-medium'
                : 'text-[#E8DDD0]/85 hover:bg-[#EBD8C0]/10'
            }`}
          >
            <Music className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>เปียโนอุ่น ๆ และเสียงฝน</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onChangeSoundMode(SoundMode.RAIN_ONLY);
              setMenuOpen(false);
            }}
            className={`w-full px-4 py-2.5 min-h-[44px] flex items-center gap-2.5 text-xs sm:text-sm transition-colors cursor-pointer ${
              soundMode === SoundMode.RAIN_ONLY
                ? 'bg-[#EBD8C0]/20 text-white font-medium'
                : 'text-[#E8DDD0]/85 hover:bg-[#EBD8C0]/10'
            }`}
          >
            <CloudRain className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>เฉพาะเสียงฝนริมหน้าต่าง</span>
          </button>

          <div className="my-1 border-t border-[#EBD8C0]/15" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onChangeSoundMode(SoundMode.MUTED);
              setMenuOpen(false);
            }}
            className="w-full px-4 py-2.5 min-h-[44px] flex items-center gap-2.5 text-xs sm:text-sm text-[#E8DDD0]/75 hover:bg-[#EBD8C0]/10 hover:text-white transition-colors cursor-pointer"
          >
            <VolumeX className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>ปิดเสียงทั้งหมด</span>
          </button>
        </div>
      )}
    </div>
  );
}
