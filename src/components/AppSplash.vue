<script setup>
import logoWhite from '@/assets/images/logo-white.png'
</script>

<template>
  <div
    class="fixed inset-0 z-[9998] flex items-center justify-center bg-[linear-gradient(180deg,#2587e8_0%,#0862cf_52%,#217fdc_100%)]"
    role="status"
    aria-label="Đang tải Store OPS"
  >
    <img
      :src="logoWhite"
      alt="Store OPS"
      class="w-[min(68vw,320px)] animate-[splash-logo-in_600ms_ease-out_both] tablet:w-[min(42vw,420px)]"
    />
  </div>
</template>

<style scoped>
@keyframes splash-logo-in {
  from {
    opacity: 0;
    transform: translateY(8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  img {
    animation: none;
  }
}
</style>
