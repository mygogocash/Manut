"use client";

import { Loader2, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api-client";
import {
  type OverviewContent,
  updateOverviewContent,
} from "@/services/marketing-analytics.service";

export function OverviewManageDialog({
  open,
  onOpenChange,
  content,
  telcoNames,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  content: OverviewContent;
  telcoNames: string[];
  onSaved: (next: OverviewContent) => void;
}) {
  const [shared, setShared] = useState<OverviewContent["learningsShared"]>([]);
  const [perTelco, setPerTelco] = useState<Record<string, string>>({});
  const [headline, setHeadline] = useState("");
  const [body, setBody] = useState("");
  const [plays, setPlays] = useState<OverviewContent["macroPlays"]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }
    setShared(content.learningsShared.map((l) => ({ ...l })));
    // Per-telco learnings edited as newline-separated text, one row per telco.
    const pt: Record<string, string> = {};
    telcoNames.forEach((name) => {
      pt[name] = (content.learningsPerTelco[name] ?? []).join("\n");
    });
    setPerTelco(pt);
    setHeadline(content.macroHeadline);
    setBody(content.macroBody);
    setPlays(content.macroPlays.map((p) => ({ ...p })));
  }, [open, content, telcoNames]);

  async function save() {
    const learningsPerTelco: Record<string, string[]> = {};
    Object.entries(perTelco).forEach(([name, text]) => {
      const items = text
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      if (items.length > 0) {
        learningsPerTelco[name] = items;
      }
    });
    const next: OverviewContent = {
      learningsShared: shared
        .map((l) => ({ tag: l.tag.trim(), text: l.text.trim() }))
        .filter((l) => l.tag && l.text),
      learningsPerTelco,
      macroHeadline: headline.trim(),
      macroBody: body.trim(),
      macroPlays: plays
        .map((p) => ({
          step: p.step.trim(),
          title: p.title.trim(),
          text: p.text.trim(),
        }))
        .filter((p) => p.title && p.text),
    };
    try {
      setSaving(true);
      const res = await updateOverviewContent(next);
      toast.success("Overview content saved");
      onSaved(res.data);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`
          max-h-[90vh] overflow-y-auto
          sm:max-w-2xl
        `}
      >
        <DialogHeader>
          <DialogTitle>Edit overview content</DialogTitle>
        </DialogHeader>

        <div className="grid gap-5">
          {/* Shared learnings */}
          <section className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>Shared learnings</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShared((s) => [...s, { tag: "", text: "" }])}
              >
                <Plus className="mr-1 size-3.5" />
                Add
              </Button>
            </div>
            {shared.map((l, i) => (
              <div key={i} className="flex items-start gap-2">
                <Input
                  className="w-40"
                  placeholder="Tag"
                  value={l.tag}
                  onChange={(e) =>
                    setShared((s) =>
                      s.map((x, j) =>
                        j === i ? { ...x, tag: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Textarea
                  className="min-h-[38px] flex-1"
                  placeholder="Learning"
                  value={l.text}
                  onChange={(e) =>
                    setShared((s) =>
                      s.map((x, j) =>
                        j === i ? { ...x, text: e.target.value } : x,
                      ),
                    )
                  }
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShared((s) => s.filter((_, j) => j !== i))}
                >
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </div>
            ))}
          </section>

          {/* Per-telco learnings */}
          <section className="grid gap-2">
            <Label>Per-telco learnings</Label>
            <p className="text-muted-foreground text-xs">
              One learning per line. Leave blank for telcos with no learnings
              yet.
            </p>
            <div className="grid gap-3">
              {telcoNames.map((name) => (
                <div key={name} className="grid gap-1">
                  <Label className="text-xs font-normal">{name}</Label>
                  <Textarea
                    value={perTelco[name] ?? ""}
                    onChange={(e) =>
                      setPerTelco((p) => ({ ...p, [name]: e.target.value }))
                    }
                  />
                </div>
              ))}
            </div>
          </section>

          {/* Macro advice */}
          <section className="grid gap-2">
            <Label>Macro advice</Label>
            <Input
              placeholder="Headline"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
            />
            <Textarea
              placeholder="Body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-xs">Plays</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setPlays((p) => [...p, { step: "", title: "", text: "" }])
                }
              >
                <Plus className="mr-1 size-3.5" />
                Add play
              </Button>
            </div>
            {plays.map((p, i) => (
              <div
                key={i}
                className="border-border grid gap-2 rounded-md border p-2"
              >
                <div className="flex gap-2">
                  <Input
                    className="w-28"
                    placeholder="Step"
                    value={p.step}
                    onChange={(e) =>
                      setPlays((s) =>
                        s.map((x, j) =>
                          j === i ? { ...x, step: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Input
                    className="flex-1"
                    placeholder="Title"
                    value={p.title}
                    onChange={(e) =>
                      setPlays((s) =>
                        s.map((x, j) =>
                          j === i ? { ...x, title: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPlays((s) => s.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="text-destructive size-4" />
                  </Button>
                </div>
                <Textarea
                  placeholder="Play detail"
                  value={p.text}
                  onChange={(e) =>
                    setPlays((s) =>
                      s.map((x, j) =>
                        j === i ? { ...x, text: e.target.value } : x,
                      ),
                    )
                  }
                />
              </div>
            ))}
          </section>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-1 size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
