/**
 * AI Copilot Slide-Over Drawer Component for Inventory Health Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements standard Universal AI Architecture (Tier Hierarchy Standard):
 * - Tier 1 (Basic): Summary string + 2-4 keyHighlights bullets.
 * - Tier 2 (Pro): Detailed diagnostic narrative + Operational Risk Factors & Actions with owners.
 * - Tier 3 (Executive): 4-Section Universal C-Suite Executive Report + Edge-to-edge Interactive Chatbot.

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

/**
 * Cleanly renders formatted text with bolding and bullet points
 */
const renderFormattedText = (rawText: string) => {
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
                    <strong key={`part-${partIdx}`} className="font-bold text-foreground">
                        {part.slice(2, -2)}
                    </strong>
                );
            }
            return part;
        });

        if (isBullet) {
            return (
                <div key={`line-${lineIdx}`} className="flex items-start gap-2 my-1 pl-1">
                    <span className="text-purple-600 dark:text-purple-400 font-bold leading-relaxed shrink-0">•</span>
                    <span className="text-xs leading-relaxed text-foreground/90">{formattedLine}</span>
                </div>
            );
        }

        return (
            <p key={`line-${lineIdx}`} className="text-xs leading-relaxed text-foreground/90 mb-2">
                {formattedLine}
            </p>
        );
    });
};

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

    const chatEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const msgCounterRef = useRef(0);

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

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
            <div
                className="w-full sm:w-[540px] md:w-[620px] bg-background border-l border-border h-full flex flex-col shadow-2xl relative animate-in slide-in-from-right duration-300"
                role="dialog"
                aria-modal="true"
            >
                {/* Header */}
                <div className="p-4 border-b border-border/80 bg-muted/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-purple-600 text-white shadow-xs">
                            <Sparkles className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-sm font-bold text-foreground">Inventory Health Copilot</h2>
                                <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
                                    {activeTier}
                                </Badge>
 
                            </div>

                        </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={onRegenerate}
                            disabled={isLoading}
                            className="p-1.5 rounded-lg border border-input text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 cursor-pointer"
                            title="Regenerate Analysis"
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                            title="Close Copilot"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Tab Switcher: Executive Overview vs Interactive Q&A */}
                <div className="px-4 pt-3 pb-2 border-b border-border/60 bg-background flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab('report')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'report'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                    >
                        <FileText className="h-3.5 w-3.5" />
                        Executive Overview
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('chat')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            activeTab === 'chat'
                                ? 'bg-purple-600 text-white shadow-xs'
                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                    >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Interactive Q&A
                        {chatHistory.length > 0 && (
                            <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-purple-200 dark:bg-purple-800 text-purple-900 dark:text-purple-100">
                                {chatHistory.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Error Banner */}
                {error && (
                    <div className="m-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300 text-xs flex items-start gap-2">
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
                                <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
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
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            Operational Highlights
                                        </h3>
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
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            Diagnostic Diagnostic Narrative
                                        </h3>
                                        <div className="bg-card border border-border rounded-xl p-4 text-xs text-foreground/90 leading-relaxed">
                                            {renderFormattedText(insights.detailedAnalysis)}
                                        </div>
                                    </div>
                                )}

                                {/* Tier 2: Key Risk Exposures */}
                                {insights.keyExposures && insights.keyExposures.length > 0 && (
                                    <div className="space-y-2">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                            <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                                            Primary Operational Risks
                                        </h3>
                                        <div className="space-y-2">
                                            {insights.keyExposures.map((item, idx) => {
                                                const obs = typeof item === 'string' ? { id: `exp-${idx}`, finding: item } : item;
                                                return (
                                                    <div
                                                        key={obs.id || idx}
                                                        className="bg-card border border-rose-200 dark:border-rose-900/50 rounded-xl p-3 text-xs space-y-1"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <strong className="text-rose-700 dark:text-rose-300 font-semibold">
                                                                {obs.category || 'Stock Risk'}
                                                            </strong>
                                                            {obs.impactLevel && (
                                                                <span className="text-[10px] font-bold uppercase px-1.5 py-0.2 rounded-sm bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
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
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                                            <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                                            Recommended Replenishment Actions
                                        </h3>
                                        <div className="space-y-2">
                                            {insights.strategicActions.map((item, idx) => {
                                                const act = typeof item === 'string' ? { id: `act-${idx}`, finding: item } : item;
                                                return (
                                                    <div
                                                        key={act.id || idx}
                                                        className="bg-card border border-border rounded-xl p-3 text-xs space-y-1.5"
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
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            C-Suite Executive Metrics Scorecard
                                        </h3>
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
                                    <div className="space-y-3">
                                        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                                            Bottlenecks & Operational Delays
                                        </h3>
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
                    <div className="flex-1 flex flex-col min-h-0 bg-background">
                        {/* Chat Messages Scroll Container */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-3">
                            {chatHistory.length === 0 ? (
                                <div className="text-center py-8 space-y-3">
                                    <div className="p-3 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 inline-flex">
                                        <MessageSquare className="h-6 w-6" />
                                    </div>
                                    <h4 className="text-xs font-bold text-foreground">Interactive Inventory Advisor</h4>
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
                                                className="text-left text-xs p-2.5 rounded-lg border border-border bg-card hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                                            >
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <>
                                    {chatHistory.map((msg) => (
                                        <div
                                            key={msg.id}
                                            className={`flex items-start gap-2.5 ${
                                                msg.role === 'user' ? 'justify-end' : 'justify-start'
                                            }`}
                                        >
                                            {msg.role === 'assistant' && (
                                                <div className="p-1.5 rounded-lg bg-purple-600 text-white shrink-0 mt-0.5">
                                                    <Bot className="h-3.5 w-3.5" />
                                                </div>
                                            )}
                                            <div
                                                className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                                                    msg.role === 'user'
                                                        ? 'bg-purple-600 text-white'
                                                        : 'bg-card border border-border text-foreground shadow-2xs'
                                                }`}
                                            >
                                                {renderFormattedText(msg.content)}
                                                <div
                                                    className={`text-[9px] mt-1 ${
                                                        msg.role === 'user' ? 'text-purple-200' : 'text-muted-foreground'
                                                    }`}
                                                >
                                                    {msg.timestamp}
                                                </div>
                                            </div>
                                            {msg.role === 'user' && (
                                                <div className="p-1.5 rounded-lg bg-muted text-muted-foreground shrink-0 mt-0.5">
                                                    <User className="h-3.5 w-3.5" />
                                                </div>
                                            )}
                                        </div>
                                    ))}

                                    {isSubmittingChat && (
                                        <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 rounded-lg bg-purple-600 text-white shrink-0 mt-0.5">
                                                <Bot className="h-3.5 w-3.5" />
                                            </div>
                                            <div className="bg-card border border-border rounded-2xl p-3 text-xs flex items-center gap-2 text-muted-foreground shadow-2xs">
                                                <div className="h-3 w-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                                                <span>Analyzing inventory metrics...</span>
                                            </div>
                                        </div>
                                    )}

                                    <div ref={chatEndRef} />
                                </>
                            )}
                        </div>

                        {/* Chat Input Bar */}
                        <div className="p-3 border-t border-border/80 bg-background">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSendChat();
                                }}
                                className="flex items-center gap-2"
                            >
                                <input
                                    ref={inputRef}
                                    type="text"
                                    placeholder="Ask about stockout risks, safety buffers, or dead stock..."
                                    value={inputQuery}
                                    onChange={(e) => setInputQuery(e.target.value)}
                                    disabled={isSubmittingChat}
                                    className="flex-1 text-xs px-3 py-2 rounded-lg border border-input bg-card text-foreground focus:outline-hidden focus:ring-1 focus:ring-ring h-9"
                                />
                                <button
                                    type="submit"
                                    disabled={!inputQuery.trim() || isSubmittingChat}
                                    className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-40 transition-colors cursor-pointer"
                                    title="Send Message"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </form>
                        </div>
                    </div>
                )}
 
            </div>
        </div>
    );
};
