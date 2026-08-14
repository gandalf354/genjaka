const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Jakarta'
const JAKARTA_OFFSET = '+07:00'

type DateInput = Date | string | number

const getDateParts = (value: DateInput, options: Intl.DateTimeFormatOptions) => {
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

export const getJakartaTimestamp = (value: DateInput = new Date()) => {
  const parts = getDateParts(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${JAKARTA_OFFSET}`
}

export const getJakartaDateKey = (value: DateInput = new Date()) => {
  const parts = getDateParts(value, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })

  return `${parts.year}-${parts.month}-${parts.day}`
}

export const getJakartaSqlTimestamp = (value: DateInput = new Date()) => getJakartaTimestamp(value).slice(0, 19).replace('T', ' ')

export const toJakartaDateKeyFromDatabase = (value: DateInput | null | undefined) => {
  if (!value) return null
  return getJakartaDateKey(value)
}

export const toJakartaTimestampFromDatabase = (value: DateInput | null | undefined) => {
  if (!value) return getJakartaTimestamp()
  return getJakartaTimestamp(value)
}

export const getJakartaDateFromKey = (value: string) => new Date(`${value}T12:00:00${JAKARTA_OFFSET}`)

export const appTimeZone = APP_TIME_ZONE
