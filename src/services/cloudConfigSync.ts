import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
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
  mergeWithDefaultSiteCopy,
  saveOwnerLettersToLocal,
  saveSiteCopyToLocal,
} from './letterStorage';

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]+$/;

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
  return {
    siteTitle: clampStr(copy.siteTitle, UI_COPY.siteTitle, 1, 200),
    cover: {
      subtitleLine1: clampStr(copy.cover.subtitleLine1, '', 0, 500),
      subtitleLine2: clampStr(copy.cover.subtitleLine2, '', 0, 500),
      startBtn: clampStr(copy.cover.startBtn, UI_COPY.cover.startBtn, 1, 200),
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
    },
    stepB: {
      backBtn: clampStr(copy.stepB.backBtn, '', 0, 200),
      question: clampStr(copy.stepB.question, '', 0, 400),
      submitBtn: clampStr(copy.stepB.submitBtn, '', 0, 200),
      wrongDateMessage: clampStr(copy.stepB.wrongDateMessage, '', 0, 600),
    },
    stepC: {
      mailboxHeading: clampStr(copy.stepC.mailboxHeading, '', 0, 300),
      deskHintClosed: clampStr(copy.stepC.deskHintClosed, '', 0, 500),
      birthdayEnvelopeTag: clampStr(copy.stepC.birthdayEnvelopeTag, '', 0, 300),
      apologyEnvelopeTag: clampStr(copy.stepC.apologyEnvelopeTag, '', 0, 300),
      mailboxBoxTitle: clampStr(copy.stepC.mailboxBoxTitle, '', 0, 300),
      mailboxSubtitle: clampStr(copy.stepC.mailboxSubtitle, '', 0, 400),
      foldBackBtn: clampStr(copy.stepC.foldBackBtn, '', 0, 200),
      writeReplyBtn: clampStr(copy.stepC.writeReplyBtn, '', 0, 200),
      writeNewReplyBtn: clampStr(copy.stepC.writeNewReplyBtn, '', 0, 200),
      writeShortBtn: clampStr(copy.stepC.writeShortBtn, '', 0, 200),
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
      clearDraftBtn: clampStr(copy.stepD.clearDraftBtn, '', 0, 200),
      finishAndFoldBtn: clampStr(copy.stepD.finishAndFoldBtn, '', 0, 200),
    },
    stepE: {
      savedHeading: clampStr(copy.stepE.savedHeading, '', 0, 300),
      savedSubheading: clampStr(copy.stepE.savedSubheading, '', 0, 500),
      skipAnimationBtn: clampStr(copy.stepE.skipAnimationBtn, '', 0, 200),
      thankYouTitle: clampStr(copy.stepE.thankYouTitle, '', 0, 400),
      thankYouSubtitle: clampStr(copy.stepE.thankYouSubtitle, '', 0, 500),
      backToDeskBtn: clampStr(copy.stepE.backToDeskBtn, '', 0, 200),
      writeAnotherBtn: clampStr(copy.stepE.writeAnotherBtn, '', 0, 200),
      editAgainBtn: clampStr(copy.stepE.editAgainBtn, '', 0, 200),
      unsavedWarningTitle: clampStr(copy.stepE.unsavedWarningTitle, '', 0, 400),
      unsavedWarningBody: clampStr(copy.stepE.unsavedWarningBody, '', 0, 1000),
      retrySaveBtn: clampStr(copy.stepE.retrySaveBtn, '', 0, 200),
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
  isVerifiedOwner: boolean;
}

export function subscribeAdminAuth(
  onUpdate: (snapshot: AdminAuthSnapshot) => void
): Unsubscribe {
  return onAuthStateChanged(auth, (user) => {
    const isVerifiedOwner = Boolean(
      user &&
        user.emailVerified &&
        user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL.toLowerCase()
    );
    onUpdate({
      user,
      isReady: true,
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
        errorMessage: `บัญชี ${email || 'ที่เลือก'} ไม่ใช่บัญชีเจ้าของเว็บ (${BOOTSTRAPPED_ADMIN_EMAIL}) กรุณาเลือกบัญชีเจ้าของเว็บเพื่อเผยแพร่ให้ทุกคนเห็น`,
      };
    }
    return { ok: true, email };
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return {
        ok: false,
        errorMessage: 'ปิดหน้าต่างยืนยันตัวตนก่อนเสร็จสิ้น (ข้อความถูกเก็บไว้ในเครื่องแล้ว กดบันทึกอีกครั้งเพื่อเผยแพร่ให้ทุกคนเห็น)',
      };
    }
    if (code === 'auth/unauthorized-domain') {
      return {
        ok: false,
        errorMessage:
          'โดเมนนี้ยังไม่ได้เพิ่มใน Firebase Authentication > Settings > Authorized domains (หากแก้ไขผ่านหน้าเว็บหลักของ Studio ข้อมูลจะอัปเดตให้ทุกคนรวมถึง GitHub Pages เห็นตรงกันอัตโนมัติทันที)',
      };
    }
    return {
      ok: false,
      errorMessage: 'ไม่สามารถเปิดหน้าต่างยืนยันตัวตน Google ได้ กรุณาลองกดบันทึกใหม่อีกครั้ง',
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
}): Promise<PublishResult> {
  let activeUser = auth.currentUser;

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

  if (!activeUser) {
    return {
      ok: false,
      errorMessage: 'ยังไม่ได้ยืนยันบัญชีเจ้าของเว็บสำหรับเผยแพร่ออนไลน์',
    };
  }

  const sanitizedCopy = sanitizeSiteCopyForFirestore(params.siteCopy);
  const sanitizedLetters = params.ownerLetters
    .slice(0, 30)
    .map(sanitizeLetterForFirestore);

  // รับประกันว่ามี apology และ birthday เสมอ
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
        createdAt: existingSiteSnap.exists() && existingSiteSnap.data()?.createdAt
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
          createdAt: snap.exists() && snap.data()?.createdAt
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
        // Logged structured FirestoreErrorInfo for diagnostics
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
 * Subscribe ผู้เข้าชมทุกคนเข้ากับข้อมูลสดบน Cloud Firestore แบบเรียลไทม์ (ไม่ต้องล็อกอิน)
 * ทันทีที่แอดมินแก้คำหน้าเว็บหรือแก้เนื้อหาจดหมาย ทุกคนจะเห็นตรงกันทันที
 */
export function subscribeToPublishedSiteState(callbacks: {
  onSiteCopyChange: (copy: SiteCopy) => void;
  onOwnerLettersChange: (letters: LetterDocument[]) => void;
}): Unsubscribe {
  void validateFirestoreConnectionOnce();

  let currentOrderIds: string[] = ['apology', 'birthday'];
  const letterCache = new Map<string, LetterDocument>();
  const letterUnsubMap = new Map<string, Unsubscribe>();
  let hasCloudData = false;

  const emitOrderedLettersIfReady = () => {
    if (!hasCloudData || letterCache.size === 0) return;

    const ordered: LetterDocument[] = [];
    for (const id of currentOrderIds) {
      const found = letterCache.get(id);
      if (found) {
        ordered.push(found);
      }
    }

    // รับประกันซองหลักหากเพิ่งซิงก์บางส่วน
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

  const syncLetterListeners = (nextOrderIds: string[]) => {
    const desiredSet = new Set(nextOrderIds);

    for (const [id, unsub] of letterUnsubMap.entries()) {
      if (!desiredSet.has(id)) {
        unsub();
        letterUnsubMap.delete(id);
        letterCache.delete(id);
      }
    }

    for (const id of nextOrderIds) {
      if (!VALID_ID_REGEX.test(id) || letterUnsubMap.has(id)) continue;
      const letterPath = `published_letters/${id}`;
      const unsub = onSnapshot(
        doc(db, 'published_letters', id),
        (snap) => {
          if (!snap.exists()) {
            letterCache.delete(id);
            emitOrderedLettersIfReady();
            return;
          }
          const d = snap.data();
          if (
            typeof d.id === 'string' &&
            typeof d.letterTitle === 'string' &&
            Array.isArray(d.paragraphs)
          ) {
            hasCloudData = true;
            letterCache.set(id, {
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
            emitOrderedLettersIfReady();
          }
        },
        (error) => {
          if (isPermissionDeniedError(error)) {
            try {
              handleFirestoreError(error, OperationType.GET, letterPath);
            } catch {
              // Logged structured error
            }
          }
        }
      );
      letterUnsubMap.set(id, unsub);
    }
  };

  syncLetterListeners(currentOrderIds);

  const sitePath = 'published_site/live_site';
  const unsubSite = onSnapshot(
    doc(db, 'published_site', 'live_site'),
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      hasCloudData = true;

      const mergedCopy = mergeWithDefaultSiteCopy(data);
      saveSiteCopyToLocal(mergedCopy);
      callbacks.onSiteCopyChange(mergedCopy);

      if (Array.isArray(data.letterOrderIds) && data.letterOrderIds.length > 0) {
        const validIds = data.letterOrderIds.filter(
          (id): id is string => typeof id === 'string' && VALID_ID_REGEX.test(id)
        );
        if (validIds.length > 0) {
          currentOrderIds = validIds;
          syncLetterListeners(currentOrderIds);
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
    unsubSite();
    for (const unsub of letterUnsubMap.values()) {
      unsub();
    }
    letterUnsubMap.clear();
  };
}
