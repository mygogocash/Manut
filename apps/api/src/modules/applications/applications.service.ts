import { NotFoundException } from "@/common/exceptions/http-exception";
import { rowsToCsv } from "@/common/utils/csv";
import { applicationsRepository } from "@/modules/applications/applications.repository";
import type { ApplicationQuery } from "@/modules/applications/applications.validation";

export class ApplicationsService {
  async listApplications(query: ApplicationQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await applicationsRepository.findApplications(
      filters,
      page,
      limit,
    );

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getApplicationById(id: string) {
    const app = await applicationsRepository.findApplicationById(id);
    if (!app) throw new NotFoundException("Application not found");
    return app;
  }

  async deleteApplication(id: string) {
    const app = await applicationsRepository.findApplicationById(id);
    if (!app) throw new NotFoundException("Application not found");
    return applicationsRepository.deleteApplication(id);
  }

  async exportCsv(params?: { jobId?: string; search?: string }) {
    const rows = await applicationsRepository.findAllForExport(params ?? {});
    const headers = [
      "ID",
      "Name",
      "Email",
      "Mobile",
      "LinkedIn",
      "Website",
      "Position",
      "Department",
      "Location",
      "Resume",
      "Applied At",
    ];
    const data = rows.map((a) => [
      a.id,
      a.name,
      a.email,
      a.mobile,
      a.linkedin ?? "",
      a.website ?? "",
      a.job.title,
      a.job.department,
      a.job.location,
      a.attachment,
      a.createdAt.toISOString(),
    ]);
    return rowsToCsv(headers, data);
  }
}

export const applicationsService = new ApplicationsService();
