import { Components, Theme } from "@mui/material";

export const components: Components<Theme> = {
  MuiCssBaseline: {
    styleOverrides: {
      html: {
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar": {
          display: "none !important",
          width: "0 !important",
          height: "0 !important",
        },
      },
      body: {
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        "&::-webkit-scrollbar, & *::-webkit-scrollbar": {
          display: "none !important",
          width: "0 !important",
          height: "0 !important",
        },
      },
    },
  },
  MuiModal: {
    defaultProps: {
      disableScrollLock: true,
    },
  },
  MuiButton: {
    defaultProps: {
      disableElevation: true,
    },
    styleOverrides: {
      root: {
        borderRadius: 8,
        fontWeight: 600,
        textTransform: "none",
        padding: "8px 16px",
        transition: "all 150ms cubic-bezier(0.4, 0, 0.2, 1)",
      },
      contained: {
        "&:hover": {
          boxShadow: "0 4px 12px rgba(79, 70, 229, 0.25)",
        },
      },
      outlined: {
        borderWidth: 1.5,
        "&:hover": {
          borderWidth: 1.5,
        },
      },
    },
  },
  MuiPaper: {
    defaultProps: {
      elevation: 0,
    },
    styleOverrides: {
      root: {
        backgroundImage: "none",
        borderRadius: 12,
        border: "1px solid var(--border-subtle)",
      },
    },
  },
  MuiCard: {
    defaultProps: {
      elevation: 0,
    },
    styleOverrides: {
      root: {
        borderRadius: 12,
        border: "1px solid var(--border-subtle)",
        backgroundImage: "none",
      },
    },
  },
  MuiTextField: {
    defaultProps: {
      variant: "outlined",
      size: "small",
    },
    styleOverrides: {
      root: {
        "& .MuiOutlinedInput-root": {
          borderRadius: 8,
        },
      },
    },
  },
  MuiOutlinedInput: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
  MuiDialog: {
    defaultProps: {
      disableScrollLock: true,
    },
    styleOverrides: {
      paper: {
        borderRadius: 16,
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      },
    },
  },
  MuiDrawer: {
    styleOverrides: {
      paper: {
        borderRight: "1px solid var(--border-subtle)",
      },
    },
  },
  MuiTooltip: {
    styleOverrides: {
      tooltip: {
        borderRadius: 6,
        fontSize: "0.75rem",
        fontWeight: 500,
      },
    },
  },
  MuiChip: {
    styleOverrides: {
      root: {
        borderRadius: 6,
        fontWeight: 500,
      },
    },
  },
  MuiAlert: {
    styleOverrides: {
      root: {
        borderRadius: 8,
      },
    },
  },
};
