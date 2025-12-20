import {
  FunctionCallMessage,
  OpenAIMessage,
  ResponseOutputItem,
  State,
} from "./types";

export function getLastMessage(
  state: State<{ messages: OpenAIMessage[] }>
): OpenAIMessage | null {
  const messages = state.messages;
  return messages.length === 0 ? null : (messages[messages.length - 1] ?? null);
}

export function getLastNonFunctionCallMessageIndex(
  state: State<{ messages: OpenAIMessage[] }>
): number | null {
  const messages = state.messages;
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && !isFunctionCallMessage(m)) {
      return i;
    }
  }
  return null;
}

export function isAssistantMessage(m: OpenAIMessage): m is ResponseOutputItem {
  if (typeof m !== "object" || m === null) return false;
  const rec = m as Record<string, unknown>;
  if (rec.type !== "message") return false;
  return rec.role === "assistant";
}

export function isFunctionCallMessage(
  m: OpenAIMessage
): m is FunctionCallMessage {
  if (typeof m !== "object" || m === null) return false;
  const rec = m as Record<string, unknown>;
  return rec.type === "function_call" && typeof rec.name === "string";
}
