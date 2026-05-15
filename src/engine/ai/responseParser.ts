// ============================================================
// LLM Response Parser - extracts GameAction from LLM JSON output
// ============================================================

import type { GameAction } from '../../types/actions';

export function parseLLMResponse(
  rawResponse: string,
  validActions: GameAction[],
): { action: GameAction | null; reasoning: string; error?: string } {
  if (validActions.length === 0) {
    return { action: null, reasoning: '', error: '无可选操作' };
  }

  try {
    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonStr = rawResponse.trim();

    // Strip markdown code fences
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Try to find a JSON object in the response
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { action: null, reasoning: '', error: '响应中未找到JSON对象' };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Extract choice (supports both number and string)
    let choice: number;
    if (typeof parsed.choice === 'number') {
      choice = parsed.choice;
    } else if (typeof parsed.choice === 'string') {
      choice = parseInt(parsed.choice, 10);
    } else {
      return { action: null, reasoning: '', error: 'choice字段缺失或格式错误' };
    }

    if (isNaN(choice) || choice < 1 || choice > validActions.length) {
      return {
        action: validActions[0],
        reasoning: parsed.reasoning || '',
        error: `编号${choice}超出范围1-${validActions.length}，使用第一个操作`,
      };
    }

    const action = validActions[choice - 1];
    const reasoning = typeof parsed.reasoning === 'string' ? parsed.reasoning : '';

    return { action, reasoning };
  } catch (e) {
    return {
      action: null,
      reasoning: '',
      error: `JSON解析失败: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
