/** Human-readable label for free-form visaType codes from the API. */
export function visaTypeLabel(visaType: string): string {
  switch (visaType) {
    case "work_visa":
      return "Work visa";
    case "residence_visa":
      return "Residence visa";
    case "tourist_visa":
      return "Tourist visa";
    case "business_visa":
      return "Business visa";
    case "transit_visa":
      return "Transit visa";
    case "other":
      return "Other";
    default:
      return visaType.replaceAll("_", " ");
  }
}
