import type { Metadata } from "next";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import PrivacyPolicyContent from "./PrivacyPolicyContent";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว | ร้านแก๊สท.รุ่งโรจน์",
};

export default function PrivacyPage() {
  return (
    <Container component="main" maxWidth="md" sx={{ py: { xs: 2, sm: 3 } }}>
      <Typography component="h1" variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
        นโยบายความเป็นส่วนตัว
      </Typography>
      <PrivacyPolicyContent />
    </Container>
  );
}
