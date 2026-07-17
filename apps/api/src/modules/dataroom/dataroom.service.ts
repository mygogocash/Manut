import { NotFoundException } from "@/common/exceptions/http-exception";
import { dataRoomRepository } from "@/modules/dataroom/dataroom.repository";
import type {
  CreateDocumentInput,
  ListDocumentsQuery,
  UpdateDocumentInput,
} from "@/modules/dataroom/dataroom.validation";

export class DataRoomService {
  async list(query: ListDocumentsQuery) {
    const { page, limit, ...filters } = query;
    const { data, total } = await dataRoomRepository.findMany(
      filters,
      page,
      limit,
    );
    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getById(id: string) {
    const doc = await dataRoomRepository.findById(id);
    if (!doc) throw new NotFoundException("Document not found");
    return doc;
  }

  async upload(uploadedBy: string, input: CreateDocumentInput) {
    return dataRoomRepository.create({
      name: input.name,
      description: input.description,
      category: input.category ?? "other",
      fileUrl: input.fileUrl,
      fileSize: input.fileSize,
      mimeType: input.mimeType,
      uploader: { connect: { id: uploadedBy } },
    });
  }

  async update(id: string, input: UpdateDocumentInput) {
    await this.getById(id);
    return dataRoomRepository.update(id, {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && {
        description: input.description ?? null,
      }),
      ...(input.category !== undefined && { category: input.category }),
    });
  }

  async delete(id: string) {
    await this.getById(id);
    return dataRoomRepository.delete(id);
  }

  async getCategorySummary() {
    return dataRoomRepository.getCategorySummary();
  }
}

export const dataRoomService = new DataRoomService();
