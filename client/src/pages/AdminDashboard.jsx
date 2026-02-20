import React, { useState } from 'react';
import {
    LayoutDashboard,
    Map as MapIcon,
    Users,
    AlertTriangle,
    FileSpreadsheet,
    Settings,
    ShieldAlert,
    LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('overview');

    const handleLogout = () => {
        localStorage.removeItem('user_session');
        window.location.reload();
    };

    return (
        <div className="flex h-screen bg-slate-900 overflow-hidden text-slate-100">
            {/* Sidebar - Dark Professional */}
            <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col">
                <div className="p-6">
                    <h1 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                        <ShieldAlert size={28} className="text-primary-500" />
                        ADMIN <span className="text-primary-500">RESOLVE</span>
                    </h1>
                </div>

                <nav className="flex-1 px-4 space-y-1">
                    <AdminNavItem
                        icon={<LayoutDashboard size={20} />}
                        label="Live Analytics"
                        active={activeTab === 'overview'}
                        onClick={() => setActiveTab('overview')}
                    />
                    <AdminNavItem
                        icon={<AlertTriangle size={20} />}
                        label="Escalations"
                        active={activeTab === 'escalations'}
                        onClick={() => setActiveTab('escalations')}
                    />
                    <AdminNavItem
                        icon={<MapIcon size={20} />}
                        label="City Heatmap"
                        active={activeTab === 'map'}
                        onClick={() => setActiveTab('map')}
                    />
                    <AdminNavItem
                        icon={<FileSpreadsheet size={20} />}
                        label="Reports"
                        active={activeTab === 'reports'}
                        onClick={() => setActiveTab('reports')}
                    />
                </nav>

                <div className="p-4 border-t border-slate-800">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-400 hover:text-white hover:bg-slate-900 rounded-lg transition-all text-sm font-medium"
                    >
                        <LogOut size={20} /> Logout
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden bg-slate-900">
                <header className="h-16 border-b border-slate-800 flex items-center justify-between px-8 bg-slate-900/50 backdrop-blur-md">
                    <h2 className="text-xl font-bold uppercase tracking-wider text-slate-400">{activeTab}</h2>
                    <div className="flex items-center gap-6">
                        <div className="text-right">
                            <p className="text-xs text-slate-500">Municipal Authority</p>
                            <p className="text-sm font-bold text-white">Office of Commissioner</p>
                        </div>
                        <div className="w-10 h-10 rounded-lg bg-primary-600 flex items-center justify-center text-white shadow-lg shadow-primary-900/20">
                            <ShieldAlert size={20} />
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-7xl mx-auto space-y-8">
                        {activeTab === 'overview' && (
                            <>
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                    <StatCard label="Critical Issues" value="12" color="bg-red-500/10 text-red-500" />
                                    <StatCard label="Open Tickets" value="142" color="bg-orange-500/10 text-orange-500" />
                                    <StatCard label="Resolved Today" value="38" color="bg-green-500/10 text-green-500" />
                                    <StatCard label="Avg Response" value="2.4h" color="bg-blue-500/10 text-blue-500" />
                                </div>
                                <div className="h-96 bg-slate-950/50 rounded-2xl border border-slate-800 flex items-center justify-center text-slate-600 italic">
                                    Advanced Visualization Placeholder (Heatmap + Cluster Map)
                                </div>
                            </>
                        )}
                        {activeTab === 'escalations' && <div className="text-slate-500 text-center py-20">No active escalations for this ward.</div>}
                        {activeTab === 'map' && <div className="h-[600px] bg-slate-950 rounded-2xl border border-slate-800"></div>}
                    </div>
                </div>
            </main>
        </div>
    );
}

const AdminNavItem = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${active
            ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/40'
            : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
            }`}
    >
        {icon}
        {label}
    </button>
);

const StatCard = ({ label, value, color }) => (
    <div className="bg-slate-950/40 p-6 rounded-2xl border border-slate-800 hover:border-slate-700 transition-colors">
        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">{label}</p>
        <p className={`text-3xl font-black ${color.split(' ')[1]}`}>{value}</p>
        <div className={`h-1 w-full rounded-full mt-4 ${color.split(' ')[0]} opacity-20`}></div>
    </div>
);
