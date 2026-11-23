/**
 * AI Copilot Slide-Over Drawer Component — Logistics and Delivery Reliability
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements standard Universal AI Architecture (Tier Hierarchy Standard):
 * - Tier 1 (Basic): Summary string + 2-4 keyHighlights bullets.
 * - Tier 2 (Pro): Operational Overview + Detailed narrative + Exposure factors & Actions with owners.
 * - Tier 3 (Executive): 4-Section C-Suite Reliability Report + Edge-to-edge Interactive Chatbot.
  
 */

'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
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
    Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AiInsightResponse,
    AiTierSlug,
    ChatMessage,
    LogisticsReportPayload,
    AIObservation,
} from '../types';

interface AICopilotDrawerProps {
    isOpen: boolean;
    insights: AiInsightResponse | null;
    reportPayload: LogisticsReportPayload | null;
    activeTier: AiTierSlug;
    isLoading: boolean;
    error: string | null;
    onClose: () => void;
    onRegenerate: () => void;
    onAskCustomQuery: (query: string, chatHistory: ChatMessage[]) => Promise<void>;
}

// Quick Suggestion Chips for the Interactive Chat
const QUICK_PROMPTS = [
    'Which route is least reliable?',
    'Why are trips arriving late?',
    'Branch vs road: where is the delay?',
    'What does delivery cost per unit?',
];

// Dynamic analytical progress steps for logistics / distribution domain queries
const DATA_ANALYSIS_STEPS = [
    'Analyzing inquiry context...',
    'Interrogating posted dispatch trips and arrival records...',
    'Comparing committed ETAs against recorded arrivals...',
    'Synthesizing strategic logistics advisory response...',
];

// Dynamic analytical progress steps for general, conversational, or security questions
const GENERAL_CONVERSATION_STEPS = [
    'Reviewing question context...',
    'Checking enterprise advisor directives...',
    'Composing response...',
];

/**
 * Cleanly renders formatted text with bolding and bullet points (matching reference guide)
 */
const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) {
            return <div key={`empty-${lineIdx}`} className="h-2" />;
        }

        // Bullet point detection (•, -, *)
        const isBullet = trimmed.startsWith('• ') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const cleanLine = isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : line;

        // Process bold syntax (**text**)
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
                <div key={`bullet-${lineIdx}`} className="flex items-start gap-2 my-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                    <span className="leading-relaxed">{formattedLine}</span>
                </div>
            );
        }

        return (
            <p key={`p-${lineIdx}`} className="leading-relaxed my-0.5">
                {formattedLine}
            </p>
        );
    });
};

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
    isOpen,
    insights,
    reportPayload,
    activeTier,
    isLoading,
    error,
    onClose,
    onRegenerate,
    onAskCustomQuery,
}) => {
    // Tab state (Executive tier only)
    const [activeTab, setActiveTab] = useState<'report' | 'chat'>('report');

    // Chatbot state
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [currentStepList, setCurrentStepList] = useState<string[]>(DATA_ANALYSIS_STEPS);
    const [analysisStepIndex, setAnalysisStepIndex] = useState(0);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    // Cycle through dynamic analysis progress steps while submitting
    useEffect(() => {
        if (!isSubmitting) return;

        const interval = setInterval(() => {
            setAnalysisStepIndex((prev) => (prev < currentStepList.length - 1 ? prev + 1 : prev));
        }, 1300);

        return () => {
            clearInterval(interval);
            setAnalysisStepIndex(0);
        };
    }, [isSubmitting, currentStepList]);

    // Compute initial greeting derived state (clean, welcoming introduction without premature metric dumps)
    const initialGreeting = useMemo<ChatMessage>(() => {
        return {
            id: 'init-greeting',
            role: 'assistant',
            content: `Hello! I'm your **AI Logistics & Distribution Analyst**.\n\nI read your posted dispatch trips and can explain arrival punctuality, where a delay was created (branch or road), which routes are weakest, and what delivery is costing per unit.\n\nHow can I assist you today?`,
            timestamp: 'Now',
        };
    }, []);

    const isExecutive = activeTier === 'executive';
    const isPro = activeTier === 'pro';
    const isBasic = activeTier === 'basic';
    const tierLevelNumber = isExecutive ? 3 : isPro ? 2 : 1;
    const tierName = activeTier.charAt(0).toUpperCase() + activeTier.slice(1);

    // Track the last incorporated Q&A response
    const [processedQa, setProcessedQa] = useState<string | null>(null);
    if (insights?.qaAnswer && insights.userQuery && processedQa !== insights.qaAnswer) {
        setProcessedQa(insights.qaAnswer);
        setChatMessages((prev) => [
            ...prev,
            {
                id: `ai-${Math.random().toString(36).slice(2, 9)}`,
                role: 'assistant',
                content: insights.qaAnswer!,
                timestamp: 'Now',
            },
        ]);
        setIsSubmitting(false);
    }

    // Scoped container auto-scroll (does NOT jump or scroll outer page)
    useEffect(() => {
        if (activeTab === 'chat' && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages, isSubmitting, activeTab]);

    // Handle sending a chat message
    const handleSend = useCallback(async (customPrompt?: string) => {
        const text = (customPrompt || input).trim();
        if (!text || isSubmitting) return;

        // Context-aware detection: choose domain steps vs general conversation steps
        const isDomainQuery =
            // "depot" stays in the gate: older exports and habit still use the word for an origin branch.
            /(trip|dispatch|delivery|arrive|arrival|eta|late|delay|route|lane|cluster|depot|branch|vehicle|truck|driver|fuel|cost|unit|stop|unfulfilled|return|proof|gps|tolerance|reliab|on time|on-time|utiliz)/i.test(
                text
            );
        setCurrentStepList(isDomainQuery ? DATA_ANALYSIS_STEPS : GENERAL_CONVERSATION_STEPS);
        setAnalysisStepIndex(0);

        const userMsg: ChatMessage = {
            id: `usr-${Math.random().toString(36).slice(2, 9)}`,
            role: 'user',
            content: text,
            timestamp: 'Now',
        };

        const updatedHistory = [...chatMessages, userMsg];
        setChatMessages(updatedHistory);
        setInput('');
        setIsSubmitting(true);

        try {
            await onAskCustomQuery(text, updatedHistory);
        } catch {
            setIsSubmitting(false);
        }
    }, [input, isSubmitting, chatMessages, onAskCustomQuery]);

    if (!isOpen) return null;

    const execReport = insights?.executiveReport;

    return (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs transition-opacity">
            {/* Backdrop click to dismiss */}
            <div className="absolute inset-0" onClick={onClose} />

            {/* Slide-over Drawer Frame */}
            <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 240 }}
                className="relative w-full max-w-2xl bg-background border-l shadow-2xl flex flex-col h-full z-10 overflow-hidden"
            >
                {/* 1. Header with Title, Tier Badge, Segmented Tabs, and Close */}
                <div className="p-4 sm:p-5 border-b bg-muted/20 flex flex-col gap-3 shrink-0">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-purple-600/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20 shadow-xs">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                                        AI Logistics &amp; Delivery Analyst
                                    </h2>
 
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Real-time intelligence and interactive recommendations
                                </p>
                            </div>
                        </div>

                        {/* Top Pill Tab Switcher (Tier 3: Executive Only) */}
                        <div className="flex items-center gap-2">
                            {isExecutive && (
                                <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('report')}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${activeTab === 'report'
                                            ? 'bg-background text-foreground shadow-xs font-bold'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <FileText className="h-3.5 w-3.5" />
                                        <span>Executive Report</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('chat')}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${activeTab === 'chat'
                                            ? 'bg-background text-purple-600 dark:text-purple-400 shadow-xs font-bold'
                                            : 'text-muted-foreground hover:text-foreground'
                                            }`}
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        <span>Ask AI Chatbot</span>
                                        <span className="h-1.5 w-1.5 rounded-full bg-purple-600 dark:bg-purple-400 shrink-0" />
                                    </button>
                                </div>
                            )}

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                className="h-7 w-7 p-0 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                {/* 2. Body Content */}
                {activeTab === 'chat' && isExecutive ? (
                    // -------------------------------------------------------------
                    // CHATBOT VIEW (Edge-to-Edge full height)
                    // -------------------------------------------------------------
                    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                        {/* Suggestions Chips Bar */}
                        <div className="px-4 py-2.5 border-b bg-muted/10 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" /> Suggestions:
                            </span>
                            {QUICK_PROMPTS.map((prompt, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSend(prompt)}
                                    disabled={isSubmitting}
                                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 hover:bg-purple-100 transition-colors whitespace-nowrap disabled:opacity-50"
                                >
                                    {prompt}
                                </button>
                            ))}
                        </div>

                        {/* Scrollable Message Thread */}
                        <div
                            ref={chatContainerRef}
                            className="flex-1 overflow-y-auto p-4 space-y-4 text-xs"
                        >
                            {[initialGreeting, ...chatMessages].map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex gap-2.5 max-w-[88%] ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                                        }`}
                                >
                                    <div
                                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${msg.role === 'user'
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-muted text-foreground border'
                                            }`}
                                    >
                                        {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                                    </div>
                                    <div className="space-y-1">
                                        <div
                                            className={`p-3.5 rounded-2xl ${msg.role === 'user'
                                                ? 'bg-purple-600 text-white rounded-tr-none'
                                                : 'bg-card border border-border text-foreground shadow-xs rounded-tl-none leading-relaxed'
                                                }`}
                                        >
                                            {renderFormattedText(msg.content)}
                                        </div>
                                        <span className="text-[9px] text-muted-foreground block px-1">
                                            {msg.timestamp}
                                        </span>
                                    </div>
                                </div>
                            ))}

                            {isSubmitting && (
                                <div className="flex gap-2.5 mr-auto">
                                    <div className="h-7 w-7 rounded-lg bg-muted text-foreground border flex items-center justify-center shrink-0">
                                        <Bot className="h-4 w-4 text-purple-600 dark:text-purple-400 animate-spin" />
                                    </div>
                                    <div className="p-3 rounded-2xl bg-card border text-muted-foreground text-xs shadow-xs flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
                                        </span>
                                        <span className="italic transition-all duration-300">
                                            {currentStepList[analysisStepIndex] || currentStepList[0]}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Bottom Input Dock */}
                        <div className="p-3 sm:p-4 border-t bg-background shrink-0 space-y-2">
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleSend();
                                }}
                                className="flex items-center gap-2"
                            >
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    placeholder="Ask about late arrivals, a route, a branch, or delivery cost..."
                                    disabled={isSubmitting}
                                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-input bg-muted/30 focus:outline-hidden focus:ring-1 focus:ring-purple-500 text-foreground"
                                />
                                <Button
                                    type="submit"
                                    disabled={!input.trim() || isSubmitting}
                                    className="h-10 px-4 bg-purple-600 hover:bg-purple-700 text-white rounded-xl shadow-xs"
                                >
                                    <Send className="h-4 w-4" />
                                </Button>
                            </form>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                                <span>Press Enter to send</span>
                                <span className="flex items-center gap-1 text-[9px] text-amber-600 dark:text-amber-400">
                                    <ShieldAlert className="h-3 w-3" /> Advisory only • Requires human review
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    // -------------------------------------------------------------
                    // REPORT VIEW (Strictly segmented by tier)
                    // -------------------------------------------------------------
                    <div className="flex-1 overflow-y-auto p-5 space-y-6">
                        {error && (
                            <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs text-rose-600 flex items-start gap-2.5">
                                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-semibold">AI Synthesis Unavailable</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">{error}</p>
                                </div>
                            </div>
                        )}

                        {isLoading && (
                            <div className="py-20 flex flex-col items-center justify-center space-y-3 text-xs text-muted-foreground text-center">
                                <Sparkles className="h-8 w-8 text-purple-600 animate-spin" />
                                <p className="font-semibold text-foreground text-sm">
                                    Synthesizing Delivery Reliability Intelligence...
                                </p>
                                <p className="text-[11px] text-muted-foreground max-w-xs">
                                    Comparing committed arrival times against recorded arrivals, then splitting branch and arrival delays.
                                </p>
                            </div>
                        )}

                        {!isLoading && insights && (
                            <div className="space-y-6 text-foreground">
                                {/* ======================================================== */}
                                {/* TIER 3: EXECUTIVE STRATEGIC VIEW (4-Section Standard)    */}
                                {/* ======================================================== */}
                                {isExecutive && (
                                    <>
                                        {/* Report Title Banner */}
                                        <div className="border-b pb-4 space-y-1">
                                            <h1 className="text-base sm:text-lg font-black text-foreground tracking-tight">
                                                {execReport?.reportTitle || 'Logistics and Delivery Reliability Executive Report'}
                                            </h1>
                                            <p className="text-xs text-muted-foreground">
                                                Prepared By: <strong className="text-foreground">{execReport?.preparedBy || 'AI Logistics & Distribution Analyst'}</strong> • Focus:{' '}
                                                <span className="font-medium text-foreground">
                                                    {execReport?.focus || 'Arrival commitments, route reliability, service failures, fleet economics'}
                                                </span>
                                            </p>
                                        </div>

                                        {/* Section 1: Executive Summary & Metrics Table */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                                1. Executive Summary &amp; Overview
                                            </h3>
                                            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal">
                                                {execReport?.executiveSummary || insights.summary}
                                            </p>

                                            {/* Key Metrics Overview Table */}
                                            <div className="rounded-xl border bg-card overflow-hidden shadow-xs mt-3">
                                                <div className="bg-muted/40 px-3.5 py-2 border-b">
                                                    <h4 className="text-[11px] font-bold text-foreground">Key Metrics Overview</h4>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs text-left">
                                                        <thead className="bg-muted/20 border-b text-[10px] uppercase font-bold text-muted-foreground">
                                                            <tr>
                                                                <th className="px-3.5 py-2">Operational Vector</th>
                                                                <th className="px-3 py-2">Actual Value</th>
                                                                <th className="px-3 py-2">Target / Benchmark</th>
                                                                <th className="px-3 py-2">Performance Status</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-border/60">
                                                            {(execReport?.metricsTable || [
                                                                {
                                                                    category: 'On-time delivery (committed arrivals only)',
                                                                    actual: reportPayload?.kpis.onTimeSharePercentage !== undefined && reportPayload?.kpis.onTimeSharePercentage !== null ? `${reportPayload.kpis.onTimeSharePercentage}%` : 'N/A',
                                                                    target: '95.0% Benchmark',
                                                                    status: (reportPayload?.kpis.onTimeSharePercentage ?? 0) >= 95 ? 'Favorable' : 'Needs Review',
                                                                },
                                                                {
                                                                    category: 'Mean absolute arrival error',
                                                                    actual: reportPayload?.kpis.meanAbsoluteErrorMinutes !== undefined && reportPayload?.kpis.meanAbsoluteErrorMinutes !== null ? `${reportPayload.kpis.meanAbsoluteErrorMinutes} min` : 'N/A',
                                                                    target: `Within ${reportPayload?.kpis.toleranceMinutes ?? 15} min`,
                                                                    status: Math.abs(reportPayload?.kpis.meanAbsoluteErrorMinutes ?? 0) <= (reportPayload?.kpis.toleranceMinutes ?? 15) ? 'Controlled' : 'Elevated Risk',
                                                                },
                                                                {
                                                                    category: 'Trips without an arrival commitment',
                                                                    actual: `${reportPayload?.kpis.uncommittedTripsCount ?? 0} of ${reportPayload?.kpis.totalTripsEvaluated ?? 0}`,
                                                                    target: '0 Unplanned',
                                                                    status: (reportPayload?.kpis.uncommittedTripsCount ?? 0) === 0 ? 'Stable' : 'Critical',
                                                                },
                                                                {
                                                                    category: 'Failed deliveries (Unfulfilled stops)',
                                                                    actual: `${reportPayload?.kpis.unfulfilledStopsCount ?? 0} of ${reportPayload?.kpis.totalStops ?? 0} stops`,
                                                                    target: '≤ 1.0% Ceiling',
                                                                    status: (reportPayload?.kpis.unfulfilledStopsPercentage ?? 0) <= 1 ? 'Controlled' : 'Elevated Risk',
                                                                },
                                                            ]).map((m, idx) => (
                                                                <tr key={idx} className="hover:bg-muted/30">
                                                                    <td className="px-3.5 py-2 font-medium text-foreground">{m.category}</td>
                                                                    <td className="px-3 py-2 font-semibold">{m.actual}</td>
                                                                    <td className="px-3 py-2 text-muted-foreground">{m.target}</td>
                                                                    <td className="px-3 py-2">
                                                                        <span
                                                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${m.status.includes('Favorable') || m.status.includes('Optimal') || m.status.includes('Controlled') || m.status.includes('Stable')
                                                                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                                                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                                                                                }`}
                                                                        >
                                                                            {m.status}
                                                                        </span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Section 2: Bottleneck Findings */}
                                        <div className="space-y-3.5">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                                2. Bottleneck Analysis &amp; Performance Findings
                                            </h3>

                                            {/* A. High-Efficiency Operational Phases */}
                                            <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3.5">
                                                <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    A. High-Efficiency Operational Vectors
                                                </h4>
                                                <ul className="space-y-1 text-xs text-foreground/80 list-disc list-inside">
                                                    {(execReport?.bottleneckFindings?.highEfficiency || [
                                                        `${reportPayload?.kpis.measurableTripsCount ?? 0} of ${reportPayload?.kpis.totalTripsEvaluated ?? 0} posted trips carry a real arrival commitment and can be scored.`,
                                                        `${reportPayload?.kpis.tripsWithProofs ?? 0} trip(s) in scope have a captured delivery proof on file.`,
                                                    ]).map((item, idx) => (
                                                        <li key={idx} className="leading-relaxed">
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* B. Primary Bottlenecks */}
                                            <div className="space-y-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3.5">
                                                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    B. Primary Operational Bottlenecks
                                                </h4>
                                                <ul className="space-y-1 text-xs text-foreground/80 list-disc list-inside">
                                                    {(execReport?.bottleneckFindings?.primaryBottlenecks || [
                                                        `${reportPayload?.kpis.depotLateDeparturesCount ?? 0} trip(s) left the branch after their planned dispatch time.`,
                                                        `${reportPayload?.kpis.roadLateArrivalsCount ?? 0} trip(s) lost further time between departure and arrival.`,
                                                    ]).map((item, idx) => (
                                                        <li key={idx} className="leading-relaxed">
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* C. Critical Delays & Quality Exposure */}
                                            <div className="space-y-1.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.03] p-3.5">
                                                <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    C. Critical Delays &amp; Service Exposure
                                                </h4>
                                                <ul className="space-y-1 text-xs text-foreground/80 list-disc list-inside">
                                                    {(execReport?.bottleneckFindings?.criticalDelays || [
                                                        `${reportPayload?.kpis.lateTripsCount ?? 0} trip(s) breached the ${reportPayload?.kpis.toleranceMinutes ?? 15}-minute arrival window.`,
                                                        `${reportPayload?.kpis.unfulfilledStopsCount ?? 0} stop(s) ended Unfulfilled.`,
                                                    ]).map((item, idx) => (
                                                        <li key={idx} className="leading-relaxed">
                                                            {item}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Section 3: Key Strategic Takeaways */}
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                                3. Key Strategic Takeaways
                                            </h3>
                                            <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.03] p-4 space-y-2">
                                                {(execReport?.keyTakeaways || [
                                                    'Punctuality can only be proven on trips that promise an arrival time — make that field mandatory.',
                                                    'Branch departure discipline, not road time, creates most of the lateness in this corpus.',
                                                ]).map((takeaway, idx) => (
                                                    <div key={idx} className="flex items-start gap-2 text-xs">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                                                        <span className="leading-relaxed font-medium">{takeaway}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Section 4: Recommended Action Plan */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                                4. Recommended Action Plan
                                            </h3>
                                            <div className="space-y-2.5">
                                                {(execReport?.strategicRecommendations || [
                                                    {
                                                        title: 'Make the arrival commitment mandatory at dispatch approval',
                                                        description:
                                                            'Block approval of any dispatch whose estimated arrival is not strictly later than its estimated dispatch time.',
                                                        owner: 'Dispatch Supervisor',
                                                    },
                                                    {
                                                        title: 'Re-cut branch loading cut-offs on the weakest routes',
                                                        description:
                                                            'Move the loading cut-off earlier where trips are already late leaving the branch, then re-measure the same window next period.',
                                                        owner: 'Logistics Head',
                                                    },
                                                ]).map((rec, idx) => (
                                                    <div key={idx} className="rounded-lg border bg-card p-3.5 space-y-1.5 shadow-xs">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="h-5 w-5 rounded-full bg-purple-600/10 text-purple-600 dark:text-purple-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                                                                    {idx + 1}
                                                                </span>
                                                                <h5 className="text-xs font-bold text-foreground">{rec.title}</h5>
                                                            </div>
                                                            {rec.owner && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] text-purple-700 dark:text-purple-300 bg-purple-500/5 border-purple-500/20 font-semibold shrink-0"
                                                                >
                                                                    {rec.owner}
                                                                </Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground leading-relaxed pl-7">
                                                            {rec.description}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* ======================================================== */}
                                {/* TIER 2: PRO DIAGNOSTIC VIEW (Operational Review Only)    */}
                                {/* ======================================================== */}
                                {isPro && (
                                    <div className="space-y-5">
                                        <div className="border-b pb-3 space-y-1">
                                            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                                                Operational Performance Review &amp; Diagnostics
                                            </h2>
                                            <p className="text-xs text-muted-foreground">
                                                Detailed diagnostic review of arrival reliability by route, branch discipline, and evidence coverage.
                                            </p>
                                        </div>

                                        <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                                Operational Overview
                                            </h3>
                                            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                                                {insights.summary}
                                            </p>
                                        </div>

                                        {insights.detailedAnalysis && (
                                            <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                                    Detailed Fulfillment &amp; Quality Analysis
                                                </h3>
                                                <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-line">
                                                    {insights.detailedAnalysis}
                                                </p>
                                            </div>
                                        )}

                                        {/* Risk Factors & Actions Grid */}
                                        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 pt-1">
                                            {/* Operational Risk Factors */}
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                                                    <AlertTriangle className="h-3 w-3" /> Operational Risk Factors
                                                </h4>
                                                <div className="space-y-2">
                                                    {(insights.keyExposures || []).map((exp, idx) => {
                                                        const isObj = typeof exp === 'object' && exp !== null;
                                                        const finding = isObj ? (exp as AIObservation).finding : String(exp);
                                                        const evidence = isObj ? (exp as AIObservation).supportingEvidence : '';
                                                        const impact = isObj ? (exp as AIObservation).impactLevel : 'high';
                                                        const category = isObj ? (exp as AIObservation).category : 'Risk';

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className="rounded-lg border border-rose-500/20 bg-rose-500/[0.03] p-3 text-xs space-y-1"
                                                            >
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-[9px] text-muted-foreground uppercase font-bold">
                                                                        {category}
                                                                    </span>
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={`text-[8px] uppercase font-bold ${impact === 'high'
                                                                            ? 'text-rose-600 border-rose-300'
                                                                            : 'text-amber-600 border-amber-300'
                                                                            }`}
                                                                    >
                                                                        {impact} Impact
                                                                    </Badge>
                                                                </div>
                                                                <p className="font-semibold text-foreground">{finding}</p>
                                                                {evidence && (
                                                                    <p className="text-[11px] text-muted-foreground">{evidence}</p>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            {/* Recommended Action Plan */}
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
                                                    <CheckCircle2 className="h-3 w-3" /> Recommended Action Plan
                                                </h4>
                                                <div className="space-y-2">
                                                    {(insights.strategicActions || []).map((act, idx) => {
                                                        const isObj = typeof act === 'object' && act !== null;
                                                        const actionText = isObj ? (act as AIObservation).recommendedAction || (act as AIObservation).finding : String(act);
                                                        const owner = isObj ? (act as AIObservation).suggestedOwner || 'Logistics' : 'Logistics';

                                                        return (
                                                            <div
                                                                key={idx}
                                                                className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.03] p-3 text-xs space-y-1.5"
                                                            >
                                                                <div className="flex items-center justify-between gap-1.5">
                                                                    <span className="text-[9px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                                                                        {owner}
                                                                    </span>
                                                                </div>
                                                                <p className="font-semibold text-foreground text-xs leading-snug">
                                                                    {actionText}
                                                                </p>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* ======================================================== */}
                                {/* TIER 1: BASIC OPERATIONAL VIEW (Summary + 2-4 Bullets)   */}
                                {/* ======================================================== */}
                                {isBasic && (
                                    <div className="space-y-4">
                                        <div className="border-b pb-3 space-y-1">
                                            <h2 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
                                                Operational Summary
                                            </h2>
                                            <p className="text-xs text-muted-foreground">
                                                General overview of supplier delivery performance and key highlights.
                                            </p>
                                        </div>

                                        <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300">
                                                Summary
                                            </h3>
                                            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed">
                                                {insights.summary}
                                            </p>
                                        </div>

                                        {insights.keyHighlights && (
                                            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                                                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-600">
                                                    Key Operational Highlights
                                                </h4>
                                                <ul className="space-y-2 text-xs text-foreground/90">
                                                    {insights.keyHighlights.slice(0, 4).map((hl, i) => (
                                                        <li key={i} className="flex items-start gap-2">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-purple-500 mt-1.5 shrink-0" />
                                                            <span className="leading-relaxed">{hl}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 3. Footer Action Bar (Matches Reference Guide) */}
                {activeTab === 'report' && (
                    <div className="p-3.5 sm:p-4 border-t bg-muted/30 shrink-0 space-y-2.5">
 
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                {isExecutive && (
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('chat')}
                                        className="text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center gap-1.5 transition-colors"
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        <span>Chat about this report &rarr;</span>
                                    </button>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={onRegenerate}
                                    disabled={isLoading}
                                    className="h-8 text-xs font-medium gap-1.5"
                                >
                                    <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                                    Regenerate
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
};
