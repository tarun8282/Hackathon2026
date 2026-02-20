import React, { useState } from 'react';
import {
    Map as MapIcon,
    PlusCircle,
    FileText,
    Settings,
    Bell,
    User,
    ShieldAlert,
    LogOut
} from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CitizenDashboard() {
    const [activeTab, setActiveTab] = useState('new');

    const handleLogout = () => {
        localStorage.removeItem('user_session');
        window.location.reload();
    };

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-slate-200 flex flex-col shadow-sm">
                <div className="p-6">
                    <h1 className="text-2xl font-bold text-primary-600 flex items-center gap-2">
                        <ShieldAlert size={28} />
                        CitizenCare
                    </h1>
                </div>

                <nav className="flex-1 px-4 space-y-2">
                    <button
                        onClick={() => setActiveTab('new')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'new' ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <PlusCircle size={20} /> New Complaint
                    </button>
                    <button
                        onClick={() => setActiveTab('my')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'my' ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <FileText size={20} /> My Complaints
                    </button>
                    <button
                        onClick={() => setActiveTab('map')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${activeTab === 'map' ? 'bg-primary-50 text-primary-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                            }`}
                    >
                        <MapIcon size={20} /> Local Issues Map
                    </button>
                </nav>

                <div className="p-4 border-t border-slate-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all text-sm font-medium"
                    >
                        <LogOut size={20} /> Sign Out
                    </button>
                </div>
            </aside>

            <main className="flex-1 flex flex-col overflow-hidden">
                <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8">
                    <h2 className="text-xl font-bold text-slate-800">
                        {activeTab === 'new' ? 'File an Issue' : activeTab === 'my' ? 'My History' : 'Geographic Intelligence'}
                    </h2>
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold border-2 border-primary-200">
                            C
                        </div>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-8">
                    <div className="max-w-4xl mx-auto">
                        {activeTab === 'new' && (
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
                                <h3 className="text-lg font-bold mb-6">Describe the civic issue</h3>
                                <textarea
                                    className="w-full p-4 h-32 rounded-xl border border-slate-300 focus:ring-2 focus:ring-primary-500 outline-none mb-4"
                                    placeholder="e.g. Broken streetlight near Main Street park..."
                                />
                                <button className="w-full bg-primary-600 text-white py-3 rounded-xl font-bold hover:bg-primary-700 transition-colors">
                                    Submit with AI Analysis
                                </button>
                            </div>
                        )}
                        {activeTab === 'my' && <div className="text-center text-slate-400 mt-20">You haven't filed any complaints yet.</div>}
                        {activeTab === 'map' && <div className="h-[500px] bg-slate-200 rounded-2xl flex items-center justify-center text-slate-500 border-2 border-dashed border-slate-300 italic">Leaflet Map Placeholder</div>}
                    </div>
                </div>
            </main>
        </div>
    );
}
