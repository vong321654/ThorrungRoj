"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert, Box, Button, Chip, Container, Paper, Stack, TextField, Typography } from "@mui/material";
import { createClient } from "@/app/api/util/supabase/client";
import type { APIRESULT } from "@/app/api/response";

type ChatMessage = { id: number; from: "user" | "bot"; text: string; imageUrl?: string | null };
type ChatReply = { reply: string; imageUrl: string | null; quickReplies: string[] };

const WELCOME: ChatMessage = {
  id: 0,
  from: "bot",
  text: "สวัสดีครับ ผมเป็นแชทบอทของก๊าซทอรุ่งโรจน์ ถามราคาสินค้าหรือปัญหาการใช้แก๊สได้เลยครับ เช่น \"ราคาถัง 15 กก.\" หรือ \"หัวปรับรั่ว\"",
};
const DEFAULT_QUICK_REPLIES = ["ราคาถังแก๊ส", "หัวปรับแก๊สรั่ว", "เตาแก๊สจุดไม่ติด", "ได้กลิ่นแก๊ส", "วิธีสั่งซื้อ", "การชำระเงิน"];

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [quickReplies, setQuickReplies] = useState<string[]>(DEFAULT_QUICK_REPLIES);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(1);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isSending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || isSending) return;

    setError(null);
    setInput("");
    setMessages((current) => [...current, { id: nextId.current++, from: "user", text: message }]);
    setIsSending(true);
    try {
      // แนบ token ถ้าล็อกอินอยู่ เพื่อให้เซิร์ฟเวอร์บันทึกประวัติแชท ถ้าไม่ล็อกอินก็ถามได้ตามปกติ
      const { data } = await createClient().auth.getSession();
      const token = data.session?.access_token;
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ message }),
      });
      const result = (await response.json()) as APIRESULT<ChatReply>;
      if (!response.ok || result.status === "error") throw new Error(result.message);
      setMessages((current) => [
        ...current,
        { id: nextId.current++, from: "bot", text: result.results.reply, imageUrl: result.results.imageUrl },
      ]);
      if (result.results.quickReplies.length > 0) setQuickReplies(result.results.quickReplies);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "ส่งข้อความไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setIsSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send(input);
  }

  return (
    <Container component="main" maxWidth="sm" sx={{ py: 3, flexGrow: 1, display: "flex", flexDirection: "column" }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>แชทบอทช่วยเหลือ</Typography>
      <Paper variant="outlined" sx={{ flexGrow: 1, p: 2, minHeight: 360, maxHeight: "60vh", overflowY: "auto", bgcolor: "#f9fafb" }}>
        <Stack spacing={1.5}>
          {messages.map((message) => (
            <Box key={message.id} sx={{ display: "flex", justifyContent: message.from === "user" ? "flex-end" : "flex-start" }}>
              <Box
                sx={{
                  maxWidth: "85%",
                  px: 1.75,
                  py: 1,
                  borderRadius: 2,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  bgcolor: message.from === "user" ? "primary.main" : "background.paper",
                  color: message.from === "user" ? "primary.contrastText" : "text.primary",
                  border: message.from === "user" ? "none" : "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="body2" component="div">{message.text}</Typography>
                {message.imageUrl && (
                  <Box component="img" src={message.imageUrl} alt="ภาพประกอบ" loading="lazy"
                    sx={{ mt: 1, maxWidth: "100%", borderRadius: 1 }}
                    onError={(event) => { event.currentTarget.style.display = "none"; }} />
                )}
              </Box>
            </Box>
          ))}
          {isSending && (
            <Typography variant="caption" color="text.secondary">กำลังพิมพ์...</Typography>
          )}
          <div ref={bottomRef} />
        </Stack>
      </Paper>

      {error && <Alert severity="error" sx={{ mt: 1 }}>{error}</Alert>}

      <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: "wrap", rowGap: 1 }}>
        {quickReplies.map((reply) => (
          <Chip key={reply} label={reply} variant="outlined" clickable disabled={isSending} onClick={() => void send(reply)} />
        ))}
      </Stack>

      <Box component="form" onSubmit={handleSubmit} sx={{ display: "flex", gap: 1, mt: 1.5 }}>
        <TextField
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="พิมพ์คำถาม เช่น ราคาถัง 15 กก."
          size="small"
          fullWidth
          slotProps={{ htmlInput: { maxLength: 500 } }}
        />
        <Button type="submit" variant="contained" disabled={isSending || !input.trim()}>ส่ง</Button>
      </Box>
    </Container>
  );
}
