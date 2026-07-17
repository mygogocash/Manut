DO $$
BEGIN
  IF to_regclass('public.legal_signatures') IS NULL THEN
    RAISE EXCEPTION 'required table public.legal_signatures is missing';
  END IF;

  IF to_regclass('public.role_permissions') IS NULL THEN
    RAISE EXCEPTION 'required table public.role_permissions is missing';
  END IF;
END
$$;
