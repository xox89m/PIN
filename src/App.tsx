import React, { useCallback, useEffect, useRef, useState } from 'react';
import { APP_CONFIG } from './config';
import { LetterDocument, SiteCopy } from './content/letters';
import { SiteCopyContext } from './context/SiteCopyContext';
import {
  clearLocalDraft,
  createInitialDraft,
  fetchOwnerConfigFromCloud,
  loadDraftFromLocal,
  loadLocalSentHistory,
  loadOwnerLettersFromLocal,
  loadSiteCopyFromLocal,
  removeLetterFromLocalHistory,
  ReplyLetterDraft,
  resetOwnerLettersInLocal,
  resetSiteCopyInLocal,
  saveDraftToLocal,
  saveOwnerLettersToLocal,
  saveSiteCopyToLocal,
  SaveStatus,
  saveViaGasWebApp,
  syncAdminOwnerLetterToDrive,
  syncAdminSiteCopyToDrive,
  upsertLetterIntoLocalHistory,
} from './services/letterStorage';
import { StepCoverLanding } from './components/StepCoverLanding';
import { StepAIdentity } from './components/StepAIdentity';
import { StepBBirthday } from './components/StepBBirthday';
import { StepCDesk } from './components/StepCDesk';
import { StepDWriteReply } from './components/StepDWriteReply';
import { StepEFoldEnvelope } from './components/StepEFoldEnvelope';
import { SoundControlBar } from './components/SoundControlBar';
import { AdminGlobalBar, StepKey } from './components/AdminGlobalBar';
import { AmbientAtmosphere, LivingSceneId } from './components/AmbientAtmosphere';
import { soundEngine, SoundMode } from './services/soundEngine';

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
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  // Sound Atmosphere & Playlist State
  const [soundMode, setSoundMode] = useState<SoundMode>(() =>
    soundEngine.getMode()
  );
  const [musicVolume, setMusicVolume] = useState<number>(() =>
    soundEngine.getMusicVolume()
  );
  const [currentTrackIndex, setCurrentTrackIndex] = useState<number>(() =>
    soundEngine.getCurrentTrackIndex()
  );
  const [isAudioUnlocked, setIsAudioUnlocked] = useState<boolean>(() =>
    soundEngine.getIsUnlocked()
  );

  // Owner Letters, Dynamic UI Copy & Reply Draft/History States
  const [siteCopy, setSiteCopy] = useState<SiteCopy>(() =>
    loadSiteCopyFromLocal()
  );
  const [ownerLetters, setOwnerLetters] = useState<LetterDocument[]>(() =>
    loadOwnerLettersFromLocal()
  );
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

  // ซิงก์สถานะเพลงและเสียงกับ soundEngine (เช่น เมื่อเพลงจบแล้วเลื่อนไปเพลงถัดไปอัตโนมัติ)
  useEffect(() => {
    return soundEngine.subscribe(() => {
      setSoundMode(soundEngine.getMode());
      setMusicVolume(soundEngine.getMusicVolume());
      setCurrentTrackIndex(soundEngine.getCurrentTrackIndex());
      setIsAudioUnlocked(soundEngine.getIsUnlocked());
    });
  }, []);

  // อัปเดตชื่อแท็บหน้าเว็บตาม siteTitle ที่แอดมินตั้งไว้
  useEffect(() => {
    if (siteCopy.siteTitle.trim()) {
      document.title = siteCopy.siteTitle.trim();
    }
  }, [siteCopy.siteTitle]);

  // โหลดจดหมายหลักและข้อความหน้าเว็บของแอดมินที่ซิงก์ไว้บน Cloud (ถ้ามี)
  useEffect(() => {
    void fetchOwnerConfigFromCloud().then(({ ownerLetters: cloudDocs, siteCopy: cloudCopy }) => {
      if (cloudDocs && cloudDocs.length > 0) {
        setOwnerLetters(cloudDocs);
      }
      if (cloudCopy) {
        setSiteCopy(cloudCopy);
      }
    });
  }, []);

  // ปลดล็อกระบบเสียงอัตโนมัติทันทีที่ผู้ใช้แตะหน้าจอหรือกดปุ่มครั้งแรก
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
  };

  const handleChangeMusicVolume = (nextVol: number) => {
    soundEngine.setMusicVolume(nextVol);
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
   * ส่งข้อมูลจดหมายตอบกลับไปบันทึกยัง Google Apps Script Web App จริง
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

  // ฟังก์ชันจัดการจดหมายสำหรับแอดมิน (28 สิงหาคม 2111)
  const handleSaveOwnerLetter = async (
    updatedDoc: LetterDocument
  ): Promise<boolean> => {
    const existingIdx = ownerLetters.findIndex((d) => d.id === updatedDoc.id);
    const nextList =
      existingIdx >= 0
        ? ownerLetters.map((d, i) => (i === existingIdx ? updatedDoc : d))
        : [...ownerLetters, updatedDoc];

    setOwnerLetters(nextList);
    saveOwnerLettersToLocal(nextList);
    return syncAdminOwnerLetterToDrive(updatedDoc, nextList);
  };

  const handleDeleteExtraOwnerLetter = (docId: string) => {
    if (docId === 'apology' || docId === 'birthday') return;
    const nextList = ownerLetters.filter((d) => d.id !== docId);
    setOwnerLetters(nextList);
    saveOwnerLettersToLocal(nextList);
    const apology = nextList.find((d) => d.id === 'apology');
    if (apology) {
      void syncAdminOwnerLetterToDrive(apology, nextList);
    }
  };

  const handleResetOwnerLetters = () => {
    const defaults = resetOwnerLettersInLocal();
    setOwnerLetters(defaults);
    if (defaults[0]) {
      void syncAdminOwnerLetterToDrive(defaults[0], defaults);
    }
  };

  // ฟังก์ชันแก้ไขและคืนค่าคำพูดทุกหน้าสำหรับแอดมิน
  const handleSaveSiteCopy = async (nextCopy: SiteCopy): Promise<boolean> => {
    setSiteCopy(nextCopy);
    saveSiteCopyToLocal(nextCopy);
    return syncAdminSiteCopyToDrive(nextCopy);
  };

  const handleResetSiteCopy = () => {
    const defaults = resetSiteCopyInLocal();
    setSiteCopy(defaults);
    void syncAdminSiteCopyToDrive(defaults);
  };

  const handleAdminSaveReplyLetter = async (
    updatedReply: ReplyLetterDraft
  ): Promise<boolean> => {
    if (draftRef.current.letterId === updatedReply.letterId) {
      draftRef.current = updatedReply;
      setDraft(updatedReply);
      saveDraftToLocal(updatedReply);
    }
    setSentLetters(upsertLetterIntoLocalHistory(updatedReply));

    try {
      const res = await saveViaGasWebApp({
        draft: updatedReply,
        isFinalFold: updatedReply.recoveryState === 'completed',
      });
      if (res.ok) {
        const syncedCopy: ReplyLetterDraft = {
          ...updatedReply,
          lastSavedVersion: Math.max(updatedReply.lastSavedVersion, res.version),
          lastSavedIso: res.savedAt,
        };
        if (draftRef.current.letterId === syncedCopy.letterId) {
          draftRef.current = syncedCopy;
          setDraft(syncedCopy);
          saveDraftToLocal(syncedCopy);
        }
        setSentLetters(upsertLetterIntoLocalHistory(syncedCopy));
        return true;
      }
    } catch {
      // Ignore network failure - local copy is already saved
    }
    return false;
  };

  const handleAdminDeleteReplyLetter = (letterId: string) => {
    setSentLetters(removeLetterFromLocalHistory(letterId));
    if (draftRef.current.letterId === letterId) {
      const fresh = clearLocalDraft();
      draftRef.current = fresh;
      setDraft(fresh);
      setSaveStatus(SaveStatus.UNSAVED);
    }
  };

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
    soundEngine.playPaperOpenSfx();
    setCurrentStep(AppStep.STEP_D_REPLY);
  };

  const handleContinueOrStartReply = () => {
    clearTimers();
    if (draftRef.current.recoveryState === 'completed') {
      handleStartNewReply();
      return;
    }
    soundEngine.playPaperOpenSfx();
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
    soundEngine.playPaperOpenSfx();
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

  const getLivingSceneId = (): LivingSceneId => {
    switch (currentStep) {
      case AppStep.STEP_B_BIRTHDAY:
        return 'night_porch';
      case AppStep.STEP_C_DESK:
      case AppStep.STEP_D_REPLY:
        return 'warm_desk';
      case AppStep.STEP_COVER:
      case AppStep.STEP_A_QUESTION:
      case AppStep.STEP_E_FOLD:
      default:
        return 'rainy_window';
    }
  };

  return (
    <SiteCopyContext.Provider value={siteCopy}>
      <div className="relative min-h-screen flex flex-col bg-[#0F0D0C] text-[#F4EBE1] overflow-x-hidden">
        {/* พื้นหลังมีชีวิตชีวา: สายฝนตกด้านนอก หยดน้ำไหลตามกระจกหน้าต่าง และเปลวไฟเทียนพริ้วไหวตรงพิกัดเทียนจริง */}
        <AmbientAtmosphere
          sceneId={getLivingSceneId()}
          customBgUrl={
            APP_CONFIG.customVisualAssets.deskBackgroundUrl || undefined
          }
        />

        {/* แถบเครื่องมือแอดมินมุมซ้ายบน (มีปุ่มกลับหน้าแรก แก้ไขคำได้ทุกหน้า และข้ามไปหน้าใดก็ได้) */}
        {isAdmin && (
          <AdminGlobalBar
            currentStep={currentStep as StepKey}
            siteCopy={siteCopy}
            onJumpToStep={(step) => setCurrentStep(step as AppStep)}
            onSaveSiteCopy={handleSaveSiteCopy}
            onResetSiteCopy={handleResetSiteCopy}
            onExitAdminMode={() => setIsAdmin(false)}
          />
        )}

        {/* ปุ่มควบคุมเสียงเพลงและเสียงกระดาษมุมขวาบน */}
        <SoundControlBar
          soundMode={soundMode}
          musicVolume={musicVolume}
          tracks={soundEngine.getTracks()}
          currentTrackIndex={currentTrackIndex}
          isAudioUnlocked={isAudioUnlocked}
          onChangeSoundMode={handleChangeSoundMode}
          onChangeMusicVolume={handleChangeMusicVolume}
          onSelectTrack={(idx) => soundEngine.selectTrack(idx)}
          onNextTrack={() => soundEngine.nextTrack()}
        />

        <main
          className={`relative z-10 flex-1 flex flex-col justify-center ${
            isAdmin ? 'pt-16' : 'pt-12 sm:pt-0'
          }`}
        >
          {currentStep === AppStep.STEP_COVER && (
            <StepCoverLanding
              onStart={() => {
                soundEngine.unlockAndStartIfEnabled();
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
                setIsAdmin(false);
                setCurrentStep(AppStep.STEP_C_DESK);
              }}
              onAdminVerified={() => {
                soundEngine.playSoftTapSfx();
                setIsAdmin(true);
                setCurrentStep(AppStep.STEP_C_DESK);
              }}
            />
          )}

          {currentStep === AppStep.STEP_C_DESK && (
            <StepCDesk
              isAdmin={isAdmin}
              ownerLetters={ownerLetters}
              currentDraft={draft}
              sentLetters={sentLetters}
              onSaveOwnerLetter={handleSaveOwnerLetter}
              onDeleteExtraOwnerLetter={handleDeleteExtraOwnerLetter}
              onResetOwnerLetters={handleResetOwnerLetters}
              onAdminSaveReplyLetter={handleAdminSaveReplyLetter}
              onAdminDeleteReplyLetter={handleAdminDeleteReplyLetter}
              onReturnToCover={() => {
                soundEngine.playSoftTapSfx();
                setCurrentStep(AppStep.STEP_COVER);
              }}
              onExitAdminMode={() => setIsAdmin(false)}
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
    </SiteCopyContext.Provider>
  );
}
