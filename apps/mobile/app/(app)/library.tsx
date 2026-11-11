import { OpsFormScreen } from '../../src/screens/OpsFormScreen';

export default function LibraryRoute() {
  return (
    <OpsFormScreen
      title="Library"
      subtitle="Books and copies"
      queryKey="library-books"
      listPath="/library/books"
      createPath="/library/books"
      fields={[
        { key: 'title', label: 'Title' },
        { key: 'author', label: 'Author' },
        { key: 'barcode', label: 'Barcode' },
      ]}
      second={{
        title: 'Issue a loan',
        path: '/library/loans',
        fields: [
          { key: 'copyId', label: 'Copy id' },
          { key: 'studentId', label: 'Student id' },
          { key: 'dueOn', label: 'Due date YYYY-MM-DD' },
        ],
      }}
      extra={{
        title: 'Return a copy',
        pathPrefix: '/library/loans/',
        idKey: 'loanId',
        pathSuffix: '/return',
        label: 'Loan id',
      }}
      summarize={(row) => {
        const copies = Array.isArray(row.copies) ? row.copies.length : 0;
        return `${String(row.title)} · ${copies} copies`;
      }}
    />
  );
}
