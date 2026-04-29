-- Ensure the default test account exists and has the expected password/rights
-- email: test@cartis.be
-- password: test123

DO $$
DECLARE
  v_user_id INTEGER;
  v_default_line_id INTEGER;
BEGIN
  SELECT id INTO v_default_line_id
  FROM production_lines
  WHERE code = 'ZK'
  ORDER BY id
  LIMIT 1;

  IF v_default_line_id IS NULL THEN
    SELECT id INTO v_default_line_id
    FROM production_lines
    ORDER BY id
    LIMIT 1;
  END IF;

  INSERT INTO users (email, password_hash, first_name, last_name, default_production_line_id, is_active)
  VALUES (
    'test@cartis.be',
    '$2a$10$Ct4XdaQG0dsh9otDqjC7TeECDJAgLS3EmfwstJ9gccY5XeJAVGNx6',
    'Test',
    'User',
    v_default_line_id,
    true
  )
  ON CONFLICT (email)
  DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    default_production_line_id = EXCLUDED.default_production_line_id,
    is_active = true,
    updated_at = CURRENT_TIMESTAMP
  RETURNING id INTO v_user_id;

  INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
  SELECT v_user_id, pl.id, true, true, true
  FROM production_lines pl
  WHERE pl.is_active = true
  ON CONFLICT (user_id, production_line_id)
  DO UPDATE SET
    can_view = true,
    can_edit = true,
    can_publish = true;
END $$;
