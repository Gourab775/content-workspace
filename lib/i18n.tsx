'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type Locale = 'en';

export const translations = {
  en: {
    title: 'Content Creator',
    topic: 'Topic',
    topicPlaceholder: 'e.g., AI in Healthcare 2024',
    keywords: 'Keywords',
    keywordsPlaceholder: 'comma-separated keywords',
    style: 'Style',
    styleOptions: {
      informative: 'Informative',
      persuasive: 'Persuasive',
      technical: 'Technical',
      casual: 'Casual',
    },
    length: 'Length',
    lengthOptions: {
      short: 'Short (~800 words)',
      medium: 'Medium (~2000 words)',
      long: 'Long (~4000 words)',
    },
    generateArticle: 'Generate Article',
    generateOutline: 'Generate Outline',
    generating: 'Generating...',
    stop: 'Stop',
    newArticle: 'New Article',
    workflow: 'Workflow',
    research: 'Research',
    outline: 'Outline',
    writing: 'Writing',
    review: 'Review',
    seo: 'SEO',
    seoAnalysis: 'SEO Analysis',
    seoScore: 'SEO Score',
    optimizeSeo: 'Optimize SEO',
    seoEmpty: 'Generate content to see article stats',
    readyToCreate: 'Ready to Create',
    readyToCreateDesc: 'Enter a topic and click "Generate Article" to start creating AI-powered content with research, outlines, and SEO optimization.',
    keywordDensity: 'Keyword Density',
    readability: 'Readability',
    wordCount: 'Word Count',
    headings: 'Heading Structure',
    suggestions: 'Suggestions',
    poweredBy: 'Powered by EdgeOne AI',
    copyArticle: 'Copy Article',
    copied: 'Copied',
    copy: 'Copy',
    focusMode: 'Focus Mode',
    exitFocusMode: 'Exit Focus',
    tokens: 'Token Usage',
    inputTokens: 'Input',
    outputTokens: 'Output',
    totalTokens: 'Total',
    refine: 'Refine',
    refineLabel: 'Refine article',
    refinePlaceholder: 'e.g., Expand the second paragraph',
    refining: 'Refining...',
    history: 'Article History',
    noHistory: 'No articles saved yet',
    export: 'Export',
    copyMarkdown: 'Copy Markdown',
    copyHtml: 'Copy HTML',
    copyText: 'Copy Plain Text',
    downloadMd: 'Download .md',
    articleStats: 'Article Stats',
    characters: 'Characters',
    paragraphs: 'Paragraphs',
    readingTime: 'Reading Time',
    min: 'min',
    outlineNav: 'Outline',
    save: 'Save',
    saved: 'Saved',
    delete: 'Delete',
    loadArticle: 'Load article',
    autoSaved: 'Auto-saved',
    version: 'Version',
    versions: 'versions',
    versionHistory: 'Version History',
    modifySection: 'Modify section',
    fullArticle: 'Full article',
    selectSection: 'Select section to modify',
    currentVersion: 'Current version',
    restoreVersion: 'Restore version',
    sectionMode: 'Section mode',
    noSections: 'No sections found',
    modifying: 'Modifying...',
    statsEmpty: 'Generate content to see article stats',
    seoPanel: 'SEO Analysis',
    seoPanelEmpty: 'Generate content for SEO analysis',
    seoKeywordDensity: 'Keyword Density',
    seoReadability: 'Readability',
    seoHeadingStructure: 'Heading Structure',
    seoSuggestions: 'Suggestions',
    seoRunAnalysis: 'Analyze SEO',
    seoAnalyzing: 'Analyzing...',
    outlineStep: 'Outline Review',
    confirmOutline: 'Confirm & Start Writing',
    regenerateOutline: 'Regenerate Outline',
    skipOutline: 'Skip, generate directly',
    outlineTitle: 'Article Outline',
    estimatedWords: 'Estimated words',
    generatingOutline: 'Generating outline...',
    outlineReady: 'Outline ready - review and confirm',
    preferences: 'Writing Preferences',
    savedPreferences: 'Preferences saved',
    suggestedKeywords: 'Recent keywords',
    recentTopics: 'Recent topics',
    customInstructions: 'Custom writing guidelines',
    preferencesLoaded: 'Your writing preferences loaded',
    agentMode: 'Generation Mode',
    modeLite: 'Lite',
    modeDeepAgent: 'DeepAgent',
    modeLiteDesc: 'Low token usage, fast generation',
    modeDeepAgentDesc: 'Full agent framework, richer features',
    keywordSuggestionHint: 'to accept',
    suggestingKeywords: 'AI suggesting keywords...',
    quotaExhausted: 'AI model quota exhausted. Please try again later or upgrade your plan.',
    requestFailed: 'Request failed',
    generationFailed: 'Generation failed, please retry',
    blobNotConfigured: 'Storage is unavailable in this environment. Article history and preferences are disabled. Deploy to EdgeOne Makers to enable them automatically — no environment variables required.',
  },
};

interface I18nContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: typeof translations.en;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: translations.en,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  // Default to English for first-time visitors.
  const [locale, setLocale] = useState<Locale>('en');
  const t = translations[locale];
  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
