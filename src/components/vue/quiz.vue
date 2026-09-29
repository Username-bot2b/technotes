<template>
  <div class="max-w-md mx-auto bg-white shadow-lg rounded-lg overflow-hidden">
    <div class="p-4">
      <h1 class="text-xl font-bold mb-4">{{ title }}</h1>
      <ul>
        <li v-for="(condition, index) in conditionsWithState" :key="index" @click="toggleExplanation(index)" class="mb-2 p-2 border rounded cursor-pointer hover:bg-gray-100">
          <p class="font-medium">{{ condition.text }}</p>
          <div v-if="condition.showExplanation" class="mt-2">
            <p class="text-sm text-gray-600">{{ condition.explanation }}</p>
            <p v-if="condition.correct" class="text-green-500">Correct</p>
            <p v-else class="text-red-500">Incorrect</p>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps } from 'vue';

interface Condition {
  text: string;
  explanation: string;
  correct: boolean;
  showExplanation?: boolean;
  clicked?: boolean;
}

const props = defineProps<{
  title: string;
  conditions: Condition[];
  changeable?: boolean;
}>();

const conditionsWithState = ref(
  props.conditions.map(condition => ({
    ...condition,
    showExplanation: false,
    clicked: false
  }))
);

const hasAnswered = ref(false);

const toggleExplanation = (index: number) => {
  if (props.changeable === false && hasAnswered.value) return;
  conditionsWithState.value[index].showExplanation = !conditionsWithState.value[index].showExplanation;
  conditionsWithState.value[index].clicked = true;
  if (props.changeable === false) hasAnswered.value = true;
};
</script>

<style scoped>
/* Add your styles here */
</style>
