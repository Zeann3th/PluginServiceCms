import type { ApiResponse } from '../types'

export const useApi = () => {
  const { token } = useAuth()
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase

  const $api = $fetch.create({
    baseURL: apiBase,
    onRequest({ options }) {
      if (token.value) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token.value}`
        }
      }
    },
    onResponseError({ response }) {
      if (response.status === 401) {
        // Handle unauthorized (e.g., logout or refresh token)
        const { logout } = useAuth()
        logout()
      }
    }
  })

  return $api
}
