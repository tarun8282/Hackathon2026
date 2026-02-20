import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
    LayoutDashboard,
    ListFilter,
    Users,
    AlertTriangle,
    FileBarChart,
    Settings,
    ShieldAlert,
    LogOut,
    Menu,
    Search,
    TrendingUp,
    Clock,
    CheckCircle2,
    MoreVertical,
    Filter,
    Download,
    Bell,
    Mic,
    MicOff,
    Loader2,
    X,
    MapPin,
    User,
    Mail,
    Calendar,
    ExternalLink,
    Camera
} from 'lucide-react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Register ChartJS
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

export default function AdminDashboard() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [complaints, setComplaints] = useState([]);
    const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, breaches: 0 });
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedComplaint, setSelectedComplaint] = useState(null);
    const user = JSON.parse(localStorage.getItem('user_session'));

    useEffect(() => {
        fetchAllData();
    }, []);

    const fetchAllData = async () => {
        setLoading(true);
        try {
            // Fetch Complaints with user and dept info
            const { data: complaintsData, error: compError } = await supabase
                .from('complaints')
                .select(`
            *,
            citizen:users!complaints_user_id_fkey(full_name, email),
            department:departments(name),
            attachments:media_attachments(*)
        `)
                .order('created_at', { ascending: false });

            if (compError) throw compError;
            setComplaints(complaintsData || []);

            // Calculate basic stats
            const total = complaintsData?.length || 0;
            const open = complaintsData?.filter(c => c.status === 'open' || c.status === 'assigned' || c.status === 'in_progress').length || 0;
            const resolved = complaintsData?.filter(c => c.status === 'resolved' || c.status === 'closed').length || 0;
            const breaches = complaintsData?.filter(c => new Date(c.sla_deadline) < new Date() && c.status !== 'resolved').length || 0;

            setStats({ total, open, resolved, breaches });

            // Fetch Staff
            const { data: staffData } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'staff');
            setStaff(staffData || []);

        } catch (error) {
            console.error("Error fetching admin data:", error);
            alert("Failed to load reports: " + (error.message || "Unknown Error"));
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateStatus = async (complaintId, newStatus) => {
        try {
            const { error } = await supabase
                .from('complaints')
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq('id', complaintId);

            if (error) throw error;

            // Log history
            const user = JSON.parse(localStorage.getItem('user_session'));
            await supabase.from('complaint_history').insert([{
                complaint_id: complaintId,
                status_to: newStatus,
                comment: `Status updated by Admin`,
                actor_id: user.id
            }]);

            fetchAllData();
        } catch (error) {
            alert("Failed to update status");
        }
    };

    const handleAssignStaff = async (complaintId, staffId) => {
        try {
            const { error } = await supabase
                .from('complaints')
                .update({
                    assigned_staff_id: staffId,
                    status: 'assigned',
                    updated_at: new Date().toISOString()
                })
                .eq('id', complaintId);

            if (error) throw error;

            // Log history
            const user = JSON.parse(localStorage.getItem('user_session'));
            await supabase.from('complaint_history').insert([{
                complaint_id: complaintId,
                status_to: 'assigned',
                comment: `Assigned to staff by Admin`,
                actor_id: user.id
            }]);

            fetchAllData();
        } catch (error) {
            alert("Failed to assign staff");
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('user_session');
        window.location.reload();
    };

    const handleExportPDF = (complaint) => {
        try {
            const doc = new jsPDF();
            const adminName = user?.full_name || 'Admin User';
            const exportTime = new Date().toLocaleString();

            // Title & Branding
            doc.setFontSize(22);
            doc.setTextColor(30, 64, 175); // Indigo-900
            doc.text("AdminResolve Municipal", 14, 20);

            doc.setFontSize(12);
            doc.setTextColor(100);
            doc.text("Municipal Corporation Report", 14, 30);

            doc.line(14, 37, 196, 37);

            // Core Content Table
            autoTable(doc, {
                startY: 45,
                head: [['Field', 'Information']],
                body: [
                    ['Complaint ID', `#${complaint.id.slice(0, 8)}`],
                    ['Report Type', 'Official Complaint Filing'],
                    ['Citizen Name', complaint.citizen?.full_name || 'Anonymous'],
                    ['Category', complaint.category],
                    ['Department', complaint.department?.name || 'Unassigned'],
                    ['Status', complaint.status.toUpperCase()],
                    ['Priority', complaint.priority.toUpperCase()],
                    ['Location (Address)', complaint.formatted_address || 'No Address Provided'],
                    ['Date of Filing', new Date(complaint.created_at).toLocaleString()],
                    ['SLA Deadline', new Date(complaint.sla_deadline).toLocaleString()],
                ],
                theme: 'striped',
                headStyles: { fillColor: [79, 70, 229] }, // Indigo-600
            });

            // Description
            const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 150;
            doc.setFontSize(14);
            doc.setTextColor(30, 64, 175);
            doc.text("Issue Description:", 14, finalY + 15);

            doc.setFontSize(11);
            doc.setTextColor(50);
            const descriptionText = complaint.description || "No description provided.";
            const splitDescription = doc.splitTextToSize(descriptionText, 170);
            doc.text(splitDescription, 14, finalY + 25);

            // Footer Metadata
            doc.setFontSize(10);
            doc.setTextColor(150);
            doc.text(`Exported By: ${adminName}`, 14, 280);
            doc.text(`Date of Export: ${exportTime}`, 14, 285);
            doc.text("Confidential Municipal Document", 196, 285, { align: 'right' });

            doc.save(`report_${complaint.id.slice(0, 8)}.pdf`);
        } catch (error) {
            console.error("PDF Export Error:", error);
            alert("Failed to generate PDF. Check console for details.");
        }
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
        { id: 'complaints', label: 'All Complaints', icon: <ListFilter size={20} /> },
        { id: 'sla', label: 'SLA Monitoring', icon: <AlertTriangle size={20} /> },
        { id: 'analytics', label: 'Analytics', icon: <FileBarChart size={20} /> },
    ];

    // Chart Data Configs
    const lineOptions = {
        responsive: true,
        plugins: {
            legend: { position: 'top', labels: { usePointStyle: true, boxWidth: 8, font: { family: 'Inter', size: 11 } } },
            title: { display: false }
        },
        scales: {
            y: { grid: { borderDash: [4, 4], drawBorder: false, color: '#f1f5f9' }, ticks: { padding: 10, font: { family: 'Inter' } } },
            x: { grid: { display: false }, ticks: { padding: 10, font: { family: 'Inter' } } }
        },
        interaction: { mode: 'index', intersect: false },
    };

    // Process Line Chart Data (Last 6 Months)
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentMonth = new Date().getMonth();
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
        last6Months.push(months[(currentMonth - i + 12) % 12]);
    }

    const complaintsTrend = last6Months.map(m => {
        return complaints.filter(c => {
            const date = new Date(c.created_at);
            return months[date.getMonth()] === m;
        }).length;
    });

    const resolvedTrend = last6Months.map(m => {
        return complaints.filter(c => {
            const date = new Date(c.created_at);
            return months[date.getMonth()] === m && (c.status === 'resolved' || c.status === 'closed');
        }).length;
    });

    const lineData = {
        labels: last6Months,
        datasets: [
            {
                label: 'New Reports',
                data: complaintsTrend,
                borderColor: '#3b82f6',
                tension: 0.4,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                borderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            },
            {
                label: 'Resolved',
                data: resolvedTrend,
                borderColor: '#10b981',
                tension: 0.4,
                backgroundColor: 'transparent',
                borderDash: [5, 5],
                borderWidth: 2,
                pointRadius: 0
            }
        ]
    };

    // Process Doughnut Data (Categories)
    const categoryCounts = complaints.reduce((acc, c) => {
        acc[c.category] = (acc[c.category] || 0) + 1;
        return acc;
    }, {});

    const doughnutData = {
        labels: Object.keys(categoryCounts).length > 0 ? Object.keys(categoryCounts) : ['No Data'],
        datasets: [
            {
                data: Object.values(categoryCounts).length > 0 ? Object.values(categoryCounts) : [1],
                backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#ec4899'],
                borderWidth: 0,
                hoverOffset: 10
            },
        ],
    };

    return (
        <div className="flex h-screen bg-slate-50 font-sans text-slate-800 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
            {/* Mobile Backdrop */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-md transition-opacity"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Softened Dark Theme */}
            <aside className={`
                fixed inset-y-0 left-0 z-50 w-72 bg-[#0f172a] transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0
                ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                flex flex-col relative overflow-hidden shadow-2xl
            `}>
                {/* Gradient Mesh Background for Sidebar */}
                <div className="absolute top-0 left-0 w-full h-full bg-linear-to-b from-indigo-900/20 to-slate-900/0 pointer-events-none"></div>
                <div className="absolute -top-24 -right-24 w-60 h-60 bg-blue-500/10 rounded-full blur-3xl"></div>

                <div className="h-full flex flex-col relative z-10">
                    <div className="p-8 pb-6 border-b border-slate-800/50">
                        <div className="flex items-center gap-3 text-white mb-2">
                            <div className="p-2 bg-linear-to-br from-indigo-500 to-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
                                <ShieldAlert size={24} className="text-white" />
                            </div>
                            <h1 className="text-xl font-heading font-extrabold tracking-tight">Admin<span className="text-indigo-400">Resolve</span></h1>
                        </div>
                        <p className="text-[10px] font-bold text-slate-400 tracking-[0.2em] uppercase ml-11">Municipal Authority</p>

                        <div className="mt-8 px-4 py-3 bg-slate-800/50 rounded-xl border border-slate-700/50 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-xs font-bold text-white shadow-inner">AD</div>
                            <div>
                                <p className="text-sm font-bold text-slate-200">{user?.full_name || 'Admin User'}</p>
                                <p className="text-[10px] uppercase font-bold text-slate-500">System Administrator</p>
                            </div>
                        </div>
                    </div>

                    <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => {
                                    setActiveTab(item.id);
                                    setIsSidebarOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl transition-all duration-200 group relative ${activeTab === item.id
                                    ? 'text-white font-bold bg-indigo-600 shadow-lg shadow-indigo-900/30'
                                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 font-medium'
                                    }`}
                            >
                                <div className="flex items-center gap-3 relative z-10">
                                    <span className={activeTab === item.id ? 'text-indigo-100' : 'text-slate-500 group-hover:text-slate-300'}>{item.icon}</span>
                                    {item.label}
                                </div>
                                {activeTab === item.id && <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"></div>}
                            </button>
                        ))}
                    </nav>

                    <div className="p-4 border-t border-slate-800/50">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-3 px-4 py-3.5 text-slate-400 hover:text-white hover:bg-red-500/10 hover:border-red-500/20 border border-transparent rounded-xl transition-all text-sm font-bold group"
                        >
                            <LogOut size={18} className="group-hover:text-red-400 transition-colors" /> Logout System
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50 relative">
                <div className="absolute inset-0 bg-hero-pattern opacity-100 pointer-events-none"></div>

                {/* Header */}
                <header className="h-20 bg-white/80 backdrop-blur-xl border-b border-white z-30 sticky top-0 px-6 lg:px-10 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsSidebarOpen(true)} className="p-2 lg:hidden text-slate-500 hover:bg-slate-100 rounded-lg"><Menu size={24} /></button>
                        <div className="hidden md:flex items-center bg-slate-100/50 px-4 py-2.5 rounded-full border border-slate-200 hover:bg-white hover:border-indigo-200 hover:shadow-md transition-all w-96 group">
                            <Search size={18} className="text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search complaints, citizens, or IDs..."
                                className="bg-transparent border-none outline-none ml-3 text-sm w-full text-slate-700 placeholder:text-slate-400 font-medium"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-6">
                        <div className="hidden md:flex flex-col items-end">
                            <span className="text-[10px] font-black text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100 uppercase tracking-widest flex items-center gap-1.5 shadow-sm">
                                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                                System Live
                            </span>
                        </div>
                        <button className="relative p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors">
                            <Bell size={22} />
                            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-y-auto p-6 lg:p-10 relative z-10">
                    <div className="max-w-[1600px] mx-auto space-y-8">

                        {/* Title Section */}
                        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-heading font-extrabold text-slate-800 tracking-tight">{navItems.find(i => i.id === activeTab)?.label}</h2>
                                <p className="text-slate-500 font-medium mt-1">Real-time civic intelligence overview</p>
                            </div>
                            <div className="flex gap-3">
                                <button className="px-5 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-50 hover:border-slate-300 flex items-center gap-2 shadow-sm transition-all">
                                    <Filter size={16} /> Filters
                                </button>
                                <button
                                    disabled
                                    className="px-5 py-2.5 bg-slate-300 text-white rounded-xl text-sm font-bold flex items-center gap-2 transition-all cursor-not-allowed opacity-50"
                                >
                                    <Download size={16} /> Global Export
                                </button>
                            </div>
                        </div>

                        {activeTab === 'dashboard' && (
                            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700">
                                {/* KPI Cards - Glass Style */}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                    <KpiCard label="Total Complaints" value={stats.total} icon={<ListFilter />} color="text-blue-600" bg="bg-blue-50" border="border-blue-100" />
                                    <KpiCard label="Open Issues" value={stats.open} icon={<AlertTriangle />} color="text-amber-600" bg="bg-amber-50" border="border-amber-100" />
                                    <KpiCard label="Resolved" value={stats.resolved} icon={<CheckCircle2 />} color="text-green-600" bg="bg-green-50" border="border-green-100" />
                                    <KpiCard label="SLA Breaches" value={stats.breaches} icon={<Clock />} color="text-red-600" bg="bg-red-50" border="border-red-100" isBad />
                                </div>

                                {/* Charts */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2 bg-white/60 p-8 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 backdrop-blur-md">
                                        <div className="flex items-center justify-between mb-8">
                                            <h3 className="font-heading font-bold text-lg text-slate-800">Complaint Volume Trends</h3>
                                            <select className="text-xs font-bold text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none"><option>Last 6 Months</option></select>
                                        </div>
                                        <div className="h-80">
                                            <Line options={lineOptions} data={lineData} />
                                        </div>
                                    </div>
                                    <div className="bg-white/60 p-8 rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 backdrop-blur-md flex flex-col">
                                        <h3 className="font-heading font-bold text-lg text-slate-800 mb-2">Category Distribution</h3>
                                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-8">By Incident Type</p>
                                        <div className="flex-1 flex items-center justify-center relative">
                                            <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, font: { family: 'Inter', size: 10 } } } } }} />
                                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-8">
                                                <span className="text-3xl font-heading font-black text-slate-800">{stats.total}</span>
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {(activeTab === 'complaints' || activeTab === 'sla') && (
                            <div className="bg-white/80 backdrop-blur-xl rounded-3xl border border-white/60 shadow-xl shadow-slate-200/50 overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-700">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse">
                                        <thead>
                                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] uppercase tracking-[0.15em] text-slate-400 font-black">
                                                <th className="p-5 pl-8">ID</th>
                                                <th className="p-5">Citizen</th>
                                                <th className="p-5">Category</th>
                                                <th className="p-5">Department</th>
                                                <th className="p-5">Status</th>
                                                <th className="p-5">SLA Timer</th>
                                                <th className="p-5 text-center">Export</th>
                                                <th className="p-5 pr-8 text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {complaints.map((item, i) => (
                                                <tr
                                                    key={item.id}
                                                    onClick={() => setSelectedComplaint(item)}
                                                    className="hover:bg-indigo-50/50 transition-colors group cursor-pointer"
                                                >
                                                    <td className="p-5 pl-8 font-mono text-xs font-bold text-slate-400 group-hover:text-indigo-500 transition-colors uppercase">
                                                        #{item.id.slice(0, 8)}
                                                    </td>
                                                    <td className="p-5">
                                                        <div className="flex items-center gap-4">
                                                            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-slate-100 to-slate-200 flex items-center justify-center text-xs font-black text-slate-500 border border-slate-200 shadow-sm">
                                                                {item.citizen?.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
                                                            </div>
                                                            <span className="font-bold text-slate-700 text-sm">{item.citizen?.full_name || 'Anonymous'}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-sm font-medium text-slate-600">{item.category}</td>
                                                    <td className="p-5 text-sm font-medium text-slate-600">{item.department?.name || 'Unassigned'}</td>
                                                    <td className="p-5" onClick={(e) => e.stopPropagation()}>
                                                        <select
                                                            value={item.status}
                                                            onChange={(e) => handleUpdateStatus(item.id, e.target.value)}
                                                            className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wide border shadow-sm outline-none cursor-pointer ${item.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                                item.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                                    item.status === 'open' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                                        'bg-red-50 text-red-700 border-red-200'
                                                                }`}
                                                        >
                                                            <option value="open">Open</option>
                                                            <option value="assigned">Assigned</option>
                                                            <option value="in_progress">In Progress</option>
                                                            <option value="resolved">Resolved</option>
                                                            <option value="closed">Closed</option>
                                                            <option value="rejected">Rejected</option>
                                                        </select>
                                                    </td>
                                                    <td className="p-5">
                                                        <div className={`flex items-center gap-2 text-xs font-bold ${new Date(item.sla_deadline) < new Date() ? 'text-red-500' : 'text-slate-400'}`}>
                                                            <Clock size={14} className={new Date(item.sla_deadline) < new Date() ? 'animate-pulse' : ''} />
                                                            {new Date(item.sla_deadline).toLocaleDateString()}
                                                        </div>
                                                    </td>
                                                    <td className="p-5 text-center">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleExportPDF(item);
                                                            }}
                                                            title="Export PDF"
                                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                    </td>

                                                    <td
                                                        className="p-5 pr-8 text-right"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <select
                                                            className="text-[10px] font-bold bg-white border border-slate-200 rounded px-2 py-1 outline-none"
                                                            onChange={(e) => handleAssignStaff(item.id, e.target.value)}
                                                            value={item.assigned_staff_id || ""}
                                                        >
                                                            <option value="">Assign Staff</option>
                                                            {staff.map(s => (
                                                                <option key={s.id} value={s.id}>
                                                                    {s.full_name}
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                </tr>
                                            ))}
                                            {complaints.length === 0 && (
                                                <tr>
                                                    <td colSpan="8" className="p-10 text-center text-slate-400 font-medium font-heading">
                                                        No records found in the system.
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                <div className="p-5 border-t border-slate-200 bg-slate-50/50 flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wide">
                                    <span>Showing {complaints.length} items</span>
                                    <div className="flex gap-2">
                                        <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 disabled:opacity-50 shadow-sm transition-all">Previous</button>
                                        <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:border-slate-300 shadow-sm transition-all">Next</button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Detailed Complaint Modal */}
            {
                selectedComplaint && (
                    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 lg:p-10">
                        <div
                            className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300"
                            onClick={() => setSelectedComplaint(null)}
                        ></div>

                        <div className="relative w-full max-w-5xl h-full max-h-[85vh] bg-white rounded-[2.5rem] shadow-2xl border border-white flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">
                            {/* Modal Header */}
                            <div className="flex items-center justify-between p-8 border-b border-slate-100 shrink-0">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-linear-to-br from-indigo-500 to-blue-600 rounded-2xl shadow-lg shadow-indigo-100">
                                        <ShieldAlert size={28} className="text-white" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Full Incident Report</h2>
                                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${selectedComplaint.status === 'resolved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'
                                                }`}>
                                                {selectedComplaint.status}
                                            </span>
                                        </div>
                                        <p className="text-slate-400 font-bold text-xs mt-1 uppercase tracking-widest">Reference: #{selectedComplaint.id}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setSelectedComplaint(null)}
                                    className="p-3 hover:bg-slate-100 rounded-2xl text-slate-400 hover:text-slate-600 transition-all border border-transparent hover:border-slate-200"
                                >
                                    <X size={24} />
                                </button>
                            </div>

                            {/* Modal Content - Scrollable */}
                            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">

                                    {/* Left Column: Media & Location */}
                                    <div className="lg:col-span-5 space-y-8">
                                        {/* Image Section */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Incident Evidence</label>
                                            <div className="aspect-square bg-slate-50 rounded-4xl border-2 border-slate-100 border-dashed overflow-hidden group flex items-center justify-center relative">
                                                {selectedComplaint.attachments?.length > 0 ? (
                                                    <img
                                                        src={selectedComplaint.attachments[0].file_url}
                                                        alt="Incident"
                                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                                    />
                                                ) : (
                                                    <div className="text-center p-6">
                                                        <Camera size={48} className="text-slate-300 mx-auto mb-4" />
                                                        <p className="text-sm font-bold text-slate-400">No photos provided by citizen</p>
                                                    </div>
                                                )}
                                                <div className="absolute top-4 right-4 px-3 py-1.5 bg-white/90 backdrop-blur-md rounded-xl text-[10px] font-black text-slate-600 border border-white shadow-xl">
                                                    IMAGE_UPLOAD_01
                                                </div>
                                            </div>
                                        </div>

                                        {/* Location Map Placeholder */}
                                        <div className="space-y-3">
                                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Incident Location</label>
                                            <div className="h-60 bg-slate-100 rounded-4xl border border-slate-200 relative overflow-hidden group flex items-center justify-center">
                                                {/* Static Map Background Simulation */}
                                                <div className="absolute inset-0 bg-[url('https://cartodb-basemaps-a.global.ssl.fastly.net/light_all/{z}/{x}/{y}.png')] bg-cover opacity-60 grayscale-20"></div>
                                                <div className="relative z-10 p-4 bg-white/90 backdrop-blur-md rounded-2xl shadow-2xl border border-white text-center min-w-[200px]">
                                                    <MapPin size={32} className="text-indigo-600 mx-auto mb-2 animate-bounce" />
                                                    <p className="text-xs font-black text-slate-800 uppercase tracking-tight">Active Marker</p>
                                                    <p className="text-[10px] font-bold text-slate-500 mt-1">Coordinates Captured</p>
                                                </div>
                                                <div className="absolute bottom-4 left-4 right-4 p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between">
                                                    <div className="text-white">
                                                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">GIS Mapping</p>
                                                        <p className="text-[10px] font-mono text-slate-200">Point Captured: {selectedComplaint.location ? "Valid Point" : "Manual Entry"}</p>
                                                    </div>
                                                    <button className="p-2 bg-indigo-600 text-white rounded-lg"><ExternalLink size={14} /></button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right Column: Details & Details */}
                                    <div className="lg:col-span-7 space-y-10">
                                        {/* Title & Description */}
                                        <div className="space-y-6">
                                            <div>
                                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Subject</label>
                                                <h3 className="text-3xl font-heading font-extrabold text-slate-800 leading-tight">{selectedComplaint.title}</h3>
                                            </div>

                                            <div className="p-8 bg-slate-50 rounded-4xl border border-slate-100 relative">
                                                <div className="absolute top-4 right-6 text-slate-300">“</div>
                                                <p className="text-slate-600 text-lg leading-relaxed font-medium">
                                                    {selectedComplaint.description}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Info Grid */}
                                        <div className="grid grid-cols-2 gap-6">
                                            <div className="p-6 bg-white border border-slate-100 shadow-sm rounded-3xl">
                                                <div className="flex items-center gap-3 text-indigo-600 mb-3">
                                                    <User size={18} />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Citizen Profile</span>
                                                </div>
                                                <p className="font-black text-slate-800">{selectedComplaint.citizen?.full_name}</p>
                                                <p className="text-xs font-bold text-slate-400 mt-1">{selectedComplaint.citizen?.email}</p>
                                            </div>

                                            <div className="p-6 bg-white border border-slate-100 shadow-sm rounded-3xl">
                                                <div className="flex items-center gap-3 text-blue-600 mb-3">
                                                    <Filter size={18} />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Categorization</span>
                                                </div>
                                                <p className="font-black text-slate-800">{selectedComplaint.category}</p>
                                                <p className="text-xs font-bold text-slate-400 mt-1">{selectedComplaint.department?.name}</p>
                                            </div>

                                            <div className="p-6 bg-white border border-slate-100 shadow-sm rounded-3xl">
                                                <div className="flex items-center gap-3 text-amber-600 mb-3">
                                                    <Calendar size={18} />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">SLA Monitoring</span>
                                                </div>
                                                <p className="font-black text-slate-800">Deadline: {new Date(selectedComplaint.sla_deadline).toLocaleDateString()}</p>
                                                <p className={`text-[10px] font-black mt-1 uppercase ${new Date(selectedComplaint.sla_deadline) < new Date() ? 'text-red-500' : 'text-green-500'}`}>
                                                    {new Date(selectedComplaint.sla_deadline) < new Date() ? 'SLA BREACHED' : 'WITHIN TIMELINE'}
                                                </p>
                                            </div>

                                            <div className="p-6 bg-white border border-slate-100 shadow-sm rounded-3xl">
                                                <div className="flex items-center gap-3 text-slate-600 mb-3">
                                                    <TrendingUp size={18} />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">System Priority</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-2.5 h-2.5 rounded-full ${selectedComplaint.priority === 'high' ? 'bg-red-500' : 'bg-amber-500'}`}></div>
                                                    <p className="font-black text-slate-800 uppercase tracking-tight">{selectedComplaint.priority}</p>
                                                </div>
                                                <p className="text-[10px] font-bold text-slate-400 mt-1">AI SCORING: 0.85</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="p-8 bg-slate-50 border-t border-slate-100 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-6">
                                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-400">Administrative Action:</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleUpdateStatus(selectedComplaint.id, 'resolved')}
                                            className="px-6 py-3 bg-emerald-600 text-white rounded-2xl text-sm font-black shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all hover:-translate-y-px"
                                        >
                                            Mark as Resolved
                                        </button>
                                        <button className="px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl text-sm font-black hover:bg-slate-50 transition-all">
                                            Escalate to Head
                                        </button>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reference ID</p>
                                    <p className="text-[10px] font-mono text-slate-500 mt-1">{selectedComplaint.id}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
        </div>
    );
}

const KpiCard = ({ label, value, change, icon, color, bg, border, isBad }) => (
    <div className="bg-white/70 backdrop-blur-md p-6 rounded-3xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-300 group flex flex-col justify-between h-36 relative overflow-hidden">
        <div className="flex justify-between items-start z-10">
            <div>
                <p className="text-[10px] font-black text-slate-400 mb-2 uppercase tracking-[0.2em]">{label}</p>
                <h3 className="text-4xl font-heading font-extrabold text-slate-800 tracking-tight">{value}</h3>
            </div>
            <div className={`p-2.5 rounded-2xl ${bg} ${color} ${border} border shadow-inner`}>
                {React.cloneElement(icon, { size: 22, strokeWidth: 2.5 })}
            </div>
        </div>
        <div className="flex items-center gap-2 z-10 mt-auto">
            <span className={`text-xs font-black px-2 py-0.5 rounded-md ${isBad ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                LIVE
            </span>
            <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Real-time sync</span>
        </div>

        {/* Decorative Glow */}
        <div className={`absolute -right-6 -bottom-6 w-24 h-24 rounded-full opacity-10 blur-2xl transition-transform group-hover:scale-150 duration-500 ${color.replace('text-', 'bg-')}`}></div>
    </div>
);
