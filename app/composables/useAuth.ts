import type { ApiResponse } from '../types'

export interface User {
  id: number
  username: string
  email: string
  role: string
  created_at: string
  updated_at: string
}

export interface AuthResponse {
  access_token: string
  user: User
}

export const useAuth = () => {
  const user = useState<User | null>('auth_user', () => null)
  const token = useCookie<string | null>('auth_token', {
    maxAge: 60 * 60 * 24 * 7, // 1 week
    sameSite: 'lax'
  })

  const isAuthenticated = computed(() => !!token.value)
  const config = useRuntimeConfig()
  
  // Base users API URL
  const apiBase = `${config.public.apiBase}/api/v1/users`

  const login = async (identifier: string, password: string) => {
    try {
      const response = await $fetch<ApiResponse<AuthResponse>>(`${apiBase}/signin`, {
        method: 'POST',
        body: { identifier, password }
      })

      if (response && response.data) {
        token.value = response.data.access_token
        user.value = response.data.user
        return true
      }
      return false
    } catch (err: any) {
      console.error('Login failed:', err)
      throw err
    }
  }

  const signup = async (username: string, email: string, password: string) => {
    try {
      await $fetch<ApiResponse<any>>(`${apiBase}/signup`, {
        method: 'POST',
        body: { username, email, password }
      })
      return true
    } catch (err: any) {
      console.error('Signup failed:', err)
      throw err
    }
  }

  const fetchProfile = async () => {
    if (!token.value) return null
    const $api = useApi()
    try {
      const response = await $api<ApiResponse<User>>('/api/v1/users/profile')
      if (response && response.data) {
        user.value = response.data
        return user.value
      }
    } catch (err: any) {
      console.error('Fetch profile failed:', err)
      logout()
    }
    return null
  }

  const logout = () => {
    token.value = null
    user.value = null
    navigateTo('/login')
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    signup,
    logout,
    fetchProfile
  }
}
