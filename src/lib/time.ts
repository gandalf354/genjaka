const APP_TIME_ZONE = 'Asia/Jakarta'

const getDateParts = (value: Date | string | number, options: Intl.DateTimeFormatOptions) => {
  const date = value instanceof Date ? value : new Date(value)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    ...options,
  })

  return formatter.formatToParts(date).reduce<Record<string, string>>((parts, part) => {
    if (part.type !== 'literal') {
      parts[part.type] = part.value
    }

    return parts
  }, {})
}

export const createJakartaFormatter = (locale: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, {
    timeZone: APP_TIME_ZONE,
    ...options,
  })

export const getJakartaDateKey = (value: Date | string | number = new Date()) => {
  const parts = getDateParts(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return `${parts.year}-${parts.month}-${parts.day}`
}

export const parseJakartaDateKey = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(Date.UTC(year, (month || 1) - 1, day || 1, 5, 0, 0))
}

export const getJakartaMonthStartFromDateKey = (value: string) => {
  const parsedDate = parseJakartaDateKey(value)
  return new Date(Date.UTC(parsedDate.getUTCFullYear(), parsedDate.getUTCMonth(), 1, 5, 0, 0))
}

export const shiftJakartaMonth = (value: Date, delta: number) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + delta, 1, 5, 0, 0))
