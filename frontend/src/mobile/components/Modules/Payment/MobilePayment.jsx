import React, { useState, useEffect } from 'react';
import { CreditCard, Wallet, Smartphone, Plus, Trash2, Check, ShieldCheck, ChevronRight } from 'lucide-react';
import { useDialog } from '../../../../context/DialogContext';

const MobilePayment = () => {
    const { showConfirm } = useDialog();
    const [cards, setCards] = useState([]);
    const [isAdding, setIsAdding] = useState(false);
    const [newMethod, setNewMethod] = useState({ type: 'credit', number: '', holder: '', expiry: '' });

    // Load from local storage if available
    useEffect(() => {
        const saved = localStorage.getItem('user_payment_methods');
        if (saved) setCards(JSON.parse(saved));
    }, []);

    const saveCards = (newCards) => {
        setCards(newCards);
        localStorage.setItem('user_payment_methods', JSON.stringify(newCards));
    };

    const handleAdd = () => {
        if (!newMethod.number) return;
        
        let color = 'from-slate-700 to-slate-800';
        if (newMethod.type === 'promptpay') color = 'from-blue-600 to-blue-800';
        if (newMethod.type === 'wallet') color = 'from-orange-500 to-red-600';

        const newCard = {
            id: Date.now(),
            type: newMethod.type,
            provider: newMethod.type === 'credit' ? 'VISA' : newMethod.type === 'promptpay' ? 'PromptPay' : 'Wallet',
            number: newMethod.number,
            holder: newMethod.holder || 'USER',
            expiry: newMethod.expiry || '--/--',
            isDefault: cards.length === 0,
            color
        };

        saveCards([...cards, newCard]);
        setIsAdding(false);
        setNewMethod({ type: 'credit', number: '', holder: '', expiry: '' });
    };

    const handleDelete = async (id) => {
        const confirmed = await showConfirm('Remove Payment Method', 'Remove this payment method?');
        if (confirmed) {
            saveCards(cards.filter(c => c.id !== id));
        }
    };

    const handleSetDefault = (id) => {
        saveCards(cards.map(c => ({ ...c, isDefault: c.id === id })));
    };

    return (
        <div className="min-h-screen bg-slate-50 pb-24">
            {/* Header */}
            <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 py-4">
                <h1 className="text-xl font-bold font-orbitron text-slate-800">Payment Settings</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-rajdhani">Manage your wallets & cards</p>
            </div>

            <div className="p-6 space-y-8">
                {/* Active Cards Stack */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                        <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Your Methods</label>
                        <button 
                            onClick={() => setIsAdding(!isAdding)}
                            className="text-[10px] font-bold text-yellow-600 uppercase tracking-wider flex items-center gap-1 hover:text-yellow-700 transition-colors"
                        >
                            <Plus size={14} /> Add New
                        </button>
                    </div>

                    <div className="grid gap-4">
                        {cards.map(card => (
                            <div key={card.id} className="group relative">
                                {/* Card Visual */}
                                <div className={`relative overflow-hidden rounded-2xl p-6 text-white shadow-xl transition-all duration-300 ${card.isDefault ? 'ring-2 ring-yellow-500 ring-offset-2 scale-[1.02]' : 'hover:scale-[1.01] opacity-90 hover:opacity-100'}`}>
                                    <div className={`absolute inset-0 bg-gradient-to-br ${card.color}`} />
                                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 mix-blend-overlay" />
                                    
                                    {/* Content */}
                                    <div className="relative z-10 flex flex-col h-32 justify-between">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                {card.type === 'credit' && <CreditCard className="opacity-80" />}
                                                {card.type === 'promptpay' && <Smartphone className="opacity-80" />}
                                                {card.type === 'wallet' && <Wallet className="opacity-80" />}
                                                <span className="font-orbitron font-bold tracking-wider">{card.provider}</span>
                                            </div>
                                            {card.isDefault && (
                                                <div className="bg-white/20 backdrop-blur-sm px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                                                    <Check size={10} /> Default
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <div className="text-lg font-mono tracking-widest text-shadow-sm">{card.number}</div>
                                            <div className="flex justify-between items-end mt-2">
                                                <div className="text-xs opacity-75 uppercase tracking-wider">{card.holder}</div>
                                                {card.type === 'credit' && <div className="text-xs font-mono opacity-75">{card.expiry}</div>}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Actions (Slide out or visible) */}
                                <div className="mt-2 flex justify-end gap-3 px-2">
                                    {!card.isDefault && (
                                        <button onClick={() => handleSetDefault(card.id)} className="text-[10px] font-bold text-slate-400 hover:text-yellow-600 uppercase tracking-wider">
                                            Set Default
                                        </button>
                                    )}
                                    <button onClick={() => handleDelete(card.id)} className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-wider flex items-center gap-1">
                                        <Trash2 size={12} /> Remove
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Add New Form */}
                {isAdding && (
                    <div className="animate-in slide-in-from-bottom-4 fade-in duration-300 bg-white rounded-2xl p-6 border border-slate-200 shadow-xl">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Plus size={16} className="text-yellow-500" /> Add Payment Method
                        </h3>
                        
                        <div className="space-y-4">
                            <div className="grid grid-cols-3 gap-2">
                                {['credit', 'promptpay', 'wallet'].map(t => (
                                    <button
                                        key={t}
                                        onClick={() => setNewMethod({ ...newMethod, type: t })}
                                        className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider border transition-all ${
                                            newMethod.type === t 
                                            ? 'bg-slate-800 text-white border-slate-800' 
                                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        {t}
                                    </button>
                                ))}
                            </div>

                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder={newMethod.type === 'credit' ? "Card Number" : "Phone / ID"}
                                    value={newMethod.number}
                                    onChange={e => setNewMethod({ ...newMethod, number: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-yellow-500 transition-colors"
                                />
                                <input
                                    type="text"
                                    placeholder="Account Name"
                                    value={newMethod.holder}
                                    onChange={e => setNewMethod({ ...newMethod, holder: e.target.value })}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-yellow-500 transition-colors"
                                />
                                {newMethod.type === 'credit' && (
                                    <input
                                        type="text"
                                        placeholder="MM/YY"
                                        value={newMethod.expiry}
                                        onChange={e => setNewMethod({ ...newMethod, expiry: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-yellow-500 transition-colors"
                                    />
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => setIsAdding(false)}
                                    className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider hover:bg-slate-50"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleAdd}
                                    className="flex-1 py-3 rounded-xl bg-yellow-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-yellow-500/20 hover:bg-yellow-600"
                                >
                                    Save Method
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Security Note */}
                <div className="flex items-start gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                    <ShieldCheck className="text-emerald-500 shrink-0" size={20} />
                    <div>
                        <h4 className="text-xs font-bold text-emerald-700 uppercase tracking-wider mb-1">Bank-Grade Security</h4>
                        <p className="text-[10px] text-emerald-600/80 leading-relaxed">
                            Your payment data is encrypted using AES-256 standards. We never store your CVV code.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MobilePayment;
