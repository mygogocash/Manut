import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  getQaCrmProject,
  qaCrmProjectDetailSchema,
} from "../src/qa-crm/qa-crm-detail";

const project = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  name: "Regression suite",
  slug: "regression-suite",
  status: "active",
  department: "QA",
  sortOrder: 3,
  description: "Long description",
  comment: "Internal note",
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: null,
  role: "member",
  owner: {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    name: "Alex Example",
    email: "alex@example.com",
  },
  columns: [{ id: "col-1", key: "open", label: "Open" }],
  tasks: [{ id: "task-1", title: "Bug", observation: "secret" }],
};

describe("qa-crm detail foundation contracts", () => {
  it("keeps detail fields and strips emails/notes/board", () => {
    const parsed = qaCrmProjectDetailSchema.parse(project);
    expect(parsed).toEqual({
      id: project.id,
      name: "Regression suite",
      slug: "regression-suite",
      status: "active",
      department: "QA",
      sortOrder: 3,
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: null,
      role: "member",
      owner: { id: project.owner.id, name: "Alex Example" },
    });
    expect(parsed).not.toHaveProperty("description");
    expect(parsed).not.toHaveProperty("comment");
    expect(parsed).not.toHaveProperty("columns");
    expect(parsed).not.toHaveProperty("tasks");
  });

  it("loads qa-crm project by id", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({ data: project });
    const client = { get } as unknown as ApiClient;

    await expect(getQaCrmProject(client, project.id, signal)).resolves.toEqual(
      expect.objectContaining({ id: project.id, name: "Regression suite" }),
    );
    expect(get).toHaveBeenCalledWith(`/qa-crm/${project.id}`, { signal });
  });
});
