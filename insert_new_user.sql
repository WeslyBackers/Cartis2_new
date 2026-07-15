-- Onboarding template: new user + production line rights
--
-- HOW TO USE:
--   1. Replace the email/name/password hash below.
--   2. Add one INSERT INTO user_production_line_rights per production line
--      the user needs (1=ZK, 2=IENC, 3=PILOT_ENC, 4=PUBL).
--   3. Run the final UPDATE step as-is. It automatically sets
--      default_production_line_id to a line the user actually has edit
--      rights on (preferring the lowest production_line_id), so the
--      "standard"/default line can never end up pointing at a line the user
--      has no rights for. Do NOT hardcode default_production_line_id in
--      step 1 anymore.
--
-- Why this matters: previously default_production_line_id was hardcoded in
-- step 1 and had to be manually kept in sync with the rights granted below.
-- Any mismatch (e.g. default set to line 1 while rights were only granted
-- for lines 2-4) causes the app to select a line the user cannot edit,
-- breaking actions like note creation with "Geen bewerkrechten..." errors
-- right after login. The UPDATE at the end removes that failure mode.

-- 1. Insert the user (default_production_line_id left NULL, fixed by the UPDATE below)
INSERT INTO users (email, password_hash, first_name, last_name, default_production_line_id, is_active)
VALUES (
  'ria.desnouck@mow.vlaanderen.be',
  '$2b$10$pNa4hORJWaIbjFciAQ/Hxe6nWqzpvfKf4UUmjRNALOlqy7zJ0Wnn.', -- password shs
  'Ria',
  'Desnouck',
  NULL,  -- set automatically by the UPDATE in step 5, based on the rights granted below
  true
);

-- 2. Grant rights per production line (repeat for each line the user needs)
INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
VALUES (
  (SELECT id FROM users WHERE email = 'ria.desnouck@mow.vlaanderen.be'),
  2,      -- production_line_id
  true,   -- can_view
  true,   -- can_edit
  true   -- can_publish
);

-- 3. Grant rights per production line (repeat for each line the user needs)
INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
VALUES (
  (SELECT id FROM users WHERE email = 'ria.desnouck@mow.vlaanderen.be'),
  3,      -- production_line_id
  true,   -- can_view
  true,   -- can_edit
  true   -- can_publish
);

-- 4. Grant rights per production line (repeat for each line the user needs)
INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
VALUES (
  (SELECT id FROM users WHERE email = 'ria.desnouck@mow.vlaanderen.be'),
  4,      -- production_line_id
  true,   -- can_view
  true,   -- can_edit
  true   -- can_publish
);

-- 5. Set the default/"standard" production line to one the user actually has
--    edit rights on (lowest production_line_id among the granted edit rights).
--    Safe to run even if step 1 already set a value manually.
UPDATE users u
SET default_production_line_id = (
  SELECT r.production_line_id
  FROM user_production_line_rights r
  WHERE r.user_id = u.id
    AND r.can_edit = true
  ORDER BY r.production_line_id
  LIMIT 1
)
WHERE u.email = 'ria.desnouck@mow.vlaanderen.be';