"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  createPayslipForRun,
  listPayrollRuns,
  type PayrollRun,
} from "@/services/payroll.service";
import { listUsers, type UserListItem } from "@/services/user.service";

// Bilingual labels match HR's Thai payroll template (Payslip.docx).
// Values get persisted in `Payslip.allowances` / `Payslip.deductions`
// as a {code: amount} JSON map — same shape the bulk importer uses.
interface CodeRow {
  code: string;
  thai: string;
  english: string;
}

const SALARY_FIELD: CodeRow = {
  code: "baseSalary",
  thai: "เงินเดือน",
  english: "Salary",
};

// Statutory deductions HR's template surfaces above the per-code grid.
const STATUTORY_DEDUCTIONS: CodeRow[] = [
  { code: "ssf", thai: "ประกันสังคม", english: "Social Security (SSF)" },
  {
    code: "wht40_1",
    thai: "หัก ณ ที่จ่าย 40(1)",
    english: "Withholding tax 40(1)",
  },
  {
    code: "wht40_2",
    thai: "หัก ณ ที่จ่าย 40(2)",
    english: "Withholding tax 40(2)",
  },
];

const ALLOWANCE_CODES: CodeRow[] = [
  { code: "overtime", thai: "ค่าล่วงเวลา", english: "Overtime" },
  { code: "meal", thai: "ค่าอาหาร", english: "Meal" },
  { code: "phone", thai: "ค่าโทรศัพท์", english: "Phone" },
  { code: "travel", thai: "ค่าเดินทาง", english: "Travel" },
  { code: "severance", thai: "เงินชดเชยเลิกจ้าง", english: "Severance" },
  { code: "A002", thai: "ค่าคอมมิชชั่น", english: "Commission" },
  { code: "A003", thai: "โบนัส", english: "Bonus" },
  { code: "A004", thai: "เงินเพิ่มพิเศษ", english: "Special bonus" },
  {
    code: "A005",
    thai: "ค่าเบี้ยเลี้ยง / ค่าครองชีพ",
    english: "Per diem / COLA",
  },
  { code: "A006", thai: "ค่ารักษาพยาบาล", english: "Medical" },
  { code: "A007", thai: "ค่าที่พักอาศัย", english: "Housing" },
  { code: "A008", thai: "ค่าตอบแทนกรรมการ", english: "Director fee" },
  { code: "A009", thai: "ค่าสวัสดิการอื่น", english: "Other benefit" },
  { code: "A010", thai: "ค่าตำแหน่ง", english: "Position allowance" },
  { code: "A011", thai: "ค่าวิชาชีพ", english: "Professional allowance" },
  { code: "A012", thai: "ภาษีที่บริษัทออกให้", english: "Company-paid tax" },
  { code: "A013", thai: "ค่ากะ", english: "Shift allowance" },
  { code: "A014", thai: "ค่าควบกะ", english: "Combined shift" },
  { code: "A015", thai: "เบี้ยขยัน", english: "Diligence bonus" },
  { code: "A016", thai: "รางวัล", english: "Reward" },
  { code: "A020", thai: "คืนเงินวันลาคงเหลือ", english: "Leave compensation" },
];

const DEDUCTION_CODES: CodeRow[] = [
  { code: "other", thai: "เงินหักอื่นๆ", english: "Other deduction" },
  { code: "D001", thai: "หักขาด / ลา / มาสาย", english: "Absence / late" },
  { code: "D003", thai: "เงินประกัน", english: "Insurance" },
  { code: "D004", thai: "เงินกู้ยืม กยศ. / กรอ.", english: "Student loan" },
  { code: "D005", thai: "กองทุนสำรองเลี้ยงชีพ", english: "Provident fund" },
  { code: "D006", thai: "กบข. / กสจ.", english: "Government pension" },
  { code: "D007", thai: "หักมาสาย / กลับก่อน", english: "Late / early leave" },
  { code: "D008", thai: "หักไม่มาทำงาน", english: "Absence" },
  { code: "D009", thai: "หักลาไม่รับค่าจ้าง", english: "Unpaid leave" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fires after a payslip lands so the parent table can refetch. */
  onCreated: () => void;
}

function emptyMap(rows: CodeRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) out[r.code] = "";
  return out;
}

function sumStrings(map: Record<string, string>): number {
  let total = 0;
  for (const v of Object.values(map)) {
    const n = Number(v);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

function mapToNumeric(
  map: Record<string, string>,
): Record<string, number> | undefined {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) {
    if (v === "") continue;
    const n = Number(v);
    if (Number.isFinite(n) && n !== 0) out[k] = n;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export function PayslipCreateDialog({ open, onOpenChange, onCreated }: Props) {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [employees, setEmployees] = useState<UserListItem[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [saving, setSaving] = useState(false);

  const [runId, setRunId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [currency, setCurrency] = useState("THB");
  const [baseSalary, setBaseSalary] = useState("");
  const [statutory, setStatutory] = useState<Record<string, string>>(() =>
    emptyMap(STATUTORY_DEDUCTIONS),
  );
  const [allowances, setAllowances] = useState<Record<string, string>>(() =>
    emptyMap(ALLOWANCE_CODES),
  );
  const [deductions, setDeductions] = useState<Record<string, string>>(() =>
    emptyMap(DEDUCTION_CODES),
  );

  // Load draft runs + employees when the dialog opens. Filtering runs
  // to "draft" matches the server-side guard in `createPayslip`; HR
  // never wants to add slips to a frozen run from this form.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingMeta(true);
    Promise.all([
      listPayrollRuns({ status: "draft", limit: 100 }).catch(() => null),
      listUsers({ limit: 500 }).catch(() => null),
    ])
      .then(([runRes, userRes]) => {
        if (cancelled) return;
        if (runRes) setRuns(runRes.data);
        if (userRes) setEmployees(userRes.data);
      })
      .finally(() => {
        if (!cancelled) setLoadingMeta(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reset form fields when the dialog re-opens so a previous draft
  // doesn't leak into the next slip's create flow.
  useEffect(() => {
    if (open) return;
    setRunId("");
    setEmployeeId("");
    setCurrency("THB");
    setBaseSalary("");
    setStatutory(emptyMap(STATUTORY_DEDUCTIONS));
    setAllowances(emptyMap(ALLOWANCE_CODES));
    setDeductions(emptyMap(DEDUCTION_CODES));
  }, [open]);

  const baseNum = Number(baseSalary);
  const allowanceTotal = useMemo(() => sumStrings(allowances), [allowances]);
  const statutoryTotal = useMemo(() => sumStrings(statutory), [statutory]);
  const deductionTotal = useMemo(() => sumStrings(deductions), [deductions]);
  const totalDeductions = statutoryTotal + deductionTotal;
  const gross = Number.isFinite(baseNum) ? baseNum + allowanceTotal : 0;
  const net = gross - totalDeductions;

  function setRow(
    list: Record<string, string>,
    setList: (next: Record<string, string>) => void,
    code: string,
    value: string,
  ) {
    setList({ ...list, [code]: value });
  }

  async function handleSave() {
    if (!runId) {
      toast.error("Pick a payroll run");
      return;
    }
    if (!employeeId) {
      toast.error("Pick an employee");
      return;
    }
    if (!Number.isFinite(baseNum) || baseNum < 0) {
      toast.error("Salary must be a non-negative number");
      return;
    }
    // Statutory deductions live alongside the per-code deductions in
    // the same JSON map so the rollup math sees one number per row.
    const mergedDeductions: Record<string, number> = {};
    const stat = mapToNumeric(statutory);
    const ded = mapToNumeric(deductions);
    if (stat) Object.assign(mergedDeductions, stat);
    if (ded) Object.assign(mergedDeductions, ded);

    try {
      setSaving(true);
      await createPayslipForRun(runId, {
        employeeId,
        baseSalary: baseNum,
        allowances: mapToNumeric(allowances),
        deductions:
          Object.keys(mergedDeductions).length > 0
            ? mergedDeductions
            : undefined,
        currency: currency.trim().toUpperCase() || "THB",
      });
      toast.success("Payslip created");
      onCreated();
      onOpenChange(false);
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to create payslip";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent
        className={`
          max-h-[92vh] overflow-y-auto
          sm:max-w-3xl
        `}
      >
        <DialogHeader>
          <DialogTitle>New payslip</DialogTitle>
          <DialogDescription>
            Build a payslip with HR&rsquo;s canonical Thai payroll codes. Run +
            employee + salary are required; every other field is optional.
            Server rolls up gross / net from the parts.
          </DialogDescription>
        </DialogHeader>

        {loadingMeta ? (
          <div className="text-muted-foreground py-12 text-center text-xs">
            <Loader2 className="mx-auto mb-2 size-4 animate-spin" />
            Loading runs &amp; employees…
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <section className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Label className="text-xs">Payroll run *</Label>
                <Select value={runId} onValueChange={setRunId}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Pick a draft run" />
                  </SelectTrigger>
                  <SelectContent>
                    {runs.length === 0 ? (
                      <SelectItem value="__empty__" disabled>
                        No draft runs
                      </SelectItem>
                    ) : (
                      runs.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.period} — {r.entity?.name ?? "—"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Currency *</Label>
                <Input
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                  maxLength={4}
                  className="mt-1 h-9 text-xs uppercase"
                />
              </div>
              <div className="col-span-3">
                <Label className="text-xs">Employee *</Label>
                <Select value={employeeId} onValueChange={setEmployeeId}>
                  <SelectTrigger className="mt-1 h-9 text-xs">
                    <SelectValue placeholder="Pick an employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.name} {u.email ? `(${u.email})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            <Section title="ข้อมูลเงินเดือน / Salary &amp; statutory">
              <FieldRow
                row={SALARY_FIELD}
                value={baseSalary}
                onChange={setBaseSalary}
                accent="positive"
              />
              {STATUTORY_DEDUCTIONS.map((row) => (
                <FieldRow
                  key={row.code}
                  row={row}
                  value={statutory[row.code] ?? ""}
                  onChange={(v) => setRow(statutory, setStatutory, row.code, v)}
                  accent="negative"
                />
              ))}
            </Section>

            <Section title="รายการปรับเพิ่ม / Additions">
              {ALLOWANCE_CODES.map((row) => (
                <FieldRow
                  key={row.code}
                  row={row}
                  value={allowances[row.code] ?? ""}
                  onChange={(v) =>
                    setRow(allowances, setAllowances, row.code, v)
                  }
                  accent="positive"
                />
              ))}
            </Section>

            <Section title="รายการปรับลด / Deductions">
              {DEDUCTION_CODES.map((row) => (
                <FieldRow
                  key={row.code}
                  row={row}
                  value={deductions[row.code] ?? ""}
                  onChange={(v) =>
                    setRow(deductions, setDeductions, row.code, v)
                  }
                  accent="negative"
                />
              ))}
            </Section>

            <div
              className={`
                border-border bg-surface-secondary/40 grid grid-cols-4 gap-3
                rounded-md border p-3 text-sm
              `}
            >
              <Total label="เงินเดือน / Base" value={baseNum} />
              <Total label="รวมปรับเพิ่ม / Add" value={allowanceTotal} />
              <Total
                label="รวมปรับลด / Deduct"
                value={totalDeductions}
                negative
              />
              <Total label="ยอดจ่ายสุทธิ / Net" value={net} emphasised />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || loadingMeta}>
            {saving ? <Loader2 className="size-3.5 animate-spin" /> : null}
            Create payslip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`
        border-border bg-surface flex flex-col gap-1.5 rounded-md border p-3
      `}
    >
      <p
        className={`
          text-muted-foreground mb-1 text-[10px] font-bold tracking-wider
          uppercase
        `}
      >
        {title}
      </p>
      <div
        className={`
          grid grid-cols-1 gap-1.5
          sm:grid-cols-2
        `}
      >
        {children}
      </div>
    </section>
  );
}

function FieldRow({
  row,
  value,
  onChange,
  accent,
}: {
  row: CodeRow;
  value: string;
  onChange: (v: string) => void;
  accent: "positive" | "negative";
}) {
  return (
    <div
      className={`
        border-border/60 flex items-center gap-2 rounded-md border px-2 py-1.5
      `}
    >
      <div className="min-w-0 flex-1">
        <p className="text-foreground truncate text-xs font-medium">
          {row.thai}
        </p>
        <p className="text-muted-foreground truncate text-[10px]">
          {row.code} · {row.english}
        </p>
      </div>
      <Input
        type="number"
        inputMode="decimal"
        step="0.01"
        placeholder="0.00"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`
          h-8 w-32 text-right text-xs tabular-nums
          ${
            accent === "negative" && value && Number(value) > 0
              ? "text-destructive"
              : ""
          }
        `}
      />
    </div>
  );
}

function Total({
  label,
  value,
  negative,
  emphasised,
}: {
  label: string;
  value: number;
  negative?: boolean;
  emphasised?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={`
          text-muted-foreground text-[10px] font-bold tracking-wider uppercase
        `}
      >
        {label}
      </span>
      <span
        className={`
          mt-0.5 font-medium tabular-nums
          ${emphasised ? "text-base" : "text-sm"}
          ${negative ? "text-destructive" : "text-foreground"}
        `}
      >
        {(Number.isFinite(value) ? value : 0).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}
      </span>
    </div>
  );
}
