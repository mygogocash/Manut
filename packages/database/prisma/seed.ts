import { PrismaClient } from "../../src/generated/prisma";

const prisma = new PrismaClient();

const EMPLOYEE_PERMISSIONS = [
  "leave:read",
  "leave:request",
  "performance:read",
  "performance:self-review",
] as const;

async function main() {
  const entity = await prisma.entity.upsert({
    where: { code: "MANUT" },
    update: { isActive: true, name: "Manut" },
    create: {
      accountingStd: "IFRS",
      code: "MANUT",
      country: process.env.MANUT_DEFAULT_COUNTRY ?? "Thailand",
      currency: process.env.MANUT_DEFAULT_CURRENCY ?? "THB",
      name: "Manut",
    },
  });

  await prisma.role.upsert({
    where: { name: "Admin" },
    update: { description: "Manut administrators", isSystem: true },
    create: {
      description: "Manut administrators",
      isSystem: true,
      name: "Admin",
    },
  });

  const employee = await prisma.role.upsert({
    where: { name: "Employee" },
    update: {
      defaultRoute: "/my-portal",
      description: "Manut employees",
      isSystem: true,
    },
    create: {
      defaultRoute: "/my-portal",
      description: "Manut employees",
      isSystem: true,
      name: "Employee",
    },
  });

  await prisma.rolePermission.createMany({
    data: EMPLOYEE_PERMISSIONS.map((permissionCode) => ({
      permissionCode,
      roleId: employee.id,
    })),
    skipDuplicates: true,
  });

  console.log(`Seeded clean Manut configuration for entity ${entity.code}.`);
  console.log(
    "No users, credentials, employee data, or sample content were created.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
