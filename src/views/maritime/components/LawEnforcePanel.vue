<template>
  <Teleport to="body">
    <div class="law-mask" @click.self="closePanel">
      <section class="law-panel" :style="panelStyle" aria-label="智能执法">
        <header class="law-head">
          <div class="law-title">
            <el-icon><MagicStick /></el-icon>
            <div>
              <h2>智能执法</h2>
              <span>当前派单 {{ dispatchStore.currentOrders.length }} · 历史派单 {{ dispatchStore.historyOrders.length }}</span>
            </div>
          </div>
          <button type="button" class="law-close" aria-label="关闭智能执法" @click="closePanel">
            <el-icon><Close /></el-icon>
          </button>
        </header>

        <div class="law-body">
          <div class="law-tabs">
            <button
              type="button"
              :class="{ 'is-active': activeTab === 'current' }"
              @click="switchTab('current')"
            >
              当前派单
            </button>
            <button
              type="button"
              :class="{ 'is-active': activeTab === 'history' }"
              @click="switchTab('history')"
            >
              历史派单
            </button>
          </div>

          <div v-if="dispatchStore.loading && list.length === 0" class="law-state">
            派单数据加载中
          </div>
          <div v-else-if="dispatchStore.errorMessage" class="law-state law-state--error">
            {{ dispatchStore.errorMessage }}
          </div>
          <div v-else-if="list.length === 0" class="law-state">
            暂无派单
          </div>
          <div v-else class="law-list">
            <table class="law-table">
              <thead>
                <tr>
                  <th>派单编号</th>
                  <th>告警类型</th>
                  <th>目标名称</th>
                  <th>执法船</th>
                  <th>派单时间</th>
                  <th>状态</th>
                  <th v-if="activeTab === 'history'">处置结果</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="order in list" :key="order.id">
                  <td class="law-code">{{ order.code }}</td>
                  <td>{{ ALARM_TYPE_LABELS[order.alarmType] }}</td>
                  <td>{{ order.targetName }}</td>
                  <td>{{ order.vesselName }}</td>
                  <td>{{ formatTime(order.dispatchTime) }}</td>
                  <td>
                    <span class="law-tag" :class="`is-${order.status}`">
                      {{ DISPATCH_STATUS_LABELS[order.status] }}
                    </span>
                  </td>
                  <td v-if="activeTab === 'history'">
                    <span class="law-tag law-tag--outcome" :class="`is-${order.outcome ?? 'timeout'}`">
                      {{ DISPATCH_OUTCOME_LABELS[order.outcome ?? 'timeout'] }}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 智能执法面板：当前派单 / 历史派单两个只读列表。
 */
import { computed, onMounted, ref } from 'vue'
import { Close, MagicStick } from '@element-plus/icons-vue'
import { useMaritimeLawDispatchStore } from '@/stores/maritimeLawDispatch'
import { useMaritimeUiStore } from '@/stores/maritimeUi'
import { useMaritimeScreen } from '@/composables/useMaritimeScreen'
import {
  ALARM_TYPE_LABELS,
  DISPATCH_OUTCOME_LABELS,
  DISPATCH_STATUS_LABELS,
} from '@/types/maritime'
import './law-enforce-panel.css'

const uiStore = useMaritimeUiStore()
const dispatchStore = useMaritimeLawDispatchStore()
const { scale } = useMaritimeScreen()

const activeTab = ref<'current' | 'history'>('current')
const list = computed(() =>
  activeTab.value === 'current' ? dispatchStore.currentOrders : dispatchStore.historyOrders,
)
const panelStyle = computed(() => ({ transform: `translate(-50%, -50%) scale(${scale.value})` }))

onMounted(() => {
  void dispatchStore.loadInitial()
})

function switchTab(tab: 'current' | 'history') {
  activeTab.value = tab
}

function closePanel() {
  uiStore.setLawEnforceOpen(false)
}

function formatTime(value: string) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}
</script>
