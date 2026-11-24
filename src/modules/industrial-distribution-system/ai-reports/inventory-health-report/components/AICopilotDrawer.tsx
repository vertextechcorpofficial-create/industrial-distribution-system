/**
 * AI Insight Slide-Over Drawer Component for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements standard Universal AI Architecture (Tier Hierarchy Standard):
 * - Tier 1 (Basic): Summary string + 2-4 keyHighlights bullets.
 * - Tier 2 (Pro): Detailed diagnostic narrative + Operational Risk Factors & Actions with owners.
 * - Tier 3 (Executive): 4-Section Universal C-Suite Executive Report + Edge-to-edge Interactive Chatbot.
 *
 * UI revisions:
 * - FIX: user chat bubbles showed dark text on purple. renderFormattedText hard-coded text-foreground,
 *   which overrode the bubble's text-white. It now takes a `tone` ('default' | 'inverse') so text,
 *   bold runs and bullets pick the right colour for the surface they sit on.
 * - FIX: heading typo "Diagnostic Diagnostic Narrative" -> "Diagnostic Narrative".
 * - FIX: py-0.2 is not a Tailwind class and was silently ignored; replaced with py-0.5.
 * - Header: added a one-line subtitle, removed the stray empty blocks.
 * - Tabs: segmented-control look with proper tablist/tab roles.
 * - Chat: animated typing dots, copy button on answers, "New chat" to clear the thread,
 *   follow-up chips under the thread (only prompts not already asked), Enter-to-send input pill,
 *   and an AI-accuracy disclaimer under the input.
 * - Drawer: closes on Escape and on backdrop click.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    Sparkles,
    X,
    FileText,
    MessageSquare,
    AlertTriangle,
    CheckCircle2,
    Send,
    Bot,
    User,
    ShieldAlert,
    RefreshCw,
    Copy,
    Check,
    Plus,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
    AiInsightResponse,
    AiTierSlug,
    ChatMessage,
} from '../types';

interface AICopilotDrawerProps {
    isOpen: boolean;
    insights: AiInsightResponse | null;
    activeTier: AiTierSlug;
    isLoading: boolean;
    error: string | null;
    onClose: () => void;
    onRegenerate: () => void;
    onAskCustomQuery: (query: string, chatHistory: ChatMessage[]) => Promise<void>;
}

// Quick Suggestion Chips for the Interactive Chat
const QUICK_PROMPTS = [
    'Which SKUs face imminent stockouts?',
    'Dead stock and tied-up capital recovery',
    'Safety stock buffer recommendations',
    'Customer cylinder retrieval bottlenecks',
];

type TextTone = 'default' | 'inverse';

/**
 * Cleanly renders formatted text with bolding and bullet points.
 * `tone` decides the colours: 'default' for light surfaces (cards), 'inverse' for the purple user bubble.
 */
const renderFormattedText = (rawText: string, tone: TextTone = 'default') => {
    const inverse = tone === 'inverse';
    const bodyColor = inverse ? 'text-white' : 'text-foreground/90';
    const strongColor = inverse ? 'text-white' : 'text-foreground';
    const bulletColor = inverse ? 'text-purple-200' : 'text-purple-600 dark:text-purple-400';

    const lines = rawText.split('\n');
    return lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
            return <div key={`empty-${lineIdx}`} className="h-2" />;
        }

        const isBullet = trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const cleanLine = isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : line;

        const parts = cleanLine.split(/(\*\*[^*]+\*\*)/g);
        const formattedLine = parts.map((part, partIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
                return (
                    <strong key={`part-${partIdx}`} className={`font-bold ${strongColor}`}>
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            return part;
        });

        if (isBullet) {
            return (
                <div key={`line-${lineIdx}`} className="flex items-start gap-2 my-1 pl-1">
                    <span className={`${bulletColor} font-bold leading-relaxed shrink-0`}>•</span>
                    <span className={`text-xs leading-relaxed ${bodyColor}`}>{formattedLine}</span>
                </div>
            );
        }

        return (
            <p key={`line-${lineIdx}`} className={`text-xs leading-relaxed ${bodyColor} mb-2 last:mb-0`}>
                {formattedLine}
            </p>
        );
    });
};

/** Section heading used across the Executive Overview tab so spacing and weight stay consistent. */
const SectionTitle: React.FC<{ icon?: React.ReactNode; children: React.ReactNode }> = ({ icon, children }) => (
    <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
        {icon}
        {children}
    </h3>
);

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
    isOpen,
    insights,
    activeTier,
    isLoading,
    error,
    onClose,
    onRegenerate,
    onAskCustomQuery,
}) => {
    // Two-screen navigation: 'report' vs 'chat'
    const [activeTab, setActiveTab] = useState<'report' | 'chat'>('report');
    const [inputQuery, setInputQuery] = useState('');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isSubmittingChat, setIsSubmittingChat] = useState(false);
    // Id of the message whose "copy" button just fired, so it can flash a check mark.
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const msgCounterRef = useRef(0);

    // Close on Escape while the drawer is open.
    useEffect(() => {
        if (!isOpen) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    // Auto-scroll chat window
    useEffect(() => {
        if (activeTab === 'chat') {
            chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
    }, [chatHistory, activeTab, isSubmittingChat]);

    // Focus input on switching to chat
    useEffect(() => {
        if (activeTab === 'chat') {
            inputRef.current?.focus();
        }
    }, [activeTab]);

    // Update chat history when an AI answer arrives
    useEffect(() => {
        if (insights?.qaAnswer && insights.userQuery) {
            setChatHistory((prev) => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last.content === insights.qaAnswer) {
                    return prev;
                }
                msgCounterRef.current += 1;
                const newId = `ai-${msgCounterRef.current}`;
                const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                return [
                    ...prev,
                    {
                        id: newId,
                        role: 'assistant',
                        content: insights.qaAnswer!,
                        timestamp: timeStr,
                    },
                ];
            });
            setIsSubmittingChat(false);
        }
    }, [insights?.qaAnswer, insights?.userQuery]);

    const handleSendChat = useCallback(async (promptToSend?: string) => {
        const text = (promptToSend || inputQuery).trim();
        if (!text || isSubmittingChat) return;

        msgCounterRef.current += 1;
        const newId = `user-${msgCounterRef.current}`;
        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userMsg: ChatMessage = {
            id: newId,
            role: 'user',
            content: text,
            timestamp: timeStr,
        };

        const updated = [...chatHistory, userMsg];
        setChatHistory(updated);
        setInputQuery('');
        setIsSubmittingChat(true);

        try {
            await onAskCustomQuery(text, updated);
        } catch {
            setIsSubmittingChat(false);
        }
    }, [inputQuery, isSubmittingChat, chatHistory, onAskCustomQuery]);

    /** Starts a fresh thread. Only local state is cleared; the report itself is untouched. */
    const handleClearChat = useCallback(() => {
        setChatHistory([]);
        setIsSubmittingChat(false);
        setInputQuery('');
        inputRef.current?.focus();
    }, []);

    /** Copies an assistant answer as plain text and flashes a check mark for 1.5s. */
    const handleCopy = useCallback(async (msg: ChatMessage) => {
        try {
            await navigator.clipboard.writeText(msg.content.replace(/\*\*/g, ''));
            setCopiedId(msg.id);
            window.setTimeout(() => setCopiedId((cur) => (cur === msg.id ? null : cur)), 1500);
        } catch {
            // Clipboard can be blocked (insecure origin / permissions); failing quietly is fine here.
        }
    }, []);

    if (!isOpen) return null;

    // Follow-up chips: only prompts the user has not already asked, and only once an answer exists.
    const askedQuestions = new Set(chatHistory.filter((m) => m.role === 'user').map((m) => m.content));
    const hasAnswer = chatHistory.some((m) => m.role === 'assistant');
    const followUps = QUICK_PROMPTS.filter((p) => !askedQuestions.has(p)).slice(0, 3);

    return (
        <div
            className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            // Clicking the dimmed area (not the panel) closes the drawer.
            onClick={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                className="w-full sm:w-[540px] md:w-[620px] bg-background border-l border-border h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300"
                role="dialog"
                aria-modal="true"
                aria-label="Inventory Health Insight"
            >
                {/* Header */}
                <div className="px-4 py-3.5 border-b border-border/80 bg-gradient-to-r from-purple-500/10 via-muted/20 to-transparent flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="p-2 rounded-xl bg-purple-600 text-white shadow-sm shrink-0">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-foreground truncate">Inventory Health Insight</h2>
                                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider shrink-0">
                                    {activeTier}
                                </Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                                Grounded in the report currently on screen
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={onRegenerate}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg border border-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
                            title="Regenerate Analysis"
                            aria-label="Regenerate analysis"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Close AI Insight (Esc)"
                            aria-label="Close AI Insight"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Tab Switcher: Executive Overview vs Interactive Q&A (segmented control) */}
                <div className="px-4 py-2.5 border-b border-border/60 bg-background flex items-center justify-between gap-2">
                    <div role="tablist" className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/60">
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'report'}
                            onClick={() => setActiveTab('report')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'report'
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <FileText className="h-3.5 w-3.5" />
                            Executive Overview
                        </button>
                        <button
                            type="button"
                            role="tab"
                            aria-selected={activeTab === 'chat'}
                            onClick={() => setActiveTab('chat')}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${activeTab === 'chat'
                                    ? 'bg-purple-600 text-white shadow-xs'
                                    : 'text-muted-foreground hover:text-foreground'
                                }`}
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            Interactive Q&A
                            {chatHistory.length > 0 && (
                                <span
                                    className={`ml-0.5 text-[10px] px-1.5 py-0.5 rounded-full leading-none ${activeTab === 'chat'
                                            ? 'bg-white/25 text-white'
                                            : 'bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100'
                                        }`}
                                >
                                    {chatHistory.length}
                                </span>
                            )}
                        </button>
                    </div>

                    {/* New chat shortcut, only meaningful while a thread exists */}
                    {activeTab === 'chat' && chatHistory.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearChat}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-input text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Clear this conversation"
                        >
                            <Plus className="h-3 w-3" />
                            New chat
                        </button>
                    )}
                </div>

                {/* Error Banner */}
                {error && (
                    <div
                        role="alert"
                        className="m-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-start gap-2"
                    >
                        <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Tab 1: Executive Overview Content */}
                {activeTab === 'report' && (
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
                        {isLoading && !insights ? (
                            <div className="space-y-4 py-8">
                                <div className="h-6 w-3/4 bg-muted animate-pulse rounded-md" />
                                <div className="h-20 w-full bg-muted/60 animate-pulse rounded-xl" />
                                <div className="h-32 w-full bg-muted/40 animate-pulse rounded-xl" />
                            </div>
                        ) : !insights ? (
                            <div className="text-center py-12 text-muted-foreground text-xs">
                                No analysis available. Click Regenerate to evaluate current dataset.
                            </div>
                        ) : (
                            <>
                                {/* Executive Summary Card */}
                                <div className="bg-gradient-to-br from-purple-500/10 to-purple-500/[0.02] border border-purple-500/20 rounded-xl p-4">
                                    <div className="flex items-center gap-2 mb-2 text-purple-700 dark:text-purple-300 font-bold text-xs">
                                        <Sparkles className="h-3.5 w-3.5" />
                                        <span>CSCO Strategic Assessment</span>
                                    </div>
                                    <div className="text-xs text-foreground/90 leading-relaxed">
                                        {renderFormattedText(insights.summary)}
                                    </div>
                                </div>

                                {/* Tier 1: Key Highlights Bullets */}
                                {insights.keyHighlights && insights.keyHighlights.length > 0 && (
                                    <div className="space-y-2">
                                        <SectionTitle>Operational Highlights</SectionTitle>
                                        <div className="bg-card border border-border rounded-xl p-3.5 space-y-2 text-xs">
                                            {insights.keyHighlights.map((h, i) => (
                                                <div key={i} className="flex items-start gap-2">
                                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                                                    <span className="text-foreground leading-snug">{h}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Tier 2 & 3: Detailed Diagnostic Narrative */}
                                {insights.detailedAnalysis && (
                                    <div className="space-y-2">
                                        <SectionTitle>Diagnostic Narrative</SectionTitle>
                                        <div className="bg-card border border-border rounded-xl p-4 text-xs text-foreground/90 leading-relaxed">
                                            {renderFormattedText(insights.detailedAnalysis)}
                                        </div>
                                    </div>
                                )}

                                {/* Tier 2: Key Risk Exposures */}
                                {insights.keyExposures && insights.keyExposures.length > 0 && (
                                    <div className="space-y-2">
                                        <SectionTitle icon={<ShieldAlert className="h-3.5 w-3.5 text-rose-600" />}>
                                            Primary Operational Risks
                                        </SectionTitle>
                                        <div className="space-y-2">
                                            {insights.keyExposures.map((item, idx) => {
                                                const obs = typeof item === 'string' ? { id: `exp-${idx}`, finding: item } : item;
                                                return (
                                                    <div
                                                        key={obs.id || idx}
                                                        className="bg-card border border-rose-200 dark:border-rose-900/50 border-l-4 border-l-rose-500 rounded-xl p-3 text-xs space-y-1"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <strong className="text-rose-700 dark:text-rose-300 font-semibold">
                                                                {obs.category || 'Stock Risk'}
                                                            </strong>
                                                            {obs.impactLevel && (
                                                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 shrink-0">
                                                                    {obs.impactLevel} Impact
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-foreground">{obs.finding}</p>
                                                        {obs.supportingEvidence && (
                                                            <p className="text-[11px] text-muted-foreground font-mono">
                                                                Evidence: {obs.supportingEvidence}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Tier 2: Strategic Actions with Suggested Owners */}
                                {insights.strategicActions && insights.strategicActions.length > 0 && (
                                    <div className="space-y-2">
                                        <SectionTitle icon={<CheckCircle2 className="h-3.5 w-3.5 text-primary" />}>
                                            Recommended Replenishment Actions
                                        </SectionTitle>
                                        <div className="space-y-2">
                                            {insights.strategicActions.map((item, idx) => {
                                                const act = typeof item === 'string' ? { id: `act-${idx}`, finding: item } : item;
                                                return (
                                                    <div
                                                        key={act.id || idx}
                                                        className="bg-card border border-border border-l-4 border-l-primary rounded-xl p-3 text-xs space-y-1.5"
                                                    >
                                                        <p className="text-foreground font-semibold">
                                                            {act.recommendedAction || act.finding}
                                                        </p>
                                                        {act.suggestedOwner && (
                                                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                                                <span className="font-semibold text-primary">Owner:</span>
                                                                <span>{act.suggestedOwner}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* Tier 3: Universal Executive Report Metrics Table */}
                                {insights.executiveReport?.metricsTable && (
                                    <div className="space-y-2">
                                        <SectionTitle>C-Suite Executive Metrics Scorecard</SectionTitle>
                                        <div className="bg-card border border-border rounded-xl overflow-hidden">
                                            <table className="w-full text-xs">
                                                <thead className="bg-muted/50 border-b border-border/60 text-[10px] uppercase text-muted-foreground">
                                                    <tr>
                                                        <th className="py-2 px-3 text-left">Pillar</th>
                                                        <th className="py-2 px-3 text-center">Actual</th>
                                                        <th className="py-2 px-3 text-center">Target</th>
                                                        <th className="py-2 px-3 text-right">Status</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border/40">
                                                    {insights.executiveReport.metricsTable.map((row, i) => (
                                                        <tr key={i}>
                                                            <td className="py-2 px-3 font-medium text-foreground">{row.category}</td>
                                                            <td className="py-2 px-3 text-center font-bold">{row.actual}</td>
                                                            <td className="py-2 px-3 text-center text-muted-foreground">{row.target}</td>
                                                            <td className="py-2 px-3 text-right font-semibold text-primary">{row.status}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Tier 3: Bottlenecks & Key Takeaways */}
                                {insights.executiveReport?.bottleneckFindings && (
                                    <div className="space-y-2">
                                        <SectionTitle>Bottlenecks & Operational Delays</SectionTitle>
                                        <div className="bg-card border border-border rounded-xl p-3.5 space-y-2 text-xs">
                                            {insights.executiveReport.bottleneckFindings.primaryBottlenecks.map((b, i) => (
                                                <div key={i} className="flex items-start gap-2 text-rose-700 dark:text-rose-300">
                                                    <span className="font-bold">•</span>
                                                    <span>{b}</span>
                                                </div>
                                            ))}
                                            {insights.executiveReport.bottleneckFindings.criticalDelays.map((d, i) => (
                                                <div key={i} className="flex items-start gap-2 text-amber-700 dark:text-amber-300">
                                                    <span className="font-bold">•</span>
                                                    <span>{d}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                )}

                {/* Tab 2: Interactive Q&A Chat */}
                {activeTab === 'chat' && (
                    <div className="flex-1 flex flex-col min-h-0 bg-muted/10">
                        {/* Chat Messages Scroll Container */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                            {chatHistory.length === 0 ? (
                                <div className="text-center py-8 space-y-3">
                                    <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 inline-flex">
                                        <MessageSquare className="h-6 w-6" />
                                    </div>
                                    <h4 className="text-sm font-bold text-foreground">Interactive Inventory Advisor</h4>
                                    <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                                        Ask direct questions regarding replenishment buffers, stockout exposure, or dead stock recovery.
                                    </p>

                                    {/* Quick Suggestion Chips */}
                                    <div className="pt-2 flex flex-col gap-1.5 max-w-sm mx-auto">
                                        {QUICK_PROMPTS.map((prompt, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => handleSendChat(prompt)}
                                                className="group flex items-center justify-between gap-2 text-left text-xs p-2.5 rounded-lg border border-border bg-card hover:bg-purple-500/5 hover:border-purple-500/40 text-foreground transition-colors cursor-pointer"
                                            >
                                                <span>{prompt}</span>
                                                <Send className="h-3 w-3 text-muted-foreground group-hover:text-purple-600 shrink-0" />
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {chatHistory.map((msg) => {
                                        const isUser = msg.role === 'user';
                                        return (
                                            <div
                                                key={msg.id}
                                                className={`flex items-start gap-2.5 ${isUser ? 'justify-end' : 'justify-start'}`}
                                            >
                                                {!isUser && (
                                                    <div className="p-1.5 rounded-lg bg-purple-600 text-white shrink-0 mt-0.5">
                                                        <Bot className="h-3.5 w-3.5" />
                                                    </div>
                                                )}
                                                <div className={`group/msg max-w-[85%] flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                                                    <div
                                                        className={`rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${isUser
                                                                ? 'bg-purple-600 text-white rounded-tr-md shadow-xs'
                                                                : 'bg-card border border-border text-foreground rounded-tl-md shadow-2xs'
                                                            }`}
                                                    >
                                                        {/* tone keeps the text readable on the purple user bubble */}
                                                        {renderFormattedText(msg.content, isUser ? 'inverse' : 'default')}
                                                    </div>
                                                    <div className="flex items-center gap-2 mt-1 px-1">
                                                        <span className="text-[10px] text-muted-foreground">{msg.timestamp}</span>
                                                        {!isUser && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleCopy(msg)}
                                                                className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                                                                title="Copy answer"
                                                                aria-label="Copy answer"
                                                            >
                                                                {copiedId === msg.id ? (
                                                                    <>
                                                                        <Check className="h-3 w-3 text-emerald-600" />
                                                                        Copied
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <Copy className="h-3 w-3" />
                                                                        Copy
                                                                    </>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                                {isUser && (
                                                    <div className="p-1.5 rounded-lg bg-muted text-muted-foreground shrink-0 mt-0.5">
                                                        <User className="h-3.5 w-3.5" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Typing indicator: three bouncing dots */}
                                    {isSubmittingChat && (
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 rounded-lg bg-purple-600 text-white shrink-0 mt-0.5">
                                                <Bot className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="bg-card border border-border rounded-2xl rounded-tl-md px-3.5 py-3 text-xs flex items-center gap-2 text-muted-foreground shadow-2xs">
                                                <span className="flex items-center gap-1" aria-hidden="true">
                                                    {[0, 1, 2].map((i) => (
                                                        <span
                                                            key={i}
                                                            className="h-1.5 w-1.5 rounded-full bg-purple-500 animate-bounce"
                                                            style={{ animationDelay: `${i * 150}ms` }}
                                                        />
                                                    ))}
                                                </span>
                                                <span>Analyzing inventory metrics...</span>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={chatEndRef} />
                                </>
                            )}
                        </div>

                        {/* Follow-up chips: shown once there is an answer, hidden while a reply is loading */}
                        {hasAnswer && !isSubmittingChat && followUps.length > 0 && (
                            <div className="px-3 pt-2 pb-1 flex gap-1.5 overflow-x-auto border-t border-border/50 bg-background">
                                {followUps.map((prompt) => (
                                    <button
                                        key={prompt}
                                        type="button"
                                        onClick={() => handleSendChat(prompt)}
                                        className="whitespace-nowrap text-[11px] px-2.5 py-1 rounded-full border border-border bg-card hover:bg-purple-500/5 hover:border-purple-500/40 text-foreground transition-colors cursor-pointer"
                                    >
                                        {prompt}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Chat Input Bar */}
                        <div className="p-3 border-t border-border/80 bg-background">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSendChat();
                                }}
                                className="flex items-center gap-1.5 rounded-xl border border-input bg-card pl-3 pr-1.5 py-1.5 focus-within:ring-1 focus-within:ring-ring transition-shadow"
                            >
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Ask about stockout risks, safety buffers, or dead stock..."
                                    value={inputQuery}
                                    onChange={(e) => setInputQuery(e.target.value)}
                                    disabled={isSubmittingChat}
                                    className="flex-1 min-w-0 text-xs bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-hidden h-7"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputQuery.trim() || isSubmittingChat}
                                    className="p-1.5 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 disabled:hover:bg-purple-600 transition-colors cursor-pointer"
                                    title="Send Message"
                                    aria-label="Send message"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
                                AI can make mistakes. Check key figures against the report before acting.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};