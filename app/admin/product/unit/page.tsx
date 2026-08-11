"use client";

import AttributeManager, { type AttributeItem } from "../components/AttributeManager";
import { addUnit, deleteUnit, getUnitList, updateUnit } from "../allFunc";

export default function UnitManagementPage() {
  async function fetchItems(): Promise<AttributeItem[]> {
    const units = await getUnitList();
    return units.map((unit) => ({ id: unit.id!, label: unit.unit }));
  }

  return (
    <AttributeManager
      title="จัดการหน่วยสินค้า"
      fetchItems={fetchItems}
      addItem={(label) => addUnit(label)}
      updateItem={(id, label) => updateUnit(id, label)}
      deleteItem={(id) => deleteUnit(id)}
    />
  );
}
