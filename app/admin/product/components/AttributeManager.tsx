"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import { AdminRole } from "@/app/models/admin";
import { useRequireAdmin } from "../../useRequireAdmin";

export type AttributeItem = {
  id: number;
  label: string;
};

type AttributeManagerProps = {
  title: string;
  fetchItems: () => Promise<AttributeItem[]>;
  addItem: (label: string) => Promise<unknown>;
  updateItem: (id: number, label: string) => Promise<unknown>;
  deleteItem: (id: number) => Promise<unknown>;
};

export default function AttributeManager({
  title,
  fetchItems,
  addItem,
  updateItem,
  deleteItem,
}: AttributeManagerProps) {
  const { isAllowed } = useRequireAdmin({ role: AdminRole.SuperAdmin, redirectTo: "/admin/product" });
  const [items, setItems] = useState<AttributeItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [labelInput, setLabelInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadItems() {
    try {
      setItems(await fetchItems());
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถโหลดข้อมูลได้");
    }
  }

  useEffect(() => {
    if (!isAllowed) return;
    let isCancelled = false;

    async function init() {
      await loadItems();
      if (!isCancelled) setIsLoading(false);
    }

    void init();
    return () => {
      isCancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAllowed]);

  function openAddDialog() {
    setEditingId(null);
    setLabelInput("");
    setDialogOpen(true);
  }

  function openEditDialog(item: AttributeItem) {
    setEditingId(item.id);
    setLabelInput(item.label);
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!labelInput.trim()) return;
    setIsSaving(true);
    try {
      if (editingId === null) {
        await addItem(labelInput.trim());
      } else {
        await updateItem(editingId, labelInput.trim());
      }
      setDialogOpen(false);
      await loadItems();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถบันทึกข้อมูลได้");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm("ต้องการลบรายการนี้ใช่หรือไม่?")) return;
    try {
      await deleteItem(id);
      await loadItems();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ไม่สามารถลบข้อมูลได้");
    }
  }

  if (isLoading || !isAllowed) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography>กำลังตรวจสอบสิทธิ์...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ mb: 2 }}>
        <Link href="/admin/product">← กลับไปหน้ารายการสินค้า</Link>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h5">{title}</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAddDialog}>
          เพิ่มรายการ
        </Button>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {errorMessage}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table size="medium">
          <TableHead>
            <TableRow>
              <TableCell>ชื่อ</TableCell>
              <TableCell align="right">จัดการ</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.label}</TableCell>
                <TableCell align="right">
                  <IconButton sx={{ color: "black" }} onClick={() => openEditDialog(item)}>
                    <EditIcon />
                  </IconButton>
                  <IconButton color="inherit" onClick={() => void handleDelete(item.id)}>
                    <DeleteIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={2} align="center">
                  ไม่มีข้อมูล
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{editingId === null ? "เพิ่มรายการ" : "แก้ไขรายการ"}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="ชื่อ"
            value={labelInput}
            onChange={(event) => setLabelInput(event.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
          <Button variant="contained" disabled={isSaving || !labelInput.trim()} onClick={() => void handleSave()}>
            บันทึก
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
