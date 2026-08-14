export type Role = 'user' | 'teacher' | 'admin' | 'superadmin' | 'ppg' | 'pjp'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type AttendanceStatus = 'hadir' | 'izin' | 'sakit' | 'alpa'

export interface Account {
  id: number
  fullName: string
  email: string
  passwordHash: string
  role: Role
  approvalStatus: ApprovalStatus
  isActive: boolean
  createdAt: string
  updatedAt: string
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
  createdAt: string
  updatedAt: string
}

export interface AttendanceRecord {
  id: number
  userId: number
  attendanceDate: string
  status: AttendanceStatus
  note: string | null
  markedBy: number
  createdAt: string
  updatedAt: string
}

export interface StudyAttendanceSession {
  id: number
  scheduleId: number
  teacherId: number | null
  supervisor1Id: number
  supervisor2Id: number | null
  supervisor3Id: number | null
  createdBy: number
  createdAt: string
  updatedAt: string
}

export interface StudyAttendanceEntry {
  id: number
  sessionId: number
  userId: number
  status: AttendanceStatus
  createdAt: string
  updatedAt: string
}

export interface RegistrationReview {
  id: number
  userId: number
  reviewedBy: number
  decision: Extract<ApprovalStatus, 'approved' | 'rejected'>
  note: string | null
  reviewedAt: string
}

export interface ActivityItem {
  id: number
  title: string
  description: string
  imageUrl: string
  sortOrder: number
}

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

export interface Village {
  id: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface Group {
  id: number
  villageId: number
  name: string
  createdAt: string
  updatedAt: string
}

export interface AgeGroup {
  id: number
  name: string
  minAge: number
  maxAge: number | null
  createdAt: string
  updatedAt: string
}

export interface StudySchedule {
  id: number
  groupId: number
  ageGroupId: number | null
  studyName: string
  studyDate: string
  startTime: string
  endTime: string
  createdAt: string
  updatedAt: string
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

export interface DashboardStat {
  label: string
  value: string
  tone: 'neutral' | 'success' | 'warning' | 'danger'
}

export interface AppData {
  accounts: Account[]
  profiles: UserProfile[]
  attendances: AttendanceRecord[]
  studyAttendanceSessions: StudyAttendanceSession[]
  studyAttendanceEntries: StudyAttendanceEntry[]
  registrationReviews: RegistrationReview[]
  villages: Village[]
  groups: Group[]
  ageGroups: AgeGroup[]
  schedules: StudySchedule[]
  landingPage: LandingPageContent
  ownerBiography: OwnerBiography
  ownerWorkHistories: OwnerWorkHistory[]
}
