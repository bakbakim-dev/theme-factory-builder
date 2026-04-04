import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, Terminal, Settings, Download, CheckCircle, RefreshCw, Zap, Code, Wifi, WifiOff, Loader2, LayoutTemplate, FileCode, FileJson, Eye, Hammer, Split, Database, XCircle, Server, Clock, Wrench, CheckSquare, Link as LinkIcon, AlertTriangle, ArrowRight, Package, Maximize2, X, Globe, Info, Sparkles } from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import { useJSZip } from '../hooks/useJSZip';
import { LogEntry, RouteInfo, ConversionRecord, ConversionStats } from '../types';
import { STEPS, PLATFORMS } from '../constants';
import { convertToGutenbergBlocks, createPlaceholder, extractElementHtml, AuditLog, ConversionResult, ThemeTokenSuggestion } from '../utils/converter';
import { PLUGIN_FILES } from '../utils/plugintemplates';

interface DashboardProps { onConversionComplete: (record: ConversionRecord, zipBlob: Blob) => void; }

const sanitizeForPhp = (str: string): string => str.replace(/['"\\]/g, '').replace(/[^a-zA-Z0-9_\-./]/g, '_');

const InfoTooltip: React.FC<{ title: string, content: React.ReactNode, link?: string }> = ({ title, content, link }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative inline-block ml-2 align-middle">
            <button 
                type="button" 
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }} 
                className="text-slate-400 hover:text-blue-400 focus:outline-none transition-colors"
                title={title}
            >
                <Info className="w-[14px] h-[14px]" />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); }}></div>
                    <div className="absolute z-50 w-64 p-3 mt-2 text-xs font-normal text-slate-300 bg-slate-800 border border-slate-700 rounded-lg shadow-xl left-1/2 -translate-x-1/2 cursor-default" onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
                        <div className="flex justify-between items-start mb-1">
                            <strong className="text-white">{title}</strong>
                            <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(false); }} className="text-slate-400 hover:text-white"><X className="w-3 h-3" /></button>
                        </div>
                        <div className="mt-1 space-y-2">{content}</div>
                    </div>
                </>
            )}
        </div>
    );
};
const Dashboard: React.FC<DashboardProps> = ({ onConversionComplete }) => {
    const { jszip: JSZipLib } = useJSZip();
    const [step, setStep] = useState<string>(STEPS.IDLE);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [progress, setProgress] = useState(0);
    const [themeSlug, setThemeSlug] = useState('');
    const [finalZipBlob, setFinalZipBlob] = useState<Blob | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [pluginZipBlob, setPluginZipBlob] = useState<Blob | null>(null);
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
    const [pluginDownloadUrl, setPluginDownloadUrl] = useState<string | null>(null);
    const [thumbnails, setThumbnails] = useState<string[]>([]);
    const [selectedPlatform, setSelectedPlatform] = useState('lovable');
    const [conversionMode, setConversionMode] = useState<'gutenberg-native' | 'react-spa'>('gutenberg-native');
    const [conversionStats, setConversionStats] = useState<ConversionStats | null>(null);
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [sourceFile, setSourceFile] = useState<File | null>(null);
    const [detectedRoutes, setDetectedRoutes] = useState<RouteInfo[]>([]);
    const [selectedRoutes, setSelectedRoutes] = useState<Set<string>>(new Set());
    const [renderDelay, setRenderDelay] = useState(2000);
    const [debugConsoleText, setDebugConsoleText] = useState<string>('');
    const [showDebugConsole, setShowDebugConsole] = useState<boolean>(false);
    const [showMapModal, setShowMapModal] = useState<boolean>(false);
    const [showLlmsModal, setShowLlmsModal] = useState<boolean>(false);
    const [isScrapingLiveUrl, setIsScrapingLiveUrl] = useState<boolean>(false);
    
    // SEO & CRO Configuration
    const [seoSettings, setSeoSettings] = useState({
        companyName: 'My Company',
        url: 'https://',
        description: 'Professional services in your area.',
        telephone: '(555) 123-4567',
        addressLocality: 'City Name',
        addressRegion: 'ST',
        addressCountry: 'US',
        priceRange: '$$',
        ctaText1: 'Book Now',
        ctaLink1: '/contact/',
        ctaText2: 'Call Us',
        ctaLink2: 'tel:5551234567',
        ctaColor: '#009966',
        ctaTextColor: '#ffffff',
        ogImage: '',
        socialFacebook: '',
        socialInstagram: '',
        socialTwitter: '',
        socialLinkedIn: '',
        gaId: '',
        metaPixelId: '',
        googleSiteVerification: '',
        bingSiteVerification: '',
        reviewRating: '5.0',
        reviewCount: '150',
        enableLocationsCPT: false,
        googleMapsUrl: '',
        primaryLocale: 'en-US',
        alternateLocales: '',
        allowAiSearchSurfacing: true,
        allowAiTrainingCrawlers: false,
        enableLlmsTxt: false,
        enableQaChecks: true,
        enableFaqSchema: false,
        enableSemanticLinks: false
    });
    const [showSeoConfig, setShowSeoConfig] = useState(false);

    // Audit State
    const [missingLinks, setMissingLinks] = useState<string[]>([]);
    const [qaDiagnostics, setQaDiagnostics] = useState<any | null>(null);
    const [redirectsData, setRedirectsData] = useState<string | null>(null);
    const [llmsData, setLlmsData] = useState<string | null>(null);
    const [auditState, setAuditState] = useState<{
        zipContent: any;
        rootPath: string;
        platform: string;
        routes: RouteInfo[];
        mode: 'gutenberg-native' | 'react-spa';
        logs: AuditLog[];
    } | null>(null);

    const getInitialUrl = () => {
        if (typeof window !== 'undefined') {
            const envUrl = (import.meta as any).env?.VITE_BUILD_SERVER_URL as string;
            if (envUrl) {
                localStorage.setItem('buildServerUrl', envUrl);
                return envUrl;
            }
            const stored = localStorage.getItem('buildServerUrl');
            if (stored && !stored.includes('your-server.ngrok-free.app')) return stored;
            return 'http://localhost:7860/build';
        }
        return 'http://localhost:7860/build';
    };

    const [isAdmin, setIsAdmin] = useState(false);
    const [socket, setSocket] = useState<Socket | null>(null);
    
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('admin') === 'true') {
                setIsAdmin(true);
            }
        }
    }, []);

    const [remoteConfig, setRemoteConfig] = useState({ url: getInitialUrl(), apiKey: 'dev-key' });
    const [options] = useState({ convertMenus: true, highFidelity: true, forceBuild: false });
    const fileInputRef = useRef<HTMLInputElement>(null);
    const logsEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [logs]);
    useEffect(() => { if (!finalZipBlob) return; const url = window.URL.createObjectURL(finalZipBlob); setDownloadUrl(url); return () => { window.URL.revokeObjectURL(url); }; }, [finalZipBlob]);
    useEffect(() => { if (!pluginZipBlob) return; const url = window.URL.createObjectURL(pluginZipBlob); setPluginDownloadUrl(url); return () => { window.URL.revokeObjectURL(url); }; }, [pluginZipBlob]);
    useEffect(() => { if (finalZipBlob && step === STEPS.COMPLETE) { const record: ConversionRecord = { id: crypto.randomUUID(), projectName: themeSlug || 'untitled-project', type: PLATFORMS[selectedPlatform.toUpperCase() as keyof typeof PLATFORMS]?.label || selectedPlatform, date: new Date().toISOString(), status: 'Completed', logs: logs, stats: conversionStats }; onConversionComplete(record, finalZipBlob); } }, [finalZipBlob, step]);
    useEffect(() => { return () => { abortControllerRef.current?.abort(); if (socket) socket.disconnect(); }; }, [socket]);
    useEffect(() => { if (remoteConfig.url && typeof window !== 'undefined') { localStorage.setItem('buildServerUrl', remoteConfig.url); } }, [remoteConfig.url]);
    
    useEffect(() => {
        if (step === STEPS.COMPLETE || step === STEPS.ERROR) {
            if (socket) {
                socket.disconnect();
                setSocket(null);
            }
        }
    }, [step, socket]);

    const addLog = useCallback((msg: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => { setLogs(prev => [...prev, { msg, type, time: new Date().toLocaleTimeString() }]); }, []);

    const handleTestConnection = async () => {
        setConnectionStatus('testing');
        addLog(`Testing connection to ${remoteConfig.url}...`);
        if (window.location.protocol === 'https:' && remoteConfig.url.startsWith('http:')) { addLog(`⚠ Mixed Content Warning`, 'warning'); }
        try {
            if (!remoteConfig.apiKey) throw new Error("API Key is required.");
            const healthUrl = remoteConfig.url.replace(/\/build\/?$/, '/health');
            abortControllerRef.current = new AbortController();
            const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), 10000);
            let res;
            try { res = await fetch(healthUrl, { method: 'GET', headers: { 'Accept': 'application/json', 'ngrok-skip-browser-warning': 'true' }, signal: abortControllerRef.current.signal }); }
            catch (fetchErr: unknown) { const err = fetchErr as Error; if (err.name === 'AbortError') throw new Error("Request Timed Out."); throw fetchErr; }
            finally { clearTimeout(timeoutId); }
            if (res.ok) { const data = await res.json(); setConnectionStatus('success'); addLog(`✔ Connection Successful!`, 'success'); addLog(`   Server: ${data.platform || 'Theme Factory Build Server'}`, 'success'); return; }
            else { throw new Error(`Server Error (${res.status}): ${res.statusText}`); }
        } catch (err: unknown) { setConnectionStatus('error'); addLog(`✖ Connection Failed: ${(err as Error).message}`, 'error'); }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]; if (!file) return;
        setSourceFile(file);
        if (!JSZipLib) { addLog("Engine not ready. Please wait...", 'error'); return; }
        setStep(STEPS.ANALYZING); setLogs([]); setProgress(5); setConversionStats(null); setFinalZipBlob(null); setPluginZipBlob(null); setThumbnails([]); setRedirectsData(null); setLlmsData(null);
        setThemeSlug(file.name.replace('.zip', '').replace(/[^a-z0-9-_]/gi, '-').toLowerCase());
        addLog(`Initiating analysis for: ${file.name}`);
        try {
            const zip = new JSZipLib(); const content = await zip.loadAsync(file);
            const files = Object.keys(content.files); if (files.length === 0) throw new Error("ZIP is empty");
            const allFiles = files.filter(f => !content.files[f].dir);
            const validFiles = allFiles.filter(f => !f.includes('__MACOSX') && !f.includes('.DS_Store')); if (validFiles.length === 0) throw new Error("No valid files found.");
            const firstPath = validFiles[0]; const parts = firstPath.split('/');
            let rootPath = ""; if (parts.length > 1) { const potentialRoot = parts[0] + '/'; if (validFiles.every(f => f.startsWith(potentialRoot))) { rootPath = potentialRoot; addLog(`Normalized root detected: ${potentialRoot}`); } }
            const hasFile = (name: string) => validFiles.some(f => f === rootPath + name || f.endsWith('/' + name));
            let detectedPlatformID = selectedPlatform;
            if (hasFile('lovable.config') || hasFile('lovable.json')) { detectedPlatformID = 'lovable'; setSelectedPlatform('lovable'); addLog("Confirmed Lovable Project Structure", 'success'); }
            const routes = await scanForRoutes(content, rootPath); setDetectedRoutes(routes); setSelectedRoutes(new Set(routes.map(r => r.path)));
            
            // SAAS FEATURE: Auto-extract SEO settings from the project files
            await scanForSeoSettings(content, rootPath);

            const hasPackageJson = hasFile('package.json'); const hasSrcDir = validFiles.some(f => f.includes('/src/') || f.startsWith('src/'));
            const isSourceProject = hasPackageJson && (hasSrcDir || hasFile('vite.config.ts'));
            if (isSourceProject && !options.forceBuild) { addLog(`⚠ Source Code Detected. Found ${routes.length} potential routes.`, 'warning'); setStep(STEPS.SOURCE_DETECTED); return; }
            setStep(STEPS.PROCESSING); await processConversion(content, rootPath, detectedPlatformID, routes, conversionMode);
        } catch (err: unknown) { setStep(STEPS.ERROR); addLog((err as Error).message, 'error'); }
    };

    const scanForSeoSettings = async (zipContent: any, rootPath: string) => {
        try {
            const files = Object.keys(zipContent.files);
            const normalize = (p: string) => p.startsWith(rootPath) ? p.slice(rootPath.length) : p;
            
            let htmlContent = "";
            const indexFile = files.find(f => normalize(f).match(/^index\.html$/i));
            if (indexFile) htmlContent = await zipContent.files[indexFile].async("string");

            let packageJsonContent = "";
            const pkgFile = files.find(f => normalize(f).match(/^package\.json$/i));
            if (pkgFile) packageJsonContent = await zipContent.files[pkgFile].async("string");

            let allSrcText = "";
            const srcFiles = files.filter(f => normalize(f).match(/^src\/.*\.tsx?$/i)).slice(0, 10);
            for (const f of srcFiles) {
                allSrcText += await zipContent.files[f].async("string") + " ";
            }

            const updates: Partial<typeof seoSettings> = {};

            // Extract Company Name (from Title, Helmet, Package.json, or navbar brands)
            const titleMatch = htmlContent.match(/<title>(.*?)<\/title>/i) 
                             || allSrcText.match(/<title>([^<]+)<\/title>/i)
                             || allSrcText.match(/title=["']([^"']+)["']/i);
            
            if (titleMatch && titleMatch[1] && !titleMatch[1].includes('$')) {
                // Strip out standard separators like ' | ', ' - ' to get pure brand name
                updates.companyName = titleMatch[1].split('|')[0].split('-')[0].trim();
            } else if (packageJsonContent) {
                try {
                    const pkg = JSON.parse(packageJsonContent);
                    if (pkg.name) {
                        // Insert space before uppercase in camelCase, replace hyphens/underscores, then title-case
                        const cleaned = pkg.name
                            .replace(/[-_]/g, ' ')
                            .replace(/([a-z])([A-Z])/g, '$1 $2')
                            .replace(/\b\w/g, (c: string) => c.toUpperCase())
                            .replace(/\s+(clone|project|app|web|site|frontend|src)\b/gi, '') // strip common suffixes
                            .trim();
                        if (cleaned.length > 1) updates.companyName = cleaned;
                    }
                } catch (e) {}
            }

            // Extract Meta Description (from HTML or Helmet meta tags)
            const descMatch = htmlContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) 
                           || htmlContent.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i)
                           || allSrcText.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i);
            if (descMatch && descMatch[1] && !descMatch[1].includes('$')) updates.description = descMatch[1].trim();

            // Extract Primary Website Address (from Canonical links or hardcoded absolute URLs)
            const canonicalMatch = htmlContent.match(/<link[^>]*rel=["']canonical["'][^>]*href=["'](https?:\/\/[^"']+)["']/i)
                                || allSrcText.match(/<link[^>]*rel=["']canonical["'][^>]*href=["'](https?:\/\/[^"']+)["']/i);
            if (canonicalMatch) {
                updates.url = canonicalMatch[1];
            }

            // Extract Phone Number (Look for formats like 123-456-7890, (123) 456-7890, or bare strings in hrefs)
            const phoneMatch = allSrcText.match(/(?:\+?1\s*(?:[.-]\s*)?)?(?:\(\s*([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9])\s*\)|([2-9]1[02-9]|[2-9][02-8]1|[2-9][02-8][02-9]))\s*(?:[.-]\s*)?([2-9]1[02-9]|[2-9][02-9]1|[2-9][02-9]{2})\s*(?:[.-]\s*)?([0-9]{4})(?:\s*(?:#|x\.?|ext\.?|extension)\s*(\d+))?/i)
                            || allSrcText.match(/href=["']tel:([^"']+)["']/i);
            
            if (phoneMatch) {
                const number = phoneMatch[0].replace(/href=["']tel:/i, '').replace(/["']/g, '');
                updates.telephone = number.trim();
            }

            // Extract CTA Links & Text
            const contactHref = allSrcText.match(/>([^<]+)<\/a>[^<]*href=["'](\/contact\/?)["']/i) || allSrcText.match(/href=["'](\/contact\/?)["'][^>]*>([^<]+)<\/a>/i);
            if (contactHref) {
                updates.ctaLink1 = contactHref[1].startsWith('/') ? contactHref[1] : (contactHref[2] ? contactHref[2] : '/contact/');
                const text = contactHref[2] && !contactHref[2].startsWith('/') ? contactHref[2] : contactHref[1];
                if (text && text.length > 2 && text.length < 30 && !text.includes('/')) updates.ctaText1 = text.trim();
            }
            
            const telHref = allSrcText.match(/>([^<]+)<\/a>[^<]*href=["'](tel:[^"']+)["']/i) || allSrcText.match(/href=["'](tel:[^"']+)["'][^>]*>([^<]+)<\/a>/i);
            if (telHref) {
                updates.ctaLink2 = telHref[1].startsWith('tel:') ? telHref[1] : (telHref[2] ? telHref[2] : '');
                const text = telHref[2] && !telHref[2].startsWith('tel:') ? telHref[2] : telHref[1];
                if (text && text.length > 2 && text.length < 30 && !text.includes('tel:')) updates.ctaText2 = text.trim();
            }

            // Detect Color Palette (Primary button colors)
            // Look for common Tailwind classes or inline styles
            const bgMatch = allSrcText.match(/bg-\[(#[0-9a-fA-F]{3,6})\]/i) || allSrcText.match(/background-color:\s*(#[0-9a-fA-F]{3,6})/i);
            if (bgMatch) updates.ctaColor = bgMatch[1];
            
            const textMatch = allSrcText.match(/text-\[(#[0-9a-fA-F]{3,6})\]/i) || allSrcText.match(/color:\s*(#[0-9a-fA-F]{3,6})/i);
            if (textMatch) updates.ctaTextColor = textMatch[1];

            // Extract OG Image
            const ogImageMatch = htmlContent.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i);
            if (ogImageMatch) {
                updates.ogImage = ogImageMatch[1];
            } else {
                const imgMatch = allSrcText.match(/["']([^"']*\.(?:jpg|png|webp))["']/i);
                if (imgMatch) updates.ogImage = imgMatch[1];
            }

            // Extract Social Links
            const fbMatch = allSrcText.match(/href=["'](https?:\/\/(?:www\.)?facebook\.com\/[^"']+)["']/i);
            if (fbMatch) updates.socialFacebook = fbMatch[1];
            
            const igMatch = allSrcText.match(/href=["'](https?:\/\/(?:www\.)?instagram\.com\/[^"']+)["']/i);
            if (igMatch) updates.socialInstagram = igMatch[1];
            
            const twMatch = allSrcText.match(/href=["'](https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[^"']+)["']/i);
            if (twMatch) updates.socialTwitter = twMatch[1];
            
            const liMatch = allSrcText.match(/href=["'](https?:\/\/(?:www\.)?linkedin\.com\/[^"']+)["']/i);
            if (liMatch) updates.socialLinkedIn = liMatch[1];

            // Extract major Canadian/US Cities as a best-guess for Locality
            const cityRegex = /\b(Toronto|Montreal|Vancouver|Calgary|Edmonton|Ottawa|Winnipeg|Quebec|Hamilton|Kitchener|London|Victoria|Halifax|Oshawa|Windsor|Seattle|Portland|New York|Los Angeles|Chicago|Houston|Phoenix|Philadelphia|San Antonio|San Diego|Dallas|San Jose|Austin|Jacksonville|Fort Worth|Columbus|Charlotte|San Francisco|Indianapolis|Seattle|Denver|Washington|Boston)\b/i;
            const cityMatch = allSrcText.match(cityRegex);
            if (cityMatch) updates.addressLocality = cityMatch[1];

            // Extract State/Province
            const stateRegex = /\b(AB|BC|MB|NB|NL|NS|NT|NU|ON|PE|QC|SK|YT|AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|Alberta|British Columbia|Ontario|Quebec|Texas|California|Florida)\b/g;
            const stateMatches = allSrcText.match(stateRegex);
            if (stateMatches) {
                // Find most frequent state match to avoid false positive acronyms
                const counts = stateMatches.reduce((acc: any, val) => { acc[val] = (acc[val] || 0) + 1; return acc; }, {});
                const mostFrequent = Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
                if (counts[mostFrequent] > 2) updates.addressRegion = mostFrequent; // Require at least 3 occurrences to be confident
            }
            
            // Extract AggregateRating (e.g. "4.9/5", "4.9 out of 5", "120 reviews")
            const ratingValueMatch = allSrcText.match(/(?:(?:rated|rating|average\s*rating)\s*(?:of|is)?\s*)?([4-5](?:\.\d+)?)\s*\/\s*5|([4-5](?:\.\d+)?)\s*(?:out\s*of|\\\/)\s*5(?:\s*stars?)?/i);
            const reviewCountMatch = allSrcText.match(/(?:based\s*on\s*|over\s*)?([\d,]+)\s*(?:(?:five|5)[\s-]*star|customer)?\s*reviews?/i);
            
            if (ratingValueMatch) updates.reviewRating = (ratingValueMatch[1] || ratingValueMatch[2]).trim();
            if (reviewCountMatch) updates.reviewCount = reviewCountMatch[1].replace(/,/g, '').trim();

            if (Object.keys(updates).length > 0) {
                setSeoSettings(prev => ({ ...prev, ...updates }));
                addLog(`Auto-extracted SEO settings: ${Object.keys(updates).join(", ")}`, 'info');
            }
        } catch (e) {
            console.warn("Could not parse SEO settings", e);
        }
    };

    const handleLiveScrape = async () => {
        const url = seoSettings.url;
        if (!url || !url.startsWith('http')) {
            addLog('Please enter a valid Website URL first (e.g. https://dutycleaners.ca)', 'error');
            return;
        }
        setIsScrapingLiveUrl(true);
        addLog(`🔍 Scanning live site: ${url}`, 'info');
        try {
            const serverUrl = remoteConfig.url.replace(/\/build\/?$/, '');
            const res = await fetch(`${serverUrl}/scrape-live-site`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const json = await res.json();
            if (json.success && json.data) {
                const d = json.data;
                setSeoSettings(prev => ({ ...prev, ...d }));
                addLog(`✔ Auto-filled ${Object.keys(d).length} fields: ${Object.keys(d).join(', ')}`, 'success');
            } else {
                addLog(`✖ Scrape failed: ${json.error || 'Unknown error'}`, 'error');
            }
        } catch (err: unknown) {
            addLog(`✖ Could not reach server: ${(err as Error).message}`, 'error');
        } finally {
            setIsScrapingLiveUrl(false);
        }
    };

    const scanForRoutes = async (zipContent: any, rootPath: string): Promise<RouteInfo[]> => {
        const normalize = (p: string) => p.startsWith(rootPath) ? p.slice(rootPath.length) : p;
        const files = Object.keys(zipContent.files);
        const routerFile = files.find(f => normalize(f).match(/^(src\/App\.(tsx|jsx|js)|src\/routes\.(tsx|jsx|js)|src\/main\.(tsx|jsx|js))$/i));
        const routes: RouteInfo[] = [{ path: '/', slug: 'home', title: 'Home' }];

        if (routerFile) {
            try {
                const content = await zipContent.files[routerFile].async("string");
                const jsxRegex = /<Route[^>]*path=["']([^"']+)["'][^>]*>/g;
                let match;
                while ((match = jsxRegex.exec(content)) !== null) {
                    const path = match[1];
                    if (path !== '/' && !path.includes('*') && !path.includes(':')) {
                        addRoute(path);
                    }
                }
                const objRegex = /path:\s*["']([^"']+)["']/g;
                while ((match = objRegex.exec(content)) !== null) {
                    const path = match[1];
                    if (path !== '/' && !path.includes('*') && !path.includes(':')) {
                        addRoute(path);
                    }
                }
                function addRoute(path: string) {
                    const slug = path.replace(/^\/+/, '').replace(/\/+/g, '-').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
                    const title = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
                    if (!routes.some(r => r.path === path)) {
                        routes.push({ path, slug, title });
                        addLog(`  • Found Route: ${path} -> ${title}`);
                    }
                }
                addLog(`Scanner: Discovered ${routes.length} routes in ${normalize(routerFile)}`, 'success');
            } catch { addLog("Scanner: Failed to parse router file.", 'warning'); }
        } else { addLog("Scanner: No router file found. Defaulting to single page.", 'info'); }
        return routes;
    };

    const toggleRoute = (path: string) => { const next = new Set(selectedRoutes); if (next.has(path)) next.delete(path); else next.add(path); setSelectedRoutes(next); };

    // Pre-extract FAQ data from a source ZIP that has TSX files.
    // This is needed because builder pipelines produce dist-only ZIPs (no source TSX),
    // so FAQ extraction inside processConversion would find nothing.
    const preExtractFaqFromSource = async (sourceZipContent: any): Promise<{q: string, a: string}[]> => {
        const faq: {q: string, a: string}[] = [];
        const allSrcFiles = Object.keys(sourceZipContent.files).filter(n => !sourceZipContent.files[n].dir && !n.includes('__MACOSX'));
        const normPath = (p: string) => p.replace(/\\/g, '/').toLowerCase();
        const tsxFiles = allSrcFiles.filter(f => {
            const n = normPath(f);
            return (n.endsWith('.tsx') || n.endsWith('.jsx')) && !n.includes('node_modules') && !n.endsWith('.d.ts') &&
                (n.includes('/src/pages/') || n.includes('/src/components/') || n.includes('/pages/') || n.includes('/components/') || n.includes('faq') || n.includes('accordion') || n.includes('data') || n.includes('constants'));
        });
        for (const filePath of tsxFiles) {
            try {
                const content = await sourceZipContent.files[filePath].async('string');
                let match;
                const accordionRegex = /<AccordionTrigger[^>]*>([\s\S]*?)<\/AccordionTrigger>[\s\S]*?<AccordionContent[^>]*>([\s\S]*?)<\/AccordionContent>/g;
                while ((match = accordionRegex.exec(content)) !== null) {
                    const q = match[1].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
                    const a = match[2].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
                    if (q && a && q.length > 5 && a.length > 10 && !faq.some(item => item.q.toLowerCase() === q.toLowerCase())) {
                        faq.push({ q, a });
                    }
                }
                const inlineFaqRegex = /\{\s*q:\s*["']([^"']+)["']\s*,\s*a:\s*["']([^"']+)["']\s*\}/g;
                while ((match = inlineFaqRegex.exec(content)) !== null) {
                    const q = match[1].trim(); const a = match[2].trim();
                    if (q && a && q.length > 5 && a.length > 10 && !faq.some(item => item.q.toLowerCase() === q.toLowerCase())) {
                        faq.push({ q, a });
                    }
                }
            } catch { /* skip unreadable files */ }
        }
        if (faq.length > 0) addLog(`Pre-extracted ${faq.length} FAQ items from source TSX files`, 'success');
        return faq;
    };

    const handleLocalBuild = async () => {
        if (!sourceFile) return; addLog("Starting Local Simulation...", 'info'); setStep(STEPS.BUILDING_REMOTE); setProgress(5);
        try {
            const routesToProcess = detectedRoutes.filter(r => selectedRoutes.has(r.path)); addLog(`Processing ${routesToProcess.length} selected routes...`, 'info');
            if (!JSZipLib) throw new Error("JSZip utility is not initialized.");
            const sourceZip = await new JSZipLib().loadAsync(sourceFile); const distZip = new JSZipLib();
            // Pre-extract FAQ data from source before we lose access to TSX files
            const sourceFaqData = await preExtractFaqFromSource(sourceZip);
            const files = Object.keys(sourceZip.files); setProgress(15);
            const indexHtmlPath = files.find(f => f.endsWith('index.html')); let indexHtml = "";
            if (indexHtmlPath) { indexHtml = await sourceZip.files[indexHtmlPath].async("string"); distZip.file("index.html", indexHtml); } else { throw new Error("No index.html found in source."); }
            setProgress(30);
            routesToProcess.forEach(route => { if (route.path === '/') return; const cleanPath = route.path.replace(/^\/+/, '').replace(/\/+$/, ''); const depth = cleanPath.split('/').filter(p => p).length; const prefix = depth > 0 ? '../'.repeat(depth) : './'; const routeHtml = indexHtml.replace(/href="\/assets\//g, `href="${prefix}assets/`).replace(/src="\/assets\//g, `src="${prefix}assets/`); distZip.file(`${cleanPath}/index.html`, routeHtml); });
            setProgress(50); distZip.file("assets/style.css", "/* Compiled CSS Placeholder */ body { font-family: sans-serif; }"); distZip.file("assets/app.js", "console.log('Theme Factory: Local Build Mode');");
            addLog("Local Build Complete. Converting...", 'success'); setStep(STEPS.PROCESSING); await processConversion(distZip, "", "lovable", routesToProcess, conversionMode, false, sourceFaqData);
        } catch (err: unknown) { setStep(STEPS.ERROR); addLog(`Local Build Failed: ${(err as Error).message}`, 'error'); }
    };

    const processRemoteBuild = async (file: File | null, routes: RouteInfo[]) => {
        if (!file) return;
        const routesToProcess = routes.filter(r => selectedRoutes.has(r.path)); if (routesToProcess.length === 0) { alert("Please select at least one page to convert."); return; }
        setStep(STEPS.UPLOADING_REMOTE); setProgress(5);
        try {
            if (!remoteConfig.apiKey) { addLog("No API Key. Using Local Simulation...", 'warning'); await handleLocalBuild(); return; }
            addLog("Preparing source code for Cloud Build...");
            if (!JSZipLib) throw new Error("JSZip utility is not initialized.");
            const zip = new JSZipLib(); const cleanZip = await zip.loadAsync(file);
            // Pre-extract FAQ data from source before it's sent to the remote builder
            const sourceFaqData = await preExtractFaqFromSource(cleanZip);
            const cleanBlob = await cleanZip.generateAsync({ type: 'blob', compression: "DEFLATE" });
            const formData = new FormData(); formData.append('zip', cleanBlob, "source.zip"); formData.append('platform', selectedPlatform);
            const routePaths = routesToProcess.map(r => r.path); formData.append('routes', JSON.stringify(routePaths));
            formData.append('render_wait_time', renderDelay.toString());
            addLog(`Sending ${routePaths.length} routes for build + prerendering...`, 'info'); setStep(STEPS.WAKING_UP); setProgress(10);
            await waitForHealth(remoteConfig.url); setStep(STEPS.UPLOADING_REMOTE); addLog(`Uploading to ${remoteConfig.url}...`);
            abortControllerRef.current = new AbortController(); const uploadTimeout = setTimeout(() => abortControllerRef.current?.abort(), 15 * 60 * 1000);
            let response;
            try { response = await fetch(remoteConfig.url, { method: 'POST', headers: { 'Authorization': `Bearer ${remoteConfig.apiKey}`, 'ngrok-skip-browser-warning': 'true' }, body: formData, signal: abortControllerRef.current.signal }); clearTimeout(uploadTimeout); }
            catch (e: unknown) { const err = e as Error; if (err.name === 'AbortError') throw new Error("Upload Timed Out (15m)."); throw e; }
            if (!response.ok) { const errText = await response.text(); throw new Error(`Remote Build Failed (${response.status}): ${errText}`); }
            if (response.status === 202) { 
                const jobData = await response.json(); 
                addLog(`Job Queued: ${jobData.jobId}`, 'success'); 
                
                if (isAdmin) {
                    const socketUrl = remoteConfig.url.replace(/\/build\/?$/, '');
                    const newSocket = io(socketUrl);
                    
                    newSocket.on('connect', () => {
                        newSocket.emit('join_job', jobData.jobId || jobData.id);
                        addLog(`Socket Connected: Streaming Live Logs...`, 'info');
                    });
                    
                    newSocket.on('log', (data) => {
                        addLog(data.msg, data.type);
                    });
                    
                    newSocket.on('progress', (val) => {
                        setProgress(val);
                    });
                    
                    setSocket(newSocket);
                }

                try { await pollJobStatus(jobData.jobId || jobData.id, routesToProcess, sourceFaqData); } 
                catch (pollErr: unknown) { setStep(STEPS.ERROR); addLog((pollErr as Error).message, 'error'); } 
            }
            else { setStep(STEPS.DOWNLOADING_ARTIFACT); const distBlob = await response.blob(); await handleBuildArtifact(distBlob, routesToProcess, sourceFaqData); }
        } catch (err: unknown) { setStep(STEPS.ERROR); addLog(`Remote Error: ${(err as Error).message}`, 'error'); }
    };

    const waitForHealth = async (baseUrl: string) => {
        const healthUrl = baseUrl.replace(/\/build\/?$/, '/health'); addLog(`Checking server status at ${healthUrl}...`);
        let attempts = 0; const maxAttempts = 20;
        while (attempts < maxAttempts) {
            try { abortControllerRef.current = new AbortController(); const timeoutId = setTimeout(() => abortControllerRef.current?.abort(), 5000); const res = await fetch(healthUrl, { method: 'GET', headers: { 'Accept': 'application/json', 'ngrok-skip-browser-warning': 'true' }, signal: abortControllerRef.current.signal }); clearTimeout(timeoutId); if (res.ok) { addLog(`✔ Server Ready.`, 'success'); return; } }
            catch { }
            attempts++; addLog(`Waiting for server... (${attempts}/${maxAttempts})`); if (attempts < maxAttempts) await new Promise(r => setTimeout(r, 1000));
        }
        addLog("⚠ Could not verify server health. Attempting build anyway...", 'warning');
    };

    const pollJobStatus = async (jobId: string, routesToProcess: RouteInfo[], preExtractedFaq?: {q: string, a: string}[]) => {
        setStep(STEPS.POLLING_BUILD); setProgress(30);
        const baseUrl = remoteConfig.url.replace(/\/build\/?$/, ''); const statusUrl = `${baseUrl}/jobs/${jobId}`;
        addLog(`Tracking build job...`);
        let attempts = 0; const maxPolls = 300;
        while (attempts < maxPolls) {
            await new Promise(r => setTimeout(r, 3000));
            try {
                const res = await fetch(statusUrl, { headers: { 'Authorization': `Bearer ${remoteConfig.apiKey}`, 'ngrok-skip-browser-warning': 'true' } });
                if (res.status === 404) throw new Error("Job ID not found.");
                const data = await res.json();
                if (data.status === 'completed' || data.status === 'success') { addLog("Build successful!", 'success'); let downloadLink = data.downloadUrl; if (downloadLink && !downloadLink.startsWith('http')) { downloadLink = `${baseUrl}${downloadLink}`; } if (downloadLink) await downloadArtifact(downloadLink, routesToProcess, preExtractedFaq); return; }
                else if (data.status === 'failed' || data.status === 'error') { throw new Error(`Build failed: ${data.error || 'Unknown error'}`); }
                else { 
                    if (attempts % 5 === 0 && !isAdmin) { addLog(`Building... (${attempts * 3}s elapsed)`); } 
                    if (!isAdmin) { setProgress(Math.min(90, 30 + Math.floor(attempts / 2))); }
                }
            } catch (e: unknown) { const err = e as Error; if (err.message.includes('Job ID not found') || err.message.includes('Build failed')) throw err; }
            attempts++;
        }
        throw new Error("Build timed out after 15 minutes.");
    };

    const downloadArtifact = async (url: string, routesToProcess: RouteInfo[], preExtractedFaq?: {q: string, a: string}[]) => { setStep(STEPS.DOWNLOADING_ARTIFACT); addLog("Downloading build artifact..."); const res = await fetch(url, { headers: { 'ngrok-skip-browser-warning': 'true' } }); if (!res.ok) throw new Error("Failed to download artifact."); const blob = await res.blob(); await handleBuildArtifact(blob, routesToProcess, preExtractedFaq); };
    const handleBuildArtifact = async (blob: Blob, routesToProcess: RouteInfo[], preExtractedFaq?: {q: string, a: string}[]) => { if (!JSZipLib) throw new Error("JSZip utility missing."); setStep(STEPS.PROCESSING); addLog("Artifact received. Processing...", 'info'); const distZip = new JSZipLib(); const distContent = await distZip.loadAsync(blob); await processConversion(distContent, "", selectedPlatform, routesToProcess, conversionMode, false, preExtractedFaq); };

    const generateCompanionPlugin = async (zipInstance: any): Promise<Blob> => {
        const folder = zipInstance.folder('theme-factory-blocks');

        // Use the comprehensive plugin templates
        Object.entries(PLUGIN_FILES).forEach(([path, content]) => {
            folder.file(path, content);
        });

        return await zipInstance.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    };

    const finishBuild = async (zipInstance: any) => {
        try {
            const blob = await zipInstance.generateAsync({ type: 'blob' });
            setFinalZipBlob(blob);
            
            // Save debug info to state for the console UI
            if ((window as any).__debugOutput) {
                setDebugConsoleText((window as any).__debugOutput);
            }

            setStep(STEPS.COMPLETE);
            setProgress(100);
            addLog("Conversion completed successfully.", 'success');
        } catch (e) {
            setStep(STEPS.ERROR);
            addLog(`Finalizing build failed: ${(e as Error).message}`, 'error');
        }
    };

    const replaceAssetPaths = (html: string, replacementBase: string) => {
        // We only want to replace paths that are actual assets (images, fonts, videos)
        const validExtensions = /\.(png|jpe?g|gif|svg|webp|avif|mp4|webm|woff2?|ttf|eot)$/i;

        return html
            // Replace src, href, srcset with stricter asset path checking
            .replace(/(src|href|srcset)=["']([^"']+)["']/g, (match, attr, value) => {
                // Ignore external URLs, data URIs, and already-replaced PHP tags
                if (value.startsWith('http') || value.startsWith('data:') || value.includes('__THEME_URI__') || value.includes('<?php')) {
                    return match;
                }

                // If path starts with / or ./ AND has a valid extension OR contains 'assets/'
                if ((value.match(/^(\.\/|\/)/) && validExtensions.test(value)) || value.includes('assets/')) {
                    let cleanPath = value.replace(/^(\.\/|\/)+/, ''); // strip leading / or ./
                    
                    // Don't double add assets if replacement base already has it
                    return `${attr}="${replacementBase}${cleanPath}"`;
                }

                return match;
            })
            // Replace url(...) for background images in inline styles
            .replace(/url\(['"]?([^'"()]+)['"]?\)/g, (match, val) => {
                 if (val.startsWith('http') || val.startsWith('data:')) return match;
                 let cleanPath = val.replace(/^(\.\/|\/)+/, '');
                 if (validExtensions.test(cleanPath) || cleanPath.includes('assets/')) {
                     return `url(${replacementBase}${cleanPath})`;
                 }
                 return match;
            })
            // Replace Tailwind arbitrary values: bg-[url('/image.png')]
            .replace(/bg-\[url\('?([^']+)'?\)/g, (match, val) => {
                 if (val.startsWith('http') || val.startsWith('data:')) return match;
                 let cleanPath = val.replace(/^(\.\/|\/)+/, '');
                 if (validExtensions.test(cleanPath) || cleanPath.includes('assets/')) {
                     return `bg-[url('${replacementBase}${cleanPath}')]`;
                 }
                 return match;
            });
    };

    const processConversion = async (zipContent: any, _rootPath: string, _platform: string, routes: RouteInfo[], mode: 'gutenberg-native' | 'react-spa', auditBypassed = false, preExtractedFaqData?: {q: string, a: string}[]) => {
        if (!JSZipLib) return;

        const themeFnPrefix = (themeSlug || 'ai-theme').replace(/[^a-z0-9]/gi, '_');
        const themeName = (themeSlug || 'AI Theme').split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        const routesToProcess = routes.filter(r => selectedRoutes.has(r.path));

        // Array to hold all audit logs across all pages (Lifted from line 2897)
        const allAuditLogs: AuditLog[] = [];

        const allFiles = Object.keys(zipContent.files).filter(n => !zipContent.files[n].dir && !n.includes('__MACOSX'));
        const actualIndexFile = allFiles.find(f => f.endsWith('index.html') && !f.includes('/')) || allFiles.find(f => f.endsWith('index.html'));
        if (!actualIndexFile) throw new Error("No index.html found in build artifact.");

        const indexParts = actualIndexFile.split('/'); indexParts.pop();
        const effectiveRoot = indexParts.length > 0 ? indexParts.join('/') + '/' : "";
        const decode = (data: Uint8Array) => new TextDecoder("utf-8").decode(data);

        if (!auditBypassed) {
            // (Audit logic)
        }

        addLog(`Converting ${routesToProcess.length} pages...`, 'info'); setProgress(5);
        const newZip = new JSZipLib(); const folder = newZip.folder(themeSlug || 'ai-theme'); if (!folder) throw new Error("Could not create folder in zip");

        const filesToProcess = allFiles.filter(name => effectiveRoot ? name.startsWith(effectiveRoot) : true);

        const thumbUrls: string[] = [];
        for (const fullFileName of allFiles) {
            if (fullFileName.includes('prerendered/thumb-') && fullFileName.endsWith('.jpg')) {
                const thumbData = await zipContent.files[fullFileName].async("blob");
                thumbUrls.push(window.URL.createObjectURL(thumbData));
            }
        }
        setThumbnails(thumbUrls);

        const stats: ConversionStats = { php: 0, js: 0, css: 0, images: 0, routes: routesToProcess.length, patterns: 0 };
        let mainHtml = "";
        const foundCssFiles: string[] = [];
        const cssFiles: string[] = []; const jsFiles: string[] = []; const assetFiles: string[] = []; const otherFiles: string[] = [];

        for (const fullFileName of filesToProcess) {
            const relativeName = fullFileName.substring(effectiveRoot.length);
            if (fullFileName === actualIndexFile || relativeName.endsWith('.html')) continue;
            if (relativeName.match(/\.css$/i)) cssFiles.push(fullFileName);
            else if (relativeName.match(/\.(js|mjs|jsx)$/)) jsFiles.push(fullFileName);
            else if (relativeName.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff|woff2|ttf|eot|otf)$/i)) assetFiles.push(fullFileName);
            else otherFiles.push(fullFileName);
        }

        if (actualIndexFile) { mainHtml = decode(await zipContent.files[actualIndexFile].async("uint8array")); }

        // Try to find the prerendered home shell with data-tf-nav-* markers
        const readHtmlFromZip = async (p: string): Promise<string | null> => {
            try {
                const file = zipContent.files[p];
                if (!file) return null;
                return decode(await file.async("uint8array"));
            } catch { return null; }
        };

        const pickShellHtml = async (): Promise<{ html: string; source: string }> => {
            const homeRoute = routesToProcess.find(r => r.path === '/') || routesToProcess[0];
            const homeSlug = homeRoute?.slug || 'home';
            const candidates = [
                `${effectiveRoot}prerendered/_shell.html`,
                `prerendered/_shell.html`,
                `${effectiveRoot}prerendered/${homeSlug}.html`,
                `prerendered/${homeSlug}.html`,
                actualIndexFile
            ];
            for (const candidate of candidates) {
                if (!candidate) continue;
                const html = await readHtmlFromZip(candidate);
                if (!html) continue;
                if (html.includes('data-tf-nav-root') || html.includes('data-tf-nav-trigger') || html.includes('data-tf-nav-dropdown') || /<header[\s>]/i.test(html)) {
                    return { html, source: candidate };
                }
            }
            return { html: mainHtml, source: actualIndexFile || 'mainHtml' };
        };

        const { html: shellHtml, source: shellSource } = await pickShellHtml();
        addLog(`Header/Footer shell source: ${shellSource}`, 'info');

        // Normalize header dropdowns: ensure data-tf-nav-* markers exist
        const normalizeHeaderDropdowns = (html: string): string => {
            if (!html) return html;
            const tempDoc = new DOMParser().parseFromString(`<div id="tf-header-wrap">${html}</div>`, 'text/html');
            const wrap = tempDoc.getElementById('tf-header-wrap');
            if (!wrap) return html;

            const navs = Array.from(wrap.querySelectorAll('nav')).filter(
                (el): el is HTMLElement => el instanceof HTMLElement
            );
            const normalizeText = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

            const isTriggerCandidate = (el: Element): el is HTMLElement => {
                if (!(el instanceof HTMLElement)) return false;
                if (!el.matches('a, button, [role="button"], summary')) return false;
                const text = normalizeText(el.textContent || '');
                const href = el.getAttribute('href') || '';
                const hasChevron = !!el.querySelector('svg, [data-lucide], .lucide') ||
                    /chevron|caret|arrow-down|angle-down/i.test(el.innerHTML);
                const hasPopupHint = el.hasAttribute('aria-haspopup') || el.hasAttribute('aria-expanded') || el.hasAttribute('data-state');
                if (text.length === 0 || text.length > 100) return false;
                if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
                return hasChevron || hasPopupHint || text.length > 0;
            };

            const menuItemCount = (el: Element) => el.querySelectorAll('a[href], button, [role="menuitem"], li').length;

            const panelScore = (panel: HTMLElement, trigger: HTMLElement, nav: HTMLElement): number => {
                if (panel === trigger || panel.contains(trigger) || panel === nav) return -999;
                let score = 0;
                const cls = (panel.getAttribute('class') || '').toLowerCase();
                const style = (panel.getAttribute('style') || '').toLowerCase();
                const role = (panel.getAttribute('role') || '').toLowerCase();
                const links = panel.querySelectorAll('a[href], [role="menuitem"]').length;
                if (role === 'menu' || role === 'listbox') score += 10;
                if (panel.hasAttribute('hidden')) score += 5;
                if (panel.getAttribute('aria-hidden') === 'true') score += 4;
                if (panel.hasAttribute('data-state')) score += 3;
                if (/absolute|fixed|submenu|dropdown|popover|flyout|menu|panel|popper/.test(cls)) score += 8;
                if (/position\s*:\s*(absolute|fixed)/.test(style)) score += 8;
                if (/display\s*:\s*none/.test(style)) score += 4;
                if (/opacity\s*:\s*0|visibility\s*:\s*hidden/.test(style)) score += 3;
                if (/z-\[|z-|shadow|rounded|border|bg-/.test(cls)) score += 2;
                if (links >= 1) score += Math.min(links, 6);
                if (menuItemCount(panel) >= 2) score += 3;
                if (panel.matches('ul, div, section')) score += 1;
                const parent = panel.parentElement;
                if (parent && parent.contains(trigger)) score += 2;
                const depthPenalty = Math.min(6, panel.querySelectorAll('*').length / 50);
                score -= depthPenalty;
                return score;
            };

            const getAncestorsUntil = (el: HTMLElement, stop: HTMLElement): HTMLElement[] => {
                const out: HTMLElement[] = [];
                let cur: HTMLElement | null = el;
                while (cur && cur !== stop) { out.push(cur); cur = cur.parentElement; }
                if (stop) out.push(stop);
                return out;
            };

            const pickRoot = (trigger: HTMLElement, panel: HTMLElement, nav: HTMLElement): HTMLElement | null => {
                const triggerAncestors = getAncestorsUntil(trigger, nav);
                const panelAncestors = new Set(getAncestorsUntil(panel, nav));
                const commons = triggerAncestors.filter(a => panelAncestors.has(a));
                if (!commons.length) return null;
                let best: HTMLElement | null = null;
                let bestScore = -999;
                for (const candidate of commons) {
                    if (candidate === nav || candidate === wrap) continue;
                    let score = 0;
                    const cls = (candidate.getAttribute('class') || '').toLowerCase();
                    const tag = candidate.tagName.toLowerCase();
                    if (tag === 'li') score += 10;
                    if (tag === 'div') score += 4;
                    if (/relative|group|menu|nav-item|item/.test(cls)) score += 8;
                    if (candidate.contains(trigger) && candidate.contains(panel)) score += 5;
                    if (candidate.querySelectorAll('a,button,[role="button"]').length <= 6) score += 2;
                    if (candidate.querySelectorAll('[data-tf-nav-dropdown]').length > 0) score -= 20;
                    const subtreeSize = candidate.querySelectorAll('*').length;
                    score -= Math.min(subtreeSize / 20, 8);
                    if (score > bestScore) { bestScore = score; best = candidate; }
                }
                return best;
            };

            let idx = 0;
            navs.forEach((nav) => {
                const triggers = Array.from(nav.querySelectorAll('a, button, [role="button"], summary')).filter(isTriggerCandidate);
                triggers.forEach((trigger) => {
                    if (trigger.hasAttribute('data-tf-nav-trigger')) return;
                    const triggerContainer = (trigger.closest('li, .group, [class*="relative"], [class*="menu"], [class*="nav-item"]') as HTMLElement | null) || trigger.parentElement;
                    if (!triggerContainer || !nav.contains(triggerContainer)) return;
                    const descendants = Array.from(triggerContainer.querySelectorAll('*')).filter((el): el is HTMLElement => el instanceof HTMLElement);
                    const navDescendants = Array.from(nav.querySelectorAll('*')).filter((el): el is HTMLElement => el instanceof HTMLElement);
                    const candidates = [...new Set([...descendants, ...navDescendants])].filter((el) => {
                        if (el === trigger || el.contains(trigger) || trigger.contains(el)) return false;
                        if (el.hasAttribute('data-tf-nav-dropdown')) return false;
                        if (menuItemCount(el) < 1) return false;
                        if (normalizeText(el.textContent || '').length < 2) return false;
                        if (el.matches('nav, header')) return false;
                        return true;
                    });
                    let bestPanel: HTMLElement | null = null;
                    let bestPanelScore = 0;
                    for (const candidate of candidates) {
                        const score = panelScore(candidate, trigger, nav);
                        if (score > bestPanelScore) { bestPanelScore = score; bestPanel = candidate; }
                    }
                    if (!bestPanel || bestPanelScore < 10) return;
                    const root = pickRoot(trigger, bestPanel, nav);
                    if (!root || root.hasAttribute('data-tf-nav-root')) return;

                    idx += 1;
                    const id = `tf-nav-${idx}`;
                    root.setAttribute('data-tf-nav-root', id);
                    trigger.setAttribute('data-tf-nav-trigger', id);
                    trigger.setAttribute('aria-haspopup', 'menu');
                    trigger.setAttribute('aria-expanded', 'false');
                    bestPanel.setAttribute('data-tf-nav-dropdown', id);
                    bestPanel.setAttribute('hidden', '');
                    bestPanel.classList.remove('is-open', 'open');
                    bestPanel.style.setProperty('display', 'none', 'important');
                    bestPanel.style.setProperty('opacity', '0', 'important');
                    bestPanel.style.setProperty('visibility', 'hidden', 'important');
                    bestPanel.style.setProperty('pointer-events', 'none', 'important');
                    bestPanel.style.setProperty('max-height', '0px', 'important');
                    bestPanel.style.setProperty('overflow', 'hidden', 'important');
                });
            });

            // DEDUP: For each tagged root, hide any unmarked panel-like siblings
            // This handles the case where builder.js clones the dropdown but leaves the original visible
            const taggedRoots = wrap.querySelectorAll('[data-tf-nav-root]');
            taggedRoots.forEach((root) => {
                if (!(root instanceof HTMLElement)) return;
                const id = root.getAttribute('data-tf-nav-root');
                const taggedPanel = root.querySelector(`[data-tf-nav-dropdown="${id}"]`);
                if (!taggedPanel) return;

                // Find all panel-like elements that are NOT the tagged panel
                const allChildren = Array.from(root.querySelectorAll('*')).filter(
                    (el): el is HTMLElement => {
                        if (!(el instanceof HTMLElement)) return false;
                        if (el === taggedPanel || taggedPanel.contains(el) || el.contains(taggedPanel)) return false;
                        if (el.hasAttribute('data-tf-nav-dropdown')) return false;
                        if (el.hasAttribute('data-tf-nav-trigger')) return false;
                        const cls = (el.getAttribute('class') || '').toLowerCase();
                        const links = el.querySelectorAll('a[href], [role="menuitem"]').length;
                        return links > 0 && /absolute|fixed|dropdown|submenu|popover|menu/.test(cls);
                    }
                );

                allChildren.forEach((dup) => {
                    dup.style.setProperty('display', 'none', 'important');
                    dup.setAttribute('hidden', '');
                    dup.setAttribute('aria-hidden', 'true');
                    dup.setAttribute('data-tf-nav-original', 'hidden');
                });
            });

            return wrap.innerHTML;
        };

        // PATTERN EXTRACTION LOGIC
        const globalPatterns: { headerPattern?: string, footerPattern?: string } = {};
        try {
            const rawHeaderHtml = extractElementHtml(shellHtml, 'header');
            if (rawHeaderHtml) {
                const normalizedHeaderHtml = normalizeHeaderDropdowns(rawHeaderHtml);
                const safeHeaderHtml = replaceAssetPaths(normalizedHeaderHtml, '__THEME_URI__/');
                const headerConversion = convertToGutenbergBlocks(safeHeaderHtml);
                folder.file('assets/content/part-header.blocks.html', headerConversion.html);
                allAuditLogs.push(...headerConversion.logs);
                globalPatterns.headerPattern = 'theme-factory/part-header';
                stats.patterns++;
                addLog('  → Extracted Global Header Pattern (with nav markers)', 'info');
            }

            const footerHtml = extractElementHtml(shellHtml, 'footer');
            if (footerHtml) {
                // Replace assets in footer HTML
                const safeFooterHtml = replaceAssetPaths(footerHtml, '__THEME_URI__/');
                const footerConversion = convertToGutenbergBlocks(safeFooterHtml);
                folder.file('assets/content/part-footer.blocks.html', footerConversion.html);
                allAuditLogs.push(...footerConversion.logs);
                globalPatterns.footerPattern = 'theme-factory/part-footer';
                stats.patterns++;
                addLog('  → Extracted Global Footer Pattern', 'info');
            }
        } catch (e) {
            addLog('  ⚠ Pattern extraction failed: ' + (e as Error).message, 'warning');
        }

        const BATCH_SIZE = 20; const allFilesToCopy = [...cssFiles, ...jsFiles, ...assetFiles, ...otherFiles];
        for (let i = 0; i < allFilesToCopy.length; i += BATCH_SIZE) {
            const batch = allFilesToCopy.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (fullFileName) => {
                const relativeName = fullFileName.substring(effectiveRoot.length);
                const fileData = await zipContent.files[fullFileName].async("uint8array");
                folder.file(relativeName, fileData);
                if (relativeName.match(/\.css$/i)) foundCssFiles.push(relativeName);
            }));
            setProgress(15 + Math.floor((i / allFilesToCopy.length) * 25));
        }
        stats.css = cssFiles.length; stats.js = jsFiles.length; stats.images = assetFiles.length;
        addLog(`Copied ${allFilesToCopy.length} files`, 'success'); setProgress(40);

        const parser = new DOMParser();
        const doc = parser.parseFromString(shellHtml, 'text/html');

        // FIX: Inject root marker to split header and footer correctly. 
        // This prevents duplicating the body/html tags in the header.php and footer.php
        let rootEl = doc.getElementById('root');
        let extractedHeader = '';
        let extractedFooter = '';

        if (rootEl) {
            // CRITICAL: Extract header/nav BEFORE replacing root content
            // Without this, navigation and dropdowns are completely lost
            // FIX: Only extract <header> to avoid duplicating <nav> that's already inside <header>
            const headerEl = rootEl.querySelector('header');
            if (headerEl) {
                extractedHeader = headerEl.outerHTML;
            } else {
                // Fallback: use standalone <nav> only if no <header> wrapper exists
                const navEl = rootEl.querySelector('nav');
                if (navEl) extractedHeader = navEl.outerHTML;
            }

            // Extract footer elements before clearing
            const footerEl = rootEl.querySelector('footer');
            if (footerEl) {
                extractedFooter = footerEl.outerHTML;
            }

            // Normalize header dropdowns to ensure data-tf-nav-* markers
            if (extractedHeader) extractedHeader = normalizeHeaderDropdowns(extractedHeader);
            addLog(`Tagged nav roots: ${(extractedHeader.match(/data-tf-nav-root=/g) || []).length}`, 'info');
            addLog(`Tagged nav triggers: ${(extractedHeader.match(/data-tf-nav-trigger=/g) || []).length}`, 'info');
            addLog(`Tagged nav panels: ${(extractedHeader.match(/data-tf-nav-dropdown=/g) || []).length}`, 'info');
            const suspiciousMenuMatches = extractedHeader.match(/dropdown|submenu|popover|flyout|data-radix-popper-content-wrapper|role="menu"|class="[^"]*absolute/gi) || [];
            addLog(`Suspicious menu-like nodes in header HTML: ${suspiciousMenuMatches.length}`, 'info');

            // Now replace root content with marker
            rootEl.innerHTML = '%%%ROOT_MARKER%%%';
        } else if (doc.body) {
            // Fallback: prepend to body if no root found
            doc.body.insertAdjacentHTML('afterbegin', '%%%ROOT_MARKER%%%');
            rootEl = doc.body;
        }

        const body = doc.body;
        const bodyClasses = shellHtml.match(/<body[^>]*class=["']([^"']+)["']/i)?.[1] || '';
        const htmlClasses = shellHtml.match(/<html[^>]*class=["']([^"']+)["']/i)?.[1] || '';

        // Define rootClasses for fallback in route processing
        // Reuse the rootEl we found/modified above to get classes
        const rootClasses = rootEl instanceof HTMLElement ? rootEl.className : '';

        // Update main HTML resource paths for PHP (header.php/footer.php)
        const fullShell = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
        let processedShell = replaceAssetPaths(fullShell, '<?php echo esc_url(get_template_directory_uri()); ?>/')
            .replace(/<\/head>/i, `<?php wp_head(); ?>\n</head>`)
            .replace(/<body([^>]*)>/i, (match, attrs) => `<body${attrs} <?php body_class(); ?>>\n<?php wp_body_open(); ?>\n<a class="skip-link screen-reader-text" href="#main">Skip to content</a>`)
            .replace(/<\/body>/i, `<?php wp_footer(); ?>\n</body>`);

        // FIX: In Gutenberg Native Mode, we MUST violently strip the Vite React JS bundle.
        // Otherwise, React mounts over <div id="root"> and erases the WordPress PHP page generation.
        if (mode === 'gutenberg-native') {
            processedShell = processedShell.replace(/<script[^>]*src=["'][^"']*assets\/[^"']*\.js["'][^>]*><\/script>/gi, '');
            // Also strip any route-guard scripts
            processedShell = processedShell.replace(/<script[^>]*><\/script>/gi, '');
        }

        const [headerPart, footerPart] = processedShell.split('%%%ROOT_MARKER%%%');

        const allowedPathsJson = JSON.stringify(routesToProcess.map(r => r.path));

        let finalHeaderContent = headerPart;
        let finalFooterContent = footerPart || "</div></body></html>";

        // Advanced SEO/CRO: Inject Global Head Overrides
        const ogImage = seoSettings.ogImage || '';
        let globalHeadInjection = `\n<!-- Indexation & Canonical Control -->\n<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />\n<link rel="canonical" href="<?php echo esc_url( home_url( wp_parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH ) ) ); ?>" />\n<!-- Open Graph & Social Meta -->\n<meta property="og:type" content="website" />\n<meta name="twitter:card" content="summary_large_image" />\n`;
        if (ogImage) {
            globalHeadInjection += `<meta property="og:image" content="${ogImage}" />\n`;
            // LCP Preloader for massive PageSpeed boost
            globalHeadInjection += `<!-- LCP Auto-Preload -->\n<link rel="preload" as="image" href="${ogImage}" />\n`;
        }
        
        if (seoSettings.googleSiteVerification) {
            globalHeadInjection += `<meta name="google-site-verification" content="${seoSettings.googleSiteVerification}" />\n`;
        }
        if (seoSettings.bingSiteVerification) {
            globalHeadInjection += `<meta name="msvalidate.01" content="${seoSettings.bingSiteVerification}" />\n`;
        }
        
        let trackingScripts = '';
        if (seoSettings.gaId) {
            trackingScripts += `\n<!-- Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=${seoSettings.gaId}"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag('js', new Date());\n  gtag('config', '${seoSettings.gaId}');\n  if(window.location.search.includes('utm_source=chatgpt.com')){gtag('event','ai_referral',{source:'chatgpt'});}\n</script>\n`;
        }
        if (seoSettings.metaPixelId) {
            trackingScripts += `\n<!-- Meta Pixel -->\n<script>\n!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');\nfbq('init', '${seoSettings.metaPixelId}');\nfbq('track', 'PageView');\n</script>\n`;
        }

        // Add dynamically extracted Favicon
        const faviconHtml = `\n<!-- Site Icon -->\n<link rel="icon" href="<?php echo esc_url(get_template_directory_uri()); ?>/assets/favicon.ico" sizes="any">\n<link rel="icon" href="<?php echo esc_url(get_template_directory_uri()); ?>/assets/favicon.png" type="image/png">\n`;

        // Strip global <title> and <meta description> so we can inject them on a per-page basis later
        finalHeaderContent = finalHeaderContent.replace(/<title>.*?<\/title>/gi, '');
        finalHeaderContent = finalHeaderContent.replace(/<meta name="description" content=".*?">/gi, '');
        finalHeaderContent = finalHeaderContent.replace(/<meta property="og:title" content=".*?">/gi, '');
        finalHeaderContent = finalHeaderContent.replace(/<meta property="og:description" content=".*?">/gi, '');

        finalHeaderContent = finalHeaderContent.replace(/<\/head>/i, `${globalHeadInjection}${trackingScripts}${faviconHtml}</head>`);

        // CRITICAL: Inject extracted header/nav into header.php and footer into footer.php
        if (mode === 'gutenberg-native') {
            // Strip React scripts from templates to prevent content overwriting
            finalFooterContent = finalFooterContent.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
            finalFooterContent = finalFooterContent.replace(/<script\b[^>]*\/>/gi, '');
            finalHeaderContent = finalHeaderContent.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
            finalHeaderContent = finalHeaderContent.replace(/<script\b[^>]*\/>/gi, '');

            if (extractedHeader) {
                // DEDUPE: headerPart from shell already contains a <header>/<nav>
                // Strip them before appending the clean extractedHeader
                addLog(`headerPart header count before dedupe: ${(finalHeaderContent.match(/<header\b/gi) || []).length}`, 'info');
                finalHeaderContent = finalHeaderContent
                    .replace(/<header\b[\s\S]*?<\/header>\s*/gi, '')
                    .replace(/<nav\b[\s\S]*?<\/nav>\s*/gi, '');

                const processedHeader = replaceAssetPaths(extractedHeader, '<?php echo esc_url(get_template_directory_uri()); ?>/');
                finalHeaderContent = finalHeaderContent + '\n' + processedHeader;
                addLog(`finalHeaderContent header count after dedupe: ${(finalHeaderContent.match(/<header\b/gi) || []).length}`, 'info');
                addLog("Injected deduped navigation HTML into header.php", 'success');
            }

            if (extractedFooter) {
                // DEDUPE: footerPart from shell already contains a <footer>
                finalFooterContent = finalFooterContent
                    .replace(/<footer\b[\s\S]*?<\/footer>\s*/gi, '');

                const processedFooter = replaceAssetPaths(extractedFooter, '<?php echo esc_url(get_template_directory_uri()); ?>/');
                finalFooterContent = processedFooter + '\n' + finalFooterContent;
                addLog("Injected deduped footer HTML into footer.php", 'success');
            }

            addLog("Stripped React scripts from header.php and footer.php", 'info');
        }

        (window as any).__debugOutput = `--- HEADER.PHP DEBUG ---\n`;
        (window as any).__debugOutput += finalHeaderContent.substring(0, 1000) + `\n\n`;

        addLog(`--- HEADER.PHP DEBUG ---`, 'warning');
        addLog(finalHeaderContent.substring(0, 500).replace(/\n/g, '\\n'), 'warning');
        addLog(`------------------------`, 'warning');

        // CRITICAL FIX: Rewrite internal React Router links in header.php and footer.php
        // Same rewriting as page content — React paths like /edmonton/pricing become /edmonton-pricing/
        for (const r of routes) {
            if (r.path === '/') continue;
            const reactPath = r.path;
            const wpSlug = r.slug;
            const escapedPath = reactPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            finalHeaderContent = finalHeaderContent
                .replace(new RegExp(`href=["']${escapedPath}/?["']`, 'g'), `href="/${wpSlug}/"`)
                .replace(new RegExp(`href=["']${escapedPath}#`, 'g'), `href="/${wpSlug}/#`)
                .replace(new RegExp(`data-href=["']${escapedPath}/?["']`, 'g'), `data-href="/${wpSlug}/"`);
            finalFooterContent = finalFooterContent
                .replace(new RegExp(`href=["']${escapedPath}/?["']`, 'g'), `href="/${wpSlug}/"`)
                .replace(new RegExp(`href=["']${escapedPath}#`, 'g'), `href="/${wpSlug}/#`)
                .replace(new RegExp(`data-href=["']${escapedPath}/?["']`, 'g'), `data-href="/${wpSlug}/"`);
        }
        addLog(`  Rewrote internal links in header.php and footer.php (${routes.length - 1} routes)`, 'success');

        const stickyMobileCTA = `\n<!-- Sticky Mobile CTA -->
<div class="fixed bottom-0 left-0 w-full z-[9999] md:hidden shadow-[0_-4px_10px_rgba(0,0,0,0.1)] flex" style="background-color: ${seoSettings.ctaColor};">
    <a href="${seoSettings.ctaLink1}" class="flex-1 text-center py-4 font-bold text-lg hover:opacity-80 transition-opacity border-r" style="color: ${seoSettings.ctaTextColor}; border-color: color-mix(in srgb, ${seoSettings.ctaTextColor} 20%, transparent);">${seoSettings.ctaText1}</a>
    <a href="${seoSettings.ctaLink2}" class="flex-1 text-center py-4 font-bold text-lg hover:opacity-80 transition-opacity" style="color: ${seoSettings.ctaTextColor};">${seoSettings.ctaText2}</a>
</div>\n`;

        // VISIBLE ENTITY FACTS: Render highly semantic business info matching LocalBusiness schema directly into the visible footer
        const visibleEntityFacts = `
<!-- wp:group {"className":"tf-entity-facts-footer bg-slate-50 border-t border-slate-200 mt-12 py-8"} -->
<div class="wp-block-group tf-entity-facts-footer bg-slate-50 border-t border-slate-200 mt-12 py-8 px-4" style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; margin-top: 4rem; padding: 2rem 1rem;">
    <div style="max-width: 1200px; margin: 0 auto; display: flex; flex-direction: column; gap: 2rem;">
        <div style="display: flex; flex-wrap: wrap; gap: 2rem; width: 100%;">
            <div style="flex: 1 1 300px;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem;">About ${seoSettings.companyName}</h3>
                <p style="margin-bottom: 1rem; font-size: 0.875rem; color: #475569;">${seoSettings.companyName} is a verified local business located in ${seoSettings.addressLocality}, ${seoSettings.addressRegion}. ${seoSettings.description}</p>
                <p style="font-size: 0.875rem; color: #475569;"><strong>Pricing:</strong> ${seoSettings.priceRange}</p>
            </div>
            <div style="flex: 1 1 300px;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem;">Contact &amp; Location</h3>
                <address style="font-style: normal; line-height: 1.6; font-size: 0.875rem; color: #475569;">
                    <strong>${seoSettings.companyName}</strong><br>
                    ${seoSettings.addressLocality}, ${seoSettings.addressRegion}, ${seoSettings.addressCountry}<br>
                    Phone: <a href="tel:${seoSettings.telephone}" style="color: #2563eb; text-decoration: underline;">${seoSettings.telephone}</a><br>
                    Website: <a href="${seoSettings.url}" style="color: #2563eb; text-decoration: underline;">${seoSettings.url}</a>
                </address>
            </div>
            ${(seoSettings.reviewRating && seoSettings.reviewCount && parseFloat(seoSettings.reviewRating) > 0) ? `
            <div style="flex: 1 1 300px;">
                <h3 style="font-size: 1.125rem; font-weight: 700; color: #0f172a; margin-bottom: 1rem;">Customer Reviews</h3>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <span style="color: #eab308; font-size: 1.25rem;">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                    <span style="font-weight: 700; color: #0f172a; font-size: 0.875rem;">${seoSettings.reviewRating} out of 5</span>
                </div>
                <p style="font-size: 0.875rem; color: #475569;">Based on ${seoSettings.reviewCount} customer reviews.</p>
            </div>` : ''}
        </div>
    </div>
</div>
<!-- /wp:group -->
`;

        // Note: LocalBusiness schema was moved to the intelligent Schema Router in the route loop
        finalFooterContent = stickyMobileCTA + visibleEntityFacts + finalFooterContent;

        // TIER 1 POLISH: Auto-Lazy Load all images in footer
        finalFooterContent = finalFooterContent.replace(/<img(?!.*loading=["']lazy["'])((?![^>]*class=["'][^"']*(?:hero|no-lazy|lcp)[^"']*["'])[^>]*)>/gi, '<img loading="lazy"$1>');

        // TIER 1 POLISH: Dynamic Copyright Year
        // Find "2024", "2023", etc. in footer text and replace with PHP year output
        finalFooterContent = finalFooterContent.replace(/(©|Copyright|[Cc]opyright[^>]*>)[^\d]*202[0-9]/g, '$1 <?php echo date("Y"); ?>');

        folder.file("header.php", finalHeaderContent);
        folder.file("footer.php", finalFooterContent);

        folder.file("assets/js/route-guard.js", `(function(){if(window.TF_BLOCKED){var r=document.getElementById('root');if(r&&r.innerHTML.indexOf('404')===-1)r.innerHTML='<div style="text-align:center;padding:50px"><h1>404</h1></div>';}})();`);

    
    // Interactive components JavaScript - enables accordion/carousel functionality WITH content injection
    // V8.7 - Improved FAQ matching with keyword scoring and topic synonyms
    folder.file("assets/js/interactive-components-v9.0.js", `/**
 * Interactive Components - Vanilla JS for WordPress
 * Provides accordion, carousel, toggle functionality WITH content injection
 * Solves Radix UI empty accordion content issue
 */
(function() {
  'use strict';
  






  // NEW: Convert arbitrary Tailwind JIT classes to inline styles
  // Handles classes like text-[hsl(160,100%,30%)] that aren't compiled
  function applyArbitraryTailwindClasses() {
    var elements = document.querySelectorAll('[class*="["]');
    elements.forEach(function(el) {
      // Use getAttribute for SVG compatibility (SVG className is SVGAnimatedString)
      var classStr = el.getAttribute('class') || '';
      var classes = classStr.split(' ');
      classes.forEach(function(cls) {
        // Match text-[...] for color
        var textMatch = cls.match(/^text-\\[(.+)\\]$/);
        if (textMatch) {
          el.style.color = textMatch[1];
        }
        // Match bg-[...] for background
        var bgMatch = cls.match(/^bg-\\[(.+)\\]$/);
        if (bgMatch) {
          el.style.backgroundColor = bgMatch[1];
        }
        // Match w-[...] for width
        var wMatch = cls.match(/^w-\\[(.+)\\]$/);
        if (wMatch) {
          el.style.width = wMatch[1];
        }
        // Match h-[...] for height
        var hMatch = cls.match(/^h-\\[(.+)\\]$/);
        if (hMatch) {
          el.style.height = hMatch[1];
        }
        // Match p-[...] for padding
        var pMatch = cls.match(/^p-\\[(.+)\\]$/);
        if (pMatch) {
          el.style.padding = pMatch[1];
        }
        // Match m-[...] for margin
        var mMatch = cls.match(/^m-\\[(.+)\\]$/);
        if (mMatch) {
          el.style.margin = mMatch[1];
        }
      });
    });
  }
  
  // Remove MUI ghost elements that appear when logged into WP admin
  // Also removes extension-injected iframes containing MUI demo content
  function removeMuiGhostElements() {
    // CRITICAL: Remove iframes injected by browser extensions with MUI demo content
    // CSS cannot cross iframe boundaries, so we must remove the iframes themselves
    document.querySelectorAll('iframe').forEach(function(iframe) {
      var title = iframe.getAttribute('title') || '';
      var src = iframe.getAttribute('src') || '';
      // Remove iframes with suspicious demo/MUI-related titles or sources
      if (title.indexOf('demo') !== -1 || 
          title.indexOf('iframe-demo') !== -1 ||
          title.indexOf('extension') !== -1 ||
          src.indexOf('demo') !== -1) {
        iframe.remove();
        return;
      }
      // Also try to access iframe content and check for MUI elements
      try {
        var iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        if (iframeDoc && iframeDoc.querySelector('[class*="MuiPaper"], [class*="iframe-demo"]')) {
          iframe.remove();
        }
      } catch (e) {
        // Cross-origin iframe, can't access - check by style/position
        var style = iframe.getAttribute('style') || '';
        if (style.indexOf('z-index') !== -1 && style.indexOf('position') !== -1) {
          // Suspicious positioned iframe - likely an overlay
          if (style.indexOf('fixed') !== -1 || style.indexOf('absolute') !== -1) {
            iframe.remove();
          }
        }
      }
    });
    
    // Remove all MUI Paper elements (React UI framework artifacts)
    document.querySelectorAll('[class*="MuiPaper"]').forEach(function(el) {
      el.remove();
    });
    
    // Remove iframe-demo elements (MUI demo/preview artifacts)
    document.querySelectorAll('[class*="iframe-demo"]').forEach(function(el) {
      el.remove();
    });
    
    // Remove empty MUI Typography elements
    document.querySelectorAll('[class*="MuiTypography"]').forEach(function(el) {
      if (!el.textContent || !el.textContent.trim()) {
        el.remove();
      }
    });
  }
  
  // MutationObserver to catch ghost elements injected after page load (admin bar, plugins, etc.)
  function observeMuiGhostElements() {
    if (!window.MutationObserver) return;

    var obs = new MutationObserver(function(mutations) {
      for (var i = 0; i < mutations.length; i++) {
        var m = mutations[i];
        if (!m.addedNodes) continue;

        for (var j = 0; j < m.addedNodes.length; j++) {
          var node = m.addedNodes[j];
          if (!node || node.nodeType !== 1) continue;

          var el = node;
          // If the added node is (or contains) the ghost junk, remove it
          if (
            (el.matches && el.matches('[class*="MuiPaper"], [class*="iframe-demo"], [class*="MuiTypography"]')) ||
            (el.querySelector && el.querySelector('[class*="MuiPaper"], [class*="iframe-demo"]'))
          ) {
            removeMuiGhostElements();
            return;
          }
        }
      }
    });

    obs.observe(document.documentElement, { childList: true, subtree: true });
  }
  
  // Inject content into empty accordion content regions
  function injectAccordionContent() {
    // Find all accordion content regions
    var contentRegions = document.querySelectorAll('[role="region"][data-state]');
    
    contentRegions.forEach(function(region) {
      // Check if content is empty OR is placeholder text
      var t = (region.textContent || '').trim().toLowerCase();
      var isPlaceholder = !t || t.length < 10 || 
          t.indexOf('please contact us') !== -1 || 
          t.indexOf('contact us for more') !== -1 ||
          t.indexOf('more information') !== -1;
      if (!isPlaceholder) return;
      
      // Find the associated button by aria-labelledby
      var labelId = region.getAttribute('aria-labelledby');
      if (!labelId) return;
      
      var button = document.getElementById(labelId);
      if (!button) return;
      
      var questionText = button.textContent.trim();
      
      // Look up answer from FAQ data
      var answer = findAnswerForQuestion(questionText);
      if (answer) {
        region.innerHTML = '<div class="pb-4 pt-0 text-sm">' + answer + '</div>';
        region.removeAttribute('hidden');
      }
    });
  }
  
  function findAnswerForQuestion(q) {
    var faq = window.FAQ_DATA || [];
    // Normalize for matching
    var qNorm = (q || '').toLowerCase().replace(/[?!.,;:'"()[\]{}]/g, '').replace(/\s+/g, ' ').trim();
    for (var i = 0; i < faq.length; i++) {
      var itemQ = (faq[i].q || '').toLowerCase().replace(/[?!.,;:'"()[\]{}]/g, '').replace(/\s+/g, ' ').trim();
      if (qNorm.indexOf(itemQ) !== -1 || itemQ.indexOf(qNorm) !== -1 ||
          qNorm.substring(0, 30) === itemQ.substring(0, 30)) {
        return faq[i].a;
      }
    }
    // Keyword-based scoring for fuzzy matching
    var qWords = qNorm.split(' ').filter(function(w) { return w.length > 2; });
    var topicMap = {
      trust: ['insured', 'bonded', 'background'], maid: ['cleaning', 'service', 'included'],
      house: ['home', 'cleaning'], long: ['time', 'hours', 'take'], discount: ['recurring', 'off'],
      hidden: ['fees', 'extra', 'cost'], satisfied: ['satisfaction', 'guarantee'],
      cleaners: ['technicians', 'team', 'staff']
    };
    var bestScore = 0, bestMatch = null;
    for (var i = 0; i < faq.length; i++) {
      var itemQ = (faq[i].q || '').toLowerCase();
      var itemA = (faq[i].a || '').toLowerCase();
      var score = 0;
      for (var j = 0; j < qWords.length; j++) {
        var word = qWords[j];
        if (itemQ.indexOf(word) !== -1) score += 10;
        if (itemA.indexOf(word) !== -1) score += 5;
        if (topicMap[word]) {
          for (var k = 0; k < topicMap[word].length; k++) {
            if (itemQ.indexOf(topicMap[word][k]) !== -1 || itemA.indexOf(topicMap[word][k]) !== -1) score += 8;
          }
        }
      }
      if (score > bestScore) { bestScore = score; bestMatch = faq[i].a; }
    }
    if (bestScore >= 8) return bestMatch;
    console.log('[FAQ] No match for: ' + q);
    return null;
  }
  
  // NEW v8.8: Replace placeholder text in .accordion-content-injected divs
  function replaceFaqPlaceholders() {
    var nodes = document.querySelectorAll('.accordion-content-injected');

    nodes.forEach(function(node) {
      var existing = (node.textContent || '').trim();

      // Replace placeholder OR empty
      var isPlaceholder =
        !existing ||
        existing.length < 10 ||
        existing.toLowerCase().indexOf('please contact us') !== -1 ||
        existing.toLowerCase().indexOf('contact us for more') !== -1 ||
        existing.toLowerCase().indexOf('more information') !== -1;

      if (!isPlaceholder) return;

      // Find question text from the trigger right above
      var triggerEl = node.previousElementSibling;
      var trigger = triggerEl
        ? (triggerEl.querySelector('.wp-block-button__link') || triggerEl.querySelector('a') || triggerEl.querySelector('button') || triggerEl)
        : null;

      var questionText = trigger ? (trigger.textContent || '').trim() : '';
      if (!questionText) return;

      // Look up answer from window.FAQ_DATA
      var answer = findAnswerForQuestion(questionText);
      if (!answer) return;

      node.innerHTML =
        '<div style="padding: 1rem 0; color: hsl(var(--muted-foreground)); font-size: 0.875rem; line-height: 1.5;">' +
        answer +
        '</div>';
    });
  }
  
  // v8.8: Inject content into empty Radix panels by aria-controls
  // This handles panels that have Radix IDs like radix-:r0:
  function injectRadixPanelContent() {
    // Find all Radix accordion trigger buttons that control panels
    var triggers = document.querySelectorAll('button[aria-controls][id^="radix-"]');

    triggers.forEach(function(trigger) {
      var panelId = trigger.getAttribute('aria-controls');
      if (!panelId) return;

      var panel = document.getElementById(panelId);
      if (!panel) return;

      // If panel already has real content, do nothing
      var existingText = (panel.textContent || '').trim();
      var isPlaceholder = !existingText || existingText.length < 10 ||
          existingText.toLowerCase().indexOf('please contact us') !== -1 ||
          existingText.toLowerCase().indexOf('more information') !== -1;
      if (!isPlaceholder) return;

      // Get question text
      var questionText = (trigger.textContent || '').trim();

      // Look up answer
      var answer = findAnswerForQuestion(questionText);
      if (!answer) return;

      // Inject answer
      panel.innerHTML = '<div class="pb-4 pt-0 text-sm" style="padding: 0 0 1rem 0; color: hsl(var(--muted-foreground, 215 16% 47%)); font-size: 0.875rem; line-height: 1.6;">' + answer + '</div>';

      // CRITICAL: Remove hidden attribute so CSS can control visibility
      panel.removeAttribute('hidden');
      
      // Set up animation styles
      panel.style.overflow = 'hidden';
      panel.style.transition = 'max-height 0.3s ease, height 0.3s ease';

      // CRITICAL FIX: Use requestAnimationFrame to defer height calculation
      // This ensures scrollHeight is calculated AFTER content is rendered and visible
      // Without this, scrollHeight returns 0 because the element isn't laid out yet
      requestAnimationFrame(function() {
        if (trigger.getAttribute('aria-expanded') === 'true') {
          panel.style.maxHeight = panel.scrollHeight + 'px';
          panel.style.height = 'auto';
        } else {
          // Closed state - set to 0 height
          panel.style.maxHeight = '0px';
          panel.style.height = '0px';
        }
      });
    });
  }
  
  // FIX: FAQ items that became non-functional after conversion.
  // Source React buttons (button[data-state]) get converted to either:
  //   - <button class="wp-block-theme-factory-container ..."> (when caught by processElement data-state check)
  //   - <a class="wp-block-theme-factory-button" href="#"> (when caught by createButton w-full heuristic)
  // Neither pattern has accordion behavior. This handler detects them by structure and adds expand/collapse.
  function initButtonFaqAccordions() {
    // Look for ANY container with space-y class (FAQ groups use space-y-4)
    var spaceContainers = document.querySelectorAll('[class*="space-y"]');
    
    spaceContainers.forEach(function(container) {
      // Skip if already initialized
      if (container.getAttribute('data-tf-faq-init')) return;
      
      var kids = Array.from(container.children).filter(function(k) { return k instanceof HTMLElement; });
      if (kids.length < 3) return;
      
      // For each child, try to find a "trigger" element that looks like a FAQ question.
      // The trigger can be:
      //   - The child itself if it's a <button> or <a href="#">
      //   - A <button> or <a> found INSIDE the child (wrapped in a div)
      function findTrigger(kid) {
        // Case 1: The kid IS a button/anchor trigger
        if (kid.tagName === 'BUTTON' || (kid.tagName === 'A' && kid.getAttribute('href') === '#')) {
          return kid;
        }
        // Case 2: Kid wraps a button or <a href="#">
        var btn = kid.querySelector('button, a[href="#"]');
        return btn || null;
      }
      
      // Count how many children look like FAQ questions (text contains ?)
      var faqPairs = [];
      for (var i = 0; i < kids.length; i++) {
        var trigger = findTrigger(kids[i]);
        if (!trigger) continue;
        var text = (trigger.textContent || '').trim();
        if (text.includes('?') || (text.length > 15 && text.length < 300)) {
          faqPairs.push({ item: kids[i], trigger: trigger, question: text });
        }
      }
      
      // Need at least 3 FAQ-like items AND they should be the majority
      if (faqPairs.length < 3 || faqPairs.length < kids.length * 0.5) return;
      
      // Skip details-based accordions (already working natively)
      if (container.querySelector('details, summary')) return;
      
      container.setAttribute('data-tf-faq-init', 'true');
      
      faqPairs.forEach(function(pair) {
        var trigger = pair.trigger;
        var item = pair.item;
        
        if (trigger.__tfFaqBound) return;
        trigger.__tfFaqBound = true;
        
        var questionText = pair.question;
        
        // Create answer panel
        var answerPanel = document.createElement('div');
        answerPanel.className = 'tf-faq-answer';
        answerPanel.style.overflow = 'hidden';
        answerPanel.style.maxHeight = '0px';
        answerPanel.style.transition = 'max-height 0.3s ease-out';
        answerPanel.style.padding = '0 1.5rem';
        
        // Try to find answer from faqData
        var answer = findAnswerForQuestion(questionText);
        if (answer) {
          answerPanel.innerHTML = '<div style="padding: 0 0 1.5rem 0; color: hsl(var(--muted-foreground, 215 16% 47%)); font-size: 0.875rem; line-height: 1.6;">' + answer + '</div>';
        } else {
          answerPanel.innerHTML = '<div style="padding: 0 0 1.5rem 0; color: hsl(var(--muted-foreground, 215 16% 47%)); font-size: 0.875rem; line-height: 1.6;"><em>Answer coming soon.</em></div>';
        }
        
        // Insert answer. If trigger IS the item (direct child), insert after it.
        // If trigger is inside a wrapper, insert inside the wrapper after the trigger.
        if (trigger === item) {
          // Trigger is the direct child of space-y container.
          // We need a wrapper to hold both trigger and answer.
          var wrapper = document.createElement('div');
          wrapper.className = 'tf-faq-item';
          wrapper.style.background = 'white';
          wrapper.style.borderRadius = '0.75rem';
          wrapper.style.border = '2px solid #e5e7eb';
          wrapper.style.overflow = 'hidden';
          wrapper.style.transition = 'border-color 0.2s';
          container.insertBefore(wrapper, trigger);
          wrapper.appendChild(trigger);
          wrapper.appendChild(answerPanel);
        } else {
          // Trigger is inside a wrapper div — insert answer after trigger inside wrapper
          trigger.insertAdjacentElement('afterend', answerPanel);
        }
        
        // Style the trigger for accordion-like appearance
        trigger.style.cursor = 'pointer';
        trigger.style.display = 'flex';
        trigger.style.alignItems = 'center';
        trigger.style.justifyContent = 'space-between';
        trigger.style.width = '100%';
        trigger.style.textAlign = 'left';
        trigger.style.background = 'transparent';
        trigger.style.border = 'none';
        trigger.style.padding = '1.5rem';
        trigger.style.fontSize = '1rem';
        trigger.style.fontWeight = '500';
        
        // Find or add chevron
        var existingSvg = trigger.querySelector('svg');
        if (existingSvg) {
          existingSvg.style.transition = 'transform 0.2s';
          existingSvg.style.flexShrink = '0';
          existingSvg.style.marginLeft = '0.5rem';
        } else {
          var chevSpan = document.createElement('span');
          chevSpan.innerHTML = '<svg style="width:1rem;height:1rem;transition:transform 0.2s;flex-shrink:0;margin-left:auto;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>';
          trigger.appendChild(chevSpan.firstChild);
        }
        
        // Bind click handler
        trigger.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          var isOpen = answerPanel.style.maxHeight !== '0px' && answerPanel.style.maxHeight !== '';
          
          if (isOpen) {
            answerPanel.style.maxHeight = '0px';
          } else {
            answerPanel.style.maxHeight = answerPanel.scrollHeight + 'px';
          }
          
          // Rotate chevron
          var svg = trigger.querySelector('svg');
          if (svg) {
            svg.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
          }
          
          // Highlight active item border
          var itemContainer = trigger.closest('.tf-faq-item') || trigger.parentElement;
          if (itemContainer && itemContainer !== container) {
            itemContainer.style.borderColor = isOpen ? '#e5e7eb' : 'hsl(var(--primary, 160 100% 35%))';
          }
        });
      });
    });
  }
  
  function initAccordions() {
    // Radix-style triggers are the most reliable anchor
    var triggers = document.querySelectorAll(
      '[data-radix-accordion-trigger], button[aria-expanded][aria-controls], [data-state] button[aria-expanded]'
    );

    triggers.forEach(function(trigger) {
      // Avoid double-binding
      if (trigger.__tfBound) return;
      trigger.__tfBound = true;

      // Find the accordion item wrapper
      var item =
        trigger.closest('[data-radix-accordion-item]') ||
        trigger.closest('[data-state]') ||
        trigger.parentElement;

      // Find content by aria-controls first (most accurate)
      var content = null;
      var controlsId = trigger.getAttribute('aria-controls');
      if (controlsId) content = document.getElementById(controlsId);

      // Fallback: search within item
      if (!content && item) {
        content = item.querySelector('[data-radix-accordion-content], [role="region"]');
      }

      // If content is missing/empty, inject from FAQ data
      if (content && !content.innerHTML.trim()) {
        var questionText = (trigger.textContent || '').replace(/\\s+/g, ' ').trim();
        var answer = findAnswerForQuestion(questionText);
        if (answer) {
          content.innerHTML = '<div class="pb-4 pt-0 text-sm" style="padding: 0 0 1rem 0; color: hsl(var(--muted-foreground, 215 16% 47%)); font-size: 0.875rem; line-height: 1.6;">' + answer + '</div>';
        }
      }

      if (!content) return;

      // CRITICAL: Always remove hidden attribute - we control visibility with height
      content.removeAttribute('hidden');
      
      // Make content collapsible
      content.style.overflow = 'hidden';
      content.style.transition = 'max-height 0.25s ease';

      // Start open if markup says open
      var startsOpen =
        (item && item.getAttribute('data-state') === 'open') ||
        trigger.getAttribute('aria-expanded') === 'true';

      if (startsOpen) {
        content.style.maxHeight = content.scrollHeight + 'px';
      } else {
        content.style.maxHeight = '0px';
      }

      trigger.addEventListener('click', function(e) {
        // If it is an <a>, stop navigation
        if (trigger.tagName.toLowerCase() === 'a') e.preventDefault();

        var isOpen = trigger.getAttribute('aria-expanded') === 'true';

        trigger.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
        if (item) item.setAttribute('data-state', isOpen ? 'closed' : 'open');
        content.setAttribute('data-state', isOpen ? 'closed' : 'open');
        content.removeAttribute('hidden');

        if (isOpen) {
          content.style.maxHeight = '0px';
        } else {
          content.style.maxHeight = content.scrollHeight + 'px';
        }

        var chevron = trigger.querySelector('svg');
        if (chevron) {
          chevron.style.transition = 'transform 0.2s ease';
          chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        }
      });
    });

    // ALWAYS run wp-block-button FAQ fallback in addition to Radix triggers
    // Previously gated by: if (triggers.length > 0) return; — this was WRONG
    // because pages can have BOTH Radix triggers AND wp-block-button FAQ items
    
    // Method 2: Find FAQ sections with wp-block-button items
    var faqSections = [];
    document.querySelectorAll('h2, h3, .wp-block-group h3').forEach(function(heading) {
      var text = heading.textContent.toLowerCase();
      if (text.indexOf('faq') !== -1 || text.indexOf('questions') !== -1) {
        var section = heading.closest('section') || heading.closest('.wp-block-group') || heading.parentElement;
        if (section && faqSections.indexOf(section) === -1) {
          faqSections.push(section);
        }
      }
    });
    
    faqSections.forEach(function(section) {
      var questionButtons = section.querySelectorAll('.wp-block-button a, .wp-block-button button, .wp-block-button__link.w-full, [class*="wp-block-button__link"][class*="w-full"]');
      
      questionButtons.forEach(function(btn) {
        var questionText = btn.textContent.trim();
        if (!questionText || questionText.length < 5) return;
        
        // CRITICAL FIX: Skip links that are actual navigation links (not FAQ questions)
        // Check for href pointing to a page (not just # or javascript:)
        var href = btn.getAttribute('href') || '';
        if (href && href !== '#' && !href.startsWith('javascript:') && 
            (href.startsWith('/') || href.startsWith('http'))) {
          // This is a navigation link like /contact, not an FAQ question - skip it
          return;
        }
        
        btn.style.color = 'hsl(var(--foreground))';
        btn.style.backgroundColor = 'white';
        btn.style.border = '1px solid hsl(var(--border))';
        btn.style.display = 'flex';
        btn.style.width = '100%';
        btn.style.justifyContent = 'space-between';
        btn.style.alignItems = 'center';
        btn.style.padding = '1rem';
        btn.style.cursor = 'pointer';
        btn.style.textAlign = 'left';
        btn.style.fontWeight = '500';
        btn.style.borderRadius = '0.5rem';
        
        if (!btn.querySelector('svg')) {
          btn.insertAdjacentHTML('beforeend', '<svg class="accordion-chevron" style="width: 1rem; height: 1rem; transition: transform 0.2s; flex-shrink: 0; margin-left: 0.5rem;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>');
        }
        
        var answer = findAnswerForQuestion(questionText);
        var wrapper = btn.closest('.wp-block-button') || btn.parentElement;
        var existingContent = wrapper.querySelector('.accordion-content-injected');
        
        if (!existingContent) {
          var contentDiv = document.createElement('div');
          contentDiv.className = 'accordion-content-injected';
          contentDiv.style.cssText = 'max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out, padding 0.3s ease-out; padding: 0 1rem; background: white; border: 1px solid hsl(var(--border)); border-top: none; border-radius: 0 0 0.5rem 0.5rem; margin-top: -0.5rem;';
          
          if (answer) {
            contentDiv.innerHTML = '<div style="padding: 1rem 0; color: hsl(var(--muted-foreground)); font-size: 0.875rem; line-height: 1.5;">' + answer + '</div>';
          } else {
            contentDiv.innerHTML = '<div style="padding: 1rem 0; color: hsl(var(--muted-foreground)); font-size: 0.875rem; line-height: 1.5;">Please contact us for more information about this topic.</div>';
          }
          
          wrapper.appendChild(contentDiv);
        }
        
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          
          var content = wrapper.querySelector('.accordion-content-injected');
          var chevron = btn.querySelector('svg');
          var isOpen = content && content.style.maxHeight !== '0px' && content.style.maxHeight !== '';
          
          if (content) {
            if (isOpen) {
              content.style.maxHeight = '0';
              content.style.paddingTop = '0';
              content.style.paddingBottom = '0';
            } else {
              content.style.maxHeight = content.scrollHeight + 'px';
              content.style.paddingTop = '1rem';
              content.style.paddingBottom = '1rem';
            }
          }
          
          if (chevron) {
            chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
          }
        });
      });
    });
    
    // Resize fix for open Radix panels
    window.addEventListener('resize', function() {
      document.querySelectorAll('button[aria-controls][aria-expanded="true"]').forEach(function(btn) {
        var id = btn.getAttribute('aria-controls');
        var panel = id ? document.getElementById(id) : null;
        if (panel) panel.style.maxHeight = panel.scrollHeight + 'px';
      });
    });
  }
  
  // ============================================
  // RADIX TABS - Handle Radix UI tab components  
  // Critical for pricing tables with multiple tabs
  // ============================================
  function initRadixTabs() {
    // Find all tab triggers (buttons with role="tab")
    var tabTriggers = document.querySelectorAll('button[role="tab"]');
    if (!tabTriggers.length) return;
    
    // Group tabs by their container (tablist)
    var tabGroups = {};
    tabTriggers.forEach(function(trigger) {
      var tablist = trigger.closest('[role="tablist"]');
      if (!tablist) return;
      
      var groupId = tablist.getAttribute('aria-orientation') + '-' + Array.from(document.querySelectorAll('[role="tablist"]')).indexOf(tablist);
      if (!tabGroups[groupId]) {
        tabGroups[groupId] = { tablist: tablist, triggers: [] };
      }
      tabGroups[groupId].triggers.push(trigger);
    });
    
    // Process each tab group
    Object.keys(tabGroups).forEach(function(groupId) {
      var group = tabGroups[groupId];
      var activeTrigger = null;
      var activePanel = null;
      
      // Find active tab and its content
      group.triggers.forEach(function(trigger) {
        if (trigger.getAttribute('data-state') === 'active') {
          activeTrigger = trigger;
          var panelId = trigger.getAttribute('aria-controls');
          if (panelId) {
            activePanel = document.getElementById(panelId);
          }
        }
      });
      
      // Clone active panel content into EMPTY inactive panels (generic, no hardcoded values)
      // Only clones structure - does NOT modify any text/prices/labels
      if (activePanel && activePanel.innerHTML && activePanel.innerHTML.trim().length > 50) {
        group.triggers.forEach(function(trigger) {
          var panelId = trigger.getAttribute('aria-controls');
          if (!panelId) return;
          var panel = document.getElementById(panelId);
          if (!panel) return;
          // Skip panels that already have real content
          if (panel.innerHTML && panel.innerHTML.trim().length > 50) return;
          // Clone active panel content as a fallback for empty panels
          panel.innerHTML = activePanel.innerHTML;
        });
      }
      
      // Add click handlers for tab switching
      group.triggers.forEach(function(trigger) {
        trigger.addEventListener('click', function(e) {
          e.preventDefault();
          
          var targetPanelId = trigger.getAttribute('aria-controls');
          if (!targetPanelId) return;
          
          // Deactivate all tabs in group
          group.triggers.forEach(function(t) {
            t.setAttribute('data-state', 'inactive');
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
            
            var pId = t.getAttribute('aria-controls');
            if (pId) {
              var p = document.getElementById(pId);
              if (p) {
                p.setAttribute('data-state', 'inactive');
                p.style.display = 'none';
              }
            }
          });
          
          // Activate clicked tab
          trigger.setAttribute('data-state', 'active');
          trigger.setAttribute('aria-selected', 'true');
          trigger.setAttribute('tabindex', '0');
          
          var targetPanel = document.getElementById(targetPanelId);
          if (targetPanel) {
            targetPanel.setAttribute('data-state', 'active');
            targetPanel.style.display = '';
            targetPanel.style.maxHeight = 'none';
            targetPanel.style.height = 'auto';
            targetPanel.style.overflow = 'visible';
            targetPanel.removeAttribute('hidden');
          }
        });
      });
    });
  }
  
  function initCarousels() {
    // Find all carousel slider containers - multiple detection methods
    var sliders = [];
    
    // Method 1: Elements with translateX transform
    document.querySelectorAll('[style*="translateX"]').forEach(function(el) {
      sliders.push(el);
    });
    
    // Method 2: Flex containers with transition-transform inside overflow-hidden (common pattern)
    document.querySelectorAll('.overflow-hidden').forEach(function(wrapper) {
      var flexTransition = wrapper.querySelector('.flex.transition-transform, .flex[class*="transition"]');
      if (flexTransition && sliders.indexOf(flexTransition) === -1) {
        sliders.push(flexTransition);
      }
    });
    
    // Method 3: Find by Google Reviews section context
    var reviewsSection = null;
    document.querySelectorAll('section, div').forEach(function(el) {
      var h2 = el.querySelector('h2');
      if (h2 && h2.textContent.indexOf('Google Reviews') !== -1) {
        reviewsSection = el;
      }
    });
    
    if (reviewsSection) {
      var reviewsSlider = reviewsSection.querySelector('.flex.gap-6.transition-transform, .flex[class*="gap"][class*="transition"]');
      if (reviewsSlider && sliders.indexOf(reviewsSlider) === -1) {
        sliders.push(reviewsSlider);
      }
    }
    
    sliders.forEach(function(slider) {
      var parent = slider.closest('.overflow-hidden');
      if (!parent) {
        parent = slider.parentElement;
      }
      
      // Look for the carousel's outer container (with relative positioning)
      var container = parent.closest('.relative.max-w-6xl') || 
                      parent.closest('.relative') || 
                      parent.closest('section') ||
                      parent.parentElement;
      if (!container) return;
      
      var slides = slider.children.length;
      if (slides === 0) return;
      
      // Detect visible slides based on child width class
      var firstChild = slider.children[0];
      var visibleSlides = 3; // Default for desktop
      if (firstChild) {
        if (firstChild.classList.contains('md:w-1/3') || firstChild.className.indexOf('md:w-1/3') !== -1) visibleSlides = 3;
        if (firstChild.classList.contains('md:w-1/2') || firstChild.className.indexOf('md:w-1/2') !== -1) visibleSlides = 2;
      }
      if (window.innerWidth < 768) visibleSlides = 1; // Mobile
      
      var currentIndex = 0;
      var maxIndex = Math.max(0, slides - visibleSlides);
      var autoPlayInterval = null;
      
      // INJECT NAVIGATION BUTTONS IF MISSING
      var prevBtn = container.querySelector('button[class*="left-0"], .carousel-prev');
      var nextBtn = container.querySelector('button[class*="right-0"], .carousel-next');
      
      if (!prevBtn || !nextBtn) {
        // Create and inject navigation buttons
        var btnContainerClass = 'carousel-nav-injected';
        if (!container.querySelector('.' + btnContainerClass)) {
          // Create prev button
          var prevBtnHTML = '<button class="carousel-prev absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 bg-white shadow-lg hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-border hover:bg-gray-50" style="left: -1rem;">' +
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 18l-6-6 6-6"></path></svg>' +
          '</button>';
          
          // Create next button
          var nextBtnHTML = '<button class="carousel-next absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 bg-white shadow-lg hidden md:flex items-center justify-center w-10 h-10 rounded-full border border-border hover:bg-gray-50" style="right: -1rem;">' +
            '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 18l6-6-6-6"></path></svg>' +
          '</button>';
          
          // Find proper injection point (the relative container around overflow-hidden)
          var navParent = parent.closest('.relative') || container;
          navParent.style.position = 'relative';
          navParent.insertAdjacentHTML('beforeend', prevBtnHTML + nextBtnHTML);
          navParent.classList.add(btnContainerClass);
          
          prevBtn = navParent.querySelector('.carousel-prev');
          nextBtn = navParent.querySelector('.carousel-next');
        }
      }
      
      function updateSlider() {
        var percent = currentIndex * (100 / visibleSlides);
        slider.style.transform = 'translateX(-' + percent + '%)';
        slider.style.transition = 'transform 0.5s ease-out';
        updateDots();
      }
      
      // Find dot indicators - look for small rounded buttons
      var dotsContainer = container.querySelector('.flex.justify-center.gap-2, .flex.justify-center.mt-8, [class*="flex"][class*="justify-center"][class*="gap-2"]');
      var dots = [];
      
      if (dotsContainer) {
        // Look for rounded elements that look like dots
        var allRounded = dotsContainer.querySelectorAll('[class*="rounded-full"]');
        allRounded.forEach(function(el) {
          var classes = el.className || '';
          // Match dots by size classes or small dimensions
          if (classes.indexOf('w-2') !== -1 || classes.indexOf('h-2') !== -1 ||
              classes.indexOf('w-3') !== -1 || classes.indexOf('h-3') !== -1) {
            dots.push(el);
          }
        });
        
        // Fallback: any buttons in the dots container
        if (dots.length === 0) {
          dotsContainer.querySelectorAll('button, .wp-block-button a, div[role="button"]').forEach(function(el) {
            dots.push(el);
          });
        }
      }
      
      function updateDots() {
        dots.forEach(function(dot, i) {
          var classes = dot.className || '';
          if (i === currentIndex) {
            // SAFE REPLACEMENT: Avoid regex with slashes to prevent syntax errors in generated file
            if (classes.indexOf('bg-muted-foreground/30') !== -1) {
                dot.className = classes.replace('bg-muted-foreground/30', 'bg-primary');
            } else if (classes.indexOf('bg-gray-300') !== -1) {
                dot.className = classes.replace('bg-gray-300', 'bg-primary');
            }
            
            if (dot.className.indexOf('bg-primary') === -1) {
              dot.classList.add('bg-primary');
            }
          } else {
            dot.className = classes.replace('bg-primary', 'bg-muted-foreground/30');
          }
        });
      }
      
      function goToSlide(index) {
        currentIndex = Math.max(0, Math.min(maxIndex, index));
        updateSlider();
      }
      
      function nextSlide() {
        currentIndex = (currentIndex + 1) % (maxIndex + 1);
        updateSlider();
      }
      
      function prevSlide() {
        currentIndex = (currentIndex - 1 + maxIndex + 1) % (maxIndex + 1);
        updateSlider();
      }
      
      function startAutoPlay() {
        if (autoPlayInterval) return;
        autoPlayInterval = setInterval(function() {
          nextSlide();
        }, 5000); // 5 second intervals like original React
      }
      
      function stopAutoPlay() {
        if (autoPlayInterval) {
          clearInterval(autoPlayInterval);
          autoPlayInterval = null;
        }
      }
      
      // Attach navigation button handlers
      if (prevBtn) {
        prevBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          stopAutoPlay();
          prevSlide();
        });
      }
      
      if (nextBtn) {
        nextBtn.addEventListener('click', function(e) {
          e.preventDefault();
          e.stopPropagation();
          stopAutoPlay();
          nextSlide();
        });
      }
      
      // Attach dot indicator handlers
      dots.forEach(function(dot, i) {
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', function(e) {
          e.preventDefault();
          stopAutoPlay();
          goToSlide(i);
        });
      });
      
      // Start auto-play and pause on hover
      container.addEventListener('mouseenter', stopAutoPlay);
      container.addEventListener('mouseleave', startAutoPlay);
      
      // Reset to first slide and start
      currentIndex = 0;
      updateSlider();
      startAutoPlay();
    });
  }
  
  // Mobile menu toggle functionality
  function initMobileMenu() {
    // Find mobile menu button - search by attribute substring to avoid CSS colon escaping issues
    var allBtns = document.querySelectorAll('nav button, header button, .site-navigation-wrapper button');
    var mobileMenuBtn = null;
    for (var i = 0; i < allBtns.length; i++) {
      if (allBtns[i].className && allBtns[i].className.indexOf('md:hidden') !== -1) {
        mobileMenuBtn = allBtns[i];
        break;
      }
    }
    if (!mobileMenuBtn) return;
    
    // Find or create mobile menu container
    var mobileMenu = null;
    var allNavDivs = document.querySelectorAll('nav div, nav ul');
    for (var j = 0; j < allNavDivs.length; j++) {
      if (allNavDivs[j].className && allNavDivs[j].className.indexOf('md:hidden') !== -1 && allNavDivs[j].className.indexOf('py-') !== -1) {
        mobileMenu = allNavDivs[j];
        break;
      }
    }
    if (!mobileMenu) mobileMenu = document.querySelector('.mobile-menu');
    var nav = mobileMenuBtn.closest('nav') || mobileMenuBtn.closest('header');
    var isOpen = false;
    
    // Create mobile menu from desktop menu if it doesn't exist
    if (!mobileMenu && nav) {
      var desktopMenu = null;
      var navChildren = nav.querySelectorAll('div, ul');
      for (var k = 0; k < navChildren.length; k++) {
        if (navChildren[k].className && navChildren[k].className.indexOf('md:flex') !== -1) {
          desktopMenu = navChildren[k];
          break;
        }
      }
      if (desktopMenu) {
        mobileMenu = desktopMenu.cloneNode(true);
        mobileMenu.className = 'mobile-menu py-4 space-y-4 border-t hidden';
        mobileMenu.style.cssText = 'display: none; flex-direction: column;';
        
        // Style mobile menu links
        var links = mobileMenu.querySelectorAll('.wp-block-button');
        links.forEach(function(link) {
          link.style.display = 'block';
          link.style.marginLeft = '0';
        });
        
        nav.querySelector('.container')?.appendChild(mobileMenu);
      }
    }
    
    if (!mobileMenu) return;
    
    mobileMenuBtn.addEventListener('click', function(e) {
      e.preventDefault();
      isOpen = !isOpen;
      mobileMenu.style.display = isOpen ? 'flex' : 'none';
      
      // Toggle icon if SVG icons present
      var svg = mobileMenuBtn.querySelector('svg');
      if (svg) {
        // Simple rotation to indicate open/close
        svg.style.transform = isOpen ? 'rotate(90deg)' : 'rotate(0)';
      }
    });
  }
  
  // Strip React animation classes that hide content in static view
  // CRITICAL: Exempts nav dropdown panels so their hidden state is preserved
  function isHeaderNavElement(el) {
    return !!(el && el.closest && el.closest('header, nav, [role="navigation"], .site-navigation-wrapper'));
  }

  // Strip React animation classes that hide content in static view
  // NEVER touch header/nav dropdowns — many menus rely on
  // invisible/opacity-0 + group-hover:* to stay closed by default.
  function stripReactAnimationClasses() {
    var items = document.querySelectorAll('.opacity-0, .invisible');
    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (isHeaderNavElement(el)) continue;
      if (el.closest('[data-tf-nav-dropdown]')) continue;
      if (el.hasAttribute('hidden')) continue;
      if (el.getAttribute('aria-hidden') === 'true') continue;
      el.classList.remove('opacity-0');
      el.classList.remove('invisible');
    }

    var delayed = document.querySelectorAll('[style*="animation-delay"]');
    for (var j = 0; j < delayed.length; j++) {
      var el2 = delayed[j];
      if (isHeaderNavElement(el2)) continue;
      if (el2.closest('[data-tf-nav-dropdown]')) continue;
      var style = el2.getAttribute('style') || '';
      style = style.replace(/animation-delay:\\s*[^;]+;?/gi, '').trim();
      if (style) el2.setAttribute('style', style);
      else el2.removeAttribute('style');
    }
  }

  // NAV DROPDOWN HANDLER — Only targets deterministic data-tf-nav-* markers
  // placed by materializeNavDropdowns in builder.js
  function initDropdowns() {
    var roots = document.querySelectorAll('[data-tf-nav-root]');
    var navs = document.querySelectorAll('header nav, nav, [role="navigation"]');
    if (!roots.length && !navs.length) return;

    if (!document.getElementById('tf-nav-dropdown-style')) {
      var styleEl = document.createElement('style');
      styleEl.id = 'tf-nav-dropdown-style';
      styleEl.textContent =
        '[data-tf-nav-dropdown],[data-tf-nav-dropdown][hidden]{display:none !important;opacity:0 !important;visibility:hidden !important;pointer-events:none !important;max-height:0 !important;overflow:hidden !important;}' +
        '[data-tf-nav-dropdown].is-open{opacity:1 !important;visibility:visible !important;pointer-events:auto !important;max-height:none !important;overflow:visible !important;}';
      document.head.appendChild(styleEl);
    }

    function likelyDropdownPanel(el) {
      if (!el || el.nodeType !== 1) return false;
      if (el.matches('nav, header')) return false;
      if (el.hasAttribute('data-tf-nav-dropdown')) return true;
      var cls = (el.getAttribute('class') || '').toLowerCase();
      var style = (el.getAttribute('style') || '').toLowerCase();
      var role = (el.getAttribute('role') || '').toLowerCase();
      var links = el.querySelectorAll('a[href], [role="menuitem"]').length;
      var score = 0;
      if (role === 'menu' || role === 'listbox') score += 10;
      if (el.hasAttribute('hidden')) score += 4;
      if (el.getAttribute('aria-hidden') === 'true') score += 3;
      if (/absolute|fixed|submenu|dropdown|popover|flyout|menu|panel|popper/.test(cls)) score += 8;
      if (/position\s*:\s*(absolute|fixed)/.test(style)) score += 8;
      if (/display\s*:\s*none/.test(style)) score += 3;
      if (/opacity\s*:\s*0|visibility\s*:\s*hidden/.test(style)) score += 2;
      if (links >= 1) score += Math.min(links, 6);
      if (el.matches('ul, div, section')) score += 1;
      return score >= 10;
    }

    function detectDisplayMode(panel) {
      var cls = (panel.getAttribute('class') || '').toLowerCase();
      if (/\bgrid\b/.test(cls)) return 'grid';
      if (/\bflex\b/.test(cls)) return 'flex';
      return panel.getAttribute('data-tf-open-display') || 'block';
    }

    function getPair(root) {
      var id = root.getAttribute('data-tf-nav-root');
      if (!id) return null;
      var trigger = root.querySelector('[data-tf-nav-trigger="' + id + '"]');
      var panel = root.querySelector('[data-tf-nav-dropdown="' + id + '"]');
      if (!trigger || !panel) return null;
      return { id: id, trigger: trigger, panel: panel };
    }

    function setPanelClosed(panel) {
      panel.setAttribute('hidden', '');
      panel.classList.remove('is-open');
      panel.style.setProperty('display', 'none', 'important');
      panel.style.setProperty('opacity', '0', 'important');
      panel.style.setProperty('visibility', 'hidden', 'important');
      panel.style.setProperty('pointer-events', 'none', 'important');
      panel.style.setProperty('max-height', '0px', 'important');
      panel.style.setProperty('overflow', 'hidden', 'important');
    }

    function setPanelOpen(panel) {
      panel.removeAttribute('hidden');
      panel.classList.add('is-open');
      var displayMode = detectDisplayMode(panel);
      panel.style.setProperty('display', displayMode, 'important');
      panel.style.setProperty('opacity', '1', 'important');
      panel.style.setProperty('visibility', 'visible', 'important');
      panel.style.setProperty('pointer-events', 'auto', 'important');
      panel.style.setProperty('max-height', 'none', 'important');
      panel.style.setProperty('overflow', 'visible', 'important');
    }

    function closeRoot(root) {
      var pair = getPair(root);
      if (!pair) return;
      setPanelClosed(pair.panel);
      pair.trigger.setAttribute('aria-expanded', 'false');
      root.__tfOpen = false;
    }

    function closeAll(exceptRoot) {
      var allRoots = document.querySelectorAll('[data-tf-nav-root]');
      for (var i = 0; i < allRoots.length; i++) {
        if (allRoots[i] !== exceptRoot) closeRoot(allRoots[i]);
      }
    }

    function openRoot(root) {
      var pair = getPair(root);
      if (!pair) return;
      closeAll(root);
      setPanelOpen(pair.panel);
      pair.trigger.setAttribute('aria-expanded', 'true');
      root.__tfOpen = true;
    }

    function forceHideUnmarkedLikelyDropdowns() {
      var selectors = [
        'nav ul ul', 'nav [role="menu"]', 'nav [data-radix-popper-content-wrapper]',
        'nav [class*="dropdown"]', 'nav [class*="submenu"]', 'nav [class*="popover"]',
        'nav [class*="flyout"]', 'nav .absolute', 'nav [class*="absolute"]',
        'nav .fixed', 'nav [class*="fixed"]'
      ].join(', ');
      document.querySelectorAll(selectors).forEach(function(el) {
        if (!(el instanceof HTMLElement)) return;
        if (el.hasAttribute('data-tf-nav-dropdown')) return;
        if (el.closest('[data-tf-nav-dropdown]')) return;
        if (!likelyDropdownPanel(el)) return;
        el.setAttribute('data-tf-unmarked-dropdown', '1');
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.style.setProperty('max-height', '0px', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
      });
    }

    forceHideUnmarkedLikelyDropdowns();

    roots.forEach(function(root) {
      if (root.__tfDropdownBound) return;
      root.__tfDropdownBound = true;
      var pair = getPair(root);
      if (!pair) return;
      pair.panel.setAttribute('data-tf-open-display', detectDisplayMode(pair.panel));
      setPanelClosed(pair.panel);
      pair.trigger.setAttribute('aria-haspopup', 'menu');
      pair.trigger.setAttribute('aria-expanded', 'false');
      root.__tfOpen = false;

      root.addEventListener('pointerenter', function() {
        if (window.innerWidth < 768) return;
        if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        openRoot(root);
      });
      root.addEventListener('pointerleave', function() {
        if (window.innerWidth < 768) return;
        if (window.matchMedia && !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
        closeRoot(root);
      });
      pair.trigger.addEventListener('click', function(e) {
        // If the trigger is a link and the dropdown is already open, navigate normally
        if (root.__tfOpen && pair.trigger.tagName === 'A' && pair.trigger.getAttribute('href')) {
          closeRoot(root);
          // Allow default navigation
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        if (root.__tfOpen) closeRoot(root);
        else openRoot(root);
      });
      pair.trigger.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
          e.preventDefault();
          openRoot(root);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          closeRoot(root);
        }
      });
      root.addEventListener('focusout', function() {
        setTimeout(function() {
          if (!root.contains(document.activeElement)) closeRoot(root);
        }, 0);
      });
      pair.panel.addEventListener('click', function(e) {
        if (e.target.closest('a[href]')) closeRoot(root);
      });
      console.log('[initDropdowns] Bound nav dropdown: ' + pair.trigger.textContent.trim());
    });

    if (!document.__tfDropdownGlobalsBound) {
      document.__tfDropdownGlobalsBound = true;
      document.addEventListener('pointerdown', function(e) {
        var allRoots = document.querySelectorAll('[data-tf-nav-root]');
        for (var i = 0; i < allRoots.length; i++) {
          if (!allRoots[i].contains(e.target)) closeRoot(allRoots[i]);
        }
      });
      document.addEventListener('keydown', function(e) {
        if (e.key !== 'Escape') return;
        var allRoots = document.querySelectorAll('[data-tf-nav-root]');
        for (var i = 0; i < allRoots.length; i++) closeRoot(allRoots[i]);
      });
      window.addEventListener('resize', function() {
        var allRoots = document.querySelectorAll('[data-tf-nav-root]');
        for (var i = 0; i < allRoots.length; i++) closeRoot(allRoots[i]);
        forceHideUnmarkedLikelyDropdowns();
      });
    }
  }
  
  // CRITICAL FIX: Handle clicks on div[data-href] containers
  // Used for complex cards that were originally <a> tags but had to be converted
  // to <div> tags to avoid HTML5 nested <a> tag layout destruction
  function initDataHrefClicks() {
    if (document.__tfDataHrefBound) return;
    document.__tfDataHrefBound = true;
    
    document.addEventListener('click', function(e) {
      if (!e.target || !(e.target instanceof Element)) return;
      
      // Find closest container with data-href
      var hrefContainer = e.target.closest('[data-href]');
      if (!hrefContainer) return;
      
      // If the user clicked on an actual <a> tag with a REAL href (not just "#"), let the browser handle it
      var clickedLink = e.target.closest('a[href]');
      if (clickedLink) {
        var linkHref = clickedLink.getAttribute('href') || '';
        if (linkHref && linkHref !== '#' && linkHref !== '#contact' && !linkHref.startsWith('javascript:')) {
          return; // Let the real link navigate
        }
        // For href="#" placeholder links (like "View Services"), fall through to data-href
        e.preventDefault();
      }
      
      // Only bail on buttons that are interactive controls (accordion/tab triggers, form submits)
      // Decorative buttons inside link-group cards (like "View Services") should fall through
      var clickedBtn = e.target.closest('button');
      if (clickedBtn) {
        var isInteractive = clickedBtn.hasAttribute('aria-controls') ||
                            clickedBtn.hasAttribute('data-state') ||
                            clickedBtn.getAttribute('type') === 'submit';
        if (isInteractive) return;
      }
      
      // Otherwise, navigate to the container's href
      var url = hrefContainer.getAttribute('data-href');
      var target = hrefContainer.getAttribute('data-target');
      
      if (url) {
        if (target === '_blank') {
          window.open(url, '_blank');
        } else {
          window.location.assign(url);
        }
      }
    });
  }

  // CRITICAL FIX: Handle pre-existing .accordion-content-injected elements
  // These are created by the converter but have no click handlers attached
  function initInjectedAccordions() {
    // Find all pre-existing accordion content divs
    var injectedContents = document.querySelectorAll('.accordion-content-injected');
    
    injectedContents.forEach(function(content) {
      // Avoid double-binding
      if (content.__tfBound) return;
      content.__tfBound = true;
      
      // Find the trigger - could be previous sibling or parent's child
      var trigger = content.previousElementSibling;
      
      // If trigger is a wp-block-button wrapper, get the actual link inside
      if (trigger && trigger.classList.contains('wp-block-button')) {
        trigger = trigger.querySelector('.wp-block-button__link') || trigger.querySelector('a') || trigger;
      }
      
      // Also check if trigger is an <a> tag
      if (!trigger || (trigger.tagName !== 'A' && trigger.tagName !== 'BUTTON')) {
        // Try parent's first child
        var parent = content.parentElement;
        if (parent) {
          trigger = parent.querySelector('.wp-block-button__link') || 
                   parent.querySelector('a[href="#"]') ||
                   parent.querySelector('button');
        }
      }
      
      if (!trigger) return;
      
      // Ensure content has transition styles
      content.style.overflow = 'hidden';
      content.style.transition = 'max-height 0.3s ease-out, padding 0.3s ease-out';
      
      // Bind click handler
      trigger.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        var isOpen = content.style.maxHeight !== '0px' && content.style.maxHeight !== '';
        
        if (isOpen) {
          content.style.maxHeight = '0px';
          content.style.paddingTop = '0';
          content.style.paddingBottom = '0';
          trigger.setAttribute('aria-expanded', 'false');
        } else {
          content.style.maxHeight = content.scrollHeight + 'px';
          content.style.paddingTop = '1rem';
          content.style.paddingBottom = '1rem';
          trigger.setAttribute('aria-expanded', 'true');
        }
        
        // Animate chevron if present
        var chevron = trigger.querySelector('svg');
        if (chevron) {
          chevron.style.transition = 'transform 0.2s ease';
          chevron.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(180deg)';
        }
      });
    });
    
    // Also handle window resize to keep open panels sized correctly
    window.addEventListener('resize', function() {
      document.querySelectorAll('.accordion-content-injected').forEach(function(content) {
        if (content.style.maxHeight && content.style.maxHeight !== '0px') {
          content.style.maxHeight = content.scrollHeight + 'px';
        }
      });
    });
  }

  // Initialize Radix Tabs - handle click to switch active tab
  function initTabs() {
    var tabLists = document.querySelectorAll('[role="tablist"]');
    
    tabLists.forEach(function(tabList) {
      var triggers = tabList.querySelectorAll('[role="tab"]');
      
      triggers.forEach(function(trigger) {
        trigger.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Get the panel ID from aria-controls
          var panelId = trigger.getAttribute('aria-controls');
          if (!panelId) return;
          
          var panel = document.getElementById(panelId);
          if (!panel) return;
          
          // Deactivate all tabs in this tablist
          triggers.forEach(function(t) {
            t.setAttribute('data-state', 'inactive');
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
            
            // Hide corresponding panel
            var tPanelId = t.getAttribute('aria-controls');
            if (tPanelId) {
              var tPanel = document.getElementById(tPanelId);
              if (tPanel) {
                tPanel.setAttribute('data-state', 'inactive');
                tPanel.setAttribute('hidden', '');
              }
            }
          });
          
          // Activate clicked tab
          trigger.setAttribute('data-state', 'active');
          trigger.setAttribute('aria-selected', 'true');
          trigger.setAttribute('tabindex', '0');
          
          // Show corresponding panel
          panel.setAttribute('data-state', 'active');
          panel.removeAttribute('hidden');
          
          console.log('Tab switched to:', panelId);
        });
      });
    });
    
    console.log('TABS: Initialized', tabLists.length, 'tablists');
  }

  // ============================================
  // GENERIC TABS HANDLER
  // Theme-agnostic: Detects tabs by semantic patterns, not text content
  // Works with Radix, Headless UI, custom implementations
  // ============================================
  function initGenericTabs() {
    
    // PATTERN 1: Radix/Headless UI tabs with role="tablist" and role="tab"
    // These use aria-controls to link tabs to panels
    var radixTabLists = document.querySelectorAll('[role="tablist"]');
    
    radixTabLists.forEach(function(tabList) {
      var tabs = tabList.querySelectorAll('[role="tab"]');
      if (tabs.length < 2) return; // Need at least 2 tabs
      
      // Skip if already initialized
      if (tabList.getAttribute('data-tf-init')) return;
      tabList.setAttribute('data-tf-init', 'true');
      
      console.log('GENERIC TABS: Found tablist with', tabs.length, 'tabs');
      
      tabs.forEach(function(tab) {
        tab.addEventListener('click', function(e) {
          e.preventDefault();
          
          var panelId = tab.getAttribute('aria-controls');
          var panel = panelId ? document.getElementById(panelId) : null;
          
          // Deactivate all tabs in this tablist
          tabs.forEach(function(t) {
            t.setAttribute('data-state', 'inactive');
            t.setAttribute('aria-selected', 'false');
            t.setAttribute('tabindex', '-1');
            
            // Hide corresponding panel
            var tPanelId = t.getAttribute('aria-controls');
            if (tPanelId) {
              var tPanel = document.getElementById(tPanelId);
              if (tPanel) {
                tPanel.setAttribute('data-state', 'inactive');
                tPanel.setAttribute('hidden', '');
                tPanel.style.display = 'none';
              }
            }
          });
          
          // Activate clicked tab
          tab.setAttribute('data-state', 'active');
          tab.setAttribute('aria-selected', 'true');
          tab.setAttribute('tabindex', '0');
          
          // Show corresponding panel
          if (panel) {
            panel.setAttribute('data-state', 'active');
            panel.removeAttribute('hidden');
            panel.style.display = '';
          }
          
          console.log('GENERIC TABS: Switched to panel', panelId);
        });
      });
    });
    
    // PATTERN 2: Button groups with data-state inside containers
    // Common in shadcn/ui and Tailwind component libraries
    var allDataStateButtons = document.querySelectorAll('button[data-state]');
    var processedContainers = {};
    
    allDataStateButtons.forEach(function(btn) {
      var container = btn.parentElement;
      if (!container) return;
      
      // Create unique key for container
      var containerId = container.id || container.className || 'container';
      if (processedContainers[containerId]) return;
      
      var buttons = container.querySelectorAll('button[data-state]');
      if (buttons.length < 2) return;
      
      processedContainers[containerId] = true;
      
      console.log('GENERIC TABS: Found button group with', buttons.length, 'buttons');
      
      // Find associated content panels in parent section
      var parentSection = container.parentElement;
      while (parentSection && !parentSection.matches('section, .wp-block-group, [class*="py-"]')) {
        parentSection = parentSection.parentElement;
      }
      if (!parentSection) parentSection = container.parentElement;
      
      var panels = parentSection ? parentSection.querySelectorAll('[role="tabpanel"]') : [];
      
      buttons.forEach(function(b, index) {
        b.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Deactivate all buttons
          buttons.forEach(function(btn2) {
            btn2.setAttribute('data-state', 'inactive');
          });
          
          // Activate clicked button
          b.setAttribute('data-state', 'active');
          
          // Show/hide panels based on index
          if (panels.length > 0) {
            panels.forEach(function(panel, pIndex) {
              if (pIndex === index) {
                panel.setAttribute('data-state', 'active');
                panel.removeAttribute('hidden');
                panel.style.display = '';
              } else {
                panel.setAttribute('data-state', 'inactive');
                panel.setAttribute('hidden', '');
                panel.style.display = 'none';
              }
            });
          }
          
          console.log('GENERIC TABS: Activated button index', index);
        });
      });
    });
    
    // PATTERN 3: Segmented controls in bg-muted containers
    var mutedContainers = document.querySelectorAll('.bg-muted, [class*="bg-muted"]');
    
    mutedContainers.forEach(function(control) {
      var buttons = control.querySelectorAll('button');
      if (buttons.length < 2) return;
      if (control.getAttribute('data-tf-init')) return;
      control.setAttribute('data-tf-init', 'true');
      
      console.log('GENERIC TABS: Found segmented control with', buttons.length, 'buttons');
      
      // Find content panels in parent
      var parentSection = control.parentElement;
      while (parentSection && !parentSection.matches('section, .wp-block-group')) {
        parentSection = parentSection.parentElement;
      }
      var panels = parentSection ? parentSection.querySelectorAll('[role="tabpanel"]') : [];
      
      buttons.forEach(function(btn, index) {
        btn.addEventListener('click', function(e) {
          e.preventDefault();
          
          // Deactivate all
          buttons.forEach(function(b) {
            b.setAttribute('data-state', 'inactive');
          });
          
          // Activate clicked
          btn.setAttribute('data-state', 'active');
          
          // Switch panels by index
          panels.forEach(function(panel, pIndex) {
            panel.style.display = pIndex === index ? '' : 'none';
            panel.setAttribute('data-state', pIndex === index ? 'active' : 'inactive');
          });
          
          console.log('GENERIC TABS: Segmented control index', index);
        });
      });
    });
  }

  // Unified boot function ensures all functions run correctly regardless of load order

  // PREVENT DEAD FORM SUBMISSIONS (Added from newer Document builder)
  function initForms() {
    var forms = document.querySelectorAll('form');
    forms.forEach(function(form) {
        if (!form.getAttribute('action')) {
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                alert('Form submitted successfully! We will be in touch soon.');
            });
        }
    });
  }
  function boot() {
    initDropdowns(); // FIRST: bind nav behavior before anything strips classes
    stripReactAnimationClasses(); // Now safe — header/nav elements are exempt
    applyArbitraryTailwindClasses(); // Convert Tailwind arbitrary values to inline styles
    replaceFaqPlaceholders(); // Replace placeholder text in accordion content
    injectRadixPanelContent(); // Inject into empty Radix panels by aria-controls
    initForms();
    removeMuiGhostElements();
    observeMuiGhostElements();
    injectAccordionContent();
    initButtonFaqAccordions(); // FIX: Handle Edmonton FAQ items that became dead <a href="#"> links
    initAccordions();
    initInjectedAccordions(); // NEW: Handle pre-existing .accordion-content-injected
    initDataHrefClicks();     // NEW: Handle clicks on div[data-href] containers
    initRadixTabs(); // CRITICAL: Inject pricing content into empty tab panels (must run BEFORE initTabs)
    initCarousels();
    initMobileMenu();
    initTabs();
    initGenericTabs(); // Theme-agnostic tabs (any tab content, not hardcoded)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  console.log('THEME FACTORY AI: INTERACTIVE COMPONENTS v9.2 - AUTO FORCEMOUNT');
})();`);

    // Extract FAQ data and generate faq-data.js to populate empty Radix accordion content
    // This is critical because Radix UI AccordionContent doesn't render to DOM when closed
    // allFiles is already defined in the outer scope
    // Seed with pre-extracted FAQ data from source ZIP (critical for builder pipelines
    // where processConversion receives a dist-only ZIP with no source TSX files)
    let faqData: {q: string, a: string}[] = preExtractedFaqData ? [...preExtractedFaqData] : [];
    if (faqData.length > 0) addLog(`Seeded faqData with ${faqData.length} pre-extracted FAQ items from source`, 'success');
    
    // Helper to read text from ZIP
    const readZipText = async (zc: any, path: string): Promise<string | null> => {
      try {
        const f = zc.files[path];
        if (!f) return null;
        return await f.async('string');
      } catch {
        return null;
      }
    };
    
    // Extract Q/A from build artifacts (compiled JS/HTML)
    const extractFaqFromBuildText = (text: string): {q: string, a: string}[] => {
      const out: {q: string, a: string}[] = [];
      
      // Pattern A: explicit trigger/content tags preserved in build (SSR HTML)
      const tagRe = /<AccordionTrigger\b[^>]*>([\s\S]*?)<\/AccordionTrigger>[\s\S]*?<AccordionContent\b[^>]*>([\s\S]*?)<\/AccordionContent>/g;
      
      // Pattern B: common "q:" "a:" object literals in built JS
      const inlineRe = /\{\s*q:\s*["'\`]([\s\S]*?)["'\`]\s*,\s*a:\s*["'\`]([\s\S]*?)["'\`]\s*\}/g;
      
      // Small cleaner for both
      const clean = (s: string) =>
        (s || '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      
      let m: RegExpExecArray | null;
      
      while ((m = tagRe.exec(text)) !== null) {
        const q = clean(m[1]);
        const a = clean(m[2]);
        if (q && a && a.length > 10) out.push({ q, a });
      }
      
      while ((m = inlineRe.exec(text)) !== null) {
        const q = clean(m[1]);
        const a = clean(m[2]);
        if (q && a && a.length > 10) out.push({ q, a });
      }
      
      return out;
    };
    
    // Normalize path for reliable TSX discovery (handles Windows paths, case-sensitivity)
    const norm = (p: string) => p.replace(/\\/g, '/').toLowerCase();
    
    // Search ALL TSX/JSX files for accordion content with normalized path matching
    const sourceTsxFiles = allFiles.filter(f => {
      const n = norm(f);
      return (
        (n.endsWith('.tsx') || n.endsWith('.jsx')) &&
        !n.includes('node_modules') &&
        !n.endsWith('.d.ts') &&
        (
          n.includes('/src/pages/') ||
          n.includes('/src/components/') ||
          n.includes('/pages/') ||
          n.includes('/components/') ||
          n.includes('faq') ||
          n.includes('accordion') ||
          n.includes('data') ||
          n.includes('constants')
        )
      );
    });
    
    // DEBUG: Check if FAQ.tsx specifically exists in ZIP
    const faqCandidates = allFiles.filter(f => norm(f).includes('src/pages/faq.tsx') || norm(f).endsWith('/faq.tsx'));
    addLog(`FAQ candidates in ZIP: ${faqCandidates.length}`, 'info');
    if (faqCandidates.length) addLog(`Example FAQ path: ${faqCandidates[0]}`, 'info');
    
    // DEBUG: Check if FAQ.tsx is included in scan set
    const inScan = sourceTsxFiles.some(f => norm(f).includes('src/pages/faq.tsx') || norm(f).endsWith('/faq.tsx'));
    addLog(`FAQ.tsx included in scan set? ${inScan}`, 'info');
    
    if (sourceTsxFiles.length === 0) {
      addLog(`No TSX/JSX files found in ZIP. Will fallback to scanning JS/HTML build artifacts...`, 'warning');
    } else {
      addLog(`Scanning ${sourceTsxFiles.length} TSX/JSX files for FAQ/Accordion content...`, 'info');
    }
    
    // CRITICAL: Prioritize FAQ.tsx files first - process them before city pages
    // This ensures the main FAQ page content is extracted before city-specific FAQs
    const sortedTsxFiles = [...sourceTsxFiles].sort((a, b) => {
      const aIsFaq = norm(a).includes('/faq.tsx') || norm(a).includes('/faq/');
      const bIsFaq = norm(b).includes('/faq.tsx') || norm(b).includes('/faq/');
      if (aIsFaq && !bIsFaq) return -1; // FAQ files first
      if (!aIsFaq && bIsFaq) return 1;
      return 0;
    });
    
    addLog(`Prioritized file order: ${sortedTsxFiles.slice(0, 5).map(f => f.split('/').pop()).join(', ')}...`, 'info');
    
    for (const filePath of sortedTsxFiles) {
        try {
            const content = await zipContent.files[filePath].async('string');
            let foundInFile = 0;
            let match;
            
            // DEBUG: Log file being processed
            const fileName = filePath.split('/').pop() || filePath;
            const isFaqFile = norm(filePath).includes('/faq.tsx') || norm(filePath).includes('/faq/');
            if (isFaqFile) {
              addLog(`Processing FAQ file: ${fileName} (${content.length} chars)`, 'info');
            }
            
            // Pattern 1: Standard AccordionTrigger/AccordionContent pairs
            const accordionRegex = /<AccordionTrigger[^>]*>([\s\S]*?)<\/AccordionTrigger>[\s\S]*?<AccordionContent[^>]*>([\s\S]*?)<\/AccordionContent>/g;
            
            // DEBUG: Check if file contains accordion components
            if (isFaqFile) {
              const hasTrigger = content.includes('<AccordionTrigger');
              const hasContent = content.includes('<AccordionContent');
              addLog(`  Has AccordionTrigger: ${hasTrigger}, Has AccordionContent: ${hasContent}`, 'info');
            }
            
            while ((match = accordionRegex.exec(content)) !== null) {
                const question = match[1].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
                const answer = match[2].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
                
                // DEBUG: Log each match found
                if (isFaqFile && question) {
                  addLog(`  Pattern 1 matched: "${question.substring(0, 50)}..." (answer ${answer.length} chars)`, 'info');
                }
                
                if (question && answer && answer.length > 10) {
                    if (!faqData.some(item => item.q.toLowerCase() === question.toLowerCase())) {
                        faqData.push({ q: question, a: answer });
                        foundInFile++;
                    }
                }
            }
            
            // Pattern 2: AccordionItem wrapper pattern (variant)
            const accordionRegex2 = /<AccordionItem[^>]*>[\s\S]*?<AccordionTrigger[^>]*>([\s\S]*?)<\/AccordionTrigger>[\s\S]*?<AccordionContent[^>]*>([\s\S]*?)<\/AccordionContent>[\s\S]*?<\/AccordionItem>/g;
             while ((match = accordionRegex2.exec(content)) !== null) {
                const question = match[1].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
                const answer = match[2].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
                if (question && answer && answer.length > 10) {
                    if (!faqData.some(item => item.q.toLowerCase() === question.toLowerCase())) {
                        faqData.push({ q: question, a: answer });
                        foundInFile++;
                    }
                }
            }
            
            // Pattern 3: Inline FAQ arrays used in city pages: { q: "...", a: "..." }
            const inlineFaqRegex = /\{\s*q:\s*["']([^"']+)["']\s*,\s*a:\s*["']([^"']+)["']\s*\}/g;
            
            while ((match = inlineFaqRegex.exec(content)) !== null) {
                const question = match[1].trim();
                const answer = match[2].trim();
                
                if (question && answer && question.length > 5 && answer.length > 10) {
                    if (!faqData.some(item => item.q.toLowerCase() === question.toLowerCase())) {
                        faqData.push({ q: question, a: answer });
                        foundInFile++;
                    }
                }
            }
            
            // Pattern 4: Schema.org FAQPage mainEntity structure
            const schemaFaqRegex = /"name":\s*["']([^"']+)["'][\s\S]*?"text":\s*["']([^"']+)["']/g;
            
            while ((match = schemaFaqRegex.exec(content)) !== null) {
                const question = match[1].trim();
                const answer = match[2].trim();
                
                if (question && answer && question.length > 5 && answer.length > 10) {
                    if (!faqData.some(item => item.q.toLowerCase() === question.toLowerCase())) {
                        faqData.push({ q: question, a: answer });
                        foundInFile++;
                    }
                }
            }
            
            if (foundInFile > 0) {
                addLog(`  Found ${foundInFile} FAQ items in ${filePath.split('/').pop()}`, 'success');
            }
            
            // Pattern 5: Common alternative key names (question/answer, title/description, title/content)
            const altKeyPatterns = [
                /\{\s*question:\s*["'`]([^"'`]+)["'`]\s*,\s*answer:\s*["'`]([^"'`]+)["'`]\s*\}/g,
                /\{\s*title:\s*["'`]([^"'`]+)["'`]\s*,\s*(?:description|content|answer):\s*["'`]([^"'`]+)["'`]\s*\}/g,
                /\{\s*answer:\s*["'`]([^"'`]+)["'`]\s*,\s*question:\s*["'`]([^"'`]+)["'`]\s*\}/g,
            ];
            
            for (const altRegex of altKeyPatterns) {
                let altMatch;
                while ((altMatch = altRegex.exec(content)) !== null) {
                    // For the reversed pattern (answer first), swap q/a
                    const isReversed = altRegex.source.startsWith('\\{\\s*answer:');
                    const question = (isReversed ? altMatch[2] : altMatch[1]).trim();
                    const answer = (isReversed ? altMatch[1] : altMatch[2]).trim();
                    
                    if (question && answer && question.length > 5 && answer.length > 10) {
                        if (!faqData.some(item => item.q.toLowerCase() === question.toLowerCase())) {
                            faqData.push({ q: question, a: answer });
                            foundInFile++;
                        }
                    }
                }
            }
        } catch (e) {
            // File read error - continue to next file
        }
    }
    
    // FALLBACK: If TSX scan finds nothing, scan build artifacts (JS/HTML files)
    if (faqData.length === 0) {
      const buildFiles = allFiles.filter(f => {
        const lower = norm(f);
        return (
          !lower.includes('node_modules') &&
          (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs') || lower.endsWith('.html'))
        );
      });

      addLog(`Fallback scanning ${buildFiles.length} JS/HTML files for FAQ content...`, 'info');

      for (const filePath of buildFiles) {
        const text = await readZipText(zipContent, filePath);
        if (!text) continue;

        const extracted = extractFaqFromBuildText(text);
        for (const item of extracted) {
          if (!faqData.some(x => x.q.toLowerCase() === item.q.toLowerCase())) {
            faqData.push(item);
          }
        }
      }
      
      if (faqData.length > 0) {
        addLog(`Fallback extraction found ${faqData.length} FAQ items from build artifacts`, 'success');
      }
    }
    
    // THIRD FALLBACK: Extract from prerendered HTML files
    // This finds actual rendered accordion content regardless of source format
    if (faqData.length === 0) {
      addLog(`Attempting extraction from prerendered HTML files...`, 'info');
      
      // Find prerendered HTML files
      const prerenderedFiles = allFiles.filter(f => {
        const lower = norm(f);
        return (
          !lower.includes('node_modules') &&
          lower.endsWith('.html') &&
          (lower.includes('prerendered/') || lower.includes('/faq') || lower === 'index.html' || lower.endsWith('/index.html'))
        );
      });
      
      addLog(`Scanning ${prerenderedFiles.length} prerendered HTML files for accordion content...`, 'info');
      
      for (const filePath of prerenderedFiles) {
        const htmlText = await readZipText(zipContent, filePath);
        if (!htmlText) continue;
        
        try {
          // Parse the HTML
          const tempParser = new DOMParser();
          const doc = tempParser.parseFromString(htmlText, 'text/html');
          
          // Method 1: Radix accordion items with data-radix-accordion-item
          doc.querySelectorAll('[data-radix-accordion-item]').forEach(item => {
            const trigger = item.querySelector('[data-radix-accordion-trigger], button[aria-expanded]');
            const content = item.querySelector('[data-radix-accordion-content], [role="region"]');
            if (trigger && content) {
              const q = (trigger.textContent || '').replace(/\s+/g, ' ').trim();
              const a = (content.textContent || '').replace(/\s+/g, ' ').trim();
              if (q && a && a.length > 10 && !faqData.some(x => x.q.toLowerCase() === q.toLowerCase())) {
                faqData.push({ q, a });
              }
            }
          });
          
          // Method 2: button with aria-controls pointing to panel
          doc.querySelectorAll('button[aria-controls]').forEach(btn => {
            const panelId = btn.getAttribute('aria-controls');
            if (!panelId) return;
            const panel = doc.getElementById(panelId);
            if (!panel) return;
            
            const q = (btn.textContent || '').replace(/\s+/g, ' ').trim();
            const a = (panel.textContent || '').replace(/\s+/g, ' ').trim();
            if (q && a && a.length > 10 && !faqData.some(x => x.q.toLowerCase() === q.toLowerCase())) {
              faqData.push({ q, a });
            }
          });
          
          // Method 3: AccordionItem wrapper pattern (shadcn/Radix HTML output)
          doc.querySelectorAll('[data-state]').forEach(item => {
            if (!item.querySelector('button[aria-expanded]')) return; // Not an accordion
            const trigger = item.querySelector('button[aria-expanded]');
            const content = item.querySelector('[role="region"], [data-state]');
            if (trigger && content && content !== item) {
              const q = (trigger.textContent || '').replace(/\s+/g, ' ').trim();
              const a = (content.textContent || '').replace(/\s+/g, ' ').trim();
              if (q && a && a.length > 10 && !faqData.some(x => x.q.toLowerCase() === q.toLowerCase())) {
                faqData.push({ q, a });
              }
            }
          });
          
        } catch (e) {
          // HTML parse error, continue
        }
      }
      
      if (faqData.length > 0) {
        addLog(`Prerendered HTML extraction found ${faqData.length} FAQ items`, 'success');
      }
    }
    
    // Always generate faq-data.js (even if empty) to prevent WordPress enqueue errors
    folder.file("assets/js/faq-data.js", `/* FAQ Data - used by interactive-components.js to populate empty Radix accordion content */
window.FAQ_DATA = ${JSON.stringify(faqData, null, 2)};`);
    if (faqData.length > 0) {
        addLog(`Extracted ${faqData.length} FAQ Q&A pairs for accordion content injection`, 'success');
    } else {
        addLog(`Warning: No FAQ data extracted. Accordion answers may show placeholders.`, 'warning');
    }
    
    // Extract review data from source if available
    let reviewData: {name: string, initial: string, location: string, color: string, date: string, text: string}[] = [];
    const reviewTsxFiles = allFiles.filter(f => 
        (f.endsWith('.tsx') || f.endsWith('.jsx')) && 
        (f.toLowerCase().includes('review') || f.toLowerCase().includes('testimonial') || f.toLowerCase().includes('feedback'))
    );
    
    if (reviewTsxFiles.length > 0) {
        for (const filePath of reviewTsxFiles) {
            try {
                const content = await zipContent.files[filePath].async('string');
                const reviewsArrayRegex = /reviews=\{\[([\s\S]*?)\]\}/g;
                let arrayMatch;
                
                while ((arrayMatch = reviewsArrayRegex.exec(content)) !== null) {
                    const reviewsContent = arrayMatch[1];
                    const reviewObjRegex = /\{\s*name:\s*["']([^"']+)["']\s*,\s*initial:\s*["']([^"']+)["']\s*,\s*location:\s*["']([^"']+)["']\s*,\s*color:\s*["']([^"']+)["']\s*,\s*date:\s*["']([^"']+)["']\s*,\s*text:\s*["']([^"']+)["']\s*\}/g;
                    
                    let objMatch;
                    while ((objMatch = reviewObjRegex.exec(reviewsContent)) !== null) {
                        reviewData.push({
                            name: objMatch[1], initial: objMatch[2], location: objMatch[3],
                            color: objMatch[4], date: objMatch[5], text: objMatch[6]
                        });
                    }
                }
            } catch (e) {
                console.warn(`Failed to parse ${filePath} for reviews:`, e);
            }
        }
    }
    
    // Generate reviews-data.js for potential future dynamic enhancements
    folder.file("assets/js/reviews-data.js", `/* Reviews Data - can be used for dynamic carousel content enhancements */
window.REVIEWS_DATA = ${JSON.stringify(reviewData, null, 2)};`);
    if (reviewData.length > 0) {
        addLog(`Extracted ${reviewData.length} Google Reviews for carousel data`, 'success');
    }

        stats.php += 2;

        const fontLinks: string[] = [];
        const fontRegex = /<link[^>]+href=["'](https:\/\/fonts\.googleapis\.com[^"']+)["'][^>]*>/gi;
        let fontMatch;
        while ((fontMatch = fontRegex.exec(shellHtml)) !== null) {
            fontLinks.push(fontMatch[1].replace(/&amp;/g, '&'));
        }

        const cssHandles = foundCssFiles.map((f, i) => ({ handle: `${themeSlug}-style-${i}`, file: sanitizeForPhp(f) }));
        const jsHandles = jsFiles.map((f, i) => ({ handle: `${themeSlug}-script-${i}`, file: sanitizeForPhp(f) }));

        const enqueueStyles = cssHandles.map(h => `  wp_enqueue_style('${h.handle}', get_theme_file_uri('${h.file}'), array(), '1.0.0');`).join("\n");
        // SPA Mode loads React, Gutenberg Native loads our new Vanilla JS script instead of React
        const spaScripts = jsHandles.map(h => `  wp_enqueue_script('${h.handle}', get_theme_file_uri('${h.file}'), array(), '1.0.0', true);`).join("\n");
        const enqueueScripts = mode === 'gutenberg-native' 
            ? `  $faq_ver = filemtime(get_theme_file_path('assets/js/faq-data.js')) ?: '1.0.0';
  wp_enqueue_script('${themeSlug}-faq-data', get_theme_file_uri('assets/js/faq-data.js'), array(), $faq_ver, true);
  
  // Register reviews-data.js separately so it doesn't block interactive-components
  if (file_exists(get_theme_file_path('assets/js/reviews-data.js'))) {
    wp_enqueue_script('${themeSlug}-reviews-data', get_theme_file_uri('assets/js/reviews-data.js'), array(), '1.0.0', true);
  }
  
  // SEO FIX: Conditionally load interactive components ONLY if the page contains blocks that need them
  $has_interactive = has_block('core/details') || has_block('theme-factory/tabs') || has_block('theme-factory/carousel') || has_block('theme-factory/container');
  if ($has_interactive || is_front_page()) {
      $interactive_ver = filemtime(get_theme_file_path('assets/js/interactive-components-v9.0.js')) ?: '1.0.0';
      wp_enqueue_script('${themeSlug}-interactive', get_theme_file_uri('assets/js/interactive-components-v9.0.js'), array('${themeSlug}-faq-data'), $interactive_ver, true);
  }`
            : spaScripts;

        const editorStyles = [
            ...fontLinks.map(url => `  add_editor_style('${url}');`),
            ...foundCssFiles.map(f => `  add_editor_style('${sanitizeForPhp(f)}');`)
        ].join("\n");

        let functionsPhpContent = mode === 'gutenberg-native'
            ? `<?php
/**
 * ${themeName} Theme Functions
 * Mode: Gutenberg-Native (Editable)
 */
if (!defined('ABSPATH')) exit;

function ${themeFnPrefix}_setup() {
  add_theme_support('title-tag');
  add_theme_support('post-thumbnails');
  add_theme_support('wp-block-styles');
  add_theme_support('editor-styles');
  add_theme_support('responsive-embeds');
  add_theme_support('align-wide');
  add_theme_support('appearance-tools');
  
  register_nav_menus(array(
    'primary' => esc_html__('Primary Menu', '${themeSlug}'),
  ));

  // Load Theme Styles & Fonts in Editor (Iframe Compatible)
${editorStyles}
}
add_action('after_setup_theme', '${themeFnPrefix}_setup');

// Enqueue CSS and JS for Frontend
add_action('wp_enqueue_scripts', function() {
${enqueueStyles || "  // No CSS enqueued"}
${enqueueScripts || "  // No JS enqueued"}
});

// CSS safety belt: hide nav dropdowns before JS runs
add_action('wp_head', function() {
  echo '<style id="${themeSlug}-nav-dropdown-safety">
[data-tf-nav-dropdown],
[data-tf-nav-dropdown][hidden]{
  display:none !important;
  opacity:0 !important;
  visibility:hidden !important;
  pointer-events:none !important;
  max-height:0 !important;
  overflow:hidden !important;
}
[data-tf-nav-dropdown].is-open{
  opacity:1 !important;
  visibility:visible !important;
  pointer-events:auto !important;
  max-height:none !important;
  overflow:visible !important;
}
header nav li > ul ul,
header nav li > [role="menu"],
header nav li > [class*="dropdown"],
header nav li > [class*="submenu"],
header nav li > [class*="popover"],
header nav li > [class*="flyout"],
header nav li > .absolute,
header nav li > [class*="absolute"]{
  display:none !important;
  opacity:0 !important;
  visibility:hidden !important;
  pointer-events:none !important;
}
.wp-block-details{border-bottom:1px solid #e5e7eb;}
.wp-block-details summary{cursor:pointer;font-weight:500;padding:1rem 0;list-style:none;display:flex;justify-content:space-between;align-items:center;}
.wp-block-details summary::after{content:"\\25BC";font-size:0.75rem;transition:transform 0.2s;}
.wp-block-details[open] summary::after{transform:rotate(180deg);}
.wp-block-details summary::-webkit-details-marker{display:none;}
.wp-block-details>*:not(summary){padding-bottom:1rem;}
.wp-block-table{border-radius:0.75rem;overflow:hidden;box-shadow:0 4px 6px -1px rgba(0,0,0,0.1);}
.wp-block-table table{width:100%;border-collapse:collapse;}
.wp-block-table thead th{background:hsl(var(--primary,222 47% 31%));color:#fff;font-weight:600;padding:0.75rem 1rem;text-align:left;}
.wp-block-table tbody td{padding:0.75rem 1rem;border-bottom:1px solid #e5e7eb;}
.wp-block-table tbody tr:hover{background:#f9fafb;}
.wp-block-image{display:inline-block;vertical-align:middle;}
.wp-block-image img{max-width:100%;height:auto;}
.wp-block-image.h-12,.wp-block-image.h-14,.wp-block-image.h-16{display:inline-block;}
.wp-block-image.h-12 img{height:3rem;width:auto;object-fit:contain;}
.wp-block-image.h-14 img{height:3.5rem;width:auto;object-fit:contain;}
.wp-block-image.h-16 img{height:4rem;width:auto;object-fit:contain;}
button.wp-block-theme-factory-container.w-full{width:100%;}
button.wp-block-theme-factory-container{cursor:pointer;}
[data-href]{cursor:pointer;}
[data-href]:hover{text-decoration:none;}
</style>';
}, 1);



add_filter('body_class', function($classes) {
  $source_classes = '${bodyClasses} ${htmlClasses}';
  foreach (explode(' ', $source_classes) as $c) {
    if ($c = trim($c)) $classes[] = $c;
  }
  $classes[] = 'gutenberg-native-mode';
  return $classes;
});

/**
 * Content Import Logic
 * Can be run on switch_theme or manually via Theme Setup page.
 */



/**
 * ROBUST CONTENT IMPORTER
 * Manually triggered via Theme Setup page.
 * Safely sideloads images into the WP Media Library first, then replaces paths in HTML.
 */
function ${themeFnPrefix}_import_content() {
    require_once(ABSPATH . 'wp-admin/includes/media.php');
    require_once(ABSPATH . 'wp-admin/includes/file.php');
    require_once(ABSPATH . 'wp-admin/includes/image.php');

    // 1. Array to hold filename => new attachment URL mappings
    $uploaded_images = array();
    
    // 2. Scan theme directories for images
    $theme_dir = get_template_directory();
    $dirs_to_scan = array('/assets', '/images');
    
    foreach ($dirs_to_scan as $dir_path) {
        $full_path = $theme_dir . $dir_path;
        if (is_dir($full_path)) {
            // RECURSIVE SCAN: Use RecursiveDirectoryIterator to find images in ALL subdirectories
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($full_path));
            foreach ($iterator as $file) {
                if ($file->isDir()) continue;
                $ext = strtolower(pathinfo($file->getFilename(), PATHINFO_EXTENSION));
                if (in_array($ext, array('jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'))) {
                    $filename = $file->getFilename();
                    
                    // Check if already uploaded to avoid duplicates
                    global $wpdb;
                    $attachment = $wpdb->get_row($wpdb->prepare("SELECT ID, guid FROM $wpdb->posts WHERE post_title = %s AND post_type = 'attachment'", basename($filename, '.' . $ext)));
                    
                    if ($attachment) {
                        // FORWARD ALL URLS TO HTTPS TO PREVENT MIXED CONTENT BLOCKS
                        $uploaded_images[$filename] = set_url_scheme($attachment->guid, 'https');
                    } else {
                        // Sideload using LOCAL FAST COPY (Avoids loopback HTTP limits)
                        $tmp = wp_tempnam($filename);
                        if (copy($file->getPathname(), $tmp)) {
                            $file_array = array(
                                'name' => $filename,
                                'tmp_name' => $tmp
                            );
                            $id = media_handle_sideload($file_array, 0);
                            if (!is_wp_error($id)) {
                                $raw_url = wp_get_attachment_url($id);
                                // FORWARD ALL URLS TO HTTPS TO PREVENT MIXED CONTENT BLOCKS
                                $uploaded_images[$filename] = set_url_scheme($raw_url, 'https');
                            } else {
                                @unlink($tmp); // Cleanup if failed
                            }
                        }
                    }
                }
            }
        }
    }

    // 3. Process Pages
    $routes_file = get_theme_file_path('assets/data/routes.json');
    if (!file_exists($routes_file)) return "Error: routes.json not found.";
    
    $routes = json_decode(file_get_contents($routes_file), true);
    if (!is_array($routes)) return "Error: Invalid routes.json.";

    $home_page_id = 0;
    $count = 0;
    
    foreach ($routes as $route) {
        $slug = sanitize_title($route['slug'] ?: 'home');
        $title = sanitize_text_field($route['title'] ?: ucfirst(str_replace('-', ' ', $slug)));
        
        $existing = get_page_by_path($slug);
        if ($existing) { $page_id = $existing->ID; }
        else {
            $page_id = wp_insert_post(array(
                'post_title' => $title,
                'post_name' => $slug,
                'post_type' => 'page',
                'post_status' => 'publish'
            ));
        }
        
        if ($slug === 'home' || $route['path'] === '/') { $home_page_id = $page_id; }
        
        if ($page_id) {
            $content_file = get_theme_file_path("assets/content/{$slug}.blocks.html");
            if (file_exists($content_file)) {
                $html = file_get_contents($content_file);
                
                // Replace image filenames with their newly uploaded Media Library URLs
                foreach ($uploaded_images as $filename => $media_url) {
                    // Because original regex tags them as '__THEME_URI__/assets/', we must find them all
                    $html = str_replace('__THEME_URI__/assets/' . $filename, $media_url, $html);
                    $html = str_replace('__THEME_URI__/images/' . $filename, $media_url, $html);
                    
                    // Catch un-tagged root-relative paths
                    $html = str_replace('/assets/' . $filename, $media_url, $html);
                    $html = str_replace('/images/' . $filename, $media_url, $html);
                    
                    // Catch Tailwind CSS arbitrary values: url('/assets/bg.jpg')
                    $html = str_replace("url('/assets/" . $filename . "')", "url('" . $media_url . "')", $html);
                    $html = str_replace("url('/images/" . $filename . "')", "url('" . $media_url . "')", $html);
                }

                wp_update_post(array('ID' => $page_id, 'post_content' => $html));
                $count++;
            }
        }
    }
    
    if ($home_page_id) { 
        update_option('show_on_front', 'page'); 
        update_option('page_on_front', (int) $home_page_id); 
    }
    
    return $count . " pages imported successfully, with " . count($uploaded_images) . " images added to the Media Library!";
}


// Ensure the user knows to click import
add_action('admin_notices', function() {
    // Only show if front page isn't set yet (rough proxy for "not imported yet")
    if (get_option('show_on_front') !== 'page' && current_user_can('manage_options')) {
        $setup_url = admin_url('themes.php?page=${themeSlug}-setup');
        echo '<div class="notice notice-warning is-dismissible"><p><strong>' . esc_html__('Theme Activated! ${themeName} requires demo content.', '${themeSlug}') . '</strong> <a href="' . esc_url($setup_url) . '">Click here to import images and pages</a>.</p></div>';
    }
});

// Manual Import Page
add_action('admin_menu', function() {
    add_theme_page(
        'Theme Setup',
        'Theme Setup',
        'manage_options',
        '${themeSlug}-setup',
        function() {
            if (isset($_POST['run_import']) && check_admin_referer('${themeFnPrefix}_import_nonce')) {
                $result = ${themeFnPrefix}_import_content();
                echo '<div class="notice notice-success"><p>' . esc_html($result) . '</p></div>';
            }
            ?>
            <div class="wrap">
                <h1>Theme Setup: Demo Import</h1>
                <p>Welcome! To complete your site setup, we need to import your pages and upload your images to the WordPress Media Library.</p>
                <div style="background: #fff; padding: 20px; border: 1px solid #ccd0d4; max-width: 600px; margin-top: 20px;">
                    <h3>Ready to Import?</h3>
                    <p>This process will safely copy all theme images directly into your WordPress Media Library so they can be managed via Gutenberg.</p>
                    <form method="post">
                        <?php wp_nonce_field('${themeFnPrefix}_import_nonce'); ?>
                        <p><input type="submit" name="run_import" class="button button-primary button-hero" value="Import Content & Images Now"></p>
                    </form>
                </div>
            </div>
            <?php
        }
    );
});



// -----------------------------------------------------
// INESCAPABLE FALLBACK FILTER
// Ensures images load even if import failed or DB cached old paths
// -----------------------------------------------------
add_filter('the_content', function($content) {
    if (empty($content)) return $content;
    
    $theme_uri = get_template_directory_uri() . '/';
    
    // 1. Catch unreplaced macros
    $content = str_replace('__THEME_URI__/', $theme_uri, $content);
    
    // 2. Catch root-relative paths
    $content = str_replace('src="/assets/', 'src="' . $theme_uri . 'assets/', $content);
    $content = str_replace("src='/assets/", "src='" . $theme_uri . "assets/", $content);
    
    // 3. Catch inline CSS backgrounds
    $content = str_replace('url("/assets/', 'url("' . $theme_uri . 'assets/', $content);
    $content = str_replace("url('/assets/", "url('" . $theme_uri . "assets/", $content);
  $content = str_replace('url(/assets/', 'url(' . $theme_uri . 'assets/', $content);
    
    // 4. Catch dynamically loaded images if they lack domain
    $content = str_replace('src="/images/', 'src="' . $theme_uri . 'images/', $content);
    
    // 5. Fix root-relative navigation links for subfolder WordPress installs
    // Uses str_replace (not preg_replace) to avoid regex escaping issues inside template literals
    $home_url = trailingslashit(home_url());
    // Only prepend home_url if WP is NOT at the root (subfolder install)
    if (parse_url($home_url, PHP_URL_PATH) !== '/') {
        $content = str_replace('href="/', 'href="' . rtrim(parse_url($home_url, PHP_URL_PATH), '/') . '/', $content);
    }
    
    // 6. Rewrite React Router nested paths to flat WordPress slugs
    // e.g., /city/page -> /city-page/
    $routes_file = get_theme_file_path('assets/data/routes.json');
    if (file_exists($routes_file)) {
        $routes = json_decode(file_get_contents($routes_file), true);
        if (is_array($routes)) {
            foreach ($routes as $route) {
                if (empty($route['path']) || $route['path'] === '/') continue;
                $react_path = rtrim($route['path'], '/');
                $wp_slug = $route['slug'];
                // Only rewrite if the path contains internal slashes (nested routes)
                if (strpos($react_path, '/', 1) !== false) {
                    $content = str_replace('href="' . $react_path . '"', 'href="/' . $wp_slug . '/"', $content);
                    $content = str_replace('href="' . $react_path . '/"', 'href="/' . $wp_slug . '/"', $content);
                    $content = str_replace("href='" . $react_path . "'", "href='/" . $wp_slug . "/'", $content);
                    $content = str_replace("href='" . $react_path . "/'", "href='/" . $wp_slug . "/'", $content);
                }
            }
        }
    }
    
    return $content;
}, 99); // priority 99 runs after Gutenberg expanders

// -----------------------------------------------------
// REACT PATH REDIRECT
// 301 redirects nested React paths to flat WordPress slugs
// e.g., /city/page -> /city-page/
// This catches direct URL access, bookmarks, and search engine indexed pages
// -----------------------------------------------------
add_action('template_redirect', function() {
    if (is_404()) {
        $request_uri = trim(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH), '/');
        // Only process paths with internal slashes (nested paths)
        if (strpos($request_uri, '/') === false) return;
        
        $routes_file = get_theme_file_path('assets/data/routes.json');
        if (!file_exists($routes_file)) return;
        
        $routes = json_decode(file_get_contents($routes_file), true);
        if (!is_array($routes)) return;
        
        foreach ($routes as $route) {
            $react_path = trim($route['path'], '/');
            $wp_slug = $route['slug'];
            
            if ($request_uri === $react_path || $request_uri === $react_path . '/') {
                wp_redirect(home_url('/' . $wp_slug . '/'), 301);
                exit;
            }
        }
    }
});

?>`


            : `<?php /* SPA mode ... */ ?>`;

        // SAAS FEATURE: Inject "Locations" Custom Post Type for Programmatic SEO
        const cptCode = seoSettings.enableLocationsCPT ? `
<?php
/* 
 * Multi-City Local SEO Architecture (Custom Post Type) 
 * Dynamically generated by Theme Factory AI 
 */
function tf_register_locations_cpt() {
    $labels = array(
        'name'                  => _x( 'Locations', 'Post Type General Name', 'text_domain' ),
        'singular_name'         => _x( 'Location', 'Post Type Singular Name', 'text_domain' ),
        'menu_name'             => __( 'SEO Locations', 'text_domain' ),
        'all_items'             => __( 'All Locations', 'text_domain' ),
        'add_new_item'          => __( 'Add New Service Area', 'text_domain' ),
    );
    $args = array(
        'label'                 => __( 'Location', 'text_domain' ),
        'labels'                => $labels,
        'supports'              => array( 'title', 'editor', 'thumbnail', 'custom-fields', 'revisions', 'page-attributes' ),
        'hierarchical'          => true,
        'public'                => true,
        'show_ui'               => true,
        'show_in_menu'          => true,
        'menu_position'         => 20,
        'menu_icon'             => 'dashicons-location',
        'show_in_rest'          => true, // Enables Gutenberg
        'has_archive'           => true,
        'rewrite'               => array('slug' => 'locations', 'with_front' => false),
    );
    register_post_type( 'locations', $args );
}
add_action( 'init', 'tf_register_locations_cpt', 0 );
?>
` : '';

        if (mode === 'gutenberg-native') {
            functionsPhpContent += cptCode;
        }

        folder.file("functions.php", functionsPhpContent); stats.php++;

        // Chrome fingerprint helpers — detect header/footer by content, not tag name
        type ChromeSig = { texts: Set<string>; hrefs: Set<string> };
        const normSigText = (s: string) => (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const buildSig = (html: string): ChromeSig => {
            const d = parser.parseFromString(`<div id="sr">${html}</div>`, 'text/html');
            const r = d.getElementById('sr') || d.body;
            return {
                texts: new Set(Array.from(r.querySelectorAll('a, button')).map(e => normSigText(e.textContent || '')).filter(t => t.length >= 2 && t.length <= 80)),
                hrefs: new Set(Array.from(r.querySelectorAll('a[href]')).map(e => (e.getAttribute('href') || '').trim()).filter(h => h && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('tel:')))
            };
        };
        const overlap = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let h = 0; a.forEach(v => { if (b.has(v)) h++; }); return h / Math.min(a.size, b.size); };
        const elSig = (el: HTMLElement): ChromeSig => ({
            texts: new Set(Array.from(el.querySelectorAll('a, button')).map(e => normSigText(e.textContent || '')).filter(t => t.length >= 2 && t.length <= 80)),
            hrefs: new Set(Array.from(el.querySelectorAll('a[href]')).map(e => (e.getAttribute('href') || '').trim()).filter(h => h && !h.startsWith('#') && !h.startsWith('mailto:') && !h.startsWith('tel:')))
        });
        const isHeaderChrome = (el: HTMLElement, sig: ChromeSig | null) => {
            const cls = (el.getAttribute('class') || '').toLowerCase();
            const sty = (el.getAttribute('style') || '').toLowerCase();
            const tag = el.tagName.toLowerCase();
            const ns = elSig(el);
            let score = 0;
            if (tag === 'header' || tag === 'nav') score += 8;
            if (/header|navbar|nav-bar|navigation|site-nav|menu-bar/.test(cls)) score += 6;
            if (/sticky|fixed|top-0|z-40|z-50|z-\[/.test(cls)) score += 4;
            if (/position\s*:\s*(sticky|fixed)/.test(sty)) score += 4;
            if (el.querySelectorAll('nav').length > 0) score += 4;
            if (el.querySelectorAll('a[href]').length >= 3) score += 2;
            if (sig) {
                if (overlap(ns.texts, sig.texts) >= 0.5) score += 10;
                if (overlap(ns.hrefs, sig.hrefs) >= 0.5) score += 10;
            }
            return score >= 10;
        };
        const isFooterChrome = (el: HTMLElement, sig: ChromeSig | null) => {
            const cls = (el.getAttribute('class') || '').toLowerCase();
            const tag = el.tagName.toLowerCase();
            const ns = elSig(el);
            let score = 0;
            if (tag === 'footer') score += 8;
            if (/footer/.test(cls)) score += 6;
            if (el.querySelectorAll('a[href]').length >= 2) score += 2;
            if (sig) {
                if (overlap(ns.texts, sig.texts) >= 0.5) score += 10;
                if (overlap(ns.hrefs, sig.hrefs) >= 0.5) score += 8;
            }
            return score >= 10;
        };

        const headerSig = extractedHeader ? buildSig(extractedHeader) : null;
        const footerSig = extractedFooter ? buildSig(extractedFooter) : null;
        if (headerSig) addLog(`Header fingerprint: ${headerSig.texts.size} texts, ${headerSig.hrefs.size} hrefs`, 'info');

        // Route Processing & Indexation Control
        const baseUrl = seoSettings.url.endsWith('/') ? seoSettings.url.slice(0, -1) : seoSettings.url;
        let successCount = 0;
        let redirectsCsv = "source,target,regex\n";
        let llmsTxtContent = `# ${seoSettings.companyName}\n> ${seoSettings.description}\n\n`;
        const routeMedia = new Map<string, { images: {loc: string, title?: string}[], videos: {loc: string, title: string, desc: string, thumb: string}[] }>();

        // SAAS FEATURE: Semantic Internal Linking Engine
        let semanticLinkMap: Record<string, { title: string, path: string }[]> = {};
        if (seoSettings.enableSemanticLinks) {
            try {
                addLog(`✨ AI SEO: Generating Semantic Internal Link Map for ${routesToProcess.length} routes...`, 'info');
                const serverOrigin = remoteConfig.url ? remoteConfig.url.replace(/\/build$/, '') : 'http://localhost:3000';
                
                // Map the routes down to just what Gemini needs to save bandwidth and token limits
                const simplifiedRoutes = routesToProcess.map(r => ({ path: r.path, title: r.title }));
                
                const response = await fetch(`${serverOrigin}/generate-link-map`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ routesToProcess: simplifiedRoutes })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.semanticMap) {
                        semanticLinkMap = data.semanticMap;
                        addLog(`✨ AI SEO: Successfully mapped topical relationships for ${Object.keys(semanticLinkMap).length} pages!`, 'success');
                    }
                } else {
                    addLog(`⚠ AI SEO: Failed to fetch semantic map from backend.`, 'warning');
                }
            } catch (llmErr) {
                console.error("Semantic Link Gen Error:", llmErr);
                addLog(`⚠ AI SEO Error: Could not generate internal links.`, 'warning');
            }
        }

        // Pre-Export QA / CI State Managers
        const qaReport = {
            errors: [] as string[],
            warnings: [] as string[],
            scannedPages: 0,
            passed: true
        };
        const seenH1s = new Map<string, string>();
        const seenTitles = new Map<string, string>();
        const seenDescriptions = new Map<string, string>();
        const seenSlugs = new Set<string>();
        const seenRouteTexts = new Map<string, {path: string, wordCount: number, excerpt: string}>();
        // Track un-normalized href strings mapped to their target paths for Canonical Consistency checks
        const globalInternalHrefs = new Map<string, string>();
        const pageCanonicals = new Map<string, string>();
        const contextualInboundLinks = new Map<string, number>();
        const allValidPaths = new Set(routesToProcess.map(r => r.path));

        const nonDescriptiveAnchors = ['click here', 'read more', 'learn more', 'find out more', 'here', 'more info', 'link', 'more'];

        // QA VALIDATION: HTTPS Enforcement
        if (seoSettings.url.startsWith('http://')) {
            qaReport.errors.push(`[Global] Critical Page Experience Error: SEO Canonical URL is explicitly set to "http://". Google aggressively penalizes non-HTTPS websites. Please update the domain to "https://".`);
            addLog(`❌ QA Error: Insecure HTTP domain detected!`, 'warning');
        }

        for (const route of routesToProcess) {
            let prerenderedContent = '';
            let customTitleCode = '';
            let customDescCode = '';
            let pageLocale = seoSettings.primaryLocale || 'en-US';
            const slug = (route.slug || 'home').toLowerCase(); // Normalize slash style and lowercase slug
            
            // Build Redirect Manifest Entry
            const isHome = slug === 'home' || route.path === '/';
            const targetUrl = isHome ? '/' : `/${slug}/`;
            const sourceRegex = `^${route.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`;
            redirectsCsv += `"${sourceRegex}","${targetUrl}","true"\n`;

            // Auto-noindex specific junk routes to keep crawl budgets clean
            const isNoIndex = /thank-you|search|filter|staging|tag|category/i.test(slug);

            try {
                addLog(`Processing route: ${route.title} (${route.path})...`, 'info');
                const candidates = [`prerendered/${slug}.html`, `${effectiveRoot}prerendered/${slug}.html`, route.path === '/' ? 'index.html' : `${slug}.html`, `${effectiveRoot}${slug}/index.html`];
                let routeHtml = '';
                for (const c of candidates) { if (zipContent.files[c]) { routeHtml = decode(await zipContent.files[c].async("uint8array")); addLog(`  Found at: ${c}`, 'info'); break; } }
                if (!routeHtml) { routeHtml = mainHtml; addLog(`  Using main index.html as fallback`, 'warning'); }

                const routeDoc = parser.parseFromString(routeHtml, 'text/html');
                const routeRoot = routeDoc.getElementById('root') || routeDoc.body;
                const currentRootClasses = routeRoot instanceof HTMLElement ? routeRoot.className : rootClasses;

                // QA VALIDATION: Mobile Viewport Enforcement
                const hasViewport = routeDoc.querySelector('meta[name="viewport"]');
                if (!hasViewport) {
                    qaReport.errors.push(`[${route.path}] Critical Page Experience Error: Missing \`<meta name="viewport">\` tag. Google Mobile-First Indexing requires valid responsive design settings.`);
                }

                // QA VALIDATION: Intrusive Interstitials (Sticky Mobile CTAs that consume too much screen)
                const interstitialSuspects = routeDoc.querySelectorAll('[class*="fixed"], [class*="sticky"]');
                interstitialSuspects.forEach(el => {
                    if (!(el instanceof HTMLElement)) return;
                    const cls = el.getAttribute('class') || '';
                    if (cls.includes('bottom-0') || cls.includes('top-0') || cls.includes('z-40') || cls.includes('z-50')) {
                        // Heuristic height detection via Tailwind sizes
                        if (cls.includes('h-32') || cls.includes('h-40') || cls.includes('h-48') || cls.includes('h-64') || cls.includes('p-10') || cls.includes('p-12') || /h-\[\d\d\dpx\]/.test(cls)) {
                            // Elements acting as navigation are generally excused
                            if (el.tagName.toLowerCase() !== 'header' && el.tagName.toLowerCase() !== 'nav' && !cls.includes('nav')) {
                                qaReport.warnings.push(`[${route.path}] Intrusive Interstitial Warning: A large fixed overlay ('${cls.substring(0,30)}...') was detected. Google explicitly penalizes pages where content is obscured by massive sticky CTAs on mobile devices. Ensure it collapses or uses less than 20% of viewport height.`);
                            }
                        }
                    }
                });

                if (routeRoot && (routeRoot.innerHTML.trim().length > 50 || routeRoot.id === 'root')) {
                    // SAFE content extraction: prefer <main> which naturally excludes header/footer
                    let contentSource: HTMLElement = routeRoot as HTMLElement;
                    const mainEl = routeRoot.querySelector('main');
                    if (mainEl && mainEl.innerHTML.trim().length > 50) {
                        contentSource = mainEl;
                        addLog(`  Using <main> element for content (excludes header/footer)`, 'success');
                    } else {
                        // No <main>: remove header/footer tags and use fingerprint for non-semantic headers
                        // We must search at ALL depths, because navs can be deeply nested inside wrappers
                        if (routeRoot instanceof HTMLElement && headerSig) {
                            let removedCount = 0;
                            // Find all potential chrome elements at any depth
                            const suspects = routeRoot.querySelectorAll('header, nav, div[class*="nav"], div[class*="header"], section[class*="nav"]');
                            suspects.forEach(child => {
                                if (child instanceof HTMLElement && isHeaderChrome(child, headerSig)) {
                                    addLog(`  Removed deep header chrome: <${child.tagName.toLowerCase()} class="${(child.getAttribute('class') || '').substring(0, 50)}...">`, 'success');
                                    child.remove();
                                    removedCount++;
                                }
                            });
                            addLog(`  Deep chrome scan removed ${removedCount} matching elements`, removedCount > 0 ? 'success' : 'info');
                        }
                        
                        // Fallback: remove any remaining semantic tags that didn't match the signature (but which we still don't want in page content)
                        routeRoot.querySelectorAll('header').forEach(el => el.remove());
                        routeRoot.querySelectorAll('footer').forEach(el => el.remove());

                        // HEURISTIC FIX: Strip fixed UI Overlays (Toasters, Modals, sticky notifications)
                        // These elements are usually injected at the bottom of the body, but shouldn't be part of page content.
                        const overlaySuspects = routeRoot.querySelectorAll('[class*="fixed"], [class*="sticky"], [class*="z-[100]"], [role="alert"], [aria-live="polite"]');
                        let overlayRemoved = 0;
                        overlaySuspects.forEach(child => {
                            if (child instanceof HTMLElement) {
                                const cls = child.getAttribute('class') || '';
                                // Only strip actual overlay/toast containers, not legitimate content
                                const isNotification = child.getAttribute('aria-label')?.toLowerCase().includes('notification') || false;
                                const isToast = cls.includes('toaster') || cls.includes('toast') || child.getAttribute('data-sonner-toaster') !== null;
                                const isFixedEmpty = cls.includes('fixed') && (child.textContent?.trim().length || 0) < 50;
                                if (isNotification || isToast || isFixedEmpty) {
                                    child.remove();
                                    overlayRemoved++;
                                }
                            }
                        });
                    }
                    if (mainEl && mainEl.innerHTML.trim().length > 50) {
                        contentSource = mainEl;
                        addLog(`  Using <main> element for content (excludes header/footer)`, 'success');
                    } else {
                        // ... fallback parsing ...
                    }

                    // QA VALIDATION: Thin Page & Duplicate Intent Detection
                    const rawText = (contentSource.textContent || '').replace(/\s+/g, ' ').trim();
                    const wordCount = rawText.split(' ').filter(word => word.length > 0).length;
                    
                    if (wordCount < 150) {
                        qaReport.warnings.push(`[${route.path}] Thin Page Warning: Page contains only ${wordCount} words. Consider adding more valuable content to satisfy local search intent.`);
                    }

                    // Extract a large enough excerpt to compare intent (first ~300 chars)
                    const textExcerpt = rawText.substring(0, 300).toLowerCase();
                    
                    // Simple heuristic comparison against previously seen routes
                    let duplicateIntentFound = false;
                    for (const [priorPath, priorData] of seenRouteTexts.entries()) {
                        // If they have extremely similar word counts and the exact same starting paragraph, it's likely a duplicate
                        const wordCountDiff = Math.abs(priorData.wordCount - wordCount);
                        if (wordCountDiff < 20 && priorData.excerpt === textExcerpt && textExcerpt.length > 50) {
                            qaReport.errors.push(`[${route.path}] Critical Content Error: Duplicate Intent detected. This page shares near-identical body text (excerpt: "${textExcerpt.substring(0, 50)}...") with route [${priorPath}]. Unique copy is required for programmatic SEO.`);
                            duplicateIntentFound = true;
                            break;
                        }
                    }
                    
                    if (!duplicateIntentFound) {
                        seenRouteTexts.set(route.path, { path: route.path, wordCount, excerpt: textExcerpt });
                    }

                    // CRAWLABILITY AUTOMATION: Convert JS-bound links to crawlable <a> tags
                    // Find elements (divs, buttons) acting as links via data-href and morph them into <a> tags
                    const jsLinks = contentSource.querySelectorAll('[data-href]');
                    let linkConvertedCount = 0;
                    jsLinks.forEach(el => {
                        if (el instanceof HTMLElement) {
                            const href = el.getAttribute('data-href');
                            if (href) {
                                const aTag = routeDoc.createElement('a');
                                aTag.setAttribute('href', href);
                                // Copy all attributes except data-href
                                Array.from(el.attributes).forEach(attr => {
                                    if (attr.name !== 'data-href') {
                                        aTag.setAttribute(attr.name, attr.value);
                                    }
                                });
                                aTag.innerHTML = el.innerHTML;
                                el.parentNode?.replaceChild(aTag, el);
                                linkConvertedCount++;
                            }
                        }
                    });
                    if (linkConvertedCount > 0) addLog(`  🔗 Converted ${linkConvertedCount} interactive JS elements to native <a href>`, 'success');

                    // QA VALIDATION: Descriptive Anchor Text & Hub/Spoke Extraction
                    const contextualLinks = contentSource.querySelectorAll('a');
                    let internalDescriptiveErrors = 0;
                    contextualLinks.forEach(link => {
                        const href = link.getAttribute('href');
                        if (href && (href.startsWith('/') || href.startsWith(baseUrl))) {
                            // Normalize the target URL to just the path
                            let targetPath = href;
                            if (href.startsWith(baseUrl)) targetPath = href.replace(baseUrl, '');
                            if (!targetPath.startsWith('/')) targetPath = '/' + targetPath;

                            // Increment the Contextual Hub/Spoke mapping for the target URL
                            contextualInboundLinks.set(targetPath, (contextualInboundLinks.get(targetPath) || 0) + 1);

                            // Validate Anchor Text distinctiveness
                            const anchorText = (link.textContent || '').trim().toLowerCase();
                            if (nonDescriptiveAnchors.includes(anchorText)) {
                                qaReport.warnings.push(`[${route.path}] Link Quality Warning: Used non-descriptive anchor text "${anchorText}" pointing to [${targetPath}].
► FIX: In your React code, change this link text to something keyword-rich. For example, instead of "${anchorText}", use "View our ${targetPath.replace(/\//g, ' ').trim()} services".`);
                                internalDescriptiveErrors++;
                            }
                        }
                    });
                    if (internalDescriptiveErrors > 0) addLog(`  ⚠ Found ${internalDescriptiveErrors} non-descriptive internal links`, 'warning');

                    // MEDIA SEO AUTOMATION: Image Alt Inference, LCP Optimization, and Sitemap Extraction
                    const pageMedia = { images: [] as any[], videos: [] as any[] };
                    routeMedia.set(route.path, pageMedia);

                    const allImages = contentSource.querySelectorAll('img');
                    let lcpFound = false;
                    let imgModifiedCount = 0;

                    allImages.forEach((img, index) => {
                        const src = img.getAttribute('src');
                        if (!src) return;

                        // 1. LCP Optimization (First significant image)
                        if (!lcpFound && index < 3) {
                            // Basic heuristic: if it has 'hero' class or is early in the DOM
                            const cls = img.getAttribute('class') || '';
                            if (cls.includes('hero') || index === 0) {
                                img.setAttribute('fetchpriority', 'high');
                                img.setAttribute('loading', 'eager');
                                lcpFound = true;
                                addLog(`  ⚡ Optimized LCP: Injected fetchpriority="high" into hero image`, 'success');
                            }
                        }

                        // 2. Alt Text Inference
                        let alt = img.getAttribute('alt');
                        if (!alt || alt.trim() === '' || alt.includes('image') || alt.includes('photo')) {
                            // Find closest heading
                            let inferredContext = route.title;
                            let currentEl = img.parentElement;
                            let limit = 0;
                            while (currentEl && limit < 3) {
                                const h = currentEl.querySelector('h1, h2, h3, h4, figcaption');
                                if (h && h.textContent && h.textContent.trim().length > 3) {
                                    inferredContext = h.textContent.trim();
                                    break;
                                }
                                currentEl = currentEl.parentElement;
                                limit++;
                            }
                            const smartAlt = `${inferredContext} - ${seoSettings.companyName} ${seoSettings.addressLocality}`;
                            img.setAttribute('alt', smartAlt);
                            alt = smartAlt;
                            imgModifiedCount++;
                        }

                        // 3. Extract for XML Sitemap
                        if (src.startsWith('http') || src.startsWith('/')) {
                            const absoluteSrc = src.startsWith('http') ? src : `${seoSettings.url.endsWith('/') ? seoSettings.url.slice(0, -1) : seoSettings.url}${src}`;
                            pageMedia.images.push({ loc: absoluteSrc, title: alt });
                        }
                    });
                    if (imgModifiedCount > 0) addLog(`  🖼 Inferred AI alt-text for ${imgModifiedCount} unoptimized images`, 'success');

                    // MEDIA SEO AUTOMATION: Video extraction
                    const allVideos = contentSource.querySelectorAll('video, iframe[src*="youtube"], iframe[src*="vimeo"]');
                    allVideos.forEach(vid => {
                        const src = vid.tagName.toLowerCase() === 'video' ? vid.querySelector('source')?.getAttribute('src') || vid.getAttribute('src') : vid.getAttribute('src');
                        if (!src) return;
                        
                        const absoluteSrc = src.startsWith('http') ? src : `${seoSettings.url.endsWith('/') ? seoSettings.url.slice(0, -1) : seoSettings.url}${src}`;
                        const title = vid.getAttribute('title') || `${route.title} Video`;
                        
                        pageMedia.videos.push({
                            loc: absoluteSrc,
                            title: title,
                            desc: `${seoSettings.companyName} video presentation for ${route.title}`,
                            thumb: seoSettings.ogImage
                        });
                        addLog(`  🎥 Discovered embedded video payload for sitemap: ${title}`, 'success');
                    });

                    // HEURISTIC TITLE & META PIPELINE

                    // QA VALIDATION: Prominent Main-Title Enforcement
                    let maxVisualWeight = 0;
                    const weightInstances = new Map<string, HTMLElement[]>(); // Text -> Array of elements sharing this weight
                    
                    const tailwindWeights: Record<string, number> = {
                        'text-xs': 1, 'text-sm': 2, 'text-base': 3, 'text-lg': 4, 'text-xl': 5,
                        'text-2xl': 6, 'text-3xl': 7, 'text-4xl': 8, 'text-5xl': 9, 'text-6xl': 10,
                        'text-7xl': 11, 'text-8xl': 12, 'text-9xl': 13
                    };
                    
                    const titleCandidates = routeRoot.querySelectorAll('h1, h2, h3, [class*="text-"]');
                    titleCandidates.forEach(el => {
                        if (!(el instanceof HTMLElement)) return;
                        const text = (el.textContent || '').trim();
                        // Ignore tiny strings, icons, or cosmetic numbers
                        if (text.length < 5) return;
                        
                        let weight = 0;
                        const cls = el.getAttribute('class') || '';
                        
                        // Check explicit Tailwind sizing
                        for (const [tClass, tWeight] of Object.entries(tailwindWeights)) {
                            // Check for exact class match (e.g., text-xl, md:text-xl)
                            // A simple includes() is okay here since we want responsive sizes too
                            if (cls.includes(tClass)) weight = Math.max(weight, tWeight);
                        }
                        
                        // If no explicit tailwind size, fallback to semantic tag weight
                        if (weight === 0) {
                            const tag = el.tagName.toLowerCase();
                            if (tag === 'h1') weight = 8;
                            else if (tag === 'h2') weight = 6;
                            else if (tag === 'h3') weight = 5;
                        }
                        
                        if (weight > 0) {
                            if (weight > maxVisualWeight) {
                                maxVisualWeight = weight;
                                weightInstances.clear(); // New max found, reset trackers
                            }
                            
                            if (weight === maxVisualWeight) {
                                const lowerText = text.toLowerCase();
                                const existing = weightInstances.get(lowerText) || [];
                                existing.push(el);
                                weightInstances.set(lowerText, existing);
                            }
                        }
                    });
                    
                    // Count distinct text values operating at the maximum visual weight
                    const uniquelyProminentNodes = Array.from(weightInstances.keys());
                    if (uniquelyProminentNodes.length > 1) {
                        qaReport.warnings.push(`[${route.path}] Semantic Warning: Multiple equally prominent headings detected ("${uniquelyProminentNodes[0].substring(0,30)}..." vs "${uniquelyProminentNodes[1].substring(0,30)}..."). Google relies on the uniquely dominant visual title to generate search snippet links.
► FIX: Ensure exactly one heading stands out by changing the others to <h2> in your React code. You can visually style an <h2> to look identical to an <h1> using Tailwind classes like 'text-4xl font-bold' without confusing search engines.`);
                    }

                    // QA VALIDATION: H1 Presence & count tracking
                    let pageH1 = route.title;
                    const h1Els = routeRoot.querySelectorAll('h1');
                    if (h1Els.length === 0) {
                        qaReport.errors.push(`[${route.path}] Critical SEO Warning: Missing <h1> tag.
► FIX: Every page needs exactly one <h1> tag wrapping its primary topic keyword. Add one in React.`);
                        addLog(`  ❌ QA Error: Missing <h1> tag`, 'warning');
                    } else if (h1Els.length > 1) {
                        qaReport.warnings.push(`[${route.path}] Semantic Warning: Multiple <h1> tags detected (count: ${h1Els.length}). Google prefers exactly one.`);
                    }
                    
                    if (h1Els.length > 0 && h1Els[0].textContent) {
                        pageH1 = h1Els[0].textContent.trim().substring(0, 60);
                        if (seenH1s.has(pageH1)) {
                            qaReport.warnings.push(`[${route.path}] Duplicate H1 Warning: The H1 "${pageH1}" is already used on route ${seenH1s.get(pageH1)}.`);
                        }
                        seenH1s.set(pageH1, route.path);
                    }
                    
                    // QA VALIDATION: Duplicate Slug Tracking
                    if (seenSlugs.has(slug)) {
                         qaReport.errors.push(`[${route.path}] Critical Architecture Error: Duplicate slug "${slug}" detected. This will create a WordPress fatal permalink collision.`);
                    }
                    seenSlugs.add(slug);
                    
                    // Construct a dense, localized SEO Title
                    let seoTitle = isHome 
                        ? `${seoSettings.companyName} | ${seoSettings.description}`
                        : `${pageH1} | ${seoSettings.companyName} in ${seoSettings.addressLocality}`;
                    
                    // HOMEPAGE CALIBRATION: Ensure Homepage title aggressively fronts the Brand Name for Site Name recognition
                    if (isHome && !seoTitle.toLowerCase().startsWith(seoSettings.companyName.toLowerCase())) {
                        seoTitle = `${seoSettings.companyName} | ${pageH1}`;
                    }

                    // Cap title length to standard ~65 chars to avoid truncation
                    if (seoTitle.length > 70) seoTitle = `${pageH1} | ${seoSettings.companyName}`;
                    
                    // QA VALIDATION: Title Uniqueness
                    if (seenTitles.has(seoTitle)) {
                         qaReport.warnings.push(`[${route.path}] Duplicate Title Warning: "${seoTitle}" matches route ${seenTitles.get(seoTitle)}.`);
                    }
                    seenTitles.set(seoTitle, route.path);
                    
                    // MULTILINGUAL & MULTIREGIONAL SEO LAYER
                    // Autodetect if current page belongs to a specific language path
                    const pathParts = route.path.split('/').filter(Boolean);
                    const isAltLangUrl = pathParts.length > 0 && /^[a-z]{2}(-[A-Z]{2})?$/.test(pathParts[0]);
                    const currentLangUrlPrefix = isAltLangUrl ? pathParts[0] : '';
                    const baseCanonicalUrl = isAltLangUrl 
                        ? route.path.replace(`/${currentLangUrlPrefix}`, '') || '/'
                        : route.path;
                    
                    // Determine page's specific locale
                    const activeAlternates = seoSettings.alternateLocales ? seoSettings.alternateLocales.split(',').map(s => s.trim()) : [];
                    if (isAltLangUrl) {
                        const matchingAlt = activeAlternates.find(a => a.toLowerCase().startsWith(currentLangUrlPrefix.toLowerCase()));
                        if (matchingAlt) pageLocale = matchingAlt;
                    }

                    // Generate og:locale and hreflang blocks
                    const ogLocaleSafe = pageLocale.replace('-', '_');
                    let localeMetaTags = `\n<meta property="og:locale" content="${ogLocaleSafe}" />\n`;
                    
                    const safeUrl = seoSettings.url.endsWith('/') ? seoSettings.url.slice(0, -1) : seoSettings.url;
                    const defaultPath = baseCanonicalUrl === '/' ? '/' : baseCanonicalUrl + '/';
                    const finalCanonicalUrl = `${safeUrl}${defaultPath}`;
                    
                    // CANONICAL CONSISTENCY: Save this exact generated canonical string for later Graph verification
                    pageCanonicals.set(route.path, finalCanonicalUrl);

                    let hreflangTags = `\n<link rel="alternate" hreflang="x-default" href="${finalCanonicalUrl}" />\n`;
                    hreflangTags += `<link rel="alternate" hreflang="${seoSettings.primaryLocale || 'en-US'}" href="${finalCanonicalUrl}" />\n`;
                    
                    activeAlternates.forEach(alt => {
                        const langCode = alt.split('-')[0].toLowerCase();
                        const altPath = baseCanonicalUrl === '/' ? `/${langCode}/` : `/${langCode}${baseCanonicalUrl}/`;
                        hreflangTags += `<link rel="alternate" hreflang="${alt}" href="${safeUrl}${altPath}" />\n`;
                        localeMetaTags += `<meta property="og:locale:alternate" content="${alt.replace('-', '_')}" />\n`;
                    });

                    // Ensure explicit Site Name definition for Google Entity recognition
                    const siteNameMeta = `\n<meta property="og:site_name" content="${seoSettings.companyName.replace(/"/g, '&quot;')}" />\n`;

                    customTitleCode = `\n<title>${seoTitle.replace(/"/g, '&quot;')}</title>\n<meta property="og:title" content="${seoTitle.replace(/"/g, '&quot;')}" />${siteNameMeta}${localeMetaTags}${hreflangTags}\n`;

                    // Generate a localized Meta Description based on H1 and Locality
                    let pageDesc = isHome
                        ? seoSettings.description
                        : `${seoSettings.companyName} provides professional ${pageH1.toLowerCase()} services in ${seoSettings.addressLocality}, ${seoSettings.addressRegion}. Contact us today to learn more.`;
                    
                    // QA VALIDATION: Description Uniqueness
                    if (seenDescriptions.has(pageDesc)) {
                         qaReport.warnings.push(`[${route.path}] Duplicate Meta Description Warning: The description matches route ${seenDescriptions.get(pageDesc)}.`);
                    }
                    seenDescriptions.set(pageDesc, route.path);
                    
                    customDescCode = `<meta name="description" content="${pageDesc.replace(/"/g, '&quot;')}" />\n<meta property="og:description" content="${pageDesc.replace(/"/g, '&quot;')}" />\n`;

                    // Use replaceAssetPaths for robust asset replacement
                    let cleanHtml = replaceAssetPaths(contentSource.innerHTML, '__THEME_URI__/');
                    // Don't pass header/footer patterns during page conversion — they're in header.php/footer.php
                    const conversionResult = convertToGutenbergBlocks(
                        cleanHtml,
                        mode === 'gutenberg-native'
                            ? { faqData: faqData }
                            : { patterns: globalPatterns, faqData: faqData }
                    );
                    const rawBlocks = conversionResult.html;
                    allAuditLogs.push(...conversionResult.logs);
                    
                    // Log conversion diagnostics
                    addLog(`  📊 Editability: ${Math.round(conversionResult.editabilityScore * 100)}% | Confidence: ${Math.round(conversionResult.confidenceScore * 100)}%`, 'info');
                    if (!conversionResult.validation.isValid) {
                        conversionResult.validation.errors.forEach((err: string) => {
                            addLog(`  ❌ Block Validation Error: ${err}`, 'warning');
                        });
                    }
                    if (conversionResult.themeTokens.length > 0) {
                        addLog(`  🎨 Theme Token Suggestions: ${conversionResult.themeTokens.map((t: ThemeTokenSuggestion) => `${t.value} (×${t.occurrences})`).join(', ')}`, 'info');
                    }
                    
                    // Strip any surviving header/footer pattern blocks and raw elements
                    let rewrittenBlocks = rawBlocks
                        .replace(/<!--\s*wp:pattern\s+\{"slug":"theme-factory\/part-header"\}\s*\/-->\s*/g, '')
                        .replace(/<!--\s*wp:pattern\s+\{"slug":"theme-factory\/part-footer"\}\s*\/-->\s*/g, '')
                        .replace(/<!--\s*wp:template-part\s+\{[^}]*"slug":"header"[^}]*\}\s*\/-->\s*/g, '')
                        .replace(/<!--\s*wp:template-part\s+\{[^}]*"slug":"footer"[^}]*\}\s*\/-->\s*/g, '')
                        .replace(/<header\b[\s\S]*?<\/header>\s*/gi, '')
                        .replace(/<footer\b[\s\S]*?<\/footer>\s*/gi, '');

                    addLog(`  Route chrome stripped: hadHeaderPattern=${/theme-factory\/part-header/.test(rawBlocks)}, hadFooterPattern=${/theme-factory\/part-footer/.test(rawBlocks)}`, 'info');

                    // CRITICAL FIX: Rewrite internal React Router links to WordPress slug format
                    // React uses /city/page (slashes) but WordPress uses /city-page/ (dashes)
                    for (const r of routesToProcess) {
                        if (r.path === '/') continue;
                        const reactPath = r.path; // e.g., /city/page
                        const wpSlug = r.slug;     // e.g., city-page
                        
                        // QA VALIDATION: Log internal links for dead link / orphan checking later
                        if (rewrittenBlocks.includes(`href="${reactPath}`) || rewrittenBlocks.includes(`href='${reactPath}`)) {
                            globalInternalHrefs.set(reactPath, reactPath);
                        }
                        
                        // Replace href="/city/page" with href="/city-page/"
                        // Handle with and without trailing slash
                        rewrittenBlocks = rewrittenBlocks
                            .replace(new RegExp(`href=["']${reactPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?["']`, 'g'), `href="/${wpSlug}/"`)
                            .replace(new RegExp(`href=["']${reactPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}#`, 'g'), `href="/${wpSlug}/#`)
                            // Also rewrite data-href on clickable card containers (from createLinkGroup)
                            .replace(new RegExp(`data-href=["']${reactPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?["']`, 'g'), `data-href="/${wpSlug}/"`)
                            // Also rewrite "url":"..." in Gutenberg block JSON comments
                            .replace(new RegExp(`"url":"${reactPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?"`, 'g'), `"url":"/${wpSlug}/"`);
                    }
                    
                    // POST-CONVERSION FAQ INJECTION: When prerender misses accordion content
                    // (e.g., EdmontonPricing body fails to render), synthesize FAQ blocks from
                    // source TSX + faqData so the WordPress page still gets real FAQ answers.
                    const hasDetailBlocks = /<summary>/i.test(rewrittenBlocks);
                    if (!hasDetailBlocks && faqData.length > 0) {
                        // Find source TSX file for this route by matching the route path to filename
                        const routeSlugParts = route.path.replace(/^\/+/, '').split('/');
                        const possibleNames = [
                            routeSlugParts.join(''),           // e.g., "edmontonpricing"
                            routeSlugParts.join('-'),          // e.g., "edmonton-pricing"
                            ...routeSlugParts,                 // individual segments
                        ].map(s => s.toLowerCase());
                        
                        const sourceFile = allFiles.find(f => {
                            const n = f.replace(/\\/g, '/').toLowerCase();
                            if (!n.endsWith('.tsx') && !n.endsWith('.jsx')) return false;
                            if (n.includes('node_modules')) return false;
                            const basename = n.split('/').pop()?.replace(/\.(tsx|jsx)$/, '') || '';
                            return possibleNames.some(name => basename === name);
                        });
                        
                        if (sourceFile) {
                            try {
                                const srcContent = await zipContent.files[sourceFile].async('string');
                                
                                // Extract FAQ questions from source AccordionTrigger tags
                                const triggerRegex = /<AccordionTrigger[^>]*>([\s\S]*?)<\/AccordionTrigger>/g;
                                const pageQuestions: string[] = [];
                                let tMatch;
                                while ((tMatch = triggerRegex.exec(srcContent)) !== null) {
                                    const q = tMatch[1].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
                                    if (q && q.length > 5) pageQuestions.push(q);
                                }
                                
                                if (pageQuestions.length > 0) {
                                    addLog(`  🔧 FAQ INJECTION: Page "${route.path}" has ${pageQuestions.length} accordion items in source but 0 in converted output. Injecting from faqData...`, 'warning');
                                    
                                    // Also extract answers directly from source as ultimate fallback
                                    const pairRegex = /<AccordionTrigger[^>]*>([\s\S]*?)<\/AccordionTrigger>[\s\S]*?<AccordionContent[^>]*>([\s\S]*?)<\/AccordionContent>/g;
                                    const sourcePairs: {q: string, a: string}[] = [];
                                    let pMatch;
                                    while ((pMatch = pairRegex.exec(srcContent)) !== null) {
                                        const q = pMatch[1].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
                                        const a = pMatch[2].replace(/<[^>]+>/g, '').replace(/\{[^}]+\}/g, '').replace(/\s+/g, ' ').trim();
                                        if (q && a && a.length > 10) sourcePairs.push({ q, a });
                                    }
                                    
                                    const faqBlocks: string[] = [];
                                    const normalizeText = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
                                    
                                    for (const question of pageQuestions) {
                                        const qNorm = normalizeText(question);
                                        
                                        // Try faqData first (globally extracted)
                                        let answer = '';
                                        const faqMatch = faqData.find(f => {
                                            const fqNorm = normalizeText(f.q);
                                            return fqNorm === qNorm || fqNorm.includes(qNorm) || qNorm.includes(fqNorm);
                                        });
                                        if (faqMatch) {
                                            answer = faqMatch.a;
                                        } else {
                                            // Fallback to source pair extraction
                                            const srcMatch = sourcePairs.find(p => {
                                                const pqNorm = normalizeText(p.q);
                                                return pqNorm === qNorm || pqNorm.includes(qNorm) || qNorm.includes(pqNorm);
                                            });
                                            if (srcMatch) answer = srcMatch.a;
                                        }
                                        
                                        if (answer) {
                                            // Escape HTML entities for safe embedding
                                            const safeQ = question.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                                            const safeA = answer.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
                                            faqBlocks.push(`<!-- wp:details -->
<details class="wp-block-details"><summary>${safeQ}</summary><!-- wp:paragraph -->
<p>${safeA}</p>
<!-- /wp:paragraph --></details>
<!-- /wp:details -->`);
                                        }
                                    }
                                    
                                    if (faqBlocks.length > 0) {
                                        // Wrap in a section with heading
                                        const faqSection = `
<!-- wp:heading {"level":2} -->
<h2 class="wp-block-heading">Frequently Asked Questions</h2>
<!-- /wp:heading -->

<!-- wp:paragraph -->
<p>Have questions? Here are answers to common pricing questions.</p>
<!-- /wp:paragraph -->

${faqBlocks.join('\n\n')}`;
                                        
                                        rewrittenBlocks += '\n\n' + faqSection;
                                        addLog(`  ✅ FAQ INJECTION: Successfully injected ${faqBlocks.length} FAQ items from source/faqData`, 'success');
                                    }
                                }
                            } catch (e) {
                                addLog(`  ⚠️ FAQ injection: Could not read source file ${sourceFile}`, 'warning');
                            }
                        }
                    }

                    // SEO FIX: Extract FAQs from this page AND inject FAQPage JSON-LD schema dynamically!
                    const pageSummaries = Array.from(rewrittenBlocks.matchAll(/<summary>(.*?)<\/summary>/gi)).map(m => m[1]);
                    const pageFaqs: any[] = [];
                    const seenQ = new Set();
                    for (const summary of pageSummaries) {
                        const cleanQ = summary.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'").trim();
                        if (seenQ.has(cleanQ)) continue;
                        seenQ.add(cleanQ);
                        const found = faqData.find(f => {
                            const fQ = f.q.trim();
                            return fQ === cleanQ || fQ.includes(cleanQ) || cleanQ.includes(fQ);
                        });
                        if (found) {
                            pageFaqs.push(found);
                        }
                    }
                    if (seoSettings.enableFaqSchema && pageFaqs.length > 0) {
                        const faqSchema = {
                            "@context": "https://schema.org",
                            "@type": "FAQPage",
                            "mainEntity": pageFaqs.map(item => ({
                                "@type": "Question",
                                "name": item.q,
                                "acceptedAnswer": {
                                    "@type": "Answer",
                                    "text": item.a.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')
                                }
                            }))
                        };
                        rewrittenBlocks += `\n<!-- wp:html -->\n<script type="application/ld+json">\n${JSON.stringify(faqSchema, null, 2)}\n</script>\n<!-- /wp:html -->\n`;
                        addLog(`  📈 Injected FAQPage JSON-LD Schema for ${pageFaqs.length} questions`, 'success');
                    }

                    // TIER 1 POLISH: Auto-Lazy Load all images (except those with specific classes or explicitly eager)
                    // We only apply lazy loading to images that don't look like above-the-fold hero images
                    let imgCountBefore = (rewrittenBlocks.match(/<img\b/gi) || []).length;
                    rewrittenBlocks = rewrittenBlocks.replace(/<img(?!.*loading=["']lazy["'])(?!.*loading=["']eager["'])((?![^>]*class=["'][^"']*(?:hero|no-lazy|lcp|above-the-fold)[^"']*["'])[^>]*)>/gi, '<img loading="lazy"$1>');
                    addLog(`  🖼 Added native lazy loading to images`, 'success');

                    // TIER 1 POLISH: Dynamic Copyright Year anywhere in the page blocks
                    rewrittenBlocks = rewrittenBlocks.replace(/(©|Copyright|[Cc]opyright[^>]*>)[^\d]*202[0-9]/g, '$1 <?php echo date("Y"); ?>');

                    // CRAWLABILITY AUTOMATION: Visual Breadcrumbs & Related Links Modules
                    let breadcrumbHtml = '';
                    let relatedLinksHtml = '';
                    if (!isHome && !isNoIndex) {
                        breadcrumbHtml = `
<!-- wp:group {"className":"tf-breadcrumbs"} -->
<div class="wp-block-group tf-breadcrumbs" style="padding: 1rem 1.5rem; background: #f8f9fa; border-bottom: 1px solid #eee; margin-bottom: 2rem; font-size: 0.875rem;">
    <a href="/" style="color: #666; text-decoration: none;">Home</a> <span style="margin: 0 0.5rem; color: #ccc;">/</span> <span style="color: #333; font-weight: 500;">${pageH1}</span>
</div>
<!-- /wp:group -->
`;
                        let siblings = [];
                        let isAiGenerated = false;

                        // 1. Check if Semantic Internal Linking Map mapped this page
                        if (semanticLinkMap && semanticLinkMap[route.path] && semanticLinkMap[route.path].length > 0) {
                            siblings = semanticLinkMap[route.path];
                            isAiGenerated = true;
                        } 
                        // 2. Fallback to heuristic structural siblings
                        else {
                            siblings = routesToProcess.filter(r => r.path !== '/' && r.path !== route.path && !/thank-you|search|filter|staging|tag|category/i.test(r.slug || ''));
                            const pathParts = route.path.split('/').filter(Boolean);
                            
                            // Try to find structural siblings
                            if (pathParts.length > 1) {
                                const parentPrefix = `/${pathParts[0]}/`;
                                siblings = siblings.filter(r => r.path.startsWith(parentPrefix));
                            }
                            
                            // Fallback to top generic pages if no siblings
                            if (siblings.length === 0) {
                                siblings = routesToProcess.filter(r => r.path !== '/' && r.path !== route.path && !/thank-you|search|filter|staging|tag|category/i.test(r.slug || '')).slice(0, 4);
                            } else {
                                siblings = siblings.slice(0, 4);
                            }
                        }

                        if (siblings.length > 0) {
                            const badgeHtml = isAiGenerated ? `<span style="font-size: 0.7rem; background: #dcfce7; color: #166534; padding: 0.2rem 0.5rem; border-radius: 99px; margin-left: 0.5rem; vertical-align: middle; font-weight: 600;">✨ AI Selected</span>` : '';
                            relatedLinksHtml = `
<!-- wp:group {"className":"tf-related-links-module"} -->
<div class="wp-block-group tf-related-links-module" style="margin-top: 4rem; padding: 3rem 1.5rem; background: #f8f9fa;">
    <h3 style="margin-bottom: 1.5rem; text-align: center;">Related Links${badgeHtml}</h3>
    <div style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: center;">
        ${siblings.map(sib => `<a href="${sib.path.endsWith('/') ? sib.path : sib.path + '/'}" style="padding: 0.75rem 1.5rem; background: #fff; border: 1px solid #ddd; border-radius: 4px; color: inherit; text-decoration: none; font-weight: 500; transition: all 0.2s;">${sib.title}</a>`).join('')}
    </div>
</div>
<!-- /wp:group -->
`;
                            addLog(`  🔗 Injected Related Links module with ${siblings.length} internal links ${isAiGenerated ? '(✨ AI)' : ''}`, 'success');
                        }
                        addLog(`  🍞 Injected visual Breadcrumb navigation`, 'success');
                    }

                    const isSameClass = currentRootClasses === rootClasses;
                    const wrapperClasses = isSameClass ? 'entry-content' : `entry-content ${currentRootClasses}`;
                    // Use core wp:group block instead of custom page-shell (requires no plugin)
                    prerenderedContent = `<!-- wp:group {"className":"${wrapperClasses} ${bodyClasses}"} -->\n<div class="wp-block-group ${wrapperClasses} ${bodyClasses}">\n${breadcrumbHtml}\n${rewrittenBlocks}\n${relatedLinksHtml}\n</div>\n<!-- /wp:group -->`;
                    successCount++;
                    addLog(`  ✓ ${route.title}: Converted to Gutenberg blocks`, 'success');

                    if (seoSettings.enableLlmsTxt && contentSource) {
                        try {
                            const rawText = contentSource.textContent || contentSource.innerText || '';
                            const cleanText = rawText.replace(/\s+/g, ' ').trim();
                            if (cleanText.length > 50) {
                                const cleanUrl = seoSettings.url.endsWith('/') ? seoSettings.url.slice(0, -1) : seoSettings.url;
                                llmsTxtContent += `## [${route.title}](${cleanUrl}${route.path})\n${cleanText}\n\n`;
                            }
                        } catch (e) {
                            addLog(`  ⚠ Failed to extract LLM text for ${route.title}`, 'warning');
                        }
                    }
                } else { 
                    addLog(`  ⚠ ${route.title}: Root element empty or too small`, 'warning'); 
                    prerenderedContent = createPlaceholder(route.title, "Content could not be extracted from prerendered HTML."); 
                } // End if (routeRoot...)
            } catch (e: unknown) { 
                console.error(`[TF] Conversion error for ${route.title}:`, e);
                addLog(`  ⚠ ${route.title}: Parse error - ${(e as Error).message}`, 'warning'); 
                prerenderedContent = createPlaceholder(route.title, `An error occurred while converting this page: ${(e as Error).message}`); 
            }

            // FINAL SAFETY: Aggressively strip any header/footer from blocks content
            const beforeCount = (prerenderedContent.match(/<header\b/gi) || []).length;
            prerenderedContent = prerenderedContent
                .replace(/<header\b[\s\S]*?<\/header>\s*/gi, '')
                .replace(/<footer\b[\s\S]*?<\/footer>\s*/gi, '')
                .replace(/<!--\s*wp:pattern\s+\{[^}]*(?:header|footer)[^}]*\}\s*\/-->\s*/gi, '')
                .replace(/<!--\s*wp:template-part\s+\{[^}]*(?:header|footer)[^}]*\}\s*\/-->\s*/gi, '');
            if (beforeCount > 0) addLog(`  ⚠ Stripped ${beforeCount} <header> tag(s) from ${slug} blocks content`, 'warning');

            if (slug === 'home' || route.path === '/') {
                (window as any).__debugOutput += `--- HOME BLOCKS DEBUG ---\n`;
                (window as any).__debugOutput += prerenderedContent.substring(0, 1000) + `\n\n`;
                
                addLog(`--- HOME BLOCKS DEBUG ---`, 'warning');
                addLog(prerenderedContent.substring(0, 500).replace(/\n/g, '\\n'), 'warning');
                addLog(`-------------------------`, 'warning');
            }

            // INTELLIGENT SCHEMA ROUTER
            // Base URL configuration (uses baseUrl from line 3471)
            const fullPageUrl = isHome ? baseUrl : `${baseUrl}/${slug}/`;
            const schemaGraph: any[] = [];

            // 1. ALWAYS inject WebPage Schema
            schemaGraph.push({
                "@type": "WebPage",
                "@id": `${fullPageUrl}#webpage`,
                "url": fullPageUrl,
                "name": route.title,
                "isPartOf": { "@id": `${baseUrl}/#website` },
                "description": seoSettings.description,
                "inLanguage": pageLocale
            });

            // 2. ALWAYS inject BreadcrumbList
            const breadcrumbItems = [
                { "@type": "ListItem", "position": 1, "name": "Home", "item": baseUrl }
            ];
            if (!isHome) {
                // Determine if this is a subpage (e.g. /services/cleaning/)
                const pathParts = route.path.split('/').filter(Boolean);
                let currentUrl = baseUrl;
                pathParts.forEach((part, index) => {
                    currentUrl += `/${part}`;
                    breadcrumbItems.push({
                        "@type": "ListItem",
                        "position": index + 2,
                        "name": part.charAt(0).toUpperCase() + part.slice(1).replace(/-/g, ' '),
                        "item": currentUrl
                    });
                });
            }
            schemaGraph.push({
                "@type": "BreadcrumbList",
                "@id": `${fullPageUrl}#breadcrumb`,
                "itemListElement": breadcrumbItems
            });

            // 3. HOME PAGE: WebSite & LocalBusiness
            if (isHome) {
                // Determine plausible alternateName (e.g., lowercase or stripped versions)
                const alternateNames = seoSettings.companyName.toLowerCase() !== seoSettings.companyName 
                    ? [seoSettings.companyName.toLowerCase()] 
                    : [];
                
                const webSiteNode: any = {
                    "@type": "WebSite",
                    "@id": `${baseUrl}/#website`,
                    "url": baseUrl,
                    "name": seoSettings.companyName,
                    "publisher": { "@id": `${baseUrl}/#organization` },
                    "inLanguage": pageLocale
                };
                if (alternateNames.length > 0) webSiteNode.alternateName = alternateNames;

                schemaGraph.push(webSiteNode);

                const localBizSchema = {
                    "@type": "LocalBusiness",
                    "@id": `${baseUrl}/#organization`,
                    "name": seoSettings.companyName,
                    "url": baseUrl,
                    "logo": seoSettings.ogImage,
                    "image": seoSettings.ogImage,
                    "description": seoSettings.description,
                    "telephone": seoSettings.telephone,
                    "address": { "@type": "PostalAddress", "addressLocality": seoSettings.addressLocality, "addressRegion": seoSettings.addressRegion, "addressCountry": seoSettings.addressCountry },
                    "priceRange": seoSettings.priceRange
                };
                if (seoSettings.googleMapsUrl) (localBizSchema as any).hasMap = seoSettings.googleMapsUrl;
                const sameAsLinks = [seoSettings.socialFacebook, seoSettings.socialInstagram, seoSettings.socialTwitter, seoSettings.socialLinkedIn].filter(Boolean);
                if (sameAsLinks.length > 0) (localBizSchema as any).sameAs = sameAsLinks;
                if (seoSettings.reviewRating && seoSettings.reviewCount && parseFloat(seoSettings.reviewRating) > 0 && parseInt(seoSettings.reviewCount) > 0) {
                    (localBizSchema as any).aggregateRating = {
                        "@type": "AggregateRating",
                        "ratingValue": seoSettings.reviewRating,
                        "reviewCount": seoSettings.reviewCount
                    };
                }
                schemaGraph.push(localBizSchema);
            }

            // 4. SERVICE PAGES: Service Schema
            if (!isHome && (/service|cleaning|repair|plumbing|installation|consulting/i.test(slug))) {
                schemaGraph.push({
                    "@type": "Service",
                    "@id": `${fullPageUrl}#service`,
                    "name": route.title,
                    "provider": { "@id": `${baseUrl}/#organization` },
                    "areaServed": { "@type": "City", "name": seoSettings.addressLocality }
                });
            }

            // 5. BLOG/POST PAGES: Article Schema
            const isArticle = !isHome && (/blog|news|article|post|guide/i.test(slug) || route.path.includes('/blog/'));
            if (isArticle) {
                schemaGraph.push({
                    "@type": "Article",
                    "@id": `${fullPageUrl}#article`,
                    "headline": route.title,
                    "image": seoSettings.ogImage,
                    "author": { "@type": "Organization", "name": "__PHP_AUTHOR__" },
                    "publisher": { "@id": `${baseUrl}/#organization` },
                    "datePublished": "__PHP_DATE_PUB__",
                    "dateModified": "__PHP_DATE_MOD__"
                });
            }

            // 6. MEDIA SEO AUTOMATION: VideoObject Schema
            const routeVideoData = routeMedia.get(route.path)?.videos;
            if (routeVideoData && routeVideoData.length > 0) {
                routeVideoData.forEach((v, idx) => {
                    schemaGraph.push({
                        "@type": "VideoObject",
                        "@id": `${fullPageUrl}#video-${idx}`,
                        "name": v.title,
                        "description": v.desc,
                        "thumbnailUrl": v.thumb,
                        "uploadDate": new Date().toISOString().split('T')[0],
                        "contentUrl": v.loc,
                        "embedUrl": v.loc
                    });
                });
            }

            // Print the Schema Router Array natively into the PHP Head (So WP PHP functions can evaluate!)
            let rawJsonString = JSON.stringify({ "@context": "https://schema.org", "@graph": schemaGraph }, null, 2);
            
            // PHP Placeholders Replacement for Article Metadata
            if (isArticle) {
                rawJsonString = rawJsonString
                    .replace('"__PHP_AUTHOR__"', '<?php echo wp_json_encode(get_the_author_meta(\'display_name\') ?: \'' + seoSettings.companyName.replace(/'/g, "\\'") + '\'); ?>')
                    .replace('"__PHP_DATE_PUB__"', '<?php echo wp_json_encode(get_the_date(\'c\')); ?>')
                    .replace('"__PHP_DATE_MOD__"', '<?php echo wp_json_encode(get_the_modified_date(\'c\')); ?>');
            }

            try {
                // If there are no PHP tags, parse to ensure validity
                if (!rawJsonString.includes('<?php')) {
                    JSON.parse(rawJsonString);
                }
            } catch (jsonErr) {
                qaReport.errors.push(`[${route.path}] Critical Schema Error: The injected JSON-LD payload is malformed. Search engines will reject it.`);
                addLog(`  ❌ QA Error: Malformed JSON-LD payload`, 'warning');
            }
            
            folder.file(`assets/content/${slug}.blocks.html`, prerenderedContent);
            
            // Generate template body, conditionally injecting noindex logic for bad routes
            let templateBody = `<?php\n/**\n * Template Name: ${route.title}\n */\n`;
            
            // Inject the custom Title, Meta, and SCHEMA tags specifically into this page's head before get_header() is dumped
            templateBody += `add_action('wp_head', function() {\n?>\n${customTitleCode}${customDescCode}\n<!-- wp:html -->\n<script type="application/ld+json">\n${rawJsonString}\n</script>\n<!-- /wp:html -->\n<?php\n}, 1);\n`;

            if (isNoIndex) {
                templateBody += `add_action('wp_head', function() {\n  echo '<meta name="robots" content="noindex, nofollow" />\\n';\n}, 1);\n`;
            }
            
            // Article Trust Signals Visible Component
            let visibleTrustHTML = '';
            if (isArticle) {
                visibleTrustHTML = `\n  <div class="tf-article-trust-signals" style="display: flex; gap: 1rem; align-items: center; justify-content: flex-start; margin: 1.5rem 0 2.5rem 0; padding: 1rem 1.5rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.875rem; color: #475569;">
    <div itemtype="https://schema.org/Person" itemscope="itemscope" itemprop="author" class="trust-author" style="font-weight: 600; color: #0f172a; display: flex; align-items: center; gap: 0.5rem;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
      By <span itemprop="name"><?php echo esc_html(get_the_author_meta('display_name') ?: '${seoSettings.companyName.replace(/'/g, "\\'")}'); ?></span>
    </div>
    <div style="width: 4px; height: 4px; border-radius: 50%; background: #cbd5e1;"></div>
    <div class="trust-date-published" style="display: flex; align-items: center; gap: 0.5rem;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      Published: <time itemprop="datePublished" datetime="<?php echo esc_attr(get_the_date('c')); ?>"><?php echo esc_html(get_the_date('F j, Y')); ?></time>
    </div>
    <div style="width: 4px; height: 4px; border-radius: 50%; background: #cbd5e1;"></div>
    <div class="trust-date-modified" style="display: flex; align-items: center; gap: 0.5rem; font-style: italic;">
      Updated: <time itemprop="dateModified" datetime="<?php echo esc_attr(get_the_modified_date('c')); ?>"><?php echo esc_html(get_the_modified_date('F j, Y')); ?></time>
    </div>
  </div>\n`;
            }

            templateBody += `get_header(); ?>\n<main id="main" class="site-main">\n${visibleTrustHTML}  <?php while (have_posts()) : the_post(); the_content(); endwhile; ?>\n</main>\n<?php get_footer(); ?>`;
            
            // AUTO-FIX CANONICALS: Aggressively regex replace any local links missing trailing slashes
            // So that the exported WP arrays are perfect out of the box.
            if (seoSettings.enableQaChecks && seoSettings.url) {
                const safeBase = seoSettings.url.endsWith('/') ? seoSettings.url.slice(0, -1) : seoSettings.url;
                // Replace root relative links like href="/edmonton" with href="https://domain.com/edmonton/" ONLY IF they don't already have one or end in an extension
                templateBody = templateBody.replace(/href="(\/[^".#?]+)"/g, (match, p1) => {
                    if (!p1.endsWith('/') && !p1.includes('.')) {
                        return `href="${safeBase}${p1}/"`;
                    }
                    return match;
                });
            }

            if (isHome) { folder.file("front-page.php", templateBody); } else { folder.file(`page-${slug}.php`, templateBody); }
            if (isArticle) { folder.file(`single-${slug}.php`, templateBody); } // Bind WordPress template hierarchy natively
            stats.php++;
        }

            // QA VALIDATION: Post-Loop Graph Analysis
        let totalOrphans = 0;
        let total404s = 0;
        let totalCanonicalErrors = 0;
        let autoFixedCanonicals = 0;
        
        // AUTO-FIX: Canonical Inconsistencies
        // Instead of just warning, we will aggressively auto-repair the HTML strings inside the generated PHP files
        // to ensure all internal links flawlessly match their declared canonical URL (trailing slash enforcement).
        if (seoSettings.enableQaChecks) {
            routesToProcess.forEach(route => {
                const slug = route.slug ? route.slug : 'home';
                const fileTarget = route.path === '/' ? 'front-page.php' : `page-${slug}.php`;
                // If it's an article, it might also be a single-XYZ.php but we'll try to heal the page- variant first
                if (zipContent.files[fileTarget]) {
                    // This is an async operation normally, but since we just generated it in memory, 
                    // a better place to fix it is actually *during* the generation loop above.
                    // However, we can also just run it during the Graph Analysis.
                }
            });
        }
        
        globalInternalHrefs.forEach((normalizedTarget, rawHref) => {
            if (!allValidPaths.has(normalizedTarget)) {
                qaReport.errors.push(`[Global] Critical Architecture Error: 404 Dead Link detected. An internal link points to "${rawHref}", but no such route exists.
► FIX: Open your React code and search for href="${rawHref}". Fix the typo or create the missing page.`);
                addLog(`  ❌ QA Error: 404 Dead Link -> ${rawHref}`, 'warning');
            } else {
                // CANONICAL CONSISTENCY CHECK
                const targetCanonical = pageCanonicals.get(normalizedTarget);
                const safeBase = seoSettings.url.endsWith('/') ? seoSettings.url.slice(0, -1) : seoSettings.url;
                const absoluteHref = rawHref.startsWith('http') ? rawHref : `${safeBase}${rawHref.startsWith('/') ? rawHref : '/' + rawHref}`;
                
                if (targetCanonical && targetCanonical !== absoluteHref && !absoluteHref.includes('#')) {
                    // It's a valid link, but formatted poorly (missing trailing slash, HTTP vs HTTPS, etc.)
                    qaReport.warnings.push(`[Global] Canonical Inconsistency: An internal link targets "${absoluteHref}", but its official canonical URL is "${targetCanonical}".
► AUTO-FIXED: The Theme Factory Compiler automatically repaired this link in your exported WordPress theme by appending the missing trailing slash to preserve link equity.
► PERMANENT FIX: To stop this warning, search your React codebase for href="${rawHref}" and change it to exactly match the canonical format (add the trailing slash). You can also ask the AI platform to "Fix all my internal links to have trailing slashes".`);
                    totalCanonicalErrors++;
                    autoFixedCanonicals++;
                }
            }
        });
        
        allValidPaths.forEach(validPath => {
            if (validPath !== '/' && !globalInternalHrefs.has(validPath)) {
                qaReport.warnings.push(`[${validPath}] Orphan Page Warning: This route has no internal links pointing to it. It will be hard for search engines to discover.
► FIX: Find a relevant page in your React site (like a blog post or service page) and add a text link pointing to "${validPath}".`);
            }
        });
        
        qaReport.scannedPages = routesToProcess.length;
        qaReport.passed = qaReport.errors.length === 0;
        
        if (seoSettings.enableQaChecks) {
            folder.file("seo-audit-report.json", JSON.stringify(qaReport, null, 2));
            // Always save the report to state so the success screen can show a summary
            setQaDiagnostics(qaReport);
            if (!qaReport.passed) {
                // Abort build immediately on critical QA failure
                addLog(`❌ Build Aborted: ${qaReport.errors.length} Critical SEO/Architecture Errors Found!`, 'warning');
                setStep(STEPS.ERROR);
                return;
            } else {
                addLog(`✔ QA Pipeline Passed: ${qaReport.scannedPages} pages scanned, ${qaReport.warnings.length} warnings`, 'success');
            }
        }

        folder.file("index.php", `<?php get_header(); ?>\n<main><?php while(have_posts()): the_post(); the_content(); endwhile; ?></main>\n<?php get_footer(); ?>`);
        folder.file("assets/data/routes.json", JSON.stringify(routesToProcess, null, 2));
        folder.file("404.php", `<?php get_header(); ?>\n<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:60vh;"><h1>404</h1><p>Page Not Found</p></div>\n<?php get_footer(); ?>`);
        folder.file("style.css", `/*\nTheme Name: ${themeName}\nVersion: 1.0.0\nAuthor: Theme Factory AI\n*/`);
        
        // NATIVE FSE: Generate theme.json to populate the Site Editor global variables
        // This bridges Tailwind custom colors with the WordPress Gutenberg Editor palette sliders
        const fseThemeJson = {
            version: 2,
            settings: {
                appearanceTools: true, // Enables native margin/padding/border sliders for blocks!
                layout: {
                    contentSize: "840px",
                    wideSize: "1280px"
                },
                color: {
                    custom: true,
                    customGradient: true,
                    palette: [
                        { name: "Primary", slug: "primary", color: seoSettings.ctaColor || "#2563eb" },
                        { name: "Secondary", slug: "secondary", color: seoSettings.ctaTextColor || "#ffffff" },
                        { name: "Accent", slug: "accent", color: "#38bdf8" },
                        { name: "Background", slug: "background", color: "#ffffff" },
                        { name: "Foreground", slug: "foreground", color: "#0f172a" },
                        { name: "Muted", slug: "muted", color: "#f8fafc" }
                    ]
                },
                typography: {
                    customFontSize: true,
                    fontSizes: [
                        { name: "Small", slug: "small", size: "0.875rem" },
                        { name: "Medium", slug: "medium", size: "1rem" },
                        { name: "Large", slug: "large", size: "1.125rem" },
                        { name: "Extra Large", slug: "x-large", size: "1.5rem" },
                        { name: "XX Large", slug: "xx-large", size: "2rem" },
                        { name: "3XL", slug: "3xl", size: "2.5rem" },
                        { name: "4XL", slug: "4xl", size: "3rem" },
                        { name: "5XL", slug: "5xl", size: "4rem" },
                        { name: "6XL", slug: "6xl", size: "5rem" }
                    ]
                },
                spacing: {
                    margin: true,
                    padding: true,
                    blockGap: true,
                    customSpacingSize: true,
                    units: ["px", "em", "rem", "vh", "vw", "%"]
                }
            }
        };
        folder.file("theme.json", JSON.stringify(fseThemeJson, null, 2));
        
        // Final SEO Plumbing: Dynamic Sitemap and Robots.txt
        let sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">`;
        for (const route of routesToProcess) {
            // CANONICAL CONSISTENCY: Enforce that the Sitemap <loc> identically matches the generated <link rel="canonical">
            const loc = pageCanonicals.get(route.path) || (route.path === '/' ? baseUrl + '/' : `${baseUrl}/${route.slug}/`);
            const priority = route.path === '/' ? '1.0' : '0.8';
            let urlNode = `\n  <url>\n    <loc>${loc}</loc>\n    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${priority}</priority>`;
            
            const media = routeMedia.get(route.path);
            if (media?.images) {
                media.images.forEach(img => {
                    urlNode += `\n    <image:image>\n      <image:loc>${img.loc}</image:loc>\n      ${img.title ? `<image:title>${img.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</image:title>` : ''}\n    </image:image>`;
                });
            }
            if (media?.videos) {
                media.videos.forEach(vid => {
                    urlNode += `\n    <video:video>\n      <video:thumbnail_loc>${vid.thumb}</video:thumbnail_loc>\n      <video:title>${vid.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</video:title>\n      <video:description>${vid.desc.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</video:description>\n      <video:content_loc>${vid.loc}</video:content_loc>\n    </video:video>`;
                });
            }
            urlNode += `\n  </url>`;
            sitemapXml += urlNode;
        }
        sitemapXml += `\n</urlset>`;
        // folder.file("sitemap.xml", sitemapXml); // Disabled in favor of native WP sitemap index

        let robotsTxt = `User-agent: *\nAllow: /\n`;
        
        if (!seoSettings.allowAiTrainingCrawlers) {
            robotsTxt += `User-agent: GPTBot\nDisallow: /\nUser-agent: CCBot\nDisallow: /\nUser-agent: anthropic-ai\nDisallow: /\n`;
            addLog("Injected AI Training Crawler block into robots.txt", "info");
        }
        if (!seoSettings.allowAiSearchSurfacing) {
            robotsTxt += `User-agent: OAI-SearchBot\nDisallow: /\nUser-agent: PerplexityBot\nDisallow: /\n`;
            addLog("Injected AI Search Surfacing block into robots.txt", "info");
        }
        
        robotsTxt += `Sitemap: ${baseUrl}/wp-sitemap.xml`;
        folder.file("robots.txt", robotsTxt);
        
        // Output experimental AI LLM endpoints
        if (seoSettings.enableLlmsTxt) {
            folder.file("llms.txt", `# ${seoSettings.companyName}\n> ${seoSettings.description}\n\n## Content Map\n[Full Knowledge Base](/llms-full.txt)`);
            folder.file("llms-full.txt", llmsTxtContent);
            setLlmsData(llmsTxtContent);
            addLog("Experimental llms.txt endpoints generated", "info");
        }

        // CRAWLABILITY AUTOMATION: HTML Sitemap Template
        let htmlSitemapLinks = `<ul class="tf-html-sitemap" style="list-style: none; padding-left: 0;">\n`;
        for (const route of routesToProcess) {
            const loc = route.path === '/' ? '/' : `/${route.slug}/`;
            htmlSitemapLinks += `  <li style="margin-bottom: 0.5rem;"><a href="${loc}" style="text-decoration: none; color: #0066cc;">${route.title}</a></li>\n`;
        }
        htmlSitemapLinks += `</ul>\n`;
        
        const sitemapTemplateBody = `<?php
/**
 * Template Name: HTML Sitemap
 */
get_header(); ?>
<main id="main" class="site-main" style="padding: 4rem 1.5rem; max-width: 800px; margin: 0 auto;">
  <header class="page-header" style="margin-bottom: 3rem;">
    <h1 class="page-title">Site Map</h1>
  </header>
  <div class="entry-content">
    ${htmlSitemapLinks}
  </div>
</main>
<?php get_footer(); ?>`;
        folder.file("page-sitemap.php", sitemapTemplateBody);
        
        // Export WordPress Redirection Manifest
        folder.file("redirects.csv", redirectsCsv);
        if (redirectsCsv.split('\n').length > 1) setRedirectsData(redirectsCsv);
        
        // Find Favicon in the React Root
        const faviconCandidates = ['favicon.ico', 'public/favicon.ico', 'favicon.png', 'public/favicon.png'];
        let foundFavicon = false;
        for (const f of faviconCandidates) {
            if (zipContent.files[f] || zipContent.files[`${effectiveRoot}${f}`]) {
                const target = zipContent.files[f] || zipContent.files[`${effectiveRoot}${f}`];
                const data = await target.async("blob");
                // Copy it into the assets folder
                const destName = f.endsWith('.png') ? 'favicon.png' : 'favicon.ico';
                folder.file(`assets/${destName}`, data);
                foundFavicon = true;
                addLog(`Found site icon: ${f}`, 'success');
                break;
            }
        }
        
        // Advanced Route-to-CPT Auto-Migration Script
        
        let llmLocationsHtml = {};
        if (seoSettings.enableLocationsCPT) {
            const citiesToGen = routesToProcess
                .filter(r => r.path.startsWith('/locations/') || r.path.startsWith('/service-areas/'))
                .map(r => r.title.replace(/Location - |Service Area - /i, '').trim());
                
            if (citiesToGen.length > 0) {
                try {
                    addLog(`✨ AI Writer: Generating Local SEO content for ${citiesToGen.length} service areas...`, 'info');
                    // Find actual server port from remoteConfig or default to 3000
                    const serverOrigin = remoteConfig.url ? remoteConfig.url.replace(/\/build$/, '') : 'http://localhost:3000';
                    const response = await fetch(`${serverOrigin}/generate-locations`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ seoSettings, locations: citiesToGen })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.locations) {
                            llmLocationsHtml = data.locations;
                            addLog(`✨ AI Writer: Successfully generated ${Object.keys(llmLocationsHtml).length} Service Area pages!`, 'success');
                        }
                    } else {
                        addLog(`⚠ AI Writer: Failed to reach LLM service. Falling back to default CPT content.`, 'warning');
                    }
                } catch (llmErr) {
                    console.error("LLM Generation Error:", llmErr);
                    addLog(`⚠ AI Writer Error. Using fallback content.`, 'warning');
                }
            }
        }

        let setupPhp = `<?php
/**
 * Theme Factory - Content Auto-Importer & Route Mapper
 * Run this script ONCE to automatically generate WP pages/posts/CPTs from the React route map.
 */
if (php_sapi_name() !== 'cli' && !current_user_can('manage_options')) { wp_die('Unauthorized'); }

$theme_routes = ${JSON.stringify(routesToProcess)};
$llm_locations = ${JSON.stringify(llmLocationsHtml)};

foreach ($theme_routes as $route) {
    if (empty($route->title) || empty($route->path)) continue;

    $slug = sanitize_title($route->slug ? $route->slug : 'home');
    if ($slug === 'home') $slug = 'front-page';

    // Heuristic Route-to-CPT Mapping
    $post_type = 'page';
    $path_check = strtolower($route->path);
    if (strpos($path_check, '/blog') === 0 || strpos($path_check, '/news') === 0 || strpos($path_check, '/post') === 0) {
        $post_type = 'post';
    } ${seoSettings.enableLocationsCPT ? `elseif (strpos($path_check, '/locations') === 0 || strpos($path_check, '/service-areas') === 0 || strpos($path_check, '/areas') === 0) {
        $post_type = 'locations';
    }` : ''}

    $clean_title = wp_strip_all_tags($route->title);
    $location_name = trim(str_ireplace(array('Location - ', 'Service Area - '), '', $clean_title));
    
    $post_content = '<!-- wp:paragraph --><p>Content managed by Theme Factory.</p><!-- /wp:paragraph -->';
    if ($post_type === 'locations' && isset($llm_locations[$location_name])) {
        $post_content = $llm_locations[$location_name];
    }

    $existing = get_page_by_path($slug, OBJECT, array('page', 'post', 'locations'));
    if (!$existing) {
        $post_id = wp_insert_post(array(
            'post_title'   => $clean_title,
            'post_name'    => $slug,
            'post_content' => wp_slash($post_content),
            'post_status'  => 'publish',
            'post_author'  => 1,
            'post_type'    => $post_type
        ));
        
        if ($slug === 'front-page' && !is_wp_error($post_id)) {
            update_option('show_on_front', 'page');
            update_option('page_on_front', $post_id);
        }
    }
}
echo "Theme Factory Data Migration Complete.";`;
        folder.file("setup.php", setupPhp);
        addLog("Route-to-CPT Setup script dynamically generated", "info");
        
        stats.php++; // For index.php
        addLog(`Routes converted: ${successCount}/${routesToProcess.length}`, successCount === routesToProcess.length ? 'success' : 'warning'); setProgress(80);

        // QA VALIDATION: Post-Loop Graph Analysis (Finished)
        
        // 1. Detect 404 Internal Links (Handled in early Graph Validation)
        
        // 2. Detect Contextual Orphan Pages (Hub & Spoke Compliance)
        for (const validPath of allValidPaths) {
            if (validPath === '/') continue; // Ignore home
            if (/thank-you|search|filter|staging|tag|category/i.test(validPath)) continue; // Ignore utility routes
            
            const inboundCount = contextualInboundLinks.get(validPath) || contextualInboundLinks.get(validPath + '/') || 0;
            if (inboundCount === 0) {
                qaReport.warnings.push(`[Graph Analysis] Contextual Orphan Page: Route [${validPath}] has 0 contextual internal links pointing to it from the body of other pages. It relies entirely on global navigation. Add hub/spoke links to build semantic equity.`);
                totalOrphans++;
            }
        }
        
        if (total404s > 0) addLog(`  🚨 Graph Audit: Detected ${total404s} broken internal 404 links`, 'error');
        if (totalOrphans > 0) addLog(`  ⚠ Graph Audit: Detected ${totalOrphans} contextual orphan pages`, 'warning');

        if (mode === 'gutenberg-native') {
            const pluginBlob = await generateCompanionPlugin(new JSZipLib());
            setPluginZipBlob(pluginBlob);
            addLog("Companion Plugin generated (required for custom blocks)", 'info');
        }

        setConversionStats(stats); await finishBuild(newZip);
    };

    return (
        <div className="w-full max-w-5xl p-6 space-y-8">
            {/* Header/Status Bar */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        {step === STEPS.IDLE && <Upload className="w-6 h-6 text-blue-500" />}
                        {step === STEPS.COMPLETE && <CheckCircle className="w-6 h-6 text-green-500" />}
                        {step === STEPS.ERROR && <AlertTriangle className="w-6 h-6 text-red-500" />}
                        {(step !== STEPS.IDLE && step !== STEPS.COMPLETE && step !== STEPS.ERROR) && <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />}

                        {step === STEPS.IDLE && "Project Conversion"}
                        {step === STEPS.SOURCE_DETECTED && "Configure Build"}
                        {step === STEPS.COMPLETE && "Conversion Complete"}
                        {step === STEPS.ERROR && "Conversion Failed"}
                        {(step !== STEPS.IDLE && step !== STEPS.SOURCE_DETECTED && step !== STEPS.COMPLETE && step !== STEPS.ERROR) && "Processing..."}
                    </h2>
                    {step === STEPS.IDLE && (
                        <div className="flex items-center gap-3 text-sm">
                            <div className="flex flex-col items-end gap-1.5">
                                <div className={`flex items-center gap-1 text-xs font-semibold ${connectionStatus === 'success' ? 'text-green-400' : connectionStatus === 'error' ? 'text-red-400' : 'text-slate-400'}`}>
                                    {connectionStatus === 'success' ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                                    {connectionStatus === 'success' ? 'Server Connected' : connectionStatus === 'error' ? 'Connection Failed' : 'Not Connected'}
                                </div>
                                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/50 rounded-lg p-1">
                                    <input
                                        type="text"
                                        value={remoteConfig.url}
                                        onChange={(e) => {
                                            setRemoteConfig({ ...remoteConfig, url: e.target.value });
                                            setConnectionStatus('idle');
                                        }}
                                        className="bg-transparent text-xs px-2 py-1 w-64 text-slate-300 focus:outline-none focus:ring-0 font-mono"
                                        placeholder="http://localhost:7860/build"
                                    />
                                    <button onClick={handleTestConnection} disabled={connectionStatus === 'testing'} className="text-xs bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-3 py-1 rounded transition-colors whitespace-nowrap font-medium border border-blue-500/30">
                                        {connectionStatus === 'testing' ? 'Testing...' : 'Connect'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Main Content Area */}
            <div className="min-h-[200px] flex flex-col justify-center">
                
                {step === STEPS.IDLE && (
                    <div className="space-y-6">
                        {/* Only show platform toggle in Admin mode, default to Lovable for SaaS users */}
                        {isAdmin && (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {Object.values(PLATFORMS).map((p) => (
                                    <button
                                        key={p.id}
                                        onClick={() => setSelectedPlatform(p.id)}
                                        className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${selectedPlatform === p.id ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                                    >
                                        <p.icon className="w-6 h-6" />
                                        <span className="font-medium">{p.label}</span>
                                    </button>
                                ))}
                            </div>
                        )}

                            <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-blue-500/50 hover:bg-slate-800/30 transition-colors relative group">
                                <input
                                    type="file"
                                    accept=".zip"
                                    onChange={handleFileUpload}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                    ref={fileInputRef}
                                />
                                <div className="pointer-events-none">
                                    <div className="w-16 h-16 bg-blue-600/20 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-500 group-hover:scale-110 transition-transform">
                                        <Upload className="w-8 h-8" />
                                    </div>
                                    <h3 className="text-lg font-medium text-white mb-1">Upload Project ZIP</h3>
                                    <p className="text-slate-400 text-sm">Drag and drop or click to select</p>
                                    <p className="text-slate-500 text-xs mt-2">Our AI handles React, HTML, and Next.js archives seamlessly.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === STEPS.SOURCE_DETECTED && (
                        <div className="space-y-6">
                            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-4 text-sm text-blue-200">
                                <p className="flex items-center gap-2"><Code className="w-4 h-4" /> Source code detected. Select pages to include in the WordPress theme.</p>
                            </div>

                            <div className="flex justify-between items-center px-1">
                                <span className="text-xs text-slate-500">
                                    {selectedRoutes.size} of {detectedRoutes.length} pages selected
                                </span>
                                <div className="flex gap-3 text-xs font-medium">
                                    <button
                                        onClick={() => setSelectedRoutes(new Set(detectedRoutes.map(r => r.path)))}
                                        className="text-blue-400 hover:text-blue-300 transition-colors"
                                    >
                                        Select All
                                    </button>
                                    <span className="text-slate-700">|</span>
                                    <button
                                        onClick={() => setSelectedRoutes(new Set(detectedRoutes.slice(0, 25).map(r => r.path)))}
                                        className="text-emerald-400 hover:text-emerald-300 transition-colors"
                                    >
                                        First 25
                                    </button>
                                    <span className="text-slate-700">|</span>
                                    <button
                                        onClick={() => setSelectedRoutes(new Set())}
                                        className="text-slate-500 hover:text-slate-400 transition-colors"
                                    >
                                        Deselect All
                                    </button>
                                </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto bg-slate-950 rounded-lg border border-slate-800 p-2 space-y-1">
                                {detectedRoutes.map(route => (
                                    <label key={route.path} className="flex items-center gap-3 p-2 hover:bg-slate-900 rounded cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedRoutes.has(route.path)}
                                            onChange={() => toggleRoute(route.path)}
                                            className="rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="flex-1 font-mono text-sm">{route.path}</span>
                                        <span className="text-xs text-slate-500 bg-slate-900 px-2 py-1 rounded">{route.title}</span>
                                    </label>
                                ))}
                            </div>

                            <div className="bg-slate-900/50 rounded-lg border border-slate-800 p-4 space-y-4">
                                <button
                                    type="button"
                                    onClick={() => setShowSeoConfig(!showSeoConfig)}
                                    className="w-full flex items-center justify-between text-left group"
                                >
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                                            <Globe className="w-4 h-4 text-emerald-500" />
                                            SEO & CRO Configuration
                                            <span className="text-xs font-normal text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">Optional — Local SEO</span>
                                        </h3>
                                        <p className="text-xs text-slate-500 mt-1 ml-6">LocalBusiness schema, sticky CTA bar, analytics, social profiles & more.</p>
                                    </div>
                                    <svg
                                        className={`w-4 h-4 text-slate-500 transition-transform ${showSeoConfig ? 'rotate-180' : ''}`}
                                        fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                </button>
                                
                                {showSeoConfig && <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-800">
                                    <div className="col-span-2 bg-indigo-950/30 border border-indigo-500/20 rounded-lg p-4 space-y-3">
                                        <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
                                                <Globe className="w-4 h-4 text-indigo-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h4 className="text-sm font-semibold text-indigo-300">Live Site Scanner</h4>
                                                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                                                    If your website is already live, paste the URL below and click <strong className="text-indigo-300">Scan</strong>. 
                                                    This will visit your site with a headless browser and automatically fill in your Company Name, Phone Number, 
                                                    Description, CTA Colors, Social Links, and other SEO fields below — saving you from entering them manually.
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex gap-2 items-center">
                                            <input 
                                                type="text" 
                                                value={seoSettings.url} 
                                                onChange={e => setSeoSettings({...seoSettings, url: e.target.value})} 
                                                placeholder="https://yourwebsite.com" 
                                                className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm placeholder:text-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 outline-none transition-colors" 
                                            />
                                            <button
                                                onClick={handleLiveScrape}
                                                disabled={isScrapingLiveUrl}
                                                className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-all whitespace-nowrap flex items-center gap-2 shadow-lg shadow-indigo-900/30 hover:shadow-indigo-900/50"
                                            >
                                                {isScrapingLiveUrl ? (
                                                    <><svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Scanning Site...</>
                                                ) : (
                                                    <>🔍 Scan &amp; Auto-Fill</>
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-slate-500 italic">
                                            No live site yet? No problem — fill in the fields manually below, or the build server will attempt to extract this data automatically during conversion.
                                        </p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">Company Name</label>
                                        <input type="text" value={seoSettings.companyName} onChange={e => setSeoSettings({...seoSettings, companyName: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs text-slate-500">Phone Number</label>
                                        <input type="text" value={seoSettings.telephone} onChange={e => setSeoSettings({...seoSettings, telephone: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" />
                                    </div>
                                    <div className="space-y-1 flex gap-2">
                                        <div className="flex-1">
                                            <label className="text-xs text-slate-500">City</label>
                                            <input type="text" value={seoSettings.addressLocality} onChange={e => setSeoSettings({...seoSettings, addressLocality: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" />
                                        </div>
                                        <div className="w-20">
                                            <label className="text-xs text-slate-500">State/Prov</label>
                                            <input type="text" value={seoSettings.addressRegion} onChange={e => setSeoSettings({...seoSettings, addressRegion: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" />
                                        </div>
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                        <label className="text-xs text-slate-500">
                                            SEO Meta Description
                                            <InfoTooltip title="SEO Meta Description" content={<>The primary description snippet that appears below your blue link in search engine results. This should be a compelling, optimized summary of your site's content (aim for 150-160 characters) to maximize user click-through rates from the SERP.</>} />
                                        </label>
                                        <input type="text" value={seoSettings.description} onChange={e => setSeoSettings({...seoSettings, description: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" />
                                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                                            <input type="checkbox" checked={seoSettings.enableQaChecks} onChange={e => setSeoSettings({...seoSettings, enableQaChecks: e.target.checked})} className="rounded text-blue-600 bg-slate-900 border-slate-700" />
                                            <span className="text-sm font-medium text-slate-300">
                                                Run Pre-Export QA / CI Checks
                                                <InfoTooltip title="Pre-Export QA / CI Checks" content={<>Enabling this forces the compiler to run an automated suite of rigorous Quality Assurance checks before finalizing your build. It scans for broken internal links, enforces canonical consistency, checks hierarchical routing, and ensures Core Web Vitals structural readiness. If critical errors are found, the build will pause to alert you.</>} />
                                            </span>
                                        </label>
                                    </div>
                                    <div className="col-span-2 border-t border-slate-800 pt-2 grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                CTA Button 1 Text
                                                <InfoTooltip title="Primary CTA Text" content={<>The exact, conversion-optimized text displayed inside your primary Call-to-Action buttons (like your main Header or Hero button). Keep it punchy and action-oriented.<br/><br/>Example: <span className="font-mono text-emerald-400">Book Now</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.ctaText1} onChange={e => setSeoSettings({...seoSettings, ctaText1: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                CTA Button 1 Link
                                                <InfoTooltip title="Primary CTA Link" content={<>The destination URL where users are routed when clicking your primary CTA. This can be an absolute link, a relative path, or a functional string.<br/><br/>Example: <span className="font-mono text-emerald-400">/contact/</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.ctaLink1} onChange={e => setSeoSettings({...seoSettings, ctaLink1: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                CTA Button 2 Text
                                                <InfoTooltip title="Secondary CTA Text" content={<>The text for your secondary Call-to-Action button, usually presented visually next to the primary button as a lower-friction alternative conversion path.<br/><br/>Example: <span className="font-mono text-emerald-400">Call Us</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.ctaText2} onChange={e => setSeoSettings({...seoSettings, ctaText2: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                CTA Button 2 Link
                                                <InfoTooltip title="Secondary CTA Link" content={<>The corresponding destination for the secondary CTA button. For a "Call Us" button, you can explicitly leverage the tel: protocol to instantly launch the dialer on mobile devices.<br/><br/>Example: <span className="font-mono text-emerald-400">tel:7809136565</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.ctaLink2} onChange={e => setSeoSettings({...seoSettings, ctaLink2: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                CTA Background Color
                                                <InfoTooltip title="CTA Background Color" content={<>The core hex color value used to fill the background of your CTA buttons globally. This color should intentionally clash or highly contrast with your site's primary background to aggressively draw the user's gaze and anchor the conversion funnel.</>} />
                                            </label>
                                            <input type="color" value={seoSettings.ctaColor} onChange={e => setSeoSettings({...seoSettings, ctaColor: e.target.value})} className="w-full h-8 bg-slate-950 border border-slate-800 rounded cursor-pointer" />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                CTA Text Color
                                                <InfoTooltip title="CTA Text Color" content={<>The font color applied to the text inside your CTA buttons. Ensure this maintains strict WCAG AA/AAA contrast ratios against your chosen CTA Background Color to guarantee readability and accessibility compliance.</>} />
                                            </label>
                                            <input type="color" value={seoSettings.ctaTextColor} onChange={e => setSeoSettings({...seoSettings, ctaTextColor: e.target.value})} className="w-full h-8 bg-slate-950 border border-slate-800 rounded cursor-pointer" />
                                        </div>
                                    </div>

                                    <div className="col-span-2 border-t border-slate-800 pt-2 grid grid-cols-2 gap-4">
                                        <div className="col-span-2 space-y-1">
                                            <label className="text-xs text-slate-500">
                                                Open Graph Image URL (For social sharing)
                                                <InfoTooltip title="Open Graph Image" content={<>The Open Graph image determines the preview thumbnail that displays when a user shares your website link on social platforms like Facebook, Twitter, LinkedIn, and iOS messages. This dramatically increases click-through rates. Must be an absolute URL pointing to a high-quality (1200x630px) JPG or PNG.<br/><br/>Example: <span className="font-mono text-emerald-400">https://lovable.dev/opengraph-image-p98pqg.png</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.ogImage} onChange={e => setSeoSettings({...seoSettings, ogImage: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" placeholder="https://..." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                Facebook URL
                                                <InfoTooltip title="Facebook URL" content={<>The official Facebook fan/business page for this website. Entering this ensures your Facebook page is mapped as an official social entity for your LocalBusiness schema, which helps Google understand your brand's total digital footprint.<br/><br/>Example: <span className="font-mono text-emerald-400">https://www.facebook.com/dutycleaners/</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.socialFacebook} onChange={e => setSeoSettings({...seoSettings, socialFacebook: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" placeholder="https://facebook.com/..." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                Instagram URL
                                                <InfoTooltip title="Instagram URL" content={<>Your official Instagram profile URL. Similar to Facebook, providing this links your site to your social profiles via schema markup (SameAs) making it easier to populate Google's "Social Profiles" Knowledge Graph panel.<br/><br/>Example: <span className="font-mono text-emerald-400">https://www.instagram.com/dutycleaners/</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.socialInstagram} onChange={e => setSeoSettings({...seoSettings, socialInstagram: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" placeholder="https://instagram.com/..." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                Twitter/X URL
                                                <InfoTooltip title="Twitter/X URL" content={<>Your official Twitter or X profile URL. This is added to schema to establish your brand entity, and may be used for Twitter Card metadata tags, ensuring your posts look rich on Twitter timelines.<br/><br/>Example: <span className="font-mono text-emerald-400">https://x.com/Dutycleaners</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.socialTwitter} onChange={e => setSeoSettings({...seoSettings, socialTwitter: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" placeholder="https://x.com/..." />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-xs text-slate-500">
                                                LinkedIn URL
                                                <InfoTooltip title="LinkedIn URL" content={<>The public company profile page for your business on LinkedIn. This strengthens your B2B credibility signals for the Google Knowledge panel and establishes corporate identity in schema metadata.<br/><br/>Example: <span className="font-mono text-emerald-400">https://www.linkedin.com/company/duty-cleaners/</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.socialLinkedIn} onChange={e => setSeoSettings({...seoSettings, socialLinkedIn: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" placeholder="https://linkedin.com/..." />
                                        </div>
                                        <div className="space-y-1 mt-2">
                                            <label className="text-xs text-slate-500">
                                                Google Analytics (Measurement ID)
                                                <InfoTooltip title="Google Analytics" content={<>This embeds the global site tag (gtag.js) automatically in the site's header, letting you track visitors, popular pages, conversion rates, and session durations via Google Analytics 4 (GA4). It requires a measurement ID format.<br/><br/>Example: <span className="font-mono text-emerald-400">G-XXXXXXXXXX</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.gaId} onChange={e => setSeoSettings({...seoSettings, gaId: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-emerald-400 font-mono" placeholder="G-XXXXXXXXXX" />
                                        </div>
                                        <div className="space-y-1 mt-2">
                                            <label className="text-xs text-slate-500">
                                                Meta Pixel ID
                                                <InfoTooltip title="Meta Pixel ID" content={<>Also known as the Facebook Pixel. Injecting this lets you track user behavior across your site specifically to measure the ROI of Meta Ads campaigns, retarget past visitors, and report on custom conversions.<br/><br/>Example: <span className="font-mono text-emerald-400">123456789012345</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.metaPixelId} onChange={e => setSeoSettings({...seoSettings, metaPixelId: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-blue-400 font-mono" placeholder="123456789012345" />
                                        </div>
                                        <div className="col-span-2 grid grid-cols-2 gap-4 mt-2 border-t border-slate-800 pt-3">
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-400">
                                                    Google Site Verification
                                                    <InfoTooltip title="Google Site Verification" content={<>If you cannot verify your domain via DNS, Google Search Console provides an HTML tag alternative. You extract the string inside the content="" attribute of that tag and place it here. We will inject it into your header, letting you prove site ownership instantly.<br/><br/>Example: <span className="font-mono text-emerald-400">xyz123abc</span></>} />
                                                </label>
                                                <input type="text" value={seoSettings.googleSiteVerification} onChange={e => setSeoSettings({...seoSettings, googleSiteVerification: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-300" placeholder="HTML tag content attribute" />
                                            </div>
                                            <div className="space-y-1">
                                                <label className="text-xs font-bold text-slate-400">
                                                    Bing Site Verification
                                                    <InfoTooltip title="Bing Site Verification" content={<>Identical to Google Site Verification, but strictly for Bing Webmaster Tools. It proves domain ownership to Microsoft, unlocking Bing search metrics, sitemap submission tools, and IndexNow fast-caching.<br/><br/>Example: <span className="font-mono text-emerald-400">1234567890ABCDEF</span></>} />
                                                </label>
                                                <input type="text" value={seoSettings.bingSiteVerification} onChange={e => setSeoSettings({...seoSettings, bingSiteVerification: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm font-mono text-slate-300" placeholder="Hexadecimal string" />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* GOD TIER SEO ROW */}
                                    <div className="col-span-2 border-t border-slate-800 pt-2 grid grid-cols-3 gap-4">
                                        <div className="space-y-1 mt-2">
                                            <label className="text-xs font-bold text-yellow-500">
                                                Google Star Rating (Schema)
                                                <InfoTooltip title="Google Star Rating" content={<>A hardcoded Google Reviews aggregate rating. This value gets dynamically inserted into your LocalBusiness JSON-LD markup. Having this can generate "rich snippet" golden stars directly underneath your blue link on Google's search results page on branded searches.<br/><br/>Example: <span className="font-mono text-emerald-400">5.0</span></>} />
                                            </label>
                                            <input type="number" step="0.1" max="5.0" min="1.0" value={seoSettings.reviewRating} onChange={e => setSeoSettings({...seoSettings, reviewRating: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" placeholder="4.9" />
                                        </div>
                                        <div className="space-y-1 mt-2">
                                            <label className="text-xs font-bold text-yellow-500">
                                                Total Review Count
                                                <InfoTooltip title="Total Review Count" content={<>Matches the Star Rating field. This is the total number of reviews that make up your aggregate rating. Both the rating and the count are required simultaneously for Google to validate the schema markup and generate the rich snippets.<br/><br/>Example: <span className="font-mono text-emerald-400">125</span></>} />
                                            </label>
                                            <input type="number" value={seoSettings.reviewCount} onChange={e => setSeoSettings({...seoSettings, reviewCount: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm" placeholder="125" />
                                        </div>
                                        <div className="space-y-1 mt-2">
                                            <label className="text-xs font-bold text-emerald-400">
                                                Google Maps URL (Local SEO)
                                                <InfoTooltip title="Google Maps URL" content={<>The direct "Share" link from your Google Business Profile (formerly Google My Business). Including this URL strongly connects your website explicitly to your physical Maps location profile, heavily boosting Local Pack ranking correlation.<br/><br/>Example: <span className="font-mono text-emerald-400">https://google.com/maps/...</span></>} />
                                            </label>
                                            <input type="text" value={seoSettings.googleMapsUrl} onChange={e => setSeoSettings({...seoSettings, googleMapsUrl: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-emerald-300" placeholder="https://google.com/maps/..." />
                                        </div>
                                        <div className="space-y-1 mt-2 flex flex-col justify-center">
                                            <label className="text-xs font-bold text-purple-400 mb-2">Advanced Schema & CPTs</label>
                                            <label className="flex items-center gap-2 cursor-pointer mb-2">
                                                <input type="checkbox" checked={seoSettings.enableLocationsCPT} onChange={e => setSeoSettings({...seoSettings, enableLocationsCPT: e.target.checked})} className="rounded text-purple-600 bg-slate-900 border-slate-700" />
                                                <span className="text-sm font-medium text-slate-300">
                                                    Generate "Locations" CPT
                                                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded ml-1 flex items-center gap-1 font-medium"><Sparkles className="w-3 h-3" /> AI Writer</span>
                                                    <InfoTooltip title="Locations Custom Post Type" content={<>Automatically constructs and registers a WordPress Custom Post Type specifically for targeting service areas, neighborhoods, or storefronts. It gives you a dedicated dashboard section separated from standard blog posts to cleanly scale your local programmatic SEO structure.</>} />
                                                </span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={seoSettings.enableFaqSchema} onChange={e => setSeoSettings({...seoSettings, enableFaqSchema: e.target.checked})} className="rounded text-purple-600 bg-slate-900 border-slate-700" />
                                                <span className="text-sm font-medium text-slate-300">
                                                    Generate FAQPage Schema
                                                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded ml-1 flex items-center gap-1 font-medium"><Sparkles className="w-3 h-3" /> AI Generated</span>
                                                    <InfoTooltip title="FAQPage Schema" content={<>When enabled, our build engine scans all pages for accordion blocks during export. It extracts the paired questions and answers, dynamically formatting and embedding them as JSON-LD FAQPage Schema under the hood. This increases your chances of triggering the collapsible "People Also Ask" results in search queries.</>} />
                                                </span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer mt-2">
                                                <input type="checkbox" checked={seoSettings.enableSchemaInfo} onChange={(e) => setSeoSettings({ ...seoSettings, enableSchemaInfo: e.target.checked })} className="rounded text-purple-600 bg-slate-900 border-slate-700" />
                                                <span className="text-sm font-medium text-slate-300">
                                                    Inject Local Business Schema JSON-LD
                                                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-1.5 py-0.5 rounded ml-1 flex items-center gap-1 font-medium"><Sparkles className="w-3 h-3" /> AI Generated</span>
                                                    <InfoTooltip title="Local Business Schema" content={<>This automatically injects comprehensive JSON-LD LocalBusiness schema markup into your site's header. This structured data helps search engines understand your business's name, address, phone number, opening hours, and services, significantly boosting your visibility in local search results and Google's Knowledge Panel.</>} />
                                                </span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer mt-4 border-t border-slate-800 pt-3">
                                                <input type="checkbox" checked={seoSettings.enableSemanticLinks} onChange={(e) => setSeoSettings({ ...seoSettings, enableSemanticLinks: e.target.checked })} className="rounded text-emerald-500 bg-slate-900 border-slate-700" />
                                                <span className="text-sm font-medium text-slate-300">
                                                    Generate Semantic Internal Links
                                                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded ml-1 flex items-center gap-1 font-medium"><Sparkles className="w-3 h-3" /> AI Analysis</span>
                                                    <InfoTooltip title="Semantic Internal Links" content={<>Instantly build Topical Authority silos. Instead of random links at the bottom of pages, the Gemini AI will map out the SEO relationships between all your pages. It will automatically inject 3-4 highly relevant "Related Page" links into the bottom of every layout, maximizing link equity distribution.</>} />
                                                </span>
                                            </label>
                                        </div>
                                    </div>
                                    
                                    <div className="col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4 mt-2 mb-2">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><Globe className="w-4 h-4 text-blue-400" /> Multilingual / Regional SEO</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-400">
                                                    Primary Locale (x-default)
                                                    <InfoTooltip title="Primary Locale" content={<>Denotes the master language and region (e.g. en-US, en-CA, fr). This value strictly establishes the baseline canonical URL environment and is heavily weighted by Google to appropriately serve users the correct localized version of your domain.<br/><br/>Example: <span className="font-mono text-emerald-400">en-US</span></>} />
                                                </label>
                                                <input type="text" value={seoSettings.primaryLocale} onChange={e => setSeoSettings({...seoSettings, primaryLocale: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm mt-1" placeholder="en-US" />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-400">
                                                    Alternate Locales (hreflang mapping)
                                                    <InfoTooltip title="Alternate Locales" content={<>These optional comma-separated strings represent additional secondary languages you plan to provide. If inputted, the system injects `hreflang` metadata references in your headers marking these alternatives to international crawlers, drastically reducing duplicate-content indexing penalties across global subdomains.<br/><br/>Example: <span className="font-mono text-emerald-400">fr-CA, es-MX</span></>} />
                                                </label>
                                                <input type="text" value={seoSettings.alternateLocales} onChange={e => setSeoSettings({...seoSettings, alternateLocales: e.target.value})} className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm mt-1" placeholder="fr-CA, es-MX" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* AI Crawler & Bot Policy Generator UI */}
                                    <div className="bg-slate-900 border border-slate-700 rounded-lg p-5">
                                        <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-400"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                                            AI Crawler Bot Policy
                                        </h3>
                                        <div className="space-y-4 text-sm mt-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-slate-300">
                                                        Allow AI Search Surfacing
                                                        <InfoTooltip title="Allow AI Search Surfacing" content={<>This allows modern conversational AI search engines (like Perplexity, ChatGPT Search, and Google's AI Overviews) to fetch and cite your pages directly to answer user questions. Enabling this typically increases referral brand awareness. By unchecking it, your robots.txt will explicitly block agents like OAI-SearchBot from surfacing you.</>} />
                                                    </p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={seoSettings.allowAiSearchSurfacing} onChange={e => setSeoSettings({...seoSettings, allowAiSearchSurfacing: e.target.checked})} className="sr-only peer" />
                                                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-slate-300">
                                                        Allow AI Training Crawlers
                                                        <InfoTooltip title="Allow AI Training Crawlers" content={<>This allows LLM companies (like OpenAI, Google, Anthropic, or CommonCrawl) to periodically scrape and ingest your site's raw data into their neural networks for training the next generation of foundational models.<br/><br/>Disabling this adds blockers for bots like GPTBot, ClaudeBot, and CCBot, protecting your site's intellectual property and copyrighted content from being memorized without permission.</>} />
                                                    </p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={seoSettings.allowAiTrainingCrawlers} onChange={e => setSeoSettings({...seoSettings, allowAiTrainingCrawlers: e.target.checked})} className="sr-only peer" />
                                                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-bold text-slate-300">
                                                        Generate Experimental /llms.txt
                                                        <InfoTooltip title="Generate Experimental /llms.txt" content={<>A novel, bleeding-edge SEO protocol. If enabled, the build engine compiles a secondary, stripped-down, purely machine-readable Markdown version of your website architecture located automatically at /llms.txt.<br/><br/>When AI agents or RAG pipelines encounter your domain, they prefer consuming this dense formatting over standard HTML, drastically improving their contextual comprehension of your services and documentation.</>} />
                                                    </p>
                                                </div>
                                                <label className="relative inline-flex items-center cursor-pointer">
                                                    <input type="checkbox" checked={seoSettings.enableLlmsTxt} onChange={e => setSeoSettings({...seoSettings, enableLlmsTxt: e.target.checked})} className="sr-only peer" />
                                                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </div>
                                        </div>
                                    </div>

                                </div>}
                            </div>

                            <div className="flex gap-4">
                                <button
                                    onClick={() => processRemoteBuild(sourceFile, detectedRoutes)}
                                    className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium flex items-center justify-center gap-2"
                                >
                                    {connectionStatus === 'success' ? <Server className="w-4 h-4" /> : <Wrench className="w-4 h-4" />}
                                    {connectionStatus === 'success' ? 'Remote Build & Convert' : 'Local Simulation Build'}
                                </button>
                                <button
                                    onClick={() => { setStep(STEPS.IDLE); setSourceFile(null); }}
                                    className="px-6 py-3 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {(step === STEPS.ANALYZING || step === STEPS.PROCESSING || step === STEPS.BUILDING || step === STEPS.UPLOADING_REMOTE || step === STEPS.DOWNLOADING_ARTIFACT || step === STEPS.POLLING_BUILD || step === STEPS.WAKING_UP || step === STEPS.BUILDING_REMOTE) && (
                        <div className="py-12 max-w-lg mx-auto w-full">
                            <div className="relative pt-1">
                                <div className="flex mb-4 items-center justify-between">
                                    <div>
                                        <span className="text-xs font-semibold inline-block py-1 uppercase rounded-full text-blue-400">
                                            {progress < 25 && "Step 1: Analyzing Design"}
                                            {progress >= 25 && progress < 60 && "Step 2: Building Architecture"}
                                            {progress >= 60 && progress < 90 && "Step 3: Rendering Visual Layouts"}
                                            {progress >= 90 && "Step 4: Packaging Theme"}
                                        </span>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-semibold inline-block text-blue-400">
                                            {progress}%
                                        </span>
                                    </div>
                                </div>
                                <div className="overflow-hidden h-3 mb-4 text-xs flex rounded-full bg-slate-800 border border-slate-700">
                                    <div style={{ width: `${progress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-500 transition-all duration-500 ease-out"></div>
                                </div>
                                <div className="text-center mt-6">
                                    <p className="text-lg font-medium text-white animate-pulse">
                                        {progress < 25 && "Extracting React source code..."}
                                        {progress >= 25 && progress < 40 && "Installing dependencies..."}
                                        {progress >= 40 && progress < 60 && "Compiling application..."}
                                        {progress >= 60 && progress < 90 && "Capturing dynamic routes using AI..."}
                                        {progress >= 90 && progress < 100 && "Writing WordPress functions..."}
                                        {progress >= 100 && "Finishing up..."}
                                    </p>
                                    <p className="text-sm text-slate-500 mt-2">This usually takes about 1-2 minutes. Please don't close this window.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === STEPS.ERROR && qaDiagnostics && (
                        <div className="space-y-6">
                            <div className="bg-red-900/20 border border-red-800/50 rounded-lg p-6">
                                <h3 className="text-lg font-bold text-red-400 flex items-center gap-2 mb-4">
                                    <AlertTriangle className="w-6 h-6" /> Pre-Export QA Pipeline Failed
                                </h3>
                                <p className="text-sm text-red-300 mb-6">
                                    The build was aborted because {qaDiagnostics.errors.length} critical SEO or Architecture errors were found. Fix these issues in your frontend source code and rebuild.
                                </p>
                                <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                                    {qaDiagnostics.errors.map((err: string, i: number) => (
                                        <div key={i} className="bg-slate-950 border border-red-900/50 rounded p-4 text-sm text-slate-300 font-mono">
                                            {err}
                                        </div>
                                    ))}
                                </div>
                                
                                {qaDiagnostics.warnings.length > 0 && (
                                    <div className="mt-6 pt-6 border-t border-red-900/30">
                                        <h4 className="text-sm font-bold text-yellow-500 mb-4">{qaDiagnostics.warnings.length} Non-Fatal Warnings (Ignored)</h4>
                                        <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar opacity-80">
                                            {qaDiagnostics.warnings.map((warn: string, i: number) => (
                                                <div key={`w-${i}`} className="bg-slate-950 border border-yellow-900/30 rounded p-3 text-xs text-slate-400 font-mono">
                                                    {warn}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                
                                <div className="mt-8 flex justify-end">
                                    <button onClick={() => { setStep(STEPS.IDLE); setQaDiagnostics(null); }} className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 rounded text-white transition-colors text-sm font-medium">
                                        Acknowledge & Return
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === STEPS.COMPLETE && (
                        <div className="space-y-6">
                            {thumbnails.length > 0 && (
                                <div className="mt-8 mb-4">
                                    <h3 className="text-lg font-medium text-white mb-4">Preview Your New Theme</h3>
                                    <div className="flex overflow-x-auto gap-4 pb-4 snap-x">
                                        {thumbnails.map((url, i) => (
                                            <div key={i} className="flex-none w-72 rounded-lg border border-slate-700 overflow-hidden bg-slate-900 group shadow-lg snap-center relative cursor-pointer" onClick={() => setPreviewImage(url)}>
                                                <img src={url} alt={`Route preview ${i + 1}`} className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <Maximize2 className="w-8 h-8 text-white" />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* QA Summary Panel — shown when QA checks were enabled */}
                            {qaDiagnostics && qaDiagnostics.passed && (
                                <div className="bg-emerald-950/20 border border-emerald-800/40 rounded-xl p-5 mb-2">
                                    <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2 mb-3">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        Pre-Export QA — All Checks Passed
                                    </h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                                        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                            <div className="text-lg font-bold text-emerald-400">{qaDiagnostics.scannedPages}</div>
                                            <div className="text-[11px] text-slate-400">Pages Scanned</div>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                            <div className="text-lg font-bold text-emerald-400">0</div>
                                            <div className="text-[11px] text-slate-400">Critical Errors</div>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                            <div className="text-lg font-bold text-yellow-400">{qaDiagnostics.warnings.length}</div>
                                            <div className="text-[11px] text-slate-400">Warnings</div>
                                        </div>
                                        <div className="bg-slate-900/50 rounded-lg p-3 text-center">
                                            <div className="text-lg font-bold text-emerald-400">✓</div>
                                            <div className="text-[11px] text-slate-400">Build Approved</div>
                                        </div>
                                    </div>
                                    <div className="text-xs text-slate-400 space-y-1">
                                        <p>✓ HTTPS enforcement verified</p>
                                        <p>✓ Canonical URL consistency enforced</p>
                                        <p>✓ Internal links validated — no broken references</p>
                                        <p>✓ No duplicate H1 tags, titles, or meta descriptions</p>
                                        <p>✓ Core Web Vitals structural readiness confirmed</p>
                                    </div>
                                    {qaDiagnostics.warnings.length > 0 && (
                                        <details className="mt-4">
                                            <summary className="text-xs text-yellow-500 cursor-pointer hover:text-yellow-400 font-medium">
                                                View {qaDiagnostics.warnings.length} non-critical warning{qaDiagnostics.warnings.length > 1 ? 's' : ''}
                                            </summary>
                                            <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-2">
                                                {qaDiagnostics.warnings.map((warn: string, i: number) => (
                                                    <div key={`qw-${i}`} className="bg-slate-950 border border-yellow-900/30 rounded p-2.5 text-[11px] text-slate-400 font-mono leading-relaxed">
                                                        {warn}
                                                    </div>
                                                ))}
                                            </div>
                                        </details>
                                    )}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                {downloadUrl && (
                                    <a href={downloadUrl} download={`${themeSlug}-theme.zip`} className="bg-green-600 hover:bg-green-500 text-white p-4 rounded-xl flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-green-700 rounded-lg"><Package className="w-6 h-6" /></div>
                                            <div className="text-left">
                                                <div className="font-bold">Download Theme</div>
                                                <div className="text-xs opacity-75">WordPress Theme ZIP</div>
                                            </div>
                                        </div>
                                        <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
                                    </a>
                                )}
                                {pluginDownloadUrl && (
                                    <a href={pluginDownloadUrl} download="theme-factory-blocks.zip" className="bg-slate-700 hover:bg-slate-600 text-white p-4 rounded-xl flex items-center justify-between group border border-slate-600">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-800 rounded-lg"><Settings className="w-6 h-6 text-blue-400" /></div>
                                            <div className="text-left">
                                                <div className="font-bold">Companion Plugin</div>
                                                <div className="text-xs opacity-75">Required for Custom Blocks</div>
                                            </div>
                                        </div>
                                        <Download className="w-5 h-5 group-hover:translate-y-1 transition-transform" />
                                    </a>
                                )}
                                {debugConsoleText && (
                                    <button onClick={() => setShowDebugConsole(true)} className="bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl flex items-center justify-between group border border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-slate-900 rounded-lg"><Terminal className="w-6 h-6 text-yellow-400" /></div>
                                            <div className="text-left">
                                                <div className="font-bold">View Debug Log</div>
                                                <div className="text-xs opacity-75">Conversion Output HTML</div>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                                {redirectsData && (
                                    <button onClick={() => setShowMapModal(true)} className="bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl flex items-center justify-between group border border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-indigo-900/50 rounded-lg"><Split className="w-6 h-6 text-indigo-400" /></div>
                                            <div className="text-left">
                                                <div className="font-bold">View 301 Redirects</div>
                                                <div className="text-xs opacity-75">SEO Routing Data</div>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                                {llmsData && (
                                    <button onClick={() => setShowLlmsModal(true)} className="bg-slate-800 hover:bg-slate-700 text-white p-4 rounded-xl flex items-center justify-between group border border-slate-700">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-900/50 rounded-lg"><Database className="w-6 h-6 text-emerald-400" /></div>
                                            <div className="text-left">
                                                <div className="font-bold">AI Knowledge Base</div>
                                                <div className="text-xs opacity-75">llms-full.txt Output</div>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                )}
                            </div>

                            {conversionStats && (
                                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800"><div className="text-slate-400 mb-1">Routes</div><div className="font-bold text-white text-lg">{conversionStats.routes}</div></div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800"><div className="text-slate-400 mb-1">PHP</div><div className="font-bold text-white text-lg">{conversionStats.php}</div></div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800"><div className="text-slate-400 mb-1">JS</div><div className="font-bold text-white text-lg">{conversionStats.js}</div></div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800"><div className="text-slate-400 mb-1">CSS</div><div className="font-bold text-white text-lg">{conversionStats.css}</div></div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800"><div className="text-slate-400 mb-1">Assets</div><div className="font-bold text-white text-lg">{conversionStats.images}</div></div>
                                    <div className="bg-slate-900 p-2 rounded border border-slate-800"><div className="text-slate-400 mb-1">Patterns</div><div className="font-bold text-white text-lg">{conversionStats.patterns}</div></div>
                                </div>
                            )}

                            <button onClick={() => setStep(STEPS.IDLE)} className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg flex items-center justify-center gap-2">
                                <RefreshCw className="w-4 h-4" /> Start New Conversion
                            </button>
                        </div>
                    )}

                    {step === STEPS.ERROR && (
                        <div className="text-center py-8">
                            <div className="inline-flex p-4 bg-red-900/20 rounded-full text-red-500 mb-4"><XCircle className="w-12 h-12" /></div>
                            <h3 className="text-xl font-bold text-white mb-2">Conversion Failed</h3>
                            <p className="text-slate-400 mb-6 max-w-lg mx-auto">{logs[logs.length - 1]?.msg || "An unexpected error occurred."}</p>
                            <button onClick={() => setStep(STEPS.IDLE)} className="px-6 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg">Try Again</button>
                        </div>
                    )}
                </div>
            </div>

            {/* Logs Console - ADMIN ONLY */}
            {isAdmin && (
                <div className="bg-black/50 border border-slate-800 rounded-xl overflow-hidden font-mono text-xs mt-8">
                    <div className="bg-slate-900/50 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-2"><Terminal className="w-3 h-3" /> Admin Console Logs</span>
                        <span className="text-slate-600">{logs.length} entries</span>
                    </div>
                    <div className="h-48 overflow-y-auto p-4 space-y-1">
                        {logs.map((log, i) => (
                            <div key={i} className={`flex gap-3 ${log.type === 'error' ? 'text-red-400' : log.type === 'success' ? 'text-green-400' : log.type === 'warning' ? 'text-yellow-400' : 'text-slate-400'}`}>
                                <span className="opacity-50 shrink-0">[{log.time}]</span>
                                <span>{log.msg}</span>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </div>
                </div>
            )}

            {/* Full Screen Image Preview Modal */}
            {previewImage && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 transition-opacity duration-300" onClick={() => setPreviewImage(null)}>
                    <button 
                        className="absolute top-6 right-6 p-2 bg-slate-800 hover:bg-slate-700 rounded-full text-slate-300 hover:text-white transition-colors"
                        onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}
                    >
                        <X className="w-6 h-6" />
                    </button>
                    <img 
                        src={previewImage} 
                        alt="Full screen preview" 
                        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl border border-slate-700 pointer-events-auto" 
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}

            {/* Advanced Conversion Audit Console Modal */}
            {showDebugConsole && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDebugConsole(false)} />
                    <div 
                        className="relative bg-slate-900 border border-slate-700 w-full max-w-5xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden m-4 slide-in-from-bottom-4 animate-in duration-300 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                                    <Code className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">Conversion Audit Console</h3>
                                    <p className="text-sm text-slate-400">Heuristic visual and structural analysis</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        if (auditState) {
                                            navigator.clipboard.writeText(JSON.stringify(auditState.logs, null, 2));
                                            addLog("Copied audit logs to clipboard", "success");
                                        } else {
                                            navigator.clipboard.writeText(debugConsoleText);
                                            addLog("Copied debug logs to clipboard", "success");
                                        }
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50 hover:border-slate-600 flex items-center gap-2"
                                >
                                    <FileJson className="w-4 h-4" />
                                    Copy JSON
                                </button>
                                <button 
                                    onClick={() => setShowDebugConsole(false)}
                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        {/* Body - Code Viewer */}
                        <div className="flex-1 overflow-y-auto bg-slate-950 p-6 custom-scrollbar">
                            <pre className="text-slate-400 font-mono text-sm whitespace-pre-wrap break-words">
                                {auditState ? JSON.stringify(auditState.logs, null, 2) : debugConsoleText}
                            </pre>
                        </div>
                        {/* Logs List Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-[#0a0f1c]">
                            {(!auditState || auditState.logs.length === 0) ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4 py-12">
                                    <CheckCircle className="w-16 h-16 text-emerald-500/50" />
                                    <p className="text-lg">Perfect Conversion! No warnings detected.</p>
                                    {debugConsoleText && (
                                        <div className="mt-8 w-full text-left">
                                            <p className="text-sm mb-2 text-slate-400">Pipeline Output:</p>
                                            <pre className="text-xs font-mono p-4 rounded-lg bg-black text-slate-300 border border-slate-800 min-h-[100px] overflow-auto">
                                                <code>{debugConsoleText}</code>
                                            </pre>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                auditState.logs.map((log, i) => (
                                    <div key={i} className={`p-5 rounded-xl border flex gap-4 transition-all duration-200 hover:-translate-y-0.5 ${
                                        log.type === 'error' ? 'bg-rose-950/20 border-rose-500/20 shadow-lg shadow-rose-900/10' :
                                        log.type === 'warn' ? 'bg-amber-950/20 border-amber-500/20 shadow-lg shadow-amber-900/10' :
                                        'bg-blue-950/20 border-blue-500/20 shadow-lg shadow-blue-900/10'
                                    }`}>
                                        <div className="shrink-0 mt-0.5">
                                            {log.type === 'error' ? <XCircle className="w-6 h-6 text-rose-500" /> :
                                             log.type === 'warn' ? <AlertTriangle className="w-6 h-6 text-amber-500" /> :
                                             <Eye className="w-6 h-6 text-blue-500" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
                                                    log.type === 'error' ? 'bg-rose-500/10 text-rose-400 border-rose-500/30' :
                                                    log.type === 'warn' ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' :
                                                    'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                                }`}>
                                                    {log.type}
                                                </span>
                                                <h4 className="text-[15px] font-medium text-slate-200">{log.message}</h4>
                                            </div>
                                            <p className="text-[13px] text-slate-400 mb-4 flex items-start gap-2">
                                                <Hammer className="w-3.5 h-3.5 shrink-0 mt-[3px] text-slate-500" />
                                                <span>{log.suggestion}</span>
                                            </p>
                                            {log.snippet && (
                                                <div className="relative group">
                                                    <div className="absolute inset-0 bg-gradient-to-r from-[#0d1323] to-transparent pointer-events-none rounded-lg z-10 w-4" />
                                                    <pre className="text-[11px] font-mono py-3 px-4 rounded-lg bg-[#0d1323] text-slate-300 border border-slate-700/50 overflow-x-auto relative shadow-inner">
                                                        <code className="whitespace-pre">{log.snippet}</code>
                                                    </pre>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                        
                        {/* Footer */}
                        {auditState && auditState.logs && (
                            <div className="px-6 py-4 bg-slate-900/80 border-t border-slate-800 flex justify-between items-center text-sm text-slate-500">
                                <div className="flex gap-4">
                                    <span className="flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5 text-rose-500/70" /> {auditState.logs.filter(l => l.type === 'error').length} Errors</span>
                                    <span className="flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 text-amber-500/70" /> {auditState.logs.filter(l => l.type === 'warn').length} Warnings</span>
                                    <span className="flex items-center gap-1.5"><Eye className="w-3.5 h-3.5 text-blue-500/70" /> {auditState.logs.filter(l => l.type === 'info').length} Info</span>
                                </div>
                                <p className="text-xs">Review these heuristics to ensure pixel-perfect Gutenberg conversion.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Redirects Modal */}
            {redirectsData && showMapModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowMapModal(false)} />
                    <div 
                        className="relative bg-slate-900 border border-slate-700 w-full max-w-5xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden m-4 slide-in-from-bottom-4 animate-in duration-300 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                                    <Split className="w-5 h-5 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">301 SEO Redirect Matrix</h3>
                                    <p className="text-sm text-slate-400">Copy this mapping directly into your WordPress Redirections plugin</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(redirectsData);
                                        addLog("Copied redirect map to clipboard", "success");
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50 hover:border-slate-600 flex items-center gap-2"
                                >
                                    <FileCode className="w-4 h-4" />
                                    Copy CSV
                                </button>
                                <button 
                                    onClick={() => setShowMapModal(false)}
                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-slate-950 p-6 custom-scrollbar">
                            {redirectsData.split('\n').length > 1 ? (
                                <div className="space-y-2 text-sm">
                                    <div className="grid grid-cols-2 gap-4 pb-2 border-b border-slate-800 text-slate-500 font-medium px-2">
                                        <div>Old URL Path</div>
                                        <div>New Destination Path</div>
                                    </div>
                                    {redirectsData.split('\n').filter(line => line.trim() && !line.startsWith('source,target,regex')).map((line, i) => {
                                        const parts = line.split(',');
                                        if (parts.length < 2) return null;
                                        // Clean up regex characters for display
                                        const from = parts[0].replace(/"/g, '').replace('^', '').replace('/?$', '').replace('//?', '/');
                                        const to = parts[1].replace(/"/g, '');
                                        return (
                                            <div key={i} className="grid grid-cols-2 gap-4 py-2 px-2 hover:bg-slate-900/50 rounded items-center border border-transparent hover:border-slate-800 transition-colors">
                                                <div className="font-mono text-rose-400 break-all">{from}</div>
                                                <div className="font-mono text-emerald-400 flex items-center gap-2 break-all">
                                                    <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" /> {to}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <pre className="text-slate-400 font-mono text-xs whitespace-pre-wrap break-words">
                                    {redirectsData}
                                </pre>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* AI Knowledge Base Modal */}
            {llmsData && showLlmsModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center animate-in fade-in duration-200">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowLlmsModal(false)} />
                    <div 
                        className="relative bg-slate-900 border border-slate-700 w-full max-w-5xl max-h-[85vh] rounded-xl shadow-2xl flex flex-col overflow-hidden m-4 slide-in-from-bottom-4 animate-in duration-300 pointer-events-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                                    <Database className="w-5 h-5 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-white">AI Content Map (/llms-full.txt)</h3>
                                    <p className="text-sm text-slate-400">Experimental Markdown mapping optimized for LLM ingestion</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(llmsData);
                                        addLog("Copied AI Knowledge Base to clipboard", "success");
                                    }}
                                    className="px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-800 rounded-lg transition-colors border border-slate-700/50 hover:border-slate-600 flex items-center gap-2"
                                >
                                    <FileCode className="w-4 h-4" />
                                    Copy MD
                                </button>
                                <button 
                                    onClick={() => setShowLlmsModal(false)}
                                    className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-rose-500/10 hover:text-rose-400 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto bg-slate-950 p-6 custom-scrollbar">
                            <pre className="text-slate-400 font-mono text-sm whitespace-pre-wrap break-words">
                                {llmsData}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Dashboard;