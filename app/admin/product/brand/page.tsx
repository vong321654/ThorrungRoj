"use client";

import AttributeManager, { type AttributeItem } from "../components/AttributeManager";
import { addBrand, deleteBrand, getBrandList, updateBrand } from "../allFunc";

export default function BrandManagementPage() {
  async function fetchItems(): Promise<AttributeItem[]> {
    const brands = await getBrandList();
    return brands.map((brand) => ({ id: brand.id!, label: brand.name }));
  }

  return (
    <AttributeManager
      title="จัดการแบรนด์สินค้า"
      fetchItems={fetchItems}
      addItem={(label) => addBrand(label)}
      updateItem={(id, label) => updateBrand(id, label)}
      deleteItem={(id) => deleteBrand(id)}
    />
  );
}
