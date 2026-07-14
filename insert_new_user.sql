-- 1. Insert the user
INSERT INTO users (email, password_hash, first_name, last_name, default_production_line_id, is_active)
VALUES (
  'wesly.backers@mow.vlaanderen.be',
  '$2b$10$hrBa15K9pAJGYRcJ/BvbfuE2BwvQV9VjKGIWcoaOskhqyK1/KPyXK', -- password: admin123
  'Wesly',
  'Backers',
  2,     -- default production line id (1=ZK, 2=IENC, 3=PILOT_ENC, 4=PUBL)
  true
);

-- 2. Grant rights per production line (repeat for each line the user needs)
INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
VALUES (
  (SELECT id FROM users WHERE email = 'wesly.backers@mow.vlaanderen.be'),
  4,      -- production_line_id
  true,   -- can_view
  true,   -- can_edit
  true   -- can_publish
);

-- 3. Grant rights per production line (repeat for each line the user needs)
INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
VALUES (
  (SELECT id FROM users WHERE email = 'wesly.backers@mow.vlaanderen.be'),
  1,      -- production_line_id
  true,   -- can_view
  true,   -- can_edit
  true   -- can_publish
);

-- 3. Grant rights per production line (repeat for each line the user needs)
INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
VALUES (
  (SELECT id FROM users WHERE email = 'wesly.backers@mow.vlaanderen.be'),
  3,      -- production_line_id
  true,   -- can_view
  true,   -- can_edit
  true   -- can_publish
);