"use client";

import { useEffect, useRef } from "react";
import type { UiMessage } from "@/lib/copilot/types";
import { UserMessage } from "./UserMessage";
import { AssistantMessage } from "./AssistantMessage";
import { ThinkingStages } from "./ThinkingStages";

export function MessageList({
  messages,
  streamingMessage,
  thinking,
  onRegenerate,
  onPickFollowUp,
}: {
  messages: UiMessage[];
  streamingMessage: UiMessage | null; // assistant message being typed out
  thinking: boolean; // awaiting first bytes (show staged loader)
  onRegenerate: () => void;
  onPickFollowUp: (text: string) => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage, thinking]);

  const lastAssistantIdx = [...messages].reverse().findIndex((m) => m.role === "assistant");
  const lastAssistantId =
    lastAssistantIdx >= 0 ? messages[messages.length - 1 - lastAssistantIdx].id : null;

  return (
    <div className="flex-grow overflow-y-auto px-4 md:px-6 py-6 custom-scrollbar">
      <div className="max-w-3xl mx-auto space-y-5">
        {messages.map((m) =>
          m.role === "user" ? (
            <UserMessage key={m.id} text={m.text} />
          ) : (
            <AssistantMessage
              key={m.id}
              message={m}
              canRegenerate={m.id === lastAssistantId && !streamingMessage && !thinking}
              onRegenerate={onRegenerate}
              onPickFollowUp={onPickFollowUp}
            />
          ),
        )}

        {streamingMessage && <AssistantMessage message={streamingMessage} streaming />}
        {thinking && !streamingMessage && <ThinkingStages />}

        <div ref={endRef} />
      </div>
    </div>
  );
}
