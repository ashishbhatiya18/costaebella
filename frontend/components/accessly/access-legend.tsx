import { Card } from "@/components/admin/ui/card";

type Access = "owner" | "operations" | "accounting";

const ROWS: { app: string; screen: string; roles: Access[] }[] = [
  { app: "Shiftly", screen: "Log Attendance", roles: ["owner", "operations"] },
  { app: "Shiftly", screen: "Manage Employees", roles: ["owner"] },
  { app: "Shiftly", screen: "Attendance Summary", roles: ["owner", "operations"] },
  { app: "Shiftly", screen: "Advances", roles: ["owner", "operations"] },
  { app: "Shiftly", screen: "Payout Summary", roles: ["owner", "accounting"] },
  { app: "Pantrly", screen: "Items / Suppliers / Deliveries", roles: ["owner", "operations"] },
  { app: "Ledgerly", screen: "Log Income / Expense", roles: ["owner", "accounting"] },
  { app: "Ledgerly", screen: "Payments", roles: ["owner", "accounting"] },
  { app: "Ledgerly", screen: "P&L Summary", roles: ["owner"] },
  { app: "Ledgerly", screen: "Tax Export", roles: ["owner"] },
  { app: "Menuly", screen: "Items / Analytics", roles: ["owner"] },
  { app: "Intel-ly", screen: "Overview / Margins / Trends", roles: ["owner"] },
  { app: "Accessly", screen: "Manage Users", roles: ["owner"] },
];

const COLUMNS: { label: string; value: Access }[] = [
  { label: "Owner", value: "owner" },
  { label: "Operations", value: "operations" },
  { label: "Accounting", value: "accounting" },
];

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="inline text-teal">
      <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Static reference for what each Accessly role can see, kept in sync by
// hand with the server-side gates in backend/cmd/api/main.go
// (accessly.RequireRole groups) and frontend/lib/admin/app-access.ts —
// update this table alongside either if the access matrix changes.
export function AccessLegend() {
  return (
    <div className="mt-10">
      <h2 className="mb-1 font-display text-lg text-navy">What each role can see</h2>
      <p className="mb-4 text-sm text-navy/60">
        A quick reference for choosing a role above — enforcement happens on the backend regardless.
      </p>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[520px] text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-navy/40">
              <th className="px-5 py-3 font-medium">Screen</th>
              {COLUMNS.map((c) => (
                <th key={c.value} className="px-3 py-3 text-center font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr key={`${row.app}-${row.screen}`} className="border-t border-navy/5">
                <td className="px-5 py-2.5">
                  <span className="font-medium text-navy">{row.app}</span>
                  <span className="text-navy/50"> — {row.screen}</span>
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.value} className="px-3 py-2.5 text-center">
                    {row.roles.includes(c.value) ? <CheckIcon /> : <span className="text-navy/20">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
