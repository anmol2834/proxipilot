import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

export default function NotFound() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        p: 4,
        textAlign: "center",
      }}
    >
      <Typography variant="h2" component="h1" sx={{ fontWeight: 800, mb: 1 }}>
        404
      </Typography>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
        Page Not Found
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 460, mb: 4 }}>
        The page you are looking for does not exist or may have been moved.
      </Typography>
      <Link href="/" style={{ textDecoration: "none" }}>
        <Button variant="contained" color="primary">
          Return to Home
        </Button>
      </Link>
    </Box>
  );
}
