<script setup lang="ts">
import { Mail, Lock, Loader2, AlertCircle, RefreshCw, Github, Twitter, Globe, ArrowLeft, Database } from 'lucide-vue-next'

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
  <div class="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans selection:bg-primary/30 selection:text-primary-foreground">
    <!-- Background blobs -->
    <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] animate-pulse-slow"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 rounded-full blur-[120px] animate-pulse-slow" style="animation-delay: 2s"></div>
    
    <div class="w-full max-w-[480px] z-10 space-y-8">
      <div class="flex justify-center">
        <NuxtLink to="/" class="inline-flex items-center gap-2 px-4 py-2 bg-surface/50 backdrop-blur-md border border-border rounded-full text-[10px] font-black uppercase tracking-widest text-secondary hover:text-primary hover:border-primary/30 transition-all group shadow-sm">
          <ArrowLeft class="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
          Return to Marketplace
        </NuxtLink>
      </div>

      <div class="bg-surface/40 backdrop-blur-xl border border-border rounded-[3rem] p-10 md:p-14 shadow-island relative overflow-hidden group">
        <div class="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-all duration-700">
          <Database class="w-32 h-32 text-primary" />
        </div>

        <div class="relative">
          <div class="text-center mb-10">
            <div class="inline-flex p-4 rounded-2xl bg-primary/10 border border-primary/20 mb-6 shadow-glow">
              <RefreshCw class="w-8 h-8 text-primary" />
            </div>
            <h1 class="text-4xl font-black tracking-tight uppercase">STRESS<span class="text-primary">PILOT</span></h1>
            <p class="text-secondary font-medium text-sm mt-2 opacity-70">Establish operator session</p>
          </div>

          <form @submit.prevent="handleLogin" class="space-y-6">
            <div class="space-y-2">
              <Label for="email" class="text-[10px] font-black uppercase tracking-widest text-secondary ml-2">Identity (Email)</Label>
              <div class="relative group">
                <Mail class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <input 
                  id="email" 
                  v-model="email" 
                  type="email" 
                  placeholder="operator@stresspilot.io"
                  required
                  class="w-full bg-elevated border border-border rounded-2xl h-14 pl-12 pr-4 outline-none focus:border-primary/50 transition-all text-sm font-medium shadow-inner"
                />
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex justify-between items-center px-2">
                <Label for="password" class="text-[10px] font-black uppercase tracking-widest text-secondary">Access Key</Label>
                <a href="#" class="text-[10px] text-primary hover:underline uppercase font-black tracking-widest">Recover</a>
              </div>
              <div class="relative group">
                <Lock class="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <input 
                  id="password" 
                  v-model="password" 
                  type="password" 
                  placeholder="••••••••"
                  required
                  class="w-full bg-elevated border border-border rounded-2xl h-14 pl-12 pr-4 outline-none focus:border-primary/50 transition-all text-sm shadow-inner"
                />
              </div>
            </div>

            <div v-if="errorMsg" class="bg-destructive/5 border border-destructive/10 text-destructive text-[11px] py-4 px-5 rounded-xl flex items-center gap-3 font-bold uppercase tracking-widest animate-in fade-in slide-in-from-top-1">
              <AlertCircle class="w-5 h-5 shrink-0" />
              {{ errorMsg }}
            </div>

            <button 
              type="submit" 
              :disabled="loading" 
              class="w-full h-16 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-xs uppercase tracking-[0.3em] shadow-glow transition-all active:scale-[0.98] disabled:opacity-50 mt-4"
            >
              <template v-if="loading">
                <Loader2 class="w-5 h-5 animate-spin mr-2" />
                Authenticating...
              </template>
              <template v-else>
                Establish Session
              </template>
            </button>
          </form>

          <div class="mt-10 pt-8 border-t border-border/50 text-center">
            <p class="text-[11px] text-secondary font-bold uppercase tracking-widest leading-loose">
              New operator? 
              <NuxtLink to="/signup" class="text-primary hover:underline transition-all block sm:inline mt-1 sm:mt-0">Enroll in Distribution Network</NuxtLink>
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.shadow-island {
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.3);
}

.dark .shadow-island {
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.7);
}

.shadow-glow {
  box-shadow: 0 0 20px -5px hsla(var(--primary) / 0.4);
}
</style>
