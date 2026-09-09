<script setup lang="ts">
import { useConfigProvider } from '@wot-ui/ui/composables/useConfigProvider'
import { appThemeVars } from '@/shared/theme'

useConfigProvider({ themeVars: appThemeVars })
</script>

<template>
  <wd-config-provider theme="light" :theme-vars="appThemeVars" custom-class="app-provider">
    <slot />
    <wd-toast selector="app-global-toast" />
  </wd-config-provider>
</template>
