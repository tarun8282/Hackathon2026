import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import {
    Map as MapIcon,
    PlusCircle,
    FileText,
    Bell,
    ShieldAlert,
    LogOut,
    Menu,
    ChevronRight,
    Search,
    Mic,
    ImagePlus,
    MapPin,
    Send,
    Loader2,
    CheckCircle2,
    Clock,
    AlertTriangle,
    X,
    User,
    Sparkles,
    ShieldCheck,
    ArrowRight,
    TrendingUp
} from 'lucide-react';
import { categorizeIssue } from '../services/geminiService';
import MapPicker from '../components/MapPicker';
import { MapContainer, TileLayer } from 'react-leaflet';
import HeatmapLayer from '../components/HeatmapLayer';
import 'leaflet/dist/leaflet.css';

export default function CitizenDashboard() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [complaintText, setComplaintText] = useState('');
    const [interimText, setInterimText] = useState('');
    const [aiResult, setAiResult] = useState(null);
    const [selectedLocation, setSelectedLocation] = useState(null);
    const [showMapModal, setShowMapModal] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [isListening, setIsListening] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [userComplaints, setUserComplaints] = useState([]);
    const [userStats, setUserStats] = useState({
        total: 0,
        inProgress: 0,
        resolved: 0,
        escalated: 0
    });
    const [allComplaints, setAllComplaints] = useState([]);
    const recognitionRef = useRef(null);
    const isListeningRef = useRef(false);

    const user = JSON.parse(localStorage.getItem('user_session'));

    useEffect(() => {
        fetchDepartments();
        if (user) {
            fetchData();
            fetchAllComplaints();
        }
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.stop();
            }
        };
    }, []);

    const fetchAllComplaints = async () => {
        console.log("Fetching all complaints for heatmap...");
        const { data, error } = await supabase
            .from('complaints')
            .select('location, category, priority');

        if (error) {
            console.error("Error fetching heatmap data:", error);
            return;
        }

        console.log(`Fetched ${data?.length || 0} complaints. Raw samples:`, data?.slice(0, 2));

        if (data) {
            const points = data.map(c => {
                let lat, lng;
                if (!c.location) return null;

                // Handle GeoJSON format
                if (typeof c.location === 'object' && c.location.coordinates) {
                    lng = c.location.coordinates[0];
                    lat = c.location.coordinates[1];
                }
                // Handle PostGIS string format "POINT(lng lat)"
                else if (typeof c.location === 'string') {
                    const match = c.location.match(/POINT\s*\(\s*([-\d.eE]+)\s+([-\d.eE]+)\s*\)/i);
                    if (match) {
                        lng = parseFloat(match[1]);
                        lat = parseFloat(match[2]);
                    } else if (c.location.startsWith('0101')) {
                        // Parse WKB (Hex) Point format
                        try {
                            const hex = c.location;
                            const isSRID = hex.substring(2, 10).toLowerCase() === '01000020';
                            const offset = isSRID ? 18 : 10;

                            const hexToFloat = (h) => {
                                // WKB is little-endian (01 prefix)
                                const bytes = new Uint8Array(h.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
                                const view = new DataView(bytes.buffer);
                                return view.getFloat64(0, true);
                            };

                            lng = hexToFloat(hex.substring(offset, offset + 16));
                            lat = hexToFloat(hex.substring(offset + 16, offset + 32));
                        } catch (e) {
                            console.error("Failed to parse WKB:", e);
                        }
                    }
                }

                if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
                    let intensity = 0.4; // Low priority -> Yellow
                    const p = c.priority?.toLowerCase();
                    if (p === 'medium') intensity = 0.6; // Medium -> Gold/Orange
                    if (p === 'high') intensity = 0.8; // High -> Orange/Red
                    if (p === 'emergency') intensity = 1.0; // Emergency -> Pure Red
                    return [lat, lng, intensity];
                }
                return null;
            }).filter(p => p !== null);

            console.log("Processed heatmap points:", points);
            setAllComplaints(points);
        }
    };

    const fetchData = async () => {
        const { data, error } = await supabase
            .from('complaints')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (!error) {
            setUserComplaints(data);

            // Calculate stats
            const stats = {
                total: data.length,
                inProgress: data.filter(c => c.status === 'in_progress' || c.status === 'assigned').length,
                resolved: data.filter(c => c.status === 'resolved' || c.status === 'closed').length,
                escalated: data.filter(c => c.escalation_level > 0).length
            };
            setUserStats(stats);
        }
    };

    const fetchDepartments = async () => {
        const { data, error } = await supabase.from('departments').select('*');
        if (!error) setDepartments(data);
    };

    const handleLogout = () => {
        localStorage.removeItem('user_session');
        window.location.reload();
    };

    const toggleListening = () => {
        console.log("Toggle listening triggered. Current state:", isListening);

        if (isListening) {
            console.log("Stopping recognition manually...");
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                } catch (err) {
                    console.error("Error stopping recognition:", err);
                }
            }
            setIsListening(false);
            setInterimText('');
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error("SpeechRecognition not found in window or window.webkit");
            alert("Speech recognition is not supported in this browser. Please use a modern version of Chrome.");
            return;
        }

        try {
            console.log("Initializing new SpeechRecognition instance...");
            const recognition = new SpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-US';
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                console.log("Recognition.onstart fired");
                setIsListening(true);
            };

            recognition.onend = () => {
                console.log("Recognition.onend fired. isListening was:", isListening);
                setIsListening(false);
                isListeningRef.current = false;
                setInterimText('');
                recognitionRef.current = null;
            };

            recognition.onerror = (event) => {
                console.error("Recognition.onerror fired:", event.error, event.message);
                setIsListening(false);
                setInterimText('');

                if (event.error === 'not-allowed') {
                    alert("Microphone permission denied. Please click the lock icon in the address bar and enable the microphone.");
                } else if (event.error === 'network') {
                    alert("Speech Network Error: The browser's speech service is currently unreachable. This often happens on slow connections or if the service is blocked. Please try manual typing or check your internet connection.");
                } else if (event.error === 'no-speech') {
                    console.warn("No speech detected - closing automatically.");
                } else {
                    alert(`Voice Error: ${event.error}. Please try again or type manually.`);
                }
            };

            recognition.onresult = (event) => {
                console.log("Recognition.onresult fired. Results length:", event.results.length);
                let interim = '';
                for (let i = event.resultIndex; i < event.results.length; ++i) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        console.log("Final transcript segment:", transcript);
                        setComplaintText(prev => prev + (prev.trim() ? ' ' : '') + transcript);
                    } else {
                        interim += transcript;
                    }
                }
                setInterimText(interim);
            };

            // Diagnostic Events
            recognition.onaudiostart = () => console.log("Audio capturing started");
            recognition.onsoundstart = () => console.log("Sound detected");
            recognition.onspeechstart = () => console.log("Speech detected");

            recognitionRef.current = recognition;
            recognition.start();
            console.log("recognition.start() called successfully");
        } catch (error) {
            console.error("Failed to start SpeechRecognition:", error);
            setIsListening(false);
            alert("Could not start voice recognition. Please ensure your microphone is connected and try again.");
        }
    };

    const handleAnalyze = async () => {
        if (!complaintText.trim()) return;
        setIsAnalyzing(true);
        // Simulate delay for effect
        await new Promise(r => setTimeout(r, 1500));

        try {
            const result = await categorizeIssue(complaintText);
            setAiResult(result);
        } catch (error) {
            console.error("Analysis failed", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleFileComplaint = async () => {
        if (!selectedLocation || !aiResult || !complaintText) {
            alert("Please provide all details including location.");
            return;
        }

        setIsSubmitting(true);
        try {
            // Find department ID
            const dept = departments.find(d =>
                d.name.toLowerCase().includes(aiResult.department.toLowerCase()) ||
                aiResult.department.toLowerCase().includes(d.name.toLowerCase())
            );

            const { data: complaint, error: compError } = await supabase
                .from('complaints')
                .insert([{
                    user_id: user.id,
                    department_id: dept?.id,
                    title: aiResult.formatted_title || "New Complaint",
                    description: complaintText,
                    category: aiResult.category,
                    status: 'open',
                    priority: aiResult.priority.toLowerCase(),
                    location: `POINT(${selectedLocation.lng} ${selectedLocation.lat})`,
                    sla_deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48h default
                }])
                .select()
                .single();

            if (compError) throw compError;

            // Log history
            await supabase.from('complaint_history').insert([{
                complaint_id: complaint.id,
                status_to: 'open',
                comment: 'Complaint filed by citizen via AI portal',
                actor_id: user.id
            }]);

            setIsSuccess(true);
            fetchData(); // Refresh personal stats
            fetchAllComplaints(); // Refresh global heatmap
            setTimeout(() => {
                setIsSuccess(false);
                setAiResult(null);
                setComplaintText('');
                setSelectedLocation(null);
                setActiveTab('history');
            }, 2000);

        } catch (error) {
            console.error("Submission failed", error);
            alert("Failed to submit complaint. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <FileText size={20} /> },
        { id: 'raise', label: 'Raise Complaint', icon: <PlusCircle size={20} /> },
        { id: 'map', label: 'City Map', icon: <MapIcon size={20} /> },
        { id: 'history', label: 'My Complaints', icon: <Clock size={20} /> },
    ];

    const statsData = [
        { label: 'Total Reports', value: userStats.total, color: 'from-blue-500 to-blue-600', icon: FileText },
        { label: 'In Progress', value: userStats.inProgress, color: 'from-amber-500 to-amber-600', icon: Clock },
        { label: 'Resolved', value: userStats.resolved, color: 'from-green-500 to-green-600', icon: CheckCircle2 },
        { label: 'Escalated', value: userStats.escalated, color: 'from-purple-500 to-purple-600', icon: AlertTriangle },
    ];

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-800 selection:bg-primary-100 selection:text-primary-900">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-white/90 backdrop-blur-xl border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
            `}>
                <div className="h-full flex flex-col">
                    <div className="p-8 pb-4">
                        <div className="flex items-center gap-3 text-primary-700 mb-8">
                            <div className="p-2.5 bg-gradient-to-br from-primary-50 to-primary-100 rounded-xl shadow-sm border border-primary-200/50">
                                <ShieldAlert size={28} className="fill-current" />
                            </div>
                            <div>
                                <h1 className="text-xl font-heading font-bold leading-none tracking-tight">SmartResolve</h1>
                                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">CITIZEN PORTAL</span>
                            </div>
                        </div>

                        <div className="px-5 py-4 bg-primary-50/50 rounded-2xl border border-primary-100 mb-6 relative overflow-hidden group">
                            <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary-100/50 rounded-full blur-xl group-hover:scale-150 transition-transform duration-700"></div>
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 relative z-10">Welcome back,</p>
                            <p className="font-heading font-black text-xl text-primary-700 relative z-10">{user?.full_name || 'Citizen'}</p>
                        </div>
                    </div>

                    <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    setIsSidebarOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-300 group relative overflow-hidden ${activeTab === item.id
                                    ? 'bg-primary-50 text-primary-700 font-bold shadow-sm ring-1 ring-primary-100'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700 font-medium'
                                    }`}
                            >
                                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-primary-600 rounded-r-full transition-transform duration-300 ${activeTab === item.id ? 'scale-y-100' : 'scale-y-0'}`}></div>
                                <div className="flex items-center gap-3 relative z-10">
                                    <span className={`transition-colors duration-300 ${activeTab === item.id ? 'text-primary-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                                        {item.icon}
                                    </span>
                                    {item.label}
                                </div>
                                {activeTab === item.id && <ChevronRight size={16} className="text-primary-500" />}
                            </button>
                        ))}
                    </nav>

                    <div className="p-4 mt-auto border-t border-slate-100">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all duration-200 font-medium group"
                        >
                            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-400 group-hover:bg-red-100 group-hover:text-red-500 transition-colors">
                                <LogOut size={16} />
                            </div>
                            Sign Out
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 relative">
                <div className="absolute inset-0 bg-hero-pattern opacity-100 pointer-events-none"></div>

                {/* Header */}
                <header className="h-20 flex items-center justify-between px-6 lg:px-10 bg-white/70 backdrop-blur-xl border-b border-white/50 sticky top-0 z-30 shadow-sm relative">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl lg:hidden transition-colors"
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className="text-xl font-heading font-extrabold text-slate-800 tracking-tight">
                            {navItems.find(i => i.id === activeTab)?.label}
                        </h2>
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-all relative group">
                            <Bell size={20} className="group-hover:animate-swing" />
                            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white ring-2 ring-red-500/20 animate-pulse"></span>
                        </button>
                        <div className="w-10 h-10 rounded-full ring-2 ring-white shadow-lg overflow-hidden cursor-pointer hover:ring-primary-200 transition-all">
                            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&backgroundColor=c0aede" alt="Profile" className="w-full h-full object-cover" />
                        </div>
                    </div>
                </header>

                {/* Dashboard Viewport */}
                <div className="flex-1 overflow-y-auto p-6 lg:p-10 scroll-smooth relative z-10">
                    <div className="max-w-6xl mx-auto space-y-8">

                        {activeTab === 'dashboard' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-6">
                                    {statsData.map((stat, i) => (
                                        <div key={i} className="bg-white/60 backdrop-blur-md p-6 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-white/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all group hover:-translate-y-1 duration-300">
                                            <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.color} mb-4 flex items-center justify-center text-white shadow-lg shadow-gray-200 group-hover:scale-110 transition-transform duration-300`}>
                                                <stat.icon size={20} />
                                            </div>
                                            <span className="block text-3xl font-heading font-bold text-slate-800 mb-1">{stat.value}</span>
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</span>
                                        </div>
                                    ))}
                                </div>

                                {/* CTA Section - Enhanced Vibrancy */}
                                <div className="bg-gradient-to-r from-[#1e40af] to-[#3b82f6] rounded-[2rem] p-8 md:p-12 text-white shadow-2xl shadow-blue-900/20 relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-white/5 rounded-full blur-3xl transform translate-x-1/3 -translate-y-1/3 group-hover:scale-110 transition-transform duration-1000"></div>
                                    <div className="absolute bottom-0 left-0 w-64 h-64 bg-black/10 rounded-full blur-2xl transform -translate-x-1/2 translate-y-1/2"></div>

                                    <div className="relative z-10 max-w-lg">
                                        <div className="px-3 py-1 bg-blue-500/30 border border-blue-400/30 rounded-full w-fit text-xs font-bold uppercase tracking-wider mb-4 backdrop-blur-sm">
                                            AI-Powered Civic Assistant
                                        </div>
                                        <h3 className="text-3xl md:text-4xl font-heading font-bold mb-4 text-glow leading-tight">Spot an issue in <br />your neighborhood?</h3>
                                        <p className="text-blue-100 mb-8 leading-relaxed font-medium text-lg opacity-90">
                                            Report potholes, garbage, or street light issues instantly. Our AI will analyze and route it to the right department.
                                        </p>
                                        <button
                                            onClick={() => setActiveTab('raise')}
                                            className="px-8 py-4 bg-white text-blue-700 rounded-xl font-bold text-lg hover:bg-blue-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)] hover:shadow-[0_0_30px_rgba(255,255,255,0.5)] flex items-center gap-2 transform active:scale-95"
                                        >
                                            <PlusCircle size={22} />
                                            Raise New Complaint
                                        </button>
                                    </div>
                                </div>

                                {/* Recent Activity - Glassmorphism */}
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <h3 className="text-xl font-heading font-extrabold text-slate-800">Recent Activity</h3>
                                        <button onClick={() => setActiveTab('history')} className="text-sm font-bold text-primary-600 hover:text-primary-700 hover:underline decoration-2 underline-offset-4">View All</button>
                                    </div>
                                    <div className="space-y-4">
                                        {userComplaints.slice(0, 3).map((item, i) => (
                                            <div key={i} className="bg-white/80 p-5 rounded-2xl border border-white/50 shadow-sm hover:shadow-md hover:border-primary-100 transition-all cursor-pointer group flex items-center justify-between">
                                                <div className="flex items-center gap-5">
                                                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-primary-50 group-hover:text-primary-600 transition-colors border border-slate-100">
                                                        <FileText size={24} />
                                                    </div>
                                                    <div>
                                                        <h4 className="font-bold text-slate-800 text-lg group-hover:text-primary-600 transition-colors">{item.title}</h4>
                                                        <p className="text-sm text-slate-500 font-medium mt-1">{item.category} • {new Date(item.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <span className={`px-4 py-1.5 text-xs font-bold rounded-full border shadow-sm ${item.status === 'resolved'
                                                    ? 'bg-green-50 text-green-700 border-green-100'
                                                    : item.status === 'open'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-100'
                                                        : 'bg-amber-50 text-amber-700 border-amber-100'
                                                    }`}>
                                                    {item.status.charAt(0).toUpperCase() + item.status.slice(1).replace('_', ' ')}
                                                </span>
                                            </div>
                                        ))}
                                        {userComplaints.length === 0 && (
                                            <div className="p-10 text-center bg-white/50 rounded-2xl border-2 border-dashed border-slate-200">
                                                <p className="text-slate-500 font-medium">No recent reports found. Help improve your city by reporting an issue!</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'raise' && (
                            <div className="max-w-4xl mx-auto animate-in slide-in-from-right-8 duration-700">
                                <div className="bg-white/80 backdrop-blur-xl rounded-4xl p-6 md:p-10 shadow-xl border border-white/50 relative overflow-hidden">
                                    <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-primary-400 via-purple-500 to-primary-600"></div>

                                    <div className="flex items-center gap-4 mb-8 text-slate-800">
                                        <div className="p-3 bg-primary-50 text-primary-600 rounded-2xl shadow-sm border border-primary-100">
                                            <Mic size={28} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-heading font-extrabold tracking-tight">Describe the Issue</h3>
                                            <p className="text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
                                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                AI Categorization Active
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex justify-between items-center mb-2">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Speak naturally • High-Fidelity Audio Logic</p>
                                    </div>
                                    <div className="relative mb-8 group">
                                        <div className="relative">
                                            <textarea
                                                value={complaintText + (interimText ? (complaintText ? ' ' : '') + interimText : '')}
                                                onChange={(e) => {
                                                    setComplaintText(e.target.value);
                                                    setInterimText(''); // Stop showing interim if user manually types
                                                }}
                                                placeholder="E.g., Large pothole at the intersection of Main St and Oak Ave..."
                                                className="w-full h-64 p-8 bg-white rounded-4xl border-2 border-slate-100 focus:border-primary-500 transition-all resize-none text-slate-700 placeholder:text-slate-400 font-medium text-xl leading-relaxed shadow-2xl"
                                            />

                                            {isRefining && (
                                                <div className="absolute top-6 right-6 flex items-center gap-3 bg-primary-600 text-white px-4 py-2 rounded-full shadow-lg animate-bounce z-30">
                                                    <Loader2 size={16} className="animate-spin" />
                                                    <span className="text-xs font-black uppercase tracking-widest">AI Perfecting...</span>
                                                </div>
                                            )}

                                            <button
                                                onClick={toggleListening}
                                                className={`absolute bottom-6 right-6 p-5 rounded-2xl shadow-2xl transition-all hover:scale-110 active:scale-95 z-40 ${isListening
                                                    ? 'bg-red-500 text-white ring-8 ring-red-100 animate-pulse'
                                                    : 'bg-primary-600 text-white hover:bg-primary-700'
                                                    }`}
                                            >
                                                <Mic size={28} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
                                        <div className="p-6 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col items-center justify-center text-slate-400 gap-3 hover:border-primary-400 hover:bg-primary-50/50 transition-all cursor-pointer h-40 group bg-slate-50/50">
                                            <div className="p-3 bg-white rounded-full shadow-sm group-hover:scale-110 transition-transform">
                                                <ImagePlus size={24} className="text-slate-500 group-hover:text-primary-500" />
                                            </div>
                                            <span className="text-sm font-bold group-hover:text-primary-600">Upload Photo Evidence</span>
                                        </div>
                                        <button
                                            onClick={() => setShowMapModal(true)}
                                            className="p-6 bg-white border border-slate-200 rounded-2xl flex flex-col items-center justify-center text-slate-500 gap-3 hover:border-primary-400 hover:text-primary-600 hover:shadow-lg hover:shadow-primary-50 transition-all h-40 group relative overflow-hidden"
                                        >
                                            <div className="absolute inset-0 bg-gradient-to-br from-primary-50/0 to-primary-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                            <div className={`p-3 rounded-full shadow-sm z-10 transition-colors ${selectedLocation ? 'bg-primary-600 text-white' : 'bg-slate-50 group-hover:bg-white'}`}>
                                                <MapPin size={24} />
                                            </div>
                                            <span className="text-sm font-bold z-10">
                                                {selectedLocation
                                                    ? `${selectedLocation.lat.toFixed(4)}, ${selectedLocation.lng.toFixed(4)}`
                                                    : "Select Location on Map"
                                                }
                                            </span>
                                            {selectedLocation && (
                                                <div className="absolute top-3 right-3 bg-green-500 text-white p-1 rounded-full animate-in zoom-in">
                                                    <CheckCircle2 size={12} />
                                                </div>
                                            )}
                                        </button>
                                    </div>

                                    {!aiResult ? (
                                        <button
                                            onClick={handleAnalyze}
                                            disabled={isAnalyzing || !complaintText}
                                            className="w-full py-5 bg-gradient-to-r from-primary-600 to-primary-700 text-white rounded-2xl font-bold text-xl hover:from-primary-700 hover:to-primary-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xl shadow-primary-200 hover:shadow-2xl hover:shadow-primary-300 active:scale-[0.98] flex items-center justify-center gap-3"
                                        >
                                            {isAnalyzing ? (
                                                <>
                                                    <Loader2 size={24} className="animate-spin" />
                                                    Processing Intelligence...
                                                </>
                                            ) : (
                                                <>
                                                    <Send size={22} />
                                                    Submit Complaint
                                                </>
                                            )}
                                        </button>
                                    ) : (
                                        <div className="bg-gradient-to-br from-white to-slate-50 rounded-2xl p-8 animate-in fade-in zoom-in-95 duration-500 border border-slate-200 shadow-xl relative overflow-hidden">
                                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                                <CheckCircle2 size={120} />
                                            </div>
                                            <div className="flex items-center justify-between mb-6 relative z-10">
                                                <h4 className="font-heading font-extrabold text-2xl text-slate-800 flex items-center gap-3">
                                                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-green-600">
                                                        <CheckCircle2 size={20} />
                                                    </span>
                                                    AI Analysis Complete
                                                </h4>
                                                <button onClick={() => setAiResult(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
                                            </div>

                                            <div className="grid gap-4 relative z-10">
                                                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Category</span>
                                                    <span className="text-sm font-bold text-primary-700 bg-primary-50 px-4 py-1.5 rounded-full border border-primary-100">{aiResult.category || "Infrastructure"}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Department</span>
                                                    <span className="text-sm font-bold text-slate-800">{aiResult.department || "Public Works"}</span>
                                                </div>
                                                <div className="flex items-center justify-between p-4 bg-white rounded-xl border border-slate-100 shadow-sm">
                                                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Priority</span>
                                                    <span className={`text-sm font-bold px-4 py-1.5 rounded-full border ${aiResult.priority === 'High'
                                                        ? 'bg-red-50 text-red-700 border-red-100'
                                                        : 'bg-amber-50 text-amber-700 border-amber-100'
                                                        }`}>
                                                        {aiResult.priority || "Medium"}
                                                    </span>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleFileComplaint}
                                                disabled={isSubmitting || isSuccess}
                                                className={`w-full mt-8 py-5 text-white rounded-2xl font-bold text-xl transition-all shadow-xl flex items-center justify-center gap-3 transform active:scale-[0.98] ${isSuccess ? 'bg-green-600 shadow-green-200' : 'bg-green-600 hover:bg-green-700 shadow-green-200 hover:shadow-green-300'
                                                    }`}
                                            >
                                                {isSubmitting ? (
                                                    <>
                                                        <Loader2 size={24} className="animate-spin" />
                                                        Recording Report...
                                                    </>
                                                ) : isSuccess ? (
                                                    <>
                                                        <CheckCircle2 size={24} />
                                                        Successfully Filed!
                                                    </>
                                                ) : (
                                                    <>
                                                        <CheckCircle2 size={24} />
                                                        Confirm & File Report
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}

                        {activeTab === 'map' && (
                            <div className="h-[730px] bg-white rounded-[2.5rem] border border-slate-200 p-3 shadow-2xl flex flex-col animate-in zoom-in-95 duration-700 relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-full h-1.5 bg-linear-to-r from-blue-400 via-indigo-500 to-purple-600 z-20"></div>

                                <div className="p-4 flex items-center justify-between border-b border-slate-100 mb-2">
                                    <div className="flex items-center gap-4 overflow-x-auto pb-1 scrollbar-hide">
                                        <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 rounded-full border border-slate-200">
                                            <Filter size={16} className="text-slate-500" />
                                            <span className="text-xs font-bold text-slate-500 uppercase tracking-tight">Geo-Filters</span>
                                        </div>
                                        <select className="px-5 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-bold text-slate-700 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-100 transition-all shadow-sm cursor-pointer hover:border-slate-300">
                                            <option>All Incidents</option>
                                            <option>High Priority Only</option>
                                        </select>
                                    </div>
                                    <div className="flex items-center gap-3 bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100">
                                        <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                                        <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Live Heatmap Active</span>
                                    </div>
                                </div>

                                <div className="flex-1 rounded-3xl relative overflow-hidden border border-slate-100 shadow-inner z-10">
                                    <MapContainer
                                        center={allComplaints.length > 0 ? [allComplaints[0][0], allComplaints[0][1]] : [12.9716, 77.5946]}
                                        zoom={allComplaints.length > 0 ? 15 : 13}
                                        style={{ height: '100%', width: '100%' }}
                                        className="opacity-100"
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                                        />
                                        <HeatmapLayer points={allComplaints} />
                                    </MapContainer>

                                    {/* Floating Overlay Info */}
                                    <div className="absolute bottom-6 left-6 z-1000 bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-2xl border border-white/60 max-w-xs transition-transform hover:scale-105 duration-500">
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200 rotate-3">
                                                <TrendingUp size={20} />
                                            </div>
                                            <h4 className="font-heading font-bold text-slate-800 tracking-tight">Density Analysis</h4>
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                                            The heatmap reveals areas with high incident frequency. Red zones indicate urgent focus areas for municipal teams.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'history' && (
                            <div className="space-y-6 animate-in slide-in-from-bottom-8 duration-700">
                                <h2 className="text-2xl font-heading font-extrabold text-slate-800 px-2">My Reports</h2>
                                {userComplaints.map((item, i) => (
                                    <div key={item.id} className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 hover:shadow-lg hover:border-primary-200 transition-all group cursor-pointer relative overflow-hidden">
                                        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-linear-to-b from-primary-400 to-primary-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                        <div className="flex items-start justify-between mb-5">
                                            <div className="flex gap-5">
                                                <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0 border border-blue-100 group-hover:scale-110 transition-transform">
                                                    {item.status === 'resolved' ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
                                                </div>
                                                <div>
                                                    <h4 className="font-heading font-bold text-slate-800 text-xl group-hover:text-primary-700 transition-colors">{item.title}</h4>
                                                    <p className="text-sm text-slate-500 font-bold mt-1 uppercase tracking-wide opacity-70">{item.category} • {new Date(item.created_at).toLocaleDateString()}</p>
                                                </div>
                                            </div>
                                            <span className={`px-4 py-1.5 text-xs font-black uppercase tracking-widest shadow-sm rounded-full border ${item.status === 'resolved'
                                                ? 'bg-green-100 text-green-700 border-green-200'
                                                : item.status === 'open'
                                                    ? 'bg-blue-100 text-blue-700 border-blue-200'
                                                    : 'bg-amber-100 text-amber-700 border-amber-200'
                                                }`}>
                                                {item.status.replace('_', ' ')}
                                            </span>
                                        </div>
                                        <div className="pl-20">
                                            <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-600 font-medium leading-relaxed mb-5 italic">
                                                "{item.description}"
                                            </div>
                                            <div className="flex items-center gap-8 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                                <span className={`flex items-center gap-2 px-3 py-1 rounded-lg ${new Date(item.sla_deadline) > new Date() || item.status === 'resolved' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                                    <Clock size={14} /> SLA: {new Date(item.sla_deadline) > new Date() || item.status === 'resolved' ? 'Active' : 'Breached'}
                                                </span>
                                                <span className="flex items-center gap-2 text-primary-600 cursor-pointer hover:underline decoration-2 underline-offset-4 transition-all">View Details <ChevronRight size={14} /></span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                                {userComplaints.length === 0 && (
                                    <div className="text-center py-20 bg-white/50 rounded-[2.5rem] border-2 border-dashed border-slate-200">
                                        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                                            <FileText size={40} />
                                        </div>
                                        <h3 className="text-xl font-heading font-bold text-slate-400">No complaints filed yet</h3>
                                        <p className="text-slate-400 mt-2">Your complaint history will appear here.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Map Modal */}
                {showMapModal && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 md:p-8">
                        <div
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
                            onClick={() => setShowMapModal(false)}
                        />
                        <div className="relative w-full max-w-4xl h-[80vh] z-10">
                            <MapPicker
                                initialLocation={selectedLocation}
                                onLocationSelect={setSelectedLocation}
                                onClose={() => setShowMapModal(false)}
                            />
                        </div>
                    </div>
                )}
            </main>

            {/* Success Overlay - Premium Celebration */}
            {isSuccess && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-6 bg-primary-900/20 backdrop-blur-xl animate-in fade-in duration-500">
                    <div className="bg-white rounded-[3rem] p-12 text-center shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] border border-white max-w-sm w-full animate-in zoom-in-95 duration-500 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-linear-to-r from-green-400 to-blue-500"></div>
                        <div className="w-24 h-24 bg-green-100 text-green-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl shadow-green-100 rotate-3">
                            <ShieldCheck size={48} />
                        </div>
                        <h2 className="text-3xl font-heading font-black text-slate-800 mb-4 tracking-tight">Report Secured!</h2>
                        <p className="text-slate-500 font-medium leading-relaxed mb-8 text-lg">Your civic duty is complete. Our AI teams are now routing this to the <span className="text-primary-600 font-bold">{aiResult?.department}</span> department.</p>
                        <div className="flex items-center justify-center gap-2 text-primary-600 font-bold uppercase tracking-widest text-xs">
                            Syncing with history <ArrowRight size={14} className="animate-bounce-x" />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Icon helper
function Filter({ size, className }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
    )
}
