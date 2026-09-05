import { isApproved, isWorkflowTeam, WORKFLOW_STATUS } from "@nexora/contracts/modules/projects/workflow/workflow.types";
import { ForbiddenException } from "../http-exception";

/** Task mutations blocked until workflow-approved (general team only). */
export function assertWorkStarted(project: {
  workflowStatus?: string | null;
  team?: string | null;
}): void {
  if (!isWorkflowTeam(project.team)) return;
  const status = project.workflowStatus;
  if (status === null || status === undefined) return;
  if (isApproved(status) || status === WORKFLOW_STATUS.COMPLETED) return;
  throw new ForbiddenException(
    status === WORKFLOW_STATUS.REJECTED
      ? "This request was rejected — its board is read-only"
      : "This request is still awaiting approval, so its tasks cannot be changed yet",
  );
}

export function departmentWrite(input: {
  department?: string | null;
  departments?: string[];
}): { department?: string | null; departments?: string[] } {
  if (input.departments !== undefined) {
    const list = [...new Set(input.departments)];
    return { departments: list, department: list[0] ?? null };
  }
  if (input.department !== undefined) {
    return {
      department: input.department,
      departments: input.department ? [input.department] : [],
    };
  }
  return {};
}
