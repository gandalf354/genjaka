import { Fragment, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ImagePlus, KeyRound, Pencil, Plus, Printer, RefreshCw, Trash2, X } from 'lucide-react'
import axios from 'axios'
import { api } from '@/lib/api'
import { createJakartaFormatter, getJakartaDateKey, getJakartaMonthStartFromDateKey, parseJakartaDateKey, shiftJakartaMonth } from '@/lib/time'
import type {
  ActivityItem,
  AgeGroup,
  AppUser,
  AttendanceRecord,
  Group,
  LandingPageContent,
  StudyAttendanceEntry,
  StudyAttendanceSession,
  StudySchedule,
  UserProfile,
  UserWithProfile,
  Village,
} from '@/types'

type ManagedUserType = 'users' | 'ppg' | 'pjp'
type ManagedUserSectionKey = 'users' | 'ppg' | 'pjp-village' | 'pjp-group'
type ManagedRelationMode = 'none' | 'village' | 'group'

interface AdminPanelProps {
  users: UserWithProfile[]
  teachers: UserWithProfile[]
  ppgs: UserWithProfile[]
  pjps: UserWithProfile[]
  admins?: AppUser[]
  registrations: UserWithProfile[]
  attendances: Array<AttendanceRecord & { user?: AppUser }>
  villages: Village[]
  groups: Group[]
  ageGroups?: AgeGroup[]
  schedules: StudySchedule[]
  studyAttendanceSessions?: StudyAttendanceSession[]
  studyAttendanceEntries?: StudyAttendanceEntry[]
  landingPage: LandingPageContent
  refresh: () => Promise<void>
  currentUser?: AppUser | null
  currentUserProfile?: UserProfile | null
  managedUserApiBasePath?: string
  scheduleApiBasePath?: string
  managedUserReadOnly?: boolean
  scheduleReadOnly?: boolean
  section:
    | 'user-approvals'
    | 'user-users'
    | 'user-teachers'
    | 'user-ppg'
    | 'user-pjp-village'
    | 'user-pjp-group'
    | 'age-groups'
    | 'locations'
    | 'study-schedules'
    | 'study-roster'
    | 'study-attendance'
    | 'attendance'
    | 'landing-home'
    | 'landing-header'
    | 'landing-vision'
    | 'landing-mission'
    | 'landing-activities'
    | 'landing-contact'
}

const rosterWeekdayLabels = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const rosterMonthFormatter = createJakartaFormatter('id-ID', { month: 'long', year: 'numeric' })
const rosterDateFormatter = createJakartaFormatter('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const formatAgeRange = (minAge: number, maxAge: number | null) => (maxAge === null ? `${minAge} tahun ke atas` : `${minAge}-${maxAge} tahun`)
const getAgeFromBirthDate = (birthDate: string | null | undefined, referenceDateKey: string) => {
  if (!birthDate) return null

  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number)
  const [currentYear, currentMonth, currentDay] = referenceDateKey.split('-').map(Number)

  if (![birthYear, birthMonth, birthDay, currentYear, currentMonth, currentDay].every(Number.isFinite)) {
    return null
  }

  let age = currentYear - birthYear
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1
  }

  return age >= 0 ? age : null
}

export function AdminPanel({
  users,
  teachers,
  ppgs,
  pjps,
  admins = [],
  registrations,
  attendances,
  villages,
  groups,
  ageGroups = [],
  schedules,
  studyAttendanceSessions = [],
  studyAttendanceEntries = [],
  landingPage,
  refresh,
  currentUser,
  currentUserProfile,
  managedUserApiBasePath = '/admin',
  scheduleApiBasePath = '/admin/study-schedules',
  managedUserReadOnly = false,
  scheduleReadOnly = false,
  section,
}: AdminPanelProps) {
  const locationItemsPerPage = 10
  const [showCreateUserModal, setShowCreateUserModal] = useState(false)
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    groupId: '',
    villageId: '',
    gender: '',
    birthPlace: '',
    birthDate: '',
    address: '',
    phoneNumber: '',
    guardianName: '',
    motherName: '',
    biography: '',
  })
  const [createGroupQuery, setCreateGroupQuery] = useState('')
  const [createUserPhotoFile, setCreateUserPhotoFile] = useState<File | null>(null)
  const [createUserRelationError, setCreateUserRelationError] = useState('')
  const [showCreateTeacherModal, setShowCreateTeacherModal] = useState(false)
  const [teacherForm, setTeacherForm] = useState({
    fullName: '',
    email: '',
    password: '',
    gender: '',
    birthPlace: '',
    birthDate: '',
    address: '',
    phoneNumber: '',
    guardianName: '',
    motherName: '',
    biography: '',
  })
  const [createTeacherPhotoFile, setCreateTeacherPhotoFile] = useState<File | null>(null)
  const [cmsForm, setCmsForm] = useState(landingPage)
  const [message, setMessage] = useState('')
  const [editingUser, setEditingUser] = useState<UserWithProfile | null>(null)
  const [editForm, setEditForm] = useState({
    fullName: '',
    email: '',
    groupId: '',
    villageId: '',
    gender: '',
    birthPlace: '',
    birthDate: '',
    address: '',
    phoneNumber: '',
    guardianName: '',
    motherName: '',
    biography: '',
  })
  const [editPhotoFile, setEditPhotoFile] = useState<File | null>(null)
  const [editGroupQuery, setEditGroupQuery] = useState('')
  const [editUserRelationError, setEditUserRelationError] = useState('')
  const [editingTeacher, setEditingTeacher] = useState<UserWithProfile | null>(null)
  const [editTeacherForm, setEditTeacherForm] = useState({
    fullName: '',
    email: '',
    gender: '',
    birthPlace: '',
    birthDate: '',
    address: '',
    phoneNumber: '',
    guardianName: '',
    motherName: '',
    biography: '',
  })
  const [editTeacherPhotoFile, setEditTeacherPhotoFile] = useState<File | null>(null)
  const [passwordUser, setPasswordUser] = useState<UserWithProfile | null>(null)
  const [passwordForm, setPasswordForm] = useState({ password: '', confirmPassword: '' })
  const [passwordTeacher, setPasswordTeacher] = useState<UserWithProfile | null>(null)
  const [teacherPasswordForm, setTeacherPasswordForm] = useState({ password: '', confirmPassword: '' })
  const [deleteUser, setDeleteUser] = useState<UserWithProfile | null>(null)
  const [deleteTeacher, setDeleteTeacher] = useState<UserWithProfile | null>(null)
  const [processingUserAction, setProcessingUserAction] = useState(false)
  const [processingTeacherAction, setProcessingTeacherAction] = useState(false)
  const [userSearch, setUserSearch] = useState('')
  const [generusAgeGroupTabId, setGenerusAgeGroupTabId] = useState<number | null>(null)
  const [generusRelationQuery, setGenerusRelationQuery] = useState('')
  const [generusRelationFilter, setGenerusRelationFilter] = useState<{ mode: 'group'; groupId: number } | { mode: 'village'; villageId: number } | null>(
    null,
  )
  const [ppgSearch, setPpgSearch] = useState('')
  const [pjpSearch, setPjpSearch] = useState('')
  const [teacherSearch, setTeacherSearch] = useState('')
  const [teacherPage, setTeacherPage] = useState(1)
  const [showCreateScheduleModal, setShowCreateScheduleModal] = useState(false)
  const [scheduleForm, setScheduleForm] = useState({
    groupId: '',
    ageGroupId: '',
    studyName: '',
    studyDate: '',
    startTime: '',
    endTime: '',
  })
  const [scheduleGroupQuery, setScheduleGroupQuery] = useState('')
  const [scheduleAgeGroupQuery, setScheduleAgeGroupQuery] = useState('')
  const [editingSchedule, setEditingSchedule] = useState<StudySchedule | null>(null)
  const [editScheduleForm, setEditScheduleForm] = useState({
    groupId: '',
    ageGroupId: '',
    studyName: '',
    studyDate: '',
    startTime: '',
    endTime: '',
  })
  const [editScheduleGroupQuery, setEditScheduleGroupQuery] = useState('')
  const [editScheduleAgeGroupQuery, setEditScheduleAgeGroupQuery] = useState('')
  const [deleteSchedule, setDeleteSchedule] = useState<StudySchedule | null>(null)
  const [processingScheduleAction, setProcessingScheduleAction] = useState(false)
  const [schedulePage, setSchedulePage] = useState(1)
  const [openStudyAttendanceRows, setOpenStudyAttendanceRows] = useState<Record<number, boolean>>({})
  const [studyAttendanceVillageQuery, setStudyAttendanceVillageQuery] = useState('')
  const [studyAttendanceVillageId, setStudyAttendanceVillageId] = useState<number | null>(null)
  const [studyAttendanceGroupQuery, setStudyAttendanceGroupQuery] = useState('')
  const [studyAttendanceGroupId, setStudyAttendanceGroupId] = useState<number | null>(null)
  const [activeStudyAttendanceSchedule, setActiveStudyAttendanceSchedule] = useState<StudySchedule | null>(null)
  const [studyAttendanceForm, setStudyAttendanceForm] = useState({
    teacherId: '',
    supervisor1Id: '',
    supervisor2Id: '',
    supervisor3Id: '',
    statuses: {} as Record<number, StudyAttendanceEntry['status']>,
  })
  const [studyAttendanceError, setStudyAttendanceError] = useState('')
  const [processingStudyAttendanceAction, setProcessingStudyAttendanceAction] = useState(false)
  const [selectedRosterDate, setSelectedRosterDate] = useState(getJakartaDateKey())
  const [rosterMonth, setRosterMonth] = useState(() => getJakartaMonthStartFromDateKey(getJakartaDateKey()))
  const [rosterInitialized, setRosterInitialized] = useState(false)
  const [villageForm, setVillageForm] = useState({ name: '' })
  const [editingVillageId, setEditingVillageId] = useState<number | null>(null)
  const [editingVillageName, setEditingVillageName] = useState('')
  const [groupForm, setGroupForm] = useState({ villageId: '', name: '' })
  const [editingGroupId, setEditingGroupId] = useState<number | null>(null)
  const [editingGroupForm, setEditingGroupForm] = useState({ villageId: '', name: '' })
  const [villagePage, setVillagePage] = useState(1)
  const [groupPage, setGroupPage] = useState(1)
  const [ageGroupSearch, setAgeGroupSearch] = useState('')
  const [ageGroupPage, setAgeGroupPage] = useState(1)
  const [showCreateAgeGroupModal, setShowCreateAgeGroupModal] = useState(false)
  const [ageGroupForm, setAgeGroupForm] = useState({ name: '', minAge: '', maxAge: '' })
  const [editingAgeGroup, setEditingAgeGroup] = useState<AgeGroup | null>(null)
  const [editAgeGroupForm, setEditAgeGroupForm] = useState({ name: '', minAge: '', maxAge: '' })
  const [deleteAgeGroup, setDeleteAgeGroup] = useState<AgeGroup | null>(null)
  const [ageGroupError, setAgeGroupError] = useState('')
  const [processingAgeGroupAction, setProcessingAgeGroupAction] = useState(false)
  const [selectedVillageId, setSelectedVillageId] = useState<number | null>(null)
  const [homePhotoFile, setHomePhotoFile] = useState<File | null>(null)
  const [uploadingHomePhoto, setUploadingHomePhoto] = useState(false)
  const [uploadingActivityId, setUploadingActivityId] = useState<number | null>(null)

  const normalizeActivitiesDescending = (activities: ActivityItem[]) => {
    const sorted = [...activities].sort((a, b) => b.sortOrder - a.sortOrder || b.id - a.id)
    const total = sorted.length
    return sorted.map((item, index) => ({
      ...item,
      sortOrder: total - index,
    }))
  }

  useEffect(() => {
    setCmsForm({
      ...landingPage,
      activities: normalizeActivitiesDescending(landingPage.activities),
    })
  }, [landingPage])

  const filteredGroups = useMemo(
    () => (selectedVillageId ? groups.filter((group) => group.villageId === selectedVillageId) : groups),
    [groups, selectedVillageId],
  )

  const totalVillagePages = Math.max(1, Math.ceil(villages.length / locationItemsPerPage))
  const totalGroupPages = Math.max(1, Math.ceil(filteredGroups.length / locationItemsPerPage))
  useEffect(() => {
    if (selectedVillageId && !villages.some((village) => village.id === selectedVillageId)) {
      setSelectedVillageId(null)
    }
  }, [selectedVillageId, villages])

  useEffect(() => {
    if (villagePage > totalVillagePages) {
      setVillagePage(totalVillagePages)
    }
  }, [villagePage, totalVillagePages])

  useEffect(() => {
    if (groupPage > totalGroupPages) {
      setGroupPage(totalGroupPages)
    }
  }, [groupPage, totalGroupPages])

  const paginatedVillages = useMemo(
    () => villages.slice((villagePage - 1) * locationItemsPerPage, villagePage * locationItemsPerPage),
    [villages, villagePage],
  )

  const paginatedGroups = useMemo(
    () => filteredGroups.slice((groupPage - 1) * locationItemsPerPage, groupPage * locationItemsPerPage),
    [filteredGroups, groupPage],
  )

  const sortedAgeGroups = useMemo(
    () => [...ageGroups].sort((a, b) => a.minAge - b.minAge || (a.maxAge ?? Number.MAX_SAFE_INTEGER) - (b.maxAge ?? Number.MAX_SAFE_INTEGER) || a.id - b.id),
    [ageGroups],
  )

  const filteredAgeGroups = useMemo(() => {
    const keyword = ageGroupSearch.trim().toLowerCase()
    if (!keyword) return sortedAgeGroups

    return sortedAgeGroups.filter(
      (ageGroup) =>
        ageGroup.name.toLowerCase().includes(keyword) ||
        formatAgeRange(ageGroup.minAge, ageGroup.maxAge).toLowerCase().includes(keyword),
    )
  }, [ageGroupSearch, sortedAgeGroups])

  const totalAgeGroupPages = Math.max(1, Math.ceil(filteredAgeGroups.length / locationItemsPerPage))

  useEffect(() => {
    if (ageGroupPage > totalAgeGroupPages) {
      setAgeGroupPage(totalAgeGroupPages)
    }
  }, [ageGroupPage, totalAgeGroupPages])

  const paginatedAgeGroups = useMemo(
    () => filteredAgeGroups.slice((ageGroupPage - 1) * locationItemsPerPage, ageGroupPage * locationItemsPerPage),
    [ageGroupPage, filteredAgeGroups],
  )

  const groupOptions = useMemo(
    () =>
      groups.map((group) => ({
        id: group.id,
        villageId: group.villageId,
        label: `${villages.find((village) => village.id === group.villageId)?.name || 'Tanpa Desa'} - ${group.name}`,
      })),
    [groups, villages],
  )

  const villageOptions = useMemo(
    () =>
      villages.map((village) => ({
        id: village.id,
        label: village.name,
      })),
    [villages],
  )

  const ageGroupOptions = useMemo(
    () =>
      ageGroups.map((ageGroup) => ({
        id: ageGroup.id,
        label: ageGroup.name,
      })),
    [ageGroups],
  )

  const approvedUsers = useMemo(() => users.filter((user) => user.approvalStatus === 'approved'), [users])
  const approvedPpgs = useMemo(() => ppgs.filter((item) => item.approvalStatus === 'approved'), [ppgs])
  const approvedPjps = useMemo(() => pjps.filter((item) => item.approvalStatus === 'approved'), [pjps])
  const approvedPjpVillages = useMemo(() => approvedPjps.filter((item) => item.profile?.villageId), [approvedPjps])
  const approvedPjpGroups = useMemo(() => approvedPjps.filter((item) => item.profile?.groupId), [approvedPjps])

  const filteredUsers = useMemo(() => {
    const keyword = userSearch.trim().toLowerCase()
    if (!keyword) return approvedUsers

    return approvedUsers.filter((user) => user.fullName.toLowerCase().includes(keyword))
  }, [approvedUsers, userSearch])

  const filteredPpgs = useMemo(() => {
    const keyword = ppgSearch.trim().toLowerCase()
    if (!keyword) return approvedPpgs

    return approvedPpgs.filter((item) => item.fullName.toLowerCase().includes(keyword))
  }, [approvedPpgs, ppgSearch])

  const filteredPjpVillages = useMemo(() => {
    const keyword = pjpSearch.trim().toLowerCase()
    if (!keyword) return approvedPjpVillages

    return approvedPjpVillages.filter((item) => item.fullName.toLowerCase().includes(keyword))
  }, [approvedPjpVillages, pjpSearch])

  const filteredPjpGroups = useMemo(() => {
    const keyword = pjpSearch.trim().toLowerCase()
    if (!keyword) return approvedPjpGroups

    return approvedPjpGroups.filter((item) => item.fullName.toLowerCase().includes(keyword))
  }, [approvedPjpGroups, pjpSearch])

  const filteredTeachers = useMemo(() => {
    const keyword = teacherSearch.trim().toLowerCase()
    if (!keyword) return teachers

    return teachers.filter((teacher) => teacher.fullName.toLowerCase().includes(keyword))
  }, [teachers, teacherSearch])

  const totalTeacherPages = Math.max(1, Math.ceil(filteredTeachers.length / locationItemsPerPage))
  const sectionManagedUserType: ManagedUserType = section === 'user-ppg' ? 'ppg' : section === 'user-pjp-village' || section === 'user-pjp-group' ? 'pjp' : 'users'
  const managedUserSectionKey: ManagedUserSectionKey =
    section === 'user-ppg' ? 'ppg' : section === 'user-pjp-village' ? 'pjp-village' : section === 'user-pjp-group' ? 'pjp-group' : 'users'
  const managedUserConfig = useMemo(() => {
    const configs: Record<
      ManagedUserSectionKey,
      {
        apiPath: string
        responseKey: 'user' | 'ppg' | 'pjp'
        title: string
        singular: string
        singularLower: string
        addLabel: string
        searchPlaceholder: string
        emptyLabel: string
        notFoundLabel: string
        photoUploadMessage: string
        passwordMessage: string
        deleteMessage: string
        relationMode: ManagedRelationMode
      }
    > = {
      users: {
        apiPath: 'users',
        responseKey: 'user',
        title: 'Data Generus',
        singular: 'Generus',
        singularLower: 'generus',
        addLabel: 'Tambah Generus',
        searchPlaceholder: 'Cari nama generus',
        emptyLabel: 'Belum ada data generus.',
        notFoundLabel: 'Data generus tidak ditemukan.',
        photoUploadMessage: 'Foto profil generus berhasil diperbarui.',
        passwordMessage: 'Password generus berhasil diperbarui.',
        deleteMessage: 'Data generus berhasil dihapus.',
        relationMode: 'group',
      },
      ppg: {
        apiPath: 'ppg',
        responseKey: 'ppg',
        title: 'Data PPG',
        singular: 'PPG',
        singularLower: 'PPG',
        addLabel: 'Tambah PPG',
        searchPlaceholder: 'Cari nama PPG',
        emptyLabel: 'Belum ada data PPG.',
        notFoundLabel: 'Data PPG tidak ditemukan.',
        photoUploadMessage: 'Foto profil PPG berhasil diperbarui.',
        passwordMessage: 'Password PPG berhasil diperbarui.',
        deleteMessage: 'Data PPG berhasil dihapus.',
        relationMode: 'none',
      },
      'pjp-village': {
        apiPath: 'pjp',
        responseKey: 'pjp',
        title: 'PJP Desa',
        singular: 'PJP Desa',
        singularLower: 'PJP Desa',
        addLabel: 'Tambah PJP Desa',
        searchPlaceholder: 'Cari nama PJP Desa',
        emptyLabel: 'Belum ada data PJP Desa.',
        notFoundLabel: 'Data PJP Desa tidak ditemukan.',
        photoUploadMessage: 'Foto profil PJP Desa berhasil diperbarui.',
        passwordMessage: 'Password PJP Desa berhasil diperbarui.',
        deleteMessage: 'Data PJP Desa berhasil dihapus.',
        relationMode: 'village',
      },
      'pjp-group': {
        apiPath: 'pjp',
        responseKey: 'pjp',
        title: 'PJP Kelompok',
        singular: 'PJP Kelompok',
        singularLower: 'PJP Kelompok',
        addLabel: 'Tambah PJP Kelompok',
        searchPlaceholder: 'Cari nama PJP Kelompok',
        emptyLabel: 'Belum ada data PJP Kelompok.',
        notFoundLabel: 'Data PJP Kelompok tidak ditemukan.',
        photoUploadMessage: 'Foto profil PJP Kelompok berhasil diperbarui.',
        passwordMessage: 'Password PJP Kelompok berhasil diperbarui.',
        deleteMessage: 'Data PJP Kelompok berhasil dihapus.',
        relationMode: 'group',
      },
    }

    return configs[managedUserSectionKey]
  }, [managedUserSectionKey])
  const managedApprovedRows = useMemo(() => {
    if (managedUserSectionKey === 'users') return approvedUsers
    if (managedUserSectionKey === 'ppg') return approvedPpgs
    if (managedUserSectionKey === 'pjp-village') return approvedPjpVillages
    return approvedPjpGroups
  }, [approvedPjpGroups, approvedPjpVillages, approvedPpgs, approvedUsers, managedUserSectionKey])

  const managedFilteredRows = useMemo(() => {
    if (managedUserSectionKey === 'users') return filteredUsers
    if (managedUserSectionKey === 'ppg') return filteredPpgs
    if (managedUserSectionKey === 'pjp-village') return filteredPjpVillages
    return filteredPjpGroups
  }, [filteredPjpGroups, filteredPjpVillages, filteredPpgs, filteredUsers, managedUserSectionKey])

  const generusAgeGroupTabs = useMemo(
    () => [...ageGroups].sort((a, b) => a.minAge - b.minAge || a.id - b.id),
    [ageGroups],
  )

  const generusRelationOptions = useMemo(() => {
    const villageMap = new Map(villages.map((item) => [item.id, item]))
    const groupOptions = groups
      .map((group) => {
        const village = villageMap.get(group.villageId)
        return {
          mode: 'group' as const,
          groupId: group.id,
          label: village ? `${village.name} - ${group.name}` : group.name,
        }
      })
      .sort((a, b) => a.label.localeCompare(b.label, 'id-ID') || a.groupId - b.groupId)

    const villageOptions = villages
      .map((village) => ({ mode: 'village' as const, villageId: village.id, label: village.name }))
      .sort((a, b) => a.label.localeCompare(b.label, 'id-ID') || a.villageId - b.villageId)

    return [...villageOptions, ...groupOptions]
  }, [groups, villages])

  const getGenerusMatchedAgeGroupId = (user: UserWithProfile, referenceDateKey: string) => {
    const birthDate = user.profile?.birthDate
    const age = getAgeFromBirthDate(birthDate, referenceDateKey)
    if (age === null) return null
    return ageGroups.find((item) => age >= item.minAge && (item.maxAge === null || age <= item.maxAge))?.id ?? null
  }

  const displayedManagedRows = useMemo(() => {
    if (sectionManagedUserType !== 'users') return managedFilteredRows

    let rows = managedFilteredRows

    if (generusAgeGroupTabId) {
      const referenceDateKey = getJakartaDateKey()
      rows = rows.filter((user) => getGenerusMatchedAgeGroupId(user, referenceDateKey) === generusAgeGroupTabId)
    }

    if (generusRelationFilter) {
      if (generusRelationFilter.mode === 'group') {
        rows = rows.filter((user) => user.profile?.groupId === generusRelationFilter.groupId)
      } else {
        const allowedVillageId = generusRelationFilter.villageId
        const groupIdsInVillage = new Set(groups.filter((group) => group.villageId === allowedVillageId).map((group) => group.id))
        rows = rows.filter((user) => {
          const profile = user.profile
          if (!profile) return false
          if (profile.villageId === allowedVillageId) return true
          if (profile.groupId && groupIdsInVillage.has(profile.groupId)) return true
          return false
        })
      }
    }

    return rows
  }, [generusAgeGroupTabId, generusRelationFilter, groups, managedFilteredRows, sectionManagedUserType])

  const displayedGenerusGenderCounts = useMemo(() => {
    if (sectionManagedUserType !== 'users') {
      return { male: 0, female: 0 }
    }

    return displayedManagedRows.reduce(
      (counts, user) => {
        const gender = user.profile?.gender?.trim().toLowerCase()
        if (!gender) return counts
        if (gender.startsWith('laki')) return { ...counts, male: counts.male + 1 }
        if (gender.startsWith('perem')) return { ...counts, female: counts.female + 1 }
        if (gender === 'l') return { ...counts, male: counts.male + 1 }
        if (gender === 'p') return { ...counts, female: counts.female + 1 }
        return counts
      },
      { male: 0, female: 0 },
    )
  }, [displayedManagedRows, sectionManagedUserType])

  const sortedSchedules = useMemo(
    () => [...schedules].sort((a, b) => a.studyDate.localeCompare(b.studyDate) || a.startTime.localeCompare(b.startTime) || a.id - b.id),
    [schedules],
  )
  const scheduleCountByDate = useMemo(
    () =>
      sortedSchedules.reduce<Record<string, number>>((counts, schedule) => {
        counts[schedule.studyDate] = (counts[schedule.studyDate] || 0) + 1
        return counts
      }, {}),
    [sortedSchedules],
  )
  const rosterScheduleItems = useMemo(
    () =>
      sortedSchedules.map((schedule) => {
        const group = groups.find((item) => item.id === schedule.groupId)
        const village = villages.find((item) => item.id === group?.villageId)
        const ageGroup = ageGroups.find((item) => item.id === schedule.ageGroupId)

        return {
          ...schedule,
          groupLabel: group ? `${village?.name || 'Tanpa Desa'} - ${group.name}` : '-',
          ageGroupLabel: ageGroup?.name || '-',
        }
      }),
    [ageGroups, groups, sortedSchedules, villages],
  )

  const filteredStudyAttendanceSchedules = useMemo(() => {
    if (!studyAttendanceVillageId && !studyAttendanceGroupId) return sortedSchedules

    const villageIdByGroupId = new Map(groups.map((group) => [group.id, group.villageId]))

    if (studyAttendanceGroupId) {
      return sortedSchedules.filter((schedule) => schedule.groupId === studyAttendanceGroupId)
    }

    return sortedSchedules.filter((schedule) => villageIdByGroupId.get(schedule.groupId) === studyAttendanceVillageId)
  }, [groups, sortedSchedules, studyAttendanceGroupId, studyAttendanceVillageId])

  const groupOptionsForStudyAttendanceFilter = useMemo(() => {
    if (!studyAttendanceVillageId) return groupOptions
    return groupOptions.filter((group) => group.villageId === studyAttendanceVillageId)
  }, [groupOptions, studyAttendanceVillageId])

  const studyAttendanceParticipantsBySchedule = useMemo(() => {
    const approvedParticipants = approvedUsers.filter((item) => item.profile)

    return filteredStudyAttendanceSchedules.reduce<Record<number, UserWithProfile[]>>((mapped, schedule) => {
      const group = groups.find((item) => item.id === schedule.groupId)

      mapped[schedule.id] = approvedParticipants.filter((user) => {
        const profile = user.profile
        if (!profile || !group) return false
        const age = getAgeFromBirthDate(profile.birthDate, schedule.studyDate)
        const matchedAgeGroupId =
          age === null ? null : ageGroups.find((item) => age >= item.minAge && (item.maxAge === null || age <= item.maxAge))?.id ?? null
        const matchesScope = profile.groupId === group.id || (!profile.groupId && profile.villageId === group.villageId)
        const matchesAgeGroup = matchedAgeGroupId === schedule.ageGroupId

        return matchesScope && matchesAgeGroup
      })

      return mapped
    }, {})
  }, [ageGroups, approvedUsers, filteredStudyAttendanceSchedules, groups])

  const studyAttendanceRows = useMemo(() => {
    const todayKey = getJakartaDateKey()

    return [...filteredStudyAttendanceSchedules]
      .filter((schedule) => schedule.studyDate <= todayKey)
      .sort((a, b) => b.studyDate.localeCompare(a.studyDate) || b.startTime.localeCompare(a.startTime) || b.id - a.id)
      .map((schedule) => {
        const group = groups.find((item) => item.id === schedule.groupId)
        const village = villages.find((item) => item.id === group?.villageId)
        const ageGroup = ageGroups.find((item) => item.id === schedule.ageGroupId)
        const session = studyAttendanceSessions.find((item) => item.scheduleId === schedule.id) || null
        const participantIds = (studyAttendanceParticipantsBySchedule[schedule.id] || []).map((user) => user.id)
        const participantSet = new Set(participantIds)
        const statusByUserId = session
          ? studyAttendanceEntries
              .filter((entry) => entry.sessionId === session.id && participantSet.has(entry.userId))
              .reduce<Map<number, AttendanceRecord['status']>>((mapped, entry) => {
                mapped.set(entry.userId, entry.status)
                return mapped
              }, new Map())
          : new Map<number, AttendanceRecord['status']>()
        let hadir = 0
        let izin = 0
        let sakit = 0

        participantIds.forEach((userId) => {
          const status = statusByUserId.get(userId)
          if (status === 'hadir') hadir += 1
          if (status === 'izin') izin += 1
          if (status === 'sakit') sakit += 1
        })

        const total = participantIds.length
        const alpa = Math.max(0, total - hadir - izin - sakit)

        return {
          schedule,
          groupLabel: group ? `${village?.name || 'Tanpa Desa'} - ${group.name}` : '-',
          ageGroupLabel: ageGroup?.name || '-',
          session,
          total,
          hadir,
          izin,
          sakit,
          alpa,
        }
      })
  }, [
    ageGroups,
    filteredStudyAttendanceSchedules,
    groups,
    studyAttendanceEntries,
    studyAttendanceParticipantsBySchedule,
    studyAttendanceSessions,
    villages,
  ])

  const hideStudyAttendanceInsertAction =
    section === 'study-attendance' && currentUser?.role === 'pjp' && Boolean(currentUserProfile?.villageId) && !currentUserProfile?.groupId

  const activeStudyAttendanceParticipants = useMemo(() => {
    if (!activeStudyAttendanceSchedule) return []
    return studyAttendanceParticipantsBySchedule[activeStudyAttendanceSchedule.id] || []
  }, [activeStudyAttendanceSchedule, studyAttendanceParticipantsBySchedule])

  const activeStudyAttendanceGroup = useMemo(
    () => (activeStudyAttendanceSchedule ? groups.find((item) => item.id === activeStudyAttendanceSchedule.groupId) || null : null),
    [activeStudyAttendanceSchedule, groups],
  )
  const activeStudyAttendanceVillage = useMemo(
    () => (activeStudyAttendanceGroup ? villages.find((item) => item.id === activeStudyAttendanceGroup.villageId) || null : null),
    [activeStudyAttendanceGroup, villages],
  )
  const activeStudyAttendanceAgeGroup = useMemo(
    () => (activeStudyAttendanceSchedule ? ageGroups.find((item) => item.id === activeStudyAttendanceSchedule.ageGroupId) || null : null),
    [activeStudyAttendanceSchedule, ageGroups],
  )
  const activeStudyAttendanceSession = useMemo(
    () => (activeStudyAttendanceSchedule ? studyAttendanceSessions.find((item) => item.scheduleId === activeStudyAttendanceSchedule.id) || null : null),
    [activeStudyAttendanceSchedule, studyAttendanceSessions],
  )
  const activeTeacherOptions = useMemo(() => teachers.filter((item) => item.approvalStatus === 'approved'), [teachers])
  const activeSupervisor1Options = useMemo(() => {
    if (!activeStudyAttendanceGroup) return []
    return pjps.filter(
      (item) => item.approvalStatus === 'approved' && item.isActive && item.profile?.groupId === activeStudyAttendanceGroup.id,
    )
  }, [activeStudyAttendanceGroup, pjps])
  const activeSupervisor2Options = useMemo(() => {
    if (!activeStudyAttendanceVillage) return []
    return pjps.filter(
      (item) =>
        item.approvalStatus === 'approved' &&
        item.isActive &&
        item.profile?.villageId === activeStudyAttendanceVillage.id &&
        !item.profile?.groupId,
    )
  }, [activeStudyAttendanceVillage, pjps])
  const activeSupervisor3Options = useMemo(() => {
    return ppgs.filter((item) => item.approvalStatus === 'approved' && item.isActive)
  }, [ppgs])
  const getPjpGroupLabel = (user: UserWithProfile) => {
    const groupId = user.profile?.groupId
    if (!groupId) return user.fullName

    const group = groups.find((item) => item.id === groupId)
    const village = group ? villages.find((item) => item.id === group.villageId) : null
    const groupLabel = group ? `${village?.name || 'Tanpa Desa'} - ${group.name}` : 'Kelompok tidak ditemukan'
    return `${user.fullName} (${groupLabel})`
  }
  const getPjpVillageLabel = (user: UserWithProfile) => {
    const villageId = user.profile?.villageId
    if (!villageId) return user.fullName

    const village = villages.find((item) => item.id === villageId)
    return `${user.fullName} (${village?.name || 'Desa tidak ditemukan'})`
  }
  const getStudyAttendancePersonName = (id: number | null | undefined) => {
    if (!id) return '-'

    if (currentUser?.id === id) {
      return currentUser.fullName
    }

    const person = [...admins, ...teachers, ...ppgs, ...pjps].find((item) => item.id === id)
    return person?.fullName || '-'
  }
  const escapePrintHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
  const printStudyAttendanceSheet = (scheduleId: number) => {
    const row = studyAttendanceRows.find((item) => item.schedule.id === scheduleId)
    if (!row) {
      setMessage('Data absensi pengajian tidak ditemukan untuk dicetak.')
      return
    }

    const participants = studyAttendanceParticipantsBySchedule[scheduleId] || []
    const printWindow = window.open('', '_blank', 'width=960,height=800')

    if (!printWindow) {
      setMessage('Jendela cetak diblokir browser. Izinkan popup lalu coba lagi.')
      return
    }

    const detailItems = [
      { label: 'Pemateri', value: getStudyAttendancePersonName(row.session?.teacherId) },
      { label: 'Pengawas 1', value: getStudyAttendancePersonName(row.session?.supervisor1Id) },
      { label: 'Pengawas 2', value: getStudyAttendancePersonName(row.session?.supervisor2Id) },
      { label: 'Pengawas 3', value: getStudyAttendancePersonName(row.session?.supervisor3Id) },
    ]
    const signBlockLabel = row.session ? 'Petugas Absensi' : 'Petugas yang Akan Mengisi'
    const participantRows =
      participants.length > 0
        ? participants
            .map(
              (participant, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapePrintHtml(participant.fullName)}</td>
                  <td></td>
                </tr>`,
            )
            .join('')
        : `
          <tr>
            <td colspan="3" style="text-align:center;color:#64748b;">Belum ada generus yang sesuai untuk jadwal ini.</td>
          </tr>`

    const documentTitle = `Absensi Pengajian - ${row.schedule.studyName}`
    const html = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <title>${escapePrintHtml(documentTitle)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 24px; }
      .sheet { max-width: 960px; margin: 0 auto; }
      .kop { display: flex; gap: 18px; align-items: center; padding-bottom: 16px; border-bottom: 2px solid #0f172a; }
      .logo { width: 88px; height: 88px; object-fit: contain; }
      .title { flex: 1; text-align: center; }
      .title h1 { margin: 0; font-size: 24px; letter-spacing: 0.06em; }
      .title p { margin: 6px 0 0; font-size: 13px; color: #334155; }
      .meta { margin-top: 18px; border: 1px solid #cbd5e1; padding: 12px 14px; }
      .meta-grid { display: grid; grid-template-columns: 160px 1fr; gap: 8px 14px; font-size: 13px; }
      table { width: 100%; border-collapse: collapse; margin-top: 18px; }
      th, td { border: 1px solid #94a3b8; padding: 8px 10px; font-size: 13px; vertical-align: top; }
      th { background: #f8fafc; text-align: left; }
      .signature-col { height: 42px; }
      .signatures { margin-top: 24px; }
      .signatures h2 { margin: 0 0 10px; font-size: 15px; }
      .signatures ol { margin: 0; padding-left: 22px; }
      .signatures li { margin-bottom: 16px; font-size: 13px; }
      .signature-line { margin-top: 34px; border-bottom: 1px solid #0f172a; width: 240px; }
      @media print {
        body { margin: 0; padding: 18px; }
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <div class="kop">
        <img class="logo" src="${window.location.origin}/genjaka-logo.png" alt="Logo Genjaka" />
        <div class="title">
          <h1>DAFTAR ABSENSI PENGAJIAN</h1>
          <p>Generus Jambi Kota</p>
        </div>
      </div>

      <div class="meta">
        <div class="meta-grid">
          <div>Nama Pengajian</div><div>: ${escapePrintHtml(row.schedule.studyName)}</div>
          <div>Tanggal</div><div>: ${escapePrintHtml(row.schedule.studyDate)}</div>
          <div>Jam</div><div>: ${escapePrintHtml(`${row.schedule.startTime} - ${row.schedule.endTime}`)}</div>
          <div>Kelompok</div><div>: ${escapePrintHtml(row.groupLabel)}</div>
          <div>Kelompok Usia</div><div>: ${escapePrintHtml(row.ageGroupLabel)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:64px;">No</th>
            <th>Nama Generus</th>
            <th style="width:220px;">Tanda Tangan</th>
          </tr>
        </thead>
        <tbody>
          ${participantRows}
        </tbody>
      </table>

      <div class="signatures">
        <h2>${escapePrintHtml(signBlockLabel)}</h2>
        <ol>
          ${detailItems
            .map(
              (item) => `
                <li>
                  <div>${escapePrintHtml(item.label)}: ${escapePrintHtml(item.value)}</div>
                  <div class="signature-line"></div>
                </li>`,
            )
            .join('')}
        </ol>
      </div>
    </div>
  </body>
</html>`

    const printDocument = printWindow.document
    printDocument.open()
    printDocument.write(html)
    printDocument.close()

    const triggerPrint = () => {
      printWindow.focus()
      window.setTimeout(() => {
        printWindow.print()
      }, 250)
    }

    if (printDocument.readyState === 'complete') {
      triggerPrint()
      return
    }

    printWindow.onload = () => {
      triggerPrint()
    }
  }
  const selectedRosterSchedules = useMemo(
    () => rosterScheduleItems.filter((schedule) => schedule.studyDate === selectedRosterDate),
    [rosterScheduleItems, selectedRosterDate],
  )
  const scheduleIdsWithAttendance = useMemo(() => new Set(studyAttendanceSessions.map((item) => item.scheduleId)), [studyAttendanceSessions])
  const attendedScheduleCountByDate = useMemo(
    () =>
      rosterScheduleItems.reduce<Record<string, number>>((counts, schedule) => {
        if (!scheduleIdsWithAttendance.has(schedule.id)) return counts
        counts[schedule.studyDate] = (counts[schedule.studyDate] || 0) + 1
        return counts
      }, {}),
    [rosterScheduleItems, scheduleIdsWithAttendance],
  )
  const calendarDays = useMemo(() => {
    const year = rosterMonth.getUTCFullYear()
    const month = rosterMonth.getUTCMonth()
    const firstDayOfMonth = new Date(Date.UTC(year, month, 1, 5, 0, 0))
    const gridStart = new Date(Date.UTC(year, month, 1 - firstDayOfMonth.getUTCDay(), 5, 0, 0))

    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(Date.UTC(gridStart.getUTCFullYear(), gridStart.getUTCMonth(), gridStart.getUTCDate() + index, 5, 0, 0))
      const dateKey = getJakartaDateKey(date)

      return {
        dateKey,
        dayNumber: date.getUTCDate(),
        isCurrentMonth: date.getUTCMonth() === month,
        scheduleCount: scheduleCountByDate[dateKey] || 0,
        attendedCount: attendedScheduleCountByDate[dateKey] || 0,
      }
    })
  }, [attendedScheduleCountByDate, rosterMonth, scheduleCountByDate])
  const totalSchedulePages = Math.max(1, Math.ceil(sortedSchedules.length / locationItemsPerPage))

  const paginatedTeachers = useMemo(
    () => filteredTeachers.slice((teacherPage - 1) * locationItemsPerPage, teacherPage * locationItemsPerPage),
    [filteredTeachers, teacherPage],
  )

  const paginatedSchedules = useMemo(
    () => sortedSchedules.slice((schedulePage - 1) * locationItemsPerPage, schedulePage * locationItemsPerPage),
    [sortedSchedules, schedulePage],
  )

  useEffect(() => {
    if (teacherPage > totalTeacherPages) {
      setTeacherPage(totalTeacherPages)
    }
  }, [teacherPage, totalTeacherPages])

  useEffect(() => {
    if (schedulePage > totalSchedulePages) {
      setSchedulePage(totalSchedulePages)
    }
  }, [schedulePage, totalSchedulePages])

  useEffect(() => {
    if (rosterInitialized) return

    setRosterInitialized(true)
  }, [rosterInitialized])

  const isUserProfileIncomplete = (user: UserWithProfile) => {
    const profile = user.profile
    if (!profile) return true

    const requiredProfileValues = [
      profile.photoUrl,
      profile.gender,
      profile.birthPlace,
      profile.birthDate,
      profile.address,
      profile.phoneNumber,
      profile.guardianName,
      profile.motherName,
      profile.biography,
    ]

    return requiredProfileValues.some((value) => !String(value || '').trim())
  }

  const getUserRelationLabel = (user: UserWithProfile) => {
    const group = user.profile?.groupId ? groups.find((item) => item.id === user.profile?.groupId) : null
    const villageFromGroup = group ? villages.find((item) => item.id === group.villageId) : null
    const directVillage = user.profile?.villageId ? villages.find((item) => item.id === user.profile?.villageId) : null

    if (group) {
      return villageFromGroup ? `${villageFromGroup.name} - ${group.name}` : group.name
    }

    if (directVillage) {
      return directVillage.name
    }

    return '-'
  }

  const renderPagination = (page: number, totalPages: number, onChange: (page: number) => void) => {
    if (totalPages <= 1) return null

    return (
      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500">
        <p>
          Halaman {page} dari {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(page - 1)}
            disabled={page === 1}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Sebelumnya
          </button>
          <button
            type="button"
            onClick={() => onChange(page + 1)}
            disabled={page === totalPages}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Berikutnya
          </button>
        </div>
      </div>
    )
  }

  const closeCreateUserModal = () => {
    setShowCreateUserModal(false)
    setCreateUserPhotoFile(null)
    setCreateUserRelationError('')
    setUserForm({
      fullName: '',
      email: '',
      password: '',
      groupId: '',
      villageId: '',
      gender: '',
      birthPlace: '',
      birthDate: '',
      address: '',
      phoneNumber: '',
      guardianName: '',
      motherName: '',
      biography: '',
    })
    setCreateGroupQuery('')
  }

  const closeCreateTeacherModal = () => {
    setShowCreateTeacherModal(false)
    setCreateTeacherPhotoFile(null)
    setTeacherForm({
      fullName: '',
      email: '',
      password: '',
      gender: '',
      birthPlace: '',
      birthDate: '',
      address: '',
      phoneNumber: '',
      guardianName: '',
      motherName: '',
      biography: '',
    })
  }

  const closeCreateScheduleModal = () => {
    setShowCreateScheduleModal(false)
    setScheduleForm({
      groupId: '',
      ageGroupId: '',
      studyName: '',
      studyDate: '',
      startTime: '',
      endTime: '',
    })
    setScheduleGroupQuery('')
    setScheduleAgeGroupQuery('')
  }

  const closeCreateAgeGroupModal = () => {
    setShowCreateAgeGroupModal(false)
    setAgeGroupForm({ name: '', minAge: '', maxAge: '' })
    setAgeGroupError('')
  }

  const openEditAgeGroupModal = (ageGroup: AgeGroup) => {
    setEditingAgeGroup(ageGroup)
    setEditAgeGroupForm({
      name: ageGroup.name,
      minAge: String(ageGroup.minAge),
      maxAge: ageGroup.maxAge === null ? '' : String(ageGroup.maxAge),
    })
    setAgeGroupError('')
  }

  const closeEditAgeGroupModal = () => {
    setEditingAgeGroup(null)
    setEditAgeGroupForm({ name: '', minAge: '', maxAge: '' })
    setAgeGroupError('')
  }

  const normalizeAgeGroupPayload = (form: { name: string; minAge: string; maxAge: string }) => ({
    name: form.name.trim(),
    minAge: Number(form.minAge),
    maxAge: form.maxAge.trim() ? Number(form.maxAge) : null,
  })

  const addUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateUserRelationError('')

    if (managedUserConfig.relationMode === 'group' && createGroupQuery.trim() && !userForm.groupId) {
      setCreateUserRelationError('Pilih kelompok dari daftar yang tersedia.')
      return
    }

    if (managedUserConfig.relationMode === 'village' && createGroupQuery.trim() && !userForm.villageId) {
      setCreateUserRelationError('Pilih desa dari daftar yang tersedia.')
      return
    }

    setProcessingUserAction(true)

    try {
      const response = await api.post(`${managedUserApiBasePath}/${managedUserConfig.apiPath}`, {
        fullName: userForm.fullName,
        email: userForm.email,
        password: userForm.password || undefined,
      })

      const userId = response.data[managedUserConfig.responseKey].id as number

      await api.put(`${managedUserApiBasePath}/${managedUserConfig.apiPath}/${userId}`, {
        fullName: userForm.fullName,
        email: userForm.email,
        groupId: managedUserConfig.relationMode === 'group' ? (userForm.groupId ? Number(userForm.groupId) : null) : null,
        villageId: managedUserConfig.relationMode === 'village' ? (userForm.villageId ? Number(userForm.villageId) : null) : null,
        gender: userForm.gender,
        birthPlace: userForm.birthPlace,
        birthDate: userForm.birthDate,
        address: userForm.address,
        phoneNumber: userForm.phoneNumber,
        guardianName: userForm.guardianName,
        motherName: userForm.motherName,
        biography: userForm.biography,
      })

      if (createUserPhotoFile) {
        const formData = new FormData()
        formData.append('photo', createUserPhotoFile)
        await api.post(`${managedUserApiBasePath}/${managedUserConfig.apiPath}/${userId}/photo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      setMessage(`${managedUserConfig.singular} baru berhasil ditambahkan.`)
      closeCreateUserModal()
      await refresh()
    } catch (error) {
      setCreateUserRelationError(
        axios.isAxiosError(error) ? error.response?.data?.message || `Data ${managedUserConfig.singular} belum bisa disimpan.` : `Data ${managedUserConfig.singular} belum bisa disimpan.`,
      )
    } finally {
      setProcessingUserAction(false)
    }
  }

  const addTeacher = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setProcessingTeacherAction(true)

    try {
      const response = await api.post('/admin/teachers', {
        fullName: teacherForm.fullName,
        email: teacherForm.email,
        password: teacherForm.password || undefined,
      })

      const teacherId = response.data.teacher.id as number

      await api.put(`/admin/teachers/${teacherId}`, {
        fullName: teacherForm.fullName,
        email: teacherForm.email,
        gender: teacherForm.gender,
        birthPlace: teacherForm.birthPlace,
        birthDate: teacherForm.birthDate,
        address: teacherForm.address,
        phoneNumber: teacherForm.phoneNumber,
        guardianName: teacherForm.guardianName,
        motherName: teacherForm.motherName,
        biography: teacherForm.biography,
      })

      if (createTeacherPhotoFile) {
        const formData = new FormData()
        formData.append('photo', createTeacherPhotoFile)
        await api.post(`/admin/teachers/${teacherId}/photo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      setMessage('Dewan guru baru berhasil ditambahkan.')
      closeCreateTeacherModal()
      await refresh()
    } finally {
      setProcessingTeacherAction(false)
    }
  }

  const openEditModal = (user: UserWithProfile, type: ManagedUserType) => {
    setEditingUser(user)
    setEditForm({
      fullName: user.fullName || '',
      email: user.email || '',
      groupId: user.profile?.groupId ? String(user.profile.groupId) : '',
      villageId: user.profile?.villageId ? String(user.profile.villageId) : '',
      gender: user.profile?.gender || '',
      birthPlace: user.profile?.birthPlace || '',
      birthDate: user.profile?.birthDate || '',
      address: user.profile?.address || '',
      phoneNumber: user.profile?.phoneNumber || '',
      guardianName: user.profile?.guardianName || '',
      motherName: user.profile?.motherName || '',
      biography: user.profile?.biography || '',
    })
    const selectedGroup = groupOptions.find((group) => group.id === user.profile?.groupId)
    const selectedVillage = villageOptions.find((village) => village.id === user.profile?.villageId)
    setEditGroupQuery(type === 'ppg' ? '' : managedUserSectionKey === 'pjp-village' ? selectedVillage?.label || '' : selectedGroup?.label || '')
    setEditPhotoFile(null)
  }

  const closeEditModal = () => {
    setEditingUser(null)
    setEditPhotoFile(null)
    setEditGroupQuery('')
    setEditUserRelationError('')
  }

  const openEditTeacherModal = (teacher: UserWithProfile) => {
    setEditingTeacher(teacher)
    setEditTeacherForm({
      fullName: teacher.fullName || '',
      email: teacher.email || '',
      gender: teacher.profile?.gender || '',
      birthPlace: teacher.profile?.birthPlace || '',
      birthDate: teacher.profile?.birthDate || '',
      address: teacher.profile?.address || '',
      phoneNumber: teacher.profile?.phoneNumber || '',
      guardianName: teacher.profile?.guardianName || '',
      motherName: teacher.profile?.motherName || '',
      biography: teacher.profile?.biography || '',
    })
    setEditTeacherPhotoFile(null)
  }

  const closeEditTeacherModal = () => {
    setEditingTeacher(null)
    setEditTeacherPhotoFile(null)
  }

  const openEditScheduleModal = (schedule: StudySchedule) => {
    setEditingSchedule(schedule)
    setEditScheduleForm({
      groupId: String(schedule.groupId),
      ageGroupId: schedule.ageGroupId ? String(schedule.ageGroupId) : '',
      studyName: schedule.studyName,
      studyDate: schedule.studyDate,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
    })
    setEditScheduleGroupQuery(groupOptions.find((group) => group.id === schedule.groupId)?.label || '')
    setEditScheduleAgeGroupQuery(ageGroupOptions.find((ageGroup) => ageGroup.id === schedule.ageGroupId)?.label || '')
  }

  const closeEditScheduleModal = () => {
    setEditingSchedule(null)
    setEditScheduleForm({
      groupId: '',
      ageGroupId: '',
      studyName: '',
      studyDate: '',
      startTime: '',
      endTime: '',
    })
    setEditScheduleGroupQuery('')
    setEditScheduleAgeGroupQuery('')
  }

  const openStudyAttendanceModal = (schedule: StudySchedule) => {
    const session = studyAttendanceSessions.find((item) => item.scheduleId === schedule.id) || null
    const entryStatusByUserId = (studyAttendanceEntries || [])
      .filter((item) => item.sessionId === session?.id)
      .reduce<Record<number, StudyAttendanceEntry['status']>>((mapped, item) => {
        mapped[item.userId] = item.status
        return mapped
      }, {})
    const participantStatuses = (studyAttendanceParticipantsBySchedule[schedule.id] || []).reduce<Record<number, StudyAttendanceEntry['status']>>((mapped, user) => {
      mapped[user.id] = entryStatusByUserId[user.id] || 'alpa'
      return mapped
    }, {})

    const group = groups.find((item) => item.id === schedule.groupId) || null
    const village = group ? villages.find((item) => item.id === group.villageId) || null : null
    const defaultSupervisor1Id =
      session?.supervisor1Id ||
      (currentUser?.role === 'pjp' && currentUserProfile?.groupId ? currentUser.id : null) ||
      pjps.find((item) => item.approvalStatus === 'approved' && item.isActive && item.profile?.groupId === schedule.groupId)?.id ||
      null
    const defaultSupervisor2Id = session
      ? session.supervisor2Id ?? null
      : village
        ? pjps.find(
            (item) =>
              item.approvalStatus === 'approved' &&
              item.isActive &&
              item.profile?.villageId === village.id &&
              !item.profile?.groupId,
          )?.id || null
        : null

    setActiveStudyAttendanceSchedule(schedule)
    setStudyAttendanceForm({
      teacherId: session?.teacherId ? String(session.teacherId) : '',
      supervisor1Id: defaultSupervisor1Id ? String(defaultSupervisor1Id) : '',
      supervisor2Id: defaultSupervisor2Id ? String(defaultSupervisor2Id) : '',
      supervisor3Id: session?.supervisor3Id ? String(session.supervisor3Id) : '',
      statuses: participantStatuses,
    })
    setStudyAttendanceError('')
  }

  const closeStudyAttendanceModal = () => {
    setActiveStudyAttendanceSchedule(null)
    setStudyAttendanceForm({
      teacherId: '',
      supervisor1Id: '',
      supervisor2Id: '',
      supervisor3Id: '',
      statuses: {},
    })
    setStudyAttendanceError('')
  }

  const saveEditedUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingUser) return
    setEditUserRelationError('')

    if (managedUserConfig.relationMode === 'group' && editGroupQuery.trim() && !editForm.groupId) {
      setEditUserRelationError('Pilih kelompok dari daftar yang tersedia.')
      return
    }

    if (managedUserConfig.relationMode === 'village' && editGroupQuery.trim() && !editForm.villageId) {
      setEditUserRelationError('Pilih desa dari daftar yang tersedia.')
      return
    }

    setProcessingUserAction(true)

    try {
      await api.put(`${managedUserApiBasePath}/${managedUserConfig.apiPath}/${editingUser.id}`, {
        ...editForm,
        groupId: managedUserConfig.relationMode === 'group' ? (editForm.groupId ? Number(editForm.groupId) : null) : null,
        villageId: managedUserConfig.relationMode === 'village' ? (editForm.villageId ? Number(editForm.villageId) : null) : null,
      })

      if (editPhotoFile) {
        const formData = new FormData()
        formData.append('photo', editPhotoFile)
        await api.post(`${managedUserApiBasePath}/${managedUserConfig.apiPath}/${editingUser.id}/photo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      setMessage(`${managedUserConfig.title} berhasil diperbarui.`)
      closeEditModal()
      await refresh()
    } catch (error) {
      setEditUserRelationError(
        axios.isAxiosError(error) ? error.response?.data?.message || `${managedUserConfig.title} belum bisa diperbarui.` : `${managedUserConfig.title} belum bisa diperbarui.`,
      )
    } finally {
      setProcessingUserAction(false)
    }
  }

  const saveEditedTeacher = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingTeacher) return

    setProcessingTeacherAction(true)

    try {
      await api.put(`/admin/teachers/${editingTeacher.id}`, editTeacherForm)

      if (editTeacherPhotoFile) {
        const formData = new FormData()
        formData.append('photo', editTeacherPhotoFile)
        await api.post(`/admin/teachers/${editingTeacher.id}/photo`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
      }

      setMessage('Data dewan guru berhasil diperbarui.')
      closeEditTeacherModal()
      await refresh()
    } finally {
      setProcessingTeacherAction(false)
    }
  }

  const openPasswordModal = (user: UserWithProfile) => {
    setPasswordUser(user)
    setPasswordForm({ password: '', confirmPassword: '' })
  }

  const closePasswordModal = () => {
    setPasswordUser(null)
    setPasswordForm({ password: '', confirmPassword: '' })
  }

  const openTeacherPasswordModal = (teacher: UserWithProfile) => {
    setPasswordTeacher(teacher)
    setTeacherPasswordForm({ password: '', confirmPassword: '' })
  }

  const closeTeacherPasswordModal = () => {
    setPasswordTeacher(null)
    setTeacherPasswordForm({ password: '', confirmPassword: '' })
  }

  const saveUserPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!passwordUser) return

    if (passwordForm.password !== passwordForm.confirmPassword) {
      setMessage('Konfirmasi password baru tidak cocok.')
      return
    }

    setProcessingUserAction(true)

    try {
      await api.put(`${managedUserApiBasePath}/${managedUserConfig.apiPath}/${passwordUser.id}/password`, {
        password: passwordForm.password,
      })
      setMessage(managedUserConfig.passwordMessage)
      closePasswordModal()
    } finally {
      setProcessingUserAction(false)
    }
  }

  const saveTeacherPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!passwordTeacher) return

    if (teacherPasswordForm.password !== teacherPasswordForm.confirmPassword) {
      setMessage('Konfirmasi password baru dewan guru tidak cocok.')
      return
    }

    setProcessingTeacherAction(true)

    try {
      await api.put(`/admin/teachers/${passwordTeacher.id}/password`, {
        password: teacherPasswordForm.password,
      })
      setMessage('Password dewan guru berhasil diperbarui.')
      closeTeacherPasswordModal()
    } finally {
      setProcessingTeacherAction(false)
    }
  }

  const confirmDeleteUser = async () => {
    if (!deleteUser) return

    setProcessingUserAction(true)

    try {
      await api.delete(`${managedUserApiBasePath}/${managedUserConfig.apiPath}/${deleteUser.id}`)
      setMessage(managedUserConfig.deleteMessage)
      setDeleteUser(null)
      await refresh()
    } finally {
      setProcessingUserAction(false)
    }
  }

  const confirmDeleteTeacher = async () => {
    if (!deleteTeacher) return

    setProcessingTeacherAction(true)

    try {
      await api.delete(`/admin/teachers/${deleteTeacher.id}`)
      setMessage('Data dewan guru berhasil dihapus.')
      setDeleteTeacher(null)
      await refresh()
    } finally {
      setProcessingTeacherAction(false)
    }
  }

  const reviewRegistration = async (id: number, decision: 'approve' | 'reject') => {
    await api.post(`/admin/registrations/${id}/${decision}`, { note: '' })
    setMessage(decision === 'approve' ? 'Registrasi berhasil disetujui.' : 'Registrasi berhasil ditolak.')
    await refresh()
  }

  const saveCms = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const payload = {
      ...cmsForm,
      activities: normalizeActivitiesDescending(cmsForm.activities),
    }
    await api.put('/admin/landing-page', payload)
    setCmsForm(payload)
    setMessage('Konten landing page berhasil diperbarui.')
    await refresh()
  }

  const updateActivity = (index: number, key: keyof ActivityItem, value: string) => {
    setCmsForm((current) => ({
      ...current,
      activities: current.activities.map((item, currentIndex) =>
        currentIndex === index ? { ...item, [key]: key === 'sortOrder' ? Number(value) : value } : item,
      ),
    }))
  }

  const addActivity = () => {
    setCmsForm((current) => ({
      ...current,
      activities: normalizeActivitiesDescending([
        {
          id: Date.now(),
          title: '',
          description: '',
          imageUrl: '',
          sortOrder: (current.activities[0]?.sortOrder || current.activities.length) + 1,
        },
        ...current.activities,
      ]),
    }))
  }

  const removeActivity = (index: number) => {
    setCmsForm((current) => ({
      ...current,
      activities: normalizeActivitiesDescending(current.activities.filter((_, currentIndex) => currentIndex !== index)),
    }))
  }

  const uploadActivityPhoto = async (activityId: number, file: File | null) => {
    if (!file) return

    setUploadingActivityId(activityId)
    const formData = new FormData()
    formData.append('photo', file)

    try {
      const response = await api.post('/admin/landing-page/activities/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setCmsForm((current) => ({
        ...current,
        activities: current.activities.map((item) => (item.id === activityId ? { ...item, imageUrl: response.data.fileUrl } : item)),
      }))
      setMessage('Foto kegiatan berhasil diunggah.')
    } finally {
      setUploadingActivityId(null)
    }
  }

  const uploadHomePhoto = async () => {
    if (!homePhotoFile) return

    setUploadingHomePhoto(true)
    const formData = new FormData()
    formData.append('photo', homePhotoFile)

    try {
      const response = await api.post('/admin/landing-page/home/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      setCmsForm((current) => ({
        ...current,
        heroImageUrl: response.data.fileUrl,
      }))
      setMessage('Foto home berhasil diunggah. Simpan konten home untuk menayangkan perubahan.')
      setHomePhotoFile(null)
    } finally {
      setUploadingHomePhoto(false)
    }
  }

  const addVillage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await api.post('/admin/villages', { name: villageForm.name })
    setVillageForm({ name: '' })
    setMessage('Desa berhasil ditambahkan.')
    await refresh()
  }

  const startEditVillage = (village: Village) => {
    setEditingVillageId(village.id)
    setEditingVillageName(village.name)
  }

  const saveVillage = async (villageId: number) => {
    await api.put(`/admin/villages/${villageId}`, { name: editingVillageName })
    setEditingVillageId(null)
    setEditingVillageName('')
    setMessage('Desa berhasil diperbarui.')
    await refresh()
  }

  const deleteVillage = async (village: Village) => {
    const confirmed = window.confirm(`Hapus desa "${village.name}" beserta semua kelompok di dalamnya?`)
    if (!confirmed) return

    await api.delete(`/admin/villages/${village.id}`)
    if (selectedVillageId === village.id) {
      setSelectedVillageId(null)
      setGroupPage(1)
    }
    setMessage('Desa beserta kelompok terkait berhasil dihapus.')
    await refresh()
  }

  const addGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await api.post('/admin/groups', {
      villageId: Number(groupForm.villageId),
      name: groupForm.name,
    })
    setGroupForm({ villageId: '', name: '' })
    setMessage('Kelompok berhasil ditambahkan.')
    await refresh()
  }

  const startEditGroup = (group: Group) => {
    setEditingGroupId(group.id)
    setEditingGroupForm({
      villageId: String(group.villageId),
      name: group.name,
    })
  }

  const saveGroup = async (groupId: number) => {
    await api.put(`/admin/groups/${groupId}`, {
      villageId: Number(editingGroupForm.villageId),
      name: editingGroupForm.name,
    })
    setEditingGroupId(null)
    setEditingGroupForm({ villageId: '', name: '' })
    setMessage('Kelompok berhasil diperbarui.')
    await refresh()
  }

  const deleteGroup = async (group: Group) => {
    const confirmed = window.confirm(`Hapus kelompok "${group.name}"?`)
    if (!confirmed) return

    await api.delete(`/admin/groups/${group.id}`)
    setMessage('Kelompok berhasil dihapus.')
    await refresh()
  }

  const addAgeGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAgeGroupError('')
    setProcessingAgeGroupAction(true)

    try {
      const payload = normalizeAgeGroupPayload(ageGroupForm)
      await api.post('/admin/age-groups', payload)
      setMessage('Kelompok usia berhasil ditambahkan.')
      closeCreateAgeGroupModal()
      await refresh()
    } catch (error) {
      setAgeGroupError(
        axios.isAxiosError(error) ? error.response?.data?.message || 'Kelompok usia belum bisa disimpan.' : 'Kelompok usia belum bisa disimpan.',
      )
    } finally {
      setProcessingAgeGroupAction(false)
    }
  }

  const saveAgeGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingAgeGroup) return

    setAgeGroupError('')
    setProcessingAgeGroupAction(true)

    try {
      const payload = normalizeAgeGroupPayload(editAgeGroupForm)
      await api.put(`/admin/age-groups/${editingAgeGroup.id}`, payload)
      setMessage('Kelompok usia berhasil diperbarui.')
      closeEditAgeGroupModal()
      await refresh()
    } catch (error) {
      setAgeGroupError(
        axios.isAxiosError(error) ? error.response?.data?.message || 'Kelompok usia belum bisa diperbarui.' : 'Kelompok usia belum bisa diperbarui.',
      )
    } finally {
      setProcessingAgeGroupAction(false)
    }
  }

  const confirmDeleteAgeGroup = async () => {
    if (!deleteAgeGroup) return

    setAgeGroupError('')
    setProcessingAgeGroupAction(true)

    try {
      await api.delete(`/admin/age-groups/${deleteAgeGroup.id}`)
      setMessage('Kelompok usia berhasil dihapus.')
      setDeleteAgeGroup(null)
      await refresh()
    } catch (error) {
      setAgeGroupError(
        axios.isAxiosError(error) ? error.response?.data?.message || 'Kelompok usia belum bisa dihapus.' : 'Kelompok usia belum bisa dihapus.',
      )
    } finally {
      setProcessingAgeGroupAction(false)
    }
  }

  const addSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (scheduleGroupQuery.trim() && !scheduleForm.groupId) {
      setMessage('Pilih kelompok dari daftar yang tersedia.')
      return
    }

    if (scheduleAgeGroupQuery.trim() && !scheduleForm.ageGroupId) {
      setMessage('Pilih kelompok usia dari daftar yang tersedia.')
      return
    }

    setProcessingScheduleAction(true)

    try {
      await api.post(scheduleApiBasePath, {
        groupId: Number(scheduleForm.groupId),
        ageGroupId: Number(scheduleForm.ageGroupId),
        studyName: scheduleForm.studyName,
        studyDate: scheduleForm.studyDate,
        startTime: scheduleForm.startTime,
        endTime: scheduleForm.endTime,
      })
      setMessage('Jadwal pengajian berhasil ditambahkan.')
      closeCreateScheduleModal()
      await refresh()
    } finally {
      setProcessingScheduleAction(false)
    }
  }

  const saveSchedule = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingSchedule) return

    if (editScheduleGroupQuery.trim() && !editScheduleForm.groupId) {
      setMessage('Pilih kelompok dari daftar yang tersedia.')
      return
    }

    if (editScheduleAgeGroupQuery.trim() && !editScheduleForm.ageGroupId) {
      setMessage('Pilih kelompok usia dari daftar yang tersedia.')
      return
    }

    setProcessingScheduleAction(true)

    try {
      await api.put(`${scheduleApiBasePath}/${editingSchedule.id}`, {
        groupId: Number(editScheduleForm.groupId),
        ageGroupId: Number(editScheduleForm.ageGroupId),
        studyName: editScheduleForm.studyName,
        studyDate: editScheduleForm.studyDate,
        startTime: editScheduleForm.startTime,
        endTime: editScheduleForm.endTime,
      })
      setMessage('Jadwal pengajian berhasil diperbarui.')
      closeEditScheduleModal()
      await refresh()
    } finally {
      setProcessingScheduleAction(false)
    }
  }

  const confirmDeleteSchedule = async () => {
    if (!deleteSchedule) return

    setProcessingScheduleAction(true)

    try {
      await api.delete(`${scheduleApiBasePath}/${deleteSchedule.id}`)
      setMessage('Jadwal pengajian berhasil dihapus.')
      setDeleteSchedule(null)
      await refresh()
    } finally {
      setProcessingScheduleAction(false)
    }
  }

  const saveStudyAttendance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeStudyAttendanceSchedule) return

    const studyAttendanceApiBasePath = currentUser?.role === 'pjp' ? '/user' : '/admin'
    setProcessingStudyAttendanceAction(true)
    setStudyAttendanceError('')

    try {
      await api.post(`${studyAttendanceApiBasePath}/study-attendance-sessions`, {
        scheduleId: activeStudyAttendanceSchedule.id,
        teacherId: studyAttendanceForm.teacherId ? Number(studyAttendanceForm.teacherId) : null,
        supervisor1Id: studyAttendanceForm.supervisor1Id ? Number(studyAttendanceForm.supervisor1Id) : null,
        supervisor2Id: studyAttendanceForm.supervisor2Id ? Number(studyAttendanceForm.supervisor2Id) : null,
        supervisor3Id: studyAttendanceForm.supervisor3Id ? Number(studyAttendanceForm.supervisor3Id) : null,
        entries: activeStudyAttendanceParticipants.map((participant) => ({
          userId: participant.id,
          status: studyAttendanceForm.statuses[participant.id] || 'alpa',
        })),
      })
      setMessage(activeStudyAttendanceSession ? 'Absensi pengajian berhasil diperbarui.' : 'Absensi pengajian berhasil disimpan.')
      closeStudyAttendanceModal()
      await refresh()
    } catch (error) {
      setStudyAttendanceError(
        axios.isAxiosError(error) ? error.response?.data?.message || 'Absensi pengajian belum bisa disimpan.' : 'Absensi pengajian belum bisa disimpan.',
      )
    } finally {
      setProcessingStudyAttendanceAction(false)
    }
  }

  const resetGroupFilter = () => {
    setSelectedVillageId(null)
    setGroupPage(1)
  }

  const resetStudyAttendanceFilters = () => {
    setStudyAttendanceVillageQuery('')
    setStudyAttendanceVillageId(null)
    setStudyAttendanceGroupQuery('')
    setStudyAttendanceGroupId(null)
  }

  return (
    <div className="space-y-4">
      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm text-emerald-700">{message}</div> : null}

      {['user-users', 'user-ppg', 'user-pjp-village', 'user-pjp-group'].includes(section) ? (
        <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl text-slate-900">{managedUserConfig.title}</h3>
            {!managedUserReadOnly ? (
              <button
                type="button"
                onClick={() => {
                  setShowCreateUserModal(true)
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-300 px-3.5 py-2 text-sm font-semibold text-slate-950"
              >
                <Plus className="h-4 w-4" />
                {managedUserConfig.addLabel}
              </button>
            ) : null}
          </div>
          <p className="mt-1.5 text-xs leading-6 text-slate-500">
            {sectionManagedUserType === 'users'
              ? 'Tambah dan pantau data generus dari submenu yang lebih terfokus.'
              : sectionManagedUserType === 'ppg'
                ? 'Kelola data PPG dengan pola CRUD yang konsisten di panel admin.'
                : managedUserSectionKey === 'pjp-village'
                  ? 'Kelola data PJP Desa dengan pola CRUD yang konsisten di panel admin.'
                  : 'Kelola data PJP Kelompok dengan pola CRUD yang konsisten di panel admin.'}
          </p>
          {sectionManagedUserType === 'users' ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => setGenerusAgeGroupTabId(null)}
                  className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] transition ${
                    generusAgeGroupTabId === null
                      ? 'border-teal-200 bg-teal-300 text-slate-950'
                      : 'border-stone-200 bg-white text-slate-600 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  Semua
                </button>
                {generusAgeGroupTabs.length > 0
                  ? generusAgeGroupTabs.map((ageGroup) => (
                      <button
                        key={ageGroup.id}
                        type="button"
                        onClick={() => setGenerusAgeGroupTabId(ageGroup.id)}
                        className={`shrink-0 rounded-lg border px-3 py-1.5 text-[11px] transition ${
                          generusAgeGroupTabId === ageGroup.id
                            ? 'border-teal-200 bg-teal-300 text-slate-950'
                            : 'border-stone-200 bg-white text-slate-600 hover:border-stone-300 hover:bg-stone-50'
                        }`}
                      >
                        {ageGroup.name}
                      </button>
                    ))
                  : null}
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                <div className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] text-slate-600">
                  Laki-laki: <span className="font-semibold text-slate-900">{displayedGenerusGenderCounts.male}</span>
                </div>
                <div className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-[11px] text-slate-600">
                  Perempuan: <span className="font-semibold text-slate-900">{displayedGenerusGenderCounts.female}</span>
                </div>
                <label className="block">
                  <input
                    list="generus-relation-filter-options"
                    value={generusRelationQuery}
                    onChange={(event) => {
                      const nextValue = event.target.value
                      const matched = generusRelationOptions.find((item) => item.label.toLowerCase() === nextValue.toLowerCase()) || null
                      setGenerusRelationQuery(nextValue)
                      if (!matched) {
                        setGenerusRelationFilter(null)
                        return
                      }
                      if (matched.mode === 'group') {
                        setGenerusRelationFilter({ mode: 'group', groupId: matched.groupId })
                        return
                      }
                      setGenerusRelationFilter({ mode: 'village', villageId: matched.villageId })
                    }}
                    className="h-7 w-56 rounded-lg border border-stone-200 bg-white px-3 text-[11px] text-slate-700"
                    placeholder="Filter Kelompok/Desa"
                  />
                  <datalist id="generus-relation-filter-options">
                    {generusRelationOptions.map((item) => (
                      <option
                        key={item.mode === 'group' ? `g:${item.groupId}` : `v:${item.villageId}`}
                        value={item.label}
                      />
                    ))}
                  </datalist>
                </label>
              </div>
            </div>
          ) : null}
          <input
            value={sectionManagedUserType === 'users' ? userSearch : sectionManagedUserType === 'ppg' ? ppgSearch : pjpSearch}
            onChange={(event) => {
              if (sectionManagedUserType === 'users') {
                setUserSearch(event.target.value)
                return
              }

              if (sectionManagedUserType === 'ppg') {
                setPpgSearch(event.target.value)
                return
              }

              setPjpSearch(event.target.value)
            }}
            className="mt-4 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
            placeholder={managedUserConfig.searchPlaceholder}
          />
          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-stone-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">No</th>
                  <th className="px-2 py-1.5">{`Nama ${managedUserConfig.singular}`}</th>
                  <th className="px-2 py-1.5">Jenis Kelamin</th>
                  <th className="px-2 py-1.5">Nama Ayah</th>
                  <th className="px-2 py-1.5">Nama Ibu</th>
                  <th className="px-2 py-1.5">Tempat Lahir</th>
                  <th className="px-2 py-1.5">Tanggal Lahir</th>
                  <th className="px-2 py-1.5">Kelompok/Desa</th>
                  {!managedUserReadOnly ? <th className="px-2 py-1.5">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {displayedManagedRows.length === 0 ? (
                  <tr className="border-t border-stone-200">
                    <td colSpan={managedUserReadOnly ? 8 : 9} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                      {managedApprovedRows.length === 0 ? managedUserConfig.emptyLabel : managedUserConfig.notFoundLabel}
                    </td>
                  </tr>
                ) : null}
                {displayedManagedRows.map((user, index) => (
                  <tr key={user.id} className={`border-t border-stone-200 ${isUserProfileIncomplete(user) ? 'bg-amber-50/80' : ''}`}>
                    <td className="px-2 py-1.5 text-slate-700">{index + 1}</td>
                    <td className="px-2 py-1.5 text-slate-900">{user.fullName}</td>
                    <td className="px-2 py-1.5 text-slate-500">{user.profile?.gender || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-500">{user.profile?.guardianName || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-500">{user.profile?.motherName || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-500">{user.profile?.birthPlace || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-500">{user.profile?.birthDate || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-500">{getUserRelationLabel(user)}</td>
                    {!managedUserReadOnly ? (
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openEditModal(user, sectionManagedUserType)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                            aria-label={`Edit data ${user.fullName}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openPasswordModal(user)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-amber-300 hover:text-amber-700"
                            aria-label={`Ubah password ${user.fullName}`}
                          >
                            <KeyRound className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setDeleteUser(user)
                            }}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                            aria-label={`Hapus data ${user.fullName}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'user-teachers' ? (
        <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl text-slate-900">Kelola Dewan Guru</h3>
            <button
              type="button"
              onClick={() => setShowCreateTeacherModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-amber-300 px-3.5 py-2 text-sm font-semibold text-slate-950"
            >
              <Plus className="h-4 w-4" />
              Tambah Dewan Guru
            </button>
          </div>
          <p className="mt-1.5 text-xs leading-6 text-slate-500">Kelola data dewan guru dengan pola CRUD yang sama seperti data generus.</p>
          <input
            value={teacherSearch}
            onChange={(event) => {
              setTeacherSearch(event.target.value)
              setTeacherPage(1)
            }}
            className="mt-4 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
            placeholder="Cari nama dewan guru"
          />
          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-stone-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">No</th>
                  <th className="px-2 py-1.5">Nama Dewan Guru</th>
                  <th className="px-2 py-1.5">Email</th>
                  <th className="px-2 py-1.5">Alamat</th>
                  <th className="px-2 py-1.5">Nomor Telepon</th>
                  <th className="px-2 py-1.5">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.length === 0 ? (
                  <tr className="border-t border-stone-200">
                    <td colSpan={6} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                      {teachers.length === 0 ? 'Belum ada data dewan guru.' : 'Data dewan guru tidak ditemukan.'}
                    </td>
                  </tr>
                ) : null}
                {paginatedTeachers.map((teacher, index) => (
                  <tr key={teacher.id} className="border-t border-stone-200">
                    <td className="px-2 py-1.5 text-slate-700">{(teacherPage - 1) * locationItemsPerPage + index + 1}</td>
                    <td className="px-2 py-1.5 text-slate-900">{teacher.fullName}</td>
                    <td className="px-2 py-1.5 text-slate-500">{teacher.email}</td>
                    <td className="px-2 py-1.5 text-slate-500">{teacher.profile?.address || '-'}</td>
                    <td className="px-2 py-1.5 text-slate-500">{teacher.profile?.phoneNumber || '-'}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditTeacherModal(teacher)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                          aria-label={`Edit data ${teacher.fullName}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openTeacherPasswordModal(teacher)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-amber-300 hover:text-amber-700"
                          aria-label={`Ubah password ${teacher.fullName}`}
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTeacher(teacher)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                          aria-label={`Hapus data ${teacher.fullName}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderPagination(teacherPage, totalTeacherPages, setTeacherPage)}
        </div>
      ) : null}

      {section === 'age-groups' ? (
        <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-xl text-slate-900">Kelompok Usia</h3>
              <p className="mt-1.5 text-xs leading-6 text-slate-500">
                Kelola rentang usia generus agar nantinya data bisa dikelompokkan otomatis berdasarkan umur.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowCreateAgeGroupModal(true)
                setAgeGroupError('')
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-teal-300 px-3.5 py-2 text-sm font-semibold text-slate-950"
            >
              <Plus className="h-4 w-4" />
              Tambah Kelompok Usia
            </button>
          </div>
          <input
            value={ageGroupSearch}
            onChange={(event) => {
              setAgeGroupSearch(event.target.value)
              setAgeGroupPage(1)
            }}
            className="mt-4 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
            placeholder="Cari nama atau rentang usia"
          />
          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-stone-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">No</th>
                  <th className="px-2 py-1.5">Nama Kelompok Usia</th>
                  <th className="px-2 py-1.5">Usia Minimal</th>
                  <th className="px-2 py-1.5">Usia Maksimal</th>
                  <th className="px-2 py-1.5">Rentang</th>
                  <th className="px-2 py-1.5">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredAgeGroups.length === 0 ? (
                  <tr className="border-t border-stone-200">
                    <td colSpan={6} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                      {ageGroups.length === 0 ? 'Belum ada data kelompok usia.' : 'Data kelompok usia tidak ditemukan.'}
                    </td>
                  </tr>
                ) : null}
                {paginatedAgeGroups.map((ageGroup, index) => (
                  <tr key={ageGroup.id} className="border-t border-stone-200">
                    <td className="px-2 py-1.5 text-slate-700">{(ageGroupPage - 1) * locationItemsPerPage + index + 1}</td>
                    <td className="px-2 py-1.5 text-slate-900">{ageGroup.name}</td>
                    <td className="px-2 py-1.5 text-slate-500">{ageGroup.minAge} tahun</td>
                    <td className="px-2 py-1.5 text-slate-500">{ageGroup.maxAge === null ? 'Ke atas' : `${ageGroup.maxAge} tahun`}</td>
                    <td className="px-2 py-1.5 text-slate-500">{formatAgeRange(ageGroup.minAge, ageGroup.maxAge)}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditAgeGroupModal(ageGroup)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                          aria-label={`Edit kelompok usia ${ageGroup.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteAgeGroup(ageGroup)
                            setAgeGroupError('')
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                          aria-label={`Hapus kelompok usia ${ageGroup.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {renderPagination(ageGroupPage, totalAgeGroupPages, setAgeGroupPage)}
        </div>
      ) : null}

      {section === 'locations' ? (
        <div className="grid gap-4 xl:grid-cols-2">
            <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
            <h3 className="font-display text-xl text-slate-900">Manajemen Desa</h3>
            <p className="mt-1.5 text-xs leading-6 text-slate-500">Tambahkan dan susun daftar desa sebagai induk dari beberapa kelompok.</p>
            <form onSubmit={addVillage} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
              <input
                value={villageForm.name}
                onChange={(event) => setVillageForm({ name: event.target.value })}
                className="flex-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
                placeholder="Nama desa"
              />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-300 px-3.5 py-2 text-sm font-semibold text-slate-950">
                <Plus className="h-4 w-4" />
                Tambah Desa
              </button>
            </form>

              <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-stone-50 text-[11px] text-slate-500">
                  <tr>
                      <th className="px-2 py-1.5">Desa</th>
                      <th className="px-2 py-1.5">Jumlah Kelompok</th>
                      <th className="px-2 py-1.5">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {villages.length === 0 ? (
                    <tr className="border-t border-stone-200">
                      <td colSpan={3} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                        Belum ada data desa.
                      </td>
                    </tr>
                  ) : null}
                  {paginatedVillages.map((village) => {
                    const villageGroups = groups.filter((group) => group.villageId === village.id)

                    return (
                      <tr
                        key={village.id}
                        onClick={() => {
                          setSelectedVillageId(village.id)
                          setGroupPage(1)
                        }}
                        className={`border-t border-stone-200 transition ${selectedVillageId === village.id ? 'bg-teal-50/80' : 'hover:bg-stone-50'} cursor-pointer`}
                      >
                        <td className="px-2 py-1.5 text-slate-900">
                          {editingVillageId === village.id ? (
                            <input
                              value={editingVillageName}
                              onChange={(event) => setEditingVillageName(event.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              className="w-full rounded-md border border-stone-300 bg-stone-50 px-2 py-1 text-xs text-slate-800"
                            />
                          ) : (
                            village.name
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">{villageGroups.length}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            {editingVillageId === village.id ? (
                              <>
                                <button
                                  type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                      void saveVillage(village.id)
                                    }}
                                  className="rounded-md bg-teal-300 px-2 py-1 text-[11px] font-medium text-slate-950"
                                >
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                    onClick={(event) => {
                                      event.stopPropagation()
                                    setEditingVillageId(null)
                                    setEditingVillageName('')
                                  }}
                                  className="rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] text-slate-700"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    startEditVillage(village)
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                                  aria-label={`Edit desa ${village.name}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    void deleteVillage(village)
                                  }}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                                  aria-label={`Hapus desa ${village.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {renderPagination(villagePage, totalVillagePages, setVillagePage)}
          </div>

            <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-display text-xl text-slate-900">Manajemen Kelompok</h3>
                <button
                  type="button"
                  onClick={resetGroupFilter}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-600 transition hover:border-teal-300 hover:text-teal-700"
                  aria-label="Refresh data kelompok"
                  title="Refresh"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              </div>
            <p className="mt-1.5 text-xs leading-6 text-slate-500">Setiap kelompok terhubung ke salah satu desa, dan satu desa bisa memiliki beberapa kelompok.</p>
              {selectedVillageId ? (
                <p className="mt-1 text-[11px] text-teal-700">
                  Filter aktif: {villages.find((village) => village.id === selectedVillageId)?.name || 'Desa terpilih'}
                </p>
              ) : null}
            <form onSubmit={addGroup} className="mt-4 grid gap-2.5 md:grid-cols-[0.95fr_1.05fr_auto]">
              <select
                value={groupForm.villageId}
                onChange={(event) => setGroupForm((current) => ({ ...current, villageId: event.target.value }))}
                className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
              >
                <option value="">Pilih Desa</option>
                {villages.map((village) => (
                  <option key={village.id} value={village.id}>
                    {village.name}
                  </option>
                ))}
              </select>
              <input
                value={groupForm.name}
                onChange={(event) => setGroupForm((current) => ({ ...current, name: event.target.value }))}
                className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
                placeholder="Nama kelompok"
              />
              <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-300 px-3.5 py-2 text-sm font-semibold text-slate-950">
                <Plus className="h-4 w-4" />
                Tambah
              </button>
            </form>

              <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-stone-50 text-[11px] text-slate-500">
                  <tr>
                      <th className="px-2 py-1.5">Kelompok</th>
                      <th className="px-2 py-1.5">Desa</th>
                      <th className="px-2 py-1.5">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                    {filteredGroups.length === 0 ? (
                    <tr className="border-t border-stone-200">
                      <td colSpan={3} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                          {selectedVillageId ? 'Tidak ada data kelompok pada desa terpilih.' : 'Belum ada data kelompok.'}
                      </td>
                    </tr>
                  ) : null}
                  {paginatedGroups.map((group) => {
                    const village = villages.find((item) => item.id === group.villageId)

                    return (
                      <tr key={group.id} className="border-t border-stone-200">
                        <td className="px-2 py-1.5 text-slate-900">
                          {editingGroupId === group.id ? (
                            <input
                              value={editingGroupForm.name}
                              onChange={(event) => setEditingGroupForm((current) => ({ ...current, name: event.target.value }))}
                              className="w-full rounded-md border border-stone-300 bg-stone-50 px-2 py-1 text-xs text-slate-800"
                            />
                          ) : (
                            group.name
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">
                          {editingGroupId === group.id ? (
                            <select
                              value={editingGroupForm.villageId}
                              onChange={(event) => setEditingGroupForm((current) => ({ ...current, villageId: event.target.value }))}
                              className="w-full rounded-md border border-stone-300 bg-stone-50 px-2 py-1 text-xs text-slate-800"
                            >
                              <option value="">Pilih Desa</option>
                              {villages.map((item) => (
                                <option key={item.id} value={item.id}>
                                  {item.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            village?.name || '-'
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            {editingGroupId === group.id ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void saveGroup(group.id)}
                                  className="rounded-md bg-teal-300 px-2 py-1 text-[11px] font-medium text-slate-950"
                                >
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingGroupId(null)
                                    setEditingGroupForm({ villageId: '', name: '' })
                                  }}
                                  className="rounded-md border border-stone-300 bg-white px-2 py-1 text-[11px] text-slate-700"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEditGroup(group)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                                  aria-label={`Edit kelompok ${group.name}`}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void deleteGroup(group)}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                                  aria-label={`Hapus kelompok ${group.name}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {renderPagination(groupPage, totalGroupPages, setGroupPage)}
          </div>
        </div>
      ) : null}

      {section === 'user-approvals' ? (
        <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
          <h3 className="font-display text-xl text-slate-900">Approval Registrasi</h3>
          <p className="mt-1.5 text-xs leading-6 text-slate-500">Tinjau permohonan registrasi user dari submenu khusus approval.</p>
          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-stone-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">No</th>
                  <th className="px-2 py-1.5">Nama Generus</th>
                  <th className="px-2 py-1.5">Email</th>
                  <th className="px-2 py-1.5">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {registrations.length === 0 ? (
                  <tr className="border-t border-stone-200">
                    <td colSpan={4} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                      Tidak ada registrasi pending.
                    </td>
                  </tr>
                ) : null}
                {registrations.map((item, index) => (
                  <tr key={item.id} className="border-t border-stone-200">
                    <td className="px-2 py-1.5 text-slate-700">{index + 1}</td>
                    <td className="px-2 py-1.5 text-slate-900">{item.fullName}</td>
                    <td className="px-2 py-1.5 text-slate-500">{item.email}</td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => reviewRegistration(item.id, 'approve')}
                          className="rounded-md bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700"
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() => reviewRegistration(item.id, 'reject')}
                          className="rounded-md bg-rose-50 px-2 py-1 text-[11px] text-rose-700"
                        >
                          Tolak
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'study-schedules' ? (
        <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-xl text-slate-900">Jadwal Pengajian</h3>
              <p className="mt-1.5 text-xs leading-6 text-slate-500">
                Kelola jadwal pengajian per kelompok dengan tampilan tabel compact seperti data generus.
              </p>
            </div>
            {!scheduleReadOnly ? (
              <button
                type="button"
                onClick={() => setShowCreateScheduleModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-300 px-3.5 py-2 text-sm font-semibold text-slate-950"
              >
                <Plus className="h-4 w-4" />
                Tambah Jadwal
              </button>
            ) : null}
          </div>

          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-stone-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">No</th>
                  <th className="px-2 py-1.5">Kelompok</th>
                  <th className="px-2 py-1.5">Kelompok Usia</th>
                  <th className="px-2 py-1.5">Nama Pengajian</th>
                  <th className="px-2 py-1.5">Tanggal</th>
                  <th className="px-2 py-1.5">Jam Mulai</th>
                  <th className="px-2 py-1.5">Jam Selesai</th>
                  {!scheduleReadOnly ? <th className="px-2 py-1.5">Aksi</th> : null}
                </tr>
              </thead>
              <tbody>
                {sortedSchedules.length === 0 ? (
                  <tr className="border-t border-stone-200">
                    <td colSpan={scheduleReadOnly ? 7 : 8} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                      Belum ada jadwal pengajian.
                    </td>
                  </tr>
                ) : null}
                {paginatedSchedules.map((schedule, index) => {
                  const group = groups.find((item) => item.id === schedule.groupId)
                  const village = villages.find((item) => item.id === group?.villageId)
                  const ageGroup = ageGroups.find((item) => item.id === schedule.ageGroupId)

                  return (
                    <tr key={schedule.id} className="border-t border-stone-200">
                      <td className="px-2 py-1.5 text-slate-700">{(schedulePage - 1) * locationItemsPerPage + index + 1}</td>
                      <td className="px-2 py-1.5 text-slate-900">{group ? `${village?.name || 'Tanpa Desa'} - ${group.name}` : '-'}</td>
                      <td className="px-2 py-1.5 text-slate-500">{ageGroup?.name || '-'}</td>
                      <td className="px-2 py-1.5 text-slate-900">{schedule.studyName}</td>
                      <td className="px-2 py-1.5 text-slate-500">{schedule.studyDate}</td>
                      <td className="px-2 py-1.5 text-slate-500">{schedule.startTime}</td>
                      <td className="px-2 py-1.5 text-slate-500">{schedule.endTime}</td>
                      {!scheduleReadOnly ? (
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openEditScheduleModal(schedule)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                              aria-label={`Edit jadwal ${schedule.studyName}`}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteSchedule(schedule)}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                              aria-label={`Hapus jadwal ${schedule.studyName}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {renderPagination(schedulePage, totalSchedulePages, setSchedulePage)}
        </div>
      ) : null}

      {section === 'study-attendance' ? (
        <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xl text-slate-900">Absensi Pengajian</h3>
              {['admin', 'superadmin'].includes(currentUser?.role || '') ? (
                <button
                  type="button"
                  onClick={resetStudyAttendanceFilters}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                  aria-label="Reset filter absensi pengajian"
                  title="Reset filter"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <p className="mt-1.5 text-xs leading-6 text-slate-500">
              Ringkasan absensi untuk jadwal pengajian pada tanggal hari ini ke belakang. Klik baris untuk melihat detail peserta.
            </p>
          </div>

          {['admin', 'superadmin'].includes(currentUser?.role || '') ? (
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              <label className="block">
                <input
                  list="study-attendance-village-filter-options"
                  value={studyAttendanceVillageQuery}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    const matchedVillage = villageOptions.find((village) => village.label.toLowerCase() === nextValue.toLowerCase())
                    setStudyAttendanceVillageQuery(nextValue)
                    setStudyAttendanceVillageId(matchedVillage ? matchedVillage.id : null)
                    setStudyAttendanceGroupQuery('')
                    setStudyAttendanceGroupId(null)
                  }}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Filter desa (opsional)"
                />
                <datalist id="study-attendance-village-filter-options">
                  {villageOptions.map((village) => (
                    <option key={village.id} value={village.label} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <input
                  list="study-attendance-group-filter-options"
                  value={studyAttendanceGroupQuery}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    const matchedGroup = groupOptionsForStudyAttendanceFilter.find((group) => group.label.toLowerCase() === nextValue.toLowerCase())
                    setStudyAttendanceGroupQuery(nextValue)
                    setStudyAttendanceGroupId(matchedGroup ? matchedGroup.id : null)
                    if (matchedGroup) {
                      const village = villages.find((item) => item.id === matchedGroup.villageId)
                      setStudyAttendanceVillageId(matchedGroup.villageId)
                      setStudyAttendanceVillageQuery(village?.name || '')
                    }
                  }}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Filter kelompok (opsional)"
                />
                <datalist id="study-attendance-group-filter-options">
                  {groupOptionsForStudyAttendanceFilter.map((group) => (
                    <option key={group.id} value={group.label} />
                  ))}
                </datalist>
              </label>
            </div>
          ) : null}

          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-stone-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">No</th>
                  <th className="px-2 py-1.5">Tanggal</th>
                  <th className="px-2 py-1.5">Kelompok</th>
                  <th className="px-2 py-1.5">Kelompok Usia</th>
                  <th className="px-2 py-1.5">Nama Pengajian</th>
                  <th className="px-2 py-1.5">Jam Mulai</th>
                  <th className="px-2 py-1.5">Jam Selesai</th>
                  <th className="px-2 py-1.5">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {studyAttendanceRows.length === 0 ? (
                  <tr className="border-t border-stone-200">
                    <td colSpan={8} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                      Belum ada data jadwal pengajian untuk hari ini atau sebelumnya.
                    </td>
                  </tr>
                ) : null}
                {studyAttendanceRows.map((row, index) => {
                  const isOpen = Boolean(openStudyAttendanceRows[row.schedule.id])

                  return (
                    <Fragment key={row.schedule.id}>
                      <tr
                        onClick={() => {
                          setOpenStudyAttendanceRows((current) => (current[row.schedule.id] ? {} : { [row.schedule.id]: true }))
                        }}
                        className="cursor-pointer border-t border-stone-200 hover:bg-stone-50"
                      >
                        <td className="px-2 py-1.5 text-slate-700">
                          <div className="flex items-center justify-between gap-2">
                            <span>{index + 1}</span>
                            <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition ${isOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </td>
                        <td className="px-2 py-1.5 text-slate-500">{row.schedule.studyDate}</td>
                        <td className="px-2 py-1.5 text-slate-900">{row.groupLabel}</td>
                        <td className="px-2 py-1.5 text-slate-500">{row.ageGroupLabel}</td>
                        <td className="px-2 py-1.5 text-slate-900">{row.schedule.studyName}</td>
                        <td className="px-2 py-1.5 text-slate-500">{row.schedule.startTime}</td>
                        <td className="px-2 py-1.5 text-slate-500">{row.schedule.endTime}</td>
                        <td className="px-2 py-1.5">
                          <div className="flex items-center gap-1">
                            {!hideStudyAttendanceInsertAction ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openStudyAttendanceModal(row.schedule)
                                }}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-teal-200 bg-teal-50 text-teal-700 transition hover:bg-teal-100"
                                aria-label={`Insert absensi ${row.schedule.studyName}`}
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation()
                                printStudyAttendanceSheet(row.schedule.id)
                              }}
                              className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                              aria-label={`Cetak absensi ${row.schedule.studyName}`}
                            >
                              <Printer className="h-3 w-3" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isOpen ? (
                        <tr className="border-t border-stone-200 bg-stone-50/60">
                          <td colSpan={8} className="px-2 py-2.5">
                            <div className="grid gap-2 md:grid-cols-5">
                              <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Jumlah Peserta</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{row.total}</p>
                              </div>
                              <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Hadir</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{row.hadir}</p>
                              </div>
                              <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Izin</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{row.izin}</p>
                              </div>
                              <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Sakit</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{row.sakit}</p>
                              </div>
                              <div className="rounded-lg border border-stone-200 bg-white px-2.5 py-2">
                                <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Alpa</p>
                                <p className="mt-1 text-sm font-semibold text-slate-900">{row.alpa}</p>
                              </div>
                            </div>
                            <div className="mt-3 overflow-hidden rounded-lg border border-stone-200 bg-white">
                              {[
                                { label: 'Pemateri', value: getStudyAttendancePersonName(row.session?.teacherId) },
                                { label: 'Pengawas 1', value: getStudyAttendancePersonName(row.session?.supervisor1Id) },
                                { label: 'Pengawas 2', value: getStudyAttendancePersonName(row.session?.supervisor2Id) },
                                { label: 'Pengawas 3', value: getStudyAttendancePersonName(row.session?.supervisor3Id) },
                              ].map((item, detailIndex) => (
                                <div
                                  key={item.label}
                                  className={`grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-2.5 py-2 text-[11px] ${
                                    detailIndex > 0 ? 'border-t border-stone-200' : ''
                                  }`}
                                >
                                  <span className="font-medium text-slate-500">{item.label}</span>
                                  <span className="text-slate-900">{item.value}</span>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'study-roster' ? (
        <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
          <div>
            <h3 className="font-display text-xl text-slate-900">Roster Pengajian</h3>
            <p className="mt-1.5 text-xs leading-6 text-slate-500">
              Klik tanggal pada kalender bulan untuk melihat daftar jadwal pengajian pada hari tersebut.
            </p>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Kalender Bulan</p>
                  <h4 className="mt-1 text-sm font-semibold text-slate-900">{rosterMonthFormatter.format(rosterMonth)}</h4>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setRosterMonth((current) => shiftJakartaMonth(current, -1))}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                    aria-label="Bulan sebelumnya"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRosterMonth((current) => shiftJakartaMonth(current, 1))}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-stone-200 bg-white text-slate-700 transition hover:border-teal-300 hover:text-teal-700"
                    aria-label="Bulan berikutnya"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-7 gap-1">
                {rosterWeekdayLabels.map((label) => (
                  <div key={label} className="rounded-md bg-stone-50 px-1 py-1.5 text-center text-[11px] font-medium text-slate-500">
                    {label}
                  </div>
                ))}
              </div>

              <div className="mt-1 grid grid-cols-7 gap-1">
                {calendarDays.map((day) => {
                  const isSelected = day.dateKey === selectedRosterDate
                  const indicatorTone =
                    day.scheduleCount === 0
                      ? ''
                      : day.attendedCount >= day.scheduleCount
                        ? 'bg-teal-500'
                        : day.attendedCount > 0
                          ? 'bg-sky-400'
                          : 'bg-amber-400'

                  return (
                    <button
                      key={day.dateKey}
                      type="button"
                      onClick={() => {
                        setSelectedRosterDate(day.dateKey)
                        if (!day.isCurrentMonth) {
                          setRosterMonth(getJakartaMonthStartFromDateKey(day.dateKey))
                        }
                      }}
                      className={`min-h-[72px] rounded-lg border px-1.5 py-1.5 text-left transition ${
                        isSelected
                          ? 'border-teal-300 bg-teal-50'
                          : day.isCurrentMonth
                            ? 'border-stone-200 bg-white hover:border-teal-200 hover:bg-stone-50'
                            : 'border-stone-200 bg-stone-50/80 text-slate-400 hover:border-stone-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-1">
                        <span className={`text-xs font-medium ${isSelected ? 'text-teal-700' : day.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'}`}>
                          {day.dayNumber}
                        </span>
                        {day.scheduleCount > 0 ? (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              isSelected ? 'bg-teal-200 text-teal-800' : 'bg-stone-100 text-slate-600'
                            }`}
                          >
                            {day.attendedCount > 0 ? `${day.attendedCount}/${day.scheduleCount}` : day.scheduleCount}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-4">
                        {day.scheduleCount > 0 ? <div className={`h-1.5 w-6 rounded-full ${indicatorTone}`} /> : null}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-3">
              <div className="border-b border-stone-200 pb-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Jadwal Pengajian</p>
                <h4 className="mt-1 text-sm font-semibold text-slate-900">{rosterDateFormatter.format(parseJakartaDateKey(selectedRosterDate))}</h4>
                <p className="mt-1 text-[11px] text-slate-500">
                  {selectedRosterSchedules.length} jadwal untuk tanggal yang dipilih.
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {selectedRosterSchedules.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-stone-200 bg-stone-50 px-3 py-4 text-[11px] text-slate-500">
                    Belum ada jadwal pengajian pada tanggal ini.
                  </div>
                ) : null}

                {selectedRosterSchedules.map((schedule) => (
                  <div key={schedule.id} className="rounded-lg border border-stone-200 bg-stone-50/70 px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{schedule.studyName}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{schedule.groupLabel}</p>
                        <p className="mt-1 text-[11px] text-slate-500">Kelompok Usia: {schedule.ageGroupLabel}</p>
                      </div>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <div
                          className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${
                            scheduleIdsWithAttendance.has(schedule.id)
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {scheduleIdsWithAttendance.has(schedule.id) ? 'Sudah Absensi' : 'Belum Absensi'}
                        </div>
                        <div className="rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-700">
                          {schedule.startTime} - {schedule.endTime}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {section === 'attendance' ? (
        <div className="rounded-[20px] border border-stone-200 bg-white/90 p-4">
          <h3 className="font-display text-xl text-slate-900">Manajemen Absensi</h3>
          <p className="mt-1.5 text-xs leading-6 text-slate-500">Pantau seluruh catatan absensi user dari menu tersendiri agar pengelolaannya lebih fokus.</p>
          <div className="mt-4 overflow-auto rounded-xl border border-stone-200">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-stone-50 text-[11px] text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Tanggal</th>
                  <th className="px-2 py-1.5">User</th>
                  <th className="px-2 py-1.5">Status</th>
                  <th className="px-2 py-1.5">Catatan</th>
                </tr>
              </thead>
              <tbody>
                {attendances.length === 0 ? (
                  <tr className="border-t border-stone-200">
                    <td colSpan={4} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                      Belum ada data absensi.
                    </td>
                  </tr>
                ) : null}
                {attendances.map((item) => (
                  <tr key={item.id} className="border-t border-stone-200">
                    <td className="px-2 py-1.5 text-slate-700">{item.attendanceDate}</td>
                    <td className="px-2 py-1.5 text-slate-700">{item.user?.fullName || item.userId}</td>
                    <td className="px-2 py-1.5 text-teal-700">{item.status}</td>
                    <td className="px-2 py-1.5 text-slate-500">{item.note || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {section === 'landing-home' ? (
        <form onSubmit={saveCms} className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
          <h3 className="font-display text-2xl text-slate-900">Kelola Home</h3>
          <p className="mt-2 text-sm text-slate-500">Atur identitas utama yang tampil pertama kali pada landing page.</p>
          <div className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="grid gap-3 md:grid-cols-2">
              <input
                value={cmsForm.heroBadge}
                onChange={(event) => setCmsForm((current) => ({ ...current, heroBadge: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Hero badge"
              />
              <input
                value={cmsForm.heroTitle}
                onChange={(event) => setCmsForm((current) => ({ ...current, heroTitle: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Hero title"
              />
              <textarea
                value={cmsForm.heroSubtitle}
                onChange={(event) => setCmsForm((current) => ({ ...current, heroSubtitle: event.target.value }))}
                className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                placeholder="Hero subtitle"
              />
              <input
                value={cmsForm.ui.heroPrimaryButtonLabel}
                onChange={(event) =>
                  setCmsForm((current) => ({
                    ...current,
                    ui: { ...current.ui, heroPrimaryButtonLabel: event.target.value },
                  }))
                }
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Label tombol utama"
              />
              <input
                value={cmsForm.ui.heroSecondaryButtonLabel}
                onChange={(event) =>
                  setCmsForm((current) => ({
                    ...current,
                    ui: { ...current.ui, heroSecondaryButtonLabel: event.target.value },
                  }))
                }
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Label tombol kedua"
              />
              <input
                value={cmsForm.ui.heroImageAlt}
                onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, heroImageAlt: event.target.value } }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                placeholder="Alt gambar hero"
              />
              <input
                value={cmsForm.ui.heroImagePlaceholderText}
                onChange={(event) =>
                  setCmsForm((current) => ({ ...current, ui: { ...current.ui, heroImagePlaceholderText: event.target.value } }))
                }
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                placeholder="Teks jika foto hero kosong"
              />
            </div>

            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-4">
              <div className="overflow-hidden rounded-[20px] border border-stone-200 bg-white">
                {cmsForm.heroImageUrl ? (
                  <img src={cmsForm.heroImageUrl} alt={cmsForm.heroTitle || 'Preview foto home'} className="h-64 w-full object-cover" />
                ) : (
                  <div className="flex h-64 items-center justify-center px-4 text-center text-sm text-slate-500">
                    Foto home belum tersedia.
                  </div>
                )}
              </div>
              <div className="mt-4 space-y-2.5">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <ImagePlus className="h-4 w-4 text-teal-700" />
                  Upload Foto Home
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setHomePhotoFile(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-teal-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                />
                <button
                  type="button"
                  onClick={uploadHomePhoto}
                  disabled={!homePhotoFile || uploadingHomePhoto}
                  className="rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploadingHomePhoto ? 'Mengunggah...' : 'Upload Foto Home'}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[20px] border border-stone-200 bg-stone-50 p-4">
            <p className="text-sm font-semibold text-slate-900">Highlight</p>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              {cmsForm.ui.highlights.map((item, index) => (
                <div key={index} className="rounded-[18px] border border-stone-200 bg-white p-3">
                  <input
                    value={item.label}
                    onChange={(event) =>
                      setCmsForm((current) => ({
                        ...current,
                        ui: {
                          ...current.ui,
                          highlights: current.ui.highlights.map((highlight, idx) =>
                            idx === index ? { ...highlight, label: event.target.value } : highlight,
                          ),
                        },
                      }))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
                    placeholder="Label"
                  />
                  <input
                    value={index === 0 ? String(cmsForm.activities.length) : item.value}
                    disabled={index === 0}
                    onChange={(event) =>
                      setCmsForm((current) => ({
                        ...current,
                        ui: {
                          ...current.ui,
                          highlights: current.ui.highlights.map((highlight, idx) =>
                            idx === index ? { ...highlight, value: event.target.value } : highlight,
                          ),
                        },
                      }))
                    }
                    className="mt-2 w-full rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800 disabled:opacity-70"
                    placeholder="Value"
                  />
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className="mt-5 rounded-xl bg-teal-300 px-3.5 py-2.5 text-sm font-semibold text-slate-950">
            Simpan Konten Home
          </button>
        </form>
      ) : null}

      {section === 'landing-header' ? (
        <form onSubmit={saveCms} className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
          <h3 className="font-display text-2xl text-slate-900">Kelola Header & Navigasi</h3>
          <p className="mt-2 text-sm text-slate-500">Atur brand, label menu, dan tombol yang tampil pada header landing page.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              value={cmsForm.ui.headerBrandName}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, headerBrandName: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Nama brand"
            />
            <input
              value={cmsForm.ui.headerTagline}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, headerTagline: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Tagline"
            />
            <input
              value={cmsForm.ui.headerLogoAlt}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, headerLogoAlt: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
              placeholder="Alt logo"
            />
            <input
              value={cmsForm.ui.navHomeLabel}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, navHomeLabel: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Label menu Home"
            />
            <input
              value={cmsForm.ui.navVisionLabel}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, navVisionLabel: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Label menu Visi"
            />
            <input
              value={cmsForm.ui.navMissionLabel}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, navMissionLabel: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Label menu Misi"
            />
            <input
              value={cmsForm.ui.navActivitiesLabel}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, navActivitiesLabel: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Label menu Kegiatan"
            />
            <input
              value={cmsForm.ui.navContactLabel}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, navContactLabel: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Label menu Hubungi"
            />
            <input
              value={cmsForm.ui.headerLoginLabel}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, headerLoginLabel: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Label tombol Login"
            />
            <input
              value={cmsForm.ui.headerRegisterLabel}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, headerRegisterLabel: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Label tombol Registrasi"
            />
          </div>

          <button type="submit" className="mt-5 rounded-xl bg-teal-300 px-3.5 py-2.5 text-sm font-semibold text-slate-950">
            Simpan Header
          </button>
        </form>
      ) : null}

      {section === 'landing-vision' ? (
        <form onSubmit={saveCms} className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
          <h3 className="font-display text-2xl text-slate-900">Kelola Visi</h3>
          <p className="mt-2 text-sm text-slate-500">Fokuskan pengelolaan isi visi tanpa tercampur dengan bagian landing page lainnya.</p>
          <div className="mt-5">
            <input
              value={cmsForm.ui.visionHeadingTitle}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, visionHeadingTitle: event.target.value } }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Judul section Visi"
            />
            <textarea
              value={cmsForm.ui.visionHeadingDescription}
              onChange={(event) =>
                setCmsForm((current) => ({ ...current, ui: { ...current.ui, visionHeadingDescription: event.target.value } }))
              }
              className="mt-3 min-h-24 w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Deskripsi section Visi"
            />
            <textarea
              value={cmsForm.visionText}
              onChange={(event) => setCmsForm((current) => ({ ...current, visionText: event.target.value }))}
              className="mt-3 min-h-32 w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Visi"
            />
          </div>

          <button type="submit" className="mt-5 rounded-xl bg-teal-300 px-3.5 py-2.5 text-sm font-semibold text-slate-950">
            Simpan Visi
          </button>
        </form>
      ) : null}

      {section === 'landing-mission' ? (
        <form onSubmit={saveCms} className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
          <h3 className="font-display text-2xl text-slate-900">Kelola Misi</h3>
          <p className="mt-2 text-sm text-slate-500">Masukkan satu misi per baris agar daftar misi pada landing page tersusun rapi.</p>
          <div className="mt-5">
            <input
              value={cmsForm.ui.missionHeadingTitle}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, missionHeadingTitle: event.target.value } }))}
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Judul section Misi"
            />
            <textarea
              value={cmsForm.ui.missionHeadingDescription}
              onChange={(event) =>
                setCmsForm((current) => ({ ...current, ui: { ...current.ui, missionHeadingDescription: event.target.value } }))
              }
              className="mt-3 min-h-24 w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Deskripsi section Misi"
            />
            <textarea
              value={cmsForm.missionItems.join('\n')}
              onChange={(event) =>
                setCmsForm((current) => ({
                  ...current,
                  missionItems: event.target.value.split('\n').filter(Boolean),
                }))
              }
              className="mt-3 min-h-32 w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Satu misi per baris"
            />
          </div>

          <button type="submit" className="mt-5 rounded-xl bg-teal-300 px-3.5 py-2.5 text-sm font-semibold text-slate-950">
            Simpan Misi
          </button>
        </form>
      ) : null}

      {section === 'landing-contact' ? (
        <form onSubmit={saveCms} className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
          <h3 className="font-display text-2xl text-slate-900">Kelola Hubungi</h3>
          <p className="mt-2 text-sm text-slate-500">Perbarui informasi alamat dan kontak yang ditampilkan untuk pengunjung.</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <input
              value={cmsForm.ui.contactHeadingTitle}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, contactHeadingTitle: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
              placeholder="Judul section Hubungi"
            />
            <textarea
              value={cmsForm.ui.contactHeadingDescription}
              onChange={(event) =>
                setCmsForm((current) => ({ ...current, ui: { ...current.ui, contactHeadingDescription: event.target.value } }))
              }
              className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
              placeholder="Deskripsi section Hubungi"
            />
            <input
              value={cmsForm.contactAddress}
              onChange={(event) => setCmsForm((current) => ({ ...current, contactAddress: event.target.value }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Alamat"
            />
            <input
              value={cmsForm.contactPhone}
              onChange={(event) => setCmsForm((current) => ({ ...current, contactPhone: event.target.value }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Telepon"
            />
            <input
              value={cmsForm.contactEmail}
              onChange={(event) => setCmsForm((current) => ({ ...current, contactEmail: event.target.value }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
              placeholder="Email"
            />
            <input
              value={cmsForm.ui.socialMediaTitle}
              onChange={(event) => setCmsForm((current) => ({ ...current, ui: { ...current.ui, socialMediaTitle: event.target.value } }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
              placeholder="Judul sosial media"
            />
            <input
              value={cmsForm.instagramUrl}
              onChange={(event) => setCmsForm((current) => ({ ...current, instagramUrl: event.target.value }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="URL Instagram"
            />
            <input
              value={cmsForm.facebookUrl}
              onChange={(event) => setCmsForm((current) => ({ ...current, facebookUrl: event.target.value }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="URL Facebook"
            />
            <input
              value={cmsForm.tiktokUrl}
              onChange={(event) => setCmsForm((current) => ({ ...current, tiktokUrl: event.target.value }))}
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
              placeholder="URL Tiktok"
            />
          </div>

          <button type="submit" className="mt-5 rounded-xl bg-teal-300 px-3.5 py-2.5 text-sm font-semibold text-slate-950">
            Simpan Kontak
          </button>
        </form>
      ) : null}

      {section === 'landing-activities' ? (
        <form onSubmit={saveCms} className="rounded-[24px] border border-stone-200 bg-white/90 p-5">
          <h3 className="font-display text-2xl text-slate-900">Kelola Kegiatan</h3>
          <p className="mt-2 text-sm text-slate-500">Kelola kegiatan seperti artikel: judul, deskripsi, foto, lalu tambah atau hapus item sesuai kebutuhan. Daftar ditampilkan dari yang terbaru ke yang terlama.</p>
          <div className="mt-5 grid gap-3">
            <input
              value={cmsForm.ui.activitiesHeadingTitle}
              onChange={(event) =>
                setCmsForm((current) => ({ ...current, ui: { ...current.ui, activitiesHeadingTitle: event.target.value } }))
              }
              className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Judul section Kegiatan"
            />
            <textarea
              value={cmsForm.ui.activitiesHeadingDescription}
              onChange={(event) =>
                setCmsForm((current) => ({ ...current, ui: { ...current.ui, activitiesHeadingDescription: event.target.value } }))
              }
              className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              placeholder="Deskripsi section Kegiatan"
            />
          </div>
          <div className="mt-5">
            <button
              type="button"
              onClick={addActivity}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-300 px-3.5 py-2.5 text-sm font-semibold text-slate-950"
            >
              <Plus className="h-4 w-4" />
              Tambah Kegiatan
            </button>
          </div>

          <div className="mt-6 space-y-4">
            {cmsForm.activities.map((activity, index) => (
              <div key={activity.id} className="rounded-[20px] border border-stone-200 bg-stone-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Kegiatan {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => removeActivity(index)}
                    className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2 text-sm text-rose-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Hapus
                  </button>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[200px_minmax(0,1fr)]">
                  <div className="space-y-2.5">
                    <div className="overflow-hidden rounded-[18px] border border-stone-200 bg-white">
                      {activity.imageUrl ? (
                        <img src={activity.imageUrl} alt={activity.title || `Kegiatan ${index + 1}`} className="h-36 w-full object-cover" />
                      ) : (
                        <div className="flex h-36 items-center justify-center px-4 text-center text-sm text-slate-500">
                          Belum ada foto kegiatan
                        </div>
                      )}
                    </div>
                    <label className="block">
                      <span className="mb-2 block text-sm text-slate-600">Upload Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(event) => void uploadActivityPhoto(activity.id, event.target.files?.[0] || null)}
                        className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-white file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700"
                      />
                    </label>
                    {uploadingActivityId === activity.id ? (
                        <div className="inline-flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2 text-sm text-amber-700">
                        <ImagePlus className="h-4 w-4" />
                        Mengunggah foto...
                      </div>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    <input
                      value={activity.title}
                      onChange={(event) => updateActivity(index, 'title', event.target.value)}
                      className="rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-slate-800"
                      placeholder="Judul kegiatan"
                    />
                    <textarea
                      value={activity.description}
                      onChange={(event) => updateActivity(index, 'description', event.target.value)}
                      className="min-h-28 rounded-xl border border-stone-300 bg-white px-3.5 py-2.5 text-sm text-slate-800"
                      placeholder="Deskripsi kegiatan"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="submit" className="mt-5 rounded-xl bg-teal-300 px-3.5 py-2.5 text-sm font-semibold text-slate-950">
            Simpan Kegiatan
          </button>
        </form>
      ) : null}

      {editingUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={saveEditedUser} className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Edit {managedUserConfig.title}</h3>
                <p className="mt-2 text-sm text-slate-500">Perbarui biodata {managedUserConfig.singularLower} dan unggah foto profil dari popup ini.</p>
              </div>
              <button type="button" onClick={closeEditModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-[20px] border border-stone-200 bg-stone-100">
                  {editingUser.profile?.photoUrl ? (
                    <img src={editingUser.profile.photoUrl} alt={editingUser.fullName} className="h-72 w-full object-cover" />
                  ) : (
                    <div className="flex h-72 items-center justify-center px-4 text-center text-sm text-slate-500">Belum ada foto profil.</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setEditPhotoFile(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-teal-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                />
                {editPhotoFile ? <p className="text-xs text-teal-700">Foto baru dipilih: {editPhotoFile.name}</p> : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={editForm.fullName}
                  onChange={(event) => setEditForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder={`Nama ${managedUserConfig.singularLower}`}
                />
                <input
                  value={editForm.email}
                  onChange={(event) => setEditForm((current) => ({ ...current, email: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder={`Email ${managedUserConfig.singularLower}`}
                />
                <select
                  value={editForm.gender}
                  onChange={(event) => setEditForm((current) => ({ ...current, gender: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                >
                  <option value="">Pilih Jenis Kelamin</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
                <input
                  value={editForm.birthPlace}
                  onChange={(event) => setEditForm((current) => ({ ...current, birthPlace: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Tempat lahir"
                />
                <input
                  type="date"
                  value={editForm.birthDate}
                  onChange={(event) => setEditForm((current) => ({ ...current, birthDate: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                />
                <input
                  value={editForm.phoneNumber}
                  onChange={(event) => setEditForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nomor telepon"
                />
                <input
                  value={editForm.guardianName}
                  onChange={(event) => setEditForm((current) => ({ ...current, guardianName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama ayah"
                />
                <input
                  value={editForm.motherName}
                  onChange={(event) => setEditForm((current) => ({ ...current, motherName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama ibu"
                />
                <textarea
                  value={editForm.address}
                  onChange={(event) => setEditForm((current) => ({ ...current, address: event.target.value }))}
                  className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder="Alamat"
                />
                <textarea
                  value={editForm.biography}
                  onChange={(event) => setEditForm((current) => ({ ...current, biography: event.target.value }))}
                  className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder="Biografi singkat"
                />
                {managedUserConfig.relationMode !== 'none' ? (
                  <label className="block space-y-2 md:col-span-2">
                    <span className="text-sm text-slate-600">{managedUserConfig.relationMode === 'village' ? 'Desa' : 'Kelompok'}</span>
                    <input
                      list={managedUserConfig.relationMode === 'village' ? 'pjp-village-options' : 'generus-group-options'}
                      value={editGroupQuery}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        const matchedGroup = groupOptions.find((group) => group.label.toLowerCase() === nextValue.toLowerCase())
                        const matchedVillage = villageOptions.find((village) => village.label.toLowerCase() === nextValue.toLowerCase())
                        setEditGroupQuery(nextValue)
                        setEditForm((current) => ({
                          ...current,
                          groupId: managedUserConfig.relationMode === 'group' ? (matchedGroup ? String(matchedGroup.id) : '') : '',
                          villageId: managedUserConfig.relationMode === 'village' ? (matchedVillage ? String(matchedVillage.id) : '') : '',
                        }))
                      }}
                      className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                      placeholder={managedUserConfig.relationMode === 'village' ? 'Ketik lalu pilih desa' : 'Ketik lalu pilih kelompok'}
                    />
                    {managedUserConfig.relationMode === 'village' ? (
                      <datalist id="pjp-village-options">
                        {villageOptions.map((village) => (
                          <option key={village.id} value={village.label} />
                        ))}
                      </datalist>
                    ) : (
                      <datalist id="generus-group-options">
                        {groupOptions.map((group) => (
                          <option key={group.id} value={group.label} />
                        ))}
                      </datalist>
                    )}
                    {editUserRelationError ? <p className="text-[11px] text-rose-600">{editUserRelationError}</p> : null}
                  </label>
                ) : null}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeEditModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingUserAction}
                className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingUserAction ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingTeacher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={saveEditedTeacher} className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Edit Dewan Guru</h3>
                <p className="mt-2 text-sm text-slate-500">Perbarui biodata dewan guru dan unggah foto profil dari popup ini.</p>
              </div>
              <button type="button" onClick={closeEditTeacherModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-3">
                <div className="overflow-hidden rounded-[20px] border border-stone-200 bg-stone-100">
                  {editingTeacher.profile?.photoUrl ? (
                    <img src={editingTeacher.profile.photoUrl} alt={editingTeacher.fullName} className="h-72 w-full object-cover" />
                  ) : (
                    <div className="flex h-72 items-center justify-center px-4 text-center text-sm text-slate-500">Belum ada foto profil.</div>
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setEditTeacherPhotoFile(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                />
                {editTeacherPhotoFile ? <p className="text-xs text-amber-700">Foto baru dipilih: {editTeacherPhotoFile.name}</p> : null}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={editTeacherForm.fullName}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama dewan guru"
                />
                <input
                  value={editTeacherForm.email}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, email: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Email dewan guru"
                />
                <select
                  value={editTeacherForm.gender}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, gender: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                >
                  <option value="">Pilih Jenis Kelamin</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
                <input
                  value={editTeacherForm.birthPlace}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, birthPlace: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Tempat lahir"
                />
                <input
                  type="date"
                  value={editTeacherForm.birthDate}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, birthDate: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                />
                <input
                  value={editTeacherForm.phoneNumber}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nomor telepon"
                />
                <input
                  value={editTeacherForm.guardianName}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, guardianName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama ayah"
                />
                <input
                  value={editTeacherForm.motherName}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, motherName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama ibu"
                />
                <textarea
                  value={editTeacherForm.address}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, address: event.target.value }))}
                  className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder="Alamat"
                />
                <textarea
                  value={editTeacherForm.biography}
                  onChange={(event) => setEditTeacherForm((current) => ({ ...current, biography: event.target.value }))}
                  className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder="Biografi singkat"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeEditTeacherModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingTeacherAction}
                className="rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingTeacherAction ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showCreateUserModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={addUser} className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">{managedUserConfig.addLabel}</h3>
                <p className="mt-2 text-sm text-slate-500">Isi data {managedUserConfig.singularLower} baru dari popup ini, termasuk upload foto profil.</p>
              </div>
              <button type="button" onClick={closeCreateUserModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-3">
                <div className="flex h-72 items-center justify-center overflow-hidden rounded-[20px] border border-stone-200 bg-stone-100 px-4 text-center text-sm text-slate-500">
                  {createUserPhotoFile ? `Foto dipilih: ${createUserPhotoFile.name}` : 'Belum ada foto profil.'}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setCreateUserPhotoFile(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-teal-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={userForm.fullName}
                  onChange={(event) => setUserForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder={`Nama ${managedUserConfig.singularLower}`}
                />
                <input
                  value={userForm.email}
                  onChange={(event) => setUserForm((current) => ({ ...current, email: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder={`Email ${managedUserConfig.singularLower}`}
                />
                <input
                  type="password"
                  value={userForm.password}
                  onChange={(event) => setUserForm((current) => ({ ...current, password: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder={`Password awal ${managedUserConfig.singularLower}`}
                />
                {managedUserConfig.relationMode !== 'none' ? (
                  <label className="block space-y-2 md:col-span-2">
                    <span className="text-sm text-slate-600">{managedUserConfig.relationMode === 'village' ? 'Desa' : 'Kelompok'}</span>
                    <input
                      list={managedUserConfig.relationMode === 'village' ? 'create-pjp-village-options' : 'create-generus-group-options'}
                      value={createGroupQuery}
                      onChange={(event) => {
                        const nextValue = event.target.value
                        const matchedGroup = groupOptions.find((group) => group.label.toLowerCase() === nextValue.toLowerCase())
                        const matchedVillage = villageOptions.find((village) => village.label.toLowerCase() === nextValue.toLowerCase())
                        setCreateGroupQuery(nextValue)
                        setUserForm((current) => ({
                          ...current,
                          groupId: managedUserConfig.relationMode === 'group' ? (matchedGroup ? String(matchedGroup.id) : '') : '',
                          villageId: managedUserConfig.relationMode === 'village' ? (matchedVillage ? String(matchedVillage.id) : '') : '',
                        }))
                      }}
                      className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                      placeholder={managedUserConfig.relationMode === 'village' ? 'Ketik lalu pilih desa' : 'Ketik lalu pilih kelompok'}
                    />
                    {managedUserConfig.relationMode === 'village' ? (
                      <datalist id="create-pjp-village-options">
                        {villageOptions.map((village) => (
                          <option key={village.id} value={village.label} />
                        ))}
                      </datalist>
                    ) : (
                      <datalist id="create-generus-group-options">
                        {groupOptions.map((group) => (
                          <option key={group.id} value={group.label} />
                        ))}
                      </datalist>
                    )}
                    {createUserRelationError ? <p className="text-[11px] text-rose-600">{createUserRelationError}</p> : null}
                  </label>
                ) : null}
                <select
                  value={userForm.gender}
                  onChange={(event) => setUserForm((current) => ({ ...current, gender: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                >
                  <option value="">Pilih Jenis Kelamin</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
                <input
                  value={userForm.birthPlace}
                  onChange={(event) => setUserForm((current) => ({ ...current, birthPlace: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Tempat lahir"
                />
                <input
                  type="date"
                  value={userForm.birthDate}
                  onChange={(event) => setUserForm((current) => ({ ...current, birthDate: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                />
                <input
                  value={userForm.phoneNumber}
                  onChange={(event) => setUserForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nomor telepon"
                />
                <input
                  value={userForm.guardianName}
                  onChange={(event) => setUserForm((current) => ({ ...current, guardianName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama ayah"
                />
                <input
                  value={userForm.motherName}
                  onChange={(event) => setUserForm((current) => ({ ...current, motherName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama ibu"
                />
                <textarea
                  value={userForm.address}
                  onChange={(event) => setUserForm((current) => ({ ...current, address: event.target.value }))}
                  className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder="Alamat"
                />
                <textarea
                  value={userForm.biography}
                  onChange={(event) => setUserForm((current) => ({ ...current, biography: event.target.value }))}
                  className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder="Biografi singkat"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeCreateUserModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingUserAction}
                className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingUserAction ? 'Menyimpan...' : `Simpan ${managedUserConfig.singular}`}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showCreateTeacherModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={addTeacher} className="max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Tambah Dewan Guru</h3>
                <p className="mt-2 text-sm text-slate-500">Isi data dewan guru baru dari popup ini, termasuk upload foto profil.</p>
              </div>
              <button type="button" onClick={closeCreateTeacherModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
              <div className="space-y-3">
                <div className="flex h-72 items-center justify-center overflow-hidden rounded-[20px] border border-stone-200 bg-stone-100 px-4 text-center text-sm text-slate-500">
                  {createTeacherPhotoFile ? `Foto dipilih: ${createTeacherPhotoFile.name}` : 'Belum ada foto profil.'}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(event) => setCreateTeacherPhotoFile(event.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-600 file:mr-4 file:rounded-2xl file:border-0 file:bg-amber-300 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-slate-950"
                />
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <input
                  value={teacherForm.fullName}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama dewan guru"
                />
                <input
                  value={teacherForm.email}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, email: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Email dewan guru"
                />
                <input
                  type="password"
                  value={teacherForm.password}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, password: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder="Password awal dewan guru"
                />
                <select
                  value={teacherForm.gender}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, gender: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                >
                  <option value="">Pilih Jenis Kelamin</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
                <input
                  value={teacherForm.birthPlace}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, birthPlace: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Tempat lahir"
                />
                <input
                  type="date"
                  value={teacherForm.birthDate}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, birthDate: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                />
                <input
                  value={teacherForm.phoneNumber}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, phoneNumber: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nomor telepon"
                />
                <input
                  value={teacherForm.guardianName}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, guardianName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama ayah"
                />
                <input
                  value={teacherForm.motherName}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, motherName: event.target.value }))}
                  className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Nama ibu"
                />
                <textarea
                  value={teacherForm.address}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, address: event.target.value }))}
                  className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder="Alamat"
                />
                <textarea
                  value={teacherForm.biography}
                  onChange={(event) => setTeacherForm((current) => ({ ...current, biography: event.target.value }))}
                  className="min-h-24 rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                  placeholder="Biografi singkat"
                />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeCreateTeacherModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingTeacherAction}
                className="rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingTeacherAction ? 'Menyimpan...' : 'Simpan Dewan Guru'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {showCreateAgeGroupModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={addAgeGroup} className="w-full max-w-2xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Tambah Kelompok Usia</h3>
                <p className="mt-2 text-sm text-slate-500">Isi nama kelompok usia, usia minimal, dan usia maksimal bila ada batas atasnya.</p>
              </div>
              <button type="button" onClick={closeCreateAgeGroupModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={ageGroupForm.name}
                onChange={(event) => setAgeGroupForm((current) => ({ ...current, name: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                placeholder="Nama kelompok usia"
              />
              <input
                type="number"
                min="0"
                value={ageGroupForm.minAge}
                onChange={(event) => setAgeGroupForm((current) => ({ ...current, minAge: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Usia minimal"
              />
              <input
                type="number"
                min="0"
                value={ageGroupForm.maxAge}
                onChange={(event) => setAgeGroupForm((current) => ({ ...current, maxAge: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Usia maksimal (opsional)"
              />
              <p className="text-[11px] text-slate-500 md:col-span-2">Contoh: Paud 0-6 tahun, Cabe Rawit 6-12 tahun, atau Usia Mandiri 18 tahun ke atas.</p>
              {ageGroupError ? <p className="text-[11px] text-rose-600 md:col-span-2">{ageGroupError}</p> : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeCreateAgeGroupModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingAgeGroupAction}
                className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingAgeGroupAction ? 'Menyimpan...' : 'Simpan Kelompok Usia'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingAgeGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={saveAgeGroup} className="w-full max-w-2xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Edit Kelompok Usia</h3>
                <p className="mt-2 text-sm text-slate-500">Perbarui nama dan rentang usia untuk kelompok ini.</p>
              </div>
              <button type="button" onClick={closeEditAgeGroupModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <input
                value={editAgeGroupForm.name}
                onChange={(event) => setEditAgeGroupForm((current) => ({ ...current, name: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800 md:col-span-2"
                placeholder="Nama kelompok usia"
              />
              <input
                type="number"
                min="0"
                value={editAgeGroupForm.minAge}
                onChange={(event) => setEditAgeGroupForm((current) => ({ ...current, minAge: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Usia minimal"
              />
              <input
                type="number"
                min="0"
                value={editAgeGroupForm.maxAge}
                onChange={(event) => setEditAgeGroupForm((current) => ({ ...current, maxAge: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Usia maksimal (opsional)"
              />
              {ageGroupError ? <p className="text-[11px] text-rose-600 md:col-span-2">{ageGroupError}</p> : null}
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeEditAgeGroupModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingAgeGroupAction}
                className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingAgeGroupAction ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteAgeGroup ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-md rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <h3 className="font-display text-2xl text-slate-900">Hapus Kelompok Usia</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Apakah data <span className="font-semibold text-slate-900">{deleteAgeGroup.name}</span> akan dihapus?
            </p>
            {ageGroupError ? <p className="mt-3 text-[11px] text-rose-600">{ageGroupError}</p> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setDeleteAgeGroup(null)
                  setAgeGroupError('')
                }}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                Tidak
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteAgeGroup()}
                disabled={processingAgeGroupAction}
                className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {processingAgeGroupAction ? 'Menghapus...' : 'Ya'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showCreateScheduleModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={addSchedule} className="w-full max-w-2xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Tambah Jadwal Pengajian</h3>
                <p className="mt-2 text-sm text-slate-500">Isi kelompok, kelompok usia, nama pengajian, tanggal, dan jam pelaksanaan.</p>
              </div>
              <button type="button" onClick={closeCreateScheduleModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="block md:col-span-2">
                <input
                  list="study-schedule-group-options"
                  value={scheduleGroupQuery}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    const matchedGroup = groupOptions.find((group) => group.label.toLowerCase() === nextValue.toLowerCase())
                    setScheduleGroupQuery(nextValue)
                    setScheduleForm((current) => ({
                      ...current,
                      groupId: matchedGroup ? String(matchedGroup.id) : '',
                    }))
                  }}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Ketik lalu pilih kelompok"
                />
                <datalist id="study-schedule-group-options">
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.label} />
                  ))}
                </datalist>
              </label>
              <label className="block md:col-span-2">
                <input
                  list="study-schedule-age-group-options"
                  value={scheduleAgeGroupQuery}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    const matchedAgeGroup = ageGroupOptions.find((ageGroup) => ageGroup.label.toLowerCase() === nextValue.toLowerCase())
                    setScheduleAgeGroupQuery(nextValue)
                    setScheduleForm((current) => ({
                      ...current,
                      ageGroupId: matchedAgeGroup ? String(matchedAgeGroup.id) : '',
                    }))
                  }}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Ketik lalu pilih kelompok usia"
                />
                <datalist id="study-schedule-age-group-options">
                  {ageGroupOptions.map((ageGroup) => (
                    <option key={ageGroup.id} value={ageGroup.label} />
                  ))}
                </datalist>
              </label>
              <input
                value={scheduleForm.studyName}
                onChange={(event) => setScheduleForm((current) => ({ ...current, studyName: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Nama pengajian"
              />
              <input
                type="date"
                value={scheduleForm.studyDate}
                onChange={(event) => setScheduleForm((current) => ({ ...current, studyDate: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              />
              <label className="block">
                <span className="mb-2 block text-sm text-slate-600">Jam Mulai</span>
                <input
                  type="time"
                  value={scheduleForm.startTime}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, startTime: event.target.value }))}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm text-slate-600">Jam Selesai</span>
                <input
                  type="time"
                  value={scheduleForm.endTime}
                  onChange={(event) => setScheduleForm((current) => ({ ...current, endTime: event.target.value }))}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeCreateScheduleModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingScheduleAction}
                className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingScheduleAction ? 'Menyimpan...' : 'Simpan Jadwal'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editingSchedule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={saveSchedule} className="w-full max-w-2xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Edit Jadwal Pengajian</h3>
                <p className="mt-2 text-sm text-slate-500">Perbarui kelompok, kelompok usia, dan detail jadwal pengajian yang sudah tersimpan.</p>
              </div>
              <button type="button" onClick={closeEditScheduleModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <label className="block">
                <input
                  list="study-schedule-group-options-edit"
                  value={editScheduleGroupQuery}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    const matchedGroup = groupOptions.find((group) => group.label.toLowerCase() === nextValue.toLowerCase())
                    setEditScheduleGroupQuery(nextValue)
                    setEditScheduleForm((current) => ({
                      ...current,
                      groupId: matchedGroup ? String(matchedGroup.id) : '',
                    }))
                  }}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Ketik lalu pilih kelompok"
                />
                <datalist id="study-schedule-group-options-edit">
                  {groupOptions.map((group) => (
                    <option key={group.id} value={group.label} />
                  ))}
                </datalist>
              </label>
              <label className="block">
                <input
                  list="study-schedule-age-group-options-edit"
                  value={editScheduleAgeGroupQuery}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    const matchedAgeGroup = ageGroupOptions.find((ageGroup) => ageGroup.label.toLowerCase() === nextValue.toLowerCase())
                    setEditScheduleAgeGroupQuery(nextValue)
                    setEditScheduleForm((current) => ({
                      ...current,
                      ageGroupId: matchedAgeGroup ? String(matchedAgeGroup.id) : '',
                    }))
                  }}
                  className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                  placeholder="Ketik lalu pilih kelompok usia"
                />
                <datalist id="study-schedule-age-group-options-edit">
                  {ageGroupOptions.map((ageGroup) => (
                    <option key={ageGroup.id} value={ageGroup.label} />
                  ))}
                </datalist>
              </label>
              <input
                value={editScheduleForm.studyName}
                onChange={(event) => setEditScheduleForm((current) => ({ ...current, studyName: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Nama pengajian"
              />
              <input
                type="date"
                value={editScheduleForm.studyDate}
                onChange={(event) => setEditScheduleForm((current) => ({ ...current, studyDate: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              />
              <input
                type="time"
                value={editScheduleForm.startTime}
                onChange={(event) => setEditScheduleForm((current) => ({ ...current, startTime: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              />
              <input
                type="time"
                value={editScheduleForm.endTime}
                onChange={(event) => setEditScheduleForm((current) => ({ ...current, endTime: event.target.value }))}
                className="rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
              />
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeEditScheduleModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingScheduleAction}
                className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingScheduleAction ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {activeStudyAttendanceSchedule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={saveStudyAttendance} className="w-full max-w-5xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Input Absensi Pengajian</h3>
                <p className="mt-2 text-sm text-slate-500">
                  {activeStudyAttendanceSchedule.studyDate} • {activeStudyAttendanceSchedule.studyName} •{' '}
                  {activeStudyAttendanceVillage?.name || '-'} - {activeStudyAttendanceGroup?.name || '-'} • {activeStudyAttendanceAgeGroup?.name || '-'}
                </p>
              </div>
              <button type="button" onClick={closeStudyAttendanceModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-2">
                <span className="text-sm text-slate-600">Pemateri</span>
                {currentUser?.role === 'admin' ? (
                  <input
                    value={getStudyAttendancePersonName(studyAttendanceForm.teacherId ? Number(studyAttendanceForm.teacherId) : null)}
                    readOnly
                    className="w-full rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-slate-800"
                  />
                ) : (
                  <select
                    value={studyAttendanceForm.teacherId}
                    onChange={(event) => setStudyAttendanceForm((current) => ({ ...current, teacherId: event.target.value }))}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="">Pilih Pemateri</option>
                    {activeTeacherOptions.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-slate-600">Pengawas 1</span>
                {currentUser?.role === 'superadmin' ? (
                  <select
                    value={studyAttendanceForm.supervisor1Id}
                    onChange={(event) => setStudyAttendanceForm((current) => ({ ...current, supervisor1Id: event.target.value }))}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="">Pilih Pengawas 1</option>
                    {activeSupervisor1Options.map((person) => (
                      <option key={person.id} value={person.id}>
                        {getPjpGroupLabel(person)}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={getStudyAttendancePersonName(studyAttendanceForm.supervisor1Id ? Number(studyAttendanceForm.supervisor1Id) : null)}
                    readOnly
                    className="w-full rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-slate-800"
                  />
                )}
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-slate-600">Pengawas 2</span>
                {currentUser?.role === 'admin' ? (
                  <input
                    value={getStudyAttendancePersonName(studyAttendanceForm.supervisor2Id ? Number(studyAttendanceForm.supervisor2Id) : null)}
                    readOnly
                    className="w-full rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-slate-800"
                  />
                ) : (
                  <select
                    value={studyAttendanceForm.supervisor2Id}
                    onChange={(event) => setStudyAttendanceForm((current) => ({ ...current, supervisor2Id: event.target.value }))}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="">Pilih PJP Desa</option>
                    {activeSupervisor2Options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {getPjpVillageLabel(item)}
                      </option>
                    ))}
                  </select>
                )}
              </label>
              <label className="block space-y-2">
                <span className="text-sm text-slate-600">Pengawas 3</span>
                {currentUser?.role === 'admin' ? (
                  <input
                    value={getStudyAttendancePersonName(studyAttendanceForm.supervisor3Id ? Number(studyAttendanceForm.supervisor3Id) : null)}
                    readOnly
                    className="w-full rounded-xl border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-slate-800"
                  />
                ) : (
                  <select
                    value={studyAttendanceForm.supervisor3Id}
                    onChange={(event) => setStudyAttendanceForm((current) => ({ ...current, supervisor3Id: event.target.value }))}
                    className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-sm text-slate-800"
                  >
                    <option value="">Pilih PPG</option>
                    {activeSupervisor3Options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.fullName}
                      </option>
                    ))}
                  </select>
                )}
              </label>
            </div>

            <div className="mt-5 overflow-auto rounded-xl border border-stone-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-stone-50 text-[11px] text-slate-500">
                  <tr>
                    <th className="px-2 py-1.5">Nama Generus</th>
                    <th className="px-2 py-1.5 text-center">Hadir</th>
                    <th className="px-2 py-1.5 text-center">Sakit</th>
                    <th className="px-2 py-1.5 text-center">Izin</th>
                    <th className="px-2 py-1.5 text-center">Alpa</th>
                  </tr>
                </thead>
                <tbody>
                  {activeStudyAttendanceParticipants.length === 0 ? (
                    <tr className="border-t border-stone-200">
                      <td colSpan={5} className="px-2 py-2.5 text-center text-[11px] text-slate-500">
                        Belum ada generus yang sesuai dengan kelompok, desa, dan kelompok usia pada jadwal ini.
                      </td>
                    </tr>
                  ) : null}
                  {activeStudyAttendanceParticipants.map((participant) => {
                    const currentStatus = studyAttendanceForm.statuses[participant.id] || 'alpa'
                    return (
                      <tr key={participant.id} className="border-t border-stone-200">
                        <td className="px-2 py-1.5 text-slate-900">{participant.fullName}</td>
                        {(['hadir', 'sakit', 'izin', 'alpa'] as const).map((status) => (
                          <td key={status} className="px-2 py-1.5 text-center">
                            <input
                              type="radio"
                              name={`attendance-status-${participant.id}`}
                              checked={currentStatus === status}
                              onChange={() =>
                                setStudyAttendanceForm((current) => ({
                                  ...current,
                                  statuses: {
                                    ...current.statuses,
                                    [participant.id]: status,
                                  },
                                }))
                              }
                              className="h-3.5 w-3.5 accent-teal-600"
                            />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {studyAttendanceError ? <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">{studyAttendanceError}</div> : null}

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeStudyAttendanceModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingStudyAttendanceAction}
                className="rounded-xl bg-teal-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingStudyAttendanceAction ? 'Menyimpan...' : 'Simpan/Update'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteSchedule ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Hapus Jadwal Pengajian</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Apakah Anda yakin ingin menghapus jadwal <span className="font-medium text-slate-700">{deleteSchedule.studyName}</span>?
                </p>
              </div>
              <button type="button" onClick={() => setDeleteSchedule(null)} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setDeleteSchedule(null)} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tidak
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteSchedule()}
                disabled={processingScheduleAction}
                className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {processingScheduleAction ? 'Menghapus...' : 'Ya'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {passwordUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={saveUserPassword} className="w-full max-w-lg rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                  <h3 className="font-display text-2xl text-slate-900">Ubah Password {managedUserConfig.singular}</h3>
                <p className="mt-2 text-sm text-slate-500">{passwordUser.fullName}</p>
              </div>
              <button type="button" onClick={closePasswordModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <input
                type="password"
                value={passwordForm.password}
                onChange={(event) => setPasswordForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Password baru"
              />
              <input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(event) => setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Konfirmasi password baru"
              />
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closePasswordModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingUserAction}
                className="rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingUserAction ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {passwordTeacher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <form onSubmit={saveTeacherPassword} className="w-full max-w-lg rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="font-display text-2xl text-slate-900">Ubah Password Dewan Guru</h3>
                <p className="mt-2 text-sm text-slate-500">{passwordTeacher.fullName}</p>
              </div>
              <button type="button" onClick={closeTeacherPasswordModal} className="rounded-xl border border-stone-200 p-2 text-slate-500 transition hover:text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <input
                type="password"
                value={teacherPasswordForm.password}
                onChange={(event) => setTeacherPasswordForm((current) => ({ ...current, password: event.target.value }))}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Password baru"
              />
              <input
                type="password"
                value={teacherPasswordForm.confirmPassword}
                onChange={(event) => setTeacherPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))}
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3.5 py-2.5 text-sm text-slate-800"
                placeholder="Konfirmasi password baru"
              />
            </div>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={closeTeacherPasswordModal} className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700">
                Tutup
              </button>
              <button
                type="submit"
                disabled={processingTeacherAction}
                className="rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-60"
              >
                {processingTeacherAction ? 'Menyimpan...' : 'Simpan Password'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteUser ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-md rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
              <h3 className="font-display text-2xl text-slate-900">Hapus {managedUserConfig.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
                Apakah data <span className="font-semibold text-slate-900">{deleteUser.fullName}</span> akan dihapus?
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteUser(null)}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                Tidak
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteUser()}
                disabled={processingUserAction}
                className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {processingUserAction ? 'Menghapus...' : 'Ya'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTeacher ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="w-full max-w-md rounded-[28px] border border-stone-200 bg-white p-5 shadow-soft">
            <h3 className="font-display text-2xl text-slate-900">Hapus Data Dewan Guru</h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Apakah data <span className="font-semibold text-slate-900">{deleteTeacher.fullName}</span> akan dihapus?
            </p>

            <div className="mt-5 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteTeacher(null)}
                className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm text-slate-700"
              >
                Tidak
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteTeacher()}
                disabled={processingTeacherAction}
                className="rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {processingTeacherAction ? 'Menghapus...' : 'Ya'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
