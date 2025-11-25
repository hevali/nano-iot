<script setup lang="ts">
import { type DeviceDto } from '@nano-iot/common';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Menu, { type MenuMethods } from 'primevue/menu';
import type { MenuItem } from 'primevue/menuitem';
import { ref } from 'vue';

const deviceId = ref<string>();

const props = defineProps<{ devices: DeviceDto[] }>();
const emit = defineEmits<{ delete: [id: string] }>();

const deviceMenu = ref<MenuMethods>();
const deviceMenuItems = ref<MenuItem[]>([
  {
    label: 'Edit',
    icon: 'pi pi-pencil',
  },
  {
    label: 'Delete',
    icon: 'pi pi-trash',
    class: 'menu-danger',
    command: async () => {
      if (deviceId.value) {
        emit('delete', deviceId.value);
        deviceId.value = undefined;
      }
    },
  },
]);

const toggleMenu = (event: PointerEvent, id: string) => {
  deviceMenu.value?.toggle(event);
  deviceId.value = id;
};
</script>

<template>
  <DataTable :value="props.devices" table-style="min-width: 50rem">
    <Column field="id" header="ID" />
    <Column field="createdAt" header="Created at" />
    <Column>
      <template #body="slotProps">
        <Button
          type="button"
          icon="pi pi-ellipsis-v"
          severity="contrast"
          variant="text"
          rounded
          aria-haspopup="true"
          aria-controls="overlay_menu"
          @click="(ev) => toggleMenu(ev, slotProps.data.id)"
        />
        <Menu id="overlay_menu" ref="deviceMenu" :model="deviceMenuItems" :popup="true" />
      </template>
    </Column>
  </DataTable>
</template>

<style lang="css">
.menu-danger .p-menu-item-label {
  color: var(--p-red-500);
}
.menu-danger .p-menu-item-icon.pi {
  color: var(--p-red-500);
}
.menu-danger .p-menu-item-content:hover {
  .p-menu-item-label {
    color: var(--p-red-600) !important;
  }
}
.menu-danger .p-menu-item-content:hover {
  .p-menu-item-icon.pi {
    color: var(--p-red-600) !important;
  }
}
</style>
