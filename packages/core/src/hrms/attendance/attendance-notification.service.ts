/** Cron/email hooks — best-effort no-ops on edge until email wiring lands. */

type CorrectionRow = { id: string; employeeId: string };

export async function notifyPendingCorrection(_row: CorrectionRow): Promise<void> {}

export async function notifyCorrectionApproved(_row: CorrectionRow): Promise<void> {}

export async function notifyCorrectionRejected(_row: CorrectionRow): Promise<void> {}

export async function notifyMissedCheckIn(_employeeId: string): Promise<void> {}

export async function notifyMissedCheckOut(_employeeId: string): Promise<void> {}
