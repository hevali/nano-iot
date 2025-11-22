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
import Card from 'primevue/card';
import { watch } from 'vue';
import axios from 'axios';

const DeviceTable = defineAsyncComponent({
  loader: () => import('../app/DeviceTable.vue'),
  loadingComponent: ProgressSpinner,
});

const toast = useToast();
const resolver = ref(zodResolver(CreateDeviceDtoSchema));

const createDialogVisible = ref(false);

const deviceId = ref<string>();
const devices = ref<DeviceDto[]>([]);
const deviceMqtt = ref<DeviceWithCredentialsDto['mqtt']>();

watch(createDialogVisible, (visible) => {
  if (!visible) {
    deviceMqtt.value = undefined;
  }
});

const onFormSubmit: FormEmitsOptions['submit'] = async ({ valid, values }) => {
  if (valid) {
    try {
      const { data } = await api.post<DeviceWithCredentialsDto>('/api/devices', {
        id: values.id,
      });
      deviceMqtt.value = data.mqtt;

      devices.value = await api.get('/api/devices').then((res) => res.data);
      toast.add({ severity: 'success', summary: 'Device created', life: 5000 });
    } catch (e) {
      if (axios.isAxiosError(e) && e.status === 409) {
        toast.add({ severity: 'error', summary: 'Device already exists', life: 2500 });
      } else {
        toast.add({ severity: 'error', summary: 'Device creation failed', life: 2500 });
      }
    }
  }
};

const onCopy = (text: string) => {
  if ('clipboard' in navigator) {
    navigator.clipboard.writeText(text);
    toast.add({ severity: 'success', summary: 'Copied', life: 1000 });
  }
};

const deleteDevice = async () => {
  await api.delete(`/api/devices/${deviceId.value}`);
  deviceId.value = undefined;
  devices.value = await api.get('/api/devices').then((res) => res.data);
  toast.add({ severity: 'success', summary: 'Device deleted', life: 5000 });
};

onMounted(async () => {
  devices.value = await api.get('/api/devices').then((res) => res.data);
});
</script>

<template>
  <Toast />

  <Card class="m-2">
    <template #title>Devices</template>
    <template #content>
      <div class="flex flex-row justify-between">
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
        <div class="self-end">
          <Button label="Create device" icon="pi pi-plus" @click="createDialogVisible = true" />
        </div>
      </div>
    </template>
  </Card>

  <DeviceTable class="mt-4" :devices="devices" @delete="(id) => (deviceId = id)" />

  <Dialog
    v-model:visible="createDialogVisible"
    modal
    :header="deviceMqtt ? 'Device MQTT credentials' : 'Create device'"
    :style="{
      width: deviceMqtt ? '30rem' : '25rem',
    }"
  >
    <Form v-if="!deviceMqtt" v-slot="$form" :resolver class="space-y-6" @submit="onFormSubmit">
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
    <div v-else class="flex flex-col space-y-3">
      <div class="mb-2">
        <b>Note down these credentials they will not be shown again.</b>
      </div>
      <div class="flex flex-row justify-between">
        <label for="uri" class="mt-2">URI:</label>
        <Button
          type="button"
          icon="pi pi-clipboard"
          severity="primary"
          variant="text"
          rounded
          @click="(ev) => onCopy(deviceMqtt?.uri || '')"
        />
      </div>
      <InputText v-model="deviceMqtt.uri" readonly name="uri" class="w-full" />
      <div class="flex flex-row justify-between">
        <label for="ca" class="mt-2">CA certificate:</label>
        <Button
          type="button"
          icon="pi pi-clipboard"
          severity="primary"
          variant="text"
          rounded
          @click="(ev) => onCopy(deviceMqtt?.ca || '')"
        />
      </div>
      <Textarea v-model="deviceMqtt.ca" readonly name="ca" rows="5" cols="30" class="w-full" />
      <div class="flex flex-row justify-between">
        <label for="certificate" class="mt-2">Device certificate</label>
        <Button
          type="button"
          icon="pi pi-clipboard"
          severity="primary"
          variant="text"
          rounded
          @click="(ev) => onCopy(deviceMqtt?.certificate || '')"
        />
      </div>
      <Textarea
        v-model="deviceMqtt.certificate"
        readonly
        name="certificate"
        rows="5"
        cols="30"
        class="w-full"
      />
      <div class="flex flex-row justify-between">
        <label for="key" class="mt-2">Device key</label>
        <Button
          type="button"
          icon="pi pi-clipboard"
          severity="primary"
          variant="text"
          rounded
          @click="(ev) => onCopy(deviceMqtt?.key || '')"
        />
      </div>
      <Textarea v-model="deviceMqtt.key" readonly name="key" rows="5" cols="30" class="w-full" />
    </div>
  </Dialog>

  <Dialog
    modal
    header="Delete device"
    :visible="!!deviceId"
    :closable="false"
    :style="{ width: '25rem' }"
  >
    <div class="flex flex-col">
      <span
        >Deleted devices can not be recovered. Any connection will be terminated. Are you sure?
      </span>
      <div class="flex flex-row justify-between mt-4">
        <Button type="button" label="Cancel" severity="secondary" @click="deviceId = undefined" />
        <Button type="button" label="Confirm" severity="danger" @click="deleteDevice" />
      </div>
    </div>
  </Dialog>
</template>

<style></style>
