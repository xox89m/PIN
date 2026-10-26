/**
 * Phase 0 & Phase 5 Security TDD Runner — Verifies all "Dirty Dozen" adversarial payloads
 * return PERMISSION_DENIED and legitimate Admin / Visitor / Public Reader operations succeed.
 */
import { UI_COPY } from './src/content/letters';

interface SimAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface SimRequest {
  auth: SimAuth | null;
  timeMs: number;
  op: 'get' | 'list' | 'create' | 'update' | 'delete';
  collection: string;
  docId: string;
  incoming?: Record<string, unknown>;
  existing?: Record<string, unknown>;
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;
const VALID_UID_RE = /^[a-zA-Z0-9_.:-]+$/;

function isValidId(id: unknown, max = 64): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= max && VALID_ID_RE.test(id);
}

function isValidUid(id: unknown, max = 128): boolean {
  return typeof id === 'string' && id.length >= 1 && id.length <= max && VALID_UID_RE.test(id);
}

function isBoundedString(v: unknown, min: number, max: number): boolean {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}

function hasExactKeys(obj: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(obj);
  return actual.length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

function isAdmin(auth: SimAuth | null, adminRegistry: Set<string>): boolean {
  if (!auth || !auth.email_verified) return false;
  return auth.email.toLowerCase() === 'xox89m97@gmail.com' || adminRegistry.has(auth.uid);
}

function isValidPublishedLetter(data: Record<string, unknown>, auth: SimAuth | null): boolean {
  if (!auth) return false;
  const keys = [
    'id', 'authorUid', 'isOwnerApprovedForProduction',
    'letterTitle', 'senderLabel', 'dateLabel', 'salutation',
    'paragraphs', 'signOff', 'senderName', 'createdAt', 'updatedAt',
  ];
  if (!hasExactKeys(data, keys)) return false;
  if (!isValidId(data.id, 64)) return false;
  if (!isValidUid(data.authorUid, 128) || data.authorUid !== auth.uid) return false;
  if (typeof data.isOwnerApprovedForProduction !== 'boolean') return false;
  if (!isBoundedString(data.letterTitle, 1, 200)) return false;
  if (!isBoundedString(data.senderLabel, 0, 120)) return false;
  if (!isBoundedString(data.dateLabel, 0, 120)) return false;
  if (!isBoundedString(data.salutation, 0, 300)) return false;
  if (!Array.isArray(data.paragraphs) || data.paragraphs.length < 1 || data.paragraphs.length > 80) return false;
  if (!isBoundedString(data.paragraphs[0], 0, 4000)) return false;
  if (!isBoundedString(data.signOff, 0, 200)) return false;
  if (!isBoundedString(data.senderName, 0, 120)) return false;
  return typeof data.createdAt === 'number' && typeof data.updatedAt === 'number';
}

function isValidPublishedSiteConfig(data: Record<string, unknown>, auth: SimAuth | null): boolean {
  if (!auth) return false;
  const keys = [
    'configId', 'authorUid', 'letterOrderIds', 'siteTitle', 'globalBars',
    'cover', 'stepA', 'stepB', 'stepC', 'stepD', 'stepE',
    'createdAt', 'updatedAt',
  ];
  if (!hasExactKeys(data, keys)) return false;
  if (data.configId !== 'live_site') return false;
  if (!isValidUid(data.authorUid, 128) || data.authorUid !== auth.uid) return false;
  if (!Array.isArray(data.letterOrderIds) || data.letterOrderIds.length < 1 || data.letterOrderIds.length > 30) {
    return false;
  }
  if (!isValidId(data.letterOrderIds[0], 64)) return false;
  if (!isBoundedString(data.siteTitle, 1, 200)) return false;
  return typeof data.createdAt === 'number' && typeof data.updatedAt === 'number';
}

function isValidSharedReplyLetter(data: Record<string, unknown>, auth: SimAuth | null): boolean {
  if (!auth) return false;
  const keys = [
    'letterId', 'authorUid', 'lastEditorUid', 'visibility',
    'title', 'author', 'body', 'version', 'recoveryState',
    'createdAt', 'updatedAt',
  ];
  if (!hasExactKeys(data, keys)) return false;
  if (!isValidId(data.letterId, 64)) return false;
  if (!isValidUid(data.authorUid, 128)) return false;
  if (!isValidUid(data.lastEditorUid, 128) || data.lastEditorUid !== auth.uid) return false;
  if (data.visibility !== 'public') return false;
  if (!isBoundedString(data.title, 1, 200)) return false;
  if (!isBoundedString(data.author, 1, 120)) return false;
  if (!isBoundedString(data.body, 1, 8000)) return false;
  if (typeof data.version !== 'number' || !Number.isInteger(data.version) || data.version < 1 || data.version > 100000) {
    return false;
  }
  if (data.recoveryState !== 'synced' && data.recoveryState !== 'completed') return false;
  return typeof data.createdAt === 'number' && typeof data.updatedAt === 'number';
}

function evaluateRules(req: SimRequest, adminRegistry = new Set<string>()): 'ALLOW' | 'PERMISSION_DENIED' {
  if (req.collection === 'admins') {
    if (req.op === 'get') {
      const ok =
        Boolean(req.auth?.email_verified) &&
        isValidUid(req.docId, 128) &&
        (req.auth?.uid === req.docId || isAdmin(req.auth, adminRegistry));
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  if (req.collection === 'published_site') {
    if (req.op === 'get') {
      return isValidId(req.docId, 64) && req.docId === 'live_site' ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'list' || req.op === 'delete') return 'PERMISSION_DENIED';
    if (req.op === 'create' && req.incoming) {
      const ok =
        Boolean(req.auth?.email_verified) &&
        isValidId(req.docId, 64) &&
        req.docId === 'live_site' &&
        isValidPublishedSiteConfig(req.incoming, req.auth) &&
        req.incoming.createdAt === req.timeMs &&
        req.incoming.updatedAt === req.timeMs &&
        isAdmin(req.auth, adminRegistry);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'update' && req.incoming && req.existing) {
      const ok =
        Boolean(req.auth?.email_verified) &&
        isValidPublishedSiteConfig(req.incoming, req.auth) &&
        isValidId(req.docId, 64) &&
        req.docId === 'live_site' &&
        req.incoming.configId === req.existing.configId &&
        req.incoming.createdAt === req.existing.createdAt &&
        req.incoming.updatedAt === req.timeMs &&
        isAdmin(req.auth, adminRegistry);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  if (req.collection === 'published_letters') {
    if (req.op === 'get') {
      return isValidId(req.docId, 64) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'list') return 'PERMISSION_DENIED';
    if (req.op === 'create' && req.incoming) {
      const ok =
        Boolean(req.auth?.email_verified) &&
        isValidId(req.docId, 64) &&
        req.incoming.id === req.docId &&
        isValidPublishedLetter(req.incoming, req.auth) &&
        req.incoming.createdAt === req.timeMs &&
        req.incoming.updatedAt === req.timeMs &&
        isAdmin(req.auth, adminRegistry);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'update' && req.incoming && req.existing) {
      const ok =
        Boolean(req.auth?.email_verified) &&
        isValidPublishedLetter(req.incoming, req.auth) &&
        isValidId(req.docId, 64) &&
        req.incoming.id === req.existing.id &&
        req.incoming.createdAt === req.existing.createdAt &&
        req.incoming.updatedAt === req.timeMs &&
        isAdmin(req.auth, adminRegistry);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'delete') {
      const ok =
        Boolean(req.auth?.email_verified) &&
        isValidId(req.docId, 64) &&
        req.docId !== 'apology' &&
        req.docId !== 'birthday' &&
        isAdmin(req.auth, adminRegistry);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  if (req.collection === 'shared_replies') {
    if (req.op === 'get') {
      const ok = isValidId(req.docId, 64) && (!req.existing || req.existing.visibility === 'public');
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'list') {
      return req.existing?.visibility === 'public' ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'create' && req.incoming) {
      const ok =
        Boolean(req.auth?.email_verified) &&
        isValidId(req.docId, 64) &&
        req.incoming.letterId === req.docId &&
        req.incoming.authorUid === req.auth?.uid &&
        isValidSharedReplyLetter(req.incoming, req.auth) &&
        req.incoming.createdAt === req.timeMs &&
        req.incoming.updatedAt === req.timeMs;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'update' && req.incoming && req.existing) {
      const ok =
        Boolean(req.auth?.email_verified) &&
        isValidSharedReplyLetter(req.incoming, req.auth) &&
        isValidId(req.docId, 64) &&
        req.incoming.letterId === req.existing.letterId &&
        req.incoming.authorUid === req.existing.authorUid &&
        req.incoming.visibility === req.existing.visibility &&
        req.incoming.createdAt === req.existing.createdAt &&
        req.incoming.updatedAt === req.timeMs &&
        (req.auth?.uid === req.existing.authorUid || isAdmin(req.auth, adminRegistry));
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'delete' && req.existing) {
      const ok =
        Boolean(req.auth?.email_verified) &&
        isValidId(req.docId, 64) &&
        (req.auth?.uid === req.existing.authorUid || isAdmin(req.auth, adminRegistry));
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  return 'PERMISSION_DENIED';
}

const NOW = 1761430000000;
const OWNER_AUTH: SimAuth = { uid: '1S14sAQRlFPmPpEODec6kgEhhuy2', email: 'xox89m97@gmail.com', email_verified: true };
const VISITOR_AUTH: SimAuth = { uid: 'visitor_uid_1', email: 'reader@example.com', email_verified: true };
const INTRUDER_AUTH: SimAuth = { uid: 'intruder_uid_1', email: 'intruder@example.com', email_verified: true };

const baseSiteConfig = {
  configId: 'live_site',
  authorUid: OWNER_AUTH.uid,
  letterOrderIds: ['apology', 'birthday'],
  ...UI_COPY,
  createdAt: NOW,
  updatedAt: NOW,
};

const baseLetter = {
  id: 'apology',
  authorUid: OWNER_AUTH.uid,
  isOwnerApprovedForProduction: true,
  letterTitle: 'จดหมายขอโทษ',
  senderLabel: 'จาก: ฉัน',
  dateLabel: 'ถึงคุณ',
  salutation: 'คุณ...',
  paragraphs: ['ขอโทษจากใจจริง'],
  signOff: 'ด้วยความจริงใจ',
  senderName: 'ฉัน',
  createdAt: NOW,
  updatedAt: NOW,
};

const baseSharedReply = {
  letterId: 'ltr_1234567890ab',
  authorUid: VISITOR_AUTH.uid,
  lastEditorUid: VISITOR_AUTH.uid,
  visibility: 'public',
  title: 'ขอบคุณนะ',
  author: 'คนสำคัญ',
  body: 'อ่านจดหมายแล้วนะ ขอบคุณมาก ๆ',
  version: 1,
  recoveryState: 'completed',
  createdAt: NOW,
  updatedAt: NOW,
};

const dirtyDozenCases: Array<{ name: string; req: SimRequest }> = [
  {
    name: '1. Unauthenticated write to published_site',
    req: { auth: null, timeMs: NOW, op: 'create', collection: 'published_site', docId: 'live_site', incoming: baseSiteConfig },
  },
  {
    name: '2. Email spoofing with email_verified = false',
    req: {
      auth: { uid: 'spoof_1', email: 'xox89m97@gmail.com', email_verified: false },
      timeMs: NOW,
      op: 'create',
      collection: 'published_site',
      docId: 'live_site',
      incoming: { ...baseSiteConfig, authorUid: 'spoof_1' },
    },
  },
  {
    name: '3. Non-admin verified user overwrite attempt on owner letter',
    req: {
      auth: INTRUDER_AUTH,
      timeMs: NOW,
      op: 'create',
      collection: 'published_letters',
      docId: 'apology',
      incoming: { ...baseLetter, authorUid: INTRUDER_AUTH.uid },
    },
  },
  {
    name: '4. Self-assigned admin privilege escalation',
    req: {
      auth: INTRUDER_AUTH,
      timeMs: NOW,
      op: 'create',
      collection: 'admins',
      docId: INTRUDER_AUTH.uid,
      incoming: { uid: INTRUDER_AUTH.uid, createdAt: NOW },
    },
  },
  {
    name: '5. Shadow / ghost field injection on shared_replies',
    req: {
      auth: VISITOR_AUTH,
      timeMs: NOW,
      op: 'create',
      collection: 'shared_replies',
      docId: 'ltr_1234567890ab',
      incoming: { ...baseSharedReply, isPinned: true },
    },
  },
  {
    name: '6. Identity spoofing on shared_replies create',
    req: {
      auth: INTRUDER_AUTH,
      timeMs: NOW,
      op: 'create',
      collection: 'shared_replies',
      docId: 'ltr_1234567890ab',
      incoming: { ...baseSharedReply, authorUid: VISITOR_AUTH.uid, lastEditorUid: INTRUDER_AUTH.uid },
    },
  },
  {
    name: '7. Unauthorized cross-user edit on shared_replies',
    req: {
      auth: INTRUDER_AUTH,
      timeMs: NOW + 1000,
      op: 'update',
      collection: 'shared_replies',
      docId: 'ltr_1234567890ab',
      existing: baseSharedReply,
      incoming: { ...baseSharedReply, lastEditorUid: INTRUDER_AUTH.uid, title: 'Hacked', updatedAt: NOW + 1000 },
    },
  },
  {
    name: '8. Immutable authorUid mutation on shared_replies update',
    req: {
      auth: OWNER_AUTH,
      timeMs: NOW + 1000,
      op: 'update',
      collection: 'shared_replies',
      docId: 'ltr_1234567890ab',
      existing: baseSharedReply,
      incoming: { ...baseSharedReply, authorUid: OWNER_AUTH.uid, lastEditorUid: OWNER_AUTH.uid, updatedAt: NOW + 1000 },
    },
  },
  {
    name: '9. Client timestamp forgery (updatedAt != request.time)',
    req: {
      auth: OWNER_AUTH,
      timeMs: NOW,
      op: 'create',
      collection: 'published_letters',
      docId: 'apology',
      incoming: { ...baseLetter, updatedAt: NOW - 5000 },
    },
  },
  {
    name: '10. ID poisoning with special chars',
    req: {
      auth: VISITOR_AUTH,
      timeMs: NOW,
      op: 'create',
      collection: 'shared_replies',
      docId: 'bad$id/inject',
      incoming: { ...baseSharedReply, letterId: 'bad$id/inject' },
    },
  },
  {
    name: '11. Denial-of-Wallet oversized body string',
    req: {
      auth: VISITOR_AUTH,
      timeMs: NOW,
      op: 'create',
      collection: 'shared_replies',
      docId: 'ltr_1234567890ab',
      incoming: { ...baseSharedReply, body: 'ก'.repeat(8500) },
    },
  },
  {
    name: '12. Unfiltered list query without visibility == public',
    req: {
      auth: null,
      timeMs: NOW,
      op: 'list',
      collection: 'shared_replies',
      docId: '',
      existing: { ...baseSharedReply, visibility: 'private' },
    },
  },
];

for (const testCase of dirtyDozenCases) {
  const verdict = evaluateRules(testCase.req);
  if (verdict !== 'PERMISSION_DENIED') {
    throw new Error(`Security assertion failed for [${testCase.name}]: expected PERMISSION_DENIED, got ${verdict}`);
  }
}

// Verify legitimate public visitor reads, visitor reply creates, and admin edits on ANY letter succeed
if (evaluateRules({ auth: null, timeMs: NOW, op: 'get', collection: 'published_site', docId: 'live_site' }) !== 'ALLOW') {
  throw new Error('Visitor get on published_site/live_site must be ALLOWED');
}
if (
  evaluateRules({
    auth: null,
    timeMs: NOW,
    op: 'list',
    collection: 'shared_replies',
    docId: '',
    existing: baseSharedReply,
  }) !== 'ALLOW'
) {
  throw new Error('Public list with visibility == public on shared_replies must be ALLOWED');
}
if (
  evaluateRules({
    auth: VISITOR_AUTH,
    timeMs: NOW,
    op: 'create',
    collection: 'shared_replies',
    docId: 'ltr_1234567890ab',
    incoming: baseSharedReply,
  }) !== 'ALLOW'
) {
  throw new Error('Verified visitor create on shared_replies must be ALLOWED');
}
if (
  evaluateRules({
    auth: OWNER_AUTH,
    timeMs: NOW + 2000,
    op: 'update',
    collection: 'shared_replies',
    docId: 'ltr_1234567890ab',
    existing: baseSharedReply,
    incoming: {
      ...baseSharedReply,
      lastEditorUid: OWNER_AUTH.uid,
      title: 'ขอบคุณนะ (แอดมินแก้คำผิด)',
      version: 2,
      updatedAt: NOW + 2000,
    },
  }) !== 'ALLOW'
) {
  throw new Error('Verified Admin editing any visitor reply letter must be ALLOWED');
}

console.log('All 12 Dirty Dozen adversarial payloads returned PERMISSION_DENIED and legitimate flows passed.');
