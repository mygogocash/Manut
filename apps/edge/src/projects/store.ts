export interface ProjectColumnRecord {
  id: string;
  key: string;
  label: string;
  sortOrder: number;
}

export interface ProjectTaskRecord {
  id: string;
  title: string;
  status: string;
  priority: string;
  sortOrder: number;
  ownerId: string | null;
  ownerName: string | null;
}

export interface ProjectRecord {
  id: string;
  name: string;
  slug: string;
  status: string;
  team: string;
  department: string | null;
  ownerId: string;
  ownerName: string;
  taskCount: number;
  startDate: string | null;
  endDate: string | null;
  goLiveDate: string | null;
  workstream: string | null;
  columns: ProjectColumnRecord[];
  tasks: ProjectTaskRecord[];
  memberIds: string[];
}

export interface ListProjectsFilters {
  status?: string;
  search?: string;
  team?: string;
  accessibleByUserId?: string;
}

export interface CreateProjectTaskStoreInput {
  projectId: string;
  title: string;
  status: string;
  priority: string;
  sortOrder: number;
  ownerId: string | null;
}

export interface ProjectsStore {
  loadPermissions(userId: string): Promise<Set<string>>;
  findMany(
    filters: ListProjectsFilters,
    page: number,
    limit: number,
  ): Promise<{ data: ProjectRecord[]; total: number }>;
  findByIdOrSlug(idOrSlug: string): Promise<ProjectRecord | null>;
  findParticipantRole(
    projectId: string,
    userId: string,
  ): Promise<"owner" | "member" | null>;
  createTask(input: CreateProjectTaskStoreInput): Promise<ProjectTaskRecord>;
}
