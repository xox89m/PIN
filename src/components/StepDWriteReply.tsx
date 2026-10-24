import React, { useState } from 'react';
import { APP_CONFIG } from '../config';
import { UI_COPY } from '../content/letters';
import { ReplyLetterDraft, SaveStatus } from '../services/letterStorage';
import { HandDrawnPenIllustration } from './EnvelopeIllustrations';
import {
  Send,
  RotateCw,
  Trash2,
  ArrowLeft,
  Check,
  WifiOff,
  AlertCircle,
  Flame,
} from 'lucide-react';

interface StepDWriteReplyProps {
  draft: ReplyLetterDraft;
  onUpdateDraftField: (
    field: 'title' | 'author' | 'body',
    value: string
  ) => void;
  saveStatus: SaveStatus;
  statusMessage: string;
  onManualRetrySave: () => void;
  onRequestClearDraft: () => void;
  onBackToDesk: () => void;
  onFinishAndFold: () => void;
}

export function StepDWriteReply({
  draft,
  onUpdateDraftField,
  saveStatus,
  statusMessage,
  onManualRetrySave,
  onRequestClearDraft,
  onBackToDesk,
  onFinishAndFold,
}: StepDWriteReplyProps) {
  const [confirmClearModalOpen, setConfirmClearModalOpen] = useState(false);

  const renderSaveStatusIndicator = () => {
    switch (saveStatus) {
      case SaveStatus.SAVING:
        return (
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#4A3525]">
            <RotateCw className="w-4 h-4 animate-spin" aria-hidden="true" />
            <span>กำลังบันทึก...</span>
          </span>
        );
      case SaveStatus.SAVED:
        return (
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#244F30] font-medium">
            <Check className="w-4 h-4" aria-hidden="true" />
            <span>บันทึกแล้ว</span>
          </span>
        );
      case SaveStatus.OFFLINE_PENDING:
        return (
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#784B12] font-medium">
            <WifiOff className="w-4 h-4" aria-hidden="true" />
            <span>ออฟไลน์ กำลังรอส่งข้อมูล</span>
          </span>
        );
      case SaveStatus.ERROR:
        return (
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#85271D] font-medium">
            <AlertCircle className="w-4 h-4" aria-hidden="true" />
            <span>บันทึกไม่สำเร็จ</span>
          </span>
        );
      case SaveStatus.UNSAVED:
      default:
        return (
          <span className="inline-flex items-center gap-2 text-xs sm:text-sm text-[#5A4636]">
            <Flame className="w-4 h-4 text-[#9E6B2B]" aria-hidden="true" />
            <span>บันทึกอัตโนมัติขณะพิมพ์</span>
          </span>
        );
    }
  };

  return (
    <section className="w-full max-w-2xl mx-auto px-4 py-6 sm:py-8">
      {/* ปุ่มกลับมุมซ้ายบนเหมือนภาพช่องที่ 7 */}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={onBackToDesk}
          className="inline-flex items-center gap-2 min-h-[44px] px-3 py-2 text-sm text-[#E8DDD0]/85 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>{UI_COPY.stepD.backBtn}</span>
        </button>
      </div>

      {/* กระดาษจดหมายวินเทจเอียงเล็กน้อยอย่างเป็นธรรมชาติบนโต๊ะไม้เหมือนภาพช่องที่ 7 */}
      <div className="relative vintage-parchment p-6 sm:p-9 space-y-5">
        <header className="flex items-center justify-center gap-2.5 pb-2">
          <Send className="w-4 h-4 text-[#3D2B1D] -rotate-12" aria-hidden="true" />
          <h1 className="font-display text-lg sm:text-xl font-semibold text-[#2B1F16]">
            {UI_COPY.stepD.heading}
          </h1>
        </header>

        {/* คำชี้แจงความเป็นส่วนตัวขนาดกะทัดรัดชัดเจน */}
        <div className="px-3.5 py-2.5 rounded-lg bg-[#DFD2C0]/65 border border-[#8C765C]/35 text-xs text-[#4A3525] leading-relaxed">
          <p>{UI_COPY.stepD.privacyNoticeBody}</p>
          <p className="mt-1 text-[11px] text-[#5A4636]">
            {UI_COPY.stepD.deletionPolicyNote} · รหัสอ้างอิง:{' '}
            <span className="font-mono tabular-nums">{draft.letterId}</span>
          </p>
        </div>

        {/* ช่องชื่อจดหมาย */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="reply-title"
              className="text-sm font-semibold text-[#2B1F16]"
            >
              {UI_COPY.stepD.titleLabel}
            </label>
            <span className="text-xs text-[#5A4636] tabular-nums">
              {draft.title.length}/{APP_CONFIG.maxTitleLength}
            </span>
          </div>
          <input
            id="reply-title"
            type="text"
            value={draft.title}
            onChange={(e) =>
              onUpdateDraftField(
                'title',
                e.target.value.slice(0, APP_CONFIG.maxTitleLength)
              )
            }
            placeholder={UI_COPY.stepD.titlePlaceholder}
            maxLength={APP_CONFIG.maxTitleLength}
            className="parchment-input w-full min-h-[46px] px-3.5 py-2 text-sm sm:text-base"
          />
        </div>

        {/* ช่องชื่อผู้เขียน */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="reply-author"
              className="text-sm font-semibold text-[#2B1F16]"
            >
              {UI_COPY.stepD.authorLabel}
            </label>
            <span className="text-xs text-[#5A4636] tabular-nums">
              {draft.author.length}/{APP_CONFIG.maxAuthorLength}
            </span>
          </div>
          <input
            id="reply-author"
            type="text"
            value={draft.author}
            onChange={(e) =>
              onUpdateDraftField(
                'author',
                e.target.value.slice(0, APP_CONFIG.maxAuthorLength)
              )
            }
            placeholder={UI_COPY.stepD.authorPlaceholder}
            maxLength={APP_CONFIG.maxAuthorLength}
            className="parchment-input w-full min-h-[46px] px-3.5 py-2 text-sm sm:text-base"
          />
        </div>

        {/* ช่องเนื้อหาจดหมาย */}
        <div className="space-y-1.5">
          <label
            htmlFor="reply-body"
            className="block text-sm font-semibold text-[#2B1F16]"
          >
            {UI_COPY.stepD.bodyLabel}
          </label>
          <textarea
            id="reply-body"
            rows={7}
            value={draft.body}
            onChange={(e) =>
              onUpdateDraftField(
                'body',
                e.target.value.slice(0, APP_CONFIG.maxBodyLength)
              )
            }
            placeholder={UI_COPY.stepD.bodyPlaceholder}
            maxLength={APP_CONFIG.maxBodyLength}
            className="parchment-input w-full p-3.5 text-sm sm:text-base leading-relaxed resize-y min-h-[190px]"
          />
          <div className="flex justify-end">
            <span className="text-xs text-[#5A4636] tabular-nums">
              {draft.body.length.toLocaleString()}/
              {APP_CONFIG.maxBodyLength.toLocaleString()}
            </span>
          </div>
        </div>

        {statusMessage && (
          <p className="text-xs font-medium text-[#7A2E24]">{statusMessage}</p>
        )}

        {/* แถบสถานะกำลังบันทึก + ปุ่มพับซองด้านล่างเหมือนภาพช่องที่ 7 */}
        <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[#5C442E]/20">
          <div className="flex flex-wrap items-center gap-3" aria-live="polite">
            {renderSaveStatusIndicator()}

            {saveStatus === SaveStatus.ERROR && (
              <button
                type="button"
                onClick={onManualRetrySave}
                className="min-h-[38px] px-3 py-1 text-xs font-semibold text-[#2B1F16] bg-[#DFD2C0] hover:bg-[#D4C3AC] rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                ลองบันทึกใหม่
              </button>
            )}

            {(draft.title || draft.author || draft.body) && (
              <button
                type="button"
                onClick={() => setConfirmClearModalOpen(true)}
                className="inline-flex items-center gap-1 min-h-[38px] px-2.5 py-1 text-xs text-[#6E3026] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{UI_COPY.stepD.clearDraftBtn}</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onFinishAndFold}
            disabled={!draft.body.trim() && !draft.title.trim()}
            className="parchment-action-btn w-full sm:w-auto min-h-[48px] px-7 py-2.5 text-sm sm:text-base font-medium disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap shrink-0 cursor-pointer"
          >
            {UI_COPY.stepD.finishAndFoldBtn}
          </button>
        </div>
      </div>

      {/* ปากกาวางข้างขอบกระดาษด้านล่างขวาตามภาพช่องที่ 7 */}
      <div className="mt-3 flex justify-end pr-2">
        <HandDrawnPenIllustration className="w-40 sm:w-48 h-auto transform rotate-12" />
      </div>

      {/* Modal ยืนยันก่อนล้างฉบับร่างในเครื่อง */}
      {confirmClearModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-draft-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs"
        >
          <div className="vintage-parchment max-w-md w-full p-6 space-y-4">
            <h3
              id="clear-draft-title"
              className="font-display text-lg font-semibold text-[#2B1F16]"
            >
              ต้องการล้างฉบับร่างในเครื่องใช่ไหม?
            </h3>
            <p className="text-sm text-[#4A3525] leading-relaxed">
              ข้อความที่พิมพ์ค้างไว้ในเบราว์เซอร์เครื่องนี้จะถูกล้างออกและเริ่มรหัสจดหมายฉบับใหม่ (การล้างนี้จะไม่ลบไฟล์ที่ส่งเข้า Google Drive ไปแล้ว)
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearModalOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm font-medium text-[#4A3525] hover:bg-black/5 rounded-lg whitespace-nowrap shrink-0 cursor-pointer"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmClearModalOpen(false);
                  onRequestClearDraft();
                }}
                className="min-h-[44px] px-5 py-2 text-sm font-semibold bg-[#8F2D22] hover:bg-[#752219] text-white rounded-full whitespace-nowrap shrink-0 cursor-pointer"
              >
                ยืนยันล้างฉบับร่าง
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
