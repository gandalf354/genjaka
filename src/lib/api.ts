import axios from 'axios'

export const api = axios.create({
  baseURL: '/api',
})

export const setApiToken = (token?: string) => {
  if (token) {
    api.defaults.headers.common.Authorization = `Bearer ${token}`
    return
  }

  delete api.defaults.headers.common.Authorization
}
