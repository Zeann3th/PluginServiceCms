<script setup lang="ts">
import { Mail, Lock, Loader2, AlertCircle, RefreshCw, Github, Twitter, Globe, ArrowLeft } from 'lucide-vue-next'

const { login } = useAuth()
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

const handleLogin = async () => {
  if (!email.value || !password.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    const success = await login(email.value, password.value)
    if (success) {
      navigateTo('/')
    }
  } catch (err: any) {
    errorMsg.value = 'Invalid credentials or server error'
  } finally {
    loading.value = false
  }
}

definePageMeta({
  layout: false
})
</script>

<template>
  <div class="min-h-screen bg-[#020817] text-white flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans">
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 rounded-full blur-[120px] animate-pulse-slow"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" style="animation-delay: 2s"></div>
    
    <div class="w-full max-w-md z-10">
      <NuxtLink to="/" class="inline-flex items-center text-xs font-bold uppercase tracking-widest text-white/40 hover:text-emerald-500 transition-colors mb-8 group">
        <ArrowLeft class="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Marketplace
      </NuxtLink>

      <div class="text-center mb-8">
        <div class="inline-flex p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-transparent border border-emerald-500/20 mb-4">
          <RefreshCw class="w-8 h-8 text-emerald-500" />
        </div>
        <h1 class="text-4xl font-bold tracking-tight mb-2">Welcome Back</h1>
        <p class="text-muted-foreground">Sign in to manage your StressPilot plugins</p>
      </div>

      <Card class="bg-card/40 backdrop-blur-xl border-white/10 shadow-2xl rounded-3xl overflow-hidden">
        <CardContent class="pt-8 px-8">
          <form @submit.prevent="handleLogin" class="space-y-6">
            <div class="space-y-2">
              <Label for="email" class="text-xs font-bold uppercase tracking-widest text-emerald-500/70 ml-1">Email Address</Label>
              <div class="relative group">
                <Mail class="absolute left-3.5 top-3.5 w-5 h-5 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  id="email" 
                  v-model="email" 
                  type="email" 
                  placeholder="name@example.com"
                  required
                  class="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-sm"
                />
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex justify-between items-center ml-1">
                <Label for="password" class="text-xs font-bold uppercase tracking-widest text-emerald-500/70">Password</Label>
                <a href="#" class="text-[10px] text-emerald-500 hover:underline uppercase font-bold tracking-wider">Forgot?</a>
              </div>
              <div class="relative group">
                <Lock class="absolute left-3.5 top-3.5 w-5 h-5 text-white/20 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  id="password" 
                  v-model="password" 
                  type="password" 
                  placeholder="••••••••"
                  required
                  class="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-3.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-sm"
                />
              </div>
            </div>

            <div v-if="errorMsg" class="bg-destructive/10 border border-destructive/20 text-destructive text-xs py-3 px-4 rounded-xl flex items-center gap-2">
              <AlertCircle class="w-4 h-4" />
              {{ errorMsg }}
            </div>

            <Button 
              type="submit" 
              :disabled="loading" 
              class="w-full h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-base shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
            >
              <template v-if="loading">
                <Loader2 class="w-5 h-5 animate-spin mr-2" />
                Authenticating...
              </template>
              <template v-else>
                Sign In
              </template>
            </Button>
          </form>
        </CardContent>
        <CardFooter class="pb-8 pt-4 px-8 flex flex-col gap-4">
          <p class="text-center text-sm text-muted-foreground font-medium">
            Don't have an account? 
            <NuxtLink to="/signup" class="text-emerald-500 font-bold hover:underline">Create one</NuxtLink>
          </p>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
