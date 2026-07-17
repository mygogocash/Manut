import { Redirect, useLocalSearchParams } from "expo-router";

import { useAuth } from "@/features/auth/auth-provider";
import { SignInScreen } from "@/features/auth/sign-in-screen";

export default function SignInRoute() {
  const { isAuthenticated, isEmployeeOnly, user } = useAuth();
  const { returnTo } = useLocalSearchParams<{
    returnTo?: string | string[];
  }>();
  if (isAuthenticated) {
    return (
      <Redirect
        href={
          user?.mustChangePassword
            ? "/change-password"
            : isEmployeeOnly
              ? "/my-portal"
              : "/dashboard"
        }
      />
    );
  }
  return (
    <SignInScreen returnTo={Array.isArray(returnTo) ? returnTo[0] : returnTo} />
  );
}
