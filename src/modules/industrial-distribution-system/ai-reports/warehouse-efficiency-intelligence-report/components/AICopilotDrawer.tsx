/**
 * AI Copilot Slide-Over Drawer Component for Warehouse Efficiency Intelligence Report
 * Always leave behind comments on all changes and development of workflows for efficient long-term coding
 *
 * Implements Standard Universal AI Architecture (Tier Hierarchy Standard):
 * - Tier 1 (Basic): Operational Summary string + 2-4 keyHighlights bullets. No Chatbot.
 * - Tier 2 (Pro): Operational Overview + Detailed narrative + Operational Risk Factors & Actions with owners. No Chatbot.
 * - Tier 3 (Executive): 4-Section C-Suite Executive Performance Report + Edge-to-edge Interactive Chatbot with Suggestions.
 * - Strict gating of the interactive Chatbot to Executive Tier.
 * - Adheres to EU AI Act Article 14 Human-in-the-Loop advisory notices.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    Clock,
    Activity,
    Layers,
    Lock,
    ArrowUpRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AiInsightResponse,
    AiTierSlug,
    ChatMessage,
    WarehouseEfficiencyReportPayload,
    AIObservation,
} from '../types';

interface AICopilotDrawerProps {
    isOpen: boolean;
    insights: AiInsightResponse | null;
    reportPayload: WarehouseEfficiencyReportPayload | null;
    activeTier: AiTierSlug;
    isLoading: boolean;
    error: string | null;
    onClose: () => void;
    onAskCustomQuery: (query: string, chatHistory: ChatMessage[]) => Promise<void>;
}

// Quick Suggestion Chips for the Interactive Chat (Tier 3: Executive Only)
const QUICK_PROMPTS = [
    'Which warehouse has the highest dock queue?',
    'Top 3 picking throughput bottlenecks',
    'Space constraint mitigation plan',
    'Carrier staging queue root cause',
];

const DATA_ANALYSIS_STEPS = [
    'Analyzing inquiry context...',
    'Interrogating picking rates & dock utilization metrics...',
    'Evaluating space capacity & queue times...',
    'Synthesizing strategic COO advisory response...',
];

const renderFormattedText = (rawText: string) => {
    const lines = rawText.split('\n');
    return lines.map((line, lineIdx) => {
        if (!line.trim()) return <div key={lineIdx} className="h-2" />;
        const parts = line.split(/(\*\*.*?\*\*)/g);
        return (
            <p key={lineIdx} className="mb-1 leading-relaxed">
                {parts.map((part, partIdx) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                        return <strong key={partIdx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                })}
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
    onAskCustomQuery,
}) => {
    const isExecutive = activeTier === 'executive';
    const isPro = activeTier === 'pro';
    const isBasic = activeTier === 'basic';

    const [activeTab, setActiveTab] = useState<'report' | 'chat'>('report');
    const [input, setInput] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [analysisStepIndex, setAnalysisStepIndex] = useState(0);

    const chatContainerRef = useRef<HTMLDivElement>(null);

    const tierLevelNumber = isExecutive ? 3 : isPro ? 2 : 1;
    const tierName = activeTier.charAt(0).toUpperCase() + activeTier.slice(1);

    // Initial greeting
    const initialGreeting = {
        id: 'msg-initial-greeting',
        role: 'assistant' as const,
        content:
            insights?.summary ||
            'Hello! I am your Warehouse Operations Intelligence Copilot. Ask me about pick rates, dock turnaround bottlenecks, or storage slotting proposals.',
        timestamp: 'Just now',
    };

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

    // Auto-scroll chat container
    useEffect(() => {
        if (activeTab === 'chat' && chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages, isSubmitting, activeTab]);

    // Handle sending a chat message
    const handleSend = useCallback(async (customPrompt?: string) => {
        const text = (customPrompt || input).trim();
        if (!text || isSubmitting || !isExecutive) return;

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
    }, [input, isSubmitting, isExecutive, chatMessages, onAskCustomQuery]);

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
                            <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 border border-primary/20 shadow-xs">
                                <Sparkles className="h-5 w-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-sm sm:text-base font-bold text-foreground tracking-tight">
                                        Warehouse Operations Copilot
                                    </h2>
                                    <Badge
                                        variant="outline"
                                        className="text-[10px] font-bold bg-primary/10 text-primary border-primary/20"
                                    >
                                        Tier {tierLevelNumber}: {tierName}
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                    Operational efficiency diagnostics and intelligence
                                </p>
                            </div>
                        </div>

                        {/* Top Pill Tab Switcher: Only displayed on Executive Tier */}
                        <div className="flex items-center gap-2">
                            {isExecutive && (
                                <div className="flex items-center bg-muted/60 p-0.5 rounded-lg border border-border/60">
                                    <button
                                        type="button"
                                        onClick={() => setActiveTab('report')}
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                                            activeTab === 'report'
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
                                        className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                                            activeTab === 'chat'
                                                ? 'bg-background text-primary shadow-xs font-bold'
                                                : 'text-muted-foreground hover:text-foreground'
                                        }`}
                                    >
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        <span>Ask AI Chatbot</span>
                                        <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
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
                    // CHATBOT VIEW (Edge-to-Edge full height, Tier 3 Executive only)
                    // -------------------------------------------------------------
                    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden">
                        {/* Suggestions Chips Bar */}
                        <div className="px-4 py-2.5 border-b bg-muted/10 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
                            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider shrink-0 flex items-center gap-1">
                                <Sparkles className="h-3 w-3 text-primary" /> Suggestions:
                            </span>
                            {QUICK_PROMPTS.map((prompt, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSend(prompt)}
                                    disabled={isSubmitting}
                                    className="text-[11px] font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors whitespace-nowrap disabled:opacity-50"
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
                                    className={`flex gap-2.5 max-w-[88%] ${
                                        msg.role === 'user' ? 'ml-auto flex-row-reverse' : 'mr-auto'
                                    }`}
                                >
                                    <div
                                        className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                                            msg.role === 'user'
                                                ? 'bg-primary text-primary-foreground'
                                                : 'bg-muted text-foreground border'
                                        }`}
                                    >
                                        {msg.role === 'user' ? (
                                            <User className="h-4 w-4" />
                                        ) : (
                                            <Bot className="h-4 w-4 text-primary" />
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <div
                                            className={`p-3.5 rounded-2xl ${
                                                msg.role === 'user'
                                                    ? 'bg-primary text-primary-foreground rounded-tr-none'
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
                                        <Bot className="h-4 w-4 text-primary animate-spin" />
                                    </div>
                                    <div className="p-3 rounded-2xl bg-card border text-muted-foreground text-xs shadow-xs flex items-center gap-2">
                                        <span className="relative flex h-2 w-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                                        </span>
                                        <span className="italic transition-all duration-300">
                                            {DATA_ANALYSIS_STEPS[analysisStepIndex] || DATA_ANALYSIS_STEPS[0]}
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
                                    placeholder="Ask about warehouse bottlenecks, pick rates, or dock queues..."
                                    disabled={isSubmitting}
                                    className="flex-1 text-xs px-3.5 py-2.5 rounded-xl border border-input bg-muted/30 focus:outline-hidden focus:ring-1 focus:ring-primary text-foreground"
                                />
                                <Button
                                    type="submit"
                                    disabled={!input.trim() || isSubmitting}
                                    className="h-10 px-4 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs"
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
                                <Sparkles className="h-8 w-8 text-indigo-600 animate-spin" />
                                <p className="font-semibold text-foreground text-sm">
                                    Synthesizing Warehouse Efficiency Intelligence...
                                </p>
                                <p className="text-[11px] text-muted-foreground max-w-xs">
                                    Evaluating picking throughput, dock bay turnaround times, and space capacity constraints.
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
                                                {execReport?.reportTitle || 'Enterprise Warehouse Operational Intelligence Briefing'}
                                            </h1>
                                            <p className="text-xs text-muted-foreground">
                                                Prepared By: <strong className="text-foreground">{execReport?.preparedBy || 'AI Warehouse Operations Analyst'}</strong> &bull; Focus:{' '}
                                                <span className="font-medium text-foreground">
                                                    {execReport?.focus || 'Fulfillment Throughput, Dock Turnaround, Space Optimization'}
                                                </span>
                                            </p>
                                        </div>

                                        {/* Section 1: Executive Summary & Metrics Table */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                                1. Executive Summary &amp; Overview
                                            </h3>
                                            <p className="text-xs sm:text-sm text-foreground/90 leading-relaxed font-normal">
                                                {execReport?.executiveSummary || insights.summary}
                                            </p>

                                            {/* Key Metrics Overview Table */}
                                            <div className="rounded-xl border bg-card overflow-hidden shadow-xs mt-3">
                                                <div className="bg-muted/40 px-3.5 py-2 border-b">
                                                    <h4 className="text-[11px] font-bold text-foreground">Key Operational Benchmarks</h4>
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
                                                                    category: 'Average Pick Throughput',
                                                                    actual: reportPayload?.kpis.averagePickRate !== null ? `${reportPayload?.kpis.averagePickRate} u/hr` : 'N/A',
                                                                    target: '≥ 25.0 u/hr',
                                                                    status: (reportPayload?.kpis.averagePickRate ?? 0) >= 25 ? 'Optimal' : 'Needs Review',
                                                                },
                                                                {
                                                                    category: 'Dock Bay Utilization',
                                                                    actual: reportPayload?.kpis.overallDockUtilizationRate !== null ? `${reportPayload?.kpis.overallDockUtilizationRate}%` : 'N/A',
                                                                    target: '≤ 80.0%',
                                                                    status: (reportPayload?.kpis.overallDockUtilizationRate ?? 0) <= 80 ? 'Controlled' : 'Critical',
                                                                },
                                                                {
                                                                    category: 'Storage Occupancy',
                                                                    actual: reportPayload?.kpis.overallSpaceUtilizationRate !== null ? `${reportPayload?.kpis.overallSpaceUtilizationRate}%` : 'N/A',
                                                                    target: '≤ 85.0%',
                                                                    status: (reportPayload?.kpis.overallSpaceUtilizationRate ?? 0) <= 85 ? 'Controlled' : 'Needs Review',
                                                                },
                                                                {
                                                                    category: 'Average Staging Queue',
                                                                    actual: reportPayload?.kpis.averageQueueTimeMinutes !== null ? `${reportPayload?.kpis.averageQueueTimeMinutes} mins` : 'N/A',
                                                                    target: '≤ 30 mins',
                                                                    status: (reportPayload?.kpis.averageQueueTimeMinutes ?? 0) <= 30 ? 'Controlled' : 'Needs Review',
                                                                },
                                                            ]).map((m, idx) => (
                                                                <tr key={idx} className="hover:bg-muted/30">
                                                                    <td className="px-3.5 py-2 font-medium text-foreground">{m.category}</td>
                                                                    <td className="px-3 py-2 font-semibold">{m.actual}</td>
                                                                    <td className="px-3 py-2 text-muted-foreground">{m.target}</td>
                                                                    <td className="px-3 py-2">
                                                                        <span
                                                                            className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                                                                m.status.includes('Optimal') || m.status.includes('Controlled')
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
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                                2. Bottleneck Analysis &amp; Operational Vectors
                                            </h3>

                                            {/* High-Efficiency */}
                                            <div className="space-y-1.5 rounded-lg border bg-muted/20 p-3.5">
                                                <h4 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    A. Balanced Flow &amp; High-Throughput Locations
                                                </h4>
                                                <ul className="space-y-1 text-xs text-foreground/80 list-disc list-inside">
                                                    {(execReport?.bottleneckFindings?.highEfficiency || [
                                                        `Evaluated ${reportPayload?.kpis.totalActiveWarehouses ?? 0} active warehouse locations across all branches.`,
                                                        'Consolidator batch completion flows smoothly without audit queue blocks in standard branches.',
                                                    ]).map((item, idx) => (
                                                        <li key={idx} className="leading-relaxed">{item}</li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Primary Bottlenecks */}
                                            <div className="space-y-1.5 rounded-lg border border-amber-500/20 bg-amber-500/[0.03] p-3.5">
                                                <h4 className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                                                    <Clock className="h-3.5 w-3.5" />
                                                    B. Primary Staging Bottlenecks
                                                </h4>
                                                <ul className="space-y-1 text-xs text-foreground/80 list-disc list-inside">
                                                    {(execReport?.bottleneckFindings?.primaryBottlenecks || [
                                                        'Loading dock staging congestion occurring during peak carrier turnover windows.',
                                                    ]).map((item, idx) => (
                                                        <li key={idx} className="leading-relaxed">{item}</li>
                                                    ))}
                                                </ul>
                                            </div>

                                            {/* Critical Delays */}
                                            <div className="space-y-1.5 rounded-lg border border-rose-500/20 bg-rose-500/[0.03] p-3.5">
                                                <h4 className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                                                    <AlertTriangle className="h-3.5 w-3.5" />
                                                    C. Critical Capacity Constraints
                                                </h4>
                                                <ul className="space-y-1 text-xs text-foreground/80 list-disc list-inside">
                                                    {(execReport?.bottleneckFindings?.criticalDelays || [
                                                        'Storage occupancy approaching upper density thresholds, impeding forklift transit aisles.',
                                                    ]).map((item, idx) => (
                                                        <li key={idx} className="leading-relaxed">{item}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>

                                        {/* Section 3: Strategic Takeaways */}
                                        <div className="space-y-2">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                                3. Key Strategic Takeaways
                                            </h3>
                                            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/[0.03] p-4 space-y-2">
                                                {(execReport?.keyTakeaways || [
                                                    'Stagger dispatch staging appointments to distribute loading bay peaks.',
                                                    'Accelerate empty cylinder turnaround to release floor storage capacity.',
                                                ]).map((takeaway, idx) => (
                                                    <div key={idx} className="flex items-start gap-2 text-xs">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                                                        <span className="leading-relaxed font-medium">{takeaway}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Section 4: Recommended Action Plan */}
                                        <div className="space-y-3">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                                4. Recommended Action Plan
                                            </h3>
                                            <div className="space-y-2.5">
                                                {(execReport?.strategicRecommendations || [
                                                    {
                                                        title: 'Stagger Carrier Loading Schedules',
                                                        description:
                                                            'Implement structured 30-minute arrival slots linked to pre-dispatch plan release.',
                                                        owner: 'Dock Staging Supervisor',
                                                    },
                                                    {
                                                        title: 'Fast-Moving Cylinder Slotting Realignment',
                                                        description:
                                                            'Relocate high-velocity serialized cylinder stock to bays immediately adjacent to staging lanes.',
                                                        owner: 'Warehouse Operations Lead',
                                                    },
                                                ]).map((rec, idx) => (
                                                    <div key={idx} className="rounded-lg border bg-card p-3.5 space-y-1.5 shadow-xs">
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <span className="h-5 w-5 rounded-full bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 text-[11px] font-bold flex items-center justify-center shrink-0">
                                                                    {idx + 1}
                                                                </span>
                                                                <h5 className="text-xs font-bold text-foreground">{rec.title}</h5>
                                                            </div>
                                                            {rec.owner && (
                                                                <Badge
                                                                    variant="outline"
                                                                    className="text-[10px] text-indigo-700 dark:text-indigo-300 bg-indigo-500/5 border-indigo-500/20 font-semibold shrink-0"
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
                                                Operational Efficiency Diagnostics &amp; Review
                                            </h2>
                                            <p className="text-xs text-muted-foreground">
                                                Diagnostic analysis of picking throughput, dock turnaround delays, and storage density.
                                            </p>
                                        </div>

                                        <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                                Operational Overview
                                            </h3>
                                            <div className="text-xs text-foreground/90 leading-relaxed font-normal">
                                                {renderFormattedText(insights.summary)}
                                            </div>
                                        </div>

                                        {insights.detailedAnalysis && (
                                            <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                                                    Detailed Operational Analysis
                                                </h3>
                                                <div className="text-xs text-foreground/80 leading-relaxed font-normal space-y-2">
                                                    {renderFormattedText(insights.detailedAnalysis)}
                                                </div>
                                            </div>
                                        )}

                                        {/* Risk Factors & Actions Grid */}
                                        <div className="grid gap-3 grid-cols-1 md:grid-cols-2 pt-1">
                                            {/* Operational Risk Factors */}
                                            <div className="space-y-2">
                                                <h4 className="text-[10px] font-bold uppercase tracking-wider text-rose-500 flex items-center gap-1.5">
                                                    <AlertTriangle className="h-3 w-3" /> Operational Bottlenecks
                                                </h4>
                                                <div className="space-y-2">
                                                    {(insights.keyExposures || []).map((exp, idx) => {
                                                        const isObj = typeof exp === 'object' && exp !== null;
                                                        const finding = isObj ? (exp as AIObservation).finding : String(exp);
                                                        const evidence = isObj ? (exp as AIObservation).supportingEvidence : '';
                                                        const impact = isObj ? (exp as AIObservation).impactLevel : 'high';
                                                        const category = isObj ? (exp as AIObservation).category : 'Bottleneck';

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
                                                                        className={`text-[8px] uppercase font-bold ${
                                                                            impact === 'high'
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
                                                        const owner = isObj ? (act as AIObservation).suggestedOwner : 'Operations';

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
                                                General overview of warehouse efficiency and primary bottleneck observations.
                                            </p>
                                        </div>

                                        <div className="rounded-xl border bg-card p-4 space-y-2 shadow-xs">
                                            <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-700 dark:text-indigo-300">
                                                Summary
                                            </h3>
                                            <div className="text-xs text-foreground/90 leading-relaxed font-normal">
                                                {renderFormattedText(insights.summary)}
                                            </div>
                                        </div>

                                        {insights.keyHighlights && (
                                            <div className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                                                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                                    Key Operational Highlights
                                                </h3>
                                                <ul className="space-y-2 text-xs text-foreground/90">
                                                    {insights.keyHighlights.map((hl, idx) => (
                                                        <li key={idx} className="flex items-start gap-2">
                                                            <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600 shrink-0 mt-0.5" />
                                                            <span className="leading-relaxed font-normal">{hl}</span>
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
            </motion.div>
        </div>
    );
};
