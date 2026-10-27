import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  APOLOGY_LETTER_CONTENT,
  BIRTHDAY_LETTER_CONTENT,
  LetterDocument,
  SiteCopy,
  UI_COPY,
} from '../content/letters';
import {
  auth,
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  googleProvider,
  handleFirestoreError,
  isPermissionDeniedError,
  OperationType,
  validateFirestoreConnectionOnce,
} from '../firebase';
import {
  getExistingReplyWriterSecret,
  getOrCreateReplyWriterSecret,
  mergeWithDefaultSiteCopy,
  ReplyLetterDraft,
  saveOwnerLettersToLocal,
  saveSiteCopyToLocal,
} from './letterStorage';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const replyWriteQueues = new Map<string, Promise<unknown>>();

function enqueueReplyWrite<T>(replyId: string, task: () => Promise<T>): Promise<T> {
  const prev = replyWriteQueues.get(replyId) || Promise.resolve();
  const next = prev.catch(() => undefined).then(task);
  replyWriteQueues.set(
    replyId,
    next.finally(() => {
      if (replyWriteQueues.get(replyId) === next) {
        replyWriteQueues.delete(replyId);
      }
    })
  );
  return next;
}

function clampStr(val: unknown, fallback: string, minLen: number, maxLen: number): string {
  const raw = typeof val === 'string' ? val : fallback;
  const trimmedCheck = raw.trim();
  const safeBase = minLen > 0 && trimmedCheck.length === 0 ? fallback : raw;
  return safeBase.slice(0, maxLen);
}

function sanitizeId(rawId: string, fallback = 'note_extra'): string {
  const cleaned = rawId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  if (cleaned.length >= 1 && VALID_ID_REGEX.test(cleaned)) {
    return cleaned;
  }
  return fallback;
}

/**
 * Sanitize SiteCopy strictly to match firebase-blueprint.json & firestore.rules bounds.
 */
export function sanitizeSiteCopyForFirestore(copy: SiteCopy): SiteCopy {
  const g = copy.globalBars || UI_COPY.globalBars;
  return {
    siteTitle: clampStr(copy.siteTitle, UI_COPY.siteTitle, 1, 200),
    globalBars: {
      adminLoginBtn: clampStr(g.adminLoginBtn, UI_COPY.globalBars.adminLoginBtn, 0, 200),
      soundMutedBtn: clampStr(g.soundMutedBtn, UI_COPY.globalBars.soundMutedBtn, 0, 200),
      soundTapToPlayBtn: clampStr(
        g.soundTapToPlayBtn,
        UI_COPY.globalBars.soundTapToPlayBtn,
        0,
        200
      ),
      soundPlayingSfxOnlyBtn: clampStr(
        g.soundPlayingSfxOnlyBtn,
        UI_COPY.globalBars.soundPlayingSfxOnlyBtn,
        0,
        200
      ),
    },
    cover: {
      subtitleLine1: clampStr(copy.cover.subtitleLine1, '', 0, 500),
      subtitleLine2: clampStr(copy.cover.subtitleLine2, '', 0, 500),
      startBtn: clampStr(copy.cover.startBtn, UI_COPY.cover.startBtn, 1, 200),
      readAllLettersBtn: clampStr(copy.cover.readAllLettersBtn, '', 0, 200),
    },
    stepA: {
      homeBtn: clampStr(copy.stepA.homeBtn, '', 0, 200),
      backBtn: clampStr(copy.stepA.backBtn, '', 0, 200),
      initialQuestion: clampStr(copy.stepA.initialQuestion, '', 0, 500),
      yesBtn: clampStr(copy.stepA.yesBtn, '', 0, 200),
      noBtn: clampStr(copy.stepA.noBtn, '', 0, 200),
      waitMessage: clampStr(copy.stepA.waitMessage, '', 0, 500),
      waitSubLabel: clampStr(copy.stepA.waitSubLabel, '', 0, 200),
      waitFollowUp: clampStr(copy.stepA.waitFollowUp, '', 0, 500),
      actuallyMeBtn: clampStr(copy.stepA.actuallyMeBtn, '', 0, 300),
      reallyNotMeBtn: clampStr(copy.stepA.reallyNotMeBtn, '', 0, 300),
      politeExitTitle: clampStr(copy.stepA.politeExitTitle, '', 0, 500),
      politeExitBody: clampStr(copy.stepA.politeExitBody, '', 0, 1000),
      politeExitReadBtn: clampStr(copy.stepA.politeExitReadBtn, '', 0, 200),
    },
    stepB: {
      backBtn: clampStr(copy.stepB.backBtn, '', 0, 200),
      question: clampStr(copy.stepB.question, '', 0, 400),
      yearRangeHint: clampStr(copy.stepB.yearRangeHint, '', 0, 300),
      submitBtn: clampStr(copy.stepB.submitBtn, '', 0, 200),
      skipToReadBtn: clampStr(copy.stepB.skipToReadBtn, '', 0, 200),
      wrongDateMessage: clampStr(copy.stepB.wrongDateMessage, '', 0, 600),
    },
    stepC: {
      mailboxHeading: clampStr(copy.stepC.mailboxHeading, '', 0, 300),
      deskHintClosed: clampStr(copy.stepC.deskHintClosed, '', 0, 500),
      birthdayEnvelopeTag: clampStr(copy.stepC.birthdayEnvelopeTag, '', 0, 300),
      apologyEnvelopeTag: clampStr(copy.stepC.apologyEnvelopeTag, '', 0, 300),
      extraEnvelopeTag: clampStr(copy.stepC.extraEnvelopeTag, '', 0, 300),
      skipOpenAnimBtn: clampStr(copy.stepC.skipOpenAnimBtn, '', 0, 200),
      continueDraftBtn: clampStr(copy.stepC.continueDraftBtn, '', 0, 200),
      mailboxBoxTitle: clampStr(copy.stepC.mailboxBoxTitle, '', 0, 300),
      mailboxSubtitle: clampStr(copy.stepC.mailboxSubtitle, '', 0, 400),
      letterCountUnit: clampStr(copy.stepC.letterCountUnit, '', 0, 100),
      foldBackBtn: clampStr(copy.stepC.foldBackBtn, '', 0, 200),
      writeReplyBtn: clampStr(copy.stepC.writeReplyBtn, '', 0, 200),
      writeNewReplyBtn: clampStr(copy.stepC.writeNewReplyBtn, '', 0, 200),
      writeShortBtn: clampStr(copy.stepC.writeShortBtn, '', 0, 200),
      replySenderPrefix: clampStr(copy.stepC.replySenderPrefix, '', 0, 100),
      untitledReplyLabel: clampStr(copy.stepC.untitledReplyLabel, '', 0, 200),
      emptyReplyBodyLabel: clampStr(copy.stepC.emptyReplyBodyLabel, '', 0, 300),
      referenceIdLabel: clampStr(copy.stepC.referenceIdLabel, '', 0, 200),
      editReplyBtn: clampStr(copy.stepC.editReplyBtn, '', 0, 200),
      syncedBadgeLabel: clampStr(copy.stepC.syncedBadgeLabel, '', 0, 200),
      localDraftBadgeLabel: clampStr(copy.stepC.localDraftBadgeLabel, '', 0, 200),
      privacyFooterNote: clampStr(copy.stepC.privacyFooterNote, '', 0, 600),
    },
    stepD: {
      backBtn: clampStr(copy.stepD.backBtn, '', 0, 200),
      heading: clampStr(copy.stepD.heading, '', 0, 300),
      privacyNoticeBody: clampStr(copy.stepD.privacyNoticeBody, '', 0, 1000),
      deletionPolicyNote: clampStr(copy.stepD.deletionPolicyNote, '', 0, 1000),
      titleLabel: clampStr(copy.stepD.titleLabel, '', 0, 200),
      titlePlaceholder: clampStr(copy.stepD.titlePlaceholder, '', 0, 300),
      authorLabel: clampStr(copy.stepD.authorLabel, '', 0, 200),
      authorPlaceholder: clampStr(copy.stepD.authorPlaceholder, '', 0, 300),
      bodyLabel: clampStr(copy.stepD.bodyLabel, '', 0, 200),
      bodyPlaceholder: clampStr(copy.stepD.bodyPlaceholder, '', 0, 400),
      savingStatusText: clampStr(copy.stepD.savingStatusText, '', 0, 200),
      savedStatusText: clampStr(copy.stepD.savedStatusText, '', 0, 200),
      offlineStatusText: clampStr(copy.stepD.offlineStatusText, '', 0, 300),
      errorStatusText: clampStr(copy.stepD.errorStatusText, '', 0, 300),
      autosaveHintText: clampStr(copy.stepD.autosaveHintText, '', 0, 300),
      retryInlineBtn: clampStr(copy.stepD.retryInlineBtn, '', 0, 200),
      clearDraftBtn: clampStr(copy.stepD.clearDraftBtn, '', 0, 200),
      clearModalTitle: clampStr(copy.stepD.clearModalTitle, '', 0, 400),
      clearModalBody: clampStr(copy.stepD.clearModalBody, '', 0, 1000),
      clearModalCancelBtn: clampStr(copy.stepD.clearModalCancelBtn, '', 0, 200),
      clearModalConfirmBtn: clampStr(copy.stepD.clearModalConfirmBtn, '', 0, 200),
      finishAndFoldBtn: clampStr(copy.stepD.finishAndFoldBtn, '', 0, 200),
    },
    stepE: {
      savingOverlayTitle: clampStr(copy.stepE.savingOverlayTitle, '', 0, 400),
      savingOverlayBody: clampStr(copy.stepE.savingOverlayBody, '', 0, 1000),
      savedHeading: clampStr(copy.stepE.savedHeading, '', 0, 300),
      savedSubheading: clampStr(copy.stepE.savedSubheading, '', 0, 500),
      skipAnimationBtn: clampStr(copy.stepE.skipAnimationBtn, '', 0, 200),
      thankYouTitle: clampStr(copy.stepE.thankYouTitle, '', 0, 400),
      thankYouSubtitle: clampStr(copy.stepE.thankYouSubtitle, '', 0, 500),
      heartSymbol: clampStr(copy.stepE.heartSymbol, '♡', 0, 40),
      referenceCodeLabel: clampStr(copy.stepE.referenceCodeLabel, '', 0, 200),
      backToDeskBtn: clampStr(copy.stepE.backToDeskBtn, '', 0, 200),
      writeAnotherBtn: clampStr(copy.stepE.writeAnotherBtn, '', 0, 200),
      editAgainBtn: clampStr(copy.stepE.editAgainBtn, '', 0, 200),
      unsavedWarningTitle: clampStr(copy.stepE.unsavedWarningTitle, '', 0, 400),
      unsavedWarningBody: clampStr(copy.stepE.unsavedWarningBody, '', 0, 1000),
      retrySaveBtn: clampStr(copy.stepE.retrySaveBtn, '', 0, 200),
      backToWriteBtn: clampStr(copy.stepE.backToWriteBtn, '', 0, 200),
    },
  };
}

/**
 * Sanitize LetterDocument strictly to match firebase-blueprint.json & firestore.rules bounds.
 */
export function sanitizeLetterForFirestore(letter: LetterDocument): LetterDocument {
  const safeId = sanitizeId(letter.id);
  const rawParagraphs = Array.isArray(letter.paragraphs) ? letter.paragraphs : [];
  const boundedParagraphs = rawParagraphs
    .slice(0, 80)
    .map((p) => (typeof p === 'string' ? p.slice(0, 4000) : ''));

  return {
    id: safeId,
    isOwnerApprovedForProduction: Boolean(letter.isOwnerApprovedForProduction),
    letterTitle: clampStr(letter.letterTitle, 'จดหมายถึงคุณ', 1, 200),
    senderLabel: clampStr(letter.senderLabel, 'จาก: ฉัน', 0, 120),
    dateLabel: clampStr(letter.dateLabel, '', 0, 120),
    salutation: clampStr(letter.salutation, '', 0, 300),
    paragraphs: boundedParagraphs.length > 0 ? boundedParagraphs : [''],
    signOff: clampStr(letter.signOff, '', 0, 200),
    senderName: clampStr(letter.senderName, 'ฉัน', 0, 120),
  };
}

export interface AdminAuthSnapshot {
  user: User | null;
  isReady: boolean;
  isVerifiedUser: boolean;
  isVerifiedOwner: boolean;
}

export function subscribeAdminAuth(
  onUpdate: (snapshot: AdminAuthSnapshot) => void
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    const isVerifiedUser = Boolean(user && user.emailVerified);
    const isVerifiedOwner = Boolean(
      user &&
        user.emailVerified &&
        user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
    );
    onUpdate({
      user,
      isReady: true,
      isVerifiedUser,
      isVerifiedOwner,
    });
  });
}

export async function signInAdminWithGoogle(): Promise<{
  ok: boolean;
  email?: string;
  errorMessage?: string;
}> {
  try {
    const cred = await signInWithPopup(auth, googleProvider);
    const email = cred.user.email || '';
    if (
      !cred.user.emailVerified ||
      email.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
    ) {
      return {
        ok: false,
        email,
        errorMessage: `บัญชี ${email || 'ที่เลือก'} ไม่ใช่บัญชีผู้ดูแล (${BOOTSTRAPPED_ADMIN_EMAIL}) กรุณากดล็อกอินและเลือกบัญชี ${BOOTSTRAPPED_ADMIN_EMAIL}`,
      };
    }
    return { ok: true, email };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return {
        ok: false,
        errorMessage: 'ปิดหน้าต่างยืนยันตัวตนก่อนเสร็จสิ้น',
      };
    }
    if (code === 'auth/unauthorized-domain') {
      return {
        ok: false,
        errorMessage:
          'โดเมนนี้ยังไม่ได้เพิ่มใน Firebase Authentication > Settings > Authorized domains',
      };
    }
    return {
      ok: false,
      errorMessage: 'ไม่สามารถเปิดหน้าต่างยืนยันตัวตน Google ได้ กรุณาลองใหม่อีกครั้ง',
    };
  }
}

export async function signOutAdminGoogle(): Promise<void> {
  try {
    await signOut(auth);
  } catch {
    // Ignore
  }
}

export interface PublishResult {
  ok: boolean;
  errorMessage?: string;
}

/**
 * เผยแพร่ทั้งข้อความหน้าเว็บ (SiteCopy) และจดหมายบนโต๊ะ (LetterDocument[]) ขึ้น Cloud Firestore
 * แบบ Atomic Batch เพื่อให้ผู้เข้าชมทุกคนเห็นสิ่งเดียวกันแบบเรียลไทม์ทันที
 */
export async function publishAdminStateToEveryone(params: {
  siteCopy: SiteCopy;
  ownerLetters: LetterDocument[];
  deletedLetterId?: string;
  silentIfUnauthenticated?: boolean;
}): Promise<PublishResult> {
  let activeUser = auth.currentUser;

  if (
    !activeUser ||
    !activeUser.emailVerified ||
    activeUser.email?.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
  ) {
    if (params.silentIfUnauthenticated) {
      return { ok: false, errorMessage: 'ยังไม่ได้เข้าสู่ระบบผู้ดูแล' };
    }
    const loginRes = await signInAdminWithGoogle();
    if (!loginRes.ok) {
      return { ok: false, errorMessage: loginRes.errorMessage };
    }
    activeUser = auth.currentUser;
  }

  if (!activeUser) {
    return {
      ok: false,
      errorMessage: 'ยังไม่ได้ยืนยันบัญชีผู้ดูแลสำหรับเผยแพร่ออนไลน์',
    };
  }

  const sanitizedCopy = sanitizeSiteCopyForFirestore(params.siteCopy);
  const sanitizedLetters = params.ownerLetters
    .slice(0, 30)
    .map(sanitizeLetterForFirestore);

  if (!sanitizedLetters.some((d) => d.id === 'apology')) {
    sanitizedLetters.unshift(sanitizeLetterForFirestore(APOLOGY_LETTER_CONTENT));
  }
  if (!sanitizedLetters.some((d) => d.id === 'birthday')) {
    sanitizedLetters.splice(1, 0, sanitizeLetterForFirestore(BIRTHDAY_LETTER_CONTENT));
  }

  const letterOrderIds = sanitizedLetters.map((d) => d.id);
  const liveSitePath = 'published_site/live_site';
  const liveSiteRef = doc(db, 'published_site', 'live_site');

  try {
    const existingSiteSnap = await getDoc(liveSiteRef);
    const letterSnaps = await Promise.all(
      sanitizedLetters.map((ltr) =>
        getDoc(doc(db, 'published_letters', ltr.id))
      )
    );

    const batch = writeBatch(db);

    const sitePayloadBase = {
      configId: 'live_site',
      authorUid: activeUser.uid,
      letterOrderIds,
      siteTitle: sanitizedCopy.siteTitle,
      globalBars: sanitizedCopy.globalBars,
      cover: sanitizedCopy.cover,
      stepA: sanitizedCopy.stepA,
      stepB: sanitizedCopy.stepB,
      stepC: sanitizedCopy.stepC,
      stepD: sanitizedCopy.stepD,
      stepE: sanitizedCopy.stepE,
      updatedAt: serverTimestamp(),
    };

    if (existingSiteSnap.exists() && existingSiteSnap.data()?.createdAt) {
      batch.update(liveSiteRef, {
        ...sitePayloadBase,
      });
    } else {
      batch.set(liveSiteRef, {
        ...sitePayloadBase,
        createdAt:
          existingSiteSnap.exists() && existingSiteSnap.data()?.createdAt
            ? existingSiteSnap.data().createdAt
            : serverTimestamp(),
      });
    }

    sanitizedLetters.forEach((ltr, idx) => {
      const ltrRef = doc(db, 'published_letters', ltr.id);
      const snap = letterSnaps[idx];
      const baseFields = {
        id: ltr.id,
        authorUid: activeUser!.uid,
        isOwnerApprovedForProduction: ltr.isOwnerApprovedForProduction,
        letterTitle: ltr.letterTitle,
        senderLabel: ltr.senderLabel,
        dateLabel: ltr.dateLabel,
        salutation: ltr.salutation,
        paragraphs: ltr.paragraphs,
        signOff: ltr.signOff,
        senderName: ltr.senderName,
        updatedAt: serverTimestamp(),
      };

      if (snap.exists() && snap.data()?.createdAt) {
        batch.update(ltrRef, baseFields);
      } else {
        batch.set(ltrRef, {
          ...baseFields,
          createdAt:
            snap.exists() && snap.data()?.createdAt
              ? snap.data().createdAt
              : serverTimestamp(),
        });
      }
    });

    if (
      params.deletedLetterId &&
      params.deletedLetterId !== 'apology' &&
      params.deletedLetterId !== 'birthday'
    ) {
      const safeDelId = sanitizeId(params.deletedLetterId, '');
      if (safeDelId) {
        batch.delete(doc(db, 'published_letters', safeDelId));
      }
    }

    await batch.commit();
    return { ok: true };
  } catch (error: unknown) {
    if (isPermissionDeniedError(error)) {
      try {
        handleFirestoreError(error, OperationType.WRITE, liveSitePath);
      } catch {
        // Logged structured FirestoreErrorInfo
      }
      return {
        ok: false,
        errorMessage: `ไม่มีสิทธิ์เขียนฐานข้อมูล กรุณาเข้าสู่ระบบด้วยบัญชี ${BOOTSTRAPPED_ADMIN_EMAIL}`,
      };
    }
    return {
      ok: false,
      errorMessage: 'การเชื่อมต่อฐานข้อมูลขัดข้องชั่วคราว กรุณาลองกดบันทึกอีกครั้ง',
    };
  }
}

/**
 * บันทึกหรืออัปเดตจดหมายตอบกลับลง /shared_replies/{letterId} แบบเรียลไทม์อัตโนมัติ
 * รองรับทั้งผู้เขียนที่ผ่านหน้าวันเกิดโดยไม่ต้องล็อกอิน Google (ผ่าน Atomic Split-Collection Capability Lock)
 * และผู้ดูแลระบบ (Admin) ที่แก้ไขได้ทุกฉบับของทุกคน
 */
export async function saveSharedReplyToFirestore(params: {
  draft: ReplyLetterDraft;
  promptSignInIfNeeded?: boolean;
  requireAdmin?: boolean;
}): Promise<PublishResult> {
  const { draft, promptSignInIfNeeded = false, requireAdmin = false } = params;
  const safeId = sanitizeId(draft.letterId, 'ltr_shared');

  return enqueueReplyWrite(safeId, async () => {
    let activeUser = auth.currentUser;

    if (requireAdmin) {
      if (
        !activeUser ||
        !activeUser.emailVerified ||
        activeUser.email?.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
      ) {
        if (!promptSignInIfNeeded) {
          return { ok: false, errorMessage: 'ยังไม่ได้เข้าสู่ระบบผู้ดูแล' };
        }
        const loginRes = await signInAdminWithGoogle();
        if (!loginRes.ok) {
          return { ok: false, errorMessage: loginRes.errorMessage };
        }
        activeUser = auth.currentUser;
      }
    }

    const isVerifiedUser = Boolean(activeUser && activeUser.emailVerified);
    const isVerifiedAdmin = Boolean(
      isVerifiedUser &&
        activeUser?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
    );

    const replyPath = `shared_replies/${safeId}`;
    const replyRef = doc(db, 'shared_replies', safeId);
    const lockRef = doc(db, 'reply_locks', safeId);

    const safeTitle = clampStr(draft.title, 'จดหมายตอบกลับ', 1, 200);
    const safeAuthor = clampStr(draft.author, 'คุณ', 1, 120);
    const safeBody =
      typeof draft.body === 'string' && draft.body.length > 0
        ? draft.body.slice(0, 8000)
        : ' ';
    const safeVersion = Math.max(1, Math.min(100000, Math.floor(draft.version || 1)));
    const safeRecovery: 'synced' | 'completed' =
      draft.recoveryState === 'completed' ? 'completed' : 'synced';

    try {
      const existingSnap = await getDoc(replyRef);

      if (existingSnap.exists() && existingSnap.data()?.createdAt) {
        const existingData = existingSnap.data();
        const existingAuthorUid =
          typeof existingData.authorUid === 'string' ? existingData.authorUid : '';
        const existingLockNonce =
          typeof existingData.lockNonce === 'number' ? existingData.lockNonce : 0;

        // Branch 1: Verified Admin or Verified Google Author updating directly
        if (
          isVerifiedUser &&
          activeUser &&
          (isVerifiedAdmin ||
            (existingAuthorUid !== 'guest_writer' && existingAuthorUid === activeUser.uid))
        ) {
          await updateDoc(replyRef, {
            lastEditorUid: activeUser.uid,
            lockNonce: existingLockNonce,
            title: safeTitle,
            author: safeAuthor,
            body: safeBody,
            version: safeVersion,
            recoveryState: safeRecovery,
            updatedAt: serverTimestamp(),
          });
          return { ok: true };
        }

        // Branch 2: Guest-authored letter updated by the browser holding its 256-bit secretKey
        if (existingAuthorUid === 'guest_writer') {
          const secretKey = getExistingReplyWriterSecret(safeId);
          if (!secretKey) {
            return {
              ok: false,
              errorMessage: 'สามารถแก้ไขได้เฉพาะผู้เขียนเครื่องเดิมหรือผู้ดูแลระบบเท่านั้น',
            };
          }

          const nextNonce = Math.max(1, existingLockNonce) + 1;
          const editorUid = activeUser ? activeUser.uid : 'guest_writer';
          const batch = writeBatch(db);
          batch.update(lockRef, {
            nonce: nextNonce,
            proof: `${secretKey}_${nextNonce}`,
            updatedAt: serverTimestamp(),
          });
          batch.update(replyRef, {
            lastEditorUid: editorUid,
            lockNonce: nextNonce,
            title: safeTitle,
            author: safeAuthor,
            body: safeBody,
            version: safeVersion,
            recoveryState: safeRecovery,
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
          return { ok: true };
        }

        return {
          ok: false,
          errorMessage: 'ไม่มีสิทธิ์แก้ไขจดหมายฉบับนี้',
        };
      }

      // Document does not exist yet -> Create in real-time
      if (isVerifiedUser && activeUser) {
        await setDoc(replyRef, {
          letterId: safeId,
          authorUid: activeUser.uid,
          lastEditorUid: activeUser.uid,
          lockNonce: 0,
          visibility: 'public',
          title: safeTitle,
          author: safeAuthor,
          body: safeBody,
          version: safeVersion,
          recoveryState: safeRecovery,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { ok: true };
      }

      if (!activeUser) {
        const secretKey = getOrCreateReplyWriterSecret(safeId);
        const batch = writeBatch(db);
        batch.set(lockRef, {
          replyId: safeId,
          secretKey,
          nonce: 1,
          proof: `${secretKey}_1`,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(replyRef, {
          letterId: safeId,
          authorUid: 'guest_writer',
          lastEditorUid: 'guest_writer',
          lockNonce: 1,
          visibility: 'public',
          title: safeTitle,
          author: safeAuthor,
          body: safeBody,
          version: safeVersion,
          recoveryState: safeRecovery,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
        return { ok: true };
      }

      return { ok: false, errorMessage: 'บัญชีที่เข้าสู่ระบบยังไม่ได้ยืนยันอีเมล' };
    } catch (error: unknown) {
      if (isPermissionDeniedError(error)) {
        try {
          handleFirestoreError(error, OperationType.WRITE, replyPath);
        } catch {
          // Logged structured FirestoreErrorInfo
        }
        return {
          ok: false,
          errorMessage:
            'ไม่มีสิทธิ์แก้ไขจดหมายฉบับนี้บนคลาวด์ กรุณาเข้าสู่ระบบด้วยบัญชีผู้ดูแลระบบ',
        };
      }
      return {
        ok: false,
        errorMessage: 'ไม่สามารถซิงก์จดหมายแบบเรียลไทม์ได้ในขณะนี้',
      };
    }
  });
}

export async function deleteSharedReplyFromFirestore(
  letterId: string,
  requireAdmin = false
): Promise<PublishResult> {
  const safeId = sanitizeId(letterId, '');
  if (!safeId) return { ok: false, errorMessage: 'รหัสจดหมายไม่ถูกต้อง' };

  return enqueueReplyWrite(safeId, async () => {
    let activeUser = auth.currentUser;
    if (requireAdmin) {
      if (
        !activeUser ||
        !activeUser.emailVerified ||
        activeUser.email?.toLowerCase() !== BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
      ) {
        const loginRes = await signInAdminWithGoogle();
        if (!loginRes.ok) {
          return { ok: false, errorMessage: loginRes.errorMessage };
        }
        activeUser = auth.currentUser;
      }
    }

    const isVerifiedUser = Boolean(activeUser && activeUser.emailVerified);
    const isVerifiedAdmin = Boolean(
      isVerifiedUser &&
        activeUser?.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
    );

    const replyPath = `shared_replies/${safeId}`;
    const replyRef = doc(db, 'shared_replies', safeId);
    const lockRef = doc(db, 'reply_locks', safeId);

    try {
      const existingSnap = await getDoc(replyRef);
      if (!existingSnap.exists()) {
        return { ok: true };
      }

      if (isVerifiedAdmin) {
        const batch = writeBatch(db);
        batch.delete(replyRef);
        batch.delete(lockRef);
        await batch.commit();
        return { ok: true };
      }

      const existingData = existingSnap.data();
      if (
        isVerifiedUser &&
        activeUser &&
        existingData.authorUid !== 'guest_writer' &&
        existingData.authorUid === activeUser.uid
      ) {
        await deleteDoc(replyRef);
        return { ok: true };
      }

      if (existingData.authorUid === 'guest_writer') {
        const secretKey = getExistingReplyWriterSecret(safeId);
        const prevNonce =
          typeof existingData.lockNonce === 'number' ? existingData.lockNonce : 1;
        if (secretKey) {
          const nextNonce = prevNonce + 1;
          const batch = writeBatch(db);
          batch.update(lockRef, {
            nonce: nextNonce,
            proof: `${secretKey}_${nextNonce}`,
            updatedAt: serverTimestamp(),
          });
          batch.delete(replyRef);
          await batch.commit();
          return { ok: true };
        }
      }

      return { ok: false, errorMessage: 'ไม่มีสิทธิ์ลบจดหมายฉบับนี้จากกล่องกลาง' };
    } catch (error: unknown) {
      if (isPermissionDeniedError(error)) {
        try {
          handleFirestoreError(error, OperationType.DELETE, replyPath);
        } catch {
          // Logged structured FirestoreErrorInfo
        }
        return {
          ok: false,
          errorMessage: 'ไม่มีสิทธิ์ลบจดหมายฉบับนี้จากกล่องกลาง',
        };
      }
      return { ok: false, errorMessage: 'ลบจดหมายจากกล่องกลางไม่สำเร็จ' };
    }
  });
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (
    val &&
    typeof val === 'object' &&
    'toDate' in val &&
    typeof (val as { toDate: () => Date }).toDate === 'function'
  ) {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

/**
 * Subscribe ผู้เข้าชมทุกคนเข้ากับรายการจดหมายตอบกลับสาธารณะ (/shared_replies) แบบเรียลไทม์
 */
export function subscribeToSharedReplies(
  onRepliesChange: (replies: ReplyLetterDraft[]) => void
): Unsubscribe {
  const sharedPath = 'shared_replies';
  const q = query(
    collection(db, 'shared_replies'),
    where('visibility', '==', 'public')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const list: ReplyLetterDraft[] = [];
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (
          typeof d.letterId === 'string' &&
          typeof d.title === 'string' &&
          typeof d.author === 'string' &&
          typeof d.body === 'string'
        ) {
          const updatedIso = timestampToIso(d.updatedAt || d.createdAt);
          const ver = typeof d.version === 'number' ? d.version : 1;
          list.push({
            letterId: d.letterId,
            title: d.title,
            author: d.author,
            body: d.body === ' ' ? '' : d.body,
            version: ver,
            lastModifiedIso: updatedIso,
            lastSavedVersion: ver,
            lastSavedIso: updatedIso,
            recoveryState: d.recoveryState === 'completed' ? 'completed' : 'synced',
            authorUid: typeof d.authorUid === 'string' ? d.authorUid : undefined,
            isPublicCloud: true,
          });
        }
      });

      list.sort((a, b) => b.lastModifiedIso.localeCompare(a.lastModifiedIso));
      onRepliesChange(list);
    },
    (error) => {
      if (isPermissionDeniedError(error)) {
        try {
          handleFirestoreError(error, OperationType.LIST, sharedPath);
        } catch {
          // Logged structured error
        }
      }
    }
  );
}

/**
 * Subscribe ผู้เข้าชมทุกคนเข้ากับข้อมูลสดบน Cloud Firestore แบบเรียลไทม์ทั้งหมด
 * ทั้งข้อความหน้าเว็บ (/published_site/live_site) และจดหมายหลักทุกฉบับ (/published_letters)
 */
export function subscribeToPublishedSiteState(callbacks: {
  onSiteCopyChange: (copy: SiteCopy) => void;
  onOwnerLettersChange: (letters: LetterDocument[]) => void;
  onLiveSiteExistsChange?: (exists: boolean) => void;
}): Unsubscribe {
  void validateFirestoreConnectionOnce();

  let currentOrderIds: string[] = ['apology', 'birthday'];
  const letterCache = new Map<string, LetterDocument>();
  let hasCloudLetters = false;

  const emitOrderedLettersIfReady = () => {
    if (!hasCloudLetters || letterCache.size === 0) return;

    const ordered: LetterDocument[] = [];
    const seenIds = new Set<string>();

    for (const id of currentOrderIds) {
      const found = letterCache.get(id);
      if (found && !seenIds.has(id)) {
        ordered.push(found);
        seenIds.add(id);
      }
    }

    // รวมจดหมายที่อนุมัติแล้วทุกฉบับในคอลเลกชัน แม้ลำดับใน live_site จะยังซิงก์ตามมาทีหลัง
    for (const [id, docItem] of letterCache.entries()) {
      if (!seenIds.has(id)) {
        ordered.push(docItem);
        seenIds.add(id);
      }
    }

    if (!ordered.some((d) => d.id === 'apology')) {
      ordered.unshift(
        letterCache.get('apology') || {
          ...APOLOGY_LETTER_CONTENT,
          paragraphs: [...APOLOGY_LETTER_CONTENT.paragraphs],
        }
      );
    }
    if (!ordered.some((d) => d.id === 'birthday')) {
      ordered.splice(
        1,
        0,
        letterCache.get('birthday') || {
          ...BIRTHDAY_LETTER_CONTENT,
          paragraphs: [...BIRTHDAY_LETTER_CONTENT.paragraphs],
        }
      );
    }

    saveOwnerLettersToLocal(ordered);
    callbacks.onOwnerLettersChange(ordered);
  };

  const lettersPath = 'published_letters';
  const lettersQuery = query(
    collection(db, 'published_letters'),
    where('isOwnerApprovedForProduction', '==', true)
  );

  const unsubLetters = onSnapshot(
    lettersQuery,
    (snapshot) => {
      letterCache.clear();
      snapshot.forEach((docSnap) => {
        const d = docSnap.data();
        if (
          typeof d.id === 'string' &&
          typeof d.letterTitle === 'string' &&
          Array.isArray(d.paragraphs)
        ) {
          letterCache.set(d.id, {
            id: d.id,
            isOwnerApprovedForProduction: Boolean(d.isOwnerApprovedForProduction),
            letterTitle: d.letterTitle,
            senderLabel: typeof d.senderLabel === 'string' ? d.senderLabel : '',
            dateLabel: typeof d.dateLabel === 'string' ? d.dateLabel : '',
            salutation: typeof d.salutation === 'string' ? d.salutation : '',
            paragraphs: d.paragraphs.filter((p): p is string => typeof p === 'string'),
            signOff: typeof d.signOff === 'string' ? d.signOff : '',
            senderName: typeof d.senderName === 'string' ? d.senderName : '',
          });
        }
      });

      if (letterCache.size > 0) {
        hasCloudLetters = true;
        emitOrderedLettersIfReady();
      }
    },
    (error) => {
      if (isPermissionDeniedError(error)) {
        try {
          handleFirestoreError(error, OperationType.LIST, lettersPath);
        } catch {
          // Logged structured error
        }
      }
    }
  );

  const sitePath = 'published_site/live_site';
  const unsubSite = onSnapshot(
    doc(db, 'published_site', 'live_site'),
    (snap) => {
      if (!snap.exists()) {
        callbacks.onLiveSiteExistsChange?.(false);
        return;
      }
      callbacks.onLiveSiteExistsChange?.(true);
      const data = snap.data();

      const mergedCopy = mergeWithDefaultSiteCopy(data);
      saveSiteCopyToLocal(mergedCopy);
      callbacks.onSiteCopyChange(mergedCopy);

      if (Array.isArray(data.letterOrderIds) && data.letterOrderIds.length > 0) {
        const validIds = data.letterOrderIds.filter(
          (id): id is string => typeof id === 'string' && VALID_ID_REGEX.test(id)
        );
        if (validIds.length > 0) {
          currentOrderIds = validIds;
          emitOrderedLettersIfReady();
        }
      }
    },
    (error) => {
      if (isPermissionDeniedError(error)) {
        try {
          handleFirestoreError(error, OperationType.GET, sitePath);
        } catch {
          // Logged structured error
        }
      }
    }
  );

  return () => {
    unsubLetters();
    unsubSite();
  };
}
