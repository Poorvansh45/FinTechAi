"""
FinAI Edge — AI Copilot (Phase 2A)
====================================
An agentic finance copilot built on LangGraph. A supervisor routes each user
message to one of four specialist agents (portfolio, market, planning,
education), which call LangChain tools that wrap the existing Phase 1 analytics
engines. Short-term (conversation) and long-term (financial profile) memory are
persisted in MongoDB.

This package is backend-only and does not modify any existing Phase 1 module.
"""
