import { APP_CONFIG } from '../config';

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
}

export interface SaveBackendResponse {
  ok: boolean;
  letterId: string;
  version: number;
  savedAt: string;
  errorCode?: string;
  message?: string;
}

const LOCAL_DRAFT_STORAGE_KEY = 'to_you_reply_draft_v1';
const LOCAL_SENT_HISTORY_KEY = 'to_you_sent_letters_box_v1';

function generateSecureId(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `ltr_${hex}`;
}

export function createInitialDraft(): ReplyLetterDraft {
  return {
    letterId: generateSecureId(),
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
      /^ltr_[a-zA-Z0-9_-]{8,64}$/.test(parsed.letterId)
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

/**
 * โหลดและบันทึกรายการจดหมายตอบกลับที่เขียนในเครื่องนี้ เพื่อแสดงจำนวนและรายชื่อใน "กล่องจดหมาย" ด้านข้าง
 * (ข้อมูลเก็บเฉพาะในเบราว์เซอร์เครื่องผู้เขียน ไม่ดึงจดหมายคนอื่นจากเซิร์ฟเวอร์เพื่อรักษาความเป็นส่วนตัว)
 */
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
  signal?: AbortSignal;
}): Promise<SaveBackendResponse> {
  const { draft, isFinalFold = false, signal } = params;
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

  const payload = {
    action: 'saveLetter',
    idempotencyKey: buildIdempotencyKey(draft.letterId, draft.version),
    letterId: draft.letterId,
    title: draft.title.slice(0, APP_CONFIG.maxTitleLength),
    author: draft.author.slice(0, APP_CONFIG.maxAuthorLength),
    body: draft.body.slice(0, APP_CONFIG.maxBodyLength),
    version: draft.version,
    recoveryState: isFinalFold ? 'completed' : 'synced',
    clientTimestamp: new Date().toISOString(),
  };

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
  };
}
