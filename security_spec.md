# Security Specification for Uniform CRM

## Data Invariants
1. A **User** profile must match their Auth UID.
2. Only certain whitelisted emails can claim the "Admin" role.
3. Every **Sale Record** must have a unique ID, a student name, a class, and a total amount.
4. **Pricing** and **Inventory** can only be modified by Admins or Editors.
5. Users can only see their own profile unless they are an Admin.
6. **Sales** records are readable by all signed-in users but writable only by Admins/Editors.

## The "Dirty Dozen" (Attack Payloads)

1. **Identity Theft**: Authenticated user 'A' trying to Create/Update user profile 'B'.
2. **Privilege Escalation**: Non-whitelisted user trying to set their role to 'Admin' or 'Editor'.
3. **Role Hijacking**: User 'A' updating their own role to 'Admin' after creation.
4. **Data Poisoning**: Sales record with 1MB string in student name.
5. **Orphaned Record**: Creating a sale without valid item IDs (skipped for now as item IDs are just strings).
6. **Financial Tampering**: Creating a sale with negative total amount.
7. **Bypassing Inventory**: Updating stock levels as a 'Viewer'.
8. **Malicious Settings**: Modifying `settings/sync` or `settings/customFields` as non-admin.
9. **Bulk Scrape**: Unauthorized 'list' on users collection.
10. **Shadow Fields**: Adding `isVerified: true` to a user profile.
11. **Timestamp Spoofing**: Setting `createdAt` to a future date instead of `request.time`.
12. **State Locking Breach**: Deleting a sale record as a 'Viewer' or 'Editor'.

## Test Runner (Logic Mapping)
- `users/{userId}`: `create` requires `request.auth.uid == userId`.
- `users/{userId}`: `role` must be 'Viewer'/'Editor' OR 'Admin' if whitelisted.
- `users/{userId}`: `update` restricted to whitelisted fields for non-admins.
- `pricing/current`: `write` requires `isAdmin() || isEditor()`.
- `sales/{saleId}`: `create` requires `isAdmin() || isEditor()`.
- `settings/{settingId}`: `write` requires `isAdmin()`.
