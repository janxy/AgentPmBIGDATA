<template>
  <div class="history-search" :class="{ 'is-expanded': expanded }">
    <button v-if="!expanded" type="button" class="history-search__toggle" aria-label="历史搜索" @click="expanded = true">
      <el-icon><Clock /></el-icon>
      <span>历史搜索</span>
    </button>

    <div v-else class="history-search__panel">
      <header class="history-search__head">
        <span class="history-search__title">
          <el-icon><Clock /></el-icon>
          历史回看
        </span>
        <button type="button" class="history-search__collapse" aria-label="收起历史搜索" @click="expanded = false">
          <el-icon><ArrowDown /></el-icon>
        </button>
      </header>

      <div class="history-search__types" aria-label="历史船只类型">
        <span class="history-search__types-label">类型</span>
        <div class="history-search__type-group">
          <button
            v-for="option in typeOptions"
            :key="option.value"
            type="button"
            class="history-search__type"
            :class="{ 'is-active': selectedType === option.value }"
            @click="selectType(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="history-search__body">
        <el-date-picker
          v-model="date"
          class="history-search__picker"
          type="datetime"
          value-format="YYYY-MM-DD HH:mm:ss"
          format="YYYY-MM-DD HH:mm:ss"
          placeholder="选择日期时间"
          popper-class="history-date-popper"
          :clearable="false"
          :disabled="targetsStore.historyLoading"
          @keyup.enter="handleSearch"
        />
        <button
          type="button"
          class="history-search__submit"
          :disabled="!date || targetsStore.historyLoading"
          @click="handleSearch"
        >
          <el-icon v-if="targetsStore.historyLoading" class="is-loading"><Loading /></el-icon>
          <el-icon v-else><Search /></el-icon>
          <span>{{ targetsStore.historyLoading ? '查询中' : '查询' }}</span>
        </button>
      </div>

      <p v-if="targetsStore.historyError" class="history-search__error" role="alert">
        {{ targetsStore.historyError }}
      </p>
    </div>

    <div v-if="targetsStore.historyMode" class="history-mode-banner">
      <span class="history-mode-banner__dot" />
      <span class="history-mode-banner__text">
        <strong>历史模式</strong>
        <em>{{ historyTimeText }} · {{ targetsStore.historyTargets.length }} 艘</em>
      </span>
      <button type="button" class="history-mode-banner__exit" aria-label="退出历史模式" @click="targetsStore.exitHistory()">
        <el-icon><Close /></el-icon>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 地图历史回看：按日期查询历史船只快照，并提供历史模式标识与退出入口。
 */
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import 'element-plus/es/components/message/style/css'
import { ArrowDown, Clock, Close, Loading, Search } from '@element-plus/icons-vue'
import { useMaritimeTargetsStore } from '@/stores/maritimeTargets'
import type { TargetType } from '@/types/maritime'

const targetsStore = useMaritimeTargetsStore()
const expanded = ref(false)
const date = ref('')
const selectedType = ref<'all' | TargetType>('all')

const typeOptions: Array<{ value: 'all' | TargetType; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'normal', label: '正常' },
  { value: 'sanwu', label: '三无' },
]

const historyTimeText = computed(() => {
  const value = targetsStore.historyDate
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(value)
  return match ? `${match[1]}-${match[2]}-${match[3]} ${match[4]}:${match[5]}` : value
})

function handleSearch() {
  if (!date.value) {
    ElMessage.warning('请选择历史日期')
    return
  }
  void targetsStore.enterHistory(date.value)
}

function selectType(value: 'all' | TargetType) {
  selectedType.value = value
  targetsStore.historyTypes = value === 'all' ? [] : [value]
  if (targetsStore.historyMode && date.value) {
    void targetsStore.enterHistory(date.value)
  }
}
</script>

<style scoped>
.history-search {
  position: absolute;
  top: 14px;
  left: 16px;
  z-index: 25;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.history-search__toggle,
.history-search__collapse {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--mar-text-dim);
  cursor: pointer;
  background: rgba(4, 13, 25, 0.82);
  border: 1px solid var(--mar-line-soft);
  border-radius: 4px;
}

.history-search__toggle {
  gap: 6px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.history-search__toggle:hover {
  color: var(--mar-accent);
  border-color: var(--mar-line);
}

.history-search__panel {
  width: 360px;
  padding: 10px 12px 12px;
  background: rgba(4, 13, 25, 0.92);
  border: 1px solid var(--mar-line);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.history-search__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 9px;
}

.history-search__types {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 9px;
}

.history-search__types-label {
  color: var(--mar-text-faint);
  font-size: 11px;
  flex-shrink: 0;
}

.history-search__type-group {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px;
  background: rgba(13, 34, 58, 0.55);
  border: 1px solid var(--mar-line-soft);
  border-radius: 4px;
  flex: 1;
}

.history-search__type {
  height: 24px;
  padding: 0 10px;
  color: var(--mar-text-dim);
  font-size: 11px;
  cursor: pointer;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  flex: 1;
}

.history-search__type:hover {
  color: var(--mar-text);
}

.history-search__type.is-active {
  color: var(--mar-accent);
  background: rgba(56, 198, 255, 0.14);
  border-color: rgba(56, 198, 255, 0.5);
}

.history-search__title {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--mar-accent);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.history-search__title .el-icon {
  font-size: 15px;
}

.history-search__collapse {
  width: 24px;
  height: 24px;
  font-size: 13px;
}

.history-search__collapse:hover {
  color: var(--mar-text);
  border-color: var(--mar-line);
}

.history-search__body {
  display: flex;
  align-items: center;
  gap: 8px;
}

.history-search__picker {
  width: 228px;
  flex-shrink: 0;
}

.history-search__submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  color: #dff7ff;
  font-size: 12px;
  letter-spacing: 0.5px;
  cursor: pointer;
  background: linear-gradient(180deg, rgba(56, 198, 255, 0.28), rgba(31, 144, 204, 0.22));
  border: 1px solid rgba(56, 198, 255, 0.55);
  border-radius: 4px;
  flex: 1;
}

.history-search__submit:hover:not(:disabled) {
  border-color: var(--mar-accent);
  background: linear-gradient(180deg, rgba(56, 198, 255, 0.38), rgba(31, 144, 204, 0.28));
}

.history-search__submit:disabled {
  color: var(--mar-text-faint);
  cursor: not-allowed;
  opacity: 0.6;
}

.history-search__error {
  margin: 8px 0 0;
  color: var(--mar-red);
  font-size: 11px;
  line-height: 1.5;
}

.history-mode-banner {
  display: flex;
  align-items: center;
  gap: 9px;
  min-width: 260px;
  padding: 8px 10px;
  background: rgba(33, 54, 77, 0.92);
  border: 1px solid rgba(245, 184, 75, 0.55);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.history-mode-banner__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--mar-amber);
  box-shadow: 0 0 10px rgba(245, 184, 75, 0.85);
  flex-shrink: 0;
}

.history-mode-banner__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.history-mode-banner__text strong {
  color: var(--mar-amber);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
}

.history-mode-banner__text em {
  color: var(--mar-text-dim);
  font-size: 11px;
  font-style: normal;
}

.history-mode-banner__exit {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: auto;
  color: var(--mar-text-dim);
  font-size: 14px;
  cursor: pointer;
  background: rgba(245, 184, 75, 0.08);
  border: 1px solid rgba(245, 184, 75, 0.3);
  border-radius: 4px;
  flex-shrink: 0;
}

.history-mode-banner__exit:hover {
  color: var(--mar-text);
  border-color: var(--mar-amber);
}

.history-search :deep(.el-input__wrapper) {
  min-height: 32px;
  padding: 0 10px;
  background: rgba(13, 34, 58, 0.72);
  border-radius: 4px;
  box-shadow: 0 0 0 1px var(--mar-line-soft) inset;
}

.history-search :deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--mar-accent) inset;
}

.history-search :deep(.el-input__inner) {
  color: var(--mar-text);
  font-size: 12px;
}

.history-search :deep(.el-input__inner::placeholder) {
  color: var(--mar-text-faint);
}

.history-search :deep(.el-input__prefix),
.history-search :deep(.el-input__suffix) {
  color: var(--mar-text-faint);
}

:global(.history-date-popper) {
  --el-bg-color-overlay: #0a1a2e;
  --el-bg-color: #0a1a2e;
  --el-fill-color-blank: #08162a;
  --el-fill-color-light: rgba(56, 198, 255, 0.12);
  --el-fill-color-lighter: rgba(56, 198, 255, 0.08);
  --el-text-color-primary: #e8f3ff;
  --el-text-color-regular: #8fb0d0;
  --el-text-color-secondary: #5f7f9f;
  --el-text-color-placeholder: #5f7f9f;
  --el-border-color: rgba(64, 157, 255, 0.24);
  --el-border-color-light: rgba(64, 157, 255, 0.18);
  --el-border-color-lighter: rgba(64, 157, 255, 0.14);
  --el-color-primary: #38c6ff;
  --el-color-primary-light-3: #38c6ff;
  --el-color-primary-light-5: rgba(56, 198, 255, 0.55);
  --el-color-primary-light-7: rgba(56, 198, 255, 0.32);
  --el-color-primary-light-8: rgba(56, 198, 255, 0.24);
  --el-color-primary-light-9: rgba(56, 198, 255, 0.14);
  --el-color-primary-dark-2: #1d9fe8;
  background: #0a1a2e;
  border: 1px solid rgba(64, 157, 255, 0.28);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.45);
}

:global(.history-date-popper .el-date-table td.current:not(.disabled) .el-date-table-cell__text) {
  color: #04131f;
  font-weight: 700;
  background: var(--mar-accent);
}

:global(.history-date-popper .el-date-table td.today .el-date-table-cell__text) {
  color: var(--mar-accent);
}

:global(.history-date-popper .el-date-table td.today.current:not(.disabled) .el-date-table-cell__text) {
  color: #04131f;
}

:global(.history-date-popper .el-picker-panel__icon-btn),
:global(.history-date-popper .el-date-picker__header-label) {
  color: var(--mar-text-dim);
}
</style>
