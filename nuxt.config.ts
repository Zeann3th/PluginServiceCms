// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  ssr: false,
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
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'https://plugins.stresspilot.zeann3th.com',
      s3PublicEndpoint: process.env.NUXT_PUBLIC_S3_PUBLIC_ENDPOINT || 'https://cdn.stresspilot.zeann3th.com'
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
