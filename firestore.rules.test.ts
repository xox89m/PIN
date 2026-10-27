/**
 * Phase 0 & Phase 5 Security TDD Runner — Verifies all "Dirty Dozen" adversarial payloads
 * return PERMISSION_DENIED and legitimate Admin / Guest Capability Lock / Verified Visitor / Public Reader flows succeed.
 */
import { UI_COPY } from './src/content/letters';

interface SimAuth {
  uid: string;
  email: string;
  email_verified: boolean;
}

interface SimLockState {
  replyId: string;
  secretKey: string;
  nonce: number;
  proof: string;
  createdAt: number;
  updatedAt: number;
}

interface SimRequest {
  auth: SimAuth | null;
  timeMs: number;
  op: 'get' | 'list' | 'create' | 'update' | 'delete';
  collection: string;
  docId: string;
  incoming?: Record<string, unknown>;
  existing?: Record<string, unknown>;
  existingLock?: SimLockState;
  afterLock?: SimLockState;
  existingReplyExists?: boolean;
  afterReply?: Record<string, unknown> | null;
}

const VALID_ID_RE = /^[a-zA-Z0-9_-]+$/;
const VALID_UID_RE = /^[a-zA-Z0-9_.:-]+$/;
const VALID_HEX64_RE = /^[a-f0-9]{64}$/;
const VALID_PROOF_RE = /^[a-f0-9]+_[0-9]+$/;

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
  const keys = [
    'letterId', 'authorUid', 'lastEditorUid', 'lockNonce', 'visibility',
    'title', 'author', 'body', 'version', 'recoveryState',
    'createdAt', 'updatedAt',
  ];
  if (!hasExactKeys(data, keys)) return false;
  if (!isValidId(data.letterId, 64)) return false;
  if (!isValidUid(data.authorUid, 128)) return false;
  if (!isValidUid(data.lastEditorUid, 128)) return false;
  if (auth) {
    if (data.lastEditorUid !== auth.uid) return false;
  } else {
    if (data.lastEditorUid !== 'guest_writer') return false;
  }
  if (typeof data.lockNonce !== 'number' || !Number.isInteger(data.lockNonce) || data.lockNonce < 0 || data.lockNonce > 1000000) {
    return false;
  }
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

function isValidReplyLock(data: Record<string, unknown>): boolean {
  const keys = ['replyId', 'secretKey', 'nonce', 'proof', 'createdAt', 'updatedAt'];
  if (!hasExactKeys(data, keys)) return false;
  if (!isValidId(data.replyId, 64)) return false;
  if (typeof data.secretKey !== 'string' || !VALID_HEX64_RE.test(data.secretKey)) return false;
  if (typeof data.nonce !== 'number' || !Number.isInteger(data.nonce) || data.nonce < 1 || data.nonce > 1000000) {
    return false;
  }
  if (typeof data.proof !== 'string' || data.proof.length < 66 || data.proof.length > 80 || !VALID_PROOF_RE.test(data.proof)) {
    return false;
  }
  return typeof data.createdAt === 'number' && typeof data.updatedAt === 'number';
}

function evaluateLockUpdate(existingLock: SimLockState, afterLock: SimLockState, timeMs: number): boolean {
  const incomingObj = afterLock as unknown as Record<string, unknown>;
  if (!isValidReplyLock(incomingObj)) return false;
  if (afterLock.replyId !== existingLock.replyId) return false;
  if (afterLock.secretKey !== existingLock.secretKey) return false;
  if (afterLock.nonce !== existingLock.nonce + 1) return false;
  if (afterLock.proof !== `${existingLock.secretKey}_${afterLock.nonce}`) return false;
  if (afterLock.createdAt !== existingLock.createdAt) return false;
  if (afterLock.updatedAt !== timeMs) return false;
  return true;
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
        isValidPublishedSiteConfig(req.incoming, req.auth) &&
        Boolean(req.auth?.email_verified) &&
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
      return isValidId(req.docId, 64) && (!req.existing || req.existing.isOwnerApprovedForProduction === true)
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    if (req.op === 'list') {
      return req.existing?.isOwnerApprovedForProduction === true ? 'ALLOW' : 'PERMISSION_DENIED';
    }
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
        isValidPublishedLetter(req.incoming, req.auth) &&
        Boolean(req.auth?.email_verified) &&
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

  if (req.collection === 'reply_locks') {
    if (req.op === 'get' || req.op === 'list') return 'PERMISSION_DENIED';
    if (req.op === 'create' && req.incoming) {
      const ok =
        isValidId(req.docId, 64) &&
        req.incoming.replyId === req.docId &&
        req.incoming.nonce === 1 &&
        isValidReplyLock(req.incoming) &&
        req.incoming.proof === `${req.incoming.secretKey}_1` &&
        req.incoming.createdAt === req.timeMs &&
        req.incoming.updatedAt === req.timeMs &&
        !req.existingReplyExists &&
        Boolean(req.afterReply) &&
        req.afterReply?.authorUid === 'guest_writer' &&
        req.afterReply?.lockNonce === 1;
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'update' && req.incoming && req.existing) {
      const ok =
        isValidReplyLock(req.incoming) &&
        isValidId(req.docId, 64) &&
        req.incoming.replyId === req.existing.replyId &&
        req.incoming.secretKey === req.existing.secretKey &&
        req.incoming.nonce === (req.existing.nonce as number) + 1 &&
        req.incoming.proof === `${req.existing.secretKey}_${req.incoming.nonce}` &&
        req.incoming.createdAt === req.existing.createdAt &&
        req.incoming.updatedAt === req.timeMs &&
        Boolean(req.existingReplyExists) &&
        ((req.afterReply && req.afterReply.lockNonce === req.incoming.nonce) || req.afterReply === null);
      return ok ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'delete') {
      return Boolean(req.auth?.email_verified) && isValidId(req.docId, 64) && isAdmin(req.auth, adminRegistry)
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
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
      const baseOk =
        isValidId(req.docId, 64) &&
        req.incoming.letterId === req.docId &&
        isValidSharedReplyLetter(req.incoming, req.auth) &&
        req.incoming.createdAt === req.timeMs &&
        req.incoming.updatedAt === req.timeMs;
      if (!baseOk) return 'PERMISSION_DENIED';

      const verifiedBranch =
        Boolean(req.auth?.email_verified) &&
        req.incoming.authorUid === req.auth?.uid &&
        req.incoming.lockNonce === 0;

      const guestBranch =
        req.auth === null &&
        req.incoming.authorUid === 'guest_writer' &&
        req.incoming.lockNonce === 1 &&
        Boolean(req.afterLock) &&
        isValidReplyLock(req.afterLock as unknown as Record<string, unknown>) &&
        req.afterLock?.proof === `${req.afterLock?.secretKey}_1` &&
        req.afterLock?.nonce === 1 &&
        req.afterLock?.updatedAt === req.timeMs;

      return verifiedBranch || guestBranch ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'update' && req.incoming && req.existing) {
      const baseOk =
        isValidSharedReplyLetter(req.incoming, req.auth) &&
        isValidId(req.docId, 64) &&
        req.incoming.letterId === req.existing.letterId &&
        req.incoming.authorUid === req.existing.authorUid &&
        req.incoming.visibility === req.existing.visibility &&
        req.incoming.createdAt === req.existing.createdAt &&
        req.incoming.updatedAt === req.timeMs;
      if (!baseOk) return 'PERMISSION_DENIED';

      const hasExistingNonce = Object.prototype.hasOwnProperty.call(req.existing, 'lockNonce');
      const unchangedNonce =
        (!hasExistingNonce && req.incoming.lockNonce === 0) ||
        (hasExistingNonce && req.incoming.lockNonce === req.existing.lockNonce);

      const adminAction =
        Boolean(req.auth?.email_verified) && unchangedNonce && isAdmin(req.auth, adminRegistry);

      const verifiedAuthorAction =
        Boolean(req.auth?.email_verified) &&
        req.existing.authorUid !== 'guest_writer' &&
        req.auth?.uid === req.existing.authorUid &&
        unchangedNonce;

      const guestLockAction =
        req.existing.authorUid === 'guest_writer' &&
        hasExistingNonce &&
        req.incoming.lockNonce === (req.existing.lockNonce as number) + 1 &&
        Boolean(req.existingLock) &&
        Boolean(req.afterLock) &&
        evaluateLockUpdate(req.existingLock!, req.afterLock!, req.timeMs) &&
        req.afterLock!.nonce === req.incoming.lockNonce;

      return adminAction || verifiedAuthorAction || guestLockAction ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    if (req.op === 'delete' && req.existing) {
      if (!isValidId(req.docId, 64)) return 'PERMISSION_DENIED';
      const authDelete =
        Boolean(req.auth?.email_verified) &&
        ((req.existing.authorUid !== 'guest_writer' && req.auth?.uid === req.existing.authorUid) ||
          isAdmin(req.auth, adminRegistry));
      const guestDelete =
        req.existing.authorUid === 'guest_writer' &&
        typeof req.existing.lockNonce === 'number' &&
        Boolean(req.existingLock) &&
        Boolean(req.afterLock) &&
        evaluateLockUpdate(req.existingLock!, req.afterLock!, req.timeMs) &&
        req.afterLock!.nonce === (req.existing.lockNonce as number) + 1;
      return authDelete || guestDelete ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    return 'PERMISSION_DENIED';
  }

  return 'PERMISSION_DENIED';
}

const NOW = 1761430000000;
const OWNER_AUTH: SimAuth = { uid: '1S14sAQRlFPmPpEODec6kgEhhuy2', email: 'xox89m97@gmail.com', email_verified: true };
const VISITOR_AUTH: SimAuth = { uid: 'visitor_uid_1', email: 'reader@example.com', email_verified: true };
const INTRUDER_AUTH: SimAuth = { uid: 'intruder_uid_1', email: 'intruder@example.com', email_verified: true };
const GUEST_SECRET = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90';
const WRONG_SECRET = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

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
  lockNonce: 0,
  visibility: 'public',
  title: 'ขอบคุณนะ',
  author: 'คนสำคัญ',
  body: 'อ่านจดหมายแล้วนะ ขอบคุณมาก ๆ',
  version: 1,
  recoveryState: 'completed',
  createdAt: NOW,
  updatedAt: NOW,
};

const baseGuestReply = {
  letterId: 'ltr_guest9876543',
  authorUid: 'guest_writer',
  lastEditorUid: 'guest_writer',
  lockNonce: 1,
  visibility: 'public',
  title: 'จดหมายจากวันเกิด',
  author: 'เราเอง',
  body: 'เขียนถึงเธอแบบเรียลไทม์นะ',
  version: 1,
  recoveryState: 'completed',
  createdAt: NOW,
  updatedAt: NOW,
};

const baseGuestLock: SimLockState = {
  replyId: 'ltr_guest9876543',
  secretKey: GUEST_SECRET,
  nonce: 1,
  proof: `${GUEST_SECRET}_1`,
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
    name: '7. Unauthorized guest overwrite with wrong secretKey or stale proof',
    req: {
      auth: null,
      timeMs: NOW + 1000,
      op: 'update',
      collection: 'shared_replies',
      docId: 'ltr_guest9876543',
      existing: baseGuestReply,
      incoming: { ...baseGuestReply, lockNonce: 2, title: 'Spoofed', version: 2, updatedAt: NOW + 1000 },
      existingLock: baseGuestLock,
      afterLock: {
        ...baseGuestLock,
        nonce: 2,
        proof: `${WRONG_SECRET}_2`,
        updatedAt: NOW + 1000,
      },
    },
  },
  {
    name: '8. Direct read attempt on private /reply_locks capability secret',
    req: {
      auth: INTRUDER_AUTH,
      timeMs: NOW,
      op: 'get',
      collection: 'reply_locks',
      docId: 'ltr_guest9876543',
    },
  },
  {
    name: '9. Immutable authorUid mutation on shared_replies update',
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
    name: '10. Client timestamp forgery (updatedAt != request.time)',
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
    name: '11. ID poisoning & oversized payload attack',
    req: {
      auth: VISITOR_AUTH,
      timeMs: NOW,
      op: 'create',
      collection: 'shared_replies',
      docId: 'bad$id/inject',
      incoming: { ...baseSharedReply, letterId: 'bad$id/inject', body: 'ก'.repeat(8500) },
    },
  },
  {
    name: '12. Unfiltered list query on unapproved published_letters',
    req: {
      auth: null,
      timeMs: NOW,
      op: 'list',
      collection: 'published_letters',
      docId: '',
      existing: { ...baseLetter, isOwnerApprovedForProduction: false },
    },
  },
];

for (const testCase of dirtyDozenCases) {
  const verdict = evaluateRules(testCase.req);
  if (verdict !== 'PERMISSION_DENIED') {
    throw new Error(`Security assertion failed for [${testCase.name}]: expected PERMISSION_DENIED, got ${verdict}`);
  }
}

// Legitimate flows verification:
// 1. Public real-time list on approved owner letters
if (
  evaluateRules({
    auth: null,
    timeMs: NOW,
    op: 'list',
    collection: 'published_letters',
    docId: '',
    existing: baseLetter,
  }) !== 'ALLOW'
) {
  throw new Error('Public real-time list on approved published_letters must be ALLOWED');
}

// 2. Guest writer atomic create with ReplyWriterLock
if (
  evaluateRules({
    auth: null,
    timeMs: NOW,
    op: 'create',
    collection: 'shared_replies',
    docId: 'ltr_guest9876543',
    incoming: baseGuestReply,
    afterLock: baseGuestLock,
  }) !== 'ALLOW'
) {
  throw new Error('Guest writer atomic create with ReplyWriterLock must be ALLOWED');
}

// 3. Guest writer atomic update with valid secretKey proof
if (
  evaluateRules({
    auth: null,
    timeMs: NOW + 1500,
    op: 'update',
    collection: 'shared_replies',
    docId: 'ltr_guest9876543',
    existing: baseGuestReply,
    incoming: {
      ...baseGuestReply,
      lockNonce: 2,
      body: 'เขียนเพิ่มอีกย่อหน้าแบบเรียลไทม์',
      version: 2,
      updatedAt: NOW + 1500,
    },
    existingLock: baseGuestLock,
    afterLock: {
      ...baseGuestLock,
      nonce: 2,
      proof: `${GUEST_SECRET}_2`,
      updatedAt: NOW + 1500,
    },
  }) !== 'ALLOW'
) {
  throw new Error('Guest writer atomic update with valid secretKey proof must be ALLOWED');
}

// 4. Verified Admin editing a guest writer's reply letter (without needing guest secretKey!)
if (
  evaluateRules({
    auth: OWNER_AUTH,
    timeMs: NOW + 3000,
    op: 'update',
    collection: 'shared_replies',
    docId: 'ltr_guest9876543',
    existing: baseGuestReply,
    incoming: {
      ...baseGuestReply,
      lastEditorUid: OWNER_AUTH.uid,
      title: 'จดหมายจากวันเกิด (แอดมินแก้คำ)',
      version: 3,
      updatedAt: NOW + 3000,
    },
  }) !== 'ALLOW'
) {
  throw new Error('Verified Admin editing guest reply letter must be ALLOWED');
}

console.log('All 12 Dirty Dozen adversarial payloads returned PERMISSION_DENIED and all real-time flows passed.');
