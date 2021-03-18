export function compareObjects<T = object>(haystack: T, needle: Partial<T>) {
  let isOverlaped = false;
  for (const [key, value] of Object.entries(needle)) {
    if (haystack[key] !== value) {
      isOverlaped = false;
      break;
    }
    isOverlaped = true;
  }

  return isOverlaped;
}
