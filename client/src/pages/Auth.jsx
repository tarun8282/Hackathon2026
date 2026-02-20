import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, User, Mail, Lock, ArrowRight, Loader2 } from 'lucide-react';

export default function Auth() {
    const [loading, setLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    const handleAuth = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isSignUp) {
                // MANUAL SIGN UP
                const { data, error } = await supabase
                    .from('users')
                    .insert([{
                        email,
                        password,
                        full_name: fullName,
                        role: 'citizen'
                    }])
                    .select()
                    .single();

                if (error) throw error;
                localStorage.setItem('user_session', JSON.stringify(data));
                window.location.reload();
            } else {
                // MANUAL LOGIN
                const { data, error } = await supabase
                    .from('users')
                    .select('*')
                    .eq('email', email)
                    .eq('password', password)
                    .single();

                if (error || !data) throw new Error('Invalid email or password');

                localStorage.setItem('user_session', JSON.stringify(data));
                window.location.reload();
            }
        } catch (error) {
            alert(error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary-200/40 rounded-full blur-[100px] animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-indigo-200/40 rounded-full blur-[100px]"></div>
            </div>

            <div className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] p-8 border border-white/60 relative z-10 transition-all duration-500">
                <div className="flex flex-col items-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg shadow-primary-500/30 transform rotate-3">
                        <ShieldAlert size={36} />
                    </div>
                    <h1 className="text-3xl font-heading font-extrabold text-slate-800 tracking-tight">SmartResolve AI</h1>
                    <p className="text-slate-500 mt-2 text-center font-medium">
                        {isSignUp ? 'Join your civic community' : 'Welcome back, citizen'}
                    </p>
                </div>

                <form onSubmit={handleAuth} className="space-y-5">
                    {isSignUp && (
                        <div className="group">
                            <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider ml-1">Full Name</label>
                            <div className="relative">
                                <div className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                                    <User size={20} />
                                </div>
                                <input
                                    type="text"
                                    required
                                    className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-50/50 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                    placeholder="John Doe"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    <div className="group">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider ml-1">Email Address</label>
                        <div className="relative">
                            <div className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                                <Mail size={20} />
                            </div>
                            <input
                                type="email"
                                required
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-50/50 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="group">
                        <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider ml-1">Password</label>
                        <div className="relative">
                            <div className="absolute left-4 top-3.5 text-slate-400 group-focus-within:text-primary-500 transition-colors">
                                <Lock size={20} />
                            </div>
                            <input
                                type="password"
                                required
                                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border-2 border-slate-100 rounded-xl focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-50/50 outline-none transition-all font-medium text-slate-700 placeholder:text-slate-400"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-gradient-to-r from-primary-600 to-indigo-600 hover:from-primary-700 hover:to-indigo-700 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-primary-500/20 hover:shadow-2xl hover:shadow-primary-600/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
                    >
                        {loading ? (
                            <>
                                <Loader2 size={20} className="animate-spin" /> Processing...
                            </>
                        ) : (
                            <>
                                {isSignUp ? 'Create Account' : 'Sign In'} <ArrowRight size={20} />
                            </>
                        )}
                    </button>
                </form>

                <div className="mt-8 text-center pt-6 border-t border-slate-100">
                    <button
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-slate-500 hover:text-primary-600 font-bold text-sm transition-colors flex items-center justify-center gap-2 mx-auto"
                    >
                        {isSignUp ? (
                            <>Already have an account? <span className="text-primary-600 underline decoration-2 underline-offset-4">Log In</span></>
                        ) : (
                            <>Don't have an account? <span className="text-primary-600 underline decoration-2 underline-offset-4">Sign Up</span></>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
