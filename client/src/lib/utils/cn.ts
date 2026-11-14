type ClassValue =
  string | number | boolean | undefined | null | { [key: string]: boolean | undefined | null };

/**
 * Lightweight, zero-dependency className composer
 */
export function cn(...classes: ClassValue[]): string {
  const result: string[] = [];

  for (const item of classes) {
    if (!item) continue;

    if (typeof item === "string" || typeof item === "number") {
      result.push(String(item));
    } else if (typeof item === "object") {
      for (const [key, value] of Object.entries(item)) {
        if (value) {
          result.push(key);
        }
      }
    }
  }

  return result.join(" ");
}
