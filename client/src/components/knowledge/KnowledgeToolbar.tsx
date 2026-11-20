"use client";

import React, { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Popover from "@mui/material/Popover";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import { useKnowledgeStore } from "@/stores/knowledge.store";
import { KnowledgeCategory, KnowledgeStatus, KnowledgeSortOption } from "@/types/knowledge.types";

const CATEGORY_NAMES: Record<KnowledgeCategory, string> = {
  "products-services": "Products & Services",
  "company-info": "Company Info",
  policies: "Policies",
  "support-faqs": "Support & FAQs",
  "offers-promotions": "Offers & Promotions",
  "processes-timelines": "Processes & Timelines",
};

export function KnowledgeToolbar() {
  const {
    selectedCategory,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortOption,
    setSortOption,
    openAddDialog,
    totalCount,
  } = useKnowledgeStore();

  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [sortAnchorEl, setSortAnchorEl] = useState<null | HTMLElement>(null);
  const [filterAnchorEl, setFilterAnchorEl] = useState<null | HTMLElement>(null);
  const [addMenuAnchorEl, setAddMenuAnchorEl] = useState<null | HTMLElement>(null);

  // Debounce search update to store
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== searchQuery) {
        setSearchQuery(localSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, setSearchQuery]);

  // Keep local search in sync when store searchQuery changes from outside (e.g. URL query)
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  const filteredCount = totalCount;

  const currentCategoryTitle = CATEGORY_NAMES[selectedCategory] ?? "Products & Services";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: { xs: "flex-start", md: "center" },
        justifyContent: "space-between",
        flexDirection: { xs: "column", md: "row" },
        gap: 2.5,
        mb: 2.5,
      }}
    >
      {/* Left Title, Count Badge & Subtitle */}
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 0.5 }}>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              fontSize: { xs: "1.25rem", sm: "1.4rem" },
              color: "#0F172A",
              letterSpacing: "-0.02em",
            }}
          >
            {currentCategoryTitle}
          </Typography>
          <Box
            sx={{
              px: 1.25,
              py: 0.25,
              backgroundColor: "#F1F5F9",
              borderRadius: "9999px",
              border: "1px solid #E2E8F0",
            }}
          >
            <Typography
              sx={{
                fontSize: "0.72rem",
                fontWeight: 600,
                color: "#475569",
              }}
            >
              {filteredCount} items
            </Typography>
          </Box>
        </Box>
        <Typography sx={{ fontSize: "0.82rem", color: "#64748B" }}>
          Manage all your business knowledge in one place.
        </Typography>
      </Box>

      {/* Right Toolbar Controls: Search, Filters, Sort, Add */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.25,
          flexWrap: "wrap",
          width: { xs: "100%", md: "auto" },
        }}
      >
        {/* Search Input */}
        <TextField
          size="small"
          placeholder="Search knowledge..."
          value={localSearch}
          onChange={(e) => setLocalSearch(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Box sx={{ color: "#94A3B8", display: "flex", mr: 0.5 }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                  </Box>
                </InputAdornment>
              ),
            },
          }}
          sx={{
            minWidth: { xs: "100%", sm: 220 },
            "& .MuiOutlinedInput-root": {
              borderRadius: "10px",
              backgroundColor: "#FFFFFF",
              fontSize: "0.82rem",
              height: 38,
              "& fieldset": { borderColor: "#E2E8F0" },
              "&:hover fieldset": { borderColor: "#CBD5E1" },
              "&.Mui-focused fieldset": { borderColor: "#2563EB" },
            },
          }}
        />

        {/* Filters Button */}
        <Button
          variant="outlined"
          onClick={(e) => setFilterAnchorEl(e.currentTarget)}
          sx={{
            height: 38,
            borderRadius: "10px",
            borderColor: statusFilter !== "All" ? "#2563EB" : "#E2E8F0",
            backgroundColor: statusFilter !== "All" ? "#EFF6FF" : "#FFFFFF",
            color: statusFilter !== "All" ? "#2563EB" : "#334155",
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.82rem",
            px: 1.75,
            gap: 0.75,
            "&:hover": {
              borderColor: "#CBD5E1",
              backgroundColor: "#F8FAFC",
            },
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          Filters
          {statusFilter !== "All" && (
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#2563EB",
              }}
            />
          )}
        </Button>

        {/* Filter Popover */}
        <Popover
          open={Boolean(filterAnchorEl)}
          anchorEl={filterAnchorEl}
          onClose={() => setFilterAnchorEl(null)}
          disableScrollLock
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
          slotProps={{
            paper: {
              sx: {
                p: 2,
                width: 220,
                borderRadius: "12px",
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
                mt: 1,
              },
            },
          }}
        >
          <Typography sx={{ fontSize: "0.78rem", fontWeight: 700, color: "#0F172A", mb: 1 }}>
            Filter by Status
          </Typography>
          <FormControl fullWidth size="small">
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as KnowledgeStatus | "All")}
              sx={{ fontSize: "0.82rem", borderRadius: "8px" }}
            >
              <MenuItem value="All" sx={{ fontSize: "0.82rem" }}>All Statuses</MenuItem>
              <MenuItem value="Published" sx={{ fontSize: "0.82rem" }}>Published</MenuItem>
              <MenuItem value="Draft" sx={{ fontSize: "0.82rem" }}>Draft</MenuItem>
              <MenuItem value="Processing" sx={{ fontSize: "0.82rem" }}>Processing</MenuItem>
              <MenuItem value="Needs review" sx={{ fontSize: "0.82rem" }}>Needs review</MenuItem>
              <MenuItem value="Archived" sx={{ fontSize: "0.82rem" }}>Archived</MenuItem>
            </Select>
          </FormControl>
        </Popover>

        {/* Sort Button */}
        <Button
          variant="outlined"
          onClick={(e) => setSortAnchorEl(e.currentTarget)}
          sx={{
            height: 38,
            borderRadius: "10px",
            borderColor: "#E2E8F0",
            backgroundColor: "#FFFFFF",
            color: "#334155",
            textTransform: "none",
            fontWeight: 600,
            fontSize: "0.82rem",
            px: 1.75,
            gap: 0.75,
            "&:hover": {
              borderColor: "#CBD5E1",
              backgroundColor: "#F8FAFC",
            },
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <polyline points="19 12 12 19 5 12" />
          </svg>
          Sort
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </Button>

        {/* Sort Menu */}
        <Menu
          anchorEl={sortAnchorEl}
          open={Boolean(sortAnchorEl)}
          onClose={() => setSortAnchorEl(null)}
          disableScrollLock
          slotProps={{
            paper: {
              sx: {
                borderRadius: "12px",
                minWidth: 180,
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
                mt: 0.5,
              },
            },
          }}
        >
          {[
            { id: "updated-desc", label: "Recently updated" },
            { id: "updated-asc", label: "Oldest updated" },
            { id: "title-asc", label: "Name A-Z" },
            { id: "title-desc", label: "Name Z-A" },
            { id: "status", label: "Status" },
          ].map((opt) => (
            <MenuItem
              key={opt.id}
              selected={sortOption === opt.id}
              onClick={() => {
                setSortOption(opt.id as KnowledgeSortOption);
                setSortAnchorEl(null);
              }}
              sx={{ fontSize: "0.82rem", py: 0.75 }}
            >
              {opt.label}
            </MenuItem>
          ))}
        </Menu>

        {/* Add Knowledge Button with Split/Dropdown */}
        <Box sx={{ display: "flex", alignItems: "center" }}>
          <Button
            variant="contained"
            onClick={() => openAddDialog()}
            sx={{
              height: 38,
              borderRadius: "10px 0 0 10px",
              backgroundColor: "#2563EB",
              color: "#FFFFFF",
              textTransform: "none",
              fontWeight: 700,
              fontSize: "0.82rem",
              px: 2,
              gap: 0.75,
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
              "&:hover": { backgroundColor: "#1D4ED8" },
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add knowledge
          </Button>

          <Button
            variant="contained"
            onClick={(e) => setAddMenuAnchorEl(e.currentTarget)}
            sx={{
              height: 38,
              minWidth: 32,
              px: 0.75,
              borderRadius: "0 10px 10px 0",
              backgroundColor: "#1D4ED8",
              borderLeft: "1px solid rgba(255, 255, 255, 0.2)",
              color: "#FFFFFF",
              boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)",
              "&:hover": { backgroundColor: "#1E40AF" },
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </Button>
        </Box>

        {/* Add Knowledge Category Dropdown Menu */}
        <Menu
          anchorEl={addMenuAnchorEl}
          open={Boolean(addMenuAnchorEl)}
          onClose={() => setAddMenuAnchorEl(null)}
          disableScrollLock
          slotProps={{
            paper: {
              sx: {
                borderRadius: "12px",
                minWidth: 230,
                boxShadow: "0 10px 30px rgba(15, 23, 42, 0.12)",
                mt: 0.5,
              },
            },
          }}
        >
          <MenuItem
            onClick={() => {
              setAddMenuAnchorEl(null);
              openAddDialog("products-services");
            }}
            sx={{ fontSize: "0.82rem", py: 0.85 }}
          >
            Add product or service
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAddMenuAnchorEl(null);
              openAddDialog("policies");
            }}
            sx={{ fontSize: "0.82rem", py: 0.85 }}
          >
            Add company policy
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAddMenuAnchorEl(null);
              openAddDialog("support-faqs");
            }}
            sx={{ fontSize: "0.82rem", py: 0.85 }}
          >
            Add FAQ / question
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAddMenuAnchorEl(null);
              openAddDialog("offers-promotions");
            }}
            sx={{ fontSize: "0.82rem", py: 0.85 }}
          >
            Add offer or promotion
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAddMenuAnchorEl(null);
              openAddDialog("processes-timelines");
            }}
            sx={{ fontSize: "0.82rem", py: 0.85 }}
          >
            Add process or timeline
          </MenuItem>
          <MenuItem
            onClick={() => {
              setAddMenuAnchorEl(null);
              openAddDialog("company-info");
            }}
            sx={{ fontSize: "0.82rem", py: 0.85 }}
          >
            Add company info
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
}
