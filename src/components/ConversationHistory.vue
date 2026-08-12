<script setup lang="ts">
import type { AssistantConversation } from '../storage/assistantConversationRepository'

defineProps<{ conversations: AssistantConversation[]; activeId: string }>()
const emit = defineEmits<{ select: [id: string]; create: []; remove: [id: string] }>()
</script>

<template>
  <div class="conversation-history">
    <label><span class="sr-only">对话历史</span>
      <select :value="activeId" aria-label="对话历史" @change="emit('select', ($event.target as HTMLSelectElement).value)">
        <option v-for="conversation in conversations" :key="conversation.id" :value="conversation.id">{{ conversation.title }}</option>
      </select>
    </label>
    <button type="button" aria-label="新建对话" title="新建对话" @click="emit('create')">＋</button>
    <button v-if="conversations.length > 1" type="button" aria-label="删除当前对话" title="删除当前对话" @click="emit('remove', activeId)">×</button>
  </div>
</template>
