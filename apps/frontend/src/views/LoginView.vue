<script setup lang="ts">
import InputText from 'primevue/inputtext';
import Message from 'primevue/message';
import Button from 'primevue/button';
import Toast from 'primevue/toast';
import { Form, FormField, type FormEmitsOptions } from '@primevue/forms';
import { zodResolver } from '@primevue/forms/resolvers/zod';
import { useToast } from 'primevue/usetoast';
import { z } from 'zod';
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../services/api';
import logoUrl from '../../assets/logo.svg?no-inline';

const router = useRouter();
const resolver = ref(
  zodResolver(
    z.object({
      username: z.string().min(1, { message: 'Username is required.' }),
      password: z.string().min(1, { message: 'Password is required.' }),
    })
  )
);

const toast = useToast();

const onFormSubmit: FormEmitsOptions['submit'] = async ({ valid, values }) => {
  if (valid) {
    try {
      await api.post('/api/auth/login', {
        username: values.username,
        password: values.password,
      });

      router.push('/home');
    } catch {
      toast.add({ severity: 'error', summary: 'Login failed', life: 2500 });
    }
  }
};
</script>

<template>
  <Toast />
  <div class="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <img :src="logoUrl" alt="Nano-IoT" class="mx-auto h-50 w-auto" />
    </div>

    <div class="sm:mx-auto sm:w-full sm:max-w-sm">
      <Form v-slot="$form" :resolver class="space-y-6" @submit="onFormSubmit">
        <FormField v-slot="$field" name="username" initial-value="" class="flex flex-col gap-1">
          <InputText
            v-model="$field.value"
            type="text"
            placeholder="Username"
            :class="[{ error: $field?.invalid }]"
          />
          <Message v-if="$field?.invalid" severity="error" size="small" variant="simple">
            {{ $field.error?.message }}
          </Message>
        </FormField>
        <FormField v-slot="$field" name="password" class="flex flex-col gap-1">
          <InputText
            v-model="$field.value"
            type="password"
            placeholder="Password"
            :class="[{ error: $field?.invalid }]"
          />
          <Message v-if="$field?.invalid" severity="error" size="small" variant="simple">
            {{ $field.error?.message }}
          </Message>
        </FormField>

        <Button
          type="submit"
          severity="secondary"
          label="Submit"
          class="flex w-full justify-center rounded-md"
          :disabled="!$form.valid"
        />
      </Form>
    </div>
  </div>
</template>
