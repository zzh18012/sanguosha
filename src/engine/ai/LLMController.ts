// ============================================================
// LLM Controller - DeepSeek-powered AI decision with fallback
// ============================================================

import type { GameState } from '../../types/game';
import type { GameAction } from '../../types/actions';
import { evaluateBestAction } from './AIEvaluator';
import { getValidActions } from '../core/RulesEngine';
import { buildUserPrompt, getSystemPrompt } from './promptBuilder';
import { parseLLMResponse } from './responseParser';

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const API_KEY_STORAGE_KEY = 'deepseek_api_key';
const DEFAULT_TIMEOUT_MS = 10000;

let cachedSystemPrompt: string | null = null;

function getApiKey(): string | null {
  try {
    const key = localStorage.getItem(API_KEY_STORAGE_KEY);
    return key || null;
  } catch {
    return null;
  }
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function hasApiKey(): boolean {
  return getApiKey() !== null;
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_STORAGE_KEY);
}

export async function llmDecide(
  state: GameState,
  playerId: string,
): Promise<GameAction> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return evaluateBestAction(state, playerId);
  }

  const validActions = getValidActions(state, playerId);

  if (validActions.length === 0) {
    const player = state.players.find(p => p.id === playerId);
    if (player && state.pendingAction?.playerId === playerId) {
      return { type: 'PASS_RESPONSE', playerId };
    }
    return { type: 'END_TURN', playerId };
  }

  // If there's only one valid action, no need to call LLM
  if (validActions.length === 1) {
    return validActions[0];
  }

  // Build prompts
  if (!cachedSystemPrompt) {
    cachedSystemPrompt = getSystemPrompt();
  }

  const userPrompt = buildUserPrompt(state, playerId, validActions);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: cachedSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 200,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn('DeepSeek API error:', response.status, response.statusText);
      return evaluateBestAction(state, playerId);
    }

    const data = await response.json();
    const llmOutput = data.choices?.[0]?.message?.content;

    if (!llmOutput) {
      console.warn('LLM returned empty response, falling back to rule-based AI');
      return evaluateBestAction(state, playerId);
    }

    const { action, reasoning, error } = parseLLMResponse(llmOutput, validActions);

    if (error) {
      console.warn('LLM response parse issue:', error);
    }

    if (action) {
      if (reasoning) {
        console.log(`AI reasoning: ${reasoning}`);
      }
      return action;
    }

    console.warn('LLM returned no valid action, falling back to rule-based AI');
    return evaluateBestAction(state, playerId);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      console.warn('LLM API timed out, falling back to rule-based AI');
    } else {
      console.warn('LLM API call failed:', err);
    }
    return evaluateBestAction(state, playerId);
  }
}
