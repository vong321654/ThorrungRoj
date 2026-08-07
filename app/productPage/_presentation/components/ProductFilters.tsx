"use client";

import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { type SelectChangeEvent } from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import type { ProductFilterState } from "@/app/productPage/_domain/entities";
import type { FilterOptions } from "@/app/productPage/_application/getFilterOptions";

type ProductFiltersProps = {
  filter: ProductFilterState;
  options: FilterOptions;
  onChange: (patch: Partial<ProductFilterState>) => void;
};

export default function ProductFilters({ filter, options, onChange }: ProductFiltersProps) {
  function handleBrandChange(event: SelectChangeEvent) {
    const value = event.target.value;
    onChange({ brand: value === "" ? "" : (value as ProductFilterState["brand"]) });
  }

  function handleWeightChange(event: SelectChangeEvent) {
    const value = event.target.value;
    onChange({ weightKg: value === "" ? "" : Number(value) });
  }

  return (
    <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap", px: { xs: 2, md: 3 }, py: 2 }}>
      <FormControl size="small" sx={{ minWidth: 180 }}>
        <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600 }}>
          ยี่ห้อถัง
        </Typography>
        <Select displayEmpty value={filter.brand} onChange={handleBrandChange}>
          <MenuItem value="">- เลือก -</MenuItem>
          {options.brands.map((brand) => (
            <MenuItem key={brand.value} value={brand.value}>
              {brand.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      <FormControl size="small" sx={{ minWidth: 180 }}>
        <Typography variant="caption" sx={{ mb: 0.5, fontWeight: 600 }}>
          น้ำหนักของถัง
        </Typography>
        <Select
          displayEmpty
          value={filter.weightKg === "" ? "" : String(filter.weightKg)}
          onChange={handleWeightChange}
        >
          <MenuItem value="">- เลือก -</MenuItem>
          {options.weightsKg.map((weight) => (
            <MenuItem key={weight} value={String(weight)}>
              {weight} กก.
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </Box>
  );
}