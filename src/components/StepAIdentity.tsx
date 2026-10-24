import React, { useEffect, useRef, useState } from 'react';
import { UI_COPY } from '../content/letters';
import { Home, ArrowLeft } from 'lucide-react';

interface StepAIdentityProps {
  onBackToCover: () => void;
  onProceedToBirthday: () => void;
}

type StepASubState = 'initial' | 'wait_3_sec' | 'follow_up' | 'polite_exit';

export function StepAIdentity({
  onBackToCover,
  onProceedToBirthday,
}: StepAIdentityProps) {
  const [subState, setSubState] = useState<StepASubState>('initial');
  const waitTimerRef = useRef<number | null>(null);

  const clearWaitTimer = () => {
    if (waitTimerRef.current !== null) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearWaitTimer();
    };
  }, []);

  const handleFirstYes = () => {
    clearWaitTimer();
    onProceedToBirthday();
  };

  const handleFirstNo = () => {
    clearWaitTimer();
    setSubState('wait_3_sec');
    waitTimerRef.current = window.setTimeout(() => {
      waitTimerRef.current = null;
      setSubState('follow_up');
    }, 3000);
  };

  const handleActuallyMe = () => {
    clearWaitTimer();
    onProceedToBirthday();
  };

  const handleReallyNotMe = () => {
    clearWaitTimer();
    setSubState('polite_exit');
  };

  const handleResetToInitial = () => {
    clearWaitTimer();
    setSubState('initial');
  };

  return (
    <section className="w-full max-w-xl mx-auto px-5 py-6 flex flex-col min-h-[78vh]">
      {/* ปุ่มมุมซ้ายบนตามภาพต้นฉบับ */}
      <div className="flex items-center justify-start">
        {subState === 'initial' ? (
          <button
            type="button"
            onClick={() => {
              clearWaitTimer();
              onBackToCover();
            }}
            className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm text-[#E8DDD0]/85 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>{UI_COPY.stepA.homeBtn}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleResetToInitial}
            className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm text-[#E8DDD0]/85 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>{UI_COPY.stepA.backBtn}</span>
          </button>
        )}
      </div>

      {/* เนื้อหากึ่งกลางหน้าจอโปร่งโล่งรับแสงเทียน */}
      <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
        {subState === 'initial' && (
          <div className="space-y-8 w-full max-w-md">
            <h1
              className="font-display text-2xl sm:text-3xl font-semibold text-[#F6EFE6] leading-relaxed drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]"
              style={{ textWrap: 'balance' }}
            >
              {UI_COPY.stepA.initialQuestion}
            </h1>

            <div className="flex flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleFirstYes}
                className="night-glass-btn-active min-w-[116px] min-h-[46px] px-7 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                {UI_COPY.stepA.yesBtn}
              </button>
              <button
                type="button"
                onClick={handleFirstNo}
                className="night-glass-btn min-w-[116px] min-h-[46px] px-7 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                {UI_COPY.stepA.noBtn}
              </button>
            </div>
          </div>
        )}

        {subState === 'wait_3_sec' && (
          <div
            aria-live="polite"
            className="px-10 py-7 rounded-2xl bg-black/55 backdrop-blur-md border border-[#E8DDD0]/20 space-y-2.5"
          >
            <p className="font-display text-2xl font-semibold text-[#F6EFE6]">
              {UI_COPY.stepA.waitMessage}
            </p>
            <p className="text-lg text-[#E8DDD0]/75 tracking-widest">...</p>
            <p className="text-xs text-[#E8DDD0]/60">
              {UI_COPY.stepA.waitSubLabel}
            </p>
          </div>
        )}

        {subState === 'follow_up' && (
          <div className="space-y-8 w-full max-w-md" aria-live="polite">
            <h2
              className="font-display text-xl sm:text-2xl font-semibold text-[#F6EFE6] leading-relaxed drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]"
              style={{ textWrap: 'balance' }}
            >
              {UI_COPY.stepA.waitFollowUp}
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={handleActuallyMe}
                className="night-glass-btn-active w-full sm:w-auto min-h-[48px] px-7 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                {UI_COPY.stepA.actuallyMeBtn}
              </button>
              <button
                type="button"
                onClick={handleReallyNotMe}
                className="night-glass-btn w-full sm:w-auto min-h-[48px] px-7 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                {UI_COPY.stepA.reallyNotMeBtn}
              </button>
            </div>
          </div>
        )}

        {subState === 'polite_exit' && (
          <div
            aria-live="polite"
            className="max-w-md px-8 py-8 rounded-2xl bg-black/60 backdrop-blur-md border border-[#E8DDD0]/25 space-y-4"
          >
            <h2
              className="font-display text-xl sm:text-2xl font-semibold text-[#F6EFE6]"
              style={{ textWrap: 'balance' }}
            >
              {UI_COPY.stepA.politeExitTitle}
            </h2>
            <p className="text-sm sm:text-base text-[#E8DDD0]/85 leading-relaxed">
              {UI_COPY.stepA.politeExitBody}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
