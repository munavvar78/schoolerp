import { OpsFormScreen } from '../../src/screens/OpsFormScreen';

export default function PayrollRoute() {
  return (
    <OpsFormScreen
      title="Payroll"
      subtitle="Computed slips. No bank payout."
      queryKey="payroll-slips"
      listPath="/payroll/slips"
      createPath="/payroll/slips"
      fields={[
        { key: 'staffId', label: 'Staff id' },
        { key: 'periodLabel', label: 'Month (YYYY-MM)' },
      ]}
      summarize={(row) => {
        const staff = row.staff as { user?: { name?: string } } | undefined;
        return `${staff?.user?.name ?? 'Staff'} · ${String(row.periodLabel)} · net ${String(row.netPaise)} paise`;
      }}
    />
  );
}
