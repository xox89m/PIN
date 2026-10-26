import React, { useEffect, useRef, useState } from 'react';
import { useSiteCopy } from '../context/SiteCopyContext';
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
  const copy = useSiteCopy();
  const [subState, setSubState] = useState<StepASubState>('initial');
  const [countdownSec, setCountdownSec] = useState<number>(3);
  const waitTimerRef = useRef<number | null>(null);
  const countdownIntervalRef = useRef<number | null>(null);

  const clearWaitTimer = () => {
    if (waitTimerRef.current !== null) {
      window.clearTimeout(waitTimerRef.current);
      waitTimerRef.current = null;
    }
    if (countdownIntervalRef.current !== null) {
      window.clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
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
    setCountdownSec(3);
    setSubState('wait_3_sec');
    countdownIntervalRef.current = window.setInterval(() => {
      setCountdownSec((prev) => (prev > 1 ? prev - 1 : 1));
    }, 1000);
    waitTimerRef.current = window.setTimeout(() => {
      clearWaitTimer();
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
            <span>{copy.stepA.homeBtn}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleResetToInitial}
            className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm text-[#E8DDD0]/85 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>{copy.stepA.backBtn}</span>
          </button>
        )}
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
        {subState === 'initial' && (
          <div className="animate-scene-enter space-y-8 w-full max-w-md">
            <h1
              className="font-display text-2xl sm:text-3xl font-semibold text-[#F6EFE6] leading-relaxed drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]"
              style={{ textWrap: 'balance' }}
            >
              {copy.stepA.initialQuestion}
            </h1>

            <div className="flex flex-row items-center justify-center gap-4">
              <button
                type="button"
                onClick={handleFirstYes}
                className="night-glass-btn-active min-w-[116px] min-h-[46px] px-7 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copy.stepA.yesBtn}
              </button>
              <button
                type="button"
                onClick={handleFirstNo}
                className="night-glass-btn min-w-[116px] min-h-[46px] px-7 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copy.stepA.noBtn}
              </button>
            </div>
          </div>
        )}

        {subState === 'wait_3_sec' && (
          <div
            aria-live="polite"
            className="animate-scene-enter px-10 py-7 rounded-2xl bg-black/55 backdrop-blur-md border border-[#E8DDD0]/25 space-y-2.5 shadow-2xl"
          >
            <p className="font-display text-2xl font-semibold text-[#F6EFE6]">
              {copy.stepA.waitMessage}
            </p>
            <p className="font-display text-xl text-[#F5CA7B] tabular-nums">
              {countdownSec}...
            </p>
            <p className="text-xs text-[#E8DDD0]/60">
              {copy.stepA.waitSubLabel}
            </p>
          </div>
        )}

        {subState === 'follow_up' && (
          <div className="animate-scene-enter space-y-8 w-full max-w-md" aria-live="polite">
            <h2
              className="font-display text-xl sm:text-2xl font-semibold text-[#F6EFE6] leading-relaxed drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]"
              style={{ textWrap: 'balance' }}
            >
              {copy.stepA.waitFollowUp}
            </h2>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5">
              <button
                type="button"
                onClick={handleActuallyMe}
                className="night-glass-btn-active w-full sm:w-auto min-h-[48px] px-7 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copy.stepA.actuallyMeBtn}
              </button>
              <button
                type="button"
                onClick={handleReallyNotMe}
                className="night-glass-btn w-full sm:w-auto min-h-[48px] px-7 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copy.stepA.reallyNotMeBtn}
              </button>
            </div>
          </div>
        )}

        {subState === 'polite_exit' && (
          <div
            aria-live="polite"
            className="animate-scene-enter max-w-md px-8 py-8 rounded-2xl bg-black/60 backdrop-blur-md border border-[#E8DDD0]/25 space-y-4 shadow-2xl"
          >
            <h2
              className="font-display text-xl sm:text-2xl font-semibold text-[#F6EFE6]"
              style={{ textWrap: 'balance' }}
            >
              {copy.stepA.politeExitTitle}
            </h2>
            <p className="text-sm sm:text-base text-[#E8DDD0]/85 leading-relaxed">
              {copy.stepA.politeExitBody}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
