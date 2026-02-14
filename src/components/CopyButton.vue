<script setup>
import { ref } from "vue";

const props = defineProps({
  label: {
    type: String,
    required: true,
  },
  successLabel: {
    type: String,
    default: "コピー完了！",
  },
  copyValue: {
    type: [String, Function],
    required: true,
  },
});

const done = ref(false);
let timer = null;

const copyText = async (text) => {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "absolute";
  textArea.style.left = "-9999px";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
};

const handleClick = async () => {
  try {
    const text = typeof props.copyValue === "function" ? await props.copyValue() : props.copyValue;
    await copyText(text);

    done.value = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      done.value = false;
    }, 1800);
  } catch (err) {
    console.error("Failed to copy:", err);
  }
};
</script>

<template>
  <button class="theme-toggle" type="button" @click="handleClick">
    {{ done ? successLabel : label }}
  </button>
</template>
