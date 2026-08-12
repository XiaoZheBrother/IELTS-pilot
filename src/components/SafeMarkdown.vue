<script setup lang="ts">
import { computed } from 'vue'
import { parseSafeMarkdown, type SafeMarkdownSpan } from '../domain/safeMarkdown'

const props = defineProps<{ content: string }>()
const blocks = computed(() => parseSafeMarkdown(props.content))
function spanTag(span: SafeMarkdownSpan): string {
  if (span.type === 'strong') return 'strong'
  if (span.type === 'emphasis') return 'em'
  if (span.type === 'code') return 'code'
  if (span.type === 'link') return 'a'
  return 'span'
}
</script>

<template>
  <div class="safe-markdown">
    <template v-for="(block, blockIndex) in blocks" :key="blockIndex">
      <component :is="`h${Math.min(4, (block.level ?? 1) + 2)}`" v-if="block.type === 'heading'">
        <component v-for="(span, index) in block.spans" :key="index" :is="spanTag(span)" :href="span.href" :rel="span.href ? 'noreferrer' : undefined">{{ span.text }}</component>
      </component>
      <p v-else-if="block.type === 'paragraph'">
        <component v-for="(span, index) in block.spans" :key="index" :is="spanTag(span)" :href="span.href" :rel="span.href ? 'noreferrer' : undefined">{{ span.text }}</component>
      </p>
      <component :is="block.ordered ? 'ol' : 'ul'" v-else-if="block.type === 'list'">
        <li v-for="(item, itemIndex) in block.items" :key="itemIndex">
          <component v-for="(span, index) in item" :key="index" :is="spanTag(span)" :href="span.href" :rel="span.href ? 'noreferrer' : undefined">{{ span.text }}</component>
        </li>
      </component>
      <pre v-else><code>{{ block.text }}</code></pre>
    </template>
  </div>
</template>
