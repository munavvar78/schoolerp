import { OpsFormScreen } from '../../src/screens/OpsFormScreen';

export default function HrRoute() {
  return (
    <OpsFormScreen
      title="HR"
      subtitle="Staff and leave balance"
      queryKey="hr-staff"
      listPath="/hr/staff"
      createPath="/hr/staff"
      fields={[
        { key: 'userId', label: 'User id' },
        { key: 'employeeCode', label: 'Employee code' },
        { key: 'basicPaise', label: 'Basic paise', numeric: true },
        { key: 'hraPaise', label: 'HRA paise', numeric: true },
      ]}
      second={{
        title: 'Request leave',
        path: '/hr/leave',
        fields: [
          { key: 'staffId', label: 'Staff id' },
          { key: 'days', label: 'Days', numeric: true },
          { key: 'startDate', label: 'Start YYYY-MM-DD' },
        ],
      }}
      actions={{
        title: 'Leave requests',
        listPath: '/hr/leave',
        summarize: (row) => {
          const staff = row.staff as { user?: { name?: string } } | undefined;
          return `${staff?.user?.name ?? 'Staff'} · ${String(row.days)} days · ${String(row.status)}`;
        },
        pending: (row) => row.status === 'PENDING',
        approvePath: (id) => `/hr/leave/${id}/approve`,
        rejectPath: (id) => `/hr/leave/${id}/reject`,
      }}
      summarize={(row) => {
        const user = row.user as { name?: string } | undefined;
        return `${user?.name ?? 'Staff'} · ${String(row.employeeCode)} · ${String(row.leaveBalance)} days`;
      }}
    />
  );
}
