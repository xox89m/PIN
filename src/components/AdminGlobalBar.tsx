import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LetterDocument, SiteCopy } from '../content/letters';
import { cloneSiteCopy, ReplyLetterDraft } from '../services/letterStorage';
import { PublishResult } from '../services/cloudConfigSync';
import { soundEngine } from '../services/soundEngine';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '../firebase';
import {
  AlertCircle,
  ArrowLeft,
  Check,
  ChevronDown,
  Eye,
  Home,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';

export type StepKey = 'COVER' | 'A' | 'B' | 'C' | 'D' | 'E';
type EditorTabKey = 'LETTERS' | 'GLOBAL' | StepKey;

interface AdminGlobalBarProps {
  currentStep: StepKey;
  siteCopy: SiteCopy;
  ownerLetters: LetterDocument[];
  allReplyLetters: ReplyLetterDraft[];
  adminEmail: string | null;
  isCloudAdminVerified: boolean;
  loginModalOpen: boolean;
  onSetLoginModalOpen: (open: boolean) => void;
  onConnectCloudAdmin: () => Promise<PublishResult>;
  onSignOutCloudAdmin: () => Promise<void>;
  onJumpToStep: (step: StepKey) => void;
  onSaveSiteCopy: (nextCopy: SiteCopy) => Promise<PublishResult>;
  onResetSiteCopy: () => Promise<PublishResult>;
  onSaveOwnerLetter: (updatedDoc: LetterDocument) => Promise<PublishResult>;
  onDeleteExtraOwnerLetter: (docId: string) => Promise<PublishResult>;
  onAdminSaveReplyLetter: (updatedReply: ReplyLetterDraft) => Promise<PublishResult>;
  onAdminDeleteReplyLetter: (letterId: string) => Promise<PublishResult>;
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

type ActiveLetterEditState =
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

export function AdminGlobalBar({
  currentStep,
  siteCopy,
  ownerLetters,
  allReplyLetters,
  adminEmail,
  isCloudAdminVerified,
  loginModalOpen,
  onSetLoginModalOpen,
  onConnectCloudAdmin,
  onSignOutCloudAdmin,
  onJumpToStep,
  onSaveSiteCopy,
  onResetSiteCopy,
  onSaveOwnerLetter,
  onDeleteExtraOwnerLetter,
  onAdminSaveReplyLetter,
  onAdminDeleteReplyLetter,
  onExitAdminMode,
}: AdminGlobalBarProps) {
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTab, setEditingTab] = useState<EditorTabKey>(currentStep);
  const [draftCopy, setDraftCopy] = useState<SiteCopy>(() => cloneSiteCopy(siteCopy));
  const [activeLetterEdit, setActiveLetterEdit] =
    useState<ActiveLetterEditState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loginFeedback, setLoginFeedback] = useState('');
  const [loginIsError, setLoginIsError] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackIsError, setFeedbackIsError] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const navRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setDraftCopy(cloneSiteCopy(siteCopy));
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

  const totalLettersCount = useMemo(
    () => ownerLetters.length + allReplyLetters.length,
    [ownerLetters.length, allReplyLetters.length]
  );

  const openEditorWithTab = (tab: EditorTabKey) => {
    soundEngine.playPaperOpenSfx();
    setDraftCopy(cloneSiteCopy(siteCopy));
    setEditingTab(tab);
    setActiveLetterEdit(null);
    setFeedbackMsg('');
    setFeedbackIsError(false);
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
    setFeedbackIsError(false);
    soundEngine.playSoftTapSfx();

    const res = await onSaveSiteCopy(draftCopy);
    setIsSaving(false);
    if (res.ok) {
      setFeedbackIsError(false);
      setFeedbackMsg(
        'บันทึกและเผยแพร่ออนไลน์สำเร็จ! ทุกคนที่เข้าเว็บจะเห็นข้อความนี้ตรงกันทันที'
      );
    } else {
      setFeedbackIsError(true);
      setFeedbackMsg(
        res.errorMessage ||
          'บันทึกไว้ในเครื่องแล้ว กดบันทึกอีกครั้งเพื่อเผยแพร่ออนไลน์ให้ทุกคนเห็น'
      );
    }
  };

  const handleSaveLetterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLetterEdit) return;
    setIsSaving(true);
    setFeedbackMsg('');
    setFeedbackIsError(false);
    soundEngine.playSoftTapSfx();

    if (activeLetterEdit.kind === 'owner') {
      const paragraphs = activeLetterEdit.bodyText
        .replace(/\r\n/g, '\n')
        .split(/\n{2,}/)
        .map((p) => p.trim())
        .filter((p) => p.length > 0);

      const updatedDoc: LetterDocument = {
        id: activeLetterEdit.id,
        isOwnerApprovedForProduction: true,
        letterTitle: activeLetterEdit.letterTitle.trim() || 'จดหมายถึงคุณ',
        senderLabel: activeLetterEdit.senderLabel.trim(),
        dateLabel: activeLetterEdit.dateLabel.trim(),
        salutation: activeLetterEdit.salutation.trim(),
        paragraphs: paragraphs.length > 0 ? paragraphs : [''],
        signOff: activeLetterEdit.signOff.trim(),
        senderName: activeLetterEdit.senderName.trim(),
      };

      const res = await onSaveOwnerLetter(updatedDoc);
      setIsSaving(false);
      if (res.ok) {
        setActiveLetterEdit(null);
        setFeedbackIsError(false);
        setFeedbackMsg('บันทึกจดหมายและอัปเดตให้ทุกคนเห็นตรงกันเรียบร้อยแล้ว');
      } else {
        setFeedbackIsError(true);
        setFeedbackMsg(
          res.errorMessage || 'บันทึกจดหมายไว้ในเครื่องแล้ว'
        );
      }
    } else {
      const updatedReply: ReplyLetterDraft = {
        ...activeLetterEdit.original,
        title: activeLetterEdit.title.trim() || 'จดหมายตอบกลับ',
        author: activeLetterEdit.author.trim() || 'คุณ',
        body: activeLetterEdit.body,
        version: activeLetterEdit.original.version + 1,
        lastModifiedIso: new Date().toISOString(),
      };

      const res = await onAdminSaveReplyLetter(updatedReply);
      setIsSaving(false);
      if (res.ok) {
        setActiveLetterEdit(null);
        setFeedbackIsError(false);
        setFeedbackMsg('บันทึกการแก้ไขจดหมายของสมาชิกและซิงก์ให้ทุกคนอ่านได้แล้ว');
      } else {
        setFeedbackIsError(true);
        setFeedbackMsg(
          res.errorMessage || 'บันทึกไว้ในเครื่องแล้ว'
        );
      }
    }
  };

  const renderField = (
    id: string,
    label: string,
    value: string,
    onChange: (val: string) => void,
    multiline = false
  ) => (
    <div className="space-y-1">
      <label
        htmlFor={id}
        className="block text-xs sm:text-sm font-semibold text-[#2B1F16]"
      >
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
      <div
        ref={navRef}
        className="fixed top-4 left-4 z-30 flex flex-wrap items-center gap-1.5 max-w-[calc(100vw-180px)] sm:max-w-none"
      >
        <button
          type="button"
          onClick={() => {
            soundEngine.playSoftTapSfx();
            onJumpToStep('COVER');
          }}
          title="กลับไปหน้าแรก"
          className={`inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer shadow-lg ${
            currentStep === 'COVER' ? 'night-glass-btn-active' : 'night-glass-btn'
          }`}
        >
          <Home className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>หน้าแรก</span>
        </button>

        <button
          type="button"
          onClick={() => openEditorWithTab(currentStep)}
          className="night-glass-btn-active inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer shadow-lg"
        >
          <Pencil className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span>แก้ไขคำทุกหน้า</span>
        </button>

        <button
          type="button"
          onClick={() => openEditorWithTab('LETTERS')}
          className="night-glass-btn inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer shadow-lg"
        >
          <Mail className="w-3.5 h-3.5 text-[#F5CA7B] shrink-0" aria-hidden="true" />
          <span>จดหมายทุกฉบับ ({totalLettersCount})</span>
        </button>

        <div className="relative">
          <button
            type="button"
            onClick={() => setNavMenuOpen((prev) => !prev)}
            aria-expanded={navMenuOpen}
            className="night-glass-btn inline-flex items-center gap-1.5 min-h-[42px] px-3 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer shadow-lg"
          >
            <span>เลือกหน้า</span>
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
                  <span>ออกจากโหมดผู้ดูแล</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            soundEngine.playSoftTapSfx();
            setLoginFeedback('');
            setLoginIsError(false);
            onSetLoginModalOpen(true);
          }}
          className={`inline-flex items-center gap-1.5 min-h-[42px] px-3.5 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer shadow-lg ${
            isCloudAdminVerified
              ? 'night-glass-btn text-[#C6F2D2]'
              : 'night-glass-btn-active text-[#F7DFB2]'
          }`}
        >
          {isCloudAdminVerified ? (
            <>
              <ShieldCheck className="w-4 h-4 text-[#9CE3B0] shrink-0" aria-hidden="true" />
              <span>ล็อกอินแล้ว (ผู้ดูแล)</span>
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4 text-[#F5CA7B] shrink-0" aria-hidden="true" />
              <span>{siteCopy.globalBars.adminLoginBtn.trim() || 'ล็อกอินผู้ดูแล'}</span>
            </>
          )}
        </button>
      </div>

      {loginModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-cloud-login-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs"
        >
          <div className="vintage-parchment w-full max-w-md p-6 sm:p-7 space-y-5">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#5C442E]/25">
              <div className="space-y-0.5">
                <h2
                  id="admin-cloud-login-title"
                  className="font-display text-lg sm:text-xl font-semibold text-[#2B1F16]"
                >
                  บัญชีผู้ดูแลระบบ (ซิงก์ออนไลน์)
                </h2>
                <p className="text-xs text-[#5A4636]">
                  ล็อกอินด้วยบัญชีเจ้าของเว็บเพื่อให้ทุกคำและจดหมายที่คุณแก้ไข แสดงตรงกันให้ทุกคนเห็นทันที
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  soundEngine.playPaperCloseSfx();
                  onSetLoginModalOpen(false);
                }}
                aria-label="ปิดหน้าต่างล็อกอินผู้ดูแล"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[#3A281B] hover:bg-black/10 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {isCloudAdminVerified ? (
              <div className="space-y-4">
                <div className="p-3.5 rounded-xl bg-[#1F5129]/10 border border-[#1F5129]/30 space-y-1">
                  <p className="text-xs sm:text-sm font-semibold text-[#1F5129] flex items-center gap-1.5">
                    <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>เข้าสู่ระบบผู้ดูแลเรียบร้อยแล้ว</span>
                  </p>
                  <p className="text-xs text-[#3A281B] break-all">
                    บัญชีที่เชื่อมต่อ: <span className="font-semibold">{adminEmail || BOOTSTRAPPED_ADMIN_EMAIL}</span>
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                  <button
                    type="button"
                    disabled={isConnecting}
                    onClick={() => {
                      setIsConnecting(true);
                      setLoginFeedback('');
                      setLoginIsError(false);
                      soundEngine.playSoftTapSfx();
                      void onConnectCloudAdmin().then((res) => {
                        setIsConnecting(false);
                        setLoginIsError(!res.ok);
                        setLoginFeedback(
                          res.ok
                            ? 'อัปเดตข้อความและจดหมายทั้งหมดขึ้นคลาวด์สำเร็จ!'
                            : res.errorMessage || 'ไม่สามารถซิงก์ข้อมูลได้ในขณะนี้'
                        );
                      });
                    }}
                    className="parchment-action-btn flex-1 min-h-[44px] px-4 py-2 text-xs sm:text-sm font-medium inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>
                      {isConnecting ? 'กำลังซิงก์ข้อมูล...' : 'ซิงก์ข้อมูลขึ้นคลาวด์ทันที'}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playSoftTapSfx();
                      void onSignOutCloudAdmin().then(() => {
                        setLoginIsError(false);
                        setLoginFeedback('ออกจากระบบบัญชี Google แล้ว');
                      });
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-full border border-[#5C442E]/35 text-xs sm:text-sm font-medium text-[#5A251C] hover:bg-[#5C442E]/10 inline-flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer"
                  >
                    <LogOut className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>ออกจากระบบ Google</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3.5">
                {adminEmail && (
                  <p className="text-xs text-[#6E3026] bg-[#8F2D22]/10 border border-[#8F2D22]/25 rounded-lg px-3 py-2">
                    ขณะนี้ล็อกอินด้วย <span className="font-semibold">{adminEmail}</span> ซึ่งไม่ใช่บัญชีผู้ดูแล ({BOOTSTRAPPED_ADMIN_EMAIL})
                  </p>
                )}

                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={() => {
                    setIsConnecting(true);
                    setLoginFeedback('');
                    setLoginIsError(false);
                    soundEngine.playSoftTapSfx();
                    void onConnectCloudAdmin().then((res) => {
                      setIsConnecting(false);
                      setLoginIsError(!res.ok);
                      setLoginFeedback(
                        res.ok
                          ? 'ล็อกอินผู้ดูแลและซิงก์ข้อมูลออนไลน์สำเร็จ!'
                          : res.errorMessage || 'ไม่สามารถล็อกอินผู้ดูแลได้ กรุณาลองอีกครั้ง'
                      );
                    });
                  }}
                  className="parchment-action-btn w-full min-h-[48px] px-5 py-2.5 text-sm sm:text-base font-medium inline-flex items-center justify-center gap-2.5 whitespace-nowrap cursor-pointer disabled:opacity-55"
                >
                  <LogIn className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>
                    {isConnecting
                      ? 'กำลังเปิดหน้าต่าง Google...'
                      : 'ล็อกอินผู้ดูแลด้วย Google'}
                  </span>
                </button>

                <p className="text-xs text-[#5A4636] text-center leading-relaxed">
                  ใช้บัญชีเจ้าของเว็บ ({BOOTSTRAPPED_ADMIN_EMAIL}) เพื่อเปิดสิทธิ์บันทึกคำและแก้ไขจดหมายของทุกคนบนคลาวด์
                </p>
              </div>
            )}

            {loginFeedback && (
              <p
                className={`text-xs sm:text-sm font-semibold flex items-start gap-1.5 ${
                  loginIsError ? 'text-[#85271D]' : 'text-[#1F5129]'
                }`}
              >
                {loginIsError ? (
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                ) : (
                  <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                )}
                <span>{loginFeedback}</span>
              </p>
            )}
          </div>
        </div>
      )}

      {editorOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-copy-editor-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/75 backdrop-blur-xs overflow-y-auto"
        >
          <div className="vintage-parchment w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden my-auto">
            <div className="px-5 sm:px-7 py-4 border-b border-[#5C442E]/25 flex items-center justify-between gap-3 shrink-0">
              <div>
                <h2
                  id="admin-copy-editor-title"
                  className="font-display text-lg sm:text-xl font-semibold text-[#2B1F16]"
                >
                  จัดการคำทุกหน้า & จดหมายทุกฉบับที่มีอยู่
                </h2>
                <p className="text-xs text-[#5A4636]">
                  แก้ไขคำพูด ปุ่มข้อความทุกหน้า และจดหมายของทุกคนได้ครบในที่เดียว
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  soundEngine.playPaperCloseSfx();
                  setEditorOpen(false);
                }}
                aria-label="ปิดหน้าต่างจัดการผู้ดูแล"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-[#3A281B] hover:bg-black/10 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* แถบเลือกหมวดหมู่ */}
            <div className="px-5 sm:px-7 py-2.5 bg-[#4A3525]/10 border-b border-[#5C442E]/20 flex items-center gap-1.5 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => {
                  soundEngine.playSoftTapSfx();
                  setEditingTab('LETTERS');
                  setActiveLetterEdit(null);
                  setFeedbackMsg('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer min-h-[36px] ${
                  editingTab === 'LETTERS'
                    ? 'bg-[#3A281B] text-[#FAF2E8]'
                    : 'text-[#3A281B] hover:bg-[#3A281B]/12'
                }`}
              >
                จดหมายทุกฉบับ ({totalLettersCount})
              </button>

              {STEP_LABELS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    soundEngine.playSoftTapSfx();
                    setEditingTab(tab.key);
                    setActiveLetterEdit(null);
                    setFeedbackMsg('');
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

              <button
                type="button"
                onClick={() => {
                  soundEngine.playSoftTapSfx();
                  setEditingTab('GLOBAL');
                  setActiveLetterEdit(null);
                  setFeedbackMsg('');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer min-h-[36px] ${
                  editingTab === 'GLOBAL'
                    ? 'bg-[#3A281B] text-[#FAF2E8]'
                    : 'text-[#3A281B] hover:bg-[#3A281B]/12'
                }`}
              >
                ปุ่มมุมบน (เสียง/ผู้ดูแล)
              </button>
            </div>

            {editingTab === 'LETTERS' ? (
              <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5">
                {activeLetterEdit ? (
                  <form
                    onSubmit={(e) => {
                      void handleSaveLetterSubmit(e);
                    }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#5C442E]/20">
                      <button
                        type="button"
                        onClick={() => setActiveLetterEdit(null)}
                        className="inline-flex items-center gap-1.5 min-h-[38px] px-2.5 py-1 text-xs sm:text-sm font-medium text-[#3A281B] hover:underline cursor-pointer"
                      >
                        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                        <span>กลับไปหน้ารายชื่อจดหมายทั้งหมด</span>
                      </button>
                      <span className="text-xs font-semibold text-[#5A4636]">
                        {activeLetterEdit.kind === 'owner'
                          ? 'แก้ไขจดหมายบนโต๊ะ'
                          : 'แก้ไขจดหมายตอบกลับของผู้เข้าชม'}
                      </span>
                    </div>

                    {activeLetterEdit.kind === 'owner' ? (
                      <div className="space-y-3.5">
                        {renderField(
                          'mgr-owner-title',
                          'ชื่อจดหมาย *',
                          activeLetterEdit.letterTitle,
                          (val) =>
                            setActiveLetterEdit({
                              ...activeLetterEdit,
                              letterTitle: val,
                            })
                        )}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderField(
                            'mgr-owner-sender-lbl',
                            'ป้ายผู้ส่ง (เช่น จาก: ฉัน)',
                            activeLetterEdit.senderLabel,
                            (val) =>
                              setActiveLetterEdit({
                                ...activeLetterEdit,
                                senderLabel: val,
                              })
                          )}
                          {renderField(
                            'mgr-owner-date-lbl',
                            'คำกำกับ / วันที่',
                            activeLetterEdit.dateLabel,
                            (val) =>
                              setActiveLetterEdit({
                                ...activeLetterEdit,
                                dateLabel: val,
                              })
                          )}
                        </div>
                        {renderField(
                          'mgr-owner-salutation',
                          'คำขึ้นต้นจดหมาย',
                          activeLetterEdit.salutation,
                          (val) =>
                            setActiveLetterEdit({
                              ...activeLetterEdit,
                              salutation: val,
                            })
                        )}
                        <div className="space-y-1">
                          <label
                            htmlFor="mgr-owner-body"
                            className="block text-xs sm:text-sm font-semibold text-[#2B1F16]"
                          >
                            เนื้อหาจดหมาย (เว้น 1 บรรทัดว่างเพื่อแยกย่อหน้า) *
                          </label>
                          <textarea
                            id="mgr-owner-body"
                            rows={10}
                            required
                            value={activeLetterEdit.bodyText}
                            onKeyDown={handleKeyDown}
                            onChange={(e) => {
                              soundEngine.playWritingKeystrokeSfx();
                              setActiveLetterEdit({
                                ...activeLetterEdit,
                                bodyText: e.target.value,
                              });
                            }}
                            className="parchment-input w-full p-3 text-sm leading-relaxed resize-y min-h-[220px]"
                          />
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {renderField(
                            'mgr-owner-signoff',
                            'คำลงท้าย',
                            activeLetterEdit.signOff,
                            (val) =>
                              setActiveLetterEdit({
                                ...activeLetterEdit,
                                signOff: val,
                              })
                          )}
                          {renderField(
                            'mgr-owner-sendername',
                            'ลงชื่อผู้เขียน',
                            activeLetterEdit.senderName,
                            (val) =>
                              setActiveLetterEdit({
                                ...activeLetterEdit,
                                senderName: val,
                              })
                          )}
                        </div>

                        <div className="pt-3 border-t border-[#5C442E]/20 flex items-center justify-between gap-3">
                          {activeLetterEdit.id !== 'apology' &&
                          activeLetterEdit.id !== 'birthday' &&
                          !activeLetterEdit.isNew ? (
                            <button
                              type="button"
                              onClick={() => {
                                const delId = activeLetterEdit.id;
                                setActiveLetterEdit(null);
                                void onDeleteExtraOwnerLetter(delId).then((res) => {
                                  setFeedbackIsError(!res.ok);
                                  setFeedbackMsg(
                                    res.ok
                                      ? 'ลบจดหมายเรียบร้อยแล้ว'
                                      : res.errorMessage || 'ลบจดหมายจากเครื่องแล้ว'
                                  );
                                });
                              }}
                              className="inline-flex items-center gap-1.5 min-h-[42px] px-3 py-1.5 text-xs sm:text-sm text-[#7A241B] hover:underline cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" aria-hidden="true" />
                              <span>ลบจดหมายฉบับนี้</span>
                            </button>
                          ) : (
                            <span />
                          )}

                          <button
                            type="submit"
                            disabled={isSaving}
                            className="parchment-action-btn inline-flex items-center gap-2 min-h-[44px] px-6 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" aria-hidden="true" />
                            <span>
                              {isSaving ? 'กำลังบันทึก...' : 'บันทึกจดหมายฉบับนี้'}
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {renderField(
                          'mgr-reply-title',
                          'ชื่อจดหมาย *',
                          activeLetterEdit.title,
                          (val) =>
                            setActiveLetterEdit({
                              ...activeLetterEdit,
                              title: val,
                            })
                        )}
                        {renderField(
                          'mgr-reply-author',
                          'ชื่อผู้เขียน *',
                          activeLetterEdit.author,
                          (val) =>
                            setActiveLetterEdit({
                              ...activeLetterEdit,
                              author: val,
                            })
                        )}
                        <div className="space-y-1">
                          <label
                            htmlFor="mgr-reply-body"
                            className="block text-xs sm:text-sm font-semibold text-[#2B1F16]"
                          >
                            เนื้อหาจดหมาย *
                          </label>
                          <textarea
                            id="mgr-reply-body"
                            rows={8}
                            required
                            value={activeLetterEdit.body}
                            onKeyDown={handleKeyDown}
                            onChange={(e) => {
                              soundEngine.playWritingKeystrokeSfx();
                              setActiveLetterEdit({
                                ...activeLetterEdit,
                                body: e.target.value,
                              });
                            }}
                            className="parchment-input w-full p-3 text-sm leading-relaxed resize-y min-h-[190px]"
                          />
                        </div>

                        <div className="pt-3 border-t border-[#5C442E]/20 flex items-center justify-between gap-3">
                          <button
                            type="button"
                            onClick={() => {
                              const delId = activeLetterEdit.original.letterId;
                              setActiveLetterEdit(null);
                              void onAdminDeleteReplyLetter(delId).then((res) => {
                                setFeedbackIsError(!res.ok);
                                setFeedbackMsg(
                                  res.ok
                                    ? 'ลบจดหมายตอบกลับเรียบร้อยแล้ว'
                                    : res.errorMessage || 'ลบจากเครื่องแล้ว'
                                );
                              });
                            }}
                            className="inline-flex items-center gap-1.5 min-h-[42px] px-3 py-1.5 text-xs sm:text-sm text-[#7A241B] hover:underline cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                            <span>ลบจดหมายฉบับนี้</span>
                          </button>

                          <button
                            type="submit"
                            disabled={isSaving}
                            className="parchment-action-btn inline-flex items-center gap-2 min-h-[44px] px-6 py-2 text-xs sm:text-sm font-medium whitespace-nowrap cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-4 h-4" aria-hidden="true" />
                            <span>
                              {isSaving
                                ? 'กำลังบันทึก...'
                                : 'บันทึกและซิงก์ให้ทุกคนอ่านได้'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </form>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-display text-sm sm:text-base font-semibold text-[#2B1F16]">
                          จดหมายหลักบนโต๊ะ ({ownerLetters.length} ฉบับ)
                        </h3>
                        <button
                          type="button"
                          onClick={() => {
                            soundEngine.playPaperOpenSfx();
                            setActiveLetterEdit({
                              kind: 'owner',
                              id: `note_${Date.now().toString(36)}`,
                              letterTitle: 'จดหมายฉบับใหม่ถึงคุณ',
                              senderLabel: 'จาก: ฉัน',
                              dateLabel: 'ถึงคุณ',
                              salutation: 'ถึงคุณ...',
                              bodyText: '',
                              signOff: 'ด้วยความปรารถนาดี',
                              senderName: 'ฉัน',
                              isNew: true,
                            });
                          }}
                          className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1 rounded-lg bg-[#3A281B] text-[#FAF2E8] text-xs font-medium cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>เพิ่มจดหมายใหม่</span>
                        </button>
                      </div>

                      <div className="divide-y divide-[#5C442E]/20 border border-[#5C442E]/25 rounded-xl bg-white/35 overflow-hidden">
                        {ownerLetters.map((doc) => (
                          <div
                            key={doc.id}
                            className="px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div className="min-w-0">
                              <p className="font-display text-sm font-semibold text-[#2B1F16] truncate">
                                {doc.letterTitle}
                              </p>
                              <p className="text-xs text-[#5A4636] truncate">
                                {doc.senderLabel} · {doc.dateLabel}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                soundEngine.playPaperOpenSfx();
                                setActiveLetterEdit({
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
                              }}
                              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg border border-[#4A3525]/35 text-xs font-semibold text-[#2B1F16] hover:bg-[#4A3525]/10 whitespace-nowrap cursor-pointer shrink-0"
                            >
                              <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>แก้ไขคำ</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2.5">
                      <h3 className="font-display text-sm sm:text-base font-semibold text-[#2B1F16]">
                        จดหมายตอบกลับจากผู้เข้าชมทุกคน ({allReplyLetters.length} ฉบับ)
                      </h3>

                      {allReplyLetters.length === 0 ? (
                        <p className="text-xs text-[#5A4636] py-3">
                          ยังไม่มีจดหมายตอบกลับในกล่องขณะนี้
                        </p>
                      ) : (
                        <div className="divide-y divide-[#5C442E]/20 border border-[#5C442E]/25 rounded-xl bg-white/35 overflow-hidden">
                          {allReplyLetters.map((reply) => (
                            <div
                              key={reply.letterId}
                              className="px-4 py-3 flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="font-display text-sm font-semibold text-[#2B1F16] truncate">
                                  {reply.title.trim() || 'จดหมายตอบกลับ'}
                                </p>
                                <p className="text-xs text-[#5A4636] truncate">
                                  จาก: {reply.author.trim() || 'คุณ'} ·{' '}
                                  {reply.isPublicCloud
                                    ? 'ทุกคนอ่านได้'
                                    : 'เฉพาะในเครื่องนี้ (กดแก้ไขเพื่อซิงก์ให้ทุกคนอ่านได้)'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  soundEngine.playPaperOpenSfx();
                                  setActiveLetterEdit({
                                    kind: 'reply',
                                    original: reply,
                                    title: reply.title,
                                    author: reply.author,
                                    body: reply.body,
                                  });
                                }}
                                className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg border border-[#4A3525]/35 text-xs font-semibold text-[#2B1F16] hover:bg-[#4A3525]/10 whitespace-nowrap cursor-pointer shrink-0"
                              >
                                <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                                <span>แก้ไขคำ</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {feedbackMsg && (
                  <p
                    className={`text-xs sm:text-sm font-semibold flex items-start gap-1.5 pt-1 ${
                      feedbackIsError ? 'text-[#85271D]' : 'text-[#1F5129]'
                    }`}
                  >
                    {feedbackIsError ? (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <span>{feedbackMsg}</span>
                  </p>
                )}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  void handleSaveCopySubmit(e);
                }}
                className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-4"
              >
                <p className="font-display text-sm font-semibold text-[#4A3525]">
                  {editingTab === 'GLOBAL'
                    ? 'ข้อความปุ่มมุมบนของเว็บไซต์ (ปุ่มผู้ดูแล & ปุ่มเพลง)'
                    : STEP_LABELS.find((s) => s.key === editingTab)?.fullLabel}
                </p>

                {editingTab === 'GLOBAL' && (
                  <div className="space-y-3.5">
                    {renderField(
                      'copy-global-admin-btn',
                      'ข้อความปุ่มล็อกอินผู้ดูแล (แสดงบนแถบผู้ดูแลหลังยืนยันวันเกิด)',
                      draftCopy.globalBars.adminLoginBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          globalBars: { ...draftCopy.globalBars, adminLoginBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-global-sound-tap',
                      'ข้อความปุ่มเสียงก่อนแตะเปิดเพลง',
                      draftCopy.globalBars.soundTapToPlayBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          globalBars: {
                            ...draftCopy.globalBars,
                            soundTapToPlayBtn: val,
                          },
                        })
                    )}
                    {renderField(
                      'copy-global-sound-muted',
                      'ข้อความปุ่มเสียงเมื่อปิดเสียงอยู่',
                      draftCopy.globalBars.soundMutedBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          globalBars: { ...draftCopy.globalBars, soundMutedBtn: val },
                        })
                    )}
                    {renderField(
                      'copy-global-sound-sfx',
                      'ข้อความปุ่มเสียงเมื่อเปิดเฉพาะเสียงกระดาษ',
                      draftCopy.globalBars.soundPlayingSfxOnlyBtn,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          globalBars: {
                            ...draftCopy.globalBars,
                            soundPlayingSfxOnlyBtn: val,
                          },
                        })
                    )}
                  </div>
                )}

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
                      'คำถามแรก',
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
                    {renderField(
                      'copy-b-hint',
                      'คำอธิบายช่วงปี ค.ศ. ใต้ช่องเลือก',
                      draftCopy.stepB.yearRangeHint,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepB: { ...draftCopy.stepB, yearRangeHint: val },
                        })
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {renderField(
                        'copy-c-bday-tag',
                        'คำใต้ซองวันเกิดข้างแก้วกาแฟ',
                        draftCopy.stepC.birthdayEnvelopeTag,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, birthdayEnvelopeTag: val },
                          })
                      )}
                      {renderField(
                        'copy-c-apol-tag',
                        'คำใต้ซองจดหมายขอโทษ',
                        draftCopy.stepC.apologyEnvelopeTag,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, apologyEnvelopeTag: val },
                          })
                      )}
                      {renderField(
                        'copy-c-extra-tag',
                        'คำใต้ซองจดหมายเพิ่มเติม',
                        draftCopy.stepC.extraEnvelopeTag,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, extraEnvelopeTag: val },
                          })
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                      {renderField(
                        'copy-c-unit',
                        'หน่วยนับจำนวนจดหมาย (เช่น ฉบับ)',
                        draftCopy.stepC.letterCountUnit,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, letterCountUnit: val },
                          })
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                        'copy-c-skip-open',
                        'ปุ่มข้ามแอนิเมชันตอนเปิดซอง',
                        draftCopy.stepC.skipOpenAnimBtn,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, skipOpenAnimBtn: val },
                          })
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                        'copy-c-cont-draft',
                        'ปุ่มเขียนจดหมายฉบับร่างต่อ',
                        draftCopy.stepC.continueDraftBtn,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, continueDraftBtn: val },
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {renderField(
                        'copy-c-from-prefix',
                        'คำนำหน้าผู้เขียน (เช่น จาก:)',
                        draftCopy.stepC.replySenderPrefix,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, replySenderPrefix: val },
                          })
                      )}
                      {renderField(
                        'copy-c-untitled',
                        'ชื่อเริ่มต้นเมื่อไม่ระบุหัวข้อ',
                        draftCopy.stepC.untitledReplyLabel,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, untitledReplyLabel: val },
                          })
                      )}
                      {renderField(
                        'copy-c-empty-body',
                        'ข้อความเมื่อยังไม่มีเนื้อหา',
                        draftCopy.stepC.emptyReplyBodyLabel,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, emptyReplyBodyLabel: val },
                          })
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {renderField(
                        'copy-c-ref-lbl',
                        'ป้ายรหัสอ้างอิง',
                        draftCopy.stepC.referenceIdLabel,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, referenceIdLabel: val },
                          })
                      )}
                      {renderField(
                        'copy-c-edit-reply',
                        'ปุ่มแก้ไขจดหมายฉบับนี้',
                        draftCopy.stepC.editReplyBtn,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, editReplyBtn: val },
                          })
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {renderField(
                        'copy-c-synced-badge',
                        'สถานะจดหมายที่บันทึกแล้ว',
                        draftCopy.stepC.syncedBadgeLabel,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, syncedBadgeLabel: val },
                          })
                      )}
                      {renderField(
                        'copy-c-draft-badge',
                        'สถานะฉบับร่างในเครื่อง',
                        draftCopy.stepC.localDraftBadgeLabel,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepC: { ...draftCopy.stepC, localDraftBadgeLabel: val },
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
                      'ข้อความชี้แจงด้านบนกระดาษ',
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
                        'ข้อความตัวอย่างช่องชื่อจดหมาย',
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
                        'ข้อความตัวอย่างช่องชื่อผู้เขียน',
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
                        'ข้อความตัวอย่างช่องเนื้อหา',
                        draftCopy.stepD.bodyPlaceholder,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepD: { ...draftCopy.stepD, bodyPlaceholder: val },
                          })
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {renderField(
                        'copy-d-st-autosave',
                        'สถานะบันทึกอัตโนมัติ',
                        draftCopy.stepD.autosaveHintText,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepD: { ...draftCopy.stepD, autosaveHintText: val },
                          })
                      )}
                      {renderField(
                        'copy-d-st-saving',
                        'สถานะกำลังบันทึก',
                        draftCopy.stepD.savingStatusText,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepD: { ...draftCopy.stepD, savingStatusText: val },
                          })
                      )}
                      {renderField(
                        'copy-d-st-saved',
                        'สถานะบันทึกแล้ว',
                        draftCopy.stepD.savedStatusText,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepD: { ...draftCopy.stepD, savedStatusText: val },
                          })
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {renderField(
                        'copy-d-st-offline',
                        'สถานะออฟไลน์',
                        draftCopy.stepD.offlineStatusText,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepD: { ...draftCopy.stepD, offlineStatusText: val },
                          })
                      )}
                      {renderField(
                        'copy-d-st-err',
                        'สถานะบันทึกไม่สำเร็จ',
                        draftCopy.stepD.errorStatusText,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepD: { ...draftCopy.stepD, errorStatusText: val },
                          })
                      )}
                      {renderField(
                        'copy-d-retry-btn',
                        'ปุ่มลองบันทึกใหม่',
                        draftCopy.stepD.retryInlineBtn,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepD: { ...draftCopy.stepD, retryInlineBtn: val },
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
                    {renderField(
                      'copy-d-modal-title',
                      'หัวข้อยืนยันล้างฉบับร่าง',
                      draftCopy.stepD.clearModalTitle,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, clearModalTitle: val },
                        })
                    )}
                    {renderField(
                      'copy-d-modal-body',
                      'คำอธิบายก่อนล้างฉบับร่าง',
                      draftCopy.stepD.clearModalBody,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepD: { ...draftCopy.stepD, clearModalBody: val },
                        }),
                      true
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {renderField(
                        'copy-d-modal-cancel',
                        'ปุ่มยกเลิกล้างฉบับร่าง',
                        draftCopy.stepD.clearModalCancelBtn,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepD: { ...draftCopy.stepD, clearModalCancelBtn: val },
                          })
                      )}
                      {renderField(
                        'copy-d-modal-confirm',
                        'ปุ่มยืนยันล้างฉบับร่าง',
                        draftCopy.stepD.clearModalConfirmBtn,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepD: { ...draftCopy.stepD, clearModalConfirmBtn: val },
                          })
                      )}
                    </div>
                  </div>
                )}

                {editingTab === 'E' && (
                  <div className="space-y-3.5">
                    {renderField(
                      'copy-e-saving-title',
                      'หัวข้อระหว่างกำลังบันทึกก่อนพับซอง',
                      draftCopy.stepE.savingOverlayTitle,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, savingOverlayTitle: val },
                        })
                    )}
                    {renderField(
                      'copy-e-saving-body',
                      'คำอธิบายระหว่างกำลังบันทึกก่อนพับซอง',
                      draftCopy.stepE.savingOverlayBody,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, savingOverlayBody: val },
                        }),
                      true
                    )}
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
                        'copy-e-heart',
                        'สัญลักษณ์หัวใจใต้คำขอบคุณ',
                        draftCopy.stepE.heartSymbol,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepE: { ...draftCopy.stepE, heartSymbol: val },
                          })
                      )}
                      {renderField(
                        'copy-e-ref-lbl',
                        'ป้ายรหัสอ้างอิงจดหมาย',
                        draftCopy.stepE.referenceCodeLabel,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepE: { ...draftCopy.stepE, referenceCodeLabel: val },
                          })
                      )}
                    </div>
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
                    {renderField(
                      'copy-e-warn-title',
                      'หัวข้อแจ้งเตือนเมื่อยังบันทึกไม่สำเร็จ',
                      draftCopy.stepE.unsavedWarningTitle,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, unsavedWarningTitle: val },
                        })
                    )}
                    {renderField(
                      'copy-e-warn-body',
                      'คำอธิบายแจ้งเตือนเมื่อยังบันทึกไม่สำเร็จ',
                      draftCopy.stepE.unsavedWarningBody,
                      (val) =>
                        setDraftCopy({
                          ...draftCopy,
                          stepE: { ...draftCopy.stepE, unsavedWarningBody: val },
                        }),
                      true
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {renderField(
                        'copy-e-retry-btn',
                        'ปุ่มลองบันทึกใหม่อีกครั้ง',
                        draftCopy.stepE.retrySaveBtn,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepE: { ...draftCopy.stepE, retrySaveBtn: val },
                          })
                      )}
                      {renderField(
                        'copy-e-back-write',
                        'ปุ่มกลับไปหน้าเขียนจดหมาย',
                        draftCopy.stepE.backToWriteBtn,
                        (val) =>
                          setDraftCopy({
                            ...draftCopy,
                            stepE: { ...draftCopy.stepE, backToWriteBtn: val },
                          })
                      )}
                    </div>
                  </div>
                )}

                {feedbackMsg && (
                  <p
                    className={`text-xs sm:text-sm font-semibold flex items-start gap-1.5 pt-1 ${
                      feedbackIsError ? 'text-[#85271D]' : 'text-[#1F5129]'
                    }`}
                  >
                    {feedbackIsError ? (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    ) : (
                      <Check className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    )}
                    <span>{feedbackMsg}</span>
                  </p>
                )}

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
                        disabled={isSaving}
                        onClick={() => {
                          setIsSaving(true);
                          setConfirmReset(false);
                          void onResetSiteCopy().then((res) => {
                            setIsSaving(false);
                            setFeedbackIsError(!res.ok);
                            setFeedbackMsg(
                              res.ok
                                ? 'คืนค่าคำพูดทุกหน้าเป็นต้นฉบับและอัปเดตให้ทุกคนเห็นแล้ว'
                                : res.errorMessage ||
                                  'คืนค่าในเครื่องแล้ว กดบันทึกเพื่อซิงก์ออนไลน์'
                            );
                          });
                        }}
                        className="min-h-[38px] px-3.5 py-1.5 rounded-full bg-[#8F2D22] text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
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
                      <span>
                        {isSaving ? 'กำลังบันทึก...' : 'บันทึกข้อความ'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
