// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',
  devtools: { enabled: true },
  modules: [
    '@nuxtjs/tailwindcss',
    'shadcn-nuxt',
    '@nuxtjs/color-mode',
    '@nuxtjs/google-fonts'
  ],
  runtimeConfig: {
    public: {
      apiBase: '/api/v1/plugins'
    }
  },
  colorMode: {
    classSuffix: ''
  },
  googleFonts: {
    families: {
      'IBM Plex Sans': [400, 500, 600, 700],
      'JetBrains Mono': [400, 500]
    }
  },
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui'
  }
})
