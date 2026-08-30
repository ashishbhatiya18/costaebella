// Shared money formatting for admin apps that store amounts as integer
// paisa (cents) — e.g. Ledgerly, Pantrly's purchase cost. All costs in
// this codebase are INR.
export function formatINR(cents: number) {
  return (cents / 100).toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  });
}
