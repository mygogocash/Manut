"use client";

import { Info, Phone, ShieldCheck, User } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { ApiError } from "@/lib/api-client";
import { getMyProfile, updateMyProfile } from "@/services/my-portal.service";

interface ProfileTabProps {
  user: {
    name?: string;
    email?: string;
    avatarUrl?: string | null;
    department?: string | null;
    jobTitle?: string | null;
    entity?: { name: string; code: string } | null;
  } | null;
}

export function ProfileTab({ user }: ProfileTabProps) {
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const [phone, setPhone] = useState<string | null>(null);
  const [phonePublic, setPhonePublic] = useState<boolean>(false);
  const [loadingPrivacy, setLoadingPrivacy] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  const fetchPrivacy = useCallback(async () => {
    try {
      setLoadingPrivacy(true);
      const res = await getMyProfile();
      setPhone(res.data.profile.phone);
      setPhonePublic(res.data.profile.phonePublic);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to load privacy settings";
      toast.error(msg);
    } finally {
      setLoadingPrivacy(false);
    }
  }, []);

  useEffect(() => {
    void fetchPrivacy();
  }, [fetchPrivacy]);

  const handleTogglePhonePublic = async (next: boolean) => {
    const previous = phonePublic;
    setPhonePublic(next);
    setSavingPrivacy(true);
    try {
      await updateMyProfile({ phonePublic: next });
      toast.success(
        next
          ? "Phone number is now visible in the directory"
          : "Phone number is now hidden from the directory",
      );
    } catch (err) {
      setPhonePublic(previous);
      const msg =
        err instanceof ApiError
          ? err.message
          : "Failed to update privacy setting";
      toast.error(msg);
    } finally {
      setSavingPrivacy(false);
    }
  };

  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <User className="size-4" />
            Your Profile
          </CardTitle>
          <CardDescription>
            Your account information managed by your organization
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex items-center gap-5">
            <Avatar className="size-16">
              {user?.avatarUrl ? (
                <AvatarImage src={user.avatarUrl} alt={user.name ?? "User"} />
              ) : null}
              <AvatarFallback
                className="text-sidebar-primary-foreground text-lg font-bold"
                style={{
                  background:
                    "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)))",
                }}
              >
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-foreground text-lg font-semibold">
                {user?.name ?? "—"}
              </p>
              <p className="text-muted-foreground text-sm">
                {user?.email ?? "—"}
              </p>
            </div>
          </div>

          <Separator />

          <div
            className={`
              grid gap-4
              sm:grid-cols-2
            `}
          >
            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">Full Name</Label>
              <Input
                value={user?.name ?? ""}
                readOnly
                className="bg-muted/50 cursor-default text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">Email</Label>
              <Input
                value={user?.email ?? ""}
                readOnly
                className="bg-muted/50 cursor-default text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">
                Department
              </Label>
              <Input
                value={user?.department ?? "Not assigned"}
                readOnly
                className="bg-muted/50 cursor-default text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label className="text-muted-foreground text-xs">Job Title</Label>
              <Input
                value={user?.jobTitle ?? "Not assigned"}
                readOnly
                className="bg-muted/50 cursor-default text-sm"
              />
            </div>
            <div
              className={`
                flex flex-col gap-1.5
                sm:col-span-2
              `}
            >
              <Label className="text-muted-foreground text-xs">Entity</Label>
              <Input
                value={
                  user?.entity
                    ? `${user.entity.name} (${user.entity.code})`
                    : "Not assigned"
                }
                readOnly
                className="bg-muted/50 cursor-default text-sm"
              />
            </div>
          </div>

          <Alert>
            <Info className="size-4" />
            <AlertDescription className="text-xs leading-relaxed">
              Profile information is managed by your HR department. Please
              contact HR to request any changes to your profile.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="size-4" />
            Privacy
          </CardTitle>
          <CardDescription>
            Choose what colleagues outside HR can see about you
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <div
                className={`
                  bg-primary/10 text-primary flex size-9 shrink-0 items-center
                  justify-center rounded-lg
                `}
              >
                <Phone className="size-4" aria-hidden />
              </div>
              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">
                  Show my phone number in the directory
                </p>
                <p
                  className={`
                    text-muted-foreground mt-0.5 text-xs leading-relaxed
                  `}
                >
                  {phone
                    ? `Colleagues will see ${phone} on your directory profile. HR can always see this regardless of the toggle.`
                    : "Add a phone number to your profile (via HR) before this takes effect. HR can always see this regardless of the toggle."}
                </p>
              </div>
            </div>
            <Switch
              checked={phonePublic}
              disabled={loadingPrivacy || savingPrivacy}
              onCheckedChange={handleTogglePhonePublic}
              aria-label="Show phone number in directory"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
