<script setup lang="ts">
import {
  Plus, Search, Pencil, Trash2, Loader2, UploadCloud,
  ArrowUp, ArrowDown, Download, LogOut,
  Database, Info, ShoppingBag, Zap, Sparkles, AlertCircle, CheckCircle2,
  Sun, Moon, ChevronRight, History, Box, LayoutGrid, List
} from 'lucide-vue-next'
import type {
  Plugin, PluginResponse, CreatePluginRequest, UploadPluginRequest,
  ApiResponse, PaginatedResponse, CreatePluginResponse, UploadPluginResponse
} from '@/types'

const { user, token, logout, fetchProfile, isAuthenticated } = useAuth()
const $api = useApi()
const colorMode = useColorMode()

const toggleTheme = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

// ── State ──────────────────────────────────────────────────────────────────
const plugins = ref<Plugin[]>([])
const loading = ref(false)
const searchQuery = ref('')
const page = ref(1)
const totalItems = ref(0)
let searchTimeout: NodeJS.Timeout | null = null

watch(searchQuery, () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => { page.value = 1; fetchPlugins() }, 500)
})

// ── Dialog state ───────────────────────────────────────────────────────────
type DialogMode = 'create' | 'upload' | 'edit' | 'versions' | null
const dialogMode = ref<DialogMode>(null)
const isDialogOpen = computed({
  get: () => dialogMode.value !== null,
  set: (v) => { if (!v) dialogMode.value = null }
})

const activePluginId = ref<number | null>(null)
const activePlugin = ref<Plugin | null>(null)

const createForm = ref<CreatePluginRequest>({ code: '', name: '', version: '1.0.0', description: '', tags: [] })
const tagInput = ref('')
const editForm = ref({ name: '', description: '', tags: [] as string[] })
const editTagInput = ref('')
const selectedFile = ref<File | null>(null)
const fileError = ref('')
const submitting = ref(false)
const submitError = ref('')

// ── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const isOwnerOrAdmin = (plugin: Plugin) =>
  isAuthenticated.value && (user.value?.id === plugin.publisher.id || user.value?.role === 'Admin')

const addTag = () => {
  if (!tagInput.value) return
  if (!createForm.value.tags) createForm.value.tags = []
  if (!createForm.value.tags.includes(tagInput.value)) {
    createForm.value.tags.push(tagInput.value)
  }
  tagInput.value = ''
}

const removeTag = (tag: string) => {
  createForm.value.tags = createForm.value.tags?.filter(t => t !== tag)
}

const addEditTag = () => {
  if (!editTagInput.value) return
  if (!editForm.value.tags.includes(editTagInput.value)) {
    editForm.value.tags.push(editTagInput.value)
  }
  editTagInput.value = ''
}

const removeEditTag = (tag: string) => {
  editForm.value.tags = editForm.value.tags.filter(t => t !== tag)
}

// ── Data fetching ──────────────────────────────────────────────────────────
const fetchPlugins = async () => {
  loading.value = true
  try {
    const params: Record<string, any> = { page: page.value, per_page: 20 }
    if (searchQuery.value) params.name = searchQuery.value

    const response = await $api<ApiResponse<PaginatedResponse<PluginResponse>>>('/api/v1/plugins', { params })
    if (response?.data) {
      plugins.value = response.data.items.map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description,
        status: p.status,
        publisher: p.publisher,
        upvoteCount: p.upvote_count,
        downvoteCount: p.downvote_count,
        tags: p.tags,
        latestVersion: p.latest_version,
        installationStatus: p.installation_status,
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }))
      totalItems.value = response.data.total
    }
  } catch (e) {
    console.error('Failed to fetch plugins:', e)
  } finally {
    loading.value = false
  }
}

// ── Create flow ────────────────────────────────────────────────────────────
const openCreateDialog = () => {
  if (!isAuthenticated.value) { navigateTo('/login'); return }
  createForm.value = { code: '', name: '', version: '1.0.0', description: '', tags: [] }
  tagInput.value = ''
  submitError.value = ''
  dialogMode.value = 'create'
}

const submitCreate = async () => {
  submitError.value = ''
  submitting.value = true
  try {
    const res = await $api<ApiResponse<CreatePluginResponse>>('/api/v1/plugins', {
      method: 'POST',
      body: createForm.value
    })
    if (!res.data) throw new Error('No response data')
    activePluginId.value = res.data.plugin_id
    activePlugin.value = { id: res.data.plugin_id, latestVersion: createForm.value.version } as any
    selectedFile.value = null
    fileError.value = ''
    dialogMode.value = 'upload'
    await fetchPlugins()
  } catch (e: any) {
    submitError.value = e?.data?.message || e?.message || 'Failed to create plugin'
  } finally {
    submitting.value = false
  }
}

const handleFileChange = (event: Event) => {
  fileError.value = ''
  const target = event.target as HTMLInputElement
  if (!target.files?.length) return
  const file = target.files[0]
  if (file.size > 210 * 1024 * 1024) {
    fileError.value = `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 210 MB.`
    target.value = ''
    return
  }
  selectedFile.value = file
}

const submitUpload = async () => {
  if (!selectedFile.value || !activePluginId.value || !activePlugin.value) return
  submitError.value = ''
  submitting.value = true
  try {
    const version = activePlugin.value.latestVersion || createForm.value.version
    const uploadReq: UploadPluginRequest = {
      filename: selectedFile.value.name,
      file_size: selectedFile.value.size
    }
    const urlRes = await $api<ApiResponse<UploadPluginResponse>>(
      `/api/v1/plugins/${activePluginId.value}/versions/${version}/upload`,
      { method: 'POST', body: uploadReq }
    )
    if (!urlRes.data?.upload_url) throw new Error('No upload URL received')

    const s3Res = await fetch(urlRes.data.upload_url, {
      method: 'PUT',
      body: selectedFile.value,
      headers: { 'Content-Type': selectedFile.value.type || 'application/octet-stream' }
    })
    if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status} ${s3Res.statusText}`)

    await $api(`/api/v1/plugins/${activePluginId.value}/versions/${version}/publish`, {
      method: 'POST'
    })

    dialogMode.value = null
    await fetchPlugins()
  } catch (e: any) {
    submitError.value = e?.data?.message || e?.message || 'Upload failed. You can try again.'
  } finally {
    submitting.value = false
  }
}

const openEditDialog = (plugin: Plugin) => {
  activePluginId.value = plugin.id
  editForm.value = { 
    name: plugin.name, 
    description: plugin.description || '',
    tags: [...plugin.tags]
  }
  editTagInput.value = ''
  submitError.value = ''
  dialogMode.value = 'edit'
}

const submitEdit = async () => {
  if (!activePluginId.value) return
  submitError.value = ''
  submitting.value = true
  try {
    await $api(`/api/v1/plugins/${activePluginId.value}`, {
      method: 'PATCH',
      body: { 
        name: editForm.value.name, 
        description: editForm.value.description,
        tags: editForm.value.tags
      }
    })
    dialogMode.value = null
    await fetchPlugins()
  } catch (e: any) {
    submitError.value = e?.data?.message || e?.message || 'Update failed'
  } finally {
    submitting.value = false
  }
}

const deletePlugin = async (id: number) => {
  if (!confirm('Delete this plugin? This cannot be undone.')) return
  try {
    await $api(`/api/v1/plugins/${id}`, {
      method: 'DELETE'
    })
    await fetchPlugins()
  } catch (e) {
    console.error('Delete failed:', e)
  }
}

onMounted(async () => {
  if (token.value) await fetchProfile()
  fetchPlugins()
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans flex flex-col selection:bg-primary/30 selection:text-primary-foreground">
    <!-- Background blobs -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 dark:bg-primary/5 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/10 dark:bg-primary/5 rounded-full blur-[120px] animate-pulse-slow" style="animation-delay: 2s"></div>
    </div>

    <!-- Header Island -->
    <div class="sticky top-4 z-50 w-full px-6">
      <header class="container mx-auto h-16 border border-border bg-surface/80 backdrop-blur-xl rounded-2xl shadow-island flex items-center justify-between px-6 transition-all duration-300">
        <div class="flex items-center gap-8">
          <NuxtLink to="/" class="flex items-center gap-3 group">
            <div class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-glow group-hover:rotate-12 transition-transform duration-500">
              <Database class="w-6 h-6 text-primary-foreground" />
            </div>
            <h1 class="text-xl font-black text-foreground tracking-tight uppercase">STRESS<span class="text-primary">PILOT</span></h1>
          </NuxtLink>
        </div>

        <div class="flex items-center gap-4">
          <button
            @click="toggleTheme"
            class="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-elevated transition-all text-secondary hover:text-foreground shadow-sm"
            title="Toggle Theme"
          >
            <Sun v-if="colorMode.value === 'dark'" class="w-4 h-4" />
            <Moon v-else class="w-4 h-4" />
          </button>

          <div v-if="isAuthenticated && user" class="flex items-center gap-4">
            <button @click="openCreateDialog" class="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-widest transition-all rounded-xl shadow-glow">
              <Plus class="w-4 h-4" /> Release Plugin
            </button>
            <div class="h-6 w-px bg-border"></div>
            <div class="flex items-center gap-3">
              <div class="hidden sm:flex flex-col items-end leading-none">
                <span class="text-[11px] font-black text-foreground uppercase tracking-tight">{{ user.username }}</span>
                <span class="text-[9px] text-secondary font-bold uppercase tracking-widest mt-1">{{ user.role }}</span>
              </div>
              <button @click="logout" class="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/20 transition-all group">
                <LogOut class="w-4 h-4 text-secondary group-hover:text-destructive" />
              </button>
            </div>
          </div>
          <div v-else class="flex items-center gap-2">
            <NuxtLink to="/login">
              <button class="text-xs font-black uppercase tracking-widest text-secondary hover:text-foreground px-4 py-2.5 transition-colors">Sign In</button>
            </NuxtLink>
            <NuxtLink to="/signup">
              <button class="bg-foreground text-background dark:bg-white dark:text-black text-xs font-black uppercase tracking-widest px-6 py-2.5 transition-all rounded-xl shadow-island">Sign Up</button>
            </NuxtLink>
          </div>
        </div>
      </header>
    </div>

    <!-- Hero Section -->
    <section class="relative pt-24 pb-12 px-6 overflow-hidden">
      <div class="container mx-auto text-center relative z-10">
        <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-6">
          <Sparkles class="w-3.5 h-3.5" /> Discover the best extensions
        </div>
        <h1 class="text-5xl md:text-7xl font-black text-foreground mb-6 tracking-[-0.05em] leading-none uppercase">
          Supercharge your <span class="text-primary italic">StressPilot</span>
        </h1>
        <p class="text-secondary font-medium text-sm md:text-base max-w-2xl mx-auto mb-12 leading-relaxed">
          The official marketplace for StressPilot plugins. Search, download, and integrate community-built extensions in seconds.
        </p>
        
        <div class="max-w-3xl mx-auto relative group">
          <div class="absolute -inset-1 bg-primary/20 rounded-3xl blur opacity-25 group-focus-within:opacity-100 transition duration-1000"></div>
          <div class="relative flex bg-surface border border-border p-2 focus-within:border-primary/50 transition-all shadow-island rounded-2xl">
            <div class="relative flex-1">
              <Search class="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input
                v-model="searchQuery"
                placeholder="Search by name, code or identifier..."
                class="w-full bg-transparent border-none pl-14 pr-4 py-4 text-base font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
            <button @click="fetchPlugins" class="px-10 bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm uppercase tracking-widest transition-all rounded-xl shadow-glow">
              SEARCH
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Main Content Island -->
    <main class="flex-1 container mx-auto px-6 pb-24 z-10">
      <div class="bg-surface/40 backdrop-blur-sm border border-border rounded-[2.5rem] p-8 md:p-12 shadow-island">
        <div class="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6">
          <div class="flex items-center gap-6">
            <button class="text-xs font-black text-foreground uppercase tracking-widest border-b-2 border-primary pb-2">All Extensions</button>
            <button class="text-xs font-black text-secondary hover:text-foreground uppercase tracking-widest pb-2 transition-colors">Trending</button>
            <button class="text-xs font-black text-secondary hover:text-foreground uppercase tracking-widest pb-2 transition-colors">Newest</button>
          </div>
          <div class="flex items-center gap-3 px-4 py-2 bg-elevated/50 border border-border rounded-full text-[10px] font-black text-secondary uppercase tracking-widest">
            <span class="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
            {{ totalItems }} Extensions Available
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loading && plugins.length === 0" class="flex flex-col items-center justify-center py-32">
          <Loader2 class="h-12 w-12 animate-spin text-primary mb-6" />
          <p class="text-xs font-black text-secondary tracking-[0.4em] uppercase">Synchronizing Index...</p>
        </div>

        <!-- Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <div
            v-for="plugin in plugins"
            :key="plugin.id"
            class="group bg-surface border border-border hover:border-primary/40 transition-all duration-500 flex flex-col cursor-pointer relative overflow-hidden rounded-3xl shadow-sm hover:shadow-island-hover hover:-translate-y-1"
            @click="navigateTo(`/plugins/${plugin.id}`)"
          >
            <!-- Status Ribbon for owner -->
            <div v-if="plugin.status === 'DRAFTED'" class="absolute top-0 right-0 px-4 py-1.5 bg-amber-500 text-black text-[9px] font-black uppercase tracking-[0.2em] z-20 rounded-bl-2xl shadow-xl">
              Draft
            </div>

            <div class="p-8 flex-1 space-y-6">
              <div class="flex items-start justify-between">
                <div class="w-14 h-14 bg-elevated border border-border flex items-center justify-center group-hover:border-primary/50 transition-all duration-500 rounded-2xl shadow-inner group-hover:scale-110 group-hover:rotate-3">
                  <Box class="w-7 h-7 text-secondary group-hover:text-primary transition-colors" />
                </div>
                <div class="flex items-center gap-1" @click.stop>
                  <button
                    v-if="isOwnerOrAdmin(plugin)"
                    @click="openEditDialog(plugin)"
                    class="p-2.5 text-secondary hover:text-foreground hover:bg-elevated transition-all rounded-xl"
                  >
                    <Pencil class="w-4 h-4" />
                  </button>
                  <button
                    v-if="isOwnerOrAdmin(plugin)"
                    @click="deletePlugin(plugin.id)"
                    class="p-2.5 text-secondary hover:text-destructive hover:bg-destructive/10 transition-all rounded-xl"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center gap-2">
                  <h3 class="text-xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">{{ plugin.name }}</h3>
                  <span v-if="plugin.latestVersion" class="text-[10px] font-black bg-elevated px-2 py-0.5 rounded-lg text-secondary border border-border uppercase">v{{ plugin.latestVersion }}</span>
                </div>
                <p class="text-[11px] font-mono text-primary/70 uppercase tracking-widest font-bold">{{ plugin.code }}</p>
              </div>

              <p v-if="plugin.description" class="text-sm text-secondary line-clamp-2 leading-relaxed font-medium">
                {{ plugin.description }}
              </p>

              <div class="flex flex-wrap gap-2 pt-2">
                <span v-for="tag in plugin.tags" :key="tag" class="px-3 py-1 bg-elevated/50 border border-border text-[9px] font-black text-secondary uppercase tracking-[0.15em] group-hover:border-primary/20 transition-colors rounded-lg">
                  {{ tag }}
                </span>
              </div>
            </div>

            <div class="px-8 py-5 bg-elevated/30 border-t border-border flex items-center justify-between transition-colors group-hover:bg-elevated/50">
              <div class="flex items-center gap-6">
                <div class="flex items-center gap-2 text-xs font-black text-secondary">
                  <ArrowUp class="w-4 h-4 text-primary/60 group-hover:text-primary transition-colors" />
                  {{ plugin.upvoteCount }}
                </div>
                <div class="flex items-center gap-2 text-xs font-black text-secondary">
                  <Download class="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  {{ plugin.latestVersion ? 'Stable' : 'Untagged' }}
                </div>
              </div>
              <div class="w-8 h-8 rounded-full border border-border flex items-center justify-center group-hover:border-primary group-hover:bg-primary transition-all duration-500">
                <ChevronRight class="w-4 h-4 text-border group-hover:text-primary-foreground group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="plugins.length === 0 && !loading" class="col-span-full py-40 text-center">
            <div class="w-20 h-20 bg-elevated border border-border rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-island">
              <Info class="w-10 h-10 text-muted-foreground" />
            </div>
            <h3 class="text-2xl font-black text-foreground uppercase tracking-widest mb-3">Void Registry</h3>
            <p class="text-sm text-secondary font-medium mb-12 max-w-md mx-auto leading-relaxed uppercase tracking-widest">Your artifact search returned no matches from our central distribution network.</p>
            <button @click="searchQuery = ''; fetchPlugins()" class="px-12 py-4 bg-foreground text-background dark:bg-white dark:text-black text-xs font-black uppercase tracking-[0.4em] hover:scale-105 transition-all rounded-2xl shadow-island">
              RESET_INDEX
            </button>
          </div>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-border bg-surface py-16 px-6 mt-auto">
      <div class="container mx-auto flex flex-col md:flex-row justify-between items-center gap-12">
        <div class="flex flex-col items-center md:items-start gap-6">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-glow">
              <Database class="w-6 h-6 text-primary-foreground" />
            </div>
            <span class="font-black text-foreground uppercase tracking-tight text-xl italic">STRESS<span class="text-primary">PILOT</span></span>
          </div>
          <p class="text-[10px] text-secondary font-black uppercase tracking-[0.4em]">Distributing high-performance artifacts since 2026</p>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-12 text-[11px] font-black text-secondary uppercase tracking-[0.2em]">
          <div class="flex flex-col gap-4">
            <span class="text-foreground border-b border-primary/30 pb-2">Resources</span>
            <a href="#" class="hover:text-primary transition-colors">Documentation</a>
            <a href="#" class="hover:text-primary transition-colors">API Reference</a>
          </div>
          <div class="flex flex-col gap-4">
            <span class="text-foreground border-b border-primary/30 pb-2">Legal</span>
            <a href="#" class="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" class="hover:text-primary transition-colors">Terms of Service</a>
          </div>
          <div class="flex flex-col gap-4">
            <span class="text-foreground border-b border-primary/30 pb-2">Contact</span>
            <a href="#" class="hover:text-primary transition-colors">Support</a>
            <a href="#" class="hover:text-primary transition-colors">Registry Status</a>
          </div>
        </div>
      </div>
    </footer>

    <!-- Dialogs -->
    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[600px] bg-surface border-border rounded-3xl p-0 overflow-hidden shadow-2xl">
        <div class="p-12 relative overflow-hidden">
          <div class="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>
          
          <!-- CREATE -->
          <template v-if="dialogMode === 'create'">
            <div class="mb-12">
              <h2 class="text-3xl font-black text-foreground tracking-tight uppercase italic">Register <span class="text-primary">Artifact</span></h2>
              <p class="text-secondary text-[11px] font-black uppercase tracking-widest mt-2 border-l-2 border-primary pl-3">Initialize a new distribution entry</p>
            </div>
            
            <div class="space-y-8">
              <div class="grid grid-cols-2 gap-8">
                <div class="space-y-3">
                  <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-secondary ml-1">Artifact Slug</Label>
                  <Input v-model="createForm.code" placeholder="my-plugin-core" class="bg-elevated border-border rounded-xl h-14 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-all shadow-inner" />
                </div>
                <div class="space-y-3">
                  <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-secondary ml-1">Initial Version</Label>
                  <Input v-model="createForm.version" placeholder="1.0.0" class="bg-elevated border-border rounded-xl h-14 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-all shadow-inner" />
                </div>
              </div>
              <div class="space-y-3">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-secondary ml-1">Artifact Name</Label>
                <Input v-model="createForm.name" placeholder="StressPilot Awesome Extension" class="bg-elevated border-border rounded-xl h-14 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-all shadow-inner" />
              </div>
              <div class="space-y-3">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-secondary ml-1">GitHub Repository (Optional)</Label>
                <Input v-model="createForm.github_repo" placeholder="https://github.com/user/repo" class="bg-elevated border-border rounded-xl h-14 text-sm font-bold text-foreground placeholder:text-muted-foreground focus:border-primary/50 transition-all shadow-inner" />
              </div>
              <div class="space-y-3">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-secondary ml-1">Technical Overview</Label>
                <textarea v-model="createForm.description" placeholder="Optional: Brief technical overview..." class="w-full bg-elevated border border-border rounded-2xl p-5 text-sm focus:border-primary/50 outline-none resize-none font-medium text-foreground placeholder:text-zinc-700 min-h-[120px] shadow-inner"></textarea>
              </div>
              <p v-if="submitError" class="text-[11px] text-destructive font-bold uppercase tracking-widest bg-destructive/5 p-3 rounded-lg border border-destructive/10 flex items-center gap-2">
                <AlertCircle class="w-4 h-4" /> {{ submitError }}
              </p>
            </div>
            
            <div class="mt-12">
              <button :disabled="submitting" @click="submitCreate" class="w-full h-16 bg-foreground text-background dark:bg-white dark:text-black font-black text-sm uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 rounded-2xl shadow-island active:scale-[0.98]">
                <Loader2 v-if="submitting" class="w-5 h-5 animate-spin" />
                INITIALIZE_REGISTRY
              </button>
            </div>
          </template>

          <!-- UPLOAD -->
          <template v-else-if="dialogMode === 'upload'">
            <div class="mb-12">
              <h2 class="text-3xl font-black text-foreground tracking-tight uppercase italic">Attach <span class="text-primary">Binary</span></h2>
              <p class="text-secondary text-[11px] font-black uppercase tracking-widest mt-2 border-l-2 border-primary pl-3">Upload verified .jar artifact</p>
            </div>
            
            <div class="space-y-8">
              <div
                class="border-2 border-dashed border-border h-60 flex flex-col items-center justify-center cursor-pointer hover:bg-elevated/50 hover:border-primary/30 transition-all group rounded-3xl relative overflow-hidden bg-elevated/20 shadow-inner"
                @click="($refs.fileInput as HTMLInputElement).click()"
              >
                <UploadCloud class="w-14 h-14 text-muted-foreground group-hover:text-primary transition-all mb-6 group-hover:-translate-y-1" />
                <p class="text-sm font-bold text-foreground text-center px-10 truncate w-full">
                  {{ selectedFile ? selectedFile.name : 'SELECT_ARTIFACT_OBJECT' }}
                </p>
                <p class="text-[10px] text-secondary mt-3 uppercase tracking-[0.3em] font-black">Binary Limit: 210MB</p>
                <input ref="fileInput" type="file" class="hidden" @change="handleFileChange" />
              </div>
              <p v-if="fileError" class="text-[11px] text-destructive font-bold uppercase tracking-widest bg-destructive/5 p-3 rounded-lg border border-destructive/10">{{ fileError }}</p>
              <p v-if="submitError" class="text-[11px] text-destructive font-bold uppercase tracking-widest bg-destructive/5 p-3 rounded-lg border border-destructive/10">{{ submitError }}</p>
            </div>
            
            <div class="mt-12 grid grid-cols-2 gap-6">
              <button @click="dialogMode = null" class="h-16 border border-border text-secondary hover:text-foreground hover:bg-elevated font-black text-xs uppercase tracking-[0.3em] transition-all rounded-2xl active:scale-[0.98]">
                LATER
              </button>
              <button
                :disabled="submitting || !selectedFile"
                @click="submitUpload"
                class="h-16 bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 disabled:opacity-30 rounded-2xl shadow-glow active:scale-[0.98]"
              >
                <Loader2 v-if="submitting" class="w-5 h-5 animate-spin" />
                COMMIT_ARTIFACT
              </button>
            </div>
          </template>

          <!-- EDIT -->
          <template v-else-if="dialogMode === 'edit'">
            <div class="mb-12">
              <h2 class="text-3xl font-black text-foreground tracking-tight uppercase italic">Update <span class="text-primary">Metadata</span></h2>
              <p class="text-secondary text-[11px] font-black uppercase tracking-widest mt-2 border-l-2 border-primary pl-3">Modify artifact technical profile</p>
            </div>
            
            <div class="space-y-8">
              <div class="space-y-3">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-secondary ml-1">Artifact Name</Label>
                <Input v-model="editForm.name" class="bg-elevated border-border rounded-xl h-14 text-sm font-bold text-foreground focus:border-primary/50 transition-all shadow-inner" />
              </div>
              <div class="space-y-3">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-secondary ml-1">Project Identifiers (Tags)</Label>
                <div class="flex gap-3">
                  <Input v-model="editTagInput" placeholder="Add identifier..." class="bg-elevated border-border rounded-xl h-14 text-sm font-bold text-foreground focus:border-primary/50 transition-all shadow-inner" @keyup.enter="addEditTag" />
                  <button @click="addEditTag" class="px-8 bg-foreground text-background dark:bg-white dark:text-black text-[10px] font-black uppercase tracking-widest hover:scale-[1.02] transition-all rounded-xl shadow-island">PUSH</button>
                </div>
                <div v-if="editForm.tags && editForm.tags.length > 0" class="flex flex-wrap gap-3 mt-4">
                  <span v-for="tag in editForm.tags" :key="tag" class="px-4 py-2 bg-primary/10 text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-3 border border-primary/20 rounded-xl">
                    {{ tag }}
                    <button @click="removeEditTag(tag)" class="hover:text-foreground transition-colors font-black text-lg leading-none">&times;</button>
                  </span>
                </div>
              </div>
              <div class="space-y-3">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-secondary ml-1">Technical Overview</Label>
                <textarea v-model="editForm.description" class="w-full bg-elevated border border-border rounded-2xl p-5 text-sm focus:border-primary/50 outline-none resize-none font-medium text-foreground min-h-[140px] shadow-inner"></textarea>
              </div>
              <p v-if="submitError" class="text-[11px] text-destructive font-bold uppercase tracking-widest">{{ submitError }}</p>
            </div>
            
            <div class="mt-12">
              <button :disabled="submitting" @click="submitEdit" class="w-full h-16 bg-primary text-primary-foreground font-black text-sm uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 rounded-2xl shadow-glow active:scale-[0.98]">
                <Loader2 v-if="submitting" class="w-5 h-5 animate-spin" />
                COMMIT_INDEX_UPDATE
              </button>
            </div>
          </template>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600;700;900&display=swap');

:root {
  --font-mono: 'JetBrains Mono', monospace;
}

body {
  font-family: 'IBM Plex Sans', sans-serif;
  background-color: hsl(var(--background));
}

.font-mono {
  font-family: var(--font-mono) !important;
}

::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { @apply bg-muted-foreground/20 rounded-full; }
::-webkit-scrollbar-thumb:hover { @apply bg-primary/50; }

.shadow-island {
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.3);
}

.dark .shadow-island {
  box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.7);
}

.shadow-island-hover {
  box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.4);
}

.dark .shadow-island-hover {
  box-shadow: 0 20px 60px -12px rgba(0, 0, 0, 0.8);
}

.shadow-glow {
  box-shadow: 0 0 20px -5px hsla(var(--primary) / 0.4);
}
</style>
