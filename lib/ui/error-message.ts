
export function userSafeError(error: unknown): string | null {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.trim();
  if (!normalized) return "Something went wrong. Please try again.";
  const unsafe = /(stack|sql|database|mysql|postgres|drizzle|trpc|token|secret|authorization|internal|at\s+\S+\.tsx?:?\d*)/i;
  if (unsafe.test(normalized) || normalized.length > 220) {
    return "Something went wrong. Please try again or refresh the project.";
  }
  return normalized;
}


