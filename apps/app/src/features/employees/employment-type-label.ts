/**
 * Human-facing employment type labels for the admin employees list.
 *
 * TODO(you): keep these aligned with web EMPLOYMENT_TYPE_LABELS
 * (Full-time, Part-time, Contract, Intern, Consultant).
 */
export function employmentTypeLabel(employmentType: string): string {
  switch (employmentType) {
    case "full_time":
      return "Full-time";
    case "part_time":
      return "Part-time";
    case "contract":
      return "Contract";
    case "intern":
      return "Intern";
    case "consultant":
      return "Consultant";
    default:
      return employmentType.replaceAll("_", " ");
  }
}
