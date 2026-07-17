import { Container } from "@cloudflare/containers";
import {
  WorkflowEntrypoint,
  type WorkflowEvent,
  type WorkflowStep,
} from "cloudflare:workers";

import { HttpError } from "./http-error";
import type { EdgeJobEnvelope } from "./queue";
import type { RuntimeBindings } from "./runtime";

export interface BackgroundWorkflowParams {
  operation: string;
  requestId: string;
}

function enabled(value: string): boolean {
  return value === "true";
}

export function platformCapabilities(env: RuntimeBindings) {
  return {
    container: {
      enabled:
        enabled(env.ENABLE_CONTAINER_BOUNDARY) &&
        env.CONTAINER_BOUNDARY !== undefined,
      provisioned: env.CONTAINER_BOUNDARY !== undefined,
    },
    cron: {
      enabled: enabled(env.ENABLE_CRON_BOUNDARY),
      provisioned: false,
    },
    hyperdrive: {
      enabled:
        enabled(env.ENABLE_HYPERDRIVE_BOUNDARY) &&
        env.HYPERDRIVE_DATABASE !== undefined,
      provisioned: env.HYPERDRIVE_DATABASE !== undefined,
    },
    workflow: {
      enabled: enabled(env.ENABLE_WORKFLOW_BOUNDARY),
      provisioned: env.BACKGROUND_WORKFLOW !== undefined,
    },
  };
}

export async function startBackgroundWorkflow(
  env: RuntimeBindings,
  params: BackgroundWorkflowParams,
): Promise<string> {
  if (!enabled(env.ENABLE_WORKFLOW_BOUNDARY) || !env.BACKGROUND_WORKFLOW) {
    throw new HttpError(
      503,
      "WORKFLOW_NOT_PROVISIONED",
      "Workflow capability is disabled.",
    );
  }
  const instance = await env.BACKGROUND_WORKFLOW.create({
    id: `edge-${params.requestId}`,
    params,
  });
  return instance.id;
}

export function requireHyperdrive(env: RuntimeBindings): Hyperdrive {
  if (!enabled(env.ENABLE_HYPERDRIVE_BOUNDARY) || !env.HYPERDRIVE_DATABASE) {
    throw new HttpError(
      503,
      "HYPERDRIVE_NOT_PROVISIONED",
      "Database capability is disabled.",
    );
  }
  return env.HYPERDRIVE_DATABASE;
}

export function requireContainer(env: RuntimeBindings): DurableObjectNamespace {
  if (!enabled(env.ENABLE_CONTAINER_BOUNDARY) || !env.CONTAINER_BOUNDARY) {
    throw new HttpError(
      503,
      "CONTAINER_NOT_PROVISIONED",
      "Container capability is disabled.",
    );
  }
  return env.CONTAINER_BOUNDARY;
}

export class BackgroundWorkflow extends WorkflowEntrypoint<
  RuntimeBindings,
  BackgroundWorkflowParams
> {
  async run(
    event: Readonly<WorkflowEvent<BackgroundWorkflowParams>>,
    step: WorkflowStep,
  ): Promise<{ accepted: true; operation: string }> {
    return step.do("provisioning gate", async () => {
      if (!enabled(this.env.ENABLE_WORKFLOW_BOUNDARY)) {
        throw new Error("WORKFLOW_NOT_PROVISIONED");
      }
      return { accepted: true as const, operation: event.payload.operation };
    });
  }
}

export class ContainerBoundary extends Container<RuntimeBindings> {
  enableInternet = false;

  override async fetch(_request: Request): Promise<Response> {
    if (!enabled(this.env.ENABLE_CONTAINER_BOUNDARY)) {
      return Response.json(
        {
          code: "CONTAINER_NOT_PROVISIONED",
          error: "Container capability is disabled.",
        },
        { status: 503 },
      );
    }
    return Response.json(
      {
        code: "CONTAINER_CONTRACT_NOT_IMPLEMENTED",
        error: "Container contract is disabled.",
      },
      { status: 501 },
    );
  }
}

export async function handleScheduled(
  controller: ScheduledController,
  env: RuntimeBindings,
): Promise<void> {
  if (!enabled(env.ENABLE_CRON_BOUNDARY)) {
    controller.noRetry();
    console.log(
      JSON.stringify({
        cron: controller.cron,
        message: "cron boundary disabled",
      }),
    );
    return;
  }

  const scheduledAt = new Date(controller.scheduledTime).toISOString();
  const job: EdgeJobEnvelope = {
    idempotencyKey: `cron:${controller.cron}:${controller.scheduledTime}`,
    kind: "maintenance.cron",
    occurredAt: scheduledAt,
    payload: { cron: controller.cron, scheduledAt },
    version: 1,
  };
  await env.JOB_QUEUE.send(job);
}
