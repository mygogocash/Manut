import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from "cloudflare:workers";
import type { Bindings } from "../env";
import { enqueueSidecarJob } from "../lib/jobs";

export type LeaveApprovalParams = {
  requestId: string;
  employeeId: string;
  reminderHours?: number[];
};

export type LeaveDecisionEvent = { decision: "approved" | "rejected" | "cancelled" };

export function leaveWorkflowInstanceId(requestId: string): string {
  return `leave-${requestId}`;
}

export const DEFAULT_REMINDER_HOURS = [24, 72, 168] as const;

/**
 * Sidecar orchestrator for HR leave. Does not approve or reject — Postgres
 * `leaveService` stays the source of truth. This only waits and enqueues reminders.
 */
export class LeaveApprovalWorkflow extends WorkflowEntrypoint<Bindings, LeaveApprovalParams> {
  async run(event: Readonly<WorkflowEvent<LeaveApprovalParams>>, step: WorkflowStep) {
    const hours = event.payload.reminderHours?.length ? event.payload.reminderHours : [...DEFAULT_REMINDER_HOURS];
    for (const [index, delayHours] of hours.entries()) {
      const decided = await waitForLeaveDecision(step, `wait-${index}-${delayHours}h`, `${delayHours} hours`);
      if (decided) return { requestId: event.payload.requestId, outcome: decided.decision };
      await step.do(`remind-${index}`, async () => {
        await enqueueSidecarJob(this.env, "leave-approval-reminder", event.payload.requestId);
        return true;
      });
    }
    return { requestId: event.payload.requestId, outcome: "timed_out" as const };
  }
}

async function waitForLeaveDecision(
  step: WorkflowStep,
  name: string,
  timeout: `${number} hours`,
): Promise<LeaveDecisionEvent | null> {
  try {
    const event = await step.waitForEvent<LeaveDecisionEvent>(name, { type: "leave.decided", timeout });
    return event.payload;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/timeout|timed out/i.test(message)) return null;
    throw err;
  }
}
