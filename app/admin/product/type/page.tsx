"use client";

import AttributeManager, { type AttributeItem } from "../components/AttributeManager";
import { addType, deleteType, getTypeList, updateType } from "../allFunc";

export default function TypeManagementPage() {
  async function fetchItems(): Promise<AttributeItem[]> {
    const types = await getTypeList();
    return types.map((type) => ({ id: type.id!, label: type.name }));
  }

  return (
    <AttributeManager
      title="จัดการประเภทสินค้า"
      fetchItems={fetchItems}
      addItem={(label) => addType(label)}
      updateItem={(id, label) => updateType(id, label)}
      deleteItem={(id) => deleteType(id)}
    />
  );
}
