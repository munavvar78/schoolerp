import { OpsFormScreen } from '../../src/screens/OpsFormScreen';

export default function HostelRoute() {
  return (
    <OpsFormScreen
      title="Hostel"
      subtitle="Rooms and beds"
      queryKey="hostel-rooms"
      listPath="/hostel/rooms"
      createPath="/hostel/rooms"
      fields={[
        { key: 'name', label: 'Room' },
        { key: 'beds', label: 'Beds', numeric: true },
      ]}
      second={{
        title: 'Allocate a bed',
        path: '/hostel/allocations',
        fields: [
          { key: 'roomId', label: 'Room id' },
          { key: 'studentId', label: 'Student id' },
        ],
      }}
      summarize={(row) => {
        const taken = Array.isArray(row.allocations) ? row.allocations.length : 0;
        return `${String(row.name)} · ${taken}/${String(row.beds)}`;
      }}
    />
  );
}
