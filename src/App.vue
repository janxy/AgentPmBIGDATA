<template>
  <el-scrollbar v-if="!route.meta.fullscreen" height="100vh" @scroll="onScroll">
    <RouterView />
  </el-scrollbar>
  <div v-else class="app-fullscreen-host">
    <RouterView />
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const scrollY = ref(0)
provide('scrollY', scrollY)

function onScroll({ scrollTop }: { scrollTop: number }) {
  scrollY.value = scrollTop
}
</script>

<style scoped>
.app-fullscreen-host {
  width: 100%;
  height: 100%;
}
</style>
