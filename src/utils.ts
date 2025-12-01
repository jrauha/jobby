import {
  FunctionCallMessage,
  Message,
  ResponseOutputItem,
  State,
} from "./types";

export function getLastMessage(state: State): Message | null {
  const messages = state.messages;
  return messages.length === 0 ? null : (messages[messages.length - 1] ?? null);
}

export function isAssistantMessage(m: Message): m is ResponseOutputItem {
  if (typeof m !== "object" || m === null) return false;
  const rec = m as Record<string, unknown>;
  if (rec.type !== "message") return false;
  return rec.role === "assistant";
}

export function isFunctionCallMessage(m: Message): m is FunctionCallMessage {
  if (typeof m !== "object" || m === null) return false;
  const rec = m as Record<string, unknown>;
  return rec.type === "function_call" && typeof rec.name === "string";
}
