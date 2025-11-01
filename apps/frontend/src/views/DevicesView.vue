<script setup lang="ts">
import Button from 'primevue/button';
import Dialog from 'primevue/dialog';
import InputText from 'primevue/inputtext';
import { CreateDeviceDtoSchema, DeviceWithCredentialsDto, type DeviceDto } from '@nano-iot/common';
import { ref, onMounted, defineAsyncComponent } from 'vue';
import { api } from '../services/api';
import { useToast } from 'primevue/usetoast';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import { Form, FormField, type FormEmitsOptions } from '@primevue/forms';
import Message from 'primevue/message';
import Toast from 'primevue/toast';
import ProgressSpinner from 'primevue/progressspinner';
import Textarea from 'primevue/textarea';
import { watch } from 'vue';

const DeviceTable = defineAsyncComponent({
  loader: () => import('../app/DeviceTable.vue'),
  loadingComponent: ProgressSpinner,
});

const toast = useToast();
const resolver = ref(zodResolver(CreateDeviceDtoSchema));

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
  deviceId.value = undefined;
  devices.value = await api.get('/api/devices').then((res) => res.data);
  toast.add({ severity: 'success', summary: 'Device deleted', life: 5000 });
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
    <DeviceTable :devices="devices" @delete="(id) => (deviceId = id)" />
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
        />
        <Button type="submit" label="Save" :disabled="!$form.valid" />
      </div>
    </Form>
    <div v-else class="flex flex-col space-y-2">
      <div class="mb-2">
        <b>Note down these credentials they will not be shown again.</b>
      </div>
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
        />
        <Button type="button" label="Confirm" severity="danger" @click="deleteDevice" />
      </div>
    </div>
  </Dialog>
</template>

<style></style>
