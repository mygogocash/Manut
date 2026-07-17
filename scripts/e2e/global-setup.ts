import { provisionE2E } from "./provision";

export default async function globalSetup(): Promise<void> {
  await provisionE2E();
}
