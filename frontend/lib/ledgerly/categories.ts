import { Category } from "@/lib/ledgerly/api";

// Display labels for ledgerly_payments categories. Typed against Category
// so adding a backend category fails the type check until it's labelled
// (keep in sync with payment.ValidCategories).
export const CATEGORY_LABELS: Record<Category, string> = {
  rent: "Rent",
  utilities: "Utilities",
  supplier_purchase: "Supplier purchase",
  salary: "Salary",
  maintenance: "Maintenance",
  marketing: "Marketing",
  licenses_fees: "Licenses & fees",
  transport: "Transport",
  equipment: "Equipment",
  other: "Other",
};
