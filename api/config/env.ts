import dotenv from 'dotenv'

dotenv.config()

const appTimeZone = process.env.APP_TIME_ZONE || 'Asia/Jakarta'
process.env.TZ = appTimeZone

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  jwtSecret: process.env.JWT_SECRET || 'genjaka-dev-secret',
  dataMode: process.env.APP_DATA_MODE || 'memory',
  timeZone: appTimeZone,
  mysql: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || 'db_genjaka',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'asusku',
  },
}

if (env.nodeEnv === 'production' && env.jwtSecret === 'genjaka-dev-secret') {
  throw new Error('JWT_SECRET must be set to a secure value in production')
}

export const isMemoryMode = env.dataMode === 'memory'
