// The database package owns the adapter-backed Prisma 7 singleton. Keeping
// construction in one place prevents an accidental direct connection from
// bypassing Hyperdrive in an edge/container deployment.
export { prisma } from "@manut/database";
