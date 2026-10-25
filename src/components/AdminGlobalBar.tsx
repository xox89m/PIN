import React, { useEffect, useRef, useState } from 'react';
import { SiteCopy } from '../content/letters';
import { soundEngine } from '../services/soundEngine';
import {
  Check,
  ChevronDown,
  Eye,
  Home,
  Pencil,
  RotateCcw,
  Save,
  X,
} from 'lucide-react';

export type StepKey = 'COVER' | 'A' | 'B' | 'C' | 'D' | 'E';

interface AdminGlobalBarProps {
  currentStep: StepKey;
  siteCopy: SiteCopy;
  onJumpToStep: (step: StepKey) => void;
  onSaveSiteCopy: (nextCopy: SiteCopy) => Promise<boolean>;
  onResetSiteCopy: () => void;
  onExitAdminMode: () => void;
}

const STEP_LABELS: Array<{ key: StepKey; shortLabel: string; fullLabel: string }> = [
  { key: 'COVER', shortLabel: '1. หน้าแรก', fullLabel: 'หน้า 1: หน้าปกเว็บไซต์' },
  { key: 'A', shortLabel: '2. หน้าถามใช่/ไม่', fullLabel: 'หน้า 2: คำถามยืนยันตัวตน' },
  { key: 'B', shortLabel: '3. หน้าวันเกิด', fullLabel: 'หน้า 3: ถามวันเกิด' },
  { key: 'C', shortLabel: '4. โต๊ะจดหมาย', fullLabel: 'หน้า 4: โต๊ะและกล่องจดหมาย' },
  { key: 'D', shortLabel: '5. หน้าเขียนตอบ', fullLabel: 'หน้า 5: เขียนจดหมายตอบกลับ' },
  { key: 'E', shortLabel: '6. หน้าพับซอง', fullLabel: 'หน้า 6: พับซองและขอบคุณ' },
];

const IGNORED_MODIFIER_KEYS = new Set([
  'Shift',
  'Control',
  'Alt',
  'Meta',
  'CapsLock',
  'Tab',
  'Escape',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
]);

export function AdminGlobalBar({
  currentStep,
  siteCopy,
  onJumpToStep,
  onSaveSiteCopy,
  onResetSiteCopy,
  onExitAdminMode,
}: AdminGlobalBarProps) {
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<StepKey>(currentStep);
  const [draftCopy, setDraftCopy] = useState<SiteCopy>(siteCopy);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftCopy(siteCopy);
  }, [siteCopy]);

  useEffect(() => {
    if (!navMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setNavMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
    };
  }, [navMenuOpen]);

  const openCopyEditorForCurrentPage = () => {
    soundEngine.playPaperOpenSfx();
    setDraftCopy(structuredClone(siteCopy));
    setEditingTab(currentStep);
    setFeedbackMsg('');
    setConfirmReset(false);
    setEditorOpen(true);
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!IGNORED_MODIFIER_KEYS.has(e.key) && e.key !== 'Unidentified') {
      soundEngine.playWritingKeystrokeSfx(e.key);
    }
  };

  const handleSaveCopySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setFeedbackMsg('');
    soundEngine.playSoftTapSfx();

    const synced = await onSaveSiteCopy(draftCopy);
    setIsSaving(false);
    setFeedbackMsg(
      synced
        ? 'บันทึกคำในหน้าเว็บและสำรองลง Google Drive เรียบร้อยแล้ว'
        : 'บันทึกคำในหน้าเว็บลงเครื่องเรียบร้อยแล้ว'
    );
  };

  const renderField = (
    id: string,
    label: string,
    value: string,
    onChange: (val: string) => void,
    multiline = false
  ) => (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-xs sm:text-sm font-semibold text-[#2B1F16]">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={3}
          value={value}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            soundEngine.playWritingKeystrokeSfx();
            onChange(e.target.value);
          }}
          className="parchment-input w-full p-3 text-sm leading-relaxed resize-y"
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onKeyDown={handleKeyDown}
          onChange={(e) => {
            soundEngine.playWritingKeystrokeSfx();
            onChange(e.target.value);
          }}
          className="parchment-input w-full min-h-[42px] px-3 py-1.5 text-sm"
        />
      )}
    </div>
  );

  return (
    <>
      {/* แถบเครื่องมือแอดมินมุมซ้ายบน แสดงทุกหน้าเพื่อให้กลับหน้าแรกหรือแก้ไขคำได้ทุกหน้า */}
      <div
        ref={navRef}
        className="fixed top-4 left-4 z-30 flex flex-wrap items-center gap-1.5 max-w-[calc(100vw-180px)] sm:max-w-none"
      >
        {/* ปุ่มกลับไปหน้าแรกทันทีสำหรับแอดมิน */}
        <button
          type="button"
          onClick={() => {
            soundEngine.playSoftTapSfx();
            onJumpToStep('COVER');
          }}
          title="กลับไปหน้าแรก"
          className={` inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer shadow-lg ${
            currentStep === 'COVER' ? 'night-glass-btn-active' : 'night-glass-btn'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>หน้าแรก</span>
        </button>

        {/* ปุ่มแก้ไขข้อความ/คำพูดในหน้านี้ (และทุกหน้า) */}
        <button
          type="button"
          onClick={openCopyEditorForCurrentPage}
          className="night-glass-btn-active inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer shadow-lg"
        >
          <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>แก้ไขคำหน้านี้</span>
        </button>

        {/* เมนูข้ามไปแก้ไขหน้าอื่น ๆ ได้ทันทีโดยไม่ต้องกรอกวันเกิดใหม่ */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setNavMenuOpen((prev) => !prev)}
            aria-expanded={navMenuOpen}
            className="night-glass-btn inline-flex items-center gap-1.5 min-h-[42px] px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer shadow-lg"
          >
            <span>แอดมิน: เลือกหน้า</span>
            <ChevronDown
              className={`w-3.5 h-3.5 transition-transform duration-150 ${
                navMenuOpen ? 'rotate-180' : ''
              }`}
              aria-hidden="true"
            />
          </button>

          {navMenuOpen && (
            <div
              role="menu"
              className="mt-2 w-60 rounded-2xl bg-[#1C1612]/95 backdrop-blur-md border border-[#EBD8C0]/35 py-2 shadow-2xl text-left overflow-hidden"
            >
              <p className="px-4 py-1 text-[11px] text-[#E8DDD0]/60">
                ข้ามไปดูหรือแก้ไขหน้าใดก็ได้
              </p>
              {STEP_LABELS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    soundEngine.playSoftTapSfx();
                    onJumpToStep(item.key);
                    setNavMenuOpen(false);
                  }}
                  className={`w-full px-4 py-2 min-h-[40px] flex items-center justify-between text-xs sm:text-sm transition-colors cursor-pointer ${
                    currentStep === item.key
                      ? 'bg-[#EBD8C0]/22 text-white font-medium'
                      : 'text-[#E8DDD0]/85 hover:bg-[#EBD8C0]/10'
                  }`}
                >
                  <span>{item.shortLabel}</span>
                  {currentStep === item.key && (
                    <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  )}
                </button>
              ))}

              <div className="border-t border-[#EBD8C0]/15 mt-1 pt-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    soundEngine.playSoftTapSfx();
                    setNavMenuOpen(false);
                    onExitAdminMode();
                  }}
                  className="w-full px-4 py-2.5 min-h-[42px] flex items-center gap-2 text-xs sm:text-sm text-[#F7DFB2] hover:bg-[#EBD8C0]/10 cursor-pointer"
                >
                  <Eye className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>ออกจากโหมดแอดมิน</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* หน้าต่างแก้ไขคำพูดทุกหน้าสำหรับแอดมิน */}
      {editorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-copy-editor-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto"
        >
          <div className="vintage-parchment w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden my-auto">
            {/* หัวหน้าต่างแก้ไขคำ */}
            <div className="px-5 sm:px-7 py-4 border-b border-[#5C442E]/25 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h2
                  id="admin-copy-editor-title"
                  className="font-display text-lg sm:text-xl font-semibold text-[#2B1F16]"
                >
                  แก้ไขข้อความและคำพูดในเว็บไซต์ (ทุกหน้า)
                </h2>
                <p className="text-xs text-[#5A4636]">
                  เลือกแท็บหน้าที่ต้องการแก้คำด้านล่าง แล้วกดบันทึกข้อความได้เลย
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playPaperCloseSfx();
                  setEditorOpen(false);
                }}
                aria-label="ปิดหน้าต่างแก้ไขคำ"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[#3A281B] hover:bg-black/10 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* แถบเลือกหน้าทั้ง 6 หน้า */}
            <div className="px-5 sm:px-7 py-2.5 bg-[#4A3525]/10 border-b border-[#5C442E]/20 flex items-center gap-1.5 overflow-x-auto shrink-0">
              {STEP_LABELS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    soundEngine.playSoftTapSfx();
                    setEditingTab(tab.key);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer min-h-[36px] ${
                    editingTab === tab.key
                      ? 'bg-[#3A281B] text-[#FAF2E8]'
                      : 'text-[#3A281B] hover:bg-[#3A281B]/12'
                  }`}
                >
                  {tab.shortLabel}
                </button>
              ))}
            </div>

            {/* ฟอร์มแก้ไขข้อความของหน้าที่เลือก */}
            <form
              onSubmit={(e) => {
                void handleSaveCopySubmit(e);
              }}
              className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-4"
            >
              <p className="font-display text-sm font-semibold text-[#4A3525]">
                {STEP_LABELS.find((s) => s.key === editingTab)?.fullLabel}
              </p>

              {editingTab === 'COVER' && (
                <div className="space-y-3.5">
                  {renderField(
                    'copy-site-title',
                    'ชื่อหัวข้อหลักหน้าปก (เช่น ถึงคุณ ♡)',
                    draftCopy.siteTitle,
                    (val) => setDraftCopy({ ...draftCopy, siteTitle: val })
                  )}
                  {renderField(
                    'copy-sub-1',
                    'คำโปรยบรรทัดที่ 1',
                    draftCopy.cover.subtitleLine1,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        cover: { ...draftCopy.cover, subtitleLine1: val },
                      })
                  )}
                  {renderField(
                    'copy-sub-2',
                    'คำโปรยบรรทัดที่ 2',
                    draftCopy.cover.subtitleLine2,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        cover: { ...draftCopy.cover, subtitleLine2: val },
                      })
                  )}
                  {renderField(
                    'copy-start-btn',
                    'ข้อความปุ่มเริ่มต้น',
                    draftCopy.cover.startBtn,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        cover: { ...draftCopy.cover, startBtn: val },
                      })
                  )}
                </div>
              )}

              {editingTab === 'A' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-2 gap-3">
                    {renderField(
                      'copy-a-home',
                      'ปุ่มหน้าหลักมุมซ้ายบน',
                      draftCopy.stepA.homeBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepA: { ...draftCopy.stepA, homeBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-a-back',
                      'ปุ่มกลับมุมซ้ายบน',
                      draftCopy.stepA.backBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepA: { ...draftCopy.stepA, backBtn: val },
                        })
                    )}
                  </div>
                  {renderField(
                    'copy-a-q1',
                    'คำถามแรก (เช่น นั่นคุณจริง ๆ ใช่มั้ย 🥹)',
                    draftCopy.stepA.initialQuestion,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepA: { ...draftCopy.stepA, initialQuestion: val },
                      })
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {renderField(
                      'copy-a-yes',
                      'ปุ่มตอบรับ (ใช่)',
                      draftCopy.stepA.yesBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepA: { ...draftCopy.stepA, yesBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-a-no',
                      'ปุ่มปฏิเสธ (ไม่)',
                      draftCopy.stepA.noBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepA: { ...draftCopy.stepA, noBtn: val },
                        })
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-a-wait',
                      'ข้อความระหว่างรอ 3 วินาที',
                      draftCopy.stepA.waitMessage,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepA: { ...draftCopy.stepA, waitMessage: val },
                        })
                    )}
                    {renderField(
                      'copy-a-waitsub',
                      'ข้อความตัวเลขนับเวลา',
                      draftCopy.stepA.waitSubLabel,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepA: { ...draftCopy.stepA, waitSubLabel: val },
                        })
                    )}
                  </div>
                  {renderField(
                    'copy-a-followup',
                    'คำถามง้อหลังครบ 3 วินาที',
                    draftCopy.stepA.waitFollowUp,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepA: { ...draftCopy.stepA, waitFollowUp: val },
                      })
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-a-me',
                      'ปุ่มยอมรับว่าเป็นฉัน',
                      draftCopy.stepA.actuallyMeBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepA: { ...draftCopy.stepA, actuallyMeBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-a-notme',
                      'ปุ่มไม่ใช่จริง ๆ',
                      draftCopy.stepA.reallyNotMeBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepA: { ...draftCopy.stepA, reallyNotMeBtn: val },
                        })
                    )}
                  </div>
                  {renderField(
                    'copy-a-exit-title',
                    'หัวข้อเมื่อกดไม่ใช่จริง ๆ',
                    draftCopy.stepA.politeExitTitle,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepA: { ...draftCopy.stepA, politeExitTitle: val },
                      })
                  )}
                  {renderField(
                    'copy-a-exit-body',
                    'ข้อความอวยพรเมื่อไม่ใช่เจ้าตัว',
                    draftCopy.stepA.politeExitBody,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepA: { ...draftCopy.stepA, politeExitBody: val },
                      }),
                    true
                  )}
                </div>
              )}

              {editingTab === 'B' && (
                <div className="space-y-3.5">
                  {renderField(
                    'copy-b-q',
                    'คำถามวันเกิด',
                    draftCopy.stepB.question,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepB: { ...draftCopy.stepB, question: val },
                      })
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {renderField(
                      'copy-b-submit',
                      'ข้อความปุ่มยืนยัน',
                      draftCopy.stepB.submitBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepB: { ...draftCopy.stepB, submitBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-b-back',
                      'ข้อความปุ่มกลับ',
                      draftCopy.stepB.backBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepB: { ...draftCopy.stepB, backBtn: val },
                        })
                    )}
                  </div>
                  {renderField(
                    'copy-b-wrong',
                    'ข้อความแจ้งเมื่อเลือกวันเกิดไม่ตรง',
                    draftCopy.stepB.wrongDateMessage,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepB: { ...draftCopy.stepB, wrongDateMessage: val },
                      }),
                    true
                  )}
                </div>
              )}

              {editingTab === 'C' && (
                <div className="space-y-3.5">
                  {renderField(
                    'copy-c-heading',
                    'หัวข้อหน้าโต๊ะจดหมาย',
                    draftCopy.stepC.mailboxHeading,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepC: { ...draftCopy.stepC, mailboxHeading: val },
                      })
                  )}
                  {renderField(
                    'copy-c-hint',
                    'คำอธิบายใต้หัวข้อโต๊ะจดหมาย',
                    draftCopy.stepC.deskHintClosed,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepC: { ...draftCopy.stepC, deskHintClosed: val },
                      })
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-c-bday-tag',
                      'คำอธิบายใต้ซองวันเกิดข้างแก้วกาแฟ',
                      draftCopy.stepC.birthdayEnvelopeTag,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepC: { ...draftCopy.stepC, birthdayEnvelopeTag: val },
                        })
                    )}
                    {renderField(
                      'copy-c-apol-tag',
                      'คำอธิบายใต้ซองจดหมายหลัก',
                      draftCopy.stepC.apologyEnvelopeTag,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepC: { ...draftCopy.stepC, apologyEnvelopeTag: val },
                        })
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-c-box-title',
                      'ชื่อหัวกล่องใส่จดหมายด้านข้าง',
                      draftCopy.stepC.mailboxBoxTitle,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepC: { ...draftCopy.stepC, mailboxBoxTitle: val },
                        })
                    )}
                    {renderField(
                      'copy-c-box-sub',
                      'คำอธิบายย่อยใต้ชื่อกล่องจดหมาย',
                      draftCopy.stepC.mailboxSubtitle,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepC: { ...draftCopy.stepC, mailboxSubtitle: val },
                        })
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {renderField(
                      'copy-c-foldback',
                      'ปุ่มพับเก็บวางบนโต๊ะ',
                      draftCopy.stepC.foldBackBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepC: { ...draftCopy.stepC, foldBackBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-c-reply-btn',
                      'ปุ่มเขียนจดหมายตอบกลับ',
                      draftCopy.stepC.writeReplyBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepC: { ...draftCopy.stepC, writeReplyBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-c-new-btn',
                      'ปุ่มเขียนจดหมายฉบับใหม่',
                      draftCopy.stepC.writeNewReplyBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepC: { ...draftCopy.stepC, writeNewReplyBtn: val },
                        })
                    )}
                  </div>
                  {renderField(
                    'copy-c-privacy',
                    'ข้อความท้ายกล่องจดหมาย',
                    draftCopy.stepC.privacyFooterNote,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepC: { ...draftCopy.stepC, privacyFooterNote: val },
                      })
                  )}
                </div>
              )}

              {editingTab === 'D' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-d-heading',
                      'หัวข้อหน้าเขียนจดหมายตอบกลับ',
                      draftCopy.stepD.heading,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, heading: val },
                        })
                    )}
                    {renderField(
                      'copy-d-back-btn',
                      'ปุ่มกลับมุมซ้ายบน',
                      draftCopy.stepD.backBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, backBtn: val },
                        })
                    )}
                  </div>
                  {renderField(
                    'copy-d-privacy',
                    'ข้อความชี้แจงความเป็นส่วนตัวด้านบนกระดาษ',
                    draftCopy.stepD.privacyNoticeBody,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepD: { ...draftCopy.stepD, privacyNoticeBody: val },
                      }),
                    true
                  )}
                  {renderField(
                    'copy-d-del-note',
                    'คำอธิบายการลบฉบับร่าง',
                    draftCopy.stepD.deletionPolicyNote,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepD: { ...draftCopy.stepD, deletionPolicyNote: val },
                      })
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-d-title-lbl',
                      'ป้ายช่องชื่อจดหมาย',
                      draftCopy.stepD.titleLabel,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, titleLabel: val },
                        })
                    )}
                    {renderField(
                      'copy-d-title-ph',
                      'ข้อความตัวอย่างในช่องชื่อจดหมาย',
                      draftCopy.stepD.titlePlaceholder,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, titlePlaceholder: val },
                        })
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-d-author-lbl',
                      'ป้ายช่องชื่อผู้เขียน',
                      draftCopy.stepD.authorLabel,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, authorLabel: val },
                        })
                    )}
                    {renderField(
                      'copy-d-author-ph',
                      'ข้อความตัวอย่างในช่องชื่อผู้เขียน',
                      draftCopy.stepD.authorPlaceholder,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, authorPlaceholder: val },
                        })
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-d-body-lbl',
                      'ป้ายช่องเนื้อหา',
                      draftCopy.stepD.bodyLabel,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, bodyLabel: val },
                        })
                    )}
                    {renderField(
                      'copy-d-body-ph',
                      'ข้อความตัวอย่างในช่องเนื้อหา',
                      draftCopy.stepD.bodyPlaceholder,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, bodyPlaceholder: val },
                        })
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-d-clear-btn',
                      'ปุ่มล้างฉบับร่าง',
                      draftCopy.stepD.clearDraftBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, clearDraftBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-d-fold-btn',
                      'ปุ่มพับจดหมายใส่ซอง',
                      draftCopy.stepD.finishAndFoldBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, finishAndFoldBtn: val },
                        })
                    )}
                  </div>
                </div>
              )}

              {editingTab === 'E' && (
                <div className="space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-e-saved-h',
                      'หัวข้อขณะพับลงซอง (บันทึกแล้ว)',
                      draftCopy.stepE.savedHeading,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, savedHeading: val },
                        })
                    )}
                    {renderField(
                      'copy-e-saved-sub',
                      'ข้อความรองขณะพับลงซอง',
                      draftCopy.stepE.savedSubheading,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, savedSubheading: val },
                        })
                    )}
                  </div>
                  {renderField(
                    'copy-e-ty-1',
                    'ข้อความขอบคุณบรรทัดที่ 1 หลังปิดซอง',
                    draftCopy.stepE.thankYouTitle,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepE: { ...draftCopy.stepE, thankYouTitle: val },
                      })
                  )}
                  {renderField(
                    'copy-e-ty-2',
                    'ข้อความขอบคุณบรรทัดที่ 2 หลังปิดซอง',
                    draftCopy.stepE.thankYouSubtitle,
                    (val) =>
                      setDraftCopy({
                        ...draftCopy,
                        stepE: { ...draftCopy.stepE, thankYouSubtitle: val },
                      })
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-e-back-desk',
                      'ปุ่มกลับไปที่โต๊ะจดหมาย',
                      draftCopy.stepE.backToDeskBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, backToDeskBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-e-write-more',
                      'ปุ่มเขียนจดหมายเพิ่มอีกฉบับ',
                      draftCopy.stepE.writeAnotherBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, writeAnotherBtn: val },
                        })
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {renderField(
                      'copy-e-edit-again',
                      'ลิงก์กลับไปดูหรือแก้ไขฉบับนี้',
                      draftCopy.stepE.editAgainBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, editAgainBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-e-skip-anim',
                      'ปุ่มข้ามแอนิเมชัน',
                      draftCopy.stepE.skipAnimationBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, skipAnimationBtn: val },
                        })
                    )}
                  </div>
                </div>
              )}

              {feedbackMsg && (
                <p className="text-xs sm:text-sm font-semibold text-[#1F5129] flex items-center gap-1.5 pt-1">
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{feedbackMsg}</span>
                </p>
              )}

              {/* แถบปุ่มบันทึก / คืนค่าต้นฉบับ ด้านล่างหน้าต่าง */}
              <div className="pt-4 border-t border-[#5C442E]/25 flex flex-wrap items-center justify-between gap-3">
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="inline-flex items-center gap-1.5 min-h-[42px] px-3 py-1.5 text-xs sm:text-sm text-[#6E3026] hover:underline cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>คืนค่าคำพูดทุกหน้าเป็นต้นฉบับ</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onResetSiteCopy();
                        setConfirmReset(false);
                        setFeedbackMsg('คืนค่าคำพูดทุกหน้ากลับเป็นต้นฉบับแล้ว');
                      }}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#8F2D22] text-white text-xs font-semibold cursor-pointer"
                    >
                      ยืนยันคืนค่าคำต้นฉบับ
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="min-h-[38px] px-2.5 py-1 text-xs text-[#4A3525] cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                  </div>
                )}

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playPaperCloseSfx();
                      setEditorOpen(false);
                    }}
                    className="min-h-[44px] px-4 py-2 text-xs sm:text-sm font-medium text-[#4A3525] hover:bg-black/5 rounded-lg cursor-pointer"
                  >
                    ปิดหน้าต่าง
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="parchment-action-btn inline-flex items-center gap-2 min-h-[44px] px-6 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" aria-hidden="true" />
                    <span>{isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อความ'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
