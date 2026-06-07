<script setup lang="ts">
import type { ProfileHeroModel, ProfileSectionKey, ProfileStatusCard } from './profile-dashboard';

import ProfileAnchorNav from './components/profile-anchor-nav.vue';
import ProfileHero from './components/profile-hero.vue';
import ProfileStatusCards from './components/profile-status-cards.vue';

defineProps<{
  cards: ProfileStatusCard[];
  hero: ProfileHeroModel;
  loading?: boolean;
}>();

const emit = defineEmits<{
  openSection: [section: ProfileSectionKey];
}>();
</script>

<template>
  <div class="flex flex-col gap-6">
    <ProfileHero :loading="loading" :model="hero" @open-section="(section) => emit('openSection', section)" />
    <ProfileStatusCards :cards="cards" @open-section="(section) => emit('openSection', section)" />
    <ProfileAnchorNav @open-section="(section) => emit('openSection', section)" />
  </div>
</template>
