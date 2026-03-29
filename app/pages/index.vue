<script setup lang="ts">
import { 
  Plus, Search, Pencil, Trash2, Loader2, UploadCloud, 
  ArrowUp, ArrowDown, Download, RefreshCw, LogOut, User as UserIcon,
  LayoutGrid, Settings, Database, Activity, Filter, MoreVertical,
  ChevronRight, Calendar, Star, Info, Key, ShoppingBag, Zap, Shield, Sparkles
} from 'lucide-vue-next'
import type { 
  Plugin, PluginResponse, CreatePluginRequest, UpdatePluginRequest,
  ApiResponse, PaginatedResponse, CreatePluginResponse 
} from '@/types'

const { user, token, logout, fetchProfile, isAuthenticated } = useAuth()
const config = useRuntimeConfig()
const apiBase = `${config.public.apiBase}/api/v1/plugins`

// State
const plugins = ref<Plugin[]>([])
const loading = ref(false)
const searchQuery = ref('')
const searchCode = ref('')
const page = ref(1)
const totalItems = ref(0)

// UI State
const isDialogOpen = ref(false)
const isEditMode = ref(false)
const currentPluginId = ref<number | null>(null)
const formData = ref<Partial<CreatePluginRequest>>({
  code: '',
  name: '',
  version: '1.0.0',
  description: '',
  filename: ''
})
const selectedFile = ref<File | null>(null)
const uploading = ref(false)

// Formatting
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

// API Calls
const fetchPlugins = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = {
      page: page.value,
      per_page: 20
    }
    if (searchQuery.value) params.name = searchQuery.value
    if (searchCode.value) params.code = searchCode.value
    
    // Public GET request
    const response = await $fetch<ApiResponse<PaginatedResponse<PluginResponse>>>(apiBase, { params })
    
    if (response && response.data) {
      plugins.value = response.data.items.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        version: p.version,
        publisher: p.publisher,
        downloadCount: p.download_count,
        upvoteCount: p.upvote_count,
        downvoteCount: p.downvote_count,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }))
      totalItems.value = response.data.total
    }
  } catch (error) {
    console.error('Failed to fetch plugins:', error)
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  if (!isAuthenticated.value) {
    navigateTo('/login')
    return
  }
  isEditMode.value = false
  currentPluginId.value = null
  formData.value = { code: '', name: '', version: '1.0.0', description: '', filename: '' }
  selectedFile.value = null
  isDialogOpen.value = true
}

const openEditDialog = (plugin: Plugin) => {
  isEditMode.value = true
  currentPluginId.value = plugin.id
  formData.value = { name: plugin.name, description: plugin.description || '' }
  isDialogOpen.value = true
}

const handleFileChange = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0]
    formData.value.filename = selectedFile.value.name
  }
}

const handleSubmit = async () => {
  if (isEditMode.value) await updatePlugin()
  else await registerPlugin()
}

const registerPlugin = async () => {
  if (!selectedFile.value || !formData.value.code || !formData.value.name) return
  uploading.value = true
  try {
    const regResult = await $fetch<ApiResponse<CreatePluginResponse>>(apiBase, {
      method: 'POST',
      body: formData.value,
      headers: { Authorization: `Bearer ${token.value}` }
    })

    if (!regResult.data) throw new Error('Registration failed')
    const { upload_url } = regResult.data
    
    await fetch(upload_url, {
      method: 'PUT',
      body: selectedFile.value,
      headers: { 'Content-Type': selectedFile.value.type || 'application/octet-stream' }
    })

    isDialogOpen.value = false
    await fetchPlugins()
  } catch (error) {
    console.error('Registration failed:', error)
  } finally {
    uploading.value = false
  }
}

const updatePlugin = async () => {
  if (!currentPluginId.value) return
  uploading.value = true
  try {
    await $fetch(`${apiBase}/${currentPluginId.value}`, {
      method: 'PATCH',
      body: { name: formData.value.name, description: formData.value.description },
      headers: { Authorization: `Bearer ${token.value}` }
    })
    isDialogOpen.value = false
    await fetchPlugins()
  } catch (error) {
    console.error('Update failed:', error)
  } finally {
    uploading.value = false
  }
}

const deletePlugin = async (id: number) => {
  if (!confirm('Are you sure you want to delete this plugin?')) return
  try {
    await $fetch(`${apiBase}/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token.value}` }
    })
    await fetchPlugins()
  } catch (error) {
    console.error('Delete failed:', error)
  }
}

const votePlugin = async (id: number, isUpvote: boolean) => {
  if (!isAuthenticated.value) {
    navigateTo('/login')
    return
  }
  try {
    await $fetch(`${apiBase}/${id}/vote`, {
      method: 'POST',
      body: { is_upvote: isUpvote },
      headers: { Authorization: `Bearer ${token.value}` }
    })
    await fetchPlugins()
  } catch (error) {
    console.error('Vote failed:', error)
  }
}

const downloadPlugin = async (plugin: Plugin) => {
  try {
    const extension = plugin.code.includes('js') ? 'js' : 'jar'
    const filename = `${plugin.code}-${plugin.version}.${extension}`
    const response = await $fetch<ApiResponse<string>>(`${apiBase}/${plugin.id}/download/${filename}`)
    if (response && response.data) {
      window.open(response.data, '_blank')
      // Small delay to let the backend count increment then refresh local view
      setTimeout(fetchPlugins, 1000)
    }
  } catch (error) {
    console.error('Download failed:', error)
  }
}

onMounted(async () => {
  if (token.value) {
    await fetchProfile()
  }
  fetchPlugins()
})
</script>

<template>
  <div class="min-h-screen bg-[#020817] text-slate-200 font-sans flex flex-col overflow-x-hidden">
    <!-- Background animations -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse-slow" style="animation-delay: 2s"></div>
    </div>

    <!-- Navigation Header -->
    <header class="h-20 border-b border-white/5 bg-[#020817]/80 backdrop-blur-md sticky top-0 z-50">
      <div class="container mx-auto h-full flex items-center justify-between px-6">
        <div class="flex items-center gap-8">
          <NuxtLink to="/" class="flex items-center gap-3 group">
            <div class="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
              <ShoppingBag class="w-6 h-6 text-black" />
            </div>
            <div class="flex flex-col">
              <span class="font-bold text-xl tracking-tight text-white leading-none">StressPilot</span>
              <span class="text-[10px] font-bold text-emerald-500/70 uppercase tracking-[0.2em]">Marketplace</span>
            </div>
          </NuxtLink>

          <nav class="hidden md:flex items-center gap-1">
            <button class="px-4 py-2 rounded-lg text-sm font-bold text-white bg-white/5">Discover</button>
            <button class="px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition-colors">Categories</button>
            <button class="px-4 py-2 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition-colors">Documentation</button>
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <div v-if="isAuthenticated && user" class="flex items-center gap-4">
            <Button @click="openAddDialog" variant="ghost" class="hidden sm:flex text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 font-bold rounded-xl">
              <Plus class="w-4 h-4 mr-2" /> Release Plugin
            </Button>
            <div class="h-8 w-[1px] bg-white/10 hidden sm:block"></div>
            <div class="flex items-center gap-3 pl-2">
              <div class="flex flex-col items-end hidden sm:flex">
                <span class="text-xs font-bold text-white">{{ user.username }}</span>
                <span class="text-[10px] text-slate-500 font-medium">{{ user.role }}</span>
              </div>
              <button @click="logout" class="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-rose-500/10 hover:border-rose-500/20 transition-all group">
                <LogOut class="w-4 h-4 text-slate-400 group-hover:text-rose-400" />
              </button>
            </div>
          </div>
          <div v-else class="flex items-center gap-2">
            <NuxtLink to="/login">
              <Button variant="ghost" class="text-sm font-bold text-slate-400 hover:text-white rounded-xl">Sign In</Button>
            </NuxtLink>
            <NuxtLink to="/signup">
              <Button class="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl px-5 shadow-lg shadow-emerald-500/20 transition-all active:scale-95">Get Started</Button>
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>

    <!-- Hero / Search Section -->
    <section class="relative pt-16 pb-12 px-6 overflow-hidden">
      <div class="container mx-auto text-center relative z-10">
        <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-bold uppercase tracking-widest mb-6">
          <Sparkles class="w-3 h-3" /> Discover the best extensions
        </div>
        <h1 class="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight">
          Supercharge your <span class="text-emerald-500">StressPilot</span>
        </h1>
        <p class="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          The official marketplace for StressPilot plugins. Search, download, and integrate community-built extensions in seconds.
        </p>

        <div class="max-w-2xl mx-auto relative group">
          <div class="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-2xl blur opacity-25 group-focus-within:opacity-100 transition duration-1000"></div>
          <div class="relative flex flex-col sm:flex-row gap-3">
            <div class="relative flex-1">
              <Search class="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
              <input 
                v-model="searchQuery"
                placeholder="Search by name (e.g. Browser, API)..."
                class="w-full bg-[#030a1c] border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-base outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all shadow-2xl"
                @input="fetchPlugins"
              />
            </div>
            <Button @click="fetchPlugins" class="h-14 px-8 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-2xl shadow-xl shadow-emerald-500/20 shrink-0">
              Search
            </Button>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Content -->
    <main class="flex-1 container mx-auto px-6 pb-24 z-10">
      <!-- Filter Bar -->
      <div class="flex items-center justify-between mb-8 border-b border-white/5 pb-6">
        <div class="flex items-center gap-6">
          <button class="text-sm font-bold text-white border-b-2 border-emerald-500 pb-1">All Plugins</button>
          <button class="text-sm font-bold text-slate-500 hover:text-white transition-colors pb-1">Trending</button>
          <button class="text-sm font-bold text-slate-500 hover:text-white transition-colors pb-1">Newest</button>
        </div>
        <div class="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
          <Database class="w-4 h-4" />
          {{ totalItems }} Plugins found
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading && plugins.length === 0" class="flex flex-col items-center justify-center py-32 opacity-50">
        <Loader2 class="h-12 w-12 animate-spin text-emerald-500 mb-4" />
        <p class="text-sm font-bold text-slate-400 tracking-widest uppercase">Fetching Extensions...</p>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card 
          v-for="plugin in plugins" 
          :key="plugin.id"
          class="group bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-500 rounded-[2rem] overflow-hidden flex flex-col h-full"
        >
          <CardHeader class="p-8 pb-4">
            <div class="flex justify-between items-start mb-6">
              <div class="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all duration-500 group-hover:scale-110">
                <Zap v-if="plugin.downloadCount > 10" class="w-7 h-7" />
                <ShoppingBag v-else class="w-7 h-7" />
              </div>
              
              <!-- Manage Actions (Authenticated + Owner Only - Simulated) -->
              <div v-if="isAuthenticated && (user?.id === plugin.publisher.id || user?.role === 'Admin')" class="flex gap-1">
                <Button size="icon" variant="ghost" class="h-8 w-8 rounded-full hover:bg-white/10" @click="openEditDialog(plugin)">
                  <Pencil class="h-3.5 w-3.5" />
                </Button>
                <Button size="icon" variant="ghost" class="h-8 w-8 rounded-full hover:bg-white/10 hover:text-rose-400" @click="deletePlugin(plugin.id)">
                  <Trash2 class="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h3 class="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{{ plugin.name }}</h3>
                <span class="text-[10px] font-black bg-white/5 px-2 py-0.5 rounded-md text-slate-500 uppercase">v{{ plugin.version }}</span>
              </div>
              <p class="text-sm text-slate-500 font-medium tracking-tight line-clamp-2 h-10">
                {{ plugin.description || 'No description provided for this extension.' }}
              </p>
            </div>
          </CardHeader>

          <CardContent class="px-8 pb-6 flex-1 flex flex-col justify-end">
            <div class="flex items-center gap-4 pt-4 border-t border-white/5">
              <div class="flex items-center gap-1.5 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                <Download class="w-3.5 h-3.5 text-emerald-500" />
                <span class="text-xs font-bold text-white">{{ plugin.downloadCount }}</span>
              </div>
              <div class="flex items-center gap-3 ml-auto">
                <button @click="votePlugin(plugin.id, true)" class="flex items-center gap-1.5 hover:text-emerald-400 transition-colors text-slate-500 group/vote">
                  <ArrowUp class="w-4 h-4 group-hover/vote:-translate-y-0.5 transition-transform" /> 
                  <span class="text-xs font-bold">{{ plugin.upvoteCount }}</span>
                </button>
                <button @click="votePlugin(plugin.id, false)" class="flex items-center gap-1.5 hover:text-rose-400 transition-colors text-slate-500 group/down">
                  <ArrowDown class="w-4 h-4 group-hover/down:translate-y-0.5 transition-transform" /> 
                  <span class="text-xs font-bold">{{ plugin.downvoteCount }}</span>
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter class="bg-white/[0.02] px-8 py-5 flex items-center justify-between border-t border-white/5">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] font-bold text-emerald-500">
                {{ plugin.publisher.username.substring(0, 1).toUpperCase() }}
              </div>
              <span class="text-xs font-bold text-slate-400">{{ plugin.publisher.username }}</span>
            </div>
            <Button @click="downloadPlugin(plugin)" class="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black font-black text-xs rounded-xl px-4 py-2 border border-emerald-500/20 hover:border-emerald-500 transition-all duration-300">
              DOWNLOAD
            </Button>
          </CardFooter>
        </Card>

        <!-- Empty State -->
        <div v-if="plugins.length === 0 && !loading" class="col-span-full py-32 text-center">
          <div class="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Info class="w-10 h-10 text-slate-600" />
          </div>
          <h3 class="text-2xl font-bold text-white mb-2">No plugins found</h3>
          <p class="text-slate-500 mb-8">Try adjusting your search filters or browse categories.</p>
          <Button @click="searchQuery = ''; fetchPlugins()" variant="outline" class="rounded-xl border-white/10 text-white font-bold">Clear Filters</Button>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-white/5 bg-[#010409] py-12 px-6 mt-auto">
      <div class="container mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
        <div class="flex flex-col items-center md:items-start gap-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <ShoppingBag class="w-5 h-5 text-black" />
            </div>
            <span class="font-bold text-white uppercase tracking-widest text-sm">StressPilot</span>
          </div>
          <p class="text-xs text-slate-500 font-medium">© 2026 StressPilot Marketplace. All rights reserved.</p>
        </div>
        <div class="flex items-center gap-8 text-xs font-bold text-slate-500 uppercase tracking-widest">
          <a href="#" class="hover:text-emerald-500 transition-colors">Privacy Policy</a>
          <a href="#" class="hover:text-emerald-500 transition-colors">Terms of Service</a>
          <a href="#" class="hover:text-emerald-500 transition-colors">Contact</a>
        </div>
      </div>
    </footer>

    <!-- Release/Edit Dialog -->
    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[550px] bg-[#030a1c] border-white/10 rounded-[2.5rem] p-0 overflow-hidden shadow-2xl">
        <div class="bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-10 pt-12">
          <DialogHeader class="mb-10 text-center sm:text-left">
            <DialogTitle class="text-4xl font-black text-white tracking-tight">{{ isEditMode ? 'Edit Metadata' : 'New Extension' }}</DialogTitle>
            <DialogDescription class="text-slate-400 text-base font-medium mt-2">
              Share your custom built plugin with the community.
            </DialogDescription>
          </DialogHeader>
          
          <div class="space-y-8">
            <div class="grid grid-cols-2 gap-6">
              <div class="space-y-2.5">
                <Label class="text-xs font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Extension Slug</Label>
                <Input v-model="formData.code" placeholder="my-plugin" :disabled="isEditMode" class="bg-white/5 border-white/10 rounded-2xl h-14 text-base focus:ring-emerald-500/20" />
              </div>
              <div class="space-y-2.5">
                <Label class="text-xs font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Semver Version</Label>
                <Input v-model="formData.version" placeholder="1.0.0" :disabled="isEditMode" class="bg-white/5 border-white/10 rounded-2xl h-14 text-base focus:ring-emerald-500/20" />
              </div>
            </div>

            <div class="space-y-2.5">
              <Label class="text-xs font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Product Title</Label>
              <Input v-model="formData.name" placeholder="Official StressPilot Ext." class="bg-white/5 border-white/10 rounded-2xl h-14 text-base focus:ring-emerald-500/20" />
            </div>

            <div class="space-y-2.5">
              <Label class="text-xs font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Short Bio</Label>
              <textarea v-model="formData.description" placeholder="Explain what this extension solves..." class="w-full bg-white/5 border border-white/10 rounded-3xl p-5 text-base min-h-[120px] focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none"></textarea>
            </div>

            <div v-if="!isEditMode" class="space-y-2.5">
              <Label class="text-xs font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Asset Pipeline</Label>
              <div 
                class="border-2 border-dashed border-white/10 rounded-[2rem] p-10 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-emerald-500/30 transition-all group"
                @click="$refs.fileInput.click()"
              >
                <div class="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-500">
                  <UploadCloud class="w-8 h-8 text-emerald-500" />
                </div>
                <p class="text-lg font-bold text-white">{{ selectedFile ? selectedFile.name : 'Select binary asset' }}</p>
                <p class="text-xs text-slate-500 mt-2 uppercase tracking-[0.1em] font-black">JAR or JS • AUTO-VERIFIED • MAX 50MB</p>
                <input ref="fileInput" type="file" class="hidden" @change="handleFileChange" />
              </div>
            </div>
          </div>

          <div class="pt-12 pb-2">
            <Button 
              :disabled="uploading" 
              class="w-full h-16 rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xl shadow-2xl shadow-emerald-500/20 active:scale-95 transition-all"
              @click="handleSubmit"
            >
              <Loader2 v-if="uploading" class="w-6 h-6 animate-spin mr-3" />
              {{ isEditMode ? 'UPDATE METADATA' : 'DEPLOY TO MARKETPLACE' }}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style>
/* Optimized custom scrollbar */
::-webkit-scrollbar { width: 8px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 20px; }
::-webkit-scrollbar-thumb:hover { background: rgba(16, 185, 129, 0.2); }

.animate-pulse-slow {
  animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.1; }
  50% { opacity: 0.3; }
}
</style>
