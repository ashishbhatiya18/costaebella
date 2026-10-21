// Shared by Log Income (where discounts / complimentary bills are logged)
// and the Giveaways page (where they're reported). The category of a
// giveaway is stored in Sale.discount_reason as plain text, so a typed
// "Other" category is just another value.

// "Other" in the category dropdown switches to a free-text field.
export const OTHER_CATEGORY = "__other__";

export const COMPLIMENTARY_CATEGORIES = [
  "Owner's guest",
  "Friends & family",
  "Staff meal",
  "Regular customer",
  "Complaint / service recovery",
  "Promotion / tasting",
];

export const DISCOUNT_CATEGORIES = [
  "Regular customer",
  "Friends & family",
  "Staff discount",
  "Offer / promotion",
  "Complaint / service recovery",
  "Bill rounded off",
];

// Picking one of these defaults "Given to" to a staff member.
export const STAFF_CATEGORIES = ["Staff meal", "Staff discount"];

export type RecipientType = "staff" | "other";
