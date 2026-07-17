DO $guard$
DECLARE
  guarded_project_name TEXT;
BEGIN
  IF to_regclass('e2e_control.project_guard') IS NULL THEN
    RAISE EXCEPTION
      'E2E reset refused: dedicated-project guard is not installed';
  END IF;

  EXECUTE
    'SELECT project_name FROM e2e_control.project_guard WHERE singleton = TRUE'
    INTO guarded_project_name;

  IF guarded_project_name IS DISTINCT FROM 'manut-intranet-e2e' THEN
    RAISE EXCEPTION
      'E2E reset refused: project guard does not name manut-intranet-e2e';
  END IF;
END
$guard$;

DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

