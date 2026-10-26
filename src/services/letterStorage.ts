import { APP_CONFIG } from '../config';
import {
  APOLOGY_LETTER_CONTENT,
  BIRTHDAY_LETTER_CONTENT,
  LetterDocument,
  SiteCopy,
  UI_COPY,
} from '../content/letters';

export enum SaveStatus {
  UNSAVED = 'unsaved',
  SAVING = 'saving',
  SAVED = 'saved',
  ERROR = 'error',
  OFFLINE_PENDING = 'offline_pending',
}

export interface ReplyLetterDraft {
  letterId: string;
  title: string;
  author: string;
  body: string;
  version: number;
  lastModifiedIso: string;
  lastSavedVersion: number;
  lastSavedIso: string | null;
  recoveryState: 'draft' | 'synced' | 'completed';
  authorUid?: string;
  isPublicCloud?: boolean;
}

export interface SaveBackendResponse {
  ok: boolean;
  letterId: string;
  version: number;
  savedAt: string;
  note?: string;
  errorCode?: string;
  message?: string;
}

const LOCAL_DRAFT_STORAGE_KEY = 'to_you_reply_draft_v1';
const LOCAL_SENT_HISTORY_KEY = 'to_you_sent_letters_box_v1';
const LOCAL_OWNER_LETTERS_KEY = 'to_you_owner_letters_v2';
const LOCAL_OWNER_VERSIONS_KEY = 'to_you_owner_letter_versions_v1';

export function getDefaultOwnerLetters(): LetterDocument[] {
  return [
    { ...APOLOGY_LETTER_CONTENT, paragraphs: [...APOLOGY_LETTER_CONTENT.paragraphs] },
    { ...BIRTHDAY_LETTER_CONTENT, paragraphs: [...BIRTHDAY_LETTER_CONTENT.paragraphs] },
  ];
}

function isValidLetterDocument(val: unknown): val is LetterDocument {
  if (!val || typeof val !== 'object') return false;
  const obj = val as Record<string, unknown>;
  return (
    typeof obj.id === 'string' &&
    obj.id.trim().length > 0 &&
    typeof obj.letterTitle === 'string' &&
    typeof obj.senderLabel === 'string' &&
    typeof obj.dateLabel === 'string' &&
    typeof obj.salutation === 'string' &&
    Array.isArray(obj.paragraphs) &&
    typeof obj.signOff === 'string' &&
    typeof obj.senderName === 'string'
  );
}

export function loadOwnerLettersFromLocal(): LetterDocument[] {
  try {
    const raw = localStorage.getItem(LOCAL_OWNER_LETTERS_KEY);
    if (!raw) return getDefaultOwnerLetters();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return getDefaultOwnerLetters();
    const valid = parsed.filter(isValidLetterDocument);
    if (valid.length === 0) return getDefaultOwnerLetters();

    // รับประกันว่ามีซองหลัก apology และ birthday อยู่เสมอ
    const hasApology = valid.some((d) => d.id === 'apology');
    const hasBirthday = valid.some((d) => d.id === 'birthday');
    const result = [...valid];
    if (!hasBirthday) {
      result.unshift({
        ...BIRTHDAY_LETTER_CONTENT,
        paragraphs: [...BIRTHDAY_LETTER_CONTENT.paragraphs],
      });
    }
    if (!hasApology) {
      result.unshift({
        ...APOLOGY_LETTER_CONTENT,
        paragraphs: [...APOLOGY_LETTER_CONTENT.paragraphs],
      });
    }
    return result;
  } catch {
    return getDefaultOwnerLetters();
  }
}

export function saveOwnerLettersToLocal(letters: LetterDocument[]): void {
  try {
    localStorage.setItem(LOCAL_OWNER_LETTERS_KEY, JSON.stringify(letters));
  } catch {
    // Ignore quota / private browsing errors
  }
}

export function resetOwnerLettersInLocal(): LetterDocument[] {
  try {
    localStorage.removeItem(LOCAL_OWNER_LETTERS_KEY);
  } catch {
    // Ignore
  }
  return getDefaultOwnerLetters();
}

function getNextOwnerLetterVersion(docId: string, minVersion = 1): number {
  let map: Record<string, number> = {};
  try {
    const raw = localStorage.getItem(LOCAL_OWNER_VERSIONS_KEY);
    if (raw) {
      map = JSON.parse(raw) as Record<string, number>;
    }
  } catch {
    map = {};
  }
  const current = typeof map[docId] === 'number' ? map[docId] : 0;
  const next = Math.min(99999, Math.max(current + 1, minVersion));
  map[docId] = next;
  try {
    localStorage.setItem(LOCAL_OWNER_VERSIONS_KEY, JSON.stringify(map));
  } catch {
    // Ignore
  }
  return next;
}

export function generateSecureId(prefix = 'ltr'): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${prefix}_${hex}`;
}

export function createInitialDraft(): ReplyLetterDraft {
  return {
    letterId: generateSecureId('ltr'),
    title: '',
    author: '',
    body: '',
    version: 0,
    lastModifiedIso: new Date().toISOString(),
    lastSavedVersion: 0,
    lastSavedIso: null,
    recoveryState: 'draft',
  };
}

export function loadDraftFromLocal(): ReplyLetterDraft {
  try {
    const raw = localStorage.getItem(LOCAL_DRAFT_STORAGE_KEY);
    if (!raw) return createInitialDraft();
    const parsed = JSON.parse(raw) as Partial<ReplyLetterDraft>;
    if (
      typeof parsed.letterId === 'string' &&
      /^[a-zA-Z0-9_-]{3,64}$/.test(parsed.letterId)
    ) {
      return {
        letterId: parsed.letterId,
        title: typeof parsed.title === 'string' ? parsed.title : '',
        author: typeof parsed.author === 'string' ? parsed.author : '',
        body: typeof parsed.body === 'string' ? parsed.body : '',
        version: typeof parsed.version === 'number' ? parsed.version : 0,
        lastModifiedIso:
          typeof parsed.lastModifiedIso === 'string'
            ? parsed.lastModifiedIso
            : new Date().toISOString(),
        lastSavedVersion:
          typeof parsed.lastSavedVersion === 'number' ? parsed.lastSavedVersion : 0,
        lastSavedIso:
          typeof parsed.lastSavedIso === 'string' ? parsed.lastSavedIso : null,
        recoveryState:
          parsed.recoveryState === 'synced' || parsed.recoveryState === 'completed'
            ? parsed.recoveryState
            : 'draft',
        authorUid: typeof parsed.authorUid === 'string' ? parsed.authorUid : undefined,
        isPublicCloud: Boolean(parsed.isPublicCloud),
      };
    }
  } catch {
    // Ignore storage corruption or private mode limitations
  }
  return createInitialDraft();
}

export function saveDraftToLocal(draft: ReplyLetterDraft): void {
  try {
    localStorage.setItem(LOCAL_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Private browsing or quota full - handled gracefully in memory
  }
}

export function clearLocalDraft(): ReplyLetterDraft {
  try {
    localStorage.removeItem(LOCAL_DRAFT_STORAGE_KEY);
  } catch {
    // Ignore
  }
  return createInitialDraft();
}

export function loadLocalSentHistory(): ReplyLetterDraft[] {
  try {
    const raw = localStorage.getItem(LOCAL_SENT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ReplyLetterDraft =>
        item &&
        typeof item === 'object' &&
        typeof item.letterId === 'string' &&
        (Boolean(item.title?.trim()) || Boolean(item.body?.trim()))
    );
  } catch {
    return [];
  }
}

export function upsertLetterIntoLocalHistory(letter: ReplyLetterDraft): ReplyLetterDraft[] {
  const existing = loadLocalSentHistory();
  if (!letter.title.trim() && !letter.body.trim()) {
    return existing;
  }

  const idx = existing.findIndex((item) => item.letterId === letter.letterId);
  let next: ReplyLetterDraft[];
  if (idx >= 0) {
    next = [...existing];
    next[idx] = letter;
  } else {
    next = [letter, ...existing];
  }

  try {
    localStorage.setItem(LOCAL_SENT_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function removeLetterFromLocalHistory(letterId: string): ReplyLetterDraft[] {
  const existing = loadLocalSentHistory();
  const next = existing.filter((item) => item.letterId !== letterId);
  try {
    localStorage.setItem(LOCAL_SENT_HISTORY_KEY, JSON.stringify(next));
  } catch {
    // Ignore
  }
  return next;
}

export function buildIdempotencyKey(letterId: string, version: number): string {
  return `${letterId}_v${version}`;
}

export async function saveViaGasWebApp(params: {
  draft: ReplyLetterDraft;
  isFinalFold?: boolean;
  ownerLettersSnapshot?: LetterDocument[];
  signal?: AbortSignal;
}): Promise<SaveBackendResponse> {
  const { draft, isFinalFold = false, ownerLettersSnapshot, signal } = params;
  const gasUrl = APP_CONFIG.gasWebAppUrl;

  if (!gasUrl || !gasUrl.startsWith('https://script.google.com/')) {
    return {
      ok: false,
      letterId: draft.letterId,
      version: draft.version,
      savedAt: '',
      errorCode: 'MISSING_GAS_URL',
      message: 'ยังไม่ได้ตั้งค่า URL สำหรับบันทึกจดหมาย',
    };
  }

  const payload: Record<string, unknown> = {
    action: 'saveLetter',
    idempotencyKey: buildIdempotencyKey(draft.letterId, draft.version),
    letterId: draft.letterId,
    title: draft.title.slice(0, 120),
    author: draft.author.slice(0, APP_CONFIG.maxAuthorLength),
    body: draft.body.slice(0, 5000),
    version: draft.version,
    recoveryState: isFinalFold ? 'completed' : 'synced',
    clientTimestamp: new Date().toISOString(),
  };

  if (ownerLettersSnapshot) {
    payload.ownerLetters = ownerLettersSnapshot;
  }

  const response = await fetch(gasUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8',
    },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    return {
      ok: false,
      letterId: draft.letterId,
      version: draft.version,
      savedAt: '',
      errorCode: 'HTTP_ERROR',
      message: 'ไม่สามารถติดต่อระบบบันทึกจดหมายได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง',
    };
  }

  const data = (await response.json()) as {
    ok?: boolean;
    letterId?: string;
    version?: number;
    savedAt?: string;
    note?: string;
    errorCode?: string;
    message?: string;
  };

  if (!data.ok) {
    return {
      ok: false,
      letterId: draft.letterId,
      version: draft.version,
      savedAt: '',
      errorCode: data.errorCode || 'BACKEND_REJECTED',
      message: data.message || 'ไม่สามารถบันทึกจดหมายได้ กรุณาลองใหม่อีกครั้ง',
    };
  }

  return {
    ok: true,
    letterId: data.letterId || draft.letterId,
    version: typeof data.version === 'number' ? data.version : draft.version,
    savedAt: data.savedAt || new Date().toISOString(),
    note: data.note,
  };
}

/**
 * บันทึกจดหมายของแอดมินลงใน Google Drive อัตโนมัติ พร้อมรองรับการซิงก์ข้ามอุปกรณ์เมื่ออัปเดต Code.gs
 */
export async function syncAdminOwnerLetterToDrive(
  doc: LetterDocument,
  allOwnerLetters: LetterDocument[]
): Promise<boolean> {
  const cleanSuffix = doc.id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || 'doc';
  const letterId = `ltr_owner_${cleanSuffix}`;
  const fullBody = [
    doc.salutation,
    '',
    ...doc.paragraphs,
    '',
    doc.signOff,
    doc.senderName,
  ].join('\n\n');

  let version = getNextOwnerLetterVersion(doc.id);

  try {
    let res = await saveViaGasWebApp({
      draft: {
        letterId,
        title: doc.letterTitle,
        author: `${doc.senderName} (${doc.dateLabel})`,
        body: fullBody,
        version,
        lastModifiedIso: new Date().toISOString(),
        lastSavedVersion: 0,
        lastSavedIso: null,
        recoveryState: 'completed',
      },
      isFinalFold: true,
      ownerLettersSnapshot: allOwnerLetters,
    });

    if (res.ok && res.note === 'newer_version_already_saved' && res.version >= version) {
      version = getNextOwnerLetterVersion(doc.id, res.version + 1);
      res = await saveViaGasWebApp({
        draft: {
          letterId,
          title: doc.letterTitle,
          author: `${doc.senderName} (${doc.dateLabel})`,
          body: fullBody,
          version,
          lastModifiedIso: new Date().toISOString(),
          lastSavedVersion: 0,
          lastSavedIso: null,
          recoveryState: 'completed',
        },
        isFinalFold: true,
        ownerLettersSnapshot: allOwnerLetters,
      });
    }

    return res.ok;
  } catch {
    return false;
  }
}

const LOCAL_SITE_COPY_KEY = 'to_you_site_copy_v1';

export function cloneSiteCopy(source: SiteCopy): SiteCopy {
  return {
    siteTitle: source.siteTitle,
    globalBars: { ...source.globalBars },
    cover: { ...source.cover },
    stepA: { ...source.stepA },
    stepB: { ...source.stepB },
    stepC: { ...source.stepC },
    stepD: { ...source.stepD },
    stepE: { ...source.stepE },
  };
}

export function mergeWithDefaultSiteCopy(partial: unknown): SiteCopy {
  if (!partial || typeof partial !== 'object') {
    return cloneSiteCopy(UI_COPY);
  }
  const p = partial as Partial<SiteCopy>;
  return {
    siteTitle: typeof p.siteTitle === 'string' ? p.siteTitle : UI_COPY.siteTitle,
    globalBars: { ...UI_COPY.globalBars, ...(p.globalBars || {}) },
    cover: { ...UI_COPY.cover, ...(p.cover || {}) },
    stepA: { ...UI_COPY.stepA, ...(p.stepA || {}) },
    stepB: { ...UI_COPY.stepB, ...(p.stepB || {}) },
    stepC: { ...UI_COPY.stepC, ...(p.stepC || {}) },
    stepD: { ...UI_COPY.stepD, ...(p.stepD || {}) },
    stepE: { ...UI_COPY.stepE, ...(p.stepE || {}) },
  };
}

export function loadSiteCopyFromLocal(): SiteCopy {
  try {
    const raw = localStorage.getItem(LOCAL_SITE_COPY_KEY);
    if (!raw) return cloneSiteCopy(UI_COPY);
    return mergeWithDefaultSiteCopy(JSON.parse(raw));
  } catch {
    return cloneSiteCopy(UI_COPY);
  }
}

export function saveSiteCopyToLocal(copy: SiteCopy): void {
  try {
    localStorage.setItem(LOCAL_SITE_COPY_KEY, JSON.stringify(copy));
  } catch {
    // Ignore
  }
}

export function resetSiteCopyInLocal(): SiteCopy {
  try {
    localStorage.removeItem(LOCAL_SITE_COPY_KEY);
  } catch {
    // Ignore
  }
  return cloneSiteCopy(UI_COPY);
}

export async function syncAdminSiteCopyToDrive(copy: SiteCopy): Promise<boolean> {
  const gasUrl = APP_CONFIG.gasWebAppUrl;
  if (!gasUrl || !gasUrl.startsWith('https://script.google.com/')) {
    return false;
  }

  let version = getNextOwnerLetterVersion('sitecopy');
  const letterId = 'ltr_owner_sitecopy';
  const bodyJson = JSON.stringify(copy, null, 2).slice(0, 4950);

  const sendOnce = async (ver: number) => {
    const payload = {
      action: 'saveLetter',
      idempotencyKey: buildIdempotencyKey(letterId, ver),
      letterId,
      title: `ข้อความหน้าเว็บไซต์ (${copy.siteTitle})`,
      author: 'แอดมิน',
      body: bodyJson,
      version: ver,
      recoveryState: 'completed',
      siteCopy: copy,
      clientTimestamp: new Date().toISOString(),
    };

    const res = await fetch(gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false, version: ver, note: '' };
    return (await res.json()) as { ok?: boolean; version?: number; note?: string };
  };

  try {
    let result = await sendOnce(version);
    if (
      result.ok &&
      result.note === 'newer_version_already_saved' &&
      typeof result.version === 'number' &&
      result.version >= version
    ) {
      version = getNextOwnerLetterVersion('sitecopy', result.version + 1);
      result = await sendOnce(version);
    }
    return Boolean(result.ok);
  } catch {
    return false;
  }
}

/**
 * โหลดจดหมายหลักและข้อความหน้าเว็บสำรองจาก Google Apps Script (พร้อมตัวตัดเวลาป้องกันค้างบนมือถือ)
 */
export async function fetchOwnerConfigFromCloud(): Promise<{
  ownerLetters: LetterDocument[] | null;
  siteCopy: SiteCopy | null;
}> {
  const gasUrl = APP_CONFIG.gasWebAppUrl;
  if (!gasUrl || !gasUrl.startsWith('https://script.google.com/')) {
    return { ownerLetters: null, siteCopy: null };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(gasUrl, { method: 'GET', signal: controller.signal });
    if (!res.ok) return { ownerLetters: null, siteCopy: null };
    const data = (await res.json()) as {
      ok?: boolean;
      ownerLetters?: unknown[];
      siteCopy?: unknown;
    };

    let ownerLetters: LetterDocument[] | null = null;
    let siteCopy: SiteCopy | null = null;

    if (data.ok && Array.isArray(data.ownerLetters)) {
      const valid = data.ownerLetters.filter(isValidLetterDocument);
      if (valid.length > 0) {
        ownerLetters = valid;
      }
    }

    if (data.ok && data.siteCopy && typeof data.siteCopy === 'object') {
      siteCopy = mergeWithDefaultSiteCopy(data.siteCopy);
    }

    return { ownerLetters, siteCopy };
  } catch {
    return { ownerLetters: null, siteCopy: null };
  } finally {
    window.clearTimeout(timeoutId);
  }
}
