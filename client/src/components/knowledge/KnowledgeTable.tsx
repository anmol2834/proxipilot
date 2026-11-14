"use client";

import React, { useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Checkbox from "@mui/material/Checkbox";
import { CustomCheckbox } from "@/components/ui/CustomCheckbox";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import Divider from "@mui/material/Divider";
import Button from "@mui/material/Button";
import { useKnowledgeStore } from "@/stores/knowledge.store";
import { KnowledgeItem, KnowledgeCategory, KnowledgeStatus } from "@/types/knowledge.types";

interface KnowledgeTableProps {
  currentPageItems: KnowledgeItem[];
}

export function KnowledgeTable({ currentPageItems }: KnowledgeTableProps) {
  const {
    selectedIds,
    toggleSelectId,
    selectAllOnPage,
    openEditDialog,
    openDeleteDialog,
    duplicateKnowledgeItem,
    bulkUpdateStatus,
    openAddDialog,
  } = useKnowledgeStore();

  const [moreMenuAnchor, setMoreMenuAnchor] = useState<{
    el: HTMLElement;
    item: KnowledgeItem;
  } | null>(null);

  const currentPageItemIds = currentPageItems.map((item) => item.id);
  const isAllSelected =
    currentPageItems.length > 0 &&
    currentPageItems.every((item) => selectedIds.includes(item.id));
  const isSomeSelected =
    currentPageItems.some((item) => selectedIds.includes(item.id)) && !isAllSelected;

  // Helper for category pill badge colors
  const getCategoryBadgeStyle = (category: KnowledgeCategory) => {
    switch (category) {
      case "products-services":
        return { bg: "#EFF6FF", color: "#2563EB", border: "#DBEAFE", label: "Products & Services" };
      case "policies":
        return { bg: "#F0FDFA", color: "#0D9488", border: "#CCFBF1", label: "Policies" };
      case "contacts":
        return { bg: "#F0FDF4", color: "#16A34A", border: "#DCFCE7", label: "Contacts" };
      case "offers-promotions":
        return { bg: "#FFFBEB", color: "#D97706", border: "#FEF3C7", label: "Offers & Promotions" };
      case "locations":
        return { bg: "#EEF2FF", color: "#6366F1", border: "#E0E7FF", label: "Locations" };
      case "company-info":
        return { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0", label: "Company Info" };
      case "support-faqs":
        return { bg: "#F0F9FF", color: "#0284C7", border: "#E0F2FE", label: "Support & FAQs" };
      case "operations":
        return { bg: "#ECFDF5", color: "#059669", border: "#D1FAE5", label: "Operations" };
      case "brand-communication":
        return { bg: "#FFF1F2", color: "#E11D48", border: "#FFE4E6", label: "Brand & Communication" };
      default:
        return { bg: "#F1F5F9", color: "#475569", border: "#E2E8F0", label: category };
    }
  };

  // Helper for item icon
  const renderItemIcon = (category: KnowledgeCategory, _type: string) => {
    switch (category) {
      case "products-services":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        );
      case "policies":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0D9488" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        );
      case "contacts":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        );
      case "offers-promotions":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 12 20 22 4 22 4 12" />
            <rect width="20" height="5" x="2" y="7" />
            <line x1="12" y1="22" x2="12" y2="7" />
            <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
            <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
          </svg>
        );
      case "locations":
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
    }
  };


  // Status Badge Helper
  const renderStatusBadge = (status: KnowledgeStatus) => {
    switch (status) {
      case "Published":
        return (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.35,
              borderRadius: "9999px",
              backgroundColor: "#ECFDF5",
              border: "1px solid #D1FAE5",
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#16A34A",
              }}
            />
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#16A34A" }}>
              Published
            </Typography>
          </Box>
        );
      case "Draft":
        return (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.35,
              borderRadius: "9999px",
              backgroundColor: "#F8FAFC",
              border: "1px solid #E2E8F0",
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#64748B",
              }}
            />
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#64748B" }}>
              Draft
            </Typography>
          </Box>
        );
      case "Processing":
        return (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.35,
              borderRadius: "9999px",
              backgroundColor: "#EFF6FF",
              border: "1px solid #DBEAFE",
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#2563EB",
              }}
            />
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#2563EB" }}>
              Processing
            </Typography>
          </Box>
        );
      default:
        return (
          <Box
            sx={{
              display: "inline-flex",
              alignItems: "center",
              gap: 0.75,
              px: 1.25,
              py: 0.35,
              borderRadius: "9999px",
              backgroundColor: "#FFFBEB",
              border: "1px solid #FEF3C7",
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#D97706",
              }}
            />
            <Typography sx={{ fontSize: "0.74rem", fontWeight: 600, color: "#D97706" }}>
              {status}
            </Typography>
          </Box>
        );
    }
  };

  if (currentPageItems.length === 0) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          borderRadius: "16px",
          border: "1px dashed #CBD5E1",
          backgroundColor: "#FFFFFF",
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: "12px",
            backgroundColor: "#EFF6FF",
            color: "#2563EB",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            mb: 2,
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Box>
        <Typography sx={{ fontSize: "1.05rem", fontWeight: 700, color: "#0F172A", mb: 0.5 }}>
          No knowledge items found
        </Typography>
        <Typography sx={{ fontSize: "0.85rem", color: "#64748B", maxWidth: 420, mb: 2.5 }}>
          No records match your selected filters or search query. Try adjusting your search or add new knowledge.
        </Typography>
        <Button
          variant="contained"
          size="small"
          onClick={() => openAddDialog()}
          sx={{
            backgroundColor: "#2563EB",
            color: "#FFFFFF",
            textTransform: "none",
            fontWeight: 700,
            borderRadius: "8px",
            px: 2.5,
          }}
        >
          + Add Knowledge
        </Button>
      </Paper>
    );
  }

  return (
    <>
      {/* Desktop Table View (>=900px) */}
      <Paper
        elevation={0}
        sx={{
          display: { xs: "none", md: "block" },
          borderRadius: "16px",
          border: "1px solid #EEF2F6",
          backgroundColor: "#FFFFFF",
          overflow: "hidden",
        }}
      >
        <Box
          component="table"
          sx={{
            width: "100%",
            borderCollapse: "collapse",
            textAlign: "left",
          }}
        >
          {/* Table Header */}
          <Box component="thead" sx={{ backgroundColor: "#F8FAFC", borderBottom: "1px solid #EEF2F6" }}>
            <Box component="tr">
              <Box component="th" sx={{ width: 44, pl: 2.5, pr: 1, py: 1.5 }}>
                <CustomCheckbox
                  size="sm"
                  checked={isAllSelected}
                  indeterminate={isSomeSelected}
                  onChange={() => selectAllOnPage(currentPageItemIds)}
                  variant="blue"
                  ariaLabel="Select all items on this page"
                />
              </Box>
              <Box component="th" sx={{ py: 1.5, px: 1.5, fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>
                Title ⇅
              </Box>
              <Box component="th" sx={{ py: 1.5, px: 1.5, fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>
                Category
              </Box>
              <Box component="th" sx={{ py: 1.5, px: 1.5, fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>
                Updated
              </Box>
              <Box component="th" sx={{ py: 1.5, px: 1.5, fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>
                Status ⇅
              </Box>
              <Box component="th" sx={{ py: 1.5, px: 2, textAlign: "right", fontSize: "0.78rem", fontWeight: 700, color: "#64748B" }}>
                Actions
              </Box>
            </Box>
          </Box>

          {/* Table Body */}
          <Box component="tbody">
            {currentPageItems.map((item, idx) => {
              const isSelected = selectedIds.includes(item.id);
              const catBadge = getCategoryBadgeStyle(item.category);

              return (
                <Box
                  component="tr"
                  key={item.id}
                  sx={{
                    borderBottom:
                      idx === currentPageItems.length - 1
                        ? "none"
                        : "1px solid #F1F5F9",
                    backgroundColor: isSelected ? "#F8FAFF" : "#FFFFFF",
                    transition: "background-color 150ms ease",
                    "&:hover": {
                      backgroundColor: isSelected ? "#F0F7FF" : "#FAFAFC",
                    },
                  }}
                >
                  {/* Select Checkbox */}
                  <Box component="td" sx={{ pl: 2.5, pr: 1, py: 1.75 }}>
                    <CustomCheckbox
                      size="sm"
                      checked={isSelected}
                      onChange={() => toggleSelectId(item.id)}
                      variant="blue"
                      ariaLabel={`Select ${item.title}`}
                    />
                  </Box>

                  {/* Title + Icon + Excerpt */}
                  <Box component="td" sx={{ py: 1.75, px: 1.5, maxWidth: 300 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: "10px",
                          backgroundColor: "#EFF6FF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {renderItemIcon(item.category, item.type)}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          sx={{
                            fontSize: "0.86rem",
                            fontWeight: 700,
                            color: "#0F172A",
                            lineHeight: 1.25,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.title}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: "0.74rem",
                            color: "#64748B",
                            mt: 0.3,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {item.excerpt}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>

                  {/* Category Pill Badge */}
                  <Box component="td" sx={{ py: 1.75, px: 1.5 }}>
                    <Box
                      sx={{
                        display: "inline-block",
                        px: 1.25,
                        py: 0.35,
                        borderRadius: "9999px",
                        backgroundColor: catBadge.bg,
                        border: `1px solid ${catBadge.border}`,
                      }}
                    >
                      <Typography
                        sx={{
                          fontSize: "0.72rem",
                          fontWeight: 600,
                          color: catBadge.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {catBadge.label}
                      </Typography>
                    </Box>
                  </Box>


                  {/* Updated Timestamp */}
                  <Box component="td" sx={{ py: 1.75, px: 1.5 }}>
                    <Typography sx={{ fontSize: "0.78rem", color: "#0F172A", fontWeight: 500 }}>
                      {item.updatedAt}
                    </Typography>
                    <Typography sx={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                      by {item.updatedBy}
                    </Typography>
                  </Box>

                  {/* Status */}
                  <Box component="td" sx={{ py: 1.75, px: 1.5 }}>
                    {renderStatusBadge(item.status)}
                  </Box>

                  {/* Row Action Icons */}
                  <Box component="td" sx={{ py: 1.75, px: 2, textAlign: "right" }}>
                    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={() => openEditDialog(item)}
                        title="Edit"
                        sx={{
                          color: "#64748B",
                          p: 0.75,
                          "&:hover": { color: "#2563EB", backgroundColor: "#EFF6FF" },
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={() => duplicateKnowledgeItem(item.id)}
                        title="Duplicate"
                        sx={{
                          color: "#64748B",
                          p: 0.75,
                          "&:hover": { color: "#2563EB", backgroundColor: "#EFF6FF" },
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={(e) => setMoreMenuAnchor({ el: e.currentTarget, item })}
                        title="More actions"
                        sx={{
                          color: "#64748B",
                          p: 0.75,
                          "&:hover": { color: "#0F172A", backgroundColor: "#F1F5F9" },
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <circle cx="12" cy="12" r="1" />
                          <circle cx="19" cy="12" r="1" />
                          <circle cx="5" cy="12" r="1" />
                        </svg>
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Paper>

      {/* Mobile Card View (<900px) */}
      <Box sx={{ display: { xs: "flex", md: "none" }, flexDirection: "column", gap: 1.75 }}>
        {currentPageItems.map((item) => {
          const isSelected = selectedIds.includes(item.id);
          const catBadge = getCategoryBadgeStyle(item.category);

          return (
            <Paper
              key={item.id}
              elevation={0}
              sx={{
                p: 2,
                borderRadius: "14px",
                border: isSelected ? "1.5px solid #2563EB" : "1px solid #EEF2F6",
                backgroundColor: isSelected ? "#F8FAFF" : "#FFFFFF",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, mb: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <CustomCheckbox
                    size="sm"
                    checked={isSelected}
                    onChange={() => toggleSelectId(item.id)}
                    variant="blue"
                    ariaLabel={`Select ${item.title}`}
                  />
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: "8px",
                      backgroundColor: "#EFF6FF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {renderItemIcon(item.category, item.type)}
                  </Box>
                  <Box>
                    <Typography sx={{ fontSize: "0.88rem", fontWeight: 700, color: "#0F172A" }}>
                      {item.title}
                    </Typography>
                    <Typography sx={{ fontSize: "0.74rem", color: "#64748B" }}>
                      {item.excerpt}
                    </Typography>
                  </Box>
                </Box>

                <IconButton
                  size="small"
                  onClick={(e) => setMoreMenuAnchor({ el: e.currentTarget, item })}
                  sx={{ color: "#64748B" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <circle cx="12" cy="12" r="1" />
                    <circle cx="19" cy="12" r="1" />
                    <circle cx="5" cy="12" r="1" />
                  </svg>
                </IconButton>
              </Box>

              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
                <Box
                  sx={{
                    px: 1,
                    py: 0.25,
                    borderRadius: "9999px",
                    backgroundColor: catBadge.bg,
                    border: `1px solid ${catBadge.border}`,
                  }}
                >
                  <Typography sx={{ fontSize: "0.7rem", fontWeight: 600, color: catBadge.color }}>
                    {catBadge.label}
                  </Typography>
                </Box>

                {renderStatusBadge(item.status)}

                <Typography sx={{ fontSize: "0.72rem", color: "#94A3B8" }}>
                  {item.updatedAt}
                </Typography>
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* Row More Actions Menu */}
      <Menu
        anchorEl={moreMenuAnchor?.el}
        open={Boolean(moreMenuAnchor)}
        onClose={() => setMoreMenuAnchor(null)}
        disableScrollLock
        slotProps={{
          paper: {
            sx: {
              borderRadius: "12px",
              minWidth: 160,
              boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
              mt: 0.5,
            },
          },
        }}
      >
        <MenuItem
          onClick={() => {
            if (moreMenuAnchor) openEditDialog(moreMenuAnchor.item);
            setMoreMenuAnchor(null);
          }}
          sx={{ fontSize: "0.82rem", py: 0.75, color: "#334155" }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#64748B" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </ListItemIcon>
          Edit
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (moreMenuAnchor) duplicateKnowledgeItem(moreMenuAnchor.item.id);
            setMoreMenuAnchor(null);
          }}
          sx={{ fontSize: "0.82rem", py: 0.75, color: "#334155" }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#64748B" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          </ListItemIcon>
          Duplicate
        </MenuItem>

        <MenuItem
          onClick={() => {
            if (moreMenuAnchor) {
              const newStatus = moreMenuAnchor.item.status === "Published" ? "Archived" : "Published";
              bulkUpdateStatus([moreMenuAnchor.item.id], newStatus);
            }
            setMoreMenuAnchor(null);
          }}
          sx={{ fontSize: "0.82rem", py: 0.75, color: "#334155" }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#64748B" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="21 8 21 21 3 21 3 8" />
              <rect width="22" height="5" x="1" y="3" />
              <line x1="10" y1="12" x2="14" y2="12" />
            </svg>
          </ListItemIcon>
          {moreMenuAnchor?.item.status === "Published" ? "Archive" : "Publish"}
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            if (moreMenuAnchor) openDeleteDialog(moreMenuAnchor.item);
            setMoreMenuAnchor(null);
          }}
          sx={{ fontSize: "0.82rem", py: 0.75, color: "#EF4444", fontWeight: 600 }}
        >
          <ListItemIcon sx={{ minWidth: 26, color: "#EF4444" }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
          </ListItemIcon>
          Delete
        </MenuItem>
      </Menu>
    </>
  );
}
