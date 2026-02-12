import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, collection, addDoc, query, onSnapshot, 
  deleteDoc, doc 
} from 'firebase/firestore';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken 
} from 'firebase/auth';
import { 
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer
} from 'recharts';
import { 
  History, BarChart2, Plus, Trash2, Loader2, BrainCircuit, Wand2, Quote,
  CloudRain, Cloud, Sun, SunMedium, Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// Configuração Firebase
const firebaseConfig = JSON.parse(__firebase_config);
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'mood-tracker-pro';

// Esquema de cores sofisticado baseado na diversidade emocional
const MOOD_DATA = [
  { id: 1, label: 'Péssimo', icon: CloudRain, color: '#4C1D95', bg: '#F5F3FF' }, // Violeta Profundo
  { id: 2, label: 'Triste', icon: Cloud, color: '#2563EB', bg: '#EFF6FF' },      // Azul Oceano
  { id: 3, label: 'Neutro', icon: Sun, color: '#64748B', bg: '#F8FAFC' },       // Slate Grey
  { id: 4, label: 'Bem', icon: SunMedium, color: '#D97706', bg: '#FFFBEB' },    // Âmbar Quente
  { id: 5, label: 'Excelente', icon: Sparkles, color: '#0D9488', bg: '#F0FDFA' }, // Turquesa Esmeralda
];

const App = () => {
  const [user, setUser] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMoodId, setSelectedMoodId] = useState(3);
  const [note, setNote] = useState('');
  const [view, setView] = useState('dashboard');
  const [isSaving, setIsSaving] = useState(false);
  
  const [aiInsight, setAiInsight] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiTip, setAiTip] = useState('');

  const apiKey = ""; 

  const callGemini = async (prompt, systemInstruction = "Você é um mentor de bem-estar sofisticado e empático.") => {
    let delay = 1000;
    for (let i = 0; i < 5; i++) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] }
          })
        });
        if (!response.ok) throw new Error('API Error');
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text;
      } catch (err) {
        if (i === 4) throw err;
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }
  };

  const generateAiTip = async () => {
    setIsAiLoading(true);
    try {
      const tip = await callGemini(`Fernando está se sentindo "${currentMood.label}". Ofereça uma reflexão curta e sofisticada.`);
      setAiTip(tip);
    } catch (e) {
      setAiTip("O equilíbrio é a chave para a clareza mental. Reserve um momento para si.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const analyzePatterns = async () => {
    if (logs.length < 3) return;
    setIsAiLoading(true);
    try {
      const summary = logs.slice(0, 10).map(l => `${l.label}: ${l.note}`).join('\n');
      const insight = await callGemini(`Analise os padrões de humor do Fernando:\n${summary}`, "Seja analítico e inspirador.");
      setAiInsight(insight);
    } catch (e) {
      setAiInsight("Sua jornada emocional é única. Continue registrando para obtermos mais clareza.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const expandNote = async () => {
    if (!note) return;
    setIsAiLoading(true);
    try {
      const expanded = await callGemini(`Traduza esse pensamento em uma reflexão mais profunda e elegante: "${note}"`);
      setNote(expanded);
    } catch (e) {} finally {
      setIsAiLoading(false);
    }
  };

  const currentMood = useMemo(() => {
    return MOOD_DATA.find(m => m.id === selectedMoodId) || MOOD_DATA[2];
  }, [selectedMoodId]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (e) {}
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (!u) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'artifacts', appId, 'users', user.uid, 'mood_logs'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setLogs(data);
      setLoading(false);
    }, () => setLoading(false));
    return () => unsubscribe();
  }, [user]);

  const addLog = async () => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'users', user.uid, 'mood_logs'), {
        moodId: currentMood.id,
        label: currentMood.label,
        color: currentMood.color,
        note: note,
        timestamp: new Date().toISOString()
      });
      setNote('');
      setAiTip('');
      setView('history');
    } catch (e) {} finally {
      setIsSaving(false);
    }
  };

  const deleteLog = async (id) => {
    await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'mood_logs', id));
  };

  const chartData = useMemo(() => {
    const grouped = logs.reduce((acc, l) => {
      const d = new Date(l.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      if (!acc[d]) acc[d] = { date: d, val: 0, count: 0 };
      acc[d].val += l.moodId;
      acc[d].count++;
      return acc;
    }, {});
    const line = Object.values(grouped).reverse().slice(0, 7);
    return { line, count: logs.length };
  }, [logs]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans">
      <Loader2 className="animate-spin text-slate-800" size={24} />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#FDFDFD] text-slate-800 font-['Inter',_system-ui,_-apple-system,_sans-serif] p-6 md:p-12">
      <div className="max-w-xl mx-auto">
        
        {/* Top Navigation & Greeting */}
        <header className="flex items-center justify-between mb-16">
          <div className="space-y-1">
            <h2 className="text-3xl font-light tracking-tight text-slate-900">
              Olá, <span className="font-semibold">Fernando!</span>
            </h2>
            {view === 'dashboard' && <p className="text-slate-400 text-sm font-medium uppercase tracking-widest">Estado Atual</p>}
          </div>

          <nav className="flex gap-1.5 bg-slate-100/50 p-1.5 rounded-2xl">
            {[
              { id: 'dashboard', icon: Plus },
              { id: 'history', icon: History },
              { id: 'stats', icon: BarChart2 }
            ].map(item => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`p-2.5 rounded-xl transition-all duration-300 ${
                  view === item.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <item.icon size={18} />
              </button>
            ))}
          </nav>
        </header>

        <AnimatePresence mode="wait">
          {view === 'dashboard' && (
            <motion.div
              key="dash"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              className="space-y-12"
            >
              {/* Seletor de Mood Sofisticado */}
              <div className="flex justify-between gap-3">
                {MOOD_DATA.map((mood) => {
                  const Icon = mood.icon;
                  const isActive = selectedMoodId === mood.id;
                  return (
                    <button
                      key={mood.id}
                      onClick={() => setSelectedMoodId(mood.id)}
                      className="flex-1 group flex flex-col items-center gap-4"
                    >
                      <div 
                        className={`w-full aspect-square rounded-[1.75rem] flex items-center justify-center transition-all duration-500 relative ${
                          isActive 
                            ? 'shadow-2xl shadow-slate-200' 
                            : 'bg-slate-50 text-slate-300 hover:bg-slate-100'
                        }`}
                        style={{ 
                          backgroundColor: isActive ? mood.color : undefined,
                          color: isActive ? '#fff' : undefined,
                        }}
                      >
                        <Icon size={24} strokeWidth={isActive ? 2 : 1.5} />
                        {isActive && (
                          <motion.div 
                            layoutId="activeIndicator"
                            className="absolute -bottom-1.5 w-1.5 h-1.5 rounded-full bg-slate-900"
                            style={{ backgroundColor: mood.color }}
                          />
                        )}
                      </div>
                      <span className={`text-[10px] font-bold uppercase tracking-widest transition-opacity duration-300 ${isActive ? 'opacity-100 text-slate-900' : 'opacity-40'}`}>
                        {mood.label}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="space-y-8 max-w-md mx-auto">
                <div className="group relative">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Sua reflexão..."
                    className="w-full bg-transparent border-b border-slate-200 py-6 text-xl font-light focus:border-slate-900 transition-all outline-none resize-none min-h-[120px] placeholder:text-slate-200"
                  />
                  {note.length > 5 && (
                    <button 
                      onClick={expandNote}
                      className="absolute right-0 bottom-6 text-slate-400 p-2 hover:text-slate-900 transition-colors"
                    >
                      <Wand2 size={18} />
                    </button>
                  )}
                </div>

                <div className="space-y-6">
                  <button 
                    onClick={generateAiTip}
                    disabled={isAiLoading}
                    className="w-full py-4 px-6 rounded-2xl bg-slate-50 text-slate-500 font-semibold text-xs uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-slate-100 transition-all active:scale-[0.98]"
                  >
                    {isAiLoading ? <Loader2 className="animate-spin" size={16} /> : <BrainCircuit size={16} />}
                    Insight rápido
                  </button>

                  {aiTip && (
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      className="p-8 bg-white border border-slate-100 rounded-[2rem] shadow-sm flex flex-col gap-4"
                    >
                      <Quote size={20} className="text-slate-200" />
                      <p className="text-slate-600 text-sm leading-relaxed font-light italic">{aiTip}</p>
                    </motion.div>
                  )}

                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={addLog}
                    disabled={isSaving}
                    className="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-sm uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 flex items-center justify-center gap-2 hover:bg-slate-800 transition-all"
                    style={{ backgroundColor: currentMood.color }}
                  >
                    {isSaving ? <Loader2 className="animate-spin" /> : 'Registrar humor'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div key="hist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
              <h2 className="text-xl font-semibold tracking-tight">Histórico</h2>
              <div className="space-y-4">
                {logs.map(log => {
                  const mood = MOOD_DATA.find(m => m.id === log.moodId) || MOOD_DATA[2];
                  const Icon = mood.icon;
                  return (
                    <div key={log.id} className="group flex items-center gap-6 p-6 rounded-3xl bg-slate-50/50 hover:bg-slate-50 transition-all duration-300">
                      <div className="p-3.5 rounded-2xl bg-white shadow-sm shrink-0" style={{ color: mood.color }}>
                        <Icon size={20} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{log.label}</p>
                        <p className="text-xs text-slate-400 truncate font-light mt-0.5">{log.note || 'Silêncio reflexivo'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest">
                          {new Date(log.timestamp).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </p>
                        <button onClick={() => deleteLog(log.id)} className="text-slate-300 p-1 opacity-0 group-hover:opacity-100 transition-all hover:text-red-400">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {view === 'stats' && (
            <motion.div key="stats" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-10">
              <div className="flex justify-between items-end">
                <h2 className="text-xl font-semibold tracking-tight">Estatísticas</h2>
                <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  {logs.length} Entradas
                </div>
              </div>

              <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden">
                <div className="relative z-10 space-y-5">
                  <div className="flex items-center gap-3">
                    <Sparkles size={24} className="text-teal-400" />
                    <h3 className="text-lg font-light tracking-wide">Análise de IA</h3>
                  </div>
                  {aiInsight ? (
                    <p className="text-white/70 leading-relaxed text-sm font-light">{aiInsight}</p>
                  ) : (
                    <button 
                      onClick={analyzePatterns}
                      className="bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-8 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all"
                    >
                      Gerar Relatório Profundo
                    </button>
                  )}
                </div>
                <div className="absolute top-[-40%] right-[-20%] w-64 h-64 bg-teal-500/20 rounded-full blur-[80px]" />
                <div className="absolute bottom-[-20%] left-[-10%] w-48 h-48 bg-blue-500/10 rounded-full blur-[60px]" />
              </div>

              <div className="h-64 w-full bg-slate-50 rounded-[2.5rem] p-8 border border-slate-100 shadow-inner">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.line}>
                    <Tooltip 
                      contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 15px 35px rgba(0,0,0,0.05)', fontSize: '10px', fontWeight: 'bold'}} 
                      labelStyle={{display: 'none'}}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="val" 
                      stroke="#0F172A" 
                      strokeWidth={3} 
                      dot={{r: 4, fill: '#0F172A', strokeWidth: 0}} 
                      activeDot={{r: 6, fill: '#0F172A', strokeWidth: 4, stroke: 'rgba(15, 23, 42, 0.1)'}} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="mt-24 py-12 text-center opacity-20">
          <p className="text-[8px] font-black uppercase tracking-[0.6em] text-slate-900">Moodly • Spectrum Edition • 2024</p>
        </footer>
      </div>
    </div>
  );
};

export default App;