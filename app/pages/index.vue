<script setup lang="ts">
import {
  Plus, Search, Pencil, Trash2, Loader2, UploadCloud,
  ArrowUp, ArrowDown, Download, LogOut,
  Database, Info, ShoppingBag, Zap, Sparkles, AlertCircle, CheckCircle2
} from 'lucide-vue-next'
import type {
  Plugin, PluginResponse, CreatePluginRequest, UploadPluginRequest,
  ApiResponse, PaginatedResponse, CreatePluginResponse, UploadPluginResponse
} from '@/types'

const { user, token, logout, fetchProfile, isAuthenticated } = useAuth()
const $api = useApi()

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
type DialogMode = 'create' | 'upload' | 'edit' | null
const dialogMode = ref<DialogMode>(null)
const isDialogOpen = computed({
  get: () => dialogMode.value !== null,
  set: (v) => { if (!v) dialogMode.value = null }
})

// Active plugin being operated on (upload retry / edit)
const activePluginId = ref<number | null>(null)

const createForm = ref<CreatePluginRequest>({ code: '', name: '', version: '1.0.0', description: '', tags: [] })
const tagInput = ref('')
const editForm = ref({ name: '', description: '' })
const selectedFile = ref<File | null>(null)
const fileError = ref('')
const submitting = ref(false)
const submitError = ref('')

// ── Helpers ────────────────────────────────────────────────────────────────
const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

const isOwnerOrAdmin = (plugin: Plugin) =>
  isAuthenticated.value && (user.value?.id === plugin.publisher.id || user.value?.role === 'Admin')

const isDraft = (plugin: Plugin) => !plugin.latestVersion

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
    selectedFile.value = null
    fileError.value = ''
    // Advance to upload step in same dialog session
    dialogMode.value = 'upload'
    await fetchPlugins()
  } catch (e: any) {
    submitError.value = e?.data?.message || e?.message || 'Failed to create plugin'
  } finally {
    submitting.value = false
  }
}

// ── Upload flow ────────────────────────────────────────────────────────────
const openUploadDialog = (plugin: Plugin) => {
  activePluginId.value = plugin.id
  selectedFile.value = null
  fileError.value = ''
  submitError.value = ''
  dialogMode.value = 'upload'
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
  if (!selectedFile.value || !activePluginId.value) return
  submitError.value = ''
  submitting.value = true
  try {
    const uploadReq: UploadPluginRequest = {
      filename: selectedFile.value.name,
      file_size: selectedFile.value.size
    }
    // 1. Get presigned URL
    const urlRes = await $api<ApiResponse<UploadPluginResponse>>(
      `/api/v1/plugins/${activePluginId.value}/upload`,
      { method: 'POST', body: uploadReq }
    )
    if (!urlRes.data?.upload_url) throw new Error('No upload URL received')

    // 2. PUT file directly to S3
    const s3Res = await fetch(urlRes.data.upload_url, {
      method: 'PUT',
      body: selectedFile.value,
      headers: { 'Content-Type': selectedFile.value.type || 'application/octet-stream' }
    })
    if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status} ${s3Res.statusText}`)

    // 3. Publish
    await $api(`/api/v1/plugins/${activePluginId.value}/publish`, {
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

// ── Edit flow ──────────────────────────────────────────────────────────────
const openEditDialog = (plugin: Plugin) => {
  activePluginId.value = plugin.id
  editForm.value = { name: plugin.name, description: plugin.description || '' }
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
      body: { name: editForm.value.name, description: editForm.value.description }
    })
    dialogMode.value = null
    await fetchPlugins()
  } catch (e: any) {
    submitError.value = e?.data?.message || e?.message || 'Update failed'
  } finally {
    submitting.value = false
  }
}

// ── Delete ─────────────────────────────────────────────────────────────────
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

// ── Vote ───────────────────────────────────────────────────────────────────
const votePlugin = async (id: number, isUpvote: boolean) => {
  if (!isAuthenticated.value) { navigateTo('/login'); return }
  try {
    await $api(`/api/v1/plugins/${id}/vote`, {
      method: 'POST',
      body: { is_upvote: isUpvote }
    })
    await fetchPlugins()
  } catch (e) {
    console.error('Vote failed:', e)
  }
}

// ── Download (PUBLISHED only) ──────────────────────────────────────────────
const downloadPlugin = async (plugin: Plugin) => {
  try {
    const response = await $api<ApiResponse<string>>(`/api/v1/plugins/${plugin.id}/download`)
    if (response?.data) {
      window.open(response.data, '_blank')
      setTimeout(fetchPlugins, 1000)
    }
  } catch (e) {
    console.error('Download failed:', e)
  }
}

onMounted(async () => {
  if (token.value) await fetchProfile()
  fetchPlugins()
})
</script>

<template>
  <div class="min-h-screen bg-[#020817] text-slate-200 font-sans flex flex-col overflow-x-hidden">
    <!-- Background blobs -->
    <div class="fixed inset-0 pointer-events-none z-0">
      <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-500/5 rounded-full blur-[120px] animate-pulse-slow" style="animation-delay: 2s"></div>
    </div>

    <!-- Header -->
    <header class="h-16 border-b border-white/5 bg-[#020817]/80 backdrop-blur-md sticky top-0 z-50">
      <div class="container mx-auto h-full flex items-center justify-between px-6">
        <div class="flex items-center gap-8">
          <NuxtLink to="/" class="flex items-center gap-3 group">
            <div class="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform duration-300">
              <ShoppingBag class="w-5 h-5 text-black" />
            </div>
            <div class="flex flex-col">
              <span class="font-bold text-lg tracking-tight text-white leading-none">StressPilot</span>
              <span class="text-[9px] font-bold text-emerald-500/70 uppercase tracking-[0.2em]">Marketplace</span>
            </div>
          </NuxtLink>
          <nav class="hidden md:flex items-center gap-1">
            <button class="px-3 py-1.5 rounded-lg text-sm font-bold text-white bg-white/5">Discover</button>
            <button class="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition-colors">Categories</button>
            <button class="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-400 hover:text-white transition-colors">Docs</button>
          </nav>
        </div>

        <div class="flex items-center gap-4">
          <div v-if="isAuthenticated && user" class="flex items-center gap-4">
            <Button @click="openCreateDialog" variant="ghost" class="hidden sm:flex text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 font-bold rounded-lg h-9">
              <Plus class="w-4 h-4 mr-2" /> Release Plugin
            </Button>
            <div class="h-6 w-[1px] bg-white/10 hidden sm:block"></div>
            <div class="flex items-center gap-3 pl-2">
              <div class="hidden sm:flex flex-col items-end">
                <span class="text-xs font-bold text-white">{{ user.username }}</span>
                <span class="text-[9px] text-slate-500 font-medium">{{ user.role }}</span>
              </div>
              <button @click="logout" class="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-rose-500/10 hover:border-rose-500/20 transition-all group">
                <LogOut class="w-3.5 h-3.5 text-slate-400 group-hover:text-rose-400" />
              </button>
            </div>
          </div>
          <div v-else class="flex items-center gap-2">
            <NuxtLink to="/login">
              <Button variant="ghost" class="text-xs font-bold text-slate-400 hover:text-white rounded-lg h-9">Sign In</Button>
            </NuxtLink>
            <NuxtLink to="/signup">
              <Button class="bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-lg px-4 h-9 shadow-lg shadow-emerald-500/20 text-xs">Get Started</Button>
            </NuxtLink>
          </div>
        </div>
      </div>
    </header>

    <!-- Hero / Search -->
    <section class="relative pt-12 pb-10 px-6 overflow-hidden">
      <div class="container mx-auto text-center relative z-10">
        <div class="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[9px] font-bold uppercase tracking-widest mb-4">
          <Sparkles class="w-3 h-3" /> Discover the best extensions
        </div>
        <h1 class="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
          Supercharge your <span class="text-emerald-500">StressPilot</span>
        </h1>
        <p class="text-base text-slate-400 max-w-2xl mx-auto mb-8 leading-relaxed">
          The official marketplace for StressPilot plugins. Search, download, and integrate community-built extensions in seconds.
        </p>
        <div class="max-w-2xl mx-auto relative group">
          <div class="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur opacity-25 group-focus-within:opacity-100 transition duration-1000"></div>
          <div class="relative flex flex-col sm:flex-row gap-2">
            <div class="relative flex-1">
              <Search class="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-emerald-500 transition-colors" />
              <input
                v-model="searchQuery"
                placeholder="Search by name..."
                class="w-full bg-[#030a1c] border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500/50 transition-all shadow-xl"
              />
            </div>
            <Button @click="fetchPlugins" class="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 text-black font-bold rounded-xl shadow-xl shadow-emerald-500/20 shrink-0 text-sm">
              Search
            </Button>
          </div>
        </div>
      </div>
    </section>

    <!-- Main content -->
    <main class="flex-1 container mx-auto px-6 pb-20 z-10">
      <div class="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
        <div class="flex items-center gap-4">
          <button class="text-xs font-bold text-white border-b-2 border-emerald-500 pb-1">All Plugins</button>
        </div>
        <div class="flex items-center gap-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <Database class="w-3.5 h-3.5" />
          {{ totalItems }} Plugins found
        </div>
      </div>

      <!-- Loading -->
      <div v-if="loading && plugins.length === 0" class="flex flex-col items-center justify-center py-24 opacity-50">
        <Loader2 class="h-10 w-10 animate-spin text-emerald-500 mb-3" />
        <p class="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Fetching Extensions...</p>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        <Card
          v-for="plugin in plugins"
          :key="plugin.id"
          class="group bg-white/[0.02] border-white/5 hover:bg-white/[0.04] hover:border-emerald-500/30 transition-all duration-500 rounded-2xl overflow-hidden flex flex-col h-full"
          :class="{ 'opacity-70': isDraft(plugin) }"
        >
          <CardHeader class="p-6 pb-3">
            <div class="flex justify-between items-start mb-4">
              <div class="flex items-center gap-2">
                <div class="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:bg-emerald-500 group-hover:text-black transition-all duration-500 group-hover:scale-105">
                  <Zap v-if="plugin.downloadCount > 10" class="w-5 h-5" />
                  <ShoppingBag v-else class="w-5 h-5" />
                </div>
                <!-- Status badge -->
                <span
                  v-if="isDraft(plugin)"
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 text-amber-400"
                >
                  <AlertCircle class="w-2.5 h-2.5" /> Draft
                </span>
                <span
                  v-else
                  class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                >
                  <CheckCircle2 class="w-2.5 h-2.5" /> Live
                </span>
              </div>

              <!-- Owner actions -->
              <div v-if="isOwnerOrAdmin(plugin)" class="flex gap-1">
                <!-- Re-upload button for DRAFT -->
                <Button
                  v-if="isDraft(plugin)"
                  size="icon"
                  variant="ghost"
                  class="h-7 w-7 rounded-full hover:bg-amber-500/10 hover:text-amber-400"
                  title="Upload file"
                  @click="openUploadDialog(plugin)"
                >
                  <UploadCloud class="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" class="h-7 w-7 rounded-full hover:bg-white/10" @click="openEditDialog(plugin)">
                  <Pencil class="h-3 w-3" />
                </Button>
                <Button size="icon" variant="ghost" class="h-7 w-7 rounded-full hover:bg-white/10 hover:text-rose-400" @click="deletePlugin(plugin.id)">
                  <Trash2 class="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h3 class="text-lg font-bold text-white group-hover:text-emerald-400 transition-colors">{{ plugin.name }}</h3>
                <span v-if="plugin.latestVersion" class="text-[9px] font-black bg-white/5 px-1.5 py-0.5 rounded text-slate-500 uppercase">v{{ plugin.latestVersion }}</span>
              </div>
              <p class="text-xs text-slate-500 font-medium tracking-tight line-clamp-2 h-8">
                {{ plugin.description || 'No description provided for this extension.' }}
              </p>
              
              <!-- Tags -->
              <div v-if="plugin.tags && plugin.tags.length > 0" class="flex flex-wrap gap-1 mt-2">
                <span v-for="tag in plugin.tags" :key="tag" class="px-1.5 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/10 text-[9px] font-bold text-emerald-500/70 uppercase tracking-tighter">
                  #{{ tag }}
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent class="px-6 pb-4 flex-1 flex flex-col justify-end">
            <!-- Installation Status -->
            <div v-if="isAuthenticated" class="mb-3">
              <div v-if="plugin.installationStatus === 'INSTALLED'" class="flex items-center gap-1.5 text-emerald-400 font-bold text-[10px] uppercase tracking-widest">
                <CheckCircle2 class="w-3.5 h-3.5" /> Installed
              </div>
              <div v-else-if="plugin.installationStatus === 'UPDATABLE'" class="flex items-center gap-1.5 text-amber-400 font-bold text-[10px] uppercase tracking-widest">
                <Zap class="w-3.5 h-3.5 animate-pulse" /> Update Available
              </div>
            </div>

            <div class="flex items-center gap-3 pt-3 border-t border-white/5">
              <div class="flex items-center gap-1 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                <Download class="w-3 h-3 text-emerald-500" />
                <span class="text-[10px] font-bold text-white">{{ plugin.downloadCount }}</span>
              </div>
              <div class="flex items-center gap-3 ml-auto">
                <button @click="votePlugin(plugin.id, true)" class="flex items-center gap-1 hover:text-emerald-400 transition-colors text-slate-500 group/vote">
                  <ArrowUp class="w-3.5 h-3.5 group-hover/vote:-translate-y-0.5 transition-transform" />
                  <span class="text-[10px] font-bold">{{ plugin.upvoteCount }}</span>
                </button>
                <button @click="votePlugin(plugin.id, false)" class="flex items-center gap-1 hover:text-rose-400 transition-colors text-slate-500 group/down">
                  <ArrowDown class="w-3.5 h-3.5 group-hover/down:translate-y-0.5 transition-transform" />
                  <span class="text-[10px] font-bold">{{ plugin.downvoteCount }}</span>
                </button>
              </div>
            </div>
          </CardContent>

          <CardFooter class="bg-white/[0.02] px-6 py-4 flex items-center justify-between border-t border-white/5">
            <div class="flex items-center gap-2">
              <div class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[9px] font-bold text-emerald-500">
                {{ plugin.publisher.username.substring(0, 1).toUpperCase() }}
              </div>
              <span class="text-[10px] font-bold text-slate-400">{{ plugin.publisher.username }}</span>
            </div>

            <!-- Download only available for PUBLISHED -->
            <Button
              v-if="!isDraft(plugin)"
              @click="downloadPlugin(plugin)"
              class="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black font-black text-[10px] h-8 rounded-lg px-3 border border-emerald-500/20 hover:border-emerald-500 transition-all duration-300"
            >
              DOWNLOAD
            </Button>
            <span
              v-else
              class="text-[10px] font-bold text-amber-500/60 uppercase tracking-widest"
            >
              Not ready
            </span>
          </CardFooter>
        </Card>

        <!-- Empty state -->
        <div v-if="plugins.length === 0 && !loading" class="col-span-full py-24 text-center">
          <div class="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Info class="w-8 h-8 text-slate-600" />
          </div>
          <h3 class="text-xl font-bold text-white mb-1">No plugins found</h3>
          <p class="text-sm text-slate-500 mb-6">Try adjusting your search or be the first to release one.</p>
          <Button @click="searchQuery = ''; fetchPlugins()" variant="outline" class="rounded-xl border-white/10 text-white font-bold h-10 px-6">
            Clear Filters
          </Button>
        </div>
      </div>
    </main>

    <!-- Footer -->
    <footer class="border-t border-white/5 bg-[#010409] py-8 px-6 mt-auto">
      <div class="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        <div class="flex flex-col items-center md:items-start gap-3">
          <div class="flex items-center gap-2">
            <div class="w-6 h-6 bg-emerald-500 rounded-md flex items-center justify-center">
              <ShoppingBag class="w-4 h-4 text-black" />
            </div>
            <span class="font-bold text-white uppercase tracking-widest text-xs">StressPilot</span>
          </div>
          <p class="text-[10px] text-slate-500 font-medium">© 2026 StressPilot Marketplace. All rights reserved.</p>
        </div>
        <div class="flex items-center gap-6 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          <a href="#" class="hover:text-emerald-500 transition-colors">Privacy</a>
          <a href="#" class="hover:text-emerald-500 transition-colors">Terms</a>
          <a href="#" class="hover:text-emerald-500 transition-colors">Contact</a>
        </div>
      </div>
    </footer>

    <!-- ── Dialogs ────────────────────────────────────────────────────────── -->
    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[600px] bg-[#030a1c] border-white/10 rounded-2xl p-0 overflow-hidden shadow-2xl">
        <div class="bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-8">

          <!-- CREATE STEP -->
          <template v-if="dialogMode === 'create'">
            <DialogHeader class="mb-6">
              <DialogTitle class="text-2xl font-black text-white tracking-tight">New Extension</DialogTitle>
              <DialogDescription class="text-slate-400 text-sm font-medium mt-1">
                Register your plugin metadata. You'll upload the binary in the next step.
              </DialogDescription>
            </DialogHeader>
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-4">
                <div class="space-y-2">
                  <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Extension Slug</Label>
                  <Input v-model="createForm.code" placeholder="my-plugin" class="bg-white/5 border-white/10 rounded-xl h-11 text-sm" />
                </div>
                <div class="space-y-2">
                  <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Version</Label>
                  <Input v-model="createForm.version" placeholder="1.0.0" class="bg-white/5 border-white/10 rounded-xl h-11 text-sm" />
                </div>
              </div>
              <div class="space-y-2">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Title</Label>
                <Input v-model="createForm.name" placeholder="My Awesome Plugin" class="bg-white/5 border-white/10 rounded-xl h-11 text-sm" />
              </div>
              <div class="space-y-2">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Tags</Label>
                <div class="flex gap-2">
                  <Input v-model="tagInput" placeholder="Add a tag..." class="bg-white/5 border-white/10 rounded-xl h-11 text-sm" @keyup.enter="addTag" />
                  <Button @click="addTag" variant="outline" class="h-11 rounded-xl border-white/10 text-white font-bold px-4">Add</Button>
                </div>
                <div v-if="createForm.tags && createForm.tags.length > 0" class="flex flex-wrap gap-2 mt-2">
                  <span v-for="tag in createForm.tags" :key="tag" class="px-2 py-1 rounded bg-emerald-500/20 text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                    {{ tag }}
                    <button @click="removeTag(tag)" class="hover:text-white">&times;</button>
                  </span>
                </div>
              </div>
              <div class="space-y-2">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Description</Label>
                <textarea v-model="createForm.description" placeholder="What does this plugin do?" class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm h-24 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"></textarea>
              </div>
              <p v-if="submitError" class="text-xs text-rose-400 font-medium">{{ submitError }}</p>
            </div>
            <div class="pt-6">
              <Button :disabled="submitting" @click="submitCreate" class="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black text-base shadow-xl">
                <Loader2 v-if="submitting" class="w-4 h-4 animate-spin mr-2" />
                CREATE &amp; PROCEED TO UPLOAD
              </Button>
            </div>
          </template>

          <!-- UPLOAD STEP -->
          <template v-else-if="dialogMode === 'upload'">
            <DialogHeader class="mb-6">
              <DialogTitle class="text-2xl font-black text-white tracking-tight">Upload Binary</DialogTitle>
              <DialogDescription class="text-slate-400 text-sm font-medium mt-1">
                Select the plugin binary. After a successful upload the plugin goes live.
                If the upload fails you can retry here at any time.
              </DialogDescription>
            </DialogHeader>
            <div class="space-y-4">
              <div
                class="border-2 border-dashed border-white/10 rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 hover:border-emerald-500/30 transition-all group"
                @click="($refs.fileInput as HTMLInputElement).click()"
              >
                <UploadCloud class="w-7 h-7 text-emerald-500 mb-2 group-hover:scale-110 transition-transform" />
                <p class="text-sm font-bold text-white text-center px-4 truncate w-full text-center">
                  {{ selectedFile ? selectedFile.name : 'Click to select binary' }}
                </p>
                <p class="text-[9px] text-slate-500 mt-1 uppercase tracking-[0.1em] font-black">JAR or JS · MAX 210 MB</p>
                <input ref="fileInput" type="file" class="hidden" @change="handleFileChange" />
              </div>
              <p v-if="fileError" class="text-xs text-rose-400 font-medium">{{ fileError }}</p>
              <p v-if="submitError" class="text-xs text-rose-400 font-medium">{{ submitError }}</p>
            </div>
            <div class="pt-6 flex gap-3">
              <Button variant="outline" class="flex-1 h-12 rounded-xl border-white/10 text-white font-bold" @click="dialogMode = null">
                Later
              </Button>
              <Button
                :disabled="submitting || !selectedFile"
                @click="submitUpload"
                class="flex-1 h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black text-base shadow-xl disabled:opacity-50"
              >
                <Loader2 v-if="submitting" class="w-4 h-4 animate-spin mr-2" />
                UPLOAD &amp; PUBLISH
              </Button>
            </div>
          </template>

          <!-- EDIT STEP -->
          <template v-else-if="dialogMode === 'edit'">
            <DialogHeader class="mb-6">
              <DialogTitle class="text-2xl font-black text-white tracking-tight">Edit Metadata</DialogTitle>
              <DialogDescription class="text-slate-400 text-sm font-medium mt-1">
                Update the plugin name or description. Code and version are immutable.
              </DialogDescription>
            </DialogHeader>
            <div class="space-y-4">
              <div class="space-y-2">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Title</Label>
                <Input v-model="editForm.name" class="bg-white/5 border-white/10 rounded-xl h-11 text-sm" />
              </div>
              <div class="space-y-2">
                <Label class="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-500/70 ml-1">Description</Label>
                <textarea v-model="editForm.description" class="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm h-28 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"></textarea>
              </div>
              <p v-if="submitError" class="text-xs text-rose-400 font-medium">{{ submitError }}</p>
            </div>
            <div class="pt-6">
              <Button :disabled="submitting" @click="submitEdit" class="w-full h-12 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black font-black text-base shadow-xl">
                <Loader2 v-if="submitting" class="w-4 h-4 animate-spin mr-2" />
                UPDATE
              </Button>
            </div>
          </template>

        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style>
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
