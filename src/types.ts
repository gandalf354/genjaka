export type Role = 'user' | 'teacher' | 'admin' | 'superadmin' | 'ppg' | 'pjp'
export type Tone = 'neutral' | 'success' | 'warning' | 'danger'

export interface PublicHighlight {
  label: string
  value: string
}

export interface LandingPageUiTexts {
  headerBrandName: string
  headerTagline: string
  headerLogoAlt: string
  navHomeLabel: string
  navVisionLabel: string
  navMissionLabel: string
  navActivitiesLabel: string
  navContactLabel: string
  headerLoginLabel: string
  headerRegisterLabel: string
  heroPrimaryButtonLabel: string
  heroSecondaryButtonLabel: string
  heroImageAlt: string
  heroImagePlaceholderText: string
  visionHeadingTitle: string
  visionHeadingDescription: string
  missionHeadingTitle: string
  missionHeadingDescription: string
  activitiesHeadingTitle: string
  activitiesHeadingDescription: string
  contactHeadingTitle: string
  contactHeadingDescription: string
  socialMediaTitle: string
  highlights: PublicHighlight[]
}

export interface ActivityItem {
  id: number
  title: string
  description: string
  imageUrl: string
  sortOrder: number
}

export interface Village {
  id: number
  name: string
}

export interface Group {
  id: number
  villageId: number
  name: string
}

export interface AgeGroup {
  id: number
  name: string
  minAge: number
  maxAge: number | null
}

export interface StudySchedule {
  id: number
  groupId: number
  ageGroupId: number | null
  studyName: string
  studyDate: string
  startTime: string
  endTime: string
}

export interface LandingPageContent {
  heroTitle: string
  heroSubtitle: string
  heroBadge: string
  heroImageUrl: string
  visionText: string
  missionItems: string[]
  contactAddress: string
  contactPhone: string
  contactEmail: string
  instagramUrl: string
  facebookUrl: string
  tiktokUrl: string
  activities: ActivityItem[]
  ui: LandingPageUiTexts
}

export interface OwnerBiography {
  id: number
  fullName: string
  birthPlace: string
  birthDate: string
  address: string
  phoneNumber: string
  photoUrl: string
  visibleToAdmin: boolean
  updatedAt: string
}

export interface OwnerWorkHistory {
  id: number
  periodYear: string
  positionTitle: string
  jobTitle: string
  sortOrder: number
  updatedAt: string
}

export interface AppUser {
  id: number
  fullName: string
  email: string
  role: Role
  approvalStatus: string
  isActive: boolean
}

export interface UserProfile {
  id: number
  userId: number
  groupId: number | null
  villageId: number | null
  photoUrl: string | null
  gender: string | null
  birthPlace: string | null
  birthDate: string | null
  address: string | null
  phoneNumber: string | null
  guardianName: string | null
  motherName: string | null
  biography: string | null
}

export interface AttendanceRecord {
  id: number
  userId: number
  attendanceDate: string
  status: 'hadir' | 'izin' | 'sakit' | 'alpa'
  note: string | null
  markedBy: number
}

export interface StudyAttendanceSession {
  id: number
  scheduleId: number
  teacherId: number | null
  supervisor1Id: number
  supervisor2Id: number | null
  supervisor3Id: number | null
  createdBy: number
}

export interface StudyAttendanceEntry {
  id: number
  sessionId: number
  userId: number
  status: 'hadir' | 'izin' | 'sakit' | 'alpa'
}

export interface DashboardStat {
  label: string
  value: string
  tone: Tone
}

export interface UserWithProfile extends AppUser {
  profile: UserProfile | null
}

export interface UserDashboardResponse {
  user: AppUser
  profile: UserProfile | null
  stats: DashboardStat[]
  attendances: AttendanceRecord[]
  scopeAttendances?: AttendanceRecord[]
  users: UserWithProfile[]
  teachers?: UserWithProfile[]
  ppgs?: UserWithProfile[]
  pjpVillages?: UserWithProfile[]
  studyAttendanceSessions?: StudyAttendanceSession[]
  studyAttendanceEntries?: StudyAttendanceEntry[]
  directoryUsers?: UserWithProfile[]
  directoryVillages?: Village[]
  directoryGroups?: Group[]
  directorySchedules?: StudySchedule[]
  ageGroups: AgeGroup[]
  villages: Village[]
  groups: Group[]
  schedules: StudySchedule[]
}

export interface TeacherDashboardResponse {
  stats: DashboardStat[]
  users: UserWithProfile[]
  recentAttendances: AttendanceRecord[]
  villages: Village[]
  groups: Group[]
  ageGroups: AgeGroup[]
  schedules: StudySchedule[]
}

export interface AdminDashboardResponse {
  stats: DashboardStat[]
  pendingUsers: UserWithProfile[]
  recentAttendances: AttendanceRecord[]
  studyAttendanceSessions: StudyAttendanceSession[]
  studyAttendanceEntries: StudyAttendanceEntry[]
}

export interface SuperAdminDashboardResponse {
  stats: DashboardStat[]
  admins: AppUser[]
}
