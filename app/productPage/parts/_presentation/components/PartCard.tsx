"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardActions from "@mui/material/CardActions";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import type { Part } from "@/app/productPage/parts/_domain/entities";

type PartCardProps = {
  part: Part;
  onSelect: (part: Part) => void;
};

export default function PartCard({ part, onSelect }: PartCardProps) {
  return (
    <Card variant="outlined" sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <Box sx={{ height: 140, bgcolor: "#e5e7eb", borderTop: "6px solid #b91c1c" }} />
      <CardContent sx={{ flexGrow: 1, textAlign: "center", pb: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {part.name}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ราคา : {part.price !== null ? `${part.price.toLocaleString("th-TH")} บาท` : "-- บาท"}
        </Typography>
      </CardContent>
      <CardActions sx={{ justifyContent: "center", pb: 2 }}>
        <Button
          variant="contained"
          color="error"
          size="small"
          sx={{ borderRadius: 5, px: 3 }}
          onClick={() => onSelect(part)}
        >
          เลือก
        </Button>
      </CardActions>
    </Card>
  );
}
