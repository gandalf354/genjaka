// @vitest-environment node

import request from 'supertest'
import { beforeEach, describe, expect, it } from 'vitest'
import app from './app.js'
import { memoryStore } from './data/store.js'

describe('API Genjaka', () => {
  beforeEach(() => {
    memoryStore.reset()
  })

  it('mengembalikan konten landing page publik', async () => {
    const response = await request(app).get('/api/public/landing-page')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.content.heroTitle).toContain('Portal Genjaka')
  })

  it('mengizinkan user approved login dan mengakses dashboard', async () => {
    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@genjaka.local',
      password: 'admin12345',
    })

    expect(adminLogin.status).toBe(200)

    const email = `aktif-${Date.now()}@genjaka.local`
    const createUser = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)
      .send({
        fullName: 'Generus Aktif',
        email,
        password: 'useraktif123',
      })

    expect(createUser.status).toBe(201)

    const login = await request(app).post('/api/auth/login').send({
      email,
      password: 'useraktif123',
    })

    expect(login.status).toBe(200)
    expect(login.body.token).toBeTruthy()

    const dashboard = await request(app)
      .get('/api/user/dashboard')
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(dashboard.status).toBe(200)
    expect(dashboard.body.user.email).toBe(email)
  })

  it('membuat registrasi baru dan menandai status pending', async () => {
    const email = `baru-${Date.now()}@genjaka.local`
    const register = await request(app).post('/api/auth/register').send({
      fullName: 'User Baru',
      email,
      password: 'passwordbaru',
    })

    expect(register.status).toBe(201)
    expect(register.body.user.approvalStatus).toBe('pending')

    const login = await request(app).post('/api/auth/login').send({
      email,
      password: 'passwordbaru',
    })

    expect(login.status).toBe(403)
  })

  it('mengizinkan admin memperbarui password dan menghapus data generus', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@genjaka.local',
      password: 'admin12345',
    })

    expect(login.status).toBe(200)

    const email = `edit-${Date.now()}@genjaka.local`
    const createUser = await request(app)
      .post('/api/admin/users')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        fullName: 'Generus Edit',
        email,
        password: 'passwordawal123',
      })

    expect(createUser.status).toBe(201)

    const userId = createUser.body.user.id as number

    const updatePassword = await request(app)
      .put(`/api/admin/users/${userId}/password`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ password: 'passwordbaru123' })

    expect(updatePassword.status).toBe(200)

    const userLogin = await request(app).post('/api/auth/login').send({
      email,
      password: 'passwordbaru123',
    })

    expect(userLogin.status).toBe(200)

    const removeUser = await request(app)
      .delete(`/api/admin/users/${userId}`)
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(removeUser.status).toBe(200)

    const users = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(users.status).toBe(200)
    expect(users.body.users.some((item: { id: number }) => item.id === userId)).toBe(false)
  })

  it('mengizinkan admin mengelola desa dan kelompok', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@genjaka.local',
      password: 'admin12345',
    })

    expect(login.status).toBe(200)

    const createVillage = await request(app)
      .post('/api/admin/villages')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ name: 'Desa Mekarsari' })

    expect(createVillage.status).toBe(201)

    const villageId = createVillage.body.village.id as number

    const createGroup = await request(app)
      .post('/api/admin/groups')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ villageId, name: 'Kelompok Al-Ikhlas' })

    expect(createGroup.status).toBe(201)

    const groupId = createGroup.body.group.id as number

    const updateGroup = await request(app)
      .put(`/api/admin/groups/${groupId}`)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({ villageId, name: 'Kelompok Al-Ikhlas Baru' })

    expect(updateGroup.status).toBe(200)

    const locations = await request(app)
      .get('/api/admin/locations')
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(locations.status).toBe(200)
    expect(locations.body.villages.some((item: { id: number }) => item.id === villageId)).toBe(true)
    expect(locations.body.groups.some((item: { id: number; name: string }) => item.id === groupId && item.name === 'Kelompok Al-Ikhlas Baru')).toBe(true)

    const removeVillage = await request(app)
      .delete(`/api/admin/villages/${villageId}`)
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(removeVillage.status).toBe(200)

    const locationsAfterDelete = await request(app)
      .get('/api/admin/locations')
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(locationsAfterDelete.body.villages.some((item: { id: number }) => item.id === villageId)).toBe(false)
    expect(locationsAfterDelete.body.groups.some((item: { id: number }) => item.id === groupId)).toBe(false)
  })

  it('mengizinkan admin melihat biografi owner secara read-only', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@genjaka.local',
      password: 'admin12345',
    })

    expect(login.status).toBe(200)

    const response = await request(app)
      .get('/api/admin/owner-biography')
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
    expect(response.body.biography.id).toBe(1)
  })

  it('mengizinkan superadmin mengelola biografi owner dan history pekerjaan', async () => {
    const login = await request(app).post('/api/auth/login').send({
      email: 'superadmin@genjaka.local',
      password: 'superadmin123',
    })

    expect(login.status).toBe(200)

    const getInitial = await request(app)
      .get('/api/superadmin/owner-biography')
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(getInitial.status).toBe(200)
    expect(getInitial.body.success).toBe(true)
    expect(getInitial.body.biography.id).toBe(1)

    const updateBiography = await request(app)
      .put('/api/superadmin/owner-biography')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        fullName: 'Owner Genjaka',
        birthPlace: 'Jakarta',
        birthDate: '1990-01-01',
        address: 'Alamat contoh',
        phoneNumber: '081234567890',
        visibleToAdmin: false,
      })

    expect(updateBiography.status).toBe(200)
    expect(updateBiography.body.biography.fullName).toBe('Owner Genjaka')

    const adminLogin = await request(app).post('/api/auth/login').send({
      email: 'admin@genjaka.local',
      password: 'admin12345',
    })

    expect(adminLogin.status).toBe(200)

    const adminGetHidden = await request(app)
      .get('/api/admin/owner-biography')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)

    expect(adminGetHidden.status).toBe(404)

    const enableVisibility = await request(app)
      .put('/api/superadmin/owner-biography')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        fullName: 'Owner Genjaka',
        birthPlace: 'Jakarta',
        birthDate: '1990-01-01',
        address: 'Alamat contoh',
        phoneNumber: '081234567890',
        visibleToAdmin: true,
      })

    expect(enableVisibility.status).toBe(200)

    const adminGetVisible = await request(app)
      .get('/api/admin/owner-biography')
      .set('Authorization', `Bearer ${adminLogin.body.token}`)

    expect(adminGetVisible.status).toBe(200)

    const uploadPhoto = await request(app)
      .post('/api/superadmin/owner-biography/photo')
      .set('Authorization', `Bearer ${login.body.token}`)
      .attach('photo', Buffer.from('fake-image'), { filename: 'owner.jpg', contentType: 'image/jpeg' })

    expect(uploadPhoto.status).toBe(200)
    expect(uploadPhoto.body.biography.photoUrl).toContain('/uploads/owner/')

    const createHistory = await request(app)
      .post('/api/superadmin/owner-work-histories')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        periodYear: '2019 - 2021',
        positionTitle: 'Koordinator',
        jobTitle: 'Organisasi',
      })

    expect(createHistory.status).toBe(201)

    const createHistory2 = await request(app)
      .post('/api/superadmin/owner-work-histories')
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        periodYear: '2022 - 2023',
        positionTitle: 'Ketua',
        jobTitle: 'Organisasi',
      })

    expect(createHistory2.status).toBe(201)

    const getAfter = await request(app)
      .get('/api/superadmin/owner-biography')
      .set('Authorization', `Bearer ${login.body.token}`)

    expect(getAfter.status).toBe(200)
    expect(getAfter.body.histories.length).toBe(2)
    expect(getAfter.body.histories[0].periodYear).toBe('2022 - 2023')
  })
})
