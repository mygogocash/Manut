export const AUTH_MIN_PASSWORD_LENGTH = 8;

export interface AuthEmailInput {
  email: string;
}

export interface ResetPasswordFormInput {
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordFormInput extends ResetPasswordFormInput {
  currentPassword: string;
}

export interface AuthValidationIssue {
  path: keyof ChangePasswordFormInput | "email";
  message: string;
}

export type AuthSchemaResult<T> =
  | { success: true; data: T }
  | { success: false; issues: AuthValidationIssue[] };

export interface AuthSchema<T> {
  safeParse(value: unknown): AuthSchemaResult<T>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function stringField(
  value: Record<string, unknown> | undefined,
  key: string,
): string {
  return typeof value?.[key] === "string" ? value[key] : "";
}

function passwordIssues(
  newPassword: string,
  confirmPassword: string,
): AuthValidationIssue[] {
  const issues: AuthValidationIssue[] = [];
  if (newPassword.length < AUTH_MIN_PASSWORD_LENGTH) {
    issues.push({
      path: "newPassword",
      message: `New password must be at least ${AUTH_MIN_PASSWORD_LENGTH} characters.`,
    });
  }
  if (!confirmPassword) {
    issues.push({
      path: "confirmPassword",
      message: "Confirm your new password.",
    });
  } else if (newPassword !== confirmPassword) {
    issues.push({
      path: "confirmPassword",
      message: "Passwords do not match.",
    });
  }
  return issues;
}

export const authEmailSchema: AuthSchema<AuthEmailInput> = {
  safeParse(value) {
    const email = stringField(record(value), "email").trim();
    if (
      !email ||
      email.length > 320 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return {
        success: false,
        issues: [{ path: "email", message: "Enter a valid email address." }],
      };
    }
    return { success: true, data: { email } };
  },
};

export const resetPasswordSchema: AuthSchema<ResetPasswordFormInput> = {
  safeParse(value) {
    const input = record(value);
    const data = {
      newPassword: stringField(input, "newPassword"),
      confirmPassword: stringField(input, "confirmPassword"),
    };
    const issues = passwordIssues(data.newPassword, data.confirmPassword);
    return issues.length > 0
      ? { success: false, issues }
      : { success: true, data };
  },
};

export const changePasswordSchema: AuthSchema<ChangePasswordFormInput> = {
  safeParse(value) {
    const input = record(value);
    const data = {
      currentPassword: stringField(input, "currentPassword"),
      newPassword: stringField(input, "newPassword"),
      confirmPassword: stringField(input, "confirmPassword"),
    };
    const issues = passwordIssues(data.newPassword, data.confirmPassword);
    if (!data.currentPassword) {
      issues.unshift({
        path: "currentPassword",
        message: "Enter your current password.",
      });
    }
    return issues.length > 0
      ? { success: false, issues }
      : { success: true, data };
  },
};
