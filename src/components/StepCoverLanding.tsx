import React from 'react';
import { UI_COPY } from '../content/letters';
import { ArrowRight } from 'lucide-react';

interface StepCoverLandingProps {
  onStart: () => void;
}

export function StepCoverLanding({ onStart }: StepCoverLandingProps) {
  return (
    <section className="w-full max-w-lg mx-auto px-6 py-12 flex flex-col items-center justify-center min-h-[78vh] text-center">
      <div className="space-y-6">
        <h1
          className="font-display text-4xl sm:text-5xl font-semibold text-[#F6EFE6] tracking-wide drop-shadow-[0_4px_20px_rgba(0,0,0,0.85)]"
          style={{ textWrap: 'balance' }}
        >
          {UI_COPY.siteTitle}
        </h1>

        <div className="space-y-1.5 text-base sm:text-lg text-[#E8DDD0]/90 leading-relaxed drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)]">
          <p>{UI_COPY.cover.subtitleLine1}</p>
          <p>{UI_COPY.cover.subtitleLine2}</p>
        </div>

        <div className="pt-8">
          <button
            type="button"
            onClick={onStart}
            className="night-glass-btn inline-flex items-center justify-center gap-3 min-h-[48px] px-9 py-3 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>{UI_COPY.cover.startBtn}</span>
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </section>
  );
}
