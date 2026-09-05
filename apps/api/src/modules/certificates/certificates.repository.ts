import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import {
  excludeDeleted,
  restoreUpdate,
  softDeleteUpdate,
} from "@/infrastructure/soft-delete";

const CERTIFICATE_INCLUDE = {
  recipient: {
    select: {
      id: true,
      name: true,
      email: true,
      avatarUrl: true,
      department: true,
    },
  },
  issuedBy: { select: { id: true, name: true } },
} satisfies Prisma.CertificateInclude;

export const certificatesRepository = {
  create(data: Prisma.CertificateUncheckedCreateInput) {
    return prisma.certificate.create({ data, include: CERTIFICATE_INCLUDE });
  },

  list(where: Prisma.CertificateWhereInput, skip: number, take: number) {
    return Promise.all([
      prisma.certificate.findMany({
        where,
        include: CERTIFICATE_INCLUDE,
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
      prisma.certificate.count({ where }),
    ]);
  },

  // Excludes reverted (soft-deleted) rows — used by the download path so a
  // reverted certificate 404s.
  findById(id: string) {
    return prisma.certificate.findFirst({
      where: { id, ...excludeDeleted() },
      include: CERTIFICATE_INCLUDE,
    });
  },

  // Includes reverted rows — used by revert / restore / permanent-delete,
  // which must resolve a row regardless of its deleted state.
  findByIdIncludingDeleted(id: string) {
    return prisma.certificate.findUnique({
      where: { id },
      include: CERTIFICATE_INCLUDE,
    });
  },

  softDelete(id: string) {
    return prisma.certificate.update({
      where: { id },
      data: softDeleteUpdate(),
      include: CERTIFICATE_INCLUDE,
    });
  },

  restore(id: string) {
    return prisma.certificate.update({
      where: { id },
      data: restoreUpdate(),
      include: CERTIFICATE_INCLUDE,
    });
  },

  delete(id: string) {
    return prisma.certificate.delete({ where: { id } });
  },
};
