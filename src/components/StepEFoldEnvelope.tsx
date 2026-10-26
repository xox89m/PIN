import React, { useEffect, useRef, useState } from 'react';
import { useSiteCopy } from '../context/SiteCopyContext';
import { ReplyLetterDraft, SaveStatus } from '../services/letterStorage';
import { PublishResult } from '../services/cloudConfigSync';
import {
  GoldenEnvelopeIllustration,
  HandDrawnPenIllustration,
} from './EnvelopeIllustrations';
import { RotateCw, AlertCircle, CheckCircle2, Globe, Check } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';

interface StepEFoldEnvelopeProps {
  draft: ReplyLetterDraft;
  saveStatus: SaveStatus;
  statusMessage: string;
  isCurrentVersionConfirmedSaved: boolean;
  isReplySharedPublicly: boolean;
  onPublishReplyToEveryone: () => Promise<PublishResult>;
  onRetryFinalSave: () => void;
  onBackToEditReply: () => void;
  onWriteAnotherLetter: () => void;
  onReturnToDesk: () => void;
}

type FoldAnimPhase = 'verifying_save' | 'folding_paper' | 'sealed_done';

export function StepEFoldEnvelope({
  draft,
  saveStatus,
  statusMessage,
  isCurrentVersionConfirmedSaved,
  isReplySharedPublicly,
  onPublishReplyToEveryone,
  onRetryFinalSave,
  onBackToEditReply,
  onWriteAnotherLetter,
  onReturnToDesk,
}: StepEFoldEnvelopeProps) {
  const copy = useSiteCopy();
  const [animPhase, setAnimPhase] = useState<FoldAnimPhase>('verifying_save');
  const [isSharing, setIsSharing] = useState(false);
  const [shareFeedback, setShareFeedback] = useState('');
  const foldTimerRef = useRef<number | null>(null);

  const clearTimers = () => {
    if (foldTimerRef.current !== null) {
      window.clearTimeout(foldTimerRef.current);
      foldTimerRef.current = null;
    }
  };

  useEffect(() => {
    clearTimers();

    if (isCurrentVersionConfirmedSaved && saveStatus === SaveStatus.SAVED) {
      setAnimPhase('folding_paper');
      foldTimerRef.current = window.setTimeout(() => {
        setAnimPhase('sealed_done');
      }, 2200);
    } else {
      setAnimPhase('verifying_save');
    }

    return () => {
      clearTimers();
    };
  }, [isCurrentVersionConfirmedSaved, saveStatus]);

  const handleSkipAnimation = () => {
    if (!isCurrentVersionConfirmedSaved) return;
    clearTimers();
    setAnimPhase('sealed_done');
  };

  return (
    <section className="relative w-full max-w-2xl mx-auto px-5 py-8 flex flex-col items-center justify-center min-h-[78vh] text-center">
      {saveStatus === SaveStatus.SAVING && (
        <div
          className="px-8 py-10 rounded-3xl bg-black/55 backdrop-blur-md border border-[#E8DDD0]/20 space-y-4 max-w-md w-full"
          aria-live="polite"
        >
          <RotateCw className="w-8 h-8 mx-auto text-[#F0D5A8] animate-spin" />
          <h2 className="font-display text-xl sm:text-2xl font-semibold text-[#F6EFE6]">
            {copy.stepE.savingOverlayTitle}
          </h2>
          <p className="text-sm text-[#E8DDD0]/80 leading-relaxed">
            {copy.stepE.savingOverlayBody}
          </p>
        </div>
      )}

      {saveStatus !== SaveStatus.SAVING && !isCurrentVersionConfirmedSaved && (
        <div
          className="px-7 py-8 rounded-3xl bg-[#241411]/85 backdrop-blur-md border border-[#E5988E]/40 space-y-5 max-w-lg w-full"
          role="alert"
        >
          <div className="w-12 h-12 mx-auto rounded-full bg-[#4A201A] flex items-center justify-center text-[#FADCD8]">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="space-y-2">
            <h2
              className="font-display text-xl sm:text-2xl font-semibold text-[#FADCD8]"
              style={{ textWrap: 'balance' }}
            >
              {copy.stepE.unsavedWarningTitle}
            </h2>
            <p className="text-sm sm:text-base text-[#E8DDD0]/85 leading-relaxed">
              {copy.stepE.unsavedWarningBody}
            </p>
            {statusMessage && (
              <p className="text-xs sm:text-sm font-medium text-[#F5B5AC] pt-1">
                {statusMessage}
              </p>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={onRetryFinalSave}
              className="night-glass-btn-active w-full sm:w-auto min-h-[48px] px-7 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.stepE.retrySaveBtn}
            </button>
            <button
              type="button"
              onClick={onBackToEditReply}
              className="night-glass-btn w-full sm:w-auto min-h-[48px] px-6 py-2.5 text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.stepE.backToWriteBtn}
            </button>
          </div>
        </div>
      )}

      {isCurrentVersionConfirmedSaved && animPhase === 'folding_paper' && (
        <div className="animate-scene-enter w-full space-y-6 py-4" aria-live="polite">
          <div className="space-y-2">
            <CheckCircle2 className="w-10 h-10 mx-auto text-[#F6EFE6] stroke-[1.6]" />
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[#F6EFE6] drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)]">
              {copy.stepE.savedHeading}
            </h2>
            <p className="text-sm sm:text-base text-[#E8DDD0]/85">
              {copy.stepE.savedSubheading}
            </p>
          </div>

          <div className="max-w-xs mx-auto">
            <GoldenEnvelopeIllustration
              isOpen={true}
              isLetterPulledOut={false}
              isFoldingBack={true}
              disabled={true}
            />
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={onReturnToDesk}
              className="night-glass-btn min-h-[48px] px-8 py-2.5 text-sm sm:text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.stepE.backToDeskBtn}
            </button>
          </div>

          <div className="pt-4 sm:pt-0 sm:fixed sm:bottom-6 sm:right-8">
            <button
              type="button"
              onClick={handleSkipAnimation}
              className="min-h-[44px] px-4 py-2 text-xs sm:text-sm text-[#E8DDD0]/80 underline underline-offset-4 hover:text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.stepE.skipAnimationBtn}
            </button>
          </div>
        </div>
      )}

      {isCurrentVersionConfirmedSaved && animPhase === 'sealed_done' && (
        <div className="animate-scene-enter w-full space-y-6 py-4" aria-live="polite">
          <div className="space-y-2">
            <h2
              className="font-display text-xl sm:text-2xl font-semibold text-[#F6EFE6] leading-relaxed drop-shadow-[0_3px_16px_rgba(0,0,0,0.9)]"
              style={{ textWrap: 'balance' }}
            >
              {copy.stepE.thankYouTitle}
              <br />
              {copy.stepE.thankYouSubtitle}
            </h2>
            {copy.stepE.heartSymbol.trim() !== '' && (
              <p className="text-xl text-[#F5CA7B] animate-heart-warmth">
                {copy.stepE.heartSymbol}
              </p>
            )}
          </div>

          <div className="max-w-[290px] mx-auto pt-2 animate-envelope-idle">
            <GoldenEnvelopeIllustration
              isOpen={false}
              isLetterPulledOut={false}
              isFoldingBack={false}
              disabled={true}
            />
          </div>

          <div className="max-w-xs mx-auto flex justify-end">
            <HandDrawnPenIllustration className="w-40 h-auto transform rotate-12" />
          </div>

          <p className="text-xs text-[#E8DDD0]/65 tabular-nums">
            {copy.stepE.referenceCodeLabel}{' '}
            <span className="font-mono">{draft.letterId}</span>
          </p>

          {isReplySharedPublicly ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-[#C6F2D2]">
              <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>วางไว้ในกล่องจดหมายกลางแล้ว ทุกคนสามารถเปิดอ่านได้</span>
            </p>
          ) : (
            <div className="space-y-1.5">
              <button
                type="button"
                disabled={isSharing}
                onClick={() => {
                  setIsSharing(true);
                  setShareFeedback('');
                  soundEngine.playSoftTapSfx();
                  void onPublishReplyToEveryone().then((res) => {
                    setIsSharing(false);
                    if (!res.ok && res.errorMessage) {
                      setShareFeedback(res.errorMessage);
                    }
                  });
                }}
                className="night-glass-btn inline-flex items-center justify-center gap-2 min-h-[42px] px-5 py-2 text-xs sm:text-sm text-[#F7DFB2] whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>
                  {isSharing
                    ? 'กำลังวางจดหมายลงกล่องกลาง...'
                    : 'วางจดหมายฉบับนี้ลงกล่องกลางให้ทุกคนอ่านได้'}
                </span>
              </button>
              {shareFeedback && (
                <p className="text-xs text-[#FADCD8]">{shareFeedback}</p>
              )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={onReturnToDesk}
              className="night-glass-btn-active min-h-[48px] px-8 py-2.5 text-sm sm:text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.stepE.backToDeskBtn}
            </button>
            <button
              type="button"
              onClick={onWriteAnotherLetter}
              className="night-glass-btn min-h-[48px] px-6 py-2.5 text-sm sm:text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.stepE.writeAnotherBtn}
            </button>
          </div>

          <div>
            <button
              type="button"
              onClick={onBackToEditReply}
              className="min-h-[44px] px-4 py-2 text-xs sm:text-sm text-[#E8DDD0]/75 hover:text-white underline underline-offset-4 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copy.stepE.editAgainBtn}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
