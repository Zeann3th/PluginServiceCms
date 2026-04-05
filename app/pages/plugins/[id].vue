<script setup lang="ts">
import {
  ArrowLeft, Search, Pencil, Trash2, Loader2, UploadCloud,
  ArrowUp, ArrowDown, Download, Database, Info, ShoppingBag,
  Zap, Sparkles, AlertCircle, CheckCircle2, Clock, Shield,
  Tag as TagIcon, Box, Activity, ChevronRight, MoreVertical,
  Plus, History, Terminal, Copy, FileCode, ExternalLink, Globe, Sun, Moon,
  HardDrive, FolderSync, RefreshCw, LogOut, Github
} from 'lucide-vue-next'
import type {
  Plugin, PluginResponse, CreatePluginRequest, UploadPluginRequest,
  ApiResponse, PaginatedResponse, CreatePluginResponse, UploadPluginResponse,
  PluginVersion
} from '@/types'

const route = useRoute()
const config = useRuntimeConfig()
const pluginId = parseInt(route.params.id as string)
const { user, token, fetchProfile, logout, isAuthenticated } = useAuth()
const $api = useApi()
const colorMode = useColorMode()

const toggleTheme = () => {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}

const plugin = ref<Plugin | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

// ── Version management ──────────────────────────────────────────────────────
const uploadingVersion = ref<string | null>(null)
const selectedFile = ref<File | null>(null)
const fileError = ref('')
const submitting = ref(false)
const submitError = ref('')

const fetchPlugin = async () => {
  loading.value = true
  try {
    const response = await $api<ApiResponse<PluginResponse>>(`/api/v1/plugins/${pluginId}`)
    if (response?.data) {
      const p = response.data
      plugin.value = {
        id: p.id,
        code: p.code,
        name: p.name,
        description: p.description || '',
        githubRepo: p.github_repo,
        status: p.status,
        publisher: p.publisher,
        upvoteCount: p.upvote_count,
        downvoteCount: p.downvote_count,
        tags: p.tags,
        latestVersion: p.latest_version,
        installationStatus: p.installation_status,
        versions: p.versions || [],
        createdAt: p.created_at,
        updatedAt: p.updated_at
      }
    }
  } catch (e: any) {
    error.value = e?.data?.message || e?.message || 'Failed to fetch plugin'
  } finally {
    loading.value = false
  }
}

const isOwnerOrAdmin = computed(() =>
  isAuthenticated.value && plugin.value && (user.value?.id === plugin.value.publisher.id || user.value?.role === 'Admin')
)

const handleFileChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    if (file.size > 210 * 1024 * 1024) {
      fileError.value = 'File size exceeds 210MB limit'
      selectedFile.value = null
    } else {
      fileError.value = ''
      selectedFile.value = file
    }
  }
}

const uploadVersionFile = async (version: string) => {
  if (!selectedFile.value) return
  submitting.value = true
  submitError.value = ''

  try {
    const uploadRes = await $api<ApiResponse<UploadPluginResponse>>(`/api/v1/plugins/${pluginId}/versions/${version}/upload`, {
      method: 'POST',
      body: {
        filename: selectedFile.value.name,
        file_size: selectedFile.value.size
      }
    })

    if (!uploadRes.data?.upload_url) throw new Error('Failed to generate upload URL')

    const s3Res = await fetch(uploadRes.data.upload_url, {
      method: 'PUT',
      body: selectedFile.value,
      headers: { 'Content-Type': selectedFile.value.type || 'application/octet-stream' }
    })
    if (!s3Res.ok) throw new Error(`S3 upload failed: ${s3Res.status}`)

    alert('File uploaded successfully. You can now publish this version.')
    
    uploadingVersion.value = null
    selectedFile.value = null
    await fetchPlugin()
  } catch (e: any) {
    submitError.value = e?.data?.message || e?.message || 'Upload failed'
  } finally {
    submitting.value = false
  }
}

const updateVersionStatus = async (version: string, status: 'DRAFTED' | 'PUBLISHED') => {
  try {
    await $api(`/api/v1/plugins/${pluginId}/versions/${version}`, {
      method: 'PATCH',
      body: { status }
    })
    await fetchPlugin()
  } catch (e: any) {
    alert(e?.data?.message || 'Update failed')
  }
}

const updatePluginStatus = async (status: 'DRAFTED' | 'PUBLISHED') => {
  try {
    await $api(`/api/v1/plugins/${pluginId}`, {
      method: 'PATCH',
      body: { status }
    })
    await fetchPlugin()
  } catch (e: any) {
    alert(e?.data?.message || 'Update failed')
  }
}

const deleteVersion = async (version: string) => {
  if (!confirm(`Delete version ${version}? This cannot be undone.`)) return
  try {
    await $api(`/api/v1/plugins/${pluginId}/versions/${version}`, {
      method: 'DELETE'
    })
    await fetchPlugin()
  } catch (e: any) {
    alert(e?.data?.message || 'Delete failed')
  }
}

const downloadPlugin = (version?: string) => {
  if (!plugin.value) return
  const v = version || plugin.value.latestVersion
  if (!v) {
    alert('No version available for download')
    return
  }
  
  // Construct direct CDN URL: {S3_PUBLIC_ENDPOINT}/plugins/{code}/{version}/{code}-{version}.jar
  const directUrl = `${config.public.s3PublicEndpoint}/plugins/${plugin.value.code}/${v}/${plugin.value.code}-${v}.jar`
  window.open(directUrl, '_blank')
}

const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

onMounted(async () => {
  if (token.value) await fetchProfile()
  await fetchPlugin()
})
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans flex flex-col transition-colors duration-300 antialiased selection:bg-primary/30 selection:text-primary-foreground">
    <!-- Background blobs -->
    <div class="fixed inset-0 pointer-events-none z-0 overflow-hidden opacity-40">
      <div class="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/5 dark:bg-primary/5 rounded-full blur-[120px] animate-pulse-slow"></div>
      <div class="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary/5 dark:bg-primary/5 rounded-full blur-[120px] animate-pulse-slow" style="animation-delay: 2s"></div>
    </div>

    <!-- Header Island -->
    <div class="sticky top-4 z-50 w-full px-6">
      <header class="container mx-auto h-16 border border-border bg-surface/80 backdrop-blur-xl rounded-2xl shadow-island flex items-center justify-between px-6 transition-all duration-300">
        <div class="flex items-center gap-4">
          <NuxtLink to="/" class="p-2.5 rounded-xl hover:bg-elevated transition-colors border border-transparent hover:border-border group">
            <ArrowLeft class="w-5 h-5 text-secondary group-hover:text-foreground group-hover:-translate-x-0.5 transition-all" />
          </NuxtLink>
          <div class="h-6 w-px bg-border"></div>
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

          <div v-if="isOwnerOrAdmin && plugin" class="flex items-center gap-3 bg-elevated/50 p-1 border border-border rounded-xl">
            <button 
              @click="updatePluginStatus('DRAFTED')"
              class="px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest"
              :class="plugin.status === 'DRAFTED' ? 'bg-amber-500/10 text-amber-500 shadow-sm' : 'text-secondary hover:text-foreground'"
            >
              Drafted
            </button>
            <button 
              @click="updatePluginStatus('PUBLISHED')"
              class="px-4 py-1.5 text-[10px] font-black rounded-lg transition-all uppercase tracking-widest"
              :class="plugin.status === 'PUBLISHED' ? 'bg-primary/10 text-primary shadow-sm' : 'text-secondary hover:text-foreground'"
            >
              Published
            </button>
          </div>

          <div v-if="isAuthenticated && user" class="flex items-center gap-3 ml-2">
            <button @click="logout" class="w-10 h-10 rounded-xl border border-border flex items-center justify-center hover:bg-destructive/10 hover:border-destructive/20 transition-all group">
              <LogOut class="w-4 h-4 text-secondary group-hover:text-destructive" />
            </button>
          </div>
        </div>
      </header>
    </div>

    <main class="flex-1 container mx-auto px-6 py-12 z-10">
      <div v-if="loading" class="flex flex-col items-center justify-center py-32 gap-6">
        <Loader2 class="w-12 h-12 text-primary animate-spin" />
        <p class="text-secondary font-black text-xs uppercase tracking-[0.4em]">Establish Handshake...</p>
      </div>

      <div v-else-if="error" class="max-w-2xl mx-auto py-32 text-center bg-surface border border-border rounded-[2.5rem] shadow-island">
        <AlertCircle class="w-16 h-16 text-destructive/50 mx-auto mb-8" />
        <h2 class="text-2xl font-black mb-3 text-foreground uppercase tracking-tight">Artifact Absent</h2>
        <NuxtLink to="/">
          <button class="rounded-2xl border border-border hover:bg-foreground hover:text-background uppercase text-xs font-black tracking-widest px-10 py-4 transition-all shadow-island">Return to Marketplace</button>
        </NuxtLink>
      </div>

      <div v-else-if="plugin" class="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 pt-8">
        <!-- Main Content -->
        <div class="lg:col-span-8 space-y-10">
          <!-- Info Island -->
          <div class="bg-surface/40 backdrop-blur-xl border border-border p-10 md:p-14 rounded-[3rem] shadow-island relative overflow-hidden group">
            <div class="relative space-y-8">
              <div class="space-y-4">
                <div class="flex items-center gap-3">
                  <span class="px-3 py-1 bg-primary/5 text-primary border border-primary/10 text-[10px] font-black uppercase tracking-widest rounded-full">STRESSPILOT-ARTIFACT</span>
                  <span v-if="plugin.githubRepo" class="px-3 py-1 bg-elevated text-secondary border border-border text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-2">
                    <Github class="w-3 h-3" /> Source Available
                  </span>
                </div>
                <h1 class="text-5xl md:text-6xl font-bold text-foreground tracking-tighter leading-none uppercase">{{ plugin.name }}</h1>
                <div class="flex flex-wrap gap-2 pt-2">
                  <span v-for="tag in plugin.tags" :key="tag" class="px-4 py-1.5 bg-elevated/50 border border-border text-[10px] font-black text-secondary uppercase tracking-widest rounded-xl">#{{ tag }}</span>
                </div>
              </div>
              <p v-if="plugin.description" class="text-secondary leading-relaxed text-xl font-medium max-w-3xl">{{ plugin.description }}</p>
            </div>
          </div>

          <!-- Installation Guide -->
          <div class="bg-surface border border-border rounded-[2.5rem] p-10 md:p-12 shadow-island space-y-10">
            <div class="flex items-center gap-4 border-b border-border pb-6">
              <div class="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center">
                <Terminal class="w-5 h-5 text-primary" />
              </div>
              <h3 class="text-lg font-black text-foreground uppercase tracking-widest">Deployment</h3>
            </div>
            <div class="grid gap-10">
              <div class="flex gap-8 group/step">
                <div class="w-12 h-12 bg-elevated border border-border rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover/step:border-primary/30 transition-colors">
                  <Download class="w-6 h-6 text-secondary group-hover/step:text-primary transition-colors" />
                </div>
                <div class="space-y-2">
                  <h4 class="text-sm font-black text-foreground uppercase tracking-widest leading-none">01. Retrieve</h4>
                  <p class="text-sm text-secondary font-medium">Acquire the <code class="bg-elevated px-2 py-0.5 rounded border border-border text-primary font-bold">.jar</code> artifact via the index.</p>
                </div>
              </div>
              <div class="flex gap-8 group/step">
                <div class="w-12 h-12 bg-elevated border border-border rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover/step:border-primary/30 transition-colors">
                  <FolderSync class="w-6 h-6 text-secondary group-hover/step:text-primary transition-colors" />
                </div>
                <div class="space-y-3 flex-1">
                  <h4 class="text-sm font-black text-foreground uppercase tracking-widest leading-none">02. Map</h4>
                  <p class="text-sm text-secondary font-medium">Relocate binary to StressPilot distribution path:</p>
                  <div class="bg-elevated p-4 rounded-xl border border-border font-mono text-xs text-foreground shadow-inner flex items-center justify-between group/code">
                    <span>~/.pilot/core/plugins/</span>
                    <button @click="navigator.clipboard.writeText('~/.pilot/core/plugins/')" class="p-2 opacity-0 group-hover/code:opacity-100 transition-opacity hover:text-primary">
                      <Copy class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div class="flex gap-8 group/step">
                <div class="w-12 h-12 bg-elevated border border-border rounded-2xl flex items-center justify-center shrink-0 shadow-inner group-hover/step:border-primary/30 transition-colors">
                  <RefreshCw class="w-6 h-6 text-secondary group-hover/step:text-primary transition-colors" />
                </div>
                <div class="space-y-2">
                  <h4 class="text-sm font-black text-foreground uppercase tracking-widest leading-none">03. Reload</h4>
                  <p class="text-sm text-secondary font-medium">Execute <span class="text-foreground font-black italic">Settings &gt; Reload Plugins</span>.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Version Index -->
          <div class="bg-surface border border-border rounded-[2.5rem] p-10 md:p-12 shadow-island space-y-8">
            <div class="flex items-center justify-between border-b border-border pb-6">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 bg-primary/5 rounded-xl flex items-center justify-center">
                  <History class="w-5 h-5 text-primary" />
                </div>
                <h3 class="text-lg font-black text-foreground uppercase tracking-widest">Binary Index</h3>
              </div>
              <span class="px-4 py-1.5 bg-elevated rounded-full text-[10px] font-black text-secondary uppercase tracking-widest border border-border">{{ plugin.versions?.length || 0 }} Entries</span>
            </div>
            <div class="grid gap-4">
              <div v-for="v in plugin.versions" :key="v.version" class="bg-surface border border-border p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6 rounded-3xl group/v hover:shadow-island-hover transition-all duration-500">
                <div class="flex items-center gap-6">
                  <div class="w-14 h-14 bg-elevated border border-border rounded-2xl flex items-center justify-center font-black text-base text-primary shadow-inner">v{{ v.version.substring(0, 1) }}</div>
                  <div class="space-y-1">
                    <div class="flex items-center gap-3">
                      <span class="font-bold text-lg text-foreground tracking-tight">Release {{ v.version }}</span>
                      <span class="px-3 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm" :class="v.status === 'PUBLISHED' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'">{{ v.status === 'DRAFTED' ? 'Draft' : 'Public' }}</span>
                    </div>
                    <p class="text-[10px] font-bold text-secondary uppercase tracking-[0.2em]">Commit {{ formatDate(v.created_at) }}</p>
                  </div>
                </div>
                <div class="flex items-center gap-3 self-end md:self-center">
                  <template v-if="isOwnerOrAdmin">
                    <div v-if="uploadingVersion === v.version" class="flex gap-2 items-center bg-elevated p-1.5 border border-border rounded-2xl shadow-inner">
                      <input type="file" @change="handleFileChange" class="hidden" :id="'file-' + v.version" />
                      <label :for="'file-' + v.version" class="px-4 py-2 text-[10px] font-black uppercase cursor-pointer hover:text-primary truncate max-w-[120px]">Attach</label>
                      <button :disabled="!selectedFile || submitting" @click="uploadVersionFile(v.version)" class="p-2.5 bg-primary text-primary-foreground rounded-xl shadow-glow"><CheckCircle2 class="w-4 h-4" /></button>
                      <button @click="uploadingVersion = null; selectedFile = null" class="p-2.5 text-secondary hover:text-foreground"><Trash2 class="w-4 h-4" /></button>
                    </div>
                    <template v-else>
                      <button @click="uploadingVersion = v.version" class="px-5 py-2.5 border border-border text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-elevated transition-colors">Replace</button>
                      <button @click="updateVersionStatus(v.version, v.status === 'PUBLISHED' ? 'DRAFTED' : 'PUBLISHED')" class="px-5 py-2.5 border border-border text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-elevated transition-colors">Status</button>
                      <button @click="deleteVersion(v.version)" class="p-3 text-secondary hover:text-destructive transition-colors"><Trash2 class="w-4 h-4" /></button>
                    </template>
                  </template>
                  <button v-if="v.status === 'PUBLISHED'" @click="downloadPlugin(v.version)" class="px-8 py-3 bg-foreground text-background dark:bg-white dark:text-black text-xs font-black uppercase tracking-[0.2em] rounded-2xl hover:bg-primary hover:text-white transition-all shadow-island">GET_JAR</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="lg:col-span-4 space-y-8">
          <div class="bg-surface border border-border p-10 rounded-[3rem] space-y-10 shadow-island">
            <h3 class="text-[11px] font-black text-secondary uppercase tracking-[0.4em] border-b border-border pb-4 text-center">Repository</h3>
            <div class="grid grid-cols-2 gap-8 text-center">
              <div class="space-y-2">
                <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Upvotes</p>
                <div class="flex items-center justify-center gap-3"><ArrowUp class="w-5 h-5 text-primary" /><span class="text-3xl font-black text-foreground">{{ plugin.upvoteCount }}</span></div>
              </div>
              <div class="space-y-2">
                <p class="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Pulls</p>
                <div class="flex items-center justify-center gap-3"><Download class="w-5 h-5 text-secondary" /><span class="text-3xl font-black text-foreground">{{ plugin.versions?.reduce((acc, v) => acc + v.download_count, 0) || 0 }}</span></div>
              </div>
            </div>
            <div class="space-y-6 pt-6 border-t border-border">
              <div class="flex items-center justify-between"><span class="text-[10px] text-secondary font-black uppercase tracking-widest">Handle</span><span class="text-foreground font-bold text-xs">{{ plugin.publisher.username }}</span></div>
              <div class="flex items-center justify-between"><span class="text-[10px] text-secondary font-black uppercase tracking-widest">Pushed</span><span class="text-foreground font-bold text-xs">{{ formatDate(plugin.createdAt) }}</span></div>
            </div>
            <button @click="downloadPlugin()" v-if="plugin.latestVersion" class="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-black uppercase tracking-[0.3em] h-16 rounded-[1.5rem] shadow-glow active:scale-[0.98] transition-all">PULL_LATEST</button>
          </div>

          <div class="bg-surface border border-border p-10 rounded-[3rem] space-y-6 shadow-island">
            <h3 class="text-[11px] font-black text-secondary uppercase tracking-[0.4em] border-b border-border pb-4 text-center">Resources</h3>
            <div class="space-y-2">
              <a v-if="plugin.githubRepo" :href="plugin.githubRepo" target="_blank" class="flex items-center gap-4 text-[11px] font-black text-secondary hover:text-primary transition-all p-4 bg-elevated/50 rounded-2xl border border-border group">
                <Github class="w-5 h-5" /> Artifact Source <ExternalLink class="w-3.5 h-3.5 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <div v-else class="p-6 text-center text-[10px] text-zinc-500 font-bold uppercase tracking-widest italic opacity-50">Null Resources</div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700&family=IBM+Plex+Sans:wght@400;500;600;700;900&display=swap');
code, pre { font-family: 'JetBrains Mono', monospace !important; }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { @apply bg-muted-foreground/20 rounded-full; }
::-webkit-scrollbar-thumb:hover { @apply bg-primary/50; }
.shadow-island { box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.3); }
.dark .shadow-island { box-shadow: 0 10px 40px -10px rgba(0, 0, 0, 0.7); }
.shadow-glow { box-shadow: 0 0 20px -5px hsla(var(--primary) / 0.4); }
.animate-pulse-slow { animation: pulse 8s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.1; } 50% { opacity: 0.3; } }
</style>