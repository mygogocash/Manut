"use client";

import { Cake, Loader2, PartyPopper } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/dashboard/section-card";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/auth-provider";
import type { DashboardUpcomingBirthday } from "@/services/dashboard.service";
import * as messageService from "@/services/message.service";

// All tokens below are defined in globals.css @theme inline (--color-*),
// so each confetti piece reliably renders a colour. (bronze/gold are not
// real Tailwind tokens in this theme — primary-light is the gold tone.)
const CONFETTI_COLORS = [
  "bg-primary-light",
  "bg-primary",
  "bg-success",
  "bg-info",
  "bg-warning",
  "bg-destructive",
] as const;

function BirthdayConfetti({ active }: { active: boolean }) {
  if (!active) return null;

  const pieces = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    left: `${(i * 17 + 7) % 100}%`,
    delay: `${(i % 6) * 0.08}s`,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    rotate: `${(i * 37) % 360}deg`,
  }));

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className={cn(
            `
              birthday-confetti-piece absolute top-0 block size-2 rounded-sm
              opacity-90
            `,
            piece.color,
          )}
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            transform: `rotate(${piece.rotate})`,
          }}
        />
      ))}
    </div>
  );
}

function formatBirthdayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function greetingFor(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? name;
  return `Happy birthday, ${first}! 🎉 Hope you have a wonderful day.`;
}

export function BirthdayComingSoonWidget({
  birthdays,
}: {
  birthdays: DashboardUpcomingBirthday[];
}) {
  const { user, hasPermission } = useAuth();
  const [celebrate, setCelebrate] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const canMessage =
    hasPermission("messages:create") && hasPermission("messages:read");

  useEffect(() => {
    if (birthdays.length === 0) return;
    setCelebrate(true);
    const timer = window.setTimeout(() => setCelebrate(false), 1800);
    return () => window.clearTimeout(timer);
  }, [birthdays.length]);

  if (birthdays.length === 0) return null;

  async function sendHbd(recipient: DashboardUpcomingBirthday) {
    if (!canMessage) {
      toast.error("You do not have permission to send messages");
      return;
    }
    if (recipient.id === user?.id) {
      toast.message("That's your birthday — enjoy the celebration!");
      return;
    }

    setSendingId(recipient.id);
    try {
      const channelRes = await messageService.createDirectMessage([
        recipient.id,
      ]);
      await messageService.sendMessage(channelRes.data.id, {
        content: greetingFor(recipient.name),
      });
      toast.success(
        `Birthday greeting sent to ${recipient.name.split(/\s+/)[0]}`,
      );
    } catch {
      toast.error("Failed to send birthday greeting");
    } finally {
      setSendingId(null);
    }
  }

  return (
    <div className="relative">
      <BirthdayConfetti active={celebrate} />
      <SectionCard
        title="Birthday coming soon"
        description="Celebrate teammates with birthdays in the next few days."
        icon={<Cake className="size-4" aria-hidden />}
        className={cn(
          celebrate && "birthday-widget-celebrate border-primary/40 shadow-md",
        )}
      >
        <div className="flex flex-col gap-2.5">
          {birthdays.map((person) => {
            const isSelf = person.id === user?.id;
            const isSending = sendingId === person.id;
            return (
              <div
                key={person.id}
                className={`
                  border-border/60 bg-muted/10 flex flex-wrap items-center gap-3
                  rounded-xl border px-3 py-3
                `}
              >
                <Avatar
                  name={person.name}
                  src={person.avatarUrl}
                  className="size-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-foreground text-sm font-semibold">
                      {person.name}
                    </p>
                    <Badge variant="gold" className="text-[10px]">
                      {person.label}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    {formatBirthdayDate(person.birthdayDate)}
                    {person.department ? ` · ${person.department}` : ""}
                  </p>
                </div>
                {canMessage && !isSelf ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    disabled={isSending}
                    onClick={() => void sendHbd(person)}
                  >
                    {isSending ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    ) : (
                      <PartyPopper className="size-3.5" aria-hidden />
                    )}
                    Send HBD
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}
