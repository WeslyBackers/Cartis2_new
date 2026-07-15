-- Grant can_edit (and can_view) rights to wesly.backers@mow.vlaanderen.be
-- on every active production line.
--
-- Context: this user had can_view = true but can_edit = false (or no rights
-- row at all) for their default production line, which caused the backend to
-- return "Geen bewerkrechten op een of meer geselecteerde productielijnen"
-- whenever they tried to save a note in the dashboard.
--
-- This migration is idempotent: it can safely be re-run.

DO $$
DECLARE
  v_user_id INTEGER;
BEGIN
  SELECT id INTO v_user_id
  FROM users
  WHERE email = 'wesly.backers@mow.vlaanderen.be';

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'User wesly.backers@mow.vlaanderen.be not found – skipping.';
    RETURN;
  END IF;

  -- Insert or update rights for every active production line
  INSERT INTO user_production_line_rights (user_id, production_line_id, can_view, can_edit, can_publish)
  SELECT v_user_id, pl.id, true, true, false
  FROM production_lines pl
  WHERE pl.is_active = true
  ON CONFLICT (user_id, production_line_id)
  DO UPDATE SET
    can_view = true,
    can_edit = true;

  -- Ensure default_production_line_id points to a line the user can edit
  UPDATE users u
  SET default_production_line_id = (
    SELECT r.production_line_id
    FROM user_production_line_rights r
    WHERE r.user_id = v_user_id
      AND r.can_edit = true
    ORDER BY r.production_line_id
    LIMIT 1
  )
  WHERE u.id = v_user_id
    AND (
      u.default_production_line_id IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM user_production_line_rights r
        WHERE r.user_id = v_user_id
          AND r.production_line_id = u.default_production_line_id
          AND r.can_edit = true
      )
    );

  RAISE NOTICE 'Rights updated for wesly.backers@mow.vlaanderen.be (user_id = %)', v_user_id;
END $$;
