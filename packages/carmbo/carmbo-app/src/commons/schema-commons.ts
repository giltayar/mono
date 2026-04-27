import z from 'zod'

export function itemPickerSchema() {
  return z
    .string()
    .transform((val) => val.split(':')[0])
    .transform((val) => {
      const parsed = parseInt(val, 10)
      return isNaN(parsed) ? undefined : parsed
    })
    .optional()
}

export function stringItemPickerSchema() {
  return z
    .string()
    .transform((val) => val.split(':')[0].trim())
    .optional()
}
