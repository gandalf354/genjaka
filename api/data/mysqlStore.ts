import mysql from 'mysql2/promise'
import { env, isMemoryMode } from '../config/env.js'
import type { AppData } from '../types.js'
import { getJakartaSqlTimestamp, getJakartaTimestamp, toJakartaDateKeyFromDatabase, toJakartaTimestampFromDatabase } from '../utils/time.js'
import { memoryStore } from './store.js'

let pool: mysql.Pool | null = null
let heroImageColumnEnsured = false
let uiTextsColumnEnsured = false
let ownerBiographyTablesEnsured = false
let locationTablesEnsured = false
let userProfileGroupColumnEnsured = false
let userProfileVillageColumnEnsured = false
let userProfileMotherNameColumnEnsured = false
let ageGroupTableEnsured = false
let studyScheduleTableEnsured = false
let studyScheduleAgeGroupColumnEnsured = false
let studyAttendanceTablesEnsured = false
let userRoleEnumEnsured = false
let dataLockPromise: Promise<void> | null = null
let lastPersistedSnapshot: AppData | null = null

const runWithDataLock = async <T>(work: () => Promise<T>): Promise<T> => {
  while (dataLockPromise) {
    await dataLockPromise
  }

  let release: (() => void) | null = null
  dataLockPromise = new Promise<void>((resolve) => {
    release = resolve
  })

  try {
    return await work()
  } finally {
    release?.()
    dataLockPromise = null
  }
}

const cloneAppData = (data: AppData): AppData => JSON.parse(JSON.stringify(data)) as AppData

const indexById = <T extends { id: number }>(items: T[]) => new Map<number, T>(items.map((item) => [item.id, item]))

const diffById = <T extends { id: number }>(previous: T[], current: T[]) => {
  const previousMap = indexById(previous)
  const currentMap = indexById(current)
  const removedIds: number[] = []
  const upserts: T[] = []

  for (const [id] of previousMap) {
    if (!currentMap.has(id)) removedIds.push(id)
  }

  for (const item of current) {
    const previousItem = previousMap.get(item.id)
    if (!previousItem || JSON.stringify(previousItem) !== JSON.stringify(item)) {
      upserts.push(item)
    }
  }

  return { removedIds, upserts }
}

const getPool = () => {
  if (!pool) {
    pool = mysql.createPool({
      host: env.mysql.host,
      port: env.mysql.port,
      database: env.mysql.database,
      user: env.mysql.user,
      password: env.mysql.password,
      timezone: '+07:00',
      connectionLimit: 5,
    })
  }

  return pool
}

const ensureLandingPageHeroImageColumn = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (heroImageColumnEnsured) return

  const [columns] = await connection.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM landing_page_contents LIKE 'hero_image_url'")

  if (columns.length === 0) {
    await connection.query('ALTER TABLE landing_page_contents ADD COLUMN hero_image_url TEXT NULL AFTER hero_badge')
  }

  heroImageColumnEnsured = true
}

const ensureLandingPageUiTextsColumn = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (uiTextsColumnEnsured) return

  const [columns] = await connection.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM landing_page_contents LIKE 'ui_texts'")

  if (columns.length === 0) {
    await connection.query('ALTER TABLE landing_page_contents ADD COLUMN ui_texts TEXT NULL AFTER tiktok_url')
  }

  uiTextsColumnEnsured = true
}

const getDefaultLandingPageUiTexts = () => ({
  headerBrandName: 'Genjaka',
  headerTagline: 'Portal Akademik',
  headerLogoAlt: 'Logo Genjaka',
  navHomeLabel: 'Home',
  navVisionLabel: 'Visi',
  navMissionLabel: 'Misi',
  navActivitiesLabel: 'Kegiatan',
  navContactLabel: 'Hubungi',
  headerLoginLabel: 'Login',
  headerRegisterLabel: 'Registrasi',
  heroPrimaryButtonLabel: 'Registrasi Sekarang',
  heroSecondaryButtonLabel: 'Login Dashboard',
  heroImageAlt: 'Foto utama Genjaka',
  heroImagePlaceholderText: 'Foto utama home belum ditambahkan.',
  visionHeadingTitle: 'Landasan digital yang modern, tertib, dan tetap terasa hangat.',
  visionHeadingDescription:
    'Landing page membawa identitas lembaga ke ruang publik, sementara dashboard internal membantu pengelolaan data dan proses harian secara akurat.',
  missionHeadingTitle: 'Tiga fokus utama yang menjadi penggerak sistem.',
  missionHeadingDescription: '',
  activitiesHeadingTitle: 'Ruang aktivitas yang memperlihatkan ritme pembinaan dan kolaborasi.',
  activitiesHeadingDescription:
    'Menampilkan tiga kegiatan terbaru secara descending. Jika datanya lebih dari tiga, kartu akan bergeser otomatis dan tetap bisa digeser manual.',
  contactHeadingTitle: 'Buka percakapan awal dengan lembaga Anda secara lebih rapi.',
  contactHeadingDescription:
    'Bagian kontak ini juga dikelola dari panel admin, termasuk daftar sosial media agar pengunjung mudah terhubung lewat kanal yang mereka gunakan.',
  socialMediaTitle: 'Sosial Media',
  highlights: [
    { label: 'Program Aktif', value: '' },
    { label: 'Sistem', value: 'Multi-role' },
    { label: 'Layanan', value: 'Registrasi & Absensi' },
  ],
})

const ensureOwnerBiographyTables = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (ownerBiographyTablesEnsured) return

  await connection.query(`
    CREATE TABLE IF NOT EXISTS owner_biography (
      id BIGINT UNSIGNED PRIMARY KEY,
      full_name VARCHAR(200) NOT NULL DEFAULT '',
      birth_place VARCHAR(160) NOT NULL DEFAULT '',
      birth_date VARCHAR(32) NOT NULL DEFAULT '',
      address TEXT NOT NULL,
      phone_number VARCHAR(64) NOT NULL DEFAULT '',
      photo_url TEXT NULL,
      visible_to_admin TINYINT(1) NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  const [columns] = await connection.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM owner_biography LIKE 'photo_url'")
  if (columns.length === 0) {
    await connection.query('ALTER TABLE owner_biography ADD COLUMN photo_url TEXT NULL AFTER phone_number')
  }

  const [visibilityColumns] = await connection.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM owner_biography LIKE 'visible_to_admin'")
  if (visibilityColumns.length === 0) {
    await connection.query('ALTER TABLE owner_biography ADD COLUMN visible_to_admin TINYINT(1) NOT NULL DEFAULT 1 AFTER photo_url')
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS owner_work_histories (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      period_year VARCHAR(80) NOT NULL DEFAULT '',
      position_title VARCHAR(160) NOT NULL DEFAULT '',
      job_title VARCHAR(160) NOT NULL DEFAULT '',
      sort_order INT UNSIGNED NOT NULL DEFAULT 1,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  ownerBiographyTablesEnsured = true
}

const ensureLocationTables = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (locationTablesEnsured) return

  await connection.query(`
    CREATE TABLE IF NOT EXISTS villages (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS village_groups (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      village_id BIGINT UNSIGNED NOT NULL,
      name VARCHAR(150) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_village_groups_village
        FOREIGN KEY (village_id) REFERENCES villages(id)
        ON DELETE CASCADE
    )
  `)

  locationTablesEnsured = true
}

const ensureUserProfileGroupColumn = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (userProfileGroupColumnEnsured) return

  const [columns] = await connection.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM user_profiles LIKE 'group_id'")

  if (columns.length === 0) {
    await connection.query('ALTER TABLE user_profiles ADD COLUMN group_id BIGINT UNSIGNED NULL AFTER user_id')
  }

  userProfileGroupColumnEnsured = true
}

const ensureUserProfileVillageColumn = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (userProfileVillageColumnEnsured) return

  const [columns] = await connection.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM user_profiles LIKE 'village_id'")

  if (columns.length === 0) {
    await connection.query('ALTER TABLE user_profiles ADD COLUMN village_id BIGINT UNSIGNED NULL AFTER group_id')
  }

  userProfileVillageColumnEnsured = true
}

const ensureUserProfileMotherNameColumn = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (userProfileMotherNameColumnEnsured) return

  const [columns] = await connection.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM user_profiles LIKE 'mother_name'")

  if (columns.length === 0) {
    await connection.query('ALTER TABLE user_profiles ADD COLUMN mother_name VARCHAR(150) NULL AFTER guardian_name')
  }

  userProfileMotherNameColumnEnsured = true
}

const ensureStudyScheduleTable = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (studyScheduleTableEnsured) return

  await connection.query(`
    CREATE TABLE IF NOT EXISTS study_schedules (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      group_id BIGINT UNSIGNED NOT NULL,
      age_group_id BIGINT UNSIGNED NULL,
      study_name VARCHAR(180) NOT NULL,
      study_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_study_schedules_group
        FOREIGN KEY (group_id) REFERENCES village_groups(id)
        ON DELETE CASCADE
    )
  `)

  studyScheduleTableEnsured = true
}

const ensureStudyScheduleAgeGroupColumn = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (studyScheduleAgeGroupColumnEnsured) return

  const [columns] = await connection.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM study_schedules LIKE 'age_group_id'")

  if (columns.length === 0) {
    await connection.query('ALTER TABLE study_schedules ADD COLUMN age_group_id BIGINT UNSIGNED NULL AFTER group_id')
  }

  studyScheduleAgeGroupColumnEnsured = true
}

const ensureAgeGroupTable = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (ageGroupTableEnsured) return

  await connection.query(`
    CREATE TABLE IF NOT EXISTS age_groups (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      min_age INT UNSIGNED NOT NULL,
      max_age INT UNSIGNED NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `)

  ageGroupTableEnsured = true
}

const ensureStudyAttendanceTables = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (studyAttendanceTablesEnsured) return

  await connection.query(`
    CREATE TABLE IF NOT EXISTS study_attendance_sessions (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      schedule_id BIGINT UNSIGNED NOT NULL,
      teacher_id BIGINT UNSIGNED NULL,
      supervisor1_id BIGINT UNSIGNED NOT NULL,
      supervisor2_id BIGINT UNSIGNED NULL,
      supervisor3_id BIGINT UNSIGNED NULL,
      created_by BIGINT UNSIGNED NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_study_attendance_sessions_schedule
        FOREIGN KEY (schedule_id) REFERENCES study_schedules(id)
        ON DELETE CASCADE
    )
  `)

  await connection.query(`
    CREATE TABLE IF NOT EXISTS study_attendance_entries (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      session_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      status ENUM('hadir','izin','sakit','alpa') NOT NULL DEFAULT 'alpa',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_study_attendance_entries_session
        FOREIGN KEY (session_id) REFERENCES study_attendance_sessions(id)
        ON DELETE CASCADE
    )
  `)

  studyAttendanceTablesEnsured = true
}

const ensureUserRoleEnum = async (connection: mysql.Pool | mysql.PoolConnection) => {
  if (userRoleEnumEnsured) return

  const [columns] = await connection.query<mysql.RowDataPacket[]>("SHOW COLUMNS FROM users LIKE 'role'")

  if (columns.length > 0) {
    const columnType = String(columns[0].Type || '')

    if (!columnType.includes("'ppg'") || !columnType.includes("'pjp'")) {
      await connection.query(
        "ALTER TABLE users MODIFY COLUMN role ENUM('user','teacher','admin','superadmin','ppg','pjp') NOT NULL DEFAULT 'user'",
      )
    }
  }

  userRoleEnumEnsured = true
}

export const syncStoreFromDatabase = async () => {
  if (isMemoryMode) return

  await runWithDataLock(async () => {
    const db = getPool()
    await ensureLandingPageHeroImageColumn(db)
    await ensureLandingPageUiTextsColumn(db)
    await ensureOwnerBiographyTables(db)
    await ensureLocationTables(db)
    await ensureUserProfileGroupColumn(db)
    await ensureUserProfileVillageColumn(db)
    await ensureUserProfileMotherNameColumn(db)
    await ensureAgeGroupTable(db)
    await ensureStudyScheduleTable(db)
    await ensureStudyScheduleAgeGroupColumn(db)
    await ensureStudyAttendanceTables(db)
    await ensureUserRoleEnum(db)
    const [accounts] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM users ORDER BY id ASC')
    const [profiles] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM user_profiles ORDER BY id ASC')
    const [attendances] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM attendances ORDER BY id ASC')
    const [reviews] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM registration_reviews ORDER BY id ASC')
    const [studyAttendanceSessions] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM study_attendance_sessions ORDER BY id ASC')
    const [studyAttendanceEntries] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM study_attendance_entries ORDER BY id ASC')
    const [villages] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM villages ORDER BY name ASC, id ASC')
    const [groups] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM village_groups ORDER BY name ASC, id ASC')
    const [ageGroups] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM age_groups ORDER BY min_age ASC, id ASC')
    const [schedules] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM study_schedules ORDER BY study_date ASC, start_time ASC, id ASC')
    const [contents] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM landing_page_contents ORDER BY id ASC LIMIT 1')
    const [activities] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM landing_page_activities ORDER BY sort_order ASC, id ASC')
    const [ownerBiographyRows] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM owner_biography ORDER BY id ASC LIMIT 1')
    const [ownerWorkHistories] = await db.query<mysql.RowDataPacket[]>('SELECT * FROM owner_work_histories ORDER BY sort_order ASC, id ASC')

  const content = contents[0]
  const data = memoryStore.getData()

  data.accounts = accounts.map((item) => ({
    id: Number(item.id),
    fullName: String(item.full_name),
    email: String(item.email),
    passwordHash: String(item.password_hash),
    role: item.role,
    approvalStatus: item.approval_status,
    isActive: Boolean(item.is_active),
    createdAt: toJakartaTimestampFromDatabase(item.created_at),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

  data.profiles = profiles.map((item) => ({
    id: Number(item.id),
    userId: Number(item.user_id),
    groupId: item.group_id !== null && item.group_id !== undefined ? Number(item.group_id) : null,
    villageId: item.village_id !== null && item.village_id !== undefined ? Number(item.village_id) : null,
    photoUrl: item.photo_url ? String(item.photo_url) : null,
    gender: item.gender ? String(item.gender) : null,
    birthPlace: item.birth_place ? String(item.birth_place) : null,
    birthDate: toJakartaDateKeyFromDatabase(item.birth_date),
    address: item.address ? String(item.address) : null,
    phoneNumber: item.phone_number ? String(item.phone_number) : null,
    guardianName: item.guardian_name ? String(item.guardian_name) : null,
    motherName: item.mother_name ? String(item.mother_name) : null,
    biography: item.biography ? String(item.biography) : null,
    createdAt: toJakartaTimestampFromDatabase(item.created_at),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

  data.attendances = attendances.map((item) => ({
    id: Number(item.id),
    userId: Number(item.user_id),
    attendanceDate: toJakartaDateKeyFromDatabase(item.attendance_date) || getJakartaTimestamp().slice(0, 10),
    status: item.status,
    note: item.note ? String(item.note) : null,
    markedBy: Number(item.marked_by),
    createdAt: toJakartaTimestampFromDatabase(item.created_at),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

  data.registrationReviews = reviews.map((item) => ({
    id: Number(item.id),
    userId: Number(item.user_id),
    reviewedBy: Number(item.reviewed_by),
    decision: item.decision,
    note: item.note ? String(item.note) : null,
    reviewedAt: toJakartaTimestampFromDatabase(item.reviewed_at),
  }))

  data.studyAttendanceSessions = studyAttendanceSessions.map((item) => ({
    id: Number(item.id),
    scheduleId: Number(item.schedule_id),
    teacherId: item.teacher_id !== null && item.teacher_id !== undefined ? Number(item.teacher_id) : null,
    supervisor1Id: Number(item.supervisor1_id),
    supervisor2Id: item.supervisor2_id !== null && item.supervisor2_id !== undefined ? Number(item.supervisor2_id) : null,
    supervisor3Id: item.supervisor3_id !== null && item.supervisor3_id !== undefined ? Number(item.supervisor3_id) : null,
    createdBy: Number(item.created_by),
    createdAt: toJakartaTimestampFromDatabase(item.created_at),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

  data.studyAttendanceEntries = studyAttendanceEntries.map((item) => ({
    id: Number(item.id),
    sessionId: Number(item.session_id),
    userId: Number(item.user_id),
    status: item.status,
    createdAt: toJakartaTimestampFromDatabase(item.created_at),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

  data.villages = villages.map((item) => ({
    id: Number(item.id),
    name: String(item.name),
    createdAt: toJakartaTimestampFromDatabase(item.created_at),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

  data.groups = groups.map((item) => ({
    id: Number(item.id),
    villageId: Number(item.village_id),
    name: String(item.name),
    createdAt: toJakartaTimestampFromDatabase(item.created_at),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

  data.ageGroups = ageGroups.map((item) => ({
    id: Number(item.id),
    name: String(item.name),
    minAge: Number(item.min_age),
    maxAge: item.max_age !== null && item.max_age !== undefined ? Number(item.max_age) : null,
    createdAt: toJakartaTimestampFromDatabase(item.created_at),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

  data.schedules = schedules.map((item) => ({
    id: Number(item.id),
    groupId: Number(item.group_id),
    ageGroupId: item.age_group_id !== null && item.age_group_id !== undefined ? Number(item.age_group_id) : null,
    studyName: String(item.study_name),
    studyDate: toJakartaDateKeyFromDatabase(item.study_date) || getJakartaTimestamp().slice(0, 10),
    startTime: String(item.start_time).slice(0, 5),
    endTime: String(item.end_time).slice(0, 5),
    createdAt: toJakartaTimestampFromDatabase(item.created_at),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

  if (content) {
    const parsedUiTexts = (() => {
      const fallback = getDefaultLandingPageUiTexts()
      if (!content.ui_texts) return fallback
      try {
        const parsed = JSON.parse(String(content.ui_texts))
        if (!parsed || typeof parsed !== 'object') return fallback
        return { ...fallback, ...(parsed as Record<string, unknown>) }
      } catch (_error) {
        return fallback
      }
    })()

    data.landingPage = {
      heroTitle: String(content.hero_title),
      heroSubtitle: String(content.hero_subtitle || ''),
      heroBadge: String(content.hero_badge || ''),
      heroImageUrl: String(content.hero_image_url || ''),
      visionText: String(content.vision_text || ''),
      missionItems:
        typeof content.mission_items === 'string'
          ? JSON.parse(content.mission_items)
          : Array.isArray(content.mission_items)
            ? content.mission_items.map((item: unknown) => String(item))
            : [],
      contactAddress: String(content.contact_address || ''),
      contactPhone: String(content.contact_phone || ''),
      contactEmail: String(content.contact_email || ''),
      instagramUrl: String(content.instagram_url || ''),
      facebookUrl: String(content.facebook_url || ''),
      tiktokUrl: String(content.tiktok_url || ''),
      ui: {
        ...parsedUiTexts,
        highlights: Array.isArray((parsedUiTexts as { highlights?: unknown }).highlights)
          ? (parsedUiTexts as { highlights: unknown[] }).highlights.map((item) => ({
              label: String((item as { label?: unknown }).label || ''),
              value: String((item as { value?: unknown }).value || ''),
            }))
          : getDefaultLandingPageUiTexts().highlights,
      },
      activities: activities.map((item) => ({
        id: Number(item.id),
        title: String(item.title),
        description: String(item.description || ''),
        imageUrl: String(item.image_url || ''),
        sortOrder: Number(item.sort_order || 0),
      })),
    }
  }

  const ownerBiography = ownerBiographyRows[0]
  data.ownerBiography = {
    id: 1,
    fullName: ownerBiography ? String(ownerBiography.full_name || '') : '',
    birthPlace: ownerBiography ? String(ownerBiography.birth_place || '') : '',
    birthDate: ownerBiography ? String(ownerBiography.birth_date || '') : '',
    address: ownerBiography ? String(ownerBiography.address || '') : '',
    phoneNumber: ownerBiography ? String(ownerBiography.phone_number || '') : '',
    photoUrl: ownerBiography ? String(ownerBiography.photo_url || '') : '',
    visibleToAdmin: ownerBiography ? Boolean(ownerBiography.visible_to_admin) : true,
    updatedAt: ownerBiography ? toJakartaTimestampFromDatabase(ownerBiography.updated_at) : getJakartaTimestamp(),
  }

  data.ownerWorkHistories = ownerWorkHistories.map((item) => ({
    id: Number(item.id),
    periodYear: String(item.period_year || ''),
    positionTitle: String(item.position_title || ''),
    jobTitle: String(item.job_title || ''),
    sortOrder: Number(item.sort_order || 1),
    updatedAt: toJakartaTimestampFromDatabase(item.updated_at),
  }))

    lastPersistedSnapshot = cloneAppData(data as AppData)
  })
}

export const persistStoreToDatabase = async () => {
  if (isMemoryMode) return

  await runWithDataLock(async () => {
    const db = getPool()
    const connection = await db.getConnection()
    const currentData = cloneAppData(memoryStore.getData() as AppData)
    const previousData = lastPersistedSnapshot ? cloneAppData(lastPersistedSnapshot) : null

    const accountsDiff = diffById(previousData?.accounts ?? [], currentData.accounts)
    const profilesDiff = diffById(previousData?.profiles ?? [], currentData.profiles)
    const attendancesDiff = diffById(previousData?.attendances ?? [], currentData.attendances)
    const reviewsDiff = diffById(previousData?.registrationReviews ?? [], currentData.registrationReviews)
    const villagesDiff = diffById(previousData?.villages ?? [], currentData.villages)
    const groupsDiff = diffById(previousData?.groups ?? [], currentData.groups)
    const ageGroupsDiff = diffById(previousData?.ageGroups ?? [], currentData.ageGroups)
    const schedulesDiff = diffById(previousData?.schedules ?? [], currentData.schedules)
    const sessionsDiff = diffById(previousData?.studyAttendanceSessions ?? [], currentData.studyAttendanceSessions)
    const entriesDiff = diffById(previousData?.studyAttendanceEntries ?? [], currentData.studyAttendanceEntries)
    const activitiesDiff = diffById(previousData?.landingPage.activities ?? [], currentData.landingPage.activities)
    const ownerHistoriesDiff = diffById(previousData?.ownerWorkHistories ?? [], currentData.ownerWorkHistories)

    const landingPageChanged = !previousData || JSON.stringify(previousData.landingPage) !== JSON.stringify(currentData.landingPage)
    const ownerBiographyChanged =
      !previousData || JSON.stringify(previousData.ownerBiography) !== JSON.stringify(currentData.ownerBiography)

    const deleteByIds = async (tableName: string, ids: number[]) => {
      for (const id of ids) {
        await connection.query(`DELETE FROM ${tableName} WHERE id = ?`, [id])
      }
    }

    try {
      await ensureLandingPageHeroImageColumn(connection)
      await ensureLandingPageUiTextsColumn(connection)
      await ensureOwnerBiographyTables(connection)
      await ensureLocationTables(connection)
      await ensureUserProfileGroupColumn(connection)
      await ensureUserProfileVillageColumn(connection)
      await ensureUserProfileMotherNameColumn(connection)
      await ensureAgeGroupTable(connection)
      await ensureStudyScheduleTable(connection)
      await ensureStudyScheduleAgeGroupColumn(connection)
      await ensureStudyAttendanceTables(connection)
      await ensureUserRoleEnum(connection)

      await connection.beginTransaction()

      await deleteByIds('study_attendance_entries', entriesDiff.removedIds)
      await deleteByIds('study_attendance_sessions', sessionsDiff.removedIds)
      await deleteByIds('study_schedules', schedulesDiff.removedIds)
      await deleteByIds('village_groups', groupsDiff.removedIds)
      await deleteByIds('villages', villagesDiff.removedIds)

      await deleteByIds('registration_reviews', reviewsDiff.removedIds)
      await deleteByIds('attendances', attendancesDiff.removedIds)
      await deleteByIds('user_profiles', profilesDiff.removedIds)
      await deleteByIds('users', accountsDiff.removedIds)

      await deleteByIds('age_groups', ageGroupsDiff.removedIds)
      await deleteByIds('landing_page_activities', activitiesDiff.removedIds)
      await deleteByIds('owner_work_histories', ownerHistoriesDiff.removedIds)

      for (const account of accountsDiff.upserts) {
        await connection.query(
          `INSERT INTO users
          (id, full_name, email, password_hash, role, approval_status, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          email = VALUES(email),
          password_hash = VALUES(password_hash),
          role = VALUES(role),
          approval_status = VALUES(approval_status),
          is_active = VALUES(is_active),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [
            account.id,
            account.fullName,
            account.email,
            account.passwordHash,
            account.role,
            account.approvalStatus,
            account.isActive ? 1 : 0,
            getJakartaSqlTimestamp(account.createdAt),
            getJakartaSqlTimestamp(account.updatedAt),
          ],
        )
      }

      for (const profile of profilesDiff.upserts) {
        await connection.query(
          `INSERT INTO user_profiles
          (id, user_id, group_id, village_id, photo_url, gender, birth_place, birth_date, address, phone_number, guardian_name, mother_name, biography, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          group_id = VALUES(group_id),
          village_id = VALUES(village_id),
          photo_url = VALUES(photo_url),
          gender = VALUES(gender),
          birth_place = VALUES(birth_place),
          birth_date = VALUES(birth_date),
          address = VALUES(address),
          phone_number = VALUES(phone_number),
          guardian_name = VALUES(guardian_name),
          mother_name = VALUES(mother_name),
          biography = VALUES(biography),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [
            profile.id,
            profile.userId,
            profile.groupId,
            profile.villageId,
            profile.photoUrl,
            profile.gender,
            profile.birthPlace,
            profile.birthDate,
            profile.address,
            profile.phoneNumber,
            profile.guardianName,
            profile.motherName,
            profile.biography,
            getJakartaSqlTimestamp(profile.createdAt),
            getJakartaSqlTimestamp(profile.updatedAt),
          ],
        )
      }

      for (const attendance of attendancesDiff.upserts) {
        await connection.query(
          `INSERT INTO attendances
          (id, user_id, attendance_date, status, note, marked_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          attendance_date = VALUES(attendance_date),
          status = VALUES(status),
          note = VALUES(note),
          marked_by = VALUES(marked_by),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [
            attendance.id,
            attendance.userId,
            attendance.attendanceDate,
            attendance.status,
            attendance.note,
            attendance.markedBy,
            getJakartaSqlTimestamp(attendance.createdAt),
            getJakartaSqlTimestamp(attendance.updatedAt),
          ],
        )
      }

      for (const review of reviewsDiff.upserts) {
        await connection.query(
          `INSERT INTO registration_reviews
          (id, user_id, reviewed_by, decision, note, reviewed_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          user_id = VALUES(user_id),
          reviewed_by = VALUES(reviewed_by),
          decision = VALUES(decision),
          note = VALUES(note),
          reviewed_at = VALUES(reviewed_at)`,
          [review.id, review.userId, review.reviewedBy, review.decision, review.note, getJakartaSqlTimestamp(review.reviewedAt)],
        )
      }

      for (const village of villagesDiff.upserts) {
        await connection.query(
          `INSERT INTO villages
          (id, name, created_at, updated_at)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [village.id, village.name, getJakartaSqlTimestamp(village.createdAt), getJakartaSqlTimestamp(village.updatedAt)],
        )
      }

      for (const group of groupsDiff.upserts) {
        await connection.query(
          `INSERT INTO village_groups
          (id, village_id, name, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          village_id = VALUES(village_id),
          name = VALUES(name),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [
            group.id,
            group.villageId,
            group.name,
            getJakartaSqlTimestamp(group.createdAt),
            getJakartaSqlTimestamp(group.updatedAt),
          ],
        )
      }

      for (const ageGroup of ageGroupsDiff.upserts) {
        await connection.query(
          `INSERT INTO age_groups
          (id, name, min_age, max_age, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          min_age = VALUES(min_age),
          max_age = VALUES(max_age),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [
            ageGroup.id,
            ageGroup.name,
            ageGroup.minAge,
            ageGroup.maxAge,
            getJakartaSqlTimestamp(ageGroup.createdAt),
            getJakartaSqlTimestamp(ageGroup.updatedAt),
          ],
        )
      }

      for (const schedule of schedulesDiff.upserts) {
        await connection.query(
          `INSERT INTO study_schedules
          (id, group_id, age_group_id, study_name, study_date, start_time, end_time, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          group_id = VALUES(group_id),
          age_group_id = VALUES(age_group_id),
          study_name = VALUES(study_name),
          study_date = VALUES(study_date),
          start_time = VALUES(start_time),
          end_time = VALUES(end_time),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [
            schedule.id,
            schedule.groupId,
            schedule.ageGroupId,
            schedule.studyName,
            schedule.studyDate,
            schedule.startTime,
            schedule.endTime,
            getJakartaSqlTimestamp(schedule.createdAt),
            getJakartaSqlTimestamp(schedule.updatedAt),
          ],
        )
      }

      for (const session of sessionsDiff.upserts) {
        await connection.query(
          `INSERT INTO study_attendance_sessions
          (id, schedule_id, teacher_id, supervisor1_id, supervisor2_id, supervisor3_id, created_by, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          schedule_id = VALUES(schedule_id),
          teacher_id = VALUES(teacher_id),
          supervisor1_id = VALUES(supervisor1_id),
          supervisor2_id = VALUES(supervisor2_id),
          supervisor3_id = VALUES(supervisor3_id),
          created_by = VALUES(created_by),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [
            session.id,
            session.scheduleId,
            session.teacherId,
            session.supervisor1Id,
            session.supervisor2Id,
            session.supervisor3Id,
            session.createdBy,
            getJakartaSqlTimestamp(session.createdAt),
            getJakartaSqlTimestamp(session.updatedAt),
          ],
        )
      }

      for (const entry of entriesDiff.upserts) {
        await connection.query(
          `INSERT INTO study_attendance_entries
          (id, session_id, user_id, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          session_id = VALUES(session_id),
          user_id = VALUES(user_id),
          status = VALUES(status),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [
            entry.id,
            entry.sessionId,
            entry.userId,
            entry.status,
            getJakartaSqlTimestamp(entry.createdAt),
            getJakartaSqlTimestamp(entry.updatedAt),
          ],
        )
      }

      if (landingPageChanged) {
        await connection.query(
          `INSERT INTO landing_page_contents
          (id, hero_title, hero_subtitle, hero_badge, hero_image_url, vision_text, mission_items, contact_address, contact_phone, contact_email, instagram_url, facebook_url, tiktok_url, ui_texts, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          hero_title = VALUES(hero_title),
          hero_subtitle = VALUES(hero_subtitle),
          hero_badge = VALUES(hero_badge),
          hero_image_url = VALUES(hero_image_url),
          vision_text = VALUES(vision_text),
          mission_items = VALUES(mission_items),
          contact_address = VALUES(contact_address),
          contact_phone = VALUES(contact_phone),
          contact_email = VALUES(contact_email),
          instagram_url = VALUES(instagram_url),
          facebook_url = VALUES(facebook_url),
          tiktok_url = VALUES(tiktok_url),
          ui_texts = VALUES(ui_texts),
          updated_at = VALUES(updated_at)`,
          [
            1,
            currentData.landingPage.heroTitle,
            currentData.landingPage.heroSubtitle,
            currentData.landingPage.heroBadge,
            currentData.landingPage.heroImageUrl,
            currentData.landingPage.visionText,
            JSON.stringify(currentData.landingPage.missionItems),
            currentData.landingPage.contactAddress,
            currentData.landingPage.contactPhone,
            currentData.landingPage.contactEmail,
            currentData.landingPage.instagramUrl,
            currentData.landingPage.facebookUrl,
            currentData.landingPage.tiktokUrl,
            JSON.stringify(currentData.landingPage.ui || getDefaultLandingPageUiTexts()),
            getJakartaSqlTimestamp(),
          ],
        )
      }

      for (const activity of activitiesDiff.upserts) {
        await connection.query(
          `INSERT INTO landing_page_activities
          (id, content_id, title, description, image_url, sort_order, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          content_id = VALUES(content_id),
          title = VALUES(title),
          description = VALUES(description),
          image_url = VALUES(image_url),
          sort_order = VALUES(sort_order),
          created_at = VALUES(created_at),
          updated_at = VALUES(updated_at)`,
          [
            activity.id,
            1,
            activity.title,
            activity.description,
            activity.imageUrl,
            activity.sortOrder,
            getJakartaSqlTimestamp(),
            getJakartaSqlTimestamp(),
          ],
        )
      }

      if (ownerBiographyChanged) {
        await connection.query(
          `INSERT INTO owner_biography
          (id, full_name, birth_place, birth_date, address, phone_number, photo_url, visible_to_admin, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          full_name = VALUES(full_name),
          birth_place = VALUES(birth_place),
          birth_date = VALUES(birth_date),
          address = VALUES(address),
          phone_number = VALUES(phone_number),
          photo_url = VALUES(photo_url),
          visible_to_admin = VALUES(visible_to_admin),
          updated_at = VALUES(updated_at)`,
          [
            1,
            currentData.ownerBiography.fullName,
            currentData.ownerBiography.birthPlace,
            currentData.ownerBiography.birthDate,
            currentData.ownerBiography.address,
            currentData.ownerBiography.phoneNumber,
            currentData.ownerBiography.photoUrl,
            currentData.ownerBiography.visibleToAdmin ? 1 : 0,
            getJakartaSqlTimestamp(currentData.ownerBiography.updatedAt),
          ],
        )
      }

      for (const history of ownerHistoriesDiff.upserts) {
        await connection.query(
          `INSERT INTO owner_work_histories
          (id, period_year, position_title, job_title, sort_order, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
          period_year = VALUES(period_year),
          position_title = VALUES(position_title),
          job_title = VALUES(job_title),
          sort_order = VALUES(sort_order),
          updated_at = VALUES(updated_at)`,
          [
            history.id,
            history.periodYear,
            history.positionTitle,
            history.jobTitle,
            history.sortOrder,
            getJakartaSqlTimestamp(history.updatedAt),
          ],
        )
      }

      await connection.commit()
      lastPersistedSnapshot = currentData
    } catch (error) {
      await connection.rollback()
      throw error
    } finally {
      connection.release()
    }
  })
}
