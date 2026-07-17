import type { E2EEnvironment } from "./environment";

interface CreateUserInput {
  email: string;
  password: string;
  name: string;
}

interface CreatedUser {
  id: string;
  email: string;
}

function adminHeaders(environment: E2EEnvironment): HeadersInit {
  return {
    apikey: environment.supabaseServiceRoleKey,
    Authorization: `Bearer ${environment.supabaseServiceRoleKey}`,
    "Content-Type": "application/json",
  };
}

export async function createConfirmedUser(
  environment: E2EEnvironment,
  input: CreateUserInput,
): Promise<CreatedUser> {
  const response = await fetch(
    `${environment.supabaseUrl}/auth/v1/admin/users`,
    {
      method: "POST",
      headers: adminHeaders(environment),
      redirect: "error",
      body: JSON.stringify({
        email: input.email,
        password: input.password,
        email_confirm: true,
        user_metadata: {
          name: input.name,
          e2e_project: "manut-intranet-e2e",
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(
      `Supabase Admin createUser failed with status ${response.status}.`,
    );
  }

  const body = (await response.json()) as {
    id?: unknown;
    email?: unknown;
    user?: { id?: unknown; email?: unknown };
  };
  const user = body.user ?? body;
  if (typeof user.id !== "string") {
    throw new Error("Supabase Admin createUser returned no user id.");
  }

  return {
    id: user.id,
    email: typeof user.email === "string" ? user.email : input.email,
  };
}

export async function deleteUser(
  environment: E2EEnvironment,
  userId: string,
): Promise<void> {
  const response = await fetch(
    `${environment.supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: adminHeaders(environment),
      redirect: "error",
    },
  );

  if (!response.ok && response.status !== 404) {
    throw new Error(
      `Supabase Admin deleteUser failed with status ${response.status}.`,
    );
  }
}
