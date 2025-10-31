<script setup lang="ts">
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { CreateDeviceDtoSchema, DeviceWithCredentialsDto, type DeviceDto } from '@nano-iot/common';
import { ref, onMounted } from 'vue';
import { api } from '../services/api';
import { useToast } from 'primevue/usetoast';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import { Form, FormField, type FormEmitsOptions } from '@primevue/forms';
import Message from 'primevue/message';
import Toast from 'primevue/toast';
import Menu, { type MenuMethods } from 'primevue/menu';
import type { MenuItem } from 'primevue/menuitem';
import Textarea from 'primevue/textarea';
import { watch } from 'vue';

const toast = useToast();
const resolver = ref(zodResolver(CreateDeviceDtoSchema));
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
        deleteDialogVisible.value = true;
      }
    },
  },
]);

const createDialogVisible = ref(false);
const deleteDialogVisible = ref(false);

const devices = ref<DeviceDto[]>([]);
const deviceId = ref<string>();
const deviceCredentials = ref<DeviceWithCredentialsDto>();

watch(createDialogVisible, (visible) => {
  if (!visible) {
    deviceCredentials.value = undefined;
  }
});

const onFormSubmit: FormEmitsOptions['submit'] = async ({ valid, values }) => {
  if (valid) {
    try {
      const { data } = await api.post<DeviceWithCredentialsDto>('/api/devices', {
        id: values.id,
      });
      deviceCredentials.value = data;

      devices.value = await api.get('/api/devices').then((res) => res.data);
      toast.add({ severity: 'success', summary: 'Device created', life: 5000 });
    } catch {
      toast.add({ severity: 'error', summary: 'Device creation failed', life: 2500 });
    }
  }
};

const deleteDevice = async () => {
  await api.delete(`/api/devices/${deviceId.value}`);
  deleteDialogVisible.value = false;
  devices.value = await api.get('/api/devices').then((res) => res.data);
  toast.add({ severity: 'success', summary: 'Device deleted', life: 5000 });
};

const toggleMenu = (event: PointerEvent, id: string) => {
  deviceMenu.value?.toggle(event);
  deviceId.value = id;
};

onMounted(async () => {
  devices.value = await api.get('/api/devices').then((res) => res.data);
});
</script>

<template>
  <div class="flex flex-row m-2 card">
    <div class="min-w-0 flex-3">
      <h2 class="text-2xl/7 font-bold text-gray-900 sm:truncate sm:text-3xl sm:tracking-tight">
        Devices
      </h2>
      <div class="mt-1 flex flex-col sm:mt-0 sm:flex-row sm:flex-wrap sm:space-x-6">
        <div class="mt-2 flex items-center text-sm text-gray-500">
          <span class="pi pi-hashtag me-2" />
          {{ devices.length }}
        </div>
        <div class="mt-2 flex items-center text-sm text-gray-500">
          <span class="pi pi-check-circle me-2" />
          {{ devices.filter((d) => d.properties['online'] === true).length }}
        </div>
      </div>
    </div>
    <div class="min-w-0 flex-1">
      <Button label="Create device" icon="pi pi-plus" @click="createDialogVisible = true" />
    </div>
  </div>

  <div class="card">
    <DataTable :value="devices" tableStyle="min-width: 50rem">
      <Column field="id" header="ID"></Column>
      <Column field="createdAt" header="Created at"></Column>
      <Column>
        <template #body="slotProps">
          <Button
            type="button"
            icon="pi pi-ellipsis-v"
            severity="contrast"
            variant="text"
            rounded
            @click="(ev) => toggleMenu(ev, slotProps.data.id)"
            aria-haspopup="true"
            aria-controls="overlay_menu"
          />
          <Menu ref="deviceMenu" id="overlay_menu" :model="deviceMenuItems" :popup="true" />
        </template>
      </Column>
    </DataTable>
  </div>

  <Toast />

  <Dialog
    v-model:visible="createDialogVisible"
    modal
    :header="deviceCredentials ? 'Device MQTT credentials' : 'Create device'"
    :style="{
      width: deviceCredentials ? '30rem' : '25rem',
    }"
  >
    <Form
      v-if="!deviceCredentials"
      v-slot="$form"
      :resolver
      class="space-y-6"
      @submit="onFormSubmit"
    >
      <div class="flex items-center gap-4 mb-4">
        <FormField v-slot="$field" name="id" class="flex flex-col gap-1 w-full">
          <InputText
            v-model="$field.value"
            type="id"
            placeholder="ID"
            :class="[{ error: $field?.invalid }]"
          />
          <Message v-if="$field?.invalid" severity="error" size="small" variant="simple">
            {{ $field.error?.message }}
          </Message>
        </FormField>
      </div>
      <div class="flex justify-end gap-2">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          @click="createDialogVisible = false"
        ></Button>
        <Button type="submit" label="Save" :disabled="!$form.valid"></Button>
      </div>
    </Form>
    <div v-else class="flex flex-col space-y-2">
      <div class="mb-2"><b>Note down these credentials they will not be shown again.</b></div>
      <label class="mt-2">CA:</label>
      <Textarea v-model="deviceCredentials.ca" disabled rows="5" cols="30" class="w-full" />
      <label class="mt-2">Certificate:</label>
      <Textarea
        v-model="deviceCredentials.certificate"
        disabled
        rows="5"
        cols="30"
        class="w-full"
      />
      <label class="mt-2">Key:</label>
      <Textarea v-model="deviceCredentials.key" disabled rows="5" cols="30" class="w-full" />
    </div>
  </Dialog>

  <Dialog
    v-model:visible="deleteDialogVisible"
    modal
    header="Delete device"
    :closable="false"
    :style="{ width: '25rem' }"
  >
    <div class="flex flex-col">
      <span
        >Deleted devices can not be recovered. Any connection will be terminated. Are you sure?
      </span>
      <div class="flex flex-row justify-between mt-4">
        <Button
          type="button"
          label="Cancel"
          severity="secondary"
          @click="deleteDialogVisible = false"
        ></Button>
        <Button type="button" label="Confirm" severity="danger" @click="deleteDevice"></Button>
      </div>
    </div>
  </Dialog>
</template>

<style>
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
