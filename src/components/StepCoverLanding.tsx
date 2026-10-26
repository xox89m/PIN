import React from 'react';
import { useSiteCopy } from '../context/SiteCopyContext';
import { MiniEnvelopeIcon } from './EnvelopeIllustrations';
import { ArrowRight } from 'lucide-react';

interface StepCoverLandingProps {
  onStart: () => void;
}

export function StepCoverLanding({ onStart }: StepCoverLandingProps) {
  const copy = useSiteCopy();

  return (
    <section className="w-full max-w-lg mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-[78vh] text-center">
      <div className="space-y-6">
        <div className="animate-scene-enter flex justify-center pb-1">
          <div className="animate-envelope-idle drop-shadow-[0_10px_22px_rgba(0,0,0,0.65)]">
            <MiniEnvelopeIcon variant="gold" className="w-14 h-10" />
          </div>
        </div>

        <h1
          className="animate-scene-enter font-display text-4xl sm:text-5xl font-semibold text-[#F6EFE6] tracking-wide drop-shadow-[0_4px_20px_rgba(0,0,0,0.85)]"
          style={{ textWrap: 'balance' }}
        >
          {copy.siteTitle}
        </h1>

        <div className="animate-scene-enter-delay-1 space-y-1.5 text-base sm:text-lg text-[#E8DDD0]/90 leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
          <p>{copy.cover.subtitleLine1}</p>
          <p>{copy.cover.subtitleLine2}</p>
        </div>

        <div className="animate-scene-enter-delay-2 pt-7 flex flex-col items-center">
          <button
            type="button"
            onClick={onStart}
            className="group night-glass-btn-active inline-flex items-center justify-center gap-3 min-h-[50px] px-10 py-3 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{copy.cover.startBtn}</span>
            <ArrowRight
              className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-1"
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </section>
  );
}
