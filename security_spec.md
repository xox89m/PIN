# Security Specification — ถึงคุณ ♡ (Firestore Shared Admin State)

## 1. Data Invariants & Master Source of Truth

1. **Default-Deny Catch-All**: Any path not explicitly matched under `/admins/{adminUid}`, `/published_site/{configId}`, or `/published_letters/{letterId}` is unconditionally denied (`allow read, write: if false;`).
2. **Admin Privilege Invariant (`isAdmin()`)**:
   - Only a signed-in user with `request.auth.token.email_verified == true` whose email matches the bootstrapped owner (`xox89m97@gmail.com`, case-insensitive) OR whose UID exists in `/databases/$(database)/documents/admins/$(request.auth.uid)` may create, update, or delete published content.
   - Client SDK writes to `/admins/{adminUid}` are unconditionally forbidden (`allow create, update, delete: if false;`) to prevent self-assigned privilege escalation.
3. **Zero PII & Public Single-Document Reads (No List Scraping)**:
   - Visitors do not sign in with Google to view the letter desk; they read known document IDs (`/published_site/live_site` and `/published_letters/{letterId}` listed in `letterOrderIds`).
   - `allow list: if false;` on ALL collections (`/admins`, `/published_site`, `/published_letters`).
   - No PII (no emails, phone numbers, or private visitor reply letters) is ever stored in Firestore; private visitor replies continue to go strictly to the owner's private Google Drive via Apps Script.
4. **Strict Schema, Key Allowlisting, Bounded Arrays, & Temporal Integrity**:
   - Every write enforces `isValidPublishedSiteConfig(incoming())` or `isValidPublishedLetter(incoming())` on both `create` and `update`.
   - `authorUid` must be a bounded string (`1..128` chars, `^[a-zA-Z0-9_\\-:.]+$`) strictly matching `request.auth.uid`.
   - `createdAt` must equal `request.time` on `create` and remain immutable (`incoming().createdAt == existing().createdAt`) on `update`.
   - `updatedAt` must equal `request.time` on every `create` and `update`.
   - Core letters (`apology` and `birthday`) cannot be deleted via `delete`, preventing accidental removal of primary envelopes.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return `PERMISSION_DENIED`)

1. **Unauthenticated Write (`published_site/live_site`)**: Anonymous attacker sends valid `PublishedSiteConfig` without `request.auth`.
2. **Unverified Email Spoof (`published_site/live_site`)**: Attacker presents `email: 'xox89m97@gmail.com'` with `email_verified: false`.
3. **Non-Admin Verified User Write (`published_letters/apology`)**: Signed-in verified user `intruder@example.com` attempts to overwrite `apology` letter.
4. **Self-Assigned Admin Escalation (`admins/attacker_uid`)**: Signed-in user attempts `setDoc(doc(db, 'admins', uid), { uid, createdAt: serverTimestamp() })`.
5. **Shadow / Ghost Field Injection (`published_letters/apology`)**: Verified admin sends all valid fields plus an undeclared ghost key `isHacked: true`.
6. **Identity Spoofing (`authorUid` mismatch)**: Verified admin writes `PublishedLetter` with `authorUid: 'someone_else_uid'`.
7. **Client Timestamp Forgery (`updatedAt` != `request.time`)**: Verified admin sends a hardcoded past/future timestamp instead of `serverTimestamp()`.
8. **Immutable `createdAt` Mutation on Update**: Verified admin attempts to modify `createdAt` during an `updateDoc` on `published_site/live_site`.
9. **ID Poisoning / Path Mismatch (`published_letters/bad$id` or `id != letterId`)**: Document ID contains illegal characters or `incoming().id != letterId`.
10. **Denial-of-Wallet Oversized String / Unbounded Array**: Payload contains `paragraphs` array of 500 items or `letterTitle` of 10,000 chars.
11. **Collection List Scraping (`getDocs(collection(db, 'published_letters'))`)**: Client attempts `list` query instead of `get` by known ID.
12. **Core Envelope Deletion (`deleteDoc(doc(db, 'published_letters', 'apology'))`)**: Attempt to delete protected core `apology` or `birthday` document.
