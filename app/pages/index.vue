<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Search, Pencil, Trash2, Loader2, UploadCloud } from 'lucide-vue-next'
import { type Plugin, PluginType, type PluginRequest, type PluginUpdate } from '@/types/plugin'

const config = useRuntimeConfig()
const apiBase = config.public.apiBase

const plugins = ref<Plugin[]>([])
const loading = ref(false)
const searchQuery = ref('')
const selectedType = ref<PluginType | 'ALL'>('ALL')

const isDialogOpen = ref(false)
const isEditMode = ref(false)
const currentPluginId = ref<number | null>(null)
const formData = ref<PluginRequest>({
  name: '',
  version: '1.0.0',
  description: '',
  type: PluginType.JS,
  filename: '',
  tags: []
})
const tagsInput = ref('')
const selectedFile = ref<File | null>(null)
const uploading = ref(false)

const fetchPlugins = async () => {
  loading.value = true
  try {
    const params: Record<string, string> = {}
    if (searchQuery.value) params.name = searchQuery.value
    if (selectedType.value !== 'ALL') params.type = selectedType.value
    
    const { data } = await useFetch<any>(apiBase, { params })
    if (data.value && data.value.data) {
      plugins.value = data.value.data
    }
  } catch (error) {
    console.error('Failed to fetch plugins:', error)
  } finally {
    loading.value = false
  }
}

const openAddDialog = () => {
  isEditMode.value = false
  currentPluginId.value = null
  formData.value = {
    name: '',
    version: '1.0.0',
    description: '',
    type: PluginType.JS,
    filename: '',
    tags: []
  }
  tagsInput.value = ''
  selectedFile.value = null
  isDialogOpen.value = true
}

const openEditDialog = (plugin: Plugin) => {
  isEditMode.value = true
  currentPluginId.value = plugin.id
  formData.value = {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    type: plugin.type,
    filename: '', // Not used for update
    tags: [...plugin.tags]
  }
  tagsInput.value = plugin.tags.join(', ')
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
  formData.value.tags = tagsInput.value.split(',').map(t => t.trim()).filter(t => t)
  
  if (isEditMode.value) {
    await updatePlugin()
  } else {
    await registerPlugin()
  }
}

const registerPlugin = async () => {
  if (!selectedFile.value) return
  uploading.value = true
  try {
    // 1. Register and get presign URL
    const { data: regResult, error: regError } = await useFetch<any>(`${apiBase}/register`, {
      method: 'POST',
      body: formData.value
    })

    if (regError.value) throw regError.value

    const { uploadUrl, formData: s3FormData } = regResult.value.data
    
    // 2. Upload to S3 (presigned URL)
    const uploadFormData = new FormData()
    if (s3FormData) {
      Object.entries(s3FormData).forEach(([key, value]) => {
        uploadFormData.append(key, value as string)
      })
    }
    uploadFormData.append('file', selectedFile.value)

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: uploadFormData
    })

    if (!uploadRes.ok) throw new Error('Upload failed')

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
    const updateBody: PluginUpdate = {
      name: formData.value.name,
      version: formData.value.version,
      description: formData.value.description,
      type: formData.value.type,
      tags: formData.value.tags
    }

    const { error } = await useFetch(`${apiBase}/${currentPluginId.value}`, {
      method: 'PUT',
      body: updateBody
    })

    if (error.value) throw error.value

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
    const { error } = await useFetch(`${apiBase}/${id}`, {
      method: 'DELETE'
    })
    if (error.value) throw error.value
    await fetchPlugins()
  } catch (error) {
    console.error('Delete failed:', error)
  }
}

onMounted(() => {
  fetchPlugins()
})
</script>

<template>
  <div class="container mx-auto py-10">
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Plugin CMS</h1>
        <p class="text-muted-foreground">Manage your StressPilot plugins and their metadata.</p>
      </div>
      <Button @click="openAddDialog">
        <Plus class="mr-2 h-4 w-4" /> Add Plugin
      </Button>
    </div>

    <Card class="mb-8">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardContent>
        <div class="flex gap-4">
          <div class="relative flex-1">
            <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              v-model="searchQuery"
              placeholder="Search plugins by name..."
              class="pl-8"
              @input="fetchPlugins"
            />
          </div>
          <Select v-model="selectedType" @update:model-value="fetchPlugins">
            <SelectTrigger class="w-[180px]">
              <SelectValue placeholder="All Types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Types</SelectItem>
              <SelectItem v-for="type in Object.values(PluginType)" :key="type" :value="type">
                {{ type }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>

    <div v-if="loading" class="flex justify-center py-20">
      <Loader2 class="h-8 w-8 animate-spin text-primary" />
    </div>

    <div v-else class="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Owner</TableHead>
            <TableHead>Tags</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="plugin in plugins" :key="plugin.id">
            <TableCell class="font-medium">
              <div>{{ plugin.name }}</div>
              <div class="text-xs text-muted-foreground line-clamp-1">{{ plugin.description }}</div>
            </TableCell>
            <TableCell>
              <Badge variant="secondary">{{ plugin.type }}</Badge>
            </TableCell>
            <TableCell>{{ plugin.version }}</TableCell>
            <TableCell class="font-mono text-xs">{{ plugin.ownerSub.substring(0, 8) }}...</TableCell>
            <TableCell>
              <div class="flex flex-wrap gap-1">
                <Badge v-for="tag in plugin.tags" :key="tag" variant="outline" class="text-[10px] px-1.5 py-0">{{ tag }}</Badge>
              </div>
            </TableCell>
            <TableCell class="text-right">
              <div class="flex justify-end gap-2">
                <Button variant="ghost" size="icon" @click="openEditDialog(plugin)">
                  <Pencil class="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" @click="deletePlugin(plugin.id)">
                  <Trash2 class="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="plugins.length === 0">
            <TableCell colspan="6" class="h-24 text-center text-muted-foreground">
              No plugins found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Add/Edit Dialog -->
    <Dialog v-model:open="isDialogOpen">
      <DialogContent class="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{{ isEditMode ? 'Edit Plugin' : 'Register New Plugin' }}</DialogTitle>
          <DialogDescription>
            Enter the metadata for your plugin. {{ !isEditMode ? 'You will also need to upload the plugin file.' : '' }}
          </DialogDescription>
        </DialogHeader>
        <div class="grid gap-4 py-4">
          <div class="grid gap-2">
            <Label for="name">Name</Label>
            <Input id="name" v-model="formData.name" placeholder="My Plugin" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div class="grid gap-2">
              <Label for="version">Version</Label>
              <Input id="version" v-model="formData.version" placeholder="1.0.0" />
            </div>
            <div class="grid gap-2">
              <Label for="type">Type</Label>
              <Select v-model="formData.type">
                <SelectTrigger id="type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="type in Object.values(PluginType)" :key="type" :value="type">
                    {{ type }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div class="grid gap-2">
            <Label for="description">Description</Label>
            <Input id="description" v-model="formData.description" placeholder="Short description..." />
          </div>
          <div class="grid gap-2">
            <Label for="tags">Tags (comma separated)</Label>
            <Input id="tags" v-model="tagsInput" placeholder="automation, web, test" />
          </div>
          <div v-if="!isEditMode" class="grid gap-2">
            <Label for="file">Plugin File</Label>
            <div
              class="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition-colors"
              @click="$refs.fileInput.click()"
            >
              <UploadCloud class="h-10 w-10 text-muted-foreground mb-2" />
              <p class="text-sm font-medium">{{ selectedFile ? selectedFile.name : 'Click to select file' }}</p>
              <p class="text-xs text-muted-foreground mt-1">Upload the .jar or .js file</p>
              <input ref="fileInput" type="file" class="hidden" @change="handleFileChange" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="submit" :disabled="uploading" @click="handleSubmit">
            <template v-if="uploading">
              <Loader2 class="mr-2 h-4 w-4 animate-spin" /> {{ isEditMode ? 'Updating...' : 'Uploading...' }}
            </template>
            <template v-else>
              {{ isEditMode ? 'Update Plugin' : 'Register Plugin' }}
            </template>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
