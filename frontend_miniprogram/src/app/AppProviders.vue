<script setup lang="ts">
import type { VisualEffectsMode } from '@/platform/contracts/visual-effects'
import { useConfigProvider } from '@wot-ui/ui/composables/useConfigProvider'
import { computed, ref } from 'vue'
import { platform } from '@/platform'
import { appThemeVars } from '@/style/theme'

useConfigProvider({ themeVars: appThemeVars })

const visualEffectsMode = ref<VisualEffectsMode>('reduced')
const providerClass = computed(() => `app-provider app-provider--visual-effects-${visualEffectsMode.value}`)

void platform.visualEffects.getMode().then((mode) => {
  visualEffectsMode.value = mode
}).catch(() => {
  visualEffectsMode.value = 'reduced'
})
</script>

<template>
  <wd-config-provider theme="light" :theme-vars="appThemeVars" :custom-class="providerClass">
    <slot />
    <wd-toast selector="app-global-toast" />
  </wd-config-provider>
</template>
