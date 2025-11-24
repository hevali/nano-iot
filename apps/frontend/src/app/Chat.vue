<script setup lang="ts">
import { ref, nextTick } from 'vue';
import Button from 'primevue/button';
import Textarea from 'primevue/textarea';
import Avatar from 'primevue/avatar';

type Role = 'human' | 'ai';

interface Message {
  role: Role;
  content: string;
}

const input = ref<string>('');
const messages = ref<Message[]>([]);
const loading = ref<boolean>(false);
const chatContainer = ref<HTMLElement | null>(null);

const scrollToBottom = () => {
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight;
  }
};

const sendMessage = async () => {
  const text = input.value.trim();
  if (!text || loading.value) {
    return;
  }

  input.value = '';

  messages.value.push({
    role: 'human',
    content: text,
  });

  loading.value = true;
  await nextTick();
  scrollToBottom();

  setTimeout(async () => {
    messages.value.push({
      role: 'ai',
      content: `This is a mock response from the AI. You typed: "${text}".`,
    });
    loading.value = false;
    await nextTick();
    scrollToBottom();
  }, 1000);
};
</script>

<template>
  <!--
    Container:
    If you have a header in your App.vue, ensure this container fits the remaining height.
    If the scrollbar still appears on the body, verify your parent container has 'h-screen overflow-hidden'.
  -->
  <div
    class="flex h-full w-full overflow-hidden bg-[var(--surface-ground)] text-[var(--text-color)]"
  >
    <!-- Sidebar -->
    <aside
      class="hidden md:flex w-[260px] flex-col flex-shrink-0 bg-[var(--surface-overlay)] border-r border-[var(--surface-border)]"
    >
      <div class="p-3">
        <Button
          label="New Chat"
          icon="pi pi-plus"
          class="w-full !text-left !justify-start"
          outlined
        />
      </div>

      <div class="flex-1 overflow-y-auto">
        <div class="flex flex-col gap-1 p-2">
          <button
            v-for="i in 5"
            :key="i"
            class="flex items-center gap-3 p-3 rounded-md hover:bg-[var(--surface-hover)] cursor-pointer transition-colors border-none bg-transparent text-[var(--text-color)] text-sm text-left w-full"
          >
            <i class="pi pi-history"></i>
            <span class="truncate">Conversation History {{ i }}</span>
          </button>
        </div>
      </div>

      <div class="p-3 border-t border-[var(--surface-border)]">
        <button
          class="flex items-center gap-3 p-2 w-full hover:bg-[var(--surface-hover)] rounded-md transition-colors border-none bg-transparent text-[var(--text-color)] cursor-pointer"
        >
          <Avatar
            icon="pi pi-user"
            shape="circle"
            class="!bg-[var(--surface-200)] !text-[var(--text-color)]"
          />
          <span class="font-medium text-sm">Human User</span>
        </button>
      </div>
    </aside>

    <!-- Main Chat Area -->
    <!-- Changed: Added flex flex-col h-full to organize children vertically -->
    <main class="flex-1 flex flex-col h-full relative overflow-hidden">
      <!-- Messages List -->
      <!-- Changed: Added flex-1 to take all available space above the input -->
      <!-- Removed: pb-36 (no longer needed as input isn't floating) -->
      <div ref="chatContainer" class="flex-1 overflow-y-auto scroll-smooth p-4">
        <div class="flex flex-col min-h-full">
          <!-- Empty State -->
          <div
            v-if="messages.length === 0"
            class="flex flex-col items-center justify-center h-full flex-grow gap-4"
          >
            <div class="p-4 rounded-full bg-[var(--surface-card)] shadow-sm">
              <i class="pi pi-prime text-4xl text-[var(--primary-color)]"></i>
            </div>
            <h2 class="text-2xl font-semibold">How can I help you today?</h2>
          </div>

          <!-- Message List -->
          <div v-else class="flex flex-col w-full pb-2">
            <div
              v-for="(msg, index) in messages"
              :key="index"
              class="w-full border-b border-[var(--surface-border)]"
              :class="msg.role === 'ai' ? 'bg-[var(--surface-card)]' : 'bg-transparent'"
            >
              <div class="max-w-3xl mx-auto flex gap-4 p-4 md:p-6 text-base">
                <div class="flex-shrink-0 flex flex-col relative items-end">
                  <Avatar
                    :icon="msg.role === 'human' ? 'pi pi-user' : 'pi pi-bolt'"
                    shape="circle"
                    class="flex-shrink-0"
                    :class="
                      msg.role === 'human'
                        ? '!bg-[var(--surface-200)] !text-[var(--text-color)]'
                        : '!bg-[var(--primary-color)] !text-[var(--primary-color-text)]'
                    "
                  />
                </div>
                <div class="relative flex-1 overflow-hidden">
                  <div class="font-semibold text-sm mb-1 opacity-90">
                    {{ msg.role === 'human' ? 'You' : 'AI' }}
                  </div>
                  <div class="whitespace-pre-wrap leading-7">
                    {{ msg.content }}
                  </div>
                </div>
              </div>
            </div>

            <!-- Loading State -->
            <div
              v-if="loading"
              class="w-full bg-[var(--surface-card)] border-b border-[var(--surface-border)]"
            >
              <div class="max-w-3xl mx-auto flex gap-4 p-4 md:p-6">
                <Avatar
                  icon="pi pi-spin pi-spinner"
                  shape="circle"
                  class="!bg-[var(--primary-color)] !text-[var(--primary-color-text)]"
                />
                <div class="flex items-center">
                  <span class="animate-pulse">Thinking...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Input Area -->
      <!-- Changed: Removed 'absolute'. Uses 'flex-shrink-0' to sit naturally at the bottom. -->
      <!-- Added z-10 to ensure it stays on top visually if shadows overlap. -->
      <div
        class="w-full flex-shrink-0 bg-[var(--surface-ground)] border-t border-[var(--surface-border)] p-4"
      >
        <div class="max-w-3xl mx-auto w-full">
          <div
            class="relative flex items-end w-full p-3 bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-xl shadow-sm ring-offset-2 focus-within:ring-2 ring-[var(--primary-color)]"
          >
            <Textarea
              v-model="input"
              auto-resize
              rows="1"
              class="w-full !border-none !shadow-none !bg-transparent max-h-[200px] py-2 pr-10 resize-none focus:!ring-0"
              placeholder="Message AI..."
              @keydown.enter.exact.prevent="sendMessage"
            />
            <Button
              icon="pi pi-arrow-up"
              rounded
              class="!absolute bottom-2 right-2 !h-8 !w-8"
              :disabled="!input.trim() || loading"
              @click="sendMessage"
            />
          </div>
          <div class="text-center text-xs mt-2 opacity-50">
            AI can make mistakes. Please use responsibly.
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
