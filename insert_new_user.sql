-- 1. Insert the user
INSERT INTO users (email, password_hash, first_name, last_name, default_production_line_id, is_active)
VALUES (
  'ria.desnouck@mow.vlaanderen.be',
  '$2b$10$pNa4hORJWaIbjFciAQ/Hxe6nWqzpvfKf4UUmjRNALOlqy7zJ0Wnn.', -- password shs
  'Ria',
  'Desnouck',
  2,     -- default production line id (1=ZK, 2=IENC, 3=PILOT_ENC, 4=PUBL) -- IMPORTANT: must be one of the lines granted below!
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