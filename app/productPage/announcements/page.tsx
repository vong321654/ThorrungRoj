"use client";

import { useEffect, useState } from "react";
import { Alert, Box, Card, CardContent, Chip, CircularProgress, Container, Stack, Typography } from "@mui/material";
import type { APIRESULT } from "@/app/api/response";
import { ANNOUNCEMENTTYPE, type ANNOUNCEMENT } from "@/app/models/announcement";

const TYPE_LABELS: Record<string, string> = { promotion: "โปรโมชั่น", announcement: "ประกาศ" };

export default function CustomerAnnouncementsPage() {
  const [items, setItems] = useState<ANNOUNCEMENT[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        // ประกาศที่เผยแพร่แล้วและยังไม่หมดอายุ เปิดอ่านได้ทุกคนโดยไม่ต้องล็อกอิน
        const response = await fetch("/api/announcements", { cache: "no-store" });
        const result = (await response.json()) as APIRESULT<ANNOUNCEMENT[]>;
        if (!response.ok || result.status === "error") throw new Error(result.message);
        if (isMounted) setItems(result.results);
      } catch (loadError) {
        if (isMounted) setError(loadError instanceof Error ? loadError.message : "ไม่สามารถโหลดประกาศได้");
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    void load();
    return () => { isMounted = false; };
  }, []);

  return (
    <Container component="main" maxWidth="md" sx={{ py: 4, flexGrow: 1 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>โปรโมชั่นและประกาศจากร้าน</Typography>
      {isLoading ? <CircularProgress /> : error ? <Alert severity="error">{error}</Alert> : (
        <Stack spacing={2}>
          {items.length === 0 && <Alert severity="info">ขณะนี้ยังไม่มีโปรโมชั่นหรือประกาศใหม่</Alert>}
          {items.map((item) => (
            <Card key={item.id} variant="outlined">
              {item.imageUrl && (
                <Box component="img" src={item.imageUrl} alt={item.title} loading="lazy"
                  sx={{ width: "100%", maxHeight: 280, objectFit: "cover", display: "block" }}
                  onError={(event) => { event.currentTarget.style.display = "none"; }} />
              )}
              <CardContent>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                  <Chip size="small" color={item.type === ANNOUNCEMENTTYPE.PROMOTION ? "error" : "default"} label={TYPE_LABELS[item.type] ?? item.type} />
                  <Typography variant="caption" color="text.secondary">
                    {new Date(item.publishedAt ?? item.createdAt).toLocaleDateString("th-TH", { dateStyle: "long" })}
                  </Typography>
                </Stack>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>{item.title}</Typography>
                {item.content && <Typography sx={{ mt: 1, whiteSpace: "pre-wrap" }}>{item.content}</Typography>}
                {item.expiresAt && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                    ถึงวันที่ {new Date(item.expiresAt).toLocaleDateString("th-TH", { dateStyle: "long" })}
                  </Typography>
                )}
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
