import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  APOLOGY_LETTER_CONTENT,
  BIRTHDAY_LETTER_CONTENT,
  LetterDocument,
} from '../content/letters';
import { useSiteCopy } from '../context/SiteCopyContext';
import { ReplyLetterDraft } from '../services/letterStorage';
import {
  CoffeeAndBirthdayEnvelopeIllustration,
  GoldenEnvelopeIllustration,
  HandDrawnPenIllustration,
  MiniEnvelopeIcon,
  WoodenLetterboxIllustration,
} from './EnvelopeIllustrations';
import {
  ArrowLeft,
  Check,
  Eye,
  Home,
  Mail,
  Paperclip,
  Pencil,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import { soundEngine } from '../services/soundEngine';

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

interface StepCDeskProps {
  isAdmin: boolean;
  ownerLetters: LetterDocument[];
  currentDraft: ReplyLetterDraft;
  sentLetters: ReplyLetterDraft[];
  onSaveOwnerLetter: (updatedDoc: LetterDocument) => Promise<boolean>;
  onDeleteExtraOwnerLetter: (docId: string) => void;
  onResetOwnerLetters: () => void;
  onAdminSaveReplyLetter: (updatedReply: ReplyLetterDraft) => Promise<boolean>;
  onAdminDeleteReplyLetter: (letterId: string) => void;
  onReturnToCover: () => void;
  onExitAdminMode: () => void;
  onContinueOrStartReply: () => void;
  onStartNewReply: () => void;
  onEditSpecificReply: (targetDraft: ReplyLetterDraft) => void;
}

type SelectedMailboxItem =
  | { kind: 'owner'; docId: string }
  | { kind: 'reply'; letterId: string };

type AdminEditDraftState =
  | {
      kind: 'owner';
      id: string;
      letterTitle: string;
      senderLabel: string;
      dateLabel: string;
      salutation: string;
      bodyText: string;
      signOff: string;
      senderName: string;
      isNew?: boolean;
    }
  | {
      kind: 'reply';
      original: ReplyLetterDraft;
      title: string;
      author: string;
      body: string;
    };

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
  isAdmin,
  ownerLetters,
  currentDraft,
  sentLetters,
  onSaveOwnerLetter,
  onDeleteExtraOwnerLetter,
  onResetOwnerLetters,
  onAdminSaveReplyLetter,
  onAdminDeleteReplyLetter,
  onReturnToCover,
  onExitAdminMode,
  onContinueOrStartReply,
  onStartNewReply,
  onEditSpecificReply,
}: StepCDeskProps) {
  const copy = useSiteCopy();
  const [openingTarget, setOpeningTarget] = useState<OpeningEnvelopeTarget>(null);
  const [selectedItem, setSelectedItem] = useState<SelectedMailboxItem | null>(null);
  const [adminEditor, setAdminEditor] = useState<AdminEditDraftState | null>(null);
  const [adminSaveFeedback, setAdminSaveFeedback] = useState<string>('');
  const [isSavingAdminEdit, setIsSavingAdminEdit] = useState<boolean>(false);
  const [confirmResetModalOpen, setConfirmResetModalOpen] = useState<boolean>(false);

  const animTimerRef = useRef<number | null>(null);
  const readerTopRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return () => {
      if (animTimerRef.current !== null) {
        window.clearTimeout(animTimerRef.current);
      }
    };
  }, []);

  // ดึงจดหมายหลักทั้ง 2 ซองจากรายการของแอดมิน (อัปเดตชื่อซองและเนื้อหาทันทีเมื่อแอดมินแก้)
  const apologyDoc = useMemo(
    () =>
      ownerLetters.find((d) => d.id === 'apology') || APOLOGY_LETTER_CONTENT,
    [ownerLetters]
  );

  const birthdayDoc = useMemo(
    () =>
      ownerLetters.find((d) => d.id === 'birthday') || BIRTHDAY_LETTER_CONTENT,
    [ownerLetters]
  );

  // รวมรายการจดหมายตอบกลับของผู้เข้าชม
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
        if (item.version >= existing.version) {
          map.set(item.letterId, item);
        }
      }
    }

    return Array.from(map.values()).sort((a, b) =>
      b.lastModifiedIso.localeCompare(a.lastModifiedIso)
    );
  }, [currentDraft, sentLetters]);

  const totalLetterCount = ownerLetters.length + userReplyLetters.length;

  const activeOwnerDoc = useMemo(() => {
    if (selectedItem?.kind !== 'owner') return null;
    return ownerLetters.find((d) => d.id === selectedItem.docId) || null;
  }, [selectedItem, ownerLetters]);

  const activeReplyDoc = useMemo(() => {
    if (selectedItem?.kind !== 'reply') return null;
    return (
      userReplyLetters.find((r) => r.letterId === selectedItem.letterId) || null
    );
  }, [selectedItem, userReplyLetters]);

  const openOwnerLetterWithAnim = (doc: LetterDocument) => {
    setAdminEditor(null);
    setAdminSaveFeedback('');

    if (selectedItem?.kind === 'owner' && selectedItem.docId === doc.id) {
      return;
    }

    soundEngine.playPaperOpenSfx();

    if (!selectedItem && (doc.id === 'apology' || doc.id === 'birthday')) {
      setOpeningTarget(doc.id);
      if (animTimerRef.current !== null) {
        window.clearTimeout(animTimerRef.current);
      }
      animTimerRef.current = window.setTimeout(() => {
        setOpeningTarget(null);
        setSelectedItem({ kind: 'owner', docId: doc.id });
        animTimerRef.current = null;
        readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    } else {
      setOpeningTarget(null);
      setSelectedItem({ kind: 'owner', docId: doc.id });
      readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const selectLetterImmediately = (item: SelectedMailboxItem) => {
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    soundEngine.playPaperOpenSfx();
    setAdminEditor(null);
    setAdminSaveFeedback('');
    setOpeningTarget(null);
    setSelectedItem(item);
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSkipOpenAnimation = () => {
    if (!openingTarget) return;
    const targetDocId = openingTarget === 'birthday' ? 'birthday' : 'apology';
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    setOpeningTarget(null);
    setSelectedItem({ kind: 'owner', docId: targetDocId });
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleCloseReaderBackToDesk = () => {
    if (animTimerRef.current !== null) {
      window.clearTimeout(animTimerRef.current);
      animTimerRef.current = null;
    }
    soundEngine.playPaperCloseSfx();
    setOpeningTarget(null);
    setAdminEditor(null);
    setAdminSaveFeedback('');
    setSelectedItem(null);
  };

  // เปิดหน้าแก้ไขสำหรับแอดมิน (จดหมายของแอดมิน)
  const startAdminEditOwnerDoc = (doc: LetterDocument) => {
    soundEngine.playPaperOpenSfx();
    setOpeningTarget(null);
    setSelectedItem({ kind: 'owner', docId: doc.id });
    setAdminSaveFeedback('');
    setAdminEditor({
      kind: 'owner',
      id: doc.id,
      letterTitle: doc.letterTitle,
      senderLabel: doc.senderLabel,
      dateLabel: doc.dateLabel,
      salutation: doc.salutation,
      bodyText: doc.paragraphs.join('\n\n'),
      signOff: doc.signOff,
      senderName: doc.senderName,
    });
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // เพิ่มจดหมายฉบับใหม่จากแอดมินลงในกล่อง
  const startAdminCreateNewOwnerDoc = () => {
    soundEngine.playPaperOpenSfx();
    const newId = `note_${Date.now().toString(36)}`;
    setOpeningTarget(null);
    setSelectedItem(null);
    setAdminSaveFeedback('');
    setAdminEditor({
      kind: 'owner',
      id: newId,
      letterTitle: 'จดหมายฉบับใหม่ถึงคุณ',
      senderLabel: 'จาก: ฉัน',
      dateLabel: 'ข้อความเพิ่มเติม',
      salutation: 'ถึงคุณ...',
      bodyText: '',
      signOff: 'ด้วยความปรารถนาดี',
      senderName: 'ฉัน',
      isNew: true,
    });
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // เปิดหน้าแก้ไขสำหรับแอดมิน (จดหมายตอบกลับในกล่อง)
  const startAdminEditReplyDoc = (reply: ReplyLetterDraft) => {
    soundEngine.playPaperOpenSfx();
    setOpeningTarget(null);
    setSelectedItem({ kind: 'reply', letterId: reply.letterId });
    setAdminSaveFeedback('');
    setAdminEditor({
      kind: 'reply',
      original: reply,
      title: reply.title,
      author: reply.author,
      body: reply.body,
    });
    readerTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSaveAdminEditor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEditor) return;

    setIsSavingAdminEdit(true);
    setAdminSaveFeedback('');
    soundEngine.playSoftTapSfx();

    if (adminEditor.kind === 'owner') {
      const paragraphs = adminEditor.bodyText
        .replace(/\r\n/g, '\n')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const updatedDoc: LetterDocument = {
        id: adminEditor.id,
        isOwnerApprovedForProduction: true,
        letterTitle: adminEditor.letterTitle.trim() || 'จดหมายถึงคุณ',
        senderLabel: adminEditor.senderLabel.trim() || 'จาก: ฉัน',
        dateLabel: adminEditor.dateLabel.trim() || 'ถึงคุณคนสำคัญ',
        salutation: adminEditor.salutation.trim() || 'ถึงคุณ...',
        paragraphs: paragraphs.length > 0 ? paragraphs : [''],
        signOff: adminEditor.signOff.trim() || 'ด้วยความจริงใจ',
        senderName: adminEditor.senderName.trim() || 'ฉัน',
      };

      const synced = await onSaveOwnerLetter(updatedDoc);
      setIsSavingAdminEdit(false);
      setSelectedItem({ kind: 'owner', docId: updatedDoc.id });
      setAdminEditor(null);
      setAdminSaveFeedback(
        synced
          ? 'บันทึกชื่อและเนื้อหาจดหมายลงเครื่องและซิงก์ไปยัง Google Drive เรียบร้อยแล้ว'
          : 'บันทึกชื่อและเนื้อหาจดหมายในเครื่องเรียบร้อยแล้ว'
      );
    } else {
      const nextVersion = adminEditor.original.version + 1;
      const updatedReply: ReplyLetterDraft = {
        ...adminEditor.original,
        title: adminEditor.title.trim() || 'จดหมายตอบกลับ',
        author: adminEditor.author.trim() || 'คุณ',
        body: adminEditor.body,
        version: nextVersion,
        lastModifiedIso: new Date().toISOString(),
      };
      const synced = await onAdminSaveReplyLetter(updatedReply);
      setIsSavingAdminEdit(false);
      setSelectedItem({ kind: 'reply', letterId: updatedReply.letterId });
      setAdminEditor(null);
      setAdminSaveFeedback(
        synced
          ? 'บันทึกการแก้ไขจดหมายและซิงก์ไปยัง Google Drive เรียบร้อยแล้ว'
          : 'บันทึกการแก้ไขจดหมายในเครื่องเรียบร้อยแล้ว'
      );
    }
  };

  const handleTypingKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    if (!IGNORED_MODIFIER_KEYS.has(e.key) && e.key !== 'Unidentified') {
      soundEngine.playWritingKeystrokeSfx(e.key);
    }
  };

  const isItemActive = (check: SelectedMailboxItem): boolean => {
    if (!selectedItem) return false;
    if (check.kind === 'owner' && selectedItem.kind === 'owner') {
      return check.docId === selectedItem.docId;
    }
    if (check.kind === 'reply' && selectedItem.kind === 'reply') {
      return check.letterId === selectedItem.letterId;
    }
    return false;
  };

  const hasActiveUnsealedDraft =
    (Boolean(currentDraft.title.trim()) || Boolean(currentDraft.body.trim())) &&
    currentDraft.recoveryState !== 'completed';

  return (
    <section className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-6">
      {/* แถบเครื่องมือโหมดแอดมิน (แสดงเฉพาะเมื่อเข้าด้วยวันเกิดแอดมิน 28 สิงหาคม 2111) */}
      {isAdmin && (
        <div className="rounded-2xl bg-[#1C1510]/88 backdrop-blur-md border border-[#E5B968]/45 px-4 sm:px-6 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xl">
          <div className="space-y-0.5">
            <p className="font-display text-sm sm:text-base font-semibold text-[#F7DFB2]">
              โหมดแอดมิน (ผู้สร้างเว็บไซต์)
            </p>
            <p className="text-xs text-[#E8DDD0]/80">
              กดไอคอนดินสอท้ายรายชื่อจดหมายในกล่องด้านข้าง หรือเปิดซองแล้วกดแก้ไข เพื่อเปลี่ยนชื่อและเนื้อหาจดหมายได้ทุกฉบับ
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onReturnToCover}
              className="night-glass-btn inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <Home className="w-3.5 h-3.5" aria-hidden="true" />
              <span>กลับไปหน้าแรก</span>
            </button>

            <button
              type="button"
              onClick={startAdminCreateNewOwnerDoc}
              className="night-glass-btn inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>เพิ่มจดหมายใหม่</span>
            </button>

            <button
              type="button"
              onClick={() => setConfirmResetModalOpen(true)}
              className="night-glass-btn inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              <span>คืนค่าต้นฉบับ</span>
            </button>

            <button
              type="button"
              onClick={() => {
                soundEngine.playSoftTapSfx();
                setAdminEditor(null);
                onExitAdminMode();
              }}
              className="night-glass-btn-active inline-flex items-center gap-1.5 min-h-[40px] px-4 py-1.5 text-xs font-medium whitespace-nowrap cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" />
              <span>สลับดูมุมมองผู้รับ</span>
            </button>
          </div>
        </div>
      )}

      {adminSaveFeedback && (
        <div
          role="status"
          className="rounded-xl bg-[#1D2E22]/90 border border-[#8FC99E]/40 px-4 py-2.5 text-xs sm:text-sm text-[#E4F7E9] flex items-center gap-2"
        >
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{adminSaveFeedback}</span>
        </div>
      )}

      <div
        ref={readerTopRef}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start"
      >
        {/* พื้นที่หลักฝั่งซ้าย/กลาง */}
        <div className="lg:col-span-7 xl:col-span-8">
          {/* กรณีที่ 1: แอดมินกำลังเปิดฟอร์มแก้ไขชื่อ/เนื้อหาจดหมาย */}
          {isAdmin && adminEditor ? (
            <form
              onSubmit={(e) => {
                void handleSaveAdminEditor(e);
              }}
              className="vintage-parchment p-6 sm:p-9 space-y-5"
            >
              <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#5C442E]/25">
                <div className="flex items-center gap-2.5">
                  <Pencil className="w-5 h-5 text-[#4A3525]" aria-hidden="true" />
                  <h2 className="font-display text-lg sm:text-xl font-semibold text-[#2B1F16]">
                    {adminEditor.kind === 'owner' && adminEditor.isNew
                      ? 'สร้างจดหมายใหม่ของแอดมิน'
                      : 'แก้ไขชื่อและเนื้อหาจดหมาย'}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    soundEngine.playPaperCloseSfx();
                    setAdminEditor(null);
                  }}
                  className="min-h-[40px] px-3 py-1.5 text-xs sm:text-sm text-[#4A3525] hover:underline whitespace-nowrap cursor-pointer"
                >
                  ยกเลิก
                </button>
              </div>

              {adminEditor.kind === 'owner' ? (
                <>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-doc-title"
                      className="block text-sm font-semibold text-[#2B1F16]"
                    >
                      ชื่อจดหมาย (แสดงทั้งใต้ซองและในกล่องจดหมาย) *
                    </label>
                    <input
                      id="admin-doc-title"
                      type="text"
                      required
                      value={adminEditor.letterTitle}
                      onKeyDown={handleTypingKeyDown}
                      onChange={(e) => {
                        soundEngine.playWritingKeystrokeSfx();
                        setAdminEditor({
                          ...adminEditor,
                          letterTitle: e.target.value,
                        });
                      }}
                      className="parchment-input w-full min-h-[46px] px-3.5 py-2 text-sm sm:text-base"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-sender-label"
                        className="block text-sm font-semibold text-[#2B1F16]"
                      >
                        ป้ายผู้ส่ง (เช่น จาก: ฉัน)
                      </label>
                      <input
                        id="admin-sender-label"
                        type="text"
                        value={adminEditor.senderLabel}
                        onKeyDown={handleTypingKeyDown}
                        onChange={(e) => {
                          soundEngine.playWritingKeystrokeSfx();
                          setAdminEditor({
                            ...adminEditor,
                            senderLabel: e.target.value,
                          });
                        }}
                        className="parchment-input w-full min-h-[44px] px-3.5 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-date-label"
                        className="block text-sm font-semibold text-[#2B1F16]"
                      >
                        คำกำกับ / วันที่ (เช่น 28 ต.ค. 2026)
                      </label>
                      <input
                        id="admin-date-label"
                        type="text"
                        value={adminEditor.dateLabel}
                        onKeyDown={handleTypingKeyDown}
                        onChange={(e) => {
                          soundEngine.playWritingKeystrokeSfx();
                          setAdminEditor({
                            ...adminEditor,
                            dateLabel: e.target.value,
                          });
                        }}
                        className="parchment-input w-full min-h-[44px] px-3.5 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-salutation"
                      className="block text-sm font-semibold text-[#2B1F16]"
                    >
                      คำขึ้นต้นจดหมาย
                    </label>
                    <input
                      id="admin-salutation"
                      type="text"
                      value={adminEditor.salutation}
                      onKeyDown={handleTypingKeyDown}
                      onChange={(e) => {
                        soundEngine.playWritingKeystrokeSfx();
                        setAdminEditor({
                          ...adminEditor,
                          salutation: e.target.value,
                        });
                      }}
                      className="parchment-input w-full min-h-[44px] px-3.5 py-2 text-sm sm:text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <label
                        htmlFor="admin-body-text"
                        className="block text-sm font-semibold text-[#2B1F16]"
                      >
                        เนื้อหาจดหมาย *
                      </label>
                      <span className="text-xs text-[#5A4636]">
                        เว้นบรรทัดว่าง 1 บรรทัดเพื่อแยกย่อหน้า
                      </span>
                    </div>
                    <textarea
                      id="admin-body-text"
                      rows={12}
                      required
                      value={adminEditor.bodyText}
                      onKeyDown={handleTypingKeyDown}
                      onChange={(e) => {
                        soundEngine.playWritingKeystrokeSfx();
                        setAdminEditor({
                          ...adminEditor,
                          bodyText: e.target.value,
                        });
                      }}
                      className="parchment-input w-full p-3.5 text-sm sm:text-base leading-relaxed resize-y min-h-[260px]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-signoff"
                        className="block text-sm font-semibold text-[#2B1F16]"
                      >
                        คำลงท้าย (เช่น ด้วยความจริงใจ)
                      </label>
                      <input
                        id="admin-signoff"
                        type="text"
                        value={adminEditor.signOff}
                        onKeyDown={handleTypingKeyDown}
                        onChange={(e) => {
                          soundEngine.playWritingKeystrokeSfx();
                          setAdminEditor({
                            ...adminEditor,
                            signOff: e.target.value,
                          });
                        }}
                        className="parchment-input w-full min-h-[44px] px-3.5 py-2 text-sm"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="admin-sender-name"
                        className="block text-sm font-semibold text-[#2B1F16]"
                      >
                        ลงชื่อผู้เขียน
                      </label>
                      <input
                        id="admin-sender-name"
                        type="text"
                        value={adminEditor.senderName}
                        onKeyDown={handleTypingKeyDown}
                        onChange={(e) => {
                          soundEngine.playWritingKeystrokeSfx();
                          setAdminEditor({
                            ...adminEditor,
                            senderName: e.target.value,
                          });
                        }}
                        className="parchment-input w-full min-h-[44px] px-3.5 py-2 text-sm"
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#5C442E]/20 flex flex-wrap items-center justify-between gap-3">
                    {adminEditor.id !== 'apology' &&
                    adminEditor.id !== 'birthday' &&
                    !adminEditor.isNew ? (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteExtraOwnerLetter(adminEditor.id);
                          setAdminEditor(null);
                          setSelectedItem(null);
                        }}
                        className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 text-xs sm:text-sm text-[#7A241B] hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" aria-hidden="true" />
                        <span>ลบจดหมายฉบับนี้ออกจากกล่อง</span>
                      </button>
                    ) : (
                      <span />
                    )}

                    <button
                      type="submit"
                      disabled={isSavingAdminEdit}
                      className="parchment-action-btn inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-2.5 text-sm sm:text-base font-medium whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {isSavingAdminEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                      </span>
                    </button>
                  </div>
                </>
              ) : (
                /* แก้ไขชื่อและเนื้อหาจดหมายตอบกลับในกล่อง */
                <>
                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-reply-title"
                      className="block text-sm font-semibold text-[#2B1F16]"
                    >
                      ชื่อจดหมาย *
                    </label>
                    <input
                      id="admin-reply-title"
                      type="text"
                      required
                      value={adminEditor.title}
                      onKeyDown={handleTypingKeyDown}
                      onChange={(e) => {
                        soundEngine.playWritingKeystrokeSfx();
                        setAdminEditor({
                          ...adminEditor,
                          title: e.target.value,
                        });
                      }}
                      className="parchment-input w-full min-h-[46px] px-3.5 py-2 text-sm sm:text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-reply-author"
                      className="block text-sm font-semibold text-[#2B1F16]"
                    >
                      ชื่อผู้เขียน *
                    </label>
                    <input
                      id="admin-reply-author"
                      type="text"
                      required
                      value={adminEditor.author}
                      onKeyDown={handleTypingKeyDown}
                      onChange={(e) => {
                        soundEngine.playWritingKeystrokeSfx();
                        setAdminEditor({
                          ...adminEditor,
                          author: e.target.value,
                        });
                      }}
                      className="parchment-input w-full min-h-[46px] px-3.5 py-2 text-sm sm:text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="admin-reply-body"
                      className="block text-sm font-semibold text-[#2B1F16]"
                    >
                      เนื้อหาจดหมาย *
                    </label>
                    <textarea
                      id="admin-reply-body"
                      rows={9}
                      required
                      value={adminEditor.body}
                      onKeyDown={handleTypingKeyDown}
                      onChange={(e) => {
                        soundEngine.playWritingKeystrokeSfx();
                        setAdminEditor({
                          ...adminEditor,
                          body: e.target.value,
                        });
                      }}
                      className="parchment-input w-full p-3.5 text-sm sm:text-base leading-relaxed resize-y min-h-[220px]"
                    />
                  </div>

                  <div className="pt-4 border-t border-[#5C442E]/20 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        onAdminDeleteReplyLetter(adminEditor.original.letterId);
                        setAdminEditor(null);
                        setSelectedItem(null);
                      }}
                      className="inline-flex items-center gap-1.5 min-h-[44px] px-3 py-2 text-xs sm:text-sm text-[#7A241B] hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                      <span>นำออกจากกล่องในเครื่องนี้</span>
                    </button>

                    <button
                      type="submit"
                      disabled={isSavingAdminEdit}
                      className="parchment-action-btn inline-flex items-center justify-center gap-2 min-h-[48px] px-7 py-2.5 text-sm sm:text-base font-medium whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-4 h-4" aria-hidden="true" />
                      <span>
                        {isSavingAdminEdit ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
                      </span>
                    </button>
                  </div>
                </>
              )}
            </form>
          ) : !selectedItem ? (
            /* กรณีที่ 2: โต๊ะวางซองจดหมายทั้ง 2 ฉบับ */
            <div className="animate-scene-enter flex flex-col justify-between min-h-[68vh] space-y-8 py-2">
              <div className="space-y-1.5 text-center lg:text-left">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold text-[#F6EFE6] drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)]">
                  {copy.stepC.mailboxHeading}
                </h1>
                <p className="text-sm sm:text-base text-[#E8DDD0]/80">
                  {copy.stepC.deskHintClosed}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-6 items-end pt-2">
                {/* ซองที่ 1: จดหมายวันเกิดข้างแก้วกาแฟ */}
                <div className="flex flex-col items-center text-center space-y-2.5">
                  <CoffeeAndBirthdayEnvelopeIllustration
                    isOpen={openingTarget === 'birthday'}
                    isLetterPulledOut={false}
                    onClick={() => openOwnerLetterWithAnim(birthdayDoc)}
                  />
                  <div className="space-y-1">
                    <p className="font-display text-base sm:text-lg font-semibold text-[#FAF2E8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                      {birthdayDoc.letterTitle}
                    </p>
                    <p className="text-xs text-[#E8DDD0]/75">
                      {copy.stepC.birthdayEnvelopeTag}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => startAdminEditOwnerDoc(birthdayDoc)}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1 text-xs text-[#F7DFB2] underline underline-offset-4 hover:text-white cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>แก้ไข / เปลี่ยนชื่อซองนี้</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* ซองที่ 2: จดหมายขอโทษสีเหลืองทอง */}
                <div className="flex flex-col items-center text-center space-y-2.5">
                  <GoldenEnvelopeIllustration
                    isOpen={openingTarget === 'apology'}
                    isLetterPulledOut={false}
                    onClick={() => openOwnerLetterWithAnim(apologyDoc)}
                  />
                  <div className="w-full max-w-[230px] flex justify-end -mt-1">
                    <HandDrawnPenIllustration className="w-36 sm:w-40 h-auto transform rotate-3" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-display text-base sm:text-lg font-semibold text-[#FAF2E8] drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                      {apologyDoc.letterTitle}
                    </p>
                    <p className="text-xs text-[#E8DDD0]/75">
                      {copy.stepC.apologyEnvelopeTag}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => startAdminEditOwnerDoc(apologyDoc)}
                        className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1 text-xs text-[#F7DFB2] underline underline-offset-4 hover:text-white cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>แก้ไข / เปลี่ยนชื่อซองนี้</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

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
                      : copy.stepC.writeReplyBtn}
                  </span>
                </button>
              </div>
            </div>
          ) : (
            /* กรณีที่ 3: โหมดเปิดอ่านเนื้อหาจดหมายบนกระดาษวินเทจ */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleCloseReaderBackToDesk}
                  className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm text-[#E8DDD0]/85 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                  <span>{copy.stepC.foldBackBtn}</span>
                </button>

                {isAdmin && activeOwnerDoc && (
                  <button
                    type="button"
                    onClick={() => startAdminEditOwnerDoc(activeOwnerDoc)}
                    className="night-glass-btn-active inline-flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    <span>แก้ไข / เปลี่ยนชื่อจดหมายนี้</span>
                  </button>
                )}

                {isAdmin && activeReplyDoc && (
                  <button
                    type="button"
                    onClick={() => startAdminEditReplyDoc(activeReplyDoc)}
                    className="night-glass-btn-active inline-flex items-center gap-2 min-h-[42px] px-4 py-2 text-xs sm:text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Pencil className="w-4 h-4" aria-hidden="true" />
                    <span>แก้ไข / เปลี่ยนชื่อจดหมายนี้</span>
                  </button>
                )}
              </div>

              {activeOwnerDoc ? (
                <article
                  key={activeOwnerDoc.id}
                  className="animate-parchment-unfold vintage-parchment p-6 sm:p-10"
                >
                  <header className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-[#5C442E]/25">
                    <div className="flex items-start gap-3">
                      <Mail
                        className="w-5 h-5 text-[#4A3525] mt-1 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="space-y-0.5">
                        <h2 className="font-display text-lg sm:text-xl font-semibold text-[#2B1F16]">
                          {activeOwnerDoc.letterTitle}
                        </h2>
                        <p className="text-xs sm:text-sm text-[#5A4636]">
                          <span>{activeOwnerDoc.senderLabel}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{activeOwnerDoc.dateLabel}</span>
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="space-y-5 text-[15.5px] sm:text-[16.5px] leading-[1.9] text-[#2B1F16]">
                    <p className="font-display font-semibold text-base sm:text-lg">
                      {activeOwnerDoc.salutation}
                    </p>

                    {activeOwnerDoc.paragraphs.map((paragraph, idx) => (
                      <p key={idx} className="whitespace-pre-line break-words">
                        {paragraph}
                      </p>
                    ))}
                  </div>

                  <footer className="mt-10 pt-6 border-t border-[#5C442E]/20 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
                    <div className="space-y-1 text-[#2B1F16]">
                      <p className="text-sm sm:text-base text-[#4A3525]">
                        {activeOwnerDoc.signOff}
                      </p>
                      <p className="font-display text-base sm:text-lg font-semibold">
                        {activeOwnerDoc.senderName}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => startAdminEditOwnerDoc(activeOwnerDoc)}
                          className="min-h-[48px] px-5 py-2.5 rounded-full border border-[#4A3525]/45 text-sm font-medium text-[#2B1F16] hover:bg-[#4A3525]/10 inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" aria-hidden="true" />
                          <span>แก้ไขฉบับนี้</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={onContinueOrStartReply}
                        className="parchment-action-btn inline-flex items-center justify-center gap-2.5 w-full sm:w-auto min-h-[48px] px-7 py-3 text-sm sm:text-base font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <PenLine className="w-4 h-4" aria-hidden="true" />
                        <span>{copy.stepC.writeReplyBtn}</span>
                      </button>
                    </div>
                  </footer>
                </article>
              ) : activeReplyDoc ? (
                <article
                  key={activeReplyDoc.letterId}
                  className="animate-parchment-unfold vintage-parchment p-6 sm:p-10"
                >
                  <header className="flex items-start justify-between gap-4 pb-5 mb-6 border-b border-[#5C442E]/25">
                    <div className="flex items-start gap-3">
                      <Mail
                        className="w-5 h-5 text-[#4A3525] mt-1 shrink-0"
                        aria-hidden="true"
                      />
                      <div className="space-y-0.5">
                        <h2 className="font-display text-lg sm:text-xl font-semibold text-[#2B1F16]">
                          {activeReplyDoc.title.trim() || 'จดหมายไม่มีชื่อเรื่อง'}
                        </h2>
                        <p className="text-xs sm:text-sm text-[#5A4636] tabular-nums">
                          <span>จาก: {activeReplyDoc.author.trim() || 'คุณ'}</span>
                          <span aria-hidden="true"> · </span>
                          <span>
                            {formatThaiTimestamp(
                              activeReplyDoc.lastSavedIso ||
                                activeReplyDoc.lastModifiedIso
                            )}
                          </span>
                        </p>
                      </div>
                    </div>
                  </header>

                  <div className="min-h-[180px] text-[15.5px] sm:text-[16.5px] leading-[1.9] text-[#2B1F16] whitespace-pre-wrap break-words">
                    {activeReplyDoc.body.trim() || '(ยังไม่มีเนื้อหาในฉบับนี้)'}
                  </div>

                  <footer className="mt-10 pt-6 border-t border-[#5C442E]/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <p className="text-xs text-[#5A4636] tabular-nums">
                      รหัสอ้างอิง:{' '}
                      <span className="font-mono">{activeReplyDoc.letterId}</span>
                    </p>

                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          isAdmin
                            ? startAdminEditReplyDoc(activeReplyDoc)
                            : onEditSpecificReply(activeReplyDoc)
                        }
                        className="parchment-action-btn inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <PenLine className="w-4 h-4" aria-hidden="true" />
                        <span>
                          {isAdmin ? 'เปลี่ยนชื่อ / แก้ไขจดหมายนี้' : 'แก้ไขจดหมายฉบับนี้'}
                        </span>
                      </button>
                    </div>
                  </footer>
                </article>
              ) : null}
            </div>
          )}
        </div>

            {/* พื้นที่ด้านข้าง (ขวา): กล่องใส่จดหมาย */}
        <aside
          aria-label="กล่องใส่จดหมาย"
          className="animate-scene-enter-delay-1 lg:col-span-5 xl:col-span-4 lg:sticky lg:top-8"
        >
          <div className="vintage-parchment p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 pb-4 border-b border-[#5C442E]/25">
              <div className="flex items-center gap-3 min-w-0">
                <WoodenLetterboxIllustration className="w-11 h-10 shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-[#2B1F16] truncate">
                    {copy.stepC.mailboxBoxTitle}
                  </h2>
                  <p className="text-xs text-[#5A4636]">
                    {isAdmin
                      ? `${copy.stepC.mailboxSubtitle} · กดดินสอเพื่อแก้ชื่อ/เนื้อหา`
                      : copy.stepC.mailboxSubtitle}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0 tabular-nums">
                <span className="font-display text-base sm:text-lg font-semibold text-[#2B1F16]">
                  {totalLetterCount} ฉบับ
                </span>
              </div>
            </div>

            <div className="divide-y divide-[#5C442E]/20">
              {/* รายการจดหมายของแอดมิน/ผู้สร้างทุกฉบับ */}
              {ownerLetters.map((doc) => {
                const variant = doc.id === 'birthday' ? 'birthday' : 'gold';
                return (
                  <div
                    key={doc.id}
                    className={`group py-2.5 px-2 -mx-2 rounded-md flex items-center gap-2 transition-colors ${
                      isItemActive({ kind: 'owner', docId: doc.id })
                        ? 'bg-[#4A3525]/15'
                        : 'hover:bg-[#4A3525]/9'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        selectLetterImmediately({ kind: 'owner', docId: doc.id })
                      }
                      className="flex-1 min-w-0 text-left flex items-start gap-3 py-1 cursor-pointer min-h-[48px]"
                    >
                      <MiniEnvelopeIcon
                        variant={variant}
                        className="w-9 h-7 mt-0.5 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:-rotate-2"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-sm sm:text-base font-semibold text-[#2B1F16] truncate">
                          {doc.letterTitle}
                        </p>
                        <p className="text-xs text-[#5A4636] mt-0.5 truncate">
                          <span>{doc.senderLabel}</span>
                          <span aria-hidden="true"> · </span>
                          <span>
                            {doc.id === 'birthday' ? 'ข้างแก้วกาแฟ' : doc.dateLabel}
                          </span>
                        </p>
                      </div>
                    </button>

                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => startAdminEditOwnerDoc(doc)}
                        title="แก้ไขและเปลี่ยนชื่อจดหมายฉบับนี้"
                        aria-label={`แก้ไข ${doc.letterTitle}`}
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[#3A281B] hover:bg-[#4A3525]/15 cursor-pointer shrink-0"
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <Paperclip
                        className="w-4 h-4 text-[#5A4636]/75 shrink-0 mr-1"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}

              {/* รายการจดหมายตอบกลับในกล่อง */}
              {userReplyLetters.map((reply) => {
                const isSynced =
                  reply.version > 0 && reply.lastSavedVersion >= reply.version;
                return (
                  <div
                    key={reply.letterId}
                    className={`group py-2.5 px-2 -mx-2 rounded-md flex items-center gap-2 transition-colors ${
                      isItemActive({ kind: 'reply', letterId: reply.letterId })
                        ? 'bg-[#4A3525]/15'
                        : 'hover:bg-[#4A3525]/9'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        selectLetterImmediately({
                          kind: 'reply',
                          letterId: reply.letterId,
                        })
                      }
                      className="flex-1 min-w-0 text-left flex items-start gap-3 py-1 cursor-pointer min-h-[48px]"
                    >
                      <MiniEnvelopeIcon
                        variant="reply"
                        className="w-9 h-7 mt-0.5 shrink-0 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:-rotate-2"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-sm sm:text-base font-semibold text-[#2B1F16] truncate">
                          {reply.title.trim() || 'จดหมายตอบกลับ (ยังไม่ระบุชื่อเรื่อง)'}
                        </p>
                        <p className="text-xs text-[#5A4636] mt-0.5 truncate tabular-nums">
                          <span>จาก: {reply.author.trim() || 'คุณ'}</span>
                          <span aria-hidden="true"> · </span>
                          <span>{isSynced ? 'บันทึกแล้ว' : 'ฉบับร่างในเครื่อง'}</span>
                          <span aria-hidden="true"> · </span>
                          <span>
                            {formatThaiTimestamp(
                              reply.lastSavedIso || reply.lastModifiedIso
                            )}
                          </span>
                        </p>
                      </div>
                    </button>

                    {isAdmin ? (
                      <button
                        type="button"
                        onClick={() => startAdminEditReplyDoc(reply)}
                        title="แก้ไขและเปลี่ยนชื่อจดหมายตอบกลับฉบับนี้"
                        aria-label={`แก้ไข ${reply.title || 'จดหมายตอบกลับ'}`}
                        className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[#3A281B] hover:bg-[#4A3525]/15 cursor-pointer shrink-0"
                      >
                        <Pencil className="w-4 h-4" aria-hidden="true" />
                      </button>
                    ) : (
                      <Paperclip
                        className="w-4 h-4 text-[#5A4636]/75 shrink-0 mr-1"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-4 mt-2 border-t border-[#5C442E]/25 space-y-3">
              <button
                type="button"
                onClick={onStartNewReply}
                className="parchment-action-btn w-full inline-flex items-center justify-center gap-2 min-h-[46px] px-5 py-2.5 text-sm font-medium whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
                <span>{copy.stepC.writeNewReplyBtn}</span>
              </button>

              <p className="flex items-start gap-2 text-[11.5px] leading-relaxed text-[#5A4636]">
                <UploadCloud className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{copy.stepC.privacyFooterNote}</span>
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Modal ยืนยันคืนค่าข้อความต้นฉบับสำหรับแอดมิน */}
      {confirmResetModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-owner-letters-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
        >
          <div className="vintage-parchment max-w-md w-full p-6 space-y-4">
            <h3
              id="reset-owner-letters-title"
              className="font-display text-lg font-semibold text-[#2B1F16]"
            >
              ต้องการคืนค่าจดหมายหลักกลับเป็นข้อความต้นฉบับใช่ไหม?
            </h3>
            <p className="text-sm text-[#4A3525] leading-relaxed">
              ชื่อซองและเนื้อหาของจดหมายขอโทษและจดหมายวันเกิดจะกลับไปเป็นข้อความเริ่มต้น
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetModalOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#4A3525] hover:bg-black/5 rounded-lg whitespace-nowrap cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmResetModalOpen(false);
                  onResetOwnerLetters();
                  setAdminEditor(null);
                  setAdminSaveFeedback('คืนค่าจดหมายกลับเป็นข้อความต้นฉบับเรียบร้อยแล้ว');
                }}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold bg-[#8F2D22] hover:bg-[#752219] text-white rounded-full whitespace-nowrap cursor-pointer"
              >
                ยืนยันคืนค่าต้นฉบับ
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
