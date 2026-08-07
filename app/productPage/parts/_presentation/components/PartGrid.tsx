"use client";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";
import type { Part } from "@/app/productPage/parts/_domain/entities";
import PartCard from "./PartCard";

type PartGridProps = {
  parts: Part[];
  isLoading: boolean;
  onSelect: (part: Part) => void;
};

const SKELETON_COUNT = 10;

export default function PartGrid({ parts, isLoading, onSelect }: PartGridProps) {
  if (isLoading) {
    return (
      <Grid container spacing={2} sx={{ px: { xs: 2, md: 3 }, pb: 3 }}>
        {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
          <Grid key={index} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
            <Skeleton variant="rounded" height={230} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (parts.length === 0) {
    return (
      <Box sx={{ px: { xs: 2, md: 3 }, py: 6, textAlign: "center" }}>
        <Typography color="text.secondary">ไม่พบอะไหล่ที่ค้นหา</Typography>
      </Box>
    );
  }

  return (
    <Grid container spacing={2} sx={{ px: { xs: 2, md: 3 }, pb: 3, pt: 2 }}>
      {parts.map((part) => (
        <Grid key={part.id} size={{ xs: 6, sm: 4, md: 3, lg: 2.4 }}>
          <PartCard part={part} onSelect={onSelect} />
        </Grid>
      ))}
    </Grid>
  );
}
