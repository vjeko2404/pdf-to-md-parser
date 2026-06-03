import { api } from './client'

export interface UserInfo {
  id: number
  username: string
  role: 'Admin' | 'User'
  isActive: boolean
}

export interface AuthResponse {
  token: string
  user: UserInfo
}

export const authApi = {
  register: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { username, password }),
  login: (username: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { username, password }),
  me: () => api.get<UserInfo>('/auth/me'),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post<AuthResponse>('/auth/change-password', { currentPassword, newPassword }),

  /** Public — whether the "Register" link should show on the login screen. */
  registrationStatus: () => api.get<{ enabled: boolean }>('/auth/registration'),

  // ── Admin ──
  setRegistration: (enabled: boolean) =>
    api.patch<{ enabled: boolean }>('/auth/registration', { enabled }),
  listUsers: () => api.get<UserInfo[]>('/auth/users'),
  setActive: (id: number, active: boolean) =>
    api.patch<void>(`/auth/users/${id}/active`, { active }),
}
