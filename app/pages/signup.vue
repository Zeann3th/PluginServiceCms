<script setup lang="ts">
import { User, Mail, Lock, Loader2, AlertCircle, RefreshCw, ArrowLeft } from 'lucide-vue-next'

const { signup } = useAuth()
const username = ref('')
const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')
const successMsg = ref('')

const handleSignup = async () => {
  if (!username.value || !email.value || !password.value) return
  loading.value = true
  errorMsg.value = ''
  successMsg.value = ''
  try {
    const success = await signup(username.value, email.value, password.value)
    if (success) {
      successMsg.value = 'Account created! Redirecting to login...'
      setTimeout(() => navigateTo('/login'), 2000)
    }
  } catch (err: any) {
    errorMsg.value = 'Signup failed. Email might be taken.'
  } finally {
    loading.value = false
  }
}

definePageMeta({
  layout: false
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-300">
    <div class="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/20 dark:bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow"></div>
    <div class="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/10 dark:bg-emerald-500/5 rounded-full blur-[120px] animate-pulse-slow" style="animation-delay: 2s"></div>
    
    <div class="w-full max-w-md z-10">
      <NuxtLink to="/login" class="inline-flex items-center text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-emerald-500 transition-colors mb-8 group">
        <ArrowLeft class="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
        Back to Sign In
      </NuxtLink>

      <div class="text-center mb-6">
        <h1 class="text-3xl font-bold tracking-tight mb-1.5 text-foreground">Create Account</h1>
        <p class="text-sm text-muted-foreground">Join the StressPilot developer community</p>
      </div>

      <Card class="bg-card/40 backdrop-blur-xl border-border shadow-2xl rounded-2xl overflow-hidden">
        <CardContent class="pt-6 px-6">
          <form @submit.prevent="handleSignup" class="space-y-4">
             <div class="space-y-1.5">
              <Label for="username" class="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 ml-1">Username</Label>
              <div class="relative group">
                <User class="absolute left-3 top-3 w-4.5 h-4.5 text-muted-foreground/40 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  id="username" 
                  v-model="username" 
                  type="text" 
                  placeholder="pilot_dev"
                  required
                  class="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-sm"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <Label for="email" class="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 ml-1">Email Address</Label>
              <div class="relative group">
                <Mail class="absolute left-3 top-3 w-4.5 h-4.5 text-muted-foreground/40 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  id="email" 
                  v-model="email" 
                  type="email" 
                  placeholder="dev@stresspilot.com"
                  required
                  class="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-sm"
                />
              </div>
            </div>

            <div class="space-y-1.5">
              <Label for="password" class="text-[10px] font-bold uppercase tracking-widest text-emerald-500/70 ml-1">Password</Label>
              <div class="relative group">
                <Lock class="absolute left-3 top-3 w-4.5 h-4.5 text-muted-foreground/40 group-focus-within:text-emerald-500 transition-colors" />
                <input 
                  id="password" 
                  v-model="password" 
                  type="password" 
                  placeholder="••••••••"
                  required
                  class="w-full bg-background border border-border rounded-xl pl-10 pr-4 py-2.5 outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all text-sm"
                />
              </div>
            </div>

            <div v-if="errorMsg" class="bg-destructive/10 border border-destructive/20 text-destructive text-[10px] py-2.5 px-4 rounded-lg flex items-center gap-2">
              <AlertCircle class="w-3.5 h-3.5" />
              {{ errorMsg }}
            </div>

            <div v-if="successMsg" class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] py-2.5 px-4 rounded-lg flex items-center gap-2">
              <RefreshCw class="w-3.5 h-3.5 animate-spin" />
              {{ successMsg }}
            </div>

            <Button 
              type="submit" 
              :disabled="loading" 
              class="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98]"
            >
              <template v-if="loading">
                <Loader2 class="w-4 h-4 animate-spin mr-2" />
                Processing...
              </template>
              <template v-else>
                Create Account
              </template>
            </Button>
          </form>
        </CardContent>
        <CardFooter class="pb-6 pt-3 px-6">
          <p class="text-center w-full text-xs text-muted-foreground font-medium">
            Already have an account? 
            <NuxtLink to="/login" class="text-emerald-500 font-bold hover:underline">Sign In</NuxtLink>
          </p>
        </CardFooter>
      </Card>
    </div>
  </div>
</template>
