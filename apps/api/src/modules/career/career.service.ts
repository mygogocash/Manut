import { NotFoundException } from "@/common/exceptions/http-exception";
import { rowsToCsv } from "@/common/utils/csv";
import { careerRepository } from "@/modules/career/career.repository";
import type {
  CreateJobInput,
  JobQuery,
  UpdateJobInput,
} from "@/modules/career/career.validation";

export class CareerService {
  async listJobs(query: JobQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await careerRepository.findJobs(
      filters,
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getJobById(id: string) {
    const job = await careerRepository.findJobById(id);
    if (!job) throw new NotFoundException("Job not found");
    return job;
  }

  async createJob(input: CreateJobInput) {
    return careerRepository.createJob({
      title: input.title,
      slug: input.slug,
      type: input.type,
      location: input.location,
      department: input.department,
      description: input.description,
      active: input.active,
    });
  }

  async updateJob(id: string, input: UpdateJobInput) {
    const job = await careerRepository.findJobById(id);
    if (!job) throw new NotFoundException("Job not found");
    return careerRepository.updateJob(id, {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.slug !== undefined && { slug: input.slug }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.department !== undefined && { department: input.department }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.active !== undefined && { active: input.active }),
    });
  }

  async deleteJob(id: string) {
    const job = await careerRepository.findJobById(id);
    if (!job) throw new NotFoundException("Job not found");
    return careerRepository.deleteJob(id);
  }

  async getJobTitles() {
    return careerRepository.findJobTitles();
  }

  async exportCsv(params?: { search?: string }) {
    const rows = await careerRepository.findAllForExport(params?.search);
    const headers = [
      "ID",
      "Title",
      "Slug",
      "Type",
      "Department",
      "Location",
      "Active",
      "Applications",
      "Created At",
      "Updated At",
    ];
    const data = rows.map((j) => [
      j.id,
      j.title,
      j.slug ?? "",
      j.type,
      j.department,
      j.location,
      j.active ? "Yes" : "No",
      j._count.applications,
      j.createdAt.toISOString(),
      j.updatedAt.toISOString(),
    ]);
    return rowsToCsv(headers, data);
  }
}

export const careerService = new CareerService();
