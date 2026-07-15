-- Fix user accounts whose default_production_line_id points at a production
-- line they have no rights for at all (the same onboarding mistake fixed in
-- insert_new_user.sql). Symptom in the app: note creation (and other edit
-- actions) fail right after login with
-- "Geen bewerkrechten op een of meer geselecteerde productielijnen",
-- and it only works after switching to a different production line.
--
-- Run the sections in order against the database (e.g. via Supabase SQL
-- editor or psql).

-- ---------------------------------------------------------------------------
-- 1. AUDIT: users whose default_production_line_id has NO matching rights
--    row at all (not even can_view). This is the broken state.
-- ---------------------------------------------------------------------------
SELECT
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.default_production_line_id AS broken_default_line_id,
  pl.code AS broken_default_line_code,
  (
    SELECT r2.production_line_id
    FROM user_production_line_rights r2
    WHERE r2.user_id = u.id AND r2.can_edit = true
    ORDER BY r2.production_line_id
    LIMIT 1
  ) AS suggested_default_line_id
FROM users u
LEFT JOIN production_lines pl ON pl.id = u.default_production_line_id
WHERE u.default_production_line_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_production_line_rights r
    WHERE r.user_id = u.id
      AND r.production_line_id = u.default_production_line_id
  )
ORDER BY u.last_name, u.first_name;

-- ---------------------------------------------------------------------------
-- 2. FIX: point default_production_line_id at the lowest production line the
--    user actually has can_edit = true on. Only touches accounts matching the
--    broken state above (default line has zero rights rows) — accounts whose
--    default line is merely view-only are left untouched, since that may be
--    intentional.
-- ---------------------------------------------------------------------------
UPDATE users u
SET default_production_line_id = (
  SELECT r.production_line_id
  FROM user_production_line_rights r
  WHERE r.user_id = u.id
    AND r.can_edit = true
  ORDER BY r.production_line_id
  LIMIT 1
)
WHERE u.default_production_line_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_production_line_rights r
    WHERE r.user_id = u.id
      AND r.production_line_id = u.default_production_line_id
  )
  AND EXISTS (
    SELECT 1
    FROM user_production_line_rights r
    WHERE r.user_id = u.id
      AND r.can_edit = true
  );

-- ---------------------------------------------------------------------------
-- 3. REVIEW (manual, informational only): users whose default line has no
--    rights row AND who have zero can_edit rights anywhere. These can't be
--    auto-fixed — they need rights granted (see insert_new_user.sql) before
--    they can create/edit notes at all.
-- ---------------------------------------------------------------------------
SELECT
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.default_production_line_id AS broken_default_line_id
FROM users u
WHERE u.default_production_line_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM user_production_line_rights r
    WHERE r.user_id = u.id
      AND r.production_line_id = u.default_production_line_id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM user_production_line_rights r
    WHERE r.user_id = u.id
      AND r.can_edit = true
  )
ORDER BY u.last_name, u.first_name;

-- ---------------------------------------------------------------------------
-- 4. VERIFY: re-run query 1 — it should now return zero rows (except users
--    listed in query 3, which need rights granted manually).
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- 5. FIX: "Geen bewerkrechten" on note creation for VIEW-ONLY users.
--
--    The current deployed backend requires can_edit = true on every
--    production line that is included in a new or updated note.  Users who
--    have can_view = true but can_edit = false therefore cannot save notes
--    for their own production line even though the UI lets them try.
--
--    This section grants can_edit on every row where can_view is already
--    true so those users can create and edit notes immediately, without
--    waiting for a backend redeploy.
--
--    NOTE: Once the backend code fix is deployed (note.routes.ts no longer
--    checks can_edit for note creation), you may set can_edit back to false
--    for purely view-only users if that matches your intended permissions.
-- ---------------------------------------------------------------------------

-- 5a. AUDIT: see who is affected
SELECT
  u.email,
  u.first_name,
  u.last_name,
  pl.code AS production_line_code,
  r.can_view,
  r.can_edit
FROM user_production_line_rights r
JOIN users u  ON u.id  = r.user_id
JOIN production_lines pl ON pl.id = r.production_line_id
WHERE r.can_view = true
  AND r.can_edit = false
ORDER BY u.last_name, u.first_name, pl.code;

-- 5b. FIX: grant can_edit wherever can_view is already granted
UPDATE user_production_line_rights
SET can_edit = true
WHERE can_view = true
  AND can_edit = false;
