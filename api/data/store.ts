import { createSeedData } from './seed.js'
import { getJakartaTimestamp } from '../utils/time.js'
import type {
  Account,
  AgeGroup,
  AppData,
  AttendanceRecord,
  Group,
  OwnerBiography,
  OwnerWorkHistory,
  RegistrationReview,
  StudyAttendanceEntry,
  StudyAttendanceSession,
  StudySchedule,
  UserProfile,
  Village,
} from '../types.js'

class MemoryStore {
  private data: AppData

  constructor() {
    this.data = createSeedData()
  }

  reset() {
    this.data = createSeedData()
  }

  getData() {
    return this.data
  }

  nextId(collection: Array<{ id: number }>) {
    return collection.length ? Math.max(...collection.map((item) => item.id)) + 1 : 1
  }

  findAccountById(id: number) {
    return this.data.accounts.find((account) => account.id === id)
  }

  findAccountByEmail(email: string) {
    return this.data.accounts.find((account) => account.email.toLowerCase() === email.toLowerCase())
  }

  upsertProfile(profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>) {
    const existing = this.data.profiles.find((item) => item.userId === profile.userId)
    const timestamp = getJakartaTimestamp()

    if (existing) {
      Object.assign(existing, profile, { updatedAt: timestamp })
      return existing
    }

    const created: UserProfile = {
      id: this.nextId(this.data.profiles),
      createdAt: timestamp,
      updatedAt: timestamp,
      ...profile,
    }
    this.data.profiles.push(created)
    return created
  }

  saveAccount(account: Account) {
    const index = this.data.accounts.findIndex((item) => item.id === account.id)
    if (index >= 0) {
      this.data.accounts[index] = account
      return account
    }
    this.data.accounts.push(account)
    return account
  }

  saveAttendance(attendance: AttendanceRecord) {
    const index = this.data.attendances.findIndex((item) => item.id === attendance.id)
    if (index >= 0) {
      this.data.attendances[index] = attendance
      return attendance
    }
    this.data.attendances.push(attendance)
    return attendance
  }

  saveStudyAttendanceSession(session: StudyAttendanceSession) {
    const index = this.data.studyAttendanceSessions.findIndex((item) => item.id === session.id)
    if (index >= 0) {
      this.data.studyAttendanceSessions[index] = session
      return session
    }
    this.data.studyAttendanceSessions.push(session)
    return session
  }

  saveStudyAttendanceEntry(entry: StudyAttendanceEntry) {
    const index = this.data.studyAttendanceEntries.findIndex((item) => item.id === entry.id)
    if (index >= 0) {
      this.data.studyAttendanceEntries[index] = entry
      return entry
    }
    this.data.studyAttendanceEntries.push(entry)
    return entry
  }

  saveRegistrationReview(review: RegistrationReview) {
    this.data.registrationReviews.push(review)
    return review
  }

  saveVillage(village: Village) {
    const index = this.data.villages.findIndex((item) => item.id === village.id)
    if (index >= 0) {
      this.data.villages[index] = village
      return village
    }
    this.data.villages.push(village)
    return village
  }

  saveGroup(group: Group) {
    const index = this.data.groups.findIndex((item) => item.id === group.id)
    if (index >= 0) {
      this.data.groups[index] = group
      return group
    }
    this.data.groups.push(group)
    return group
  }

  saveAgeGroup(ageGroup: AgeGroup) {
    const index = this.data.ageGroups.findIndex((item) => item.id === ageGroup.id)
    if (index >= 0) {
      this.data.ageGroups[index] = ageGroup
      return ageGroup
    }
    this.data.ageGroups.push(ageGroup)
    return ageGroup
  }

  saveSchedule(schedule: StudySchedule) {
    const index = this.data.schedules.findIndex((item) => item.id === schedule.id)
    if (index >= 0) {
      this.data.schedules[index] = schedule
      return schedule
    }
    this.data.schedules.push(schedule)
    return schedule
  }

  saveOwnerBiography(biography: OwnerBiography) {
    this.data.ownerBiography = biography
    return biography
  }

  saveOwnerWorkHistory(history: OwnerWorkHistory) {
    const index = this.data.ownerWorkHistories.findIndex((item) => item.id === history.id)
    if (index >= 0) {
      this.data.ownerWorkHistories[index] = history
      return history
    }
    this.data.ownerWorkHistories.push(history)
    return history
  }

  deleteOwnerWorkHistory(id: number) {
    this.data.ownerWorkHistories = this.data.ownerWorkHistories.filter((item) => item.id !== id)
  }
}

export const memoryStore = new MemoryStore()
