import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from './config';
import {
  clearLocalDraft,
  createInitialDraft,
  loadDraftFromLocal,
  loadLocalSentHistory,
  removeLetterFromLocalHistory,
  ReplyLetterDraft,
  saveDraftToLocal,
  SaveStatus,
  saveViaGasWebApp,
  upsertLetterIntoLocalHistory,
} from './services/letterStorage';
import { StepCoverLanding } from './components/StepCoverLanding';
import { StepAIdentity } from './components/StepAIdentity';
import { StepBBirthday } from './components/StepBBirthday';
import { StepCDesk } from './components/StepCDesk';
import { StepDWriteReply } from './components/StepDWriteReply';
import { StepEFoldEnvelope } from './components/StepEFoldEnvelope';
import { SoundControlBar } from './components/SoundControlBar';
import { soundEngine, SoundMode } from './services/soundEngine';

import rainyWindowBg from './assets/images/rainy_window_candle_desk_1792837371636.jpg';
import nightPorchBg from './assets/images/rainy_night_house_porch_1792837373495.jpg';
import warmDeskBg from './assets/images/warm_wooden_desk_candlelight_1792837373650.jpg';

export enum AppStep {
  STEP_COVER = 'COVER',
  STEP_A_QUESTION = 'A',
  STEP_B_BIRTHDAY = 'B',
  STEP_C_DESK = 'C',
  STEP_D_REPLY = 'D',
  STEP_E_FOLD = 'E',
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<AppStep>(AppStep.STEP_COVER);

  // Sound Atmosphere State
  const [soundMode, setSoundMode] = useState<SoundMode>(() =>
    soundEngine.getMode()
  );
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(() =>
    soundEngine.getIsUnlocked()
  );

  // Draft & Local Letterbox History States
  const [draft, setDraft] = useState<ReplyLetterDraft>(() => loadDraftFromLocal());
  const [sentLetters, setSentLetters] = useState<ReplyLetterDraft[]>(() =>
    loadLocalSentHistory()
  );

  const [saveStatus, setSaveStatus] = useState<SaveStatus>(() => {
    const initial = loadDraftFromLocal();
    if (initial.version > 0 && initial.lastSavedVersion === initial.version) {
      return SaveStatus.SAVED;
    }
    return SaveStatus.UNSAVED;
  });
  const [statusMessage, setStatusMessage] = useState<string>('');

  // Concurrency, Debounce & Retry refs
  const draftRef = useRef<ReplyLetterDraft>(draft);
  const debounceTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const retryCountRef = useRef<number>(0);
  const inFlightAbortRef = useRef<AbortController | null>(null);
  const requestSeqRef = useRef<number>(0);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  // ปลดล็อกระบบเสียงอัตโนมัติทันทีที่ผู้ใช้แตะหน้าจอหรือกดปุ่มครั้งแรก (ตามกฎ Autoplay ของเบราว์เซอร์)
  useEffect(() => {
    const unlockOnce = () => {
      if (soundEngine.getMode() !== SoundMode.MUTED) {
        soundEngine.unlockAndStartIfEnabled();
        setIsAudioUnlocked(soundEngine.getIsUnlocked());
      }
    };
    window.addEventListener('pointerdown', unlockOnce, { once: true });
    window.addEventListener('keydown', unlockOnce, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockOnce);
      window.removeEventListener('keydown', unlockOnce);
    };
  }, []);

  const handleChangeSoundMode = (nextMode: SoundMode) => {
    soundEngine.setMode(nextMode);
    setSoundMode(nextMode);
    setIsAudioUnlocked(soundEngine.getIsUnlocked());
  };

  const clearTimers = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (retryTimerRef.current !== null) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
      }
    };
  }, [clearTimers]);

  /**
   * ส่งข้อมูลจดหมายไปบันทึกยัง Google Apps Script Web App จริง
   */
  const executeSave = useCallback(
    async (isFinalFold = false): Promise<boolean> => {
      const snapshot = draftRef.current;

      if (
        !snapshot.title.trim() &&
        !snapshot.author.trim() &&
        !snapshot.body.trim()
      ) {
        setSaveStatus(SaveStatus.UNSAVED);
        setStatusMessage('');
        return false;
      }

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setSaveStatus(SaveStatus.OFFLINE_PENDING);
        setStatusMessage(
          'ขณะนี้ออฟไลน์ ระบบเก็บฉบับร่างไว้ในเครื่องแล้ว และจะส่งให้อัตโนมัติเมื่อกลับมาออนไลน์'
        );
        return false;
      }

      if (inFlightAbortRef.current) {
        inFlightAbortRef.current.abort();
      }
      const controller = new AbortController();
      inFlightAbortRef.current = controller;

      const currentSeq = ++requestSeqRef.current;
      setSaveStatus(SaveStatus.SAVING);
      setStatusMessage('');

      try {
        const result = await saveViaGasWebApp({
          draft: snapshot,
          isFinalFold,
          signal: controller.signal,
        });

        if (currentSeq !== requestSeqRef.current) {
          return false;
        }

        if (result.ok) {
          retryCountRef.current = 0;

          setDraft((prev) => {
            const updated: ReplyLetterDraft = {
              ...prev,
              lastSavedVersion: Math.max(prev.lastSavedVersion, result.version),
              lastSavedIso: result.savedAt,
              recoveryState:
                isFinalFold && prev.version === result.version
                  ? 'completed'
                  : prev.recoveryState === 'completed'
                  ? 'completed'
                  : 'synced',
            };
            saveDraftToLocal(updated);
            setSentLetters(upsertLetterIntoLocalHistory(updated));
            return updated;
          });

          if (draftRef.current.version <= result.version) {
            setSaveStatus(SaveStatus.SAVED);
            setStatusMessage('');
            return true;
          } else {
            setSaveStatus(SaveStatus.UNSAVED);
            return false;
          }
        } else {
          setSaveStatus(SaveStatus.ERROR);
          setStatusMessage(
            result.message || 'บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง'
          );

          const nonRetryableCodes = ['MISSING_GAS_URL', 'RATE_LIMITED'];
          if (
            !nonRetryableCodes.includes(result.errorCode || '') &&
            retryCountRef.current < APP_CONFIG.maxRetryAttempts
          ) {
            retryCountRef.current += 1;
            const backoffMs = Math.min(
              16000,
              1500 * Math.pow(2, retryCountRef.current)
            );
            if (retryTimerRef.current !== null) {
              window.clearTimeout(retryTimerRef.current);
            }
            retryTimerRef.current = window.setTimeout(() => {
              void executeSave(false);
            }, backoffMs);
          }

          return false;
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return false;
        }
        if (currentSeq !== requestSeqRef.current) {
          return false;
        }

        const isOfflineNow =
          typeof navigator !== 'undefined' && !navigator.onLine;
        if (isOfflineNow) {
          setSaveStatus(SaveStatus.OFFLINE_PENDING);
          setStatusMessage(
            'การเชื่อมต่ออินเทอร์เน็ตขาดหาย ระบบเก็บข้อความไว้ในเครื่องแล้ว และจะส่งใหม่เมื่อออนไลน์'
          );
        } else {
          setSaveStatus(SaveStatus.ERROR);
          setStatusMessage(
            'เกิดข้อผิดพลาดในการเชื่อมต่อระบบบันทึก ข้อมูลในเครื่องยังอยู่ครบถ้วน'
          );

          if (retryCountRef.current < APP_CONFIG.maxRetryAttempts) {
            retryCountRef.current += 1;
            const backoffMs = Math.min(
              16000,
              1500 * Math.pow(2, retryCountRef.current)
            );
            if (retryTimerRef.current !== null) {
              window.clearTimeout(retryTimerRef.current);
            }
            retryTimerRef.current = window.setTimeout(() => {
              void executeSave(false);
            }, backoffMs);
          }
        }
        return false;
      }
    },
    []
  );

  // เมื่ออินเทอร์เน็ตกลับมาออนไลน์ ให้ลองบันทึกฉบับร่างที่ค้างอยู่อัตโนมัติ
  useEffect(() => {
    const handleOnline = () => {
      const current = draftRef.current;
      const hasUnsyncedChanges =
        current.version > current.lastSavedVersion &&
        (current.title.trim() || current.author.trim() || current.body.trim());

      if (hasUnsyncedChanges) {
        retryCountRef.current = 0;
        void executeSave(false);
      }
    };

    const handleOffline = () => {
      const current = draftRef.current;
      if (current.version > current.lastSavedVersion) {
        setSaveStatus(SaveStatus.OFFLINE_PENDING);
        setStatusMessage(
          'ออฟไลน์ กำลังรอส่งข้อมูลเมื่ออินเทอร์เน็ตกลับมาเชื่อมต่อ'
        );
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [executeSave]);

  const handleUpdateDraftField = (
    field: 'title' | 'author' | 'body',
    value: string
  ) => {
    setDraft((prev) => {
      const nextVersion = prev.version + 1;
      const updated: ReplyLetterDraft = {
        ...prev,
        [field]: value,
        version: nextVersion,
        lastModifiedIso: new Date().toISOString(),
        recoveryState: 'draft',
      };
      draftRef.current = updated;
      saveDraftToLocal(updated);
      return updated;
    });

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSaveStatus(SaveStatus.OFFLINE_PENDING);
    } else {
      setSaveStatus(SaveStatus.UNSAVED);
    }

    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = window.setTimeout(() => {
      debounceTimerRef.current = null;
      retryCountRef.current = 0;
      void executeSave(false);
    }, APP_CONFIG.autosaveDebounceMs);
  };

  const handleStartNewReply = () => {
    clearTimers();
    // บันทึกฉบับเดิมที่เคยมีเนื้อหาไว้ในประวัติกล่องจดหมายก่อนเริ่มฉบับใหม่
    const prev = draftRef.current;
    if (prev.title.trim() || prev.body.trim()) {
      setSentLetters(upsertLetterIntoLocalHistory(prev));
    }

    const fresh = createInitialDraft();
    draftRef.current = fresh;
    setDraft(fresh);
    saveDraftToLocal(fresh);
    setSaveStatus(SaveStatus.UNSAVED);
    setStatusMessage('');
    setCurrentStep(AppStep.STEP_D_REPLY);
  };

  const handleContinueOrStartReply = () => {
    clearTimers();
    // หากฉบับปัจจุบันพับเก็บเสร็จสมบูรณ์แล้ว การกด "เขียนจดหมายตอบกลับ" จะเปิดกระดาษแผ่นใหม่ให้อัตโนมัติ
    if (draftRef.current.recoveryState === 'completed') {
      handleStartNewReply();
      return;
    }
    setCurrentStep(AppStep.STEP_D_REPLY);
  };

  const handleEditSpecificReply = (targetDraft: ReplyLetterDraft) => {
    clearTimers();
    const prev = draftRef.current;
    if (
      prev.letterId !== targetDraft.letterId &&
      (prev.title.trim() || prev.body.trim())
    ) {
      setSentLetters(upsertLetterIntoLocalHistory(prev));
    }

    draftRef.current = targetDraft;
    setDraft(targetDraft);
    saveDraftToLocal(targetDraft);

    if (
      targetDraft.version > 0 &&
      targetDraft.lastSavedVersion >= targetDraft.version
    ) {
      setSaveStatus(SaveStatus.SAVED);
    } else {
      setSaveStatus(SaveStatus.UNSAVED);
    }
    setStatusMessage('');
    setCurrentStep(AppStep.STEP_D_REPLY);
  };

  const handleFinishAndFold = async () => {
    clearTimers();
    soundEngine.playPaperFoldSfx();

    if (draftRef.current.version === 0) {
      const bumped: ReplyLetterDraft = {
        ...draftRef.current,
        version: 1,
        lastModifiedIso: new Date().toISOString(),
      };
      draftRef.current = bumped;
      setDraft(bumped);
      saveDraftToLocal(bumped);
    }

    setCurrentStep(AppStep.STEP_E_FOLD);

    const isAlreadySynced =
      draftRef.current.version > 0 &&
      draftRef.current.lastSavedVersion >= draftRef.current.version &&
      saveStatus === SaveStatus.SAVED;

    if (isAlreadySynced) {
      const completedDraft: ReplyLetterDraft = {
        ...draftRef.current,
        recoveryState: 'completed',
      };
      draftRef.current = completedDraft;
      setDraft(completedDraft);
      saveDraftToLocal(completedDraft);
      setSentLetters(upsertLetterIntoLocalHistory(completedDraft));
    } else {
      await executeSave(true);
    }
  };

  const handleClearDraft = () => {
    clearTimers();
    const currentId = draftRef.current.letterId;
    if (draftRef.current.recoveryState !== 'completed') {
      setSentLetters(removeLetterFromLocalHistory(currentId));
    }
    const fresh = clearLocalDraft();
    setDraft(fresh);
    draftRef.current = fresh;
    setSaveStatus(SaveStatus.UNSAVED);
    setStatusMessage('ล้างฉบับร่างในเครื่องเรียบร้อยแล้ว');
  };

  const isCurrentVersionConfirmedSaved =
    draft.version > 0 &&
    draft.lastSavedVersion >= draft.version &&
    saveStatus === SaveStatus.SAVED;

  const getSceneBackground = () => {
    if (APP_CONFIG.customVisualAssets.deskBackgroundUrl) {
      return APP_CONFIG.customVisualAssets.deskBackgroundUrl;
    }
    switch (currentStep) {
      case AppStep.STEP_B_BIRTHDAY:
        return nightPorchBg;
      case AppStep.STEP_C_DESK:
      case AppStep.STEP_D_REPLY:
        return warmDeskBg;
      case AppStep.STEP_COVER:
      case AppStep.STEP_A_QUESTION:
      case AppStep.STEP_E_FOLD:
      default:
        return rainyWindowBg;
    }
  };

  return (
    <div className="relative min-h-screen flex flex-col bg-[#0F0D0C] text-[#F4EBE1] overflow-x-hidden">
      {/* ภาพพื้นหลังบรรยากาศคืนฝนตกและแสงเทียนตามฉาก พร้อม Scrim ควบคุมความชัดของตัวอักษร */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src={getSceneBackground()}
          alt=""
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover object-center transition-opacity duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/65 via-black/50 to-black/75" />
      </div>

      {/* ปุ่มควบคุมเสียงบรรยากาศมุมขวาบน */}
      <SoundControlBar
        soundMode={soundMode}
        isAudioUnlocked={isAudioUnlocked}
        onChangeSoundMode={handleChangeSoundMode}
      />

      {/* เนื้อหาหลักลอยอยู่เหนือฉากหลัง */}
      <main className="relative z-10 flex-1 flex flex-col justify-center pt-12 sm:pt-0">
        {currentStep === AppStep.STEP_COVER && (
          <StepCoverLanding
            onStart={() => {
              soundEngine.unlockAndStartIfEnabled();
              setIsAudioUnlocked(soundEngine.getIsUnlocked());
              soundEngine.playSoftTapSfx();
              setCurrentStep(AppStep.STEP_A_QUESTION);
            }}
          />
        )}

        {currentStep === AppStep.STEP_A_QUESTION && (
          <StepAIdentity
            onBackToCover={() => {
              soundEngine.playSoftTapSfx();
              setCurrentStep(AppStep.STEP_COVER);
            }}
            onProceedToBirthday={() => {
              soundEngine.playSoftTapSfx();
              setCurrentStep(AppStep.STEP_B_BIRTHDAY);
            }}
          />
        )}

        {currentStep === AppStep.STEP_B_BIRTHDAY && (
          <StepBBirthday
            onBack={() => {
              soundEngine.playSoftTapSfx();
              setCurrentStep(AppStep.STEP_A_QUESTION);
            }}
            onVerified={() => {
              soundEngine.playSoftTapSfx();
              setCurrentStep(AppStep.STEP_C_DESK);
            }}
          />
        )}

        {currentStep === AppStep.STEP_C_DESK && (
          <StepCDesk
            currentDraft={draft}
            sentLetters={sentLetters}
            onContinueOrStartReply={handleContinueOrStartReply}
            onStartNewReply={handleStartNewReply}
            onEditSpecificReply={handleEditSpecificReply}
          />
        )}

        {currentStep === AppStep.STEP_D_REPLY && (
          <StepDWriteReply
            draft={draft}
            onUpdateDraftField={handleUpdateDraftField}
            saveStatus={saveStatus}
            statusMessage={statusMessage}
            onManualRetrySave={() => {
              retryCountRef.current = 0;
              void executeSave(false);
            }}
            onRequestClearDraft={handleClearDraft}
            onBackToDesk={() => setCurrentStep(AppStep.STEP_C_DESK)}
            onFinishAndFold={() => {
              void handleFinishAndFold();
            }}
          />
        )}

        {currentStep === AppStep.STEP_E_FOLD && (
          <StepEFoldEnvelope
            draft={draft}
            saveStatus={saveStatus}
            statusMessage={statusMessage}
            isCurrentVersionConfirmedSaved={isCurrentVersionConfirmedSaved}
            onRetryFinalSave={() => {
              retryCountRef.current = 0;
              void executeSave(true);
            }}
            onBackToEditReply={() => setCurrentStep(AppStep.STEP_D_REPLY)}
            onWriteAnotherLetter={handleStartNewReply}
            onReturnToDesk={() => setCurrentStep(AppStep.STEP_C_DESK)}
          />
        )}
      </main>
    </div>
  );
}
