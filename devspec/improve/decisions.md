<!-- Choices made and WHY, so a settled question is not relitigated. -->

## AI stack = LangChain / LangGraph
_captured: 2026-10-02_

The backend AI layer uses **LangChain** (`@langchain/openai` `ChatOpenAI`, `@langchain/tavily`
`TavilySearch`, text splitters + output parsers) and, for agentic work, **LangGraph**
(`@langchain/langgraph` `StateGraph` + checkpointer).

**Why:** forward extensibility to the discovery agent — it reuses the same model wrapper and Tavily
tool, then adds a LangGraph graph for multi-turn / human-in-the-loop. Chosen over a raw-`fetch`
client (would be re-wrapped as tools later anyway).

**CommonJS safety:** the backend is `"type":"commonjs"` + `module:nodenext`, and `conventions.md`
forbids ESM-only deps — but these packages are **dual-published** (`exports["."].require` → `.cjs`,
verified on npm). They load under `require`/nodenext. A load-spike is task 0 of `add-project-context`;
if a sub-dep proves ESM-only, the fallback is the native-`fetch` client.

First adopted in `add-project-context` (context summarisation + web research).
