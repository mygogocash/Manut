import type { ColumnDef } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { Field } from "@/components/field";
import { PageScreen } from "@/components/page-screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Text } from "@/components/ui/text";
import { Textarea } from "@/components/ui/textarea";
import { useApiQuery } from "@/hooks/use-api-query";
import { api, ApiError } from "@/lib/api-client";
import { BRAND } from "@/lib/brand";
import { unwrapList } from "@/lib/list";
import { queryKeys } from "@/lib/query-keys";
import { toast } from "@/lib/toast";

type TravelRequest = {
  id: string;
  requestCode: string;
  status: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  purpose?: string;
  employee?: { name: string };
  viewerCanAct?: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function statusVariant(status: string): "secondary" | "success" | "warning" | "destructive" | "outline" {
  const s = status.toLowerCase();
  if (s.includes("approved") || s.includes("completed")) return "success";
  if (s.includes("reject") || s.includes("cancel")) return "destructive";
  if (s.includes("pending") || s.includes("submitted")) return "warning";
  return "outline";
}

const columns: ColumnDef<TravelRequest>[] = [
  { accessorKey: "requestCode", header: "Code" },
  {
    accessorFn: (row) => `${row.origin} → ${row.destination}`,
    header: "Route",
  },
  {
    accessorFn: (row) => `${row.departureDate} – ${row.returnDate}`,
    header: "Dates",
  },
  { accessorFn: (row) => row.employee?.name ?? "—", header: "Employee" },
  {
    id: "status",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={statusVariant(row.original.status)}>{row.original.status}</Badge>
    ),
  },
];

function RequestTravelDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [departureDate, setDepartureDate] = useState(todayIso);
  const [returnDate, setReturnDate] = useState(todayIso);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setOrigin("");
    setDestination("");
    setPurpose("");
    setDepartureDate(todayIso());
    setReturnDate(todayIso());
    setError(null);
  }, [open]);

  async function submit() {
    if (!origin.trim() || !destination.trim() || !purpose.trim()) {
      setError("Origin, destination, and purpose are required");
      return;
    }
    if (returnDate < departureDate) {
      setError("Return date must not be before departure");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.post("/travel/requests", {
        origin: origin.trim(),
        destination: destination.trim(),
        purpose: purpose.trim(),
        departureDate,
        returnDate,
      });
      onOpenChange(false);
      toast("Travel request submitted", "success");
      onCreated();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Request travel"
        description="File a trip for approval. You can refine details after submitting."
        footer={
          <DialogFooter>
            <Button variant="outline" disabled={busy} onPress={() => onOpenChange(false)}>
              <Text>Cancel</Text>
            </Button>
            <Button disabled={busy} onPress={() => void submit()}>
              <Text>{busy ? "Submitting…" : "Submit request"}</Text>
            </Button>
          </DialogFooter>
        }
      >
        <Field label="Origin">
          <Input accessibilityLabel="Origin" placeholder="City or airport" value={origin} onChangeText={setOrigin} />
        </Field>
        <Field label="Destination">
          <Input
            accessibilityLabel="Destination"
            placeholder="City or airport"
            value={destination}
            onChangeText={setDestination}
          />
        </Field>
        <Field label="Departure">
          <Input
            accessibilityLabel="Departure date"
            autoCapitalize="none"
            placeholder="YYYY-MM-DD"
            value={departureDate}
            onChangeText={setDepartureDate}
          />
        </Field>
        <Field label="Return">
          <Input
            accessibilityLabel="Return date"
            autoCapitalize="none"
            placeholder="YYYY-MM-DD"
            value={returnDate}
            onChangeText={setReturnDate}
          />
        </Field>
        <Field label="Purpose">
          <Textarea
            accessibilityLabel="Purpose"
            placeholder="Why are you travelling?"
            value={purpose}
            onChangeText={setPurpose}
          />
        </Field>
        {error ? <Text className="text-[13px] text-destructive">{error}</Text> : null}
      </DialogContent>
    </Dialog>
  );
}

export default function TravelPage() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const query = useApiQuery<{ data: TravelRequest[] }>(queryKeys.travel.requests(), "/travel/requests");
  const items = unwrapList<TravelRequest>(query.data);

  if (query.isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color={BRAND.ink} />
      </View>
    );
  }

  if (query.error) {
    return (
      <PageScreen title="Travel">
        <View className="overflow-hidden rounded-xl border border-border bg-card">
          <EmptyState
            variant="error"
            heading="Couldn't load travel requests"
            description={query.error.message}
            actionLabel="Try again"
            onAction={() => {
              void query.refetch();
            }}
          />
        </View>
      </PageScreen>
    );
  }

  return (
    <>
      <PageScreen
        title="Travel"
        subtitle="Request trips and track approvals."
        scroll={false}
        actions={
          <Button size="sm" onPress={() => setOpen(true)}>
            <Plus size={14} color={BRAND.paper} />
            <Text>Request travel</Text>
          </Button>
        }
      >
        <DataTable
          columns={columns}
          data={items}
          empty="No travel requests yet"
          emptyDescription="Tap Request travel to file your first trip."
        />
      </PageScreen>
      <RequestTravelDialog
        open={open}
        onOpenChange={setOpen}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: queryKeys.travel.requests() });
        }}
      />
    </>
  );
}
