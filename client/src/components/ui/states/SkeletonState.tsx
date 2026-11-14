import * as React from "react";
import { Box, Card, CardContent, Skeleton, Stack } from "@mui/material";

export interface SkeletonListProps {
  count?: number;
  itemHeight?: number;
}

export function SkeletonList({ count = 5, itemHeight = 60 }: SkeletonListProps) {
  return (
    <Stack spacing={1.5} sx={{ width: "100%" }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton
          key={i}
          variant="rounded"
          height={itemHeight}
          animation="wave"
          sx={{ borderRadius: 1.5 }}
        />
      ))}
    </Stack>
  );
}

export interface SkeletonCardGridProps {
  count?: number;
}

export function SkeletonCardGrid({ count = 6 }: SkeletonCardGridProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, 1fr)",
          md: "repeat(3, 1fr)",
        },
        gap: 3,
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} variant="outlined">
          <CardContent>
            <Skeleton variant="text" width="60%" height={28} sx={{ mb: 1 }} />
            <Skeleton variant="text" width="90%" height={20} />
            <Skeleton variant="text" width="75%" height={20} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={36} width="40%" />
          </CardContent>
        </Card>
      ))}
    </Box>
  );
}
