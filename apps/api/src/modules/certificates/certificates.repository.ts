import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

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

  findById(id: string) {
    return prisma.certificate.findUnique({
      where: { id },
      include: CERTIFICATE_INCLUDE,
    });
  },

  delete(id: string) {
    return prisma.certificate.delete({ where: { id } });
  },
};
