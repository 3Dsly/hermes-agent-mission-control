import { NextRequest, NextResponse } from 'next/server';

interface AgentChatRequest {
  agentId: string;
  message: string;
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

interface AgentChatResponse {
  reply: string;
  agentId: string;
}

const AGENT_PROMPTS: Record<string, string> = {
  max: "You are Max 🐺, an AI executive assistant and COO-level strategist helping the user run their business. The user runs an AI-agency venture building vertical AI agents for small businesses, and produces a history/documentary YouTube channel (Unmarked Files Archives). Be sharp, concise, strategic. Give real actionable advice.",
  sage: "You are Sage 🌿, X/Twitter content specialist for the user. You write viral tweets in their voice — conversational, sharp, specific. Focus on hooks that make people stop scrolling. No fluff.",
  knox: "You are Knox 🔐, infrastructure and operations analyst for the user. You monitor the health of their Hermes AI-agent setup and its supporting infrastructure (gateway, cron jobs, scheduled tasks, this dashboard's bridge process) — spot recurring failures, flag reliability risks, suggest concrete fixes. Be data-driven and direct.",
  nova: "You are Nova ⭐, YouTube strategy specialist for the user. You write scripts, hooks, thumbnails, titles for the user's history/documentary channel, Unmarked Files Archives. Think strong-hook structure applied to the user's niche.",
  pixel: "You are Pixel 🎨, web app product specialist for the user's products. You find UX improvements, feature ideas, competitor gaps for the tools the user's AI-agency business builds. Think product manager + growth hacker.",
};

export async function POST(request: NextRequest): Promise<NextResponse<AgentChatResponse | { error: string }>> {
  try {
    const body: AgentChatRequest = await request.json();
    const { agentId, message, history = [] } = body;

    // Validate inputs
    if (!agentId || !message) {
      return NextResponse.json(
        { error: 'Missing agentId or message' },
        { status: 400 }
      );
    }

    if (!AGENT_PROMPTS[agentId]) {
      return NextResponse.json(
        { error: `Unknown agent: ${agentId}` },
        { status: 400 }
      );
    }

    const systemPrompt = AGENT_PROMPTS[agentId];
    const apiKey = process.env.OPENROUTER_API_KEY;

    if (!apiKey) {
      console.error('OPENROUTER_API_KEY not configured');
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 }
      );
    }

    // Build messages array: system prompt + history + current message
    const messages = [
      ...history,
      { role: 'user' as const, content: message },
    ];

    // Call OpenRouter API
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://hermy-hq-nu.vercel.app',
      },
      body: JSON.stringify({
        model: 'anthropic/claude-haiku-4-5',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OpenRouter API error:', error);
      return NextResponse.json(
        { error: 'Failed to get response from AI model' },
        { status: 500 }
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || '';

    if (!reply) {
      return NextResponse.json(
        { error: 'No response from AI model' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      reply,
      agentId,
    });
  } catch (error) {
    console.error('Agent chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
