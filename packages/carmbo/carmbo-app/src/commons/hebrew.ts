export function hebrew(
  hebrewText: string,
  placeholderValues: Record<string, string | number>,
): string {
  let result = hebrewText

  for (const [key, value] of Object.entries(placeholderValues)) {
    result = result.replaceAll(key, value.toString())
  }

  return result
}
