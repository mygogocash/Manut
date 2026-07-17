import { Button, StatusMessage, TextField } from "@manut/ui";
import type { TextInputProps } from "react-native";

interface AuthFieldProps extends TextInputProps {
  label: string;
}

export function AuthField(props: AuthFieldProps) {
  return <TextField {...props} />;
}

interface AuthButtonProps {
  label: string;
  pendingLabel: string;
  pending?: boolean;
  disabled?: boolean;
  onPress: () => void | Promise<void>;
}

export function AuthButton(props: AuthButtonProps) {
  return <Button {...props} />;
}

export function AuthMessage({
  children,
  tone = "error",
}: {
  children: string;
  tone?: "error" | "success";
}) {
  return <StatusMessage tone={tone}>{children}</StatusMessage>;
}
