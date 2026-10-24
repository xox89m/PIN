import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  APOLOGY_LETTER_CONTENT,
  BIRTHDAY_LETTER_CONTENT,
  LetterDocument,
  UI_COPY,
} from '../content/letters';
import { ReplyLetterDraft } from '../services/letterStorage';
import {
  CoffeeAndBirthdayEnvelopeIllustration,
  GoldenEnvelopeIllustration,
  HandDrawnPenIllustration,
  MiniEnvelopeIcon,
  WoodenLetterboxIllustration,
} from './EnvelopeIllustrations';
import { ArrowLeft, Mail, Paperclip, PenLine, Plus, UploadCloud } from 'lucide-react';
import { soundEngine } from '../services/soundEngine';

interface StepCDeskProps {
  currentDraft: ReplyLetterDraft;
  sentLetters: ReplyLetterDraft[];
  onContinueOrStartReply: () => void;
  onStartNewReply: () => void;
  onEditSpecificReply: (targetDraft: ReplyLetterDraft) => void;
}

type SelectedMailboxItem =
  | { kind: 'owner'; doc: LetterDocument }
  | { kind: 'reply'; draft: ReplyLetterDraft };

type OpeningEnvelopeTarget = 'apology' | 'birthday' | null;

function formatThaiTimestamp(iso: string | null | undefined): string {
  if (!iso) return 'เพิ่งเขียน';
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return 'เพิ่งเขียน';
    return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return 'เพิ่งเขียน';
  }
}

export function StepCDesk({
  currentDraft,
  sentLetters,
  onContinueOrStartReply,
  onStartNewReply,
  onEditSpecificReply,
}: StepCDeskProps) {
  const [openingTarget, setOpeningTarget] = useState<OpeningEnvelopeTarget>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedMailboxItem | null>(null);
  const animTimerRef = useRef<number | null>(null);
  const readerTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (animTimerRef.current !== null) {
        window.clearTimeout(animTimerRef.current);
      }
    };
  }, []);

  // รวมรายการจดหมายตอบกลับของผู้เขียน (รวมฉบับร่างที่พิมพ์ค้างไว้และฉบับที่บันทึกแล้วโดยไม่ซ้ำ letterId)
  const userReplyLetters = useMemo(() => {
    const map = new Map<string, ReplyLetterDraft>();

    const hasCurrentContent =
      Boolean(currentDraft.title.trim()) || Boolean(currentDraft.body.trim());
    if (hasCurrentContent) {
      map.set(currentDraft.letterId, currentDraft);
    }

    for (const item of sentLetters) {
      if (!map.has(item.letterId)) {
        map.set(item.letterId, item);
      } else {
        const existing = map.get(item.letterId)!;
        if (item.version > existing.version) {
          map.set(item.letterId, item);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.lastModifiedIso.localeCompare(a.lastModifiedIso)
    );
  }, [currentDraft, sentLetters]);

  // จำนวนจดหมายทั้งหมดในกล่อง (จดหมายจากผู้สร้าง 2 ฉบับ + จดหมายที่ผู้รับเขียนตอบกลับ)
  const totalLetterCount = 2 + userReplyLetters.length;

  const openOwnerLetterWithAnim = (doc: LetterDocument) => {
    if (selectedItem?.kind === 'owner' && selectedItem.doc.id === doc.id) {
      return;
    }

    soundEngine.playPaperOpenSfx();
    if (doc.id === 'birthday') {
      soundEngine.playBirthdayMusicBoxChime();
    }

    // หากเปิดซองจากบนโต๊ะ ให้เล่นแอนิเมชันเปิดฝาซองสั้น ๆ อย่างนุ่มนวล
    if (!selectedItem) {
      setOpeningTarget(doc.id);
      if (animTimerRef.current !== null) {
        window.clearTimeout(animTimerRef.current);
      }
      animTimerRef.current = window.setTimeout(() => {
        setOpeningTarget(null);
        setSelectedItem({ kind: 'owner', doc });
        animTimerRef.current = null;
        readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 520);
    } else {
      setOpeningTarget(null);
      setSelectedItem({ kind: 'owner', doc });
      readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const selectLetterImmediately = (item: SelectedMailboxItem) => {
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    soundEngine.playPaperOpenSfx();
    if (item.kind === 'owner' && item.doc.id === 'birthday') {
      soundEngine.playBirthdayMusicBoxChime();
    }
    setOpeningTarget(null);
    setSelectedItem(item);
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSkipOpenAnimation = () => {
    if (!openingTarget) return;
    const targetDoc =
      openingTarget === 'birthday' ? BIRTHDAY_LETTER_CONTENT : APOLOGY_LETTER_CONTENT;
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    setOpeningTarget(null);
    setSelectedItem({ kind: 'owner', doc: targetDoc });
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCloseReaderBackToDesk = () => {
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    soundEngine.playSoftTapSfx();
    setOpeningTarget(null);
    setSelectedItem(null);
  };

  const isItemActive = (check: SelectedMailboxItem): boolean => {
    if (!selectedItem) return false;
    if (check.kind === 'owner' && selectedItem.kind === 'owner') {
      return check.doc.id === selectedItem.doc.id;
    }
    if (check.kind === 'reply' && selectedItem.kind === 'reply') {
      return check.draft.letterId === selectedItem.draft.letterId;
    }
    return false;
  };

  const hasActiveUnsealedDraft =
    (Boolean(currentDraft.title.trim()) || Boolean(currentDraft.body.trim())) &&
    currentDraft.recoveryState !== 'completed';

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
      <div
        ref={readerTopRef}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start"
      >
        {/* พื้นที่หลักฝั่งซ้าย/กลาง: โต๊ะวางซองจดหมายทั้ง 2 ฉบับ หรือ กระดาษอ่านจดหมาย */}
        <div className="lg:col-span-7 xl:col-span-8">
          {!selectedItem ? (
            <div className="flex flex-col justify-between min-h-[68vh] space-y-8 py-2">
              {/* หัวข้อโต๊ะจดหมาย */}
              <div className="space-y-1.5 text-center lg:text-left">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F6EFE6] drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)]">
                  {UI_COPY.stepC.mailboxHeading}
                </h1>
                <p className="text-sm sm:text-base text-[#E8DDD0]/80">
                  {UI_COPY.stepC.deskHintClosed}
                </p>
              </div>

              {/* โต๊ะไม้: ซองวันเกิดวางใกล้แก้วกาแฟด้านซ้าย และ ซองจดหมายขอโทษสีทองวางด้านขวา */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-6 items-end pt-2">
                {/* ซองที่ 1: จดหมายสุขสันต์วันเกิด วางคู่กับแก้วกาแฟอุ่น ๆ */}
                <div className="flex flex-col items-center text-center space-y-2.5">
                  <CoffeeAndBirthdayEnvelopeIllustration
                    isOpen={openingTarget === 'birthday'}
                    isLetterPulledOut={false}
                    onClick={() => openOwnerLetterWithAnim(BIRTHDAY_LETTER_CONTENT)}
                  />
                  <div className="space-y-0.5">
                    <p className="font-display text-base sm:text-lg font-semibold text-[#FAF2E8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                      {BIRTHDAY_LETTER_CONTENT.letterTitle}
                    </p>
                    <p className="text-xs text-[#E8DDD0]/75">
                      ซองข้างแก้วกาแฟ · แตะเพื่อเปิดอ่าน
                    </p>
                  </div>
                </div>

                {/* ซองที่ 2: จดหมายขอโทษสีเหลืองทอง พร้อมปากกาหมึกซึม */}
                <div className="flex flex-col items-center text-center space-y-2.5">
                  <GoldenEnvelopeIllustration
                    isOpen={openingTarget === 'apology'}
                    isLetterPulledOut={false}
                    onClick={() => openOwnerLetterWithAnim(APOLOGY_LETTER_CONTENT)}
                  />
                  <div className="w-full max-w-[230px] flex justify-end -mt-1">
                    <HandDrawnPenIllustration className="w-36 sm:w-40 h-auto transform rotate-3" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="font-display text-base sm:text-lg font-semibold text-[#FAF2E8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                      {APOLOGY_LETTER_CONTENT.letterTitle}
                    </p>
                    <p className="text-xs text-[#E8DDD0]/75">
                      ซองจดหมายหลัก · แตะเพื่อเปิดอ่าน
                    </p>
                  </div>
                </div>
              </div>

              {/* แถบปุ่มเขียนจดหมายตอบกลับด้านล่างโต๊ะ */}
              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-4">
                {openingTarget !== null && (
                  <button
                    type="button"
                    onClick={handleSkipOpenAnimation}
                    className="min-h-[44px] px-4 py-2 text-sm text-[#E8DDD0] underline underline-offset-4 cursor-pointer whitespace-nowrap shrink-0"
                  >
                    ข้ามแอนิเมชัน
                  </button>
                )}

                <button
                  type="button"
                  onClick={onContinueOrStartReply}
                  className="night-glass-btn inline-flex items-center gap-2.5 min-h-[48px] px-7 py-2.5 text-sm sm:text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <PenLine className="w-4 h-4" aria-hidden="true" />
                  <span>
                    {hasActiveUnsealedDraft
                      ? 'เขียนจดหมายฉบับร่างต่อ'
                      : UI_COPY.stepC.writeReplyBtn}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* โหมดเปิดอ่านเนื้อหาจดหมายบนกระดาษวินเทจ */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCloseReaderBackToDesk}
                  className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm text-[#E8DDD0]/85 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  <span>พับเก็บวางไว้บนโต๊ะ</span>
                </button>
              </div>

              {selectedItem.kind === 'owner' ? (
                <article className="vintage-parchment p-6 sm:p-10">
                  <header className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-[#5C442E]/25">
                    <div className="flex items-start gap-3">
                      <Mail
                        className="w-5 h-5 text-[#4A3525] mt-1 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="space-y-0.5">
                        <h2 className="font-display text-lg sm:text-xl font-semibold text-[#2B1F16]">
                          {selectedItem.doc.letterTitle}
                        </h2>
                        <p className="text-xs sm:text-sm text-[#5A4636]">
                          <span>{selectedItem.doc.senderLabel}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{selectedItem.doc.dateLabel}</span>
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="space-y-5 text-[15.5px] sm:text-[16.5px] leading-[1.9] text-[#2B1F16]">
                    <p className="font-display font-semibold text-base sm:text-lg">
                      {selectedItem.doc.salutation}
                    </p>

                    {selectedItem.doc.paragraphs.map((paragraph, idx) => (
                      <p key={idx} className="whitespace-pre-line break-words">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  <footer className="mt-10 pt-6 border-t border-[#5C442E]/20 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-1 text-[#2B1F16]">
                      <p className="text-sm sm:text-base text-[#4A3525]">
                        {selectedItem.doc.signOff}
                      </p>
                      <p className="font-display text-base sm:text-lg font-semibold">
                        {selectedItem.doc.senderName}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={onContinueOrStartReply}
                      className="parchment-action-btn inline-flex items-center justify-center gap-2.5 w-full sm:w-auto min-h-[48px] px-7 py-3 text-sm sm:text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <PenLine className="w-4 h-4" aria-hidden="true" />
                      <span>{UI_COPY.stepC.writeReplyBtn}</span>
                    </button>
                  </footer>
                </article>
              ) : (
                /* กรณีเปิดอ่านจดหมายตอบกลับที่ผู้เข้าชมเขียนไว้ในกล่อง */
                <article className="vintage-parchment p-6 sm:p-10">
                  <header className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-[#5C442E]/25">
                    <div className="flex items-start gap-3">
                      <Mail
                        className="w-5 h-5 text-[#4A3525] mt-1 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="space-y-0.5">
                        <h2 className="font-display text-lg sm:text-xl font-semibold text-[#2B1F16]">
                          {selectedItem.draft.title.trim() || 'จดหมายไม่มีชื่อเรื่อง'}
                        </h2>
                        <p className="text-xs sm:text-sm text-[#5A4636] tabular-nums">
                          <span>
                            จาก: {selectedItem.draft.author.trim() || 'คุณ'}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>
                            {formatThaiTimestamp(
                              selectedItem.draft.lastSavedIso ||
                                selectedItem.draft.lastModifiedIso
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="min-h-[180px] text-[15.5px] sm:text-[16.5px] leading-[1.9] text-[#2B1F16] whitespace-pre-wrap break-words">
                    {selectedItem.draft.body.trim() || '(ยังไม่มีเนื้อหาในฉบับนี้)'}
                  </div>

                  <footer className="mt-10 pt-6 border-t border-[#5C442E]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs text-[#5A4636] tabular-nums">
                      รหัสอ้างอิง: <span className="font-mono">{selectedItem.draft.letterId}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => onEditSpecificReply(selectedItem.draft)}
                        className="parchment-action-btn inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <PenLine className="w-4 h-4" aria-hidden="true" />
                        <span>แก้ไขจดหมายฉบับนี้</span>
                      </button>
                    </div>
                  </footer>
                </article>
              )}
            </div>
          )}
        </div>

        {/* พื้นที่ด้านข้าง (ขวา): กล่องใส่จดหมาย แสดงรายการจดหมายทั้งหมดและจำนวนฉบับ */}
        <aside
          aria-label="กล่องใส่จดหมาย"
          className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8"
        >
          <div className="vintage-parchment p-5 sm:p-6">
            {/* ส่วนหัวกล่องใส่จดหมาย + จำนวนฉบับทั้งหมด */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#5C442E]/25">
              <div className="flex items-center gap-3 min-w-0">
                <WoodenLetterboxIllustration className="w-11 h-10 shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-[#2B1F16] truncate">
                    กล่องใส่จดหมาย
                  </h2>
                  <p className="text-xs text-[#5A4636]">
                    แตะเลือกจดหมายเพื่อเปิดอ่าน
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 tabular-nums">
                <span className="font-display text-base sm:text-lg font-semibold text-[#2B1F16]">
                  {totalLetterCount} ฉบับ
                </span>
              </div>
            </div>

            {/* รายการจดหมายในกล่อง คั่นด้วยเส้นบางสะอาดตาตามภาพต้นฉบับช่องที่ 5 */}
            <div className="divide-y divide-[#5C442E]/20">
              {/* 1. จดหมายขอโทษ */}
              <button
                type="button"
                onClick={() =>
                  selectLetterImmediately({
                    kind: 'owner',
                    doc: APOLOGY_LETTER_CONTENT,
                  })
                }
                className={`w-full text-left py-3.5 px-2.5 -mx-2.5 rounded-md flex items-start gap-3 transition-colors cursor-pointer min-h-[60px] ${
                  isItemActive({ kind: 'owner', doc: APOLOGY_LETTER_CONTENT })
                    ? 'bg-[#4A3525]/14'
                    : 'hover:bg-[#4A3525]/8'
                }`}
              >
                <MiniEnvelopeIcon variant="gold" className="w-9 h-7 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm sm:text-base font-semibold text-[#2B1F16] truncate">
                    {APOLOGY_LETTER_CONTENT.letterTitle}
                  </p>
                  <p className="text-xs text-[#5A4636] mt-0.5 truncate">
                    <span>{APOLOGY_LETTER_CONTENT.senderLabel}</span>
                    <span aria-hidden="true"> · </span>
                    <span>{APOLOGY_LETTER_CONTENT.dateLabel}</span>
                  </p>
                </div>
                <Paperclip
                  className="w-4 h-4 text-[#5A4636]/75 mt-1 shrink-0"
                  aria-hidden="true"
                />
              </button>

              {/* 2. จดหมายสุขสันต์วันเกิด H.B.D. 28/10/2026 */}
              <button
                type="button"
                onClick={() =>
                  selectLetterImmediately({
                    kind: 'owner',
                    doc: BIRTHDAY_LETTER_CONTENT,
                  })
                }
                className={`w-full text-left py-3.5 px-2.5 -mx-2.5 rounded-md flex items-start gap-3 transition-colors cursor-pointer min-h-[60px] ${
                  isItemActive({ kind: 'owner', doc: BIRTHDAY_LETTER_CONTENT })
                    ? 'bg-[#4A3525]/14'
                    : 'hover:bg-[#4A3525]/8'
                }`}
              >
                <MiniEnvelopeIcon
                  variant="birthday"
                  className="w-9 h-7 mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm sm:text-base font-semibold text-[#2B1F16] truncate">
                    {BIRTHDAY_LETTER_CONTENT.letterTitle}
                  </p>
                  <p className="text-xs text-[#5A4636] mt-0.5 truncate">
                    <span>{BIRTHDAY_LETTER_CONTENT.senderLabel}</span>
                    <span aria-hidden="true"> · </span>
                    <span>ข้างแก้วกาแฟ</span>
                  </p>
                </div>
                <Paperclip
                  className="w-4 h-4 text-[#5A4636]/75 mt-1 shrink-0"
                  aria-hidden="true"
                />
              </button>

              {/* 3. รายการจดหมายตอบกลับที่ผู้เข้าชมเขียนไว้ */}
              {userReplyLetters.map((reply) => {
                const isSynced =
                  reply.version > 0 && reply.lastSavedVersion >= reply.version;
                return (
                  <button
                    key={reply.letterId}
                    type="button"
                    onClick={() =>
                      selectLetterImmediately({ kind: 'reply', draft: reply })
                    }
                    className={`w-full text-left py-3.5 px-2.5 -mx-2.5 rounded-md flex items-start gap-3 transition-colors cursor-pointer min-h-[60px] ${
                      isItemActive({ kind: 'reply', draft: reply })
                        ? 'bg-[#4A3525]/14'
                        : 'hover:bg-[#4A3525]/8'
                    }`}
                  >
                    <MiniEnvelopeIcon
                      variant="reply"
                      className="w-9 h-7 mt-0.5 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-sm sm:text-base font-semibold text-[#2B1F16] truncate">
                        {reply.title.trim() || 'จดหมายตอบกลับ (ยังไม่ระบุชื่อเรื่อง)'}
                      </p>
                      <p className="text-xs text-[#5A4636] mt-0.5 truncate tabular-nums">
                        <span>จาก: {reply.author.trim() || 'คุณ'}</span>
                        <span aria-hidden="true"> · </span>
                        <span>
                          {isSynced ? 'บันทึกแล้ว' : 'ฉบับร่างในเครื่อง'}
                        </span>
                        <span aria-hidden="true"> · </span>
                        <span>
                          {formatThaiTimestamp(
                            reply.lastSavedIso || reply.lastModifiedIso
                          )}
                        </span>
                      </p>
                    </div>
                    <Paperclip
                      className="w-4 h-4 text-[#5A4636]/75 mt-1 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                );
              })}
            </div>

            {/* ปุ่มเขียนจดหมายฉบับใหม่ในกล่องจดหมาย และข้อความความเป็นส่วนตัว */}
            <div className="pt-4 mt-2 border-t border-[#5C442E]/25 space-y-3">
              <button
                type="button"
                onClick={onStartNewReply}
                className="parchment-action-btn w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-2.5 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{UI_COPY.stepC.writeNewReplyBtn}</span>
              </button>

              <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[#5A4636]">
                <UploadCloud className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{UI_COPY.stepC.privacyFooterNote}</span>
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
