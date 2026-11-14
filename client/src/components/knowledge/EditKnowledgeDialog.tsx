"use client";

import React, { useState } from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import IconButton from "@mui/material/IconButton";
import { useKnowledgeStore } from "@/stores/knowledge.store";
import { KnowledgeItem, KnowledgeStatus } from "@/types/knowledge.types";

interface ExtendedItemProps {
  pricing?: string;
  warranty?: string;
  email?: string;
  phone?: string;
  conditions?: string;
  question?: string;
  answer?: string;
  discount?: string;
  code?: string;
  city?: string;
}

function EditKnowledgeForm({
  item,
  onClose,
}: {
  item: KnowledgeItem;
  onClose: () => void;
}) {
  const { updateKnowledgeItem } = useKnowledgeStore();
  const ext = item as unknown as ExtendedItemProps;

  const [title, setTitle] = useState(item.title || "");
  const [excerpt, setExcerpt] = useState(item.excerpt || "");
  const [status, setStatus] = useState<KnowledgeStatus>(item.status || "Published");
  const [pricing, setPricing] = useState(ext.pricing || "");
  const [warranty, setWarranty] = useState(ext.warranty || "");
  const [email, setEmail] = useState(ext.email || "");
  const [phone, setPhone] = useState(ext.phone || "");
  const [conditions, setConditions] = useState(ext.conditions || "");
  const [question, setQuestion] = useState(ext.question || "");
  const [answer, setAnswer] = useState(ext.answer || "");
  const [discount, setDiscount] = useState(ext.discount || "");
  const [code, setCode] = useState(ext.code || "");
  const [city, setCity] = useState(ext.city || "");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = "Title is required.";
    }
    if (!excerpt.trim()) {
      newErrors.excerpt = "Summary excerpt is required.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    updateKnowledgeItem(item.id, {
      title: title.trim(),
      excerpt: excerpt.trim(),
      status,
      pricing: pricing ? pricing.trim() : undefined,
      warranty: warranty ? warranty.trim() : undefined,
      email: email ? email.trim() : undefined,
      phone: phone ? phone.trim() : undefined,
      conditions: conditions ? conditions.trim() : undefined,
      question: question ? question.trim() : undefined,
      answer: answer ? answer.trim() : undefined,
      discount: discount ? discount.trim() : undefined,
      code: code ? code.trim() : undefined,
      city: city ? city.trim() : undefined,
    } as unknown as Partial<KnowledgeItem>);
  };

  return (
    <Box component="form" onSubmit={handleSubmit}>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", pb: 1 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: "1.15rem", color: "#0F172A" }}>
            Edit Knowledge Item
          </Typography>
          <Typography sx={{ fontSize: "0.78rem", color: "#64748B" }}>
            Version {item.version} • Last updated {item.updatedAt}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: "#94A3B8" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 1.5 }}>
        {/* Title */}
        <Box>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#0F172A", mb: 0.5 }}>
            Title *
          </Typography>
          <TextField
            fullWidth
            size="small"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            error={Boolean(errors.title)}
            helperText={errors.title}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
          />
        </Box>

        {/* Excerpt */}
        <Box>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#0F172A", mb: 0.5 }}>
            Summary excerpt *
          </Typography>
          <TextField
            fullWidth
            size="small"
            multiline
            rows={2}
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            error={Boolean(errors.excerpt)}
            helperText={errors.excerpt}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
          />
        </Box>

        {/* Category Specific Fields */}
        {item.category === "products-services" && (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
                Pricing / Rate
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={pricing}
                onChange={(e) => setPricing(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
                Warranty / Guarantee
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={warranty}
                onChange={(e) => setWarranty(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
              />
            </Box>
          </Box>
        )}

        {item.category === "contacts" && (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
                Email
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
                Phone
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
              />
            </Box>
          </Box>
        )}

        {item.category === "policies" && (
          <Box>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
              Key Policy Rules & Conditions
            </Typography>
            <TextField
              fullWidth
              size="small"
              multiline
              rows={2}
              value={conditions}
              onChange={(e) => setConditions(e.target.value)}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
            />
          </Box>
        )}

        {item.category === "support-faqs" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
                Customer Question
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
                Standard Answer
              </Typography>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
              />
            </Box>
          </Box>
        )}

        {item.category === "offers-promotions" && (
          <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1.5 }}>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
                Discount
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
              />
            </Box>
            <Box>
              <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
                Code
              </Typography>
              <TextField
                fullWidth
                size="small"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
              />
            </Box>
          </Box>
        )}

        {item.category === "locations" && (
          <Box>
            <Typography sx={{ fontSize: "0.8rem", fontWeight: 600, color: "#0F172A", mb: 0.5 }}>
              Coverage Area / Cities
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
            />
          </Box>
        )}

        {/* Status Select */}
        <Box>
          <Typography sx={{ fontSize: "0.8rem", fontWeight: 700, color: "#0F172A", mb: 0.5 }}>
            Status
          </Typography>
          <TextField
            select
            fullWidth
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value as KnowledgeStatus)}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: "9px" } }}
          >
            <MenuItem value="Published">Published (Active for AI triage)</MenuItem>
            <MenuItem value="Draft">Draft (Internal only)</MenuItem>
            <MenuItem value="Needs review">Needs review (Flagged for update)</MenuItem>
            <MenuItem value="Archived">Archived (Disabled)</MenuItem>
          </TextField>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5 }}>
        <Button
          type="button"
          onClick={onClose}
          variant="outlined"
          sx={{
            textTransform: "none",
            borderColor: "#E2E8F0",
            color: "#475569",
            borderRadius: "9px",
          }}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          variant="contained"
          sx={{
            textTransform: "none",
            backgroundColor: "#2563EB",
            borderRadius: "9px",
            fontWeight: 700,
            px: 2.5,
            "&:hover": { backgroundColor: "#1D4ED8" },
          }}
        >
          Update Knowledge Item
        </Button>
      </DialogActions>
    </Box>
  );
}

export function EditKnowledgeDialog() {
  const { editingItem, closeEditDialog } = useKnowledgeStore();

  if (!editingItem) return null;

  return (
    <Dialog
      open={Boolean(editingItem)}
      onClose={closeEditDialog}
      disableScrollLock
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            borderRadius: "16px",
            p: 1,
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.16)",
          },
        },
      }}
    >
      <EditKnowledgeForm
        key={editingItem.id}
        item={editingItem}
        onClose={closeEditDialog}
      />
    </Dialog>
  );
}
