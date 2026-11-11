import { OpsFormScreen } from '../../src/screens/OpsFormScreen';

export default function InventoryRoute() {
  return (
    <OpsFormScreen
      title="Inventory"
      subtitle="Stock on hand"
      queryKey="inventory-items"
      listPath="/inventory/items"
      createPath="/inventory/items"
      fields={[
        { key: 'sku', label: 'SKU' },
        { key: 'name', label: 'Name' },
      ]}
      second={{
        title: 'Stock movement',
        path: '/inventory/movements',
        fields: [
          { key: 'itemId', label: 'Item id' },
          { key: 'quantityDelta', label: 'Quantity change', numeric: true },
          { key: 'reason', label: 'Reason' },
        ],
      }}
      summarize={(row) => `${String(row.name)} · ${String(row.sku)} · ${String(row.onHand)} on hand`}
    />
  );
}
