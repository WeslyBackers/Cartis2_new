-- 1. Insert the user
INSERT INTO users (email, password_hash, first_name, last_name, default_production_line_id, is_active)
VALUES (
  'newuser@example.com',
  '$2a$10$N9qo8uLOickgx2ZMRZoMye7FRNvk7v7DqKvXjYKw.X8e8OxV5pB8S', -- password: admin123
  'Voornaam',
  'Achternaam',
  1,     -- default production line id (1=ZK, 2=IENC, 3=PILOT_ENC, 4=PUBL)
  true
);

-- 2. Grant rights per production line (repeat for each line the user needs)
INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
VALUES (
  (SELECT id FROM users WHERE email = 'newuser@example.com'),
  4,      -- production_line_id
  true,   -- can_view
  true,   -- can_edit
  false   -- can_publish
);