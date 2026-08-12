<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ value: string }>()
const groups = computed(() => props.value.split(':'))
</script>

<template>
  <code class="publisher-fingerprint" :aria-label="`发布者密钥指纹 ${value}`"><span v-for="(group, index) in groups" :key="index">{{ group }}{{ index < groups.length - 1 ? ':' : '' }}</span></code>
</template>
