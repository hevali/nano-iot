<script setup lang="ts">
import Menubar from 'primevue/menubar';
import type { MenuItem } from 'primevue/menuitem';
import { RouterView } from 'vue-router';
import { ref } from 'vue';

const items = ref<MenuItem[]>([
  {
    label: 'Home',
    icon: 'pi pi-home',
    route: '/',
  },
  {
    label: 'About',
    icon: 'pi pi-info-circle',
    route: '/about',
  },
]);

const redirectTo = new URL(
  (import.meta.env.BASE_URL + '/login').replace('//', '/'),
  location.origin
).pathname;
const logoutUrl = `/api/auth/logout?redirectTo=${encodeURIComponent(redirectTo)}`;
</script>

<template>
  <Menubar :model="items">
    <template #item="{ item, props, hasSubmenu }">
      <router-link v-if="item.route" v-slot="{ href, navigate }" :to="item.route" custom>
        <a v-ripple :href="href" v-bind="props.action" @click="navigate">
          <span :class="item.icon" />
          <span>{{ item.label }}</span>
        </a>
      </router-link>
      <a v-else v-ripple :href="item.url" :target="item.target" v-bind="props.action">
        <span :class="item.icon" />
        <span>{{ item.label }}</span>
        <span v-if="hasSubmenu" class="pi pi-fw pi-angle-down" />
      </a>
    </template>
    <template #end>
      <div class="flex items-center gap-2">
        <a v-ripple :href="logoutUrl">
          <span class="pi pi-sign-out" />
        </a>
      </div>
    </template>
  </Menubar>
  <RouterView />
</template>

<style scoped lang="css"></style>
