/**
 * 9Router AI Gateway Integration
 * src/services/nineRouterService.ts
 *
 * Connects to 9Router (/v1/chat/completions) with multi-model fallback:
 * 1. anthropic/claude-3-5-sonnet
 * 2. google/gemini-1.5-pro
 * 3. openai/gpt-4o
 */

import type { AIScenarioResult } from './apiThrottleCacheService'

const DEFAULT_9ROUTER_BASE_URL = 'http://localhost:3000/v1'

const SYSTEM_PROMPT = `Bạn là Trưởng Phòng Định Lượng (Chief Quantitative Analyst) chuyên trách thị trường Vàng (XAU/USD).
Nhiệm vụ của bạn là nhận hồ sơ dữ liệu đặc trưng kỹ thuật (Price Action, SMC, ICT, RSI) và xuất ra duy nhất một đối tượng JSON tuân thủ schema quy định.

CÁC NGUYÊN TẮC BẤT BIẾN:
1. KHÔNG tự bịa giá. Mọi mức giá Entry, SL, TP phải dựa trên tọa độ Order Block, Swing, FVG đã cấp.
2. NGUYÊN TẮC HỦY KỊCH BẢN (Invalidation): Mỗi kịch bản bắt buộc phải có 1 mức giá Invalidation rõ ràng. Nếu giá vượt qua mức này, kịch bản lập tức bị hủy.
3. KHÔNG THIÊN VỊ: Nếu các khung thời gian xung đột nhau hoặc điểm hợp lưu < 60/100, bắt buộc trả về recommendation: "WAIT".
4. NGÔN NGỮ: Viết phần giải thích (rationale_vi) bằng tiếng Việt chuyên nghiệp, súc tích, dễ hiểu cho người dùng đại chúng.
5. CHỈ TRẢ VỀ JSON HỢP LỆ, KHÔNG KÈM TEXT GIẢI THÍCH NGOÀI JSON.`

export async function call9RouterWithFallback(
  featurePayload: Record<string, unknown>,
  timeoutMs: number = 8000
): Promise<AIScenarioResult | null> {
  const customUrl =
    typeof window !== 'undefined'
      ? localStorage.getItem('finora_9router_endpoint') || DEFAULT_9ROUTER_BASE_URL
      : DEFAULT_9ROUTER_BASE_URL
  const apiKey =
    typeof window !== 'undefined'
      ? localStorage.getItem('finora_9router_key') || 'sk-9router-local'
      : 'sk-9router-local'

  const models = [
    'anthropic/claude-3-5-sonnet-20241022',
    'google/gemini-1.5-pro',
    'openai/gpt-4o',
  ]

  for (const model of models) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const response = await fetch(`${customUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature: 0.1,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: `Phân tích hồ sơ thị trường XAU/USD sau đây và trả về JSON chuẩn:\n${JSON.stringify(
                featurePayload,
                null,
                2
              )}`,
            },
          ],
          response_format: { type: 'json_object' },
        }),
        signal: controller.signal,
      })

      clearTimeout(timer)

      if (!response.ok) {
        continue
      }

      const rawJson = await response.json()
      const content = rawJson?.choices?.[0]?.message?.content
      if (!content) continue

      const parsed = JSON.parse(content)

      // Validate core required fields
      if (
        parsed &&
        (parsed.recommendation === 'BUY' ||
          parsed.recommendation === 'SELL' ||
          parsed.recommendation === 'WAIT') &&
        parsed.execution_plan &&
        Number.isFinite(parsed.execution_plan.entry_price)
      ) {
        const sourceLabel = model.includes('claude')
          ? '9ROUTER_CLAUDE'
          : '9ROUTER_GEMINI'
        const now = Date.now()

        return {
          recommendation: parsed.recommendation,
          confidence_score: Math.min(100, Math.max(0, parsed.confidence_score || 80)),
          setup_name: parsed.setup_name || 'ICT Confluence Setup',
          timeframe_confluence: parsed.timeframe_confluence || {
            d1_bias: 'BULLISH',
            h4_bias: 'BULLISH',
            m15_bias: 'BULLISH',
          },
          execution_plan: {
            entry_price: Number(parsed.execution_plan.entry_price),
            stop_loss: Number(parsed.execution_plan.stop_loss),
            take_profit_1: Number(parsed.execution_plan.take_profit_1),
            take_profit_2: Number(parsed.execution_plan.take_profit_2 || parsed.execution_plan.take_profit_1 * 1.01),
            risk_reward_ratio: Number(parsed.execution_plan.risk_reward_ratio || 2.0),
          },
          invalidation_price: Number(parsed.invalidation_price || parsed.execution_plan.stop_loss),
          invalidation_reason: parsed.invalidation_reason || 'Giá vi phạm ngưỡng cắt lỗ.',
          rationale_vi: parsed.rationale_vi || 'Phân tích tự động từ 9Router AI.',
          warning_message: parsed.warning_message,
          source: sourceLabel,
          generated_at: now,
          expires_at: now + 15 * 60 * 1000,
        }
      }
    } catch {
      clearTimeout(timer)
      // Model failed or timed out, try next model in loop
    }
  }

  return null
}
