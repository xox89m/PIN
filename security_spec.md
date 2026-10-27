# Security Specification — ถึงคุณ ♡ (Real-Time Shared Mailbox & Full Admin Copy Control)

## 1. Data Invariants & Master Source of Truth

1. **Default-Deny Catch-All**: Any path not explicitly matched under `/admins/{adminUid}`, `/published_site/{configId}`, `/published_letters/{letterId}`, `/shared_replies/{replyId}`, or `/reply_locks/{replyId}` is unconditionally denied (`allow read, write: if false;`).
2. **Admin Privilege Invariant (`isAdmin()`)**:
   - Only a signed-in user with `request.auth.token.email_verified == true` whose email matches the bootstrapped owner (`xox89m97@gmail.com`, case-insensitive) OR whose UID exists in `/databases/$(database)/documents/admins/$(request.auth.uid)` has administrator privileges.
   - Client SDK writes to `/admins/{adminUid}` are unconditionally forbidden (`allow create, update, delete: if false;`) to prevent self-assigned privilege escalation.
3. **Zero PII, Split-Collection Secret Isolation, & Enforced Real-Time Queries**:
   - No PII (no email addresses, phone numbers, or physical addresses) is ever stored in `/published_site`, `/published_letters`, or `/shared_replies`.
   - `/reply_locks/{replyId}` isolates 256-bit writer capability secrets (`secretKey`) in a strictly non-readable collection (`allow get, list: if false;`) so public readers of `/shared_replies` can never inspect or extract `secretKey`.
   - `/published_letters/{letterId}` enforces `allow list: if existing().isOwnerApprovedForProduction == true;` (no `get()`/`exists()` inside `list`) so clients must query `where('isOwnerApprovedForProduction', '==', true)`.
   - `/shared_replies/{replyId}` enforces `allow list: if existing().visibility == 'public';` so clients must query `where('visibility', '==', 'public')`.
4. **Tiered Identity, Atomic Capability Proof, & Anti-Update-Gap Validation**:
   - Every `allow update` begins with its standalone `isValid[Entity](incoming())` blueprint helper.
   - `PublishedSiteConfig` and `PublishedLetter`: Only `isAdmin()` may create, update, or delete (and core envelopes `apology` and `birthday` cannot be deleted).
   - `SharedReplyLetter` + `ReplyWriterLock`:
     - **Create**:
       - Tier A (Verified Auth User): `isVerifiedUser()`, `authorUid == request.auth.uid`, `lastEditorUid == request.auth.uid`, `lockNonce == 0`.
       - Tier B (Birthday-Verified Guest Writer): `request.auth == null`, `authorUid == 'guest_writer'`, `lastEditorUid == 'guest_writer'`, `lockNonce == 1`, paired atomically (`getAfter`) in the same `writeBatch` with creation of `/reply_locks/{replyId}` (`nonce == 1`, `proof == secretKey + '_1'`).
     - **Update**:
       - Must start with `isValidSharedReplyLetter(incoming())`, preserve immutable `letterId`, `authorUid`, `visibility`, and `createdAt`, and enforce `updatedAt == request.time`.
       - Action 1 (Admin Override): `isAdmin()` with `lastEditorUid == request.auth.uid` and unchanged `lockNonce` (or `0` when migrating legacy docs).
       - Action 2 (Verified Auth Creator): `isVerifiedUser() && existing().authorUid != 'guest_writer' && request.auth.uid == existing().authorUid`.
       - Action 3 (Guest Writer via Atomic Lock Proof): `existing().authorUid == 'guest_writer'`, `incoming().lockNonce == existing().lockNonce + 1`, and `getAfter(/databases/$(database)/documents/reply_locks/$(replyId))` proves that `/reply_locks/{replyId}` was updated in the same `writeBatch` with `incomingLock.proof == existingLock.secretKey + '_' + string(incomingLock.nonce)`. An attacker who omits `proof` or guesses a wrong `secretKey` fails `incoming().proof == existing().secretKey + '_' + string(incoming().nonce)`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)

1. **Unauthenticated Write (`published_site/live_site`)**: Anonymous client sends valid `PublishedSiteConfig` without `request.auth`.
2. **Unverified Email Spoof (`published_site/live_site`)**: Attacker presents `email: 'xox89m97@gmail.com'` with `email_verified: false`.
3. **Non-Admin Verified User Overwrite on Owner Letter (`published_letters/apology`)**: Verified non-admin user attempts to overwrite `apology`.
4. **Self-Assigned Admin Escalation (`admins/intruder_uid`)**: Verified user attempts to write their own UID into `/admins`.
5. **Shadow / Ghost Field Injection (`shared_replies/ltr_12345678`)**: Client sends all valid fields plus an undeclared ghost key `isPinned: true`.
6. **Creator Identity Spoofing on Shared Reply (`shared_replies/ltr_12345678`)**: User creates a `SharedReplyLetter` with `authorUid: 'someone_else_uid'`.
7. **Unauthorized Guest Overwrite Without Lock Secret (`shared_replies/ltr_guest_1`)**: Attacker attempts to overwrite a guest reply letter without knowing the 256-bit `secretKey` (or omitting `proof` in `reply_locks`).
8. **Direct Read/Scrape Attempt on Private Capability Lock (`reply_locks/ltr_guest_1`)**: Authenticated or unauthenticated attacker attempts `get` or `list` on `/reply_locks` to steal `secretKey`.
9. **Immutable `authorUid` or `createdAt` Mutation on Update (`shared_replies/ltr_12345678`)**: Even a verified user or admin attempts to mutate `authorUid` or `createdAt` during an `update`.
10. **Client Timestamp Forgery (`updatedAt != request.time`)**: Client sends a forged timestamp instead of `serverTimestamp()`.
11. **ID Poisoning & Denial-of-Wallet Oversized Payload**: Document ID contains illegal characters (`bad$id/inject`) or `body` exceeds 8,000 chars.
12. **Unfiltered List Query**: Unfiltered list on `published_letters` where `isOwnerApprovedForProduction == false` or `shared_replies` where `visibility != 'public'`.
