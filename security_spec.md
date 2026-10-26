# Security Specification — ถึงคุณ ♡ (Shared Mailbox & Full Admin Copy Control)

## 1. Data Invariants & Master Source of Truth

1. **Default-Deny Catch-All**: Any path not explicitly matched under `/admins/{adminUid}`, `/published_site/{configId}`, `/published_letters/{letterId}`, or `/shared_replies/{replyId}` is unconditionally denied (`allow read, write: if false;`).
2. **Admin Privilege Invariant (`isAdmin()`)**:
   - Only a signed-in user with `request.auth.token.email_verified == true` whose email matches the bootstrapped owner (`xox89m97@gmail.com`, case-insensitive) OR whose UID exists in `/databases/$(database)/documents/admins/$(request.auth.uid)` has administrator privileges.
   - Client SDK writes to `/admins/{adminUid}` are unconditionally forbidden (`allow create, update, delete: if false;`) to prevent self-assigned privilege escalation.
3. **Zero PII & Controlled Public Reads**:
   - No PII (no email addresses, phone numbers, or physical addresses) is ever stored in `/published_site`, `/published_letters`, or `/shared_replies`.
   - `/published_site/live_site` and `/published_letters/{letterId}` permit single-document `get` by known ID (`allow list: if false;`).
   - `/shared_replies/{replyId}` stores shared mailbox letters readable by everyone ONLY when explicitly queried with `where('visibility', '==', 'public')` (`allow list: if existing().visibility == 'public';` and `allow get: if isValidId(replyId) && (resource == null || existing().visibility == 'public');`). Unconstrained collection scraping without the `visibility == 'public'` constraint is rejected by the rules engine.
4. **Tiered Identity & Anti-Update-Gap Validation**:
   - `PublishedSiteConfig` and `PublishedLetter`: Only `isAdmin()` may create, update, or delete (and core letters `apology` and `birthday` cannot be deleted).
   - `SharedReplyLetter`:
     - **Create**: Any verified user (`isVerifiedUser()`) may create a public reply letter where `incoming().authorUid == request.auth.uid`, `incoming().lastEditorUid == request.auth.uid`, `incoming().letterId == replyId`, and `incoming().visibility == 'public'`.
     - **Update**: Must pass `isValidSharedReply(incoming())` (`lastEditorUid == request.auth.uid`), preserve immutable fields (`letterId`, `authorUid`, `visibility`, `createdAt`), restrict `affectedKeys().hasOnly(['lastEditorUid', 'title', 'author', 'body', 'version', 'recoveryState', 'updatedAt'])`, enforce `updatedAt == request.time`, and require `(request.auth.uid == existing().authorUid || isAdmin())`.
     - **Delete**: Permitted only for `isVerifiedUser() && isValidId(replyId) && (request.auth.uid == existing().authorUid || isAdmin())`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)

1. **Unauthenticated Write (`published_site/live_site`)**: Anonymous client sends valid `PublishedSiteConfig` without `request.auth`.
2. **Unverified Email Spoof (`published_site/live_site`)**: Attacker presents `email: 'xox89m97@gmail.com'` with `email_verified: false`.
3. **Non-Admin Verified User Overwrite on Owner Letter (`published_letters/apology`)**: Verified non-admin user attempts to overwrite `apology`.
4. **Self-Assigned Admin Escalation (`admins/intruder_uid`)**: Verified user attempts to write their own UID into `/admins`.
5. **Shadow / Ghost Field Injection (`shared_replies/ltr_12345678`)**: Verified user sends all valid fields plus an undeclared ghost key `isPinned: true`.
6. **Creator Identity Spoofing on Shared Reply (`shared_replies/ltr_12345678`)**: Verified user creates a `SharedReplyLetter` with `authorUid: 'someone_else_uid'`.
7. **Unauthorized Cross-User Edit on Shared Reply (`shared_replies/ltr_12345678`)**: Verified non-admin user `intruder_1` attempts to edit `visitor_1`'s reply letter.
8. **Immutable `authorUid` or `createdAt` Mutation on Update (`shared_replies/ltr_12345678`)**: Even a verified user or admin attempts to mutate `authorUid` or `createdAt` during an `update`.
9. **Client Timestamp Forgery (`updatedAt != request.time`)**: Verified admin or writer sends a forged client timestamp instead of `serverTimestamp()`.
10. **ID Poisoning (`shared_replies/bad$id/inject`)**: Document ID contains illegal characters outside `^[a-zA-Z0-9_-]+$`.
11. **Denial-of-Wallet Oversized Payload**: `body` exceeds 8,000 chars or `title` exceeds 200 chars.
12. **Unfiltered List Query / Core Envelope Deletion**: Unfiltered list on `published_letters` (or `shared_replies` where `visibility != 'public'`) or attempt to delete core `apology` envelope.
