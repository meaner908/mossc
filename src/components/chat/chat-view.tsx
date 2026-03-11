"use client"

import { useState } from "react"
import { ConversationList } from "./conversation-list"
import { ChatWindow } from "./chat-window"
import { NewConversationDialog } from "./new-conversation-dialog"
import { CreateAgentDialog } from "@/components/virtual-team/create-agent-dialog"
import { useApp } from "@/store/app-context"
import { cn } from "@/lib/utils"

export function ChatView() {
  const { state } = useApp()
  const [newConvOpen, setNewConvOpen] = useState(false)
  const [newAgentOpen, setNewAgentOpen] = useState(false)

  const hasActiveConversation = !!state.activeConversationId

  return (
    <>
      <div className="flex-1 flex overflow-hidden">
        {/* On mobile: hidden when a conversation is active; always shown on desktop */}
        <div className={cn(
          "shrink-0 overflow-hidden border-r bg-muted/30",
          "w-full md:w-[280px]",
          hasActiveConversation ? "hidden md:flex md:flex-col" : "flex flex-col"
        )}>
          <ConversationList
            onNewConversation={() => setNewConvOpen(true)}
            onNewAgent={() => setNewAgentOpen(true)}
          />
        </div>

        {/* On mobile: hidden when no conversation is active; always shown on desktop */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !hasActiveConversation ? "hidden md:flex" : "flex"
        )}>
          <ChatWindow />
        </div>
      </div>

      <NewConversationDialog open={newConvOpen} onOpenChange={setNewConvOpen} />
      <CreateAgentDialog open={newAgentOpen} onOpenChange={setNewAgentOpen} />
    </>
  )
}
