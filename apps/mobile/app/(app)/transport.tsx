import { canWriteTransport } from '@school-erp/shared';
import { useAuth } from '../../src/auth/AuthProvider';
import { OpsFormScreen } from '../../src/screens/OpsFormScreen';

export default function TransportRoute() {
  const { session } = useAuth();
  return (
    <OpsFormScreen
      title="Transport"
      subtitle="Routes and seats"
      queryKey="transport-routes"
      listPath="/transport/routes"
      canWrite={session ? canWriteTransport(session.role) : false}
      createPath="/transport/routes"
      fields={[
        { key: 'name', label: 'Route name' },
        { key: 'capacity', label: 'Seats', numeric: true },
      ]}
      second={{
        title: 'Assign a seat',
        path: '/transport/assignments',
        fields: [
          { key: 'routeId', label: 'Route id' },
          { key: 'studentId', label: 'Student id' },
        ],
      }}
      summarize={(row) => {
        const seats = Array.isArray(row.assignments) ? row.assignments.length : 0;
        return `${String(row.name)} · ${seats}/${String(row.capacity)}`;
      }}
    />
  );
}
