import { eq } from "drizzle-orm";
import { createEdgeDb, edgeSchema } from "@nexora/db";
import type { Bindings } from "../env";
import { leaveWorkflowInstanceId, type LeaveApprovalParams, type LeaveDecisionEvent } from "../workflows/leave-approval";

export async function startLeaveApprovalWorkflow(
  env: Bindings,
  params: LeaveApprovalParams,
): Promise<string | null> {
  if (!env.LEAVE_APPROVAL) return null;
  const instanceId = leaveWorkflowInstanceId(params.requestId);
  try {
    const instance = await env.LEAVE_APPROVAL.create({ id: instanceId, params });
    if (env.EDGE_DB) {
      const db = createEdgeDb(env.EDGE_DB);
      await db.insert(edgeSchema.edgeWorkflowInstances).values({
        id: instanceId,
        kind: "leave_approval",
        subjectId: params.requestId,
        instanceId: instance.id,
        status: "running",
        createdAt: Date.now(),
      });
    }
    return instance.id;
  } catch {
    return null;
  }
}

export async function signalLeaveDecision(
  env: Bindings,
  requestId: string,
  decision: LeaveDecisionEvent["decision"],
): Promise<boolean> {
  if (!env.LEAVE_APPROVAL) return false;
  const instanceId = leaveWorkflowInstanceId(requestId);
  try {
    const instance = await env.LEAVE_APPROVAL.get(instanceId);
    await instance.sendEvent({ type: "leave.decided", payload: { decision } });
    if (env.EDGE_DB) {
      const db = createEdgeDb(env.EDGE_DB);
      await db
        .update(edgeSchema.edgeWorkflowInstances)
        .set({ status: decision })
        .where(eq(edgeSchema.edgeWorkflowInstances.id, instanceId));
    }
    return true;
  } catch {
    return false;
  }
}
