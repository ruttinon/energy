import React, { useEffect, useState } from 'react';
import api from 'services/api';
import { ShoppingCart, Package, Wrench, CreditCard, X, QrCode, CheckCircle } from 'lucide-react';
import { useApp } from '../../../../context/AppContext';
import { useDialog } from '../../../../context/DialogContext';

const MobileStore = () => {
    const { setActivePanel, selectedProject } = useApp();
    const { showAlert } = useDialog();
    const [catalog, setCatalog] = useState({ products: [], services: [], categories: [] });
    const [cart, setCart] = useState([]);
    const [contact, setContact] = useState({ name: '', phone: '', address: '' });
    const [ordering, setOrdering] = useState(false);
    const [stage, setStage] = useState('browse'); // browse, contact, payment
    const [showPayment, setShowPayment] = useState(false);
    const [activeCategory, setActiveCategory] = useState('All');

    const loadCatalog = async () => {
        const res = await api.store.getCatalog(selectedProject);
        setCatalog(res || { products: [], services: [], categories: [] });
    };
    useEffect(() => { loadCatalog(); }, [selectedProject]);

    const addToCart = (item) => {
        const idx = cart.findIndex(c => c.id === item.id);
        const qty = 1;
        if (idx >= 0) {
            const updated = [...cart];
            updated[idx] = { ...updated[idx], qty: updated[idx].qty + qty };
            setCart(updated);
        } else {
            setCart([...cart, { id: item.id, name: item.name, price: item.price, qty }]);
        }
    };
    const removeFromCart = (id) => {
        setCart(cart.filter(c => c.id !== id));
    };

    const calculateTotal = () => {
        return cart.reduce((sum, item) => sum + (item.price * item.qty), 0);
    };

    const handleCheckout = () => {
        if (cart.length === 0) {
            showAlert('แจ้งเตือน', 'เลือกสินค้า/บริการอย่างน้อย 1 รายการ');
            return;
        }
        setStage('contact');
    };

    const proceedToPayment = () => {
        if (!contact.name || !contact.phone || !contact.address) {
            showAlert('แจ้งเตือน', 'กรอกข้อมูลติดต่อและที่อยู่ให้ครบ');
            return;
        }
        setShowPayment(true);
    };

    const confirmPaymentAndOrder = async () => {
        setOrdering(true);
        try {
            const res = await api.store.createOrder({ 
                items: cart, 
                contact, 
                project_id: selectedProject,
                total: calculateTotal(),
                note: 'Paid via QR' 
            });
            
            if (res && res.ok) {
                const orderId = res.order_id;
                // Auto-create service job if services are included
                const hasService = cart.some(c => catalog.services.find(s => s.id === c.id));
                if (hasService) {
                    try { 
                        await api.service.createJob({ 
                            order_id: orderId, 
                            project_id: selectedProject,
                            title: 'คำสั่งซื้อบริการใหม่',
                            note: `Order ${orderId}`
                        }); 
                    } catch {}
                }
                
                await showAlert('สำเร็จ', 'ชำระเงินและสั่งซื้อเรียบร้อย');
                setCart([]);
                setContact({ name: '', phone: '', address: '' });
                setStage('browse');
                setShowPayment(false);
                // Optional: redirect to service or history
                if (hasService) setActivePanel('service');
            } else {
                showAlert('ผิดพลาด', 'สั่งซื้อไม่สำเร็จ');
            }
        } catch (e) {
            showAlert('ผิดพลาด', 'สั่งซื้อไม่สำเร็จ: ' + e.message);
        } finally {
            setOrdering(false);
        }
    };

    const renderPaymentModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-md p-4">
            <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm overflow-hidden flex flex-col relative animate-in fade-in zoom-in duration-300 shadow-2xl shadow-yellow-500/10">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                        <CreditCard className="text-yellow-600" size={20} />
                        <span className="font-bold text-slate-800">ชำระเงิน</span>
                    </div>
                    <button onClick={() => setShowPayment(false)} className="text-slate-400 hover:text-slate-600">
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6 flex flex-col items-center gap-4">
                    <div className="text-slate-500 text-sm">ยอดชำระทั้งหมด</div>
                    <div className="text-3xl font-bold text-yellow-600">{calculateTotal().toLocaleString()} THB</div>
                    
                    <div className="bg-white p-4 rounded-xl shadow-md border border-slate-100">
                        <QrCode size={160} className="text-slate-800" />
                    </div>
                    <div className="text-[10px] text-slate-500 text-center">
                        สแกน QR Code เพื่อชำระเงินผ่าน Mobile Banking<br/>
                        (รองรับทุกธนาคาร)
                    </div>
                </div>

                <div className="p-4 border-t border-slate-200 bg-slate-50">
                    <button 
                        onClick={confirmPaymentAndOrder}
                        disabled={ordering}
                        className="w-full py-3 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-xl font-bold text-white shadow-md hover:shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                        {ordering ? 'กำลังดำเนินการ...' : <><CheckCircle size={18}/> ยืนยันการชำระเงิน</>}
                    </button>
                </div>
            </div>
        </div>
    );

    const renderList = (list, title, Icon) => {
        // Filter by category if activeCategory is not All
        const filtered = activeCategory === 'All' 
            ? list 
            : list.filter(it => (it.category || 'General') === activeCategory);

        if (filtered.length === 0) return null;

        return (
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center">
                        <Icon size={16} className="text-yellow-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">{title}</span>
                </div>
                <div className="space-y-3">
                    {filtered.map((it) => {
                        // Check stock field (from inventory) or fallback to qty or default
                        const stockVal = it.stock !== undefined ? it.stock : (it.qty !== undefined ? it.qty : 999);
                        const stock = parseInt(stockVal);
                        const inStock = stock > 0;
                        const isService = (it.type || '').toLowerCase() === 'service' || title.includes('บริการ');
                        // Services usually don't track stock, so always available unless specified
                        const available = isService || inStock;

                        return (
                            <div key={it.id} className={`p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between ${!available ? 'opacity-60' : ''} hover:border-yellow-200 transition-colors`}>
                                <div>
                                    <div className="text-sm text-slate-800 font-bold">{it.name}</div>
                                    <div className="text-[10px] text-slate-500">{it.desc || it.category || 'No description'}</div>
                                    {!isService && (
                                        <div className={`text-[10px] mt-1 ${inStock ? 'text-green-600' : 'text-red-500'}`}>
                                            {inStock ? `สินค้าคงเหลือ: ${stock} ชิ้น` : 'สินค้าหมด'}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-yellow-600 font-bold">{it.price ? it.price.toLocaleString() : 0} THB</div>
                                    <button
                                        onClick={() => available && addToCart(it)}
                                        disabled={!available}
                                        className={`mt-2 px-2 py-1 rounded-lg text-[12px] border transition-colors ${
                                            available 
                                                ? 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100' 
                                                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                                        }`}
                                    >
                                        {available ? 'เพิ่มลงตะกร้า' : 'สินค้าหมด'}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // Category Tabs
    const allCategories = ['All', ...(catalog.categories || [])];

    return (
        <div className="flex flex-col h-full p-4 gap-5 pb-24 overflow-y-auto custom-scrollbar">
            {showPayment && renderPaymentModal()}

            <div className="flex items-center gap-2">
                <ShoppingCart size={18} className="text-yellow-600" />
                <span className="text-sm font-bold text-slate-800">ร้านค้า / บริการ</span>
            </div>

            {/* Header / Cart Summary */}
            <div className="relative bg-white border border-slate-200 rounded-2xl p-4 overflow-hidden shadow-sm">
                <div className="absolute inset-0 bg-[url('/img/grid.svg')] opacity-5" />
                <div className="relative z-10 flex items-center justify-between">
                    <div>
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider">Store Hub</div>
                        <div className="text-slate-800 font-bold text-lg">ตะกร้า: {cart.length} รายการ</div>
                    </div>
                    <div className="text-right">
                         <div className="text-[10px] text-slate-500 uppercase tracking-wider">Total</div>
                         <div className="text-yellow-600 font-bold">{calculateTotal().toLocaleString()} THB</div>
                    </div>
                </div>
            </div>

            {/* Categories */}
            {stage === 'browse' && allCategories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    {allCategories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setActiveCategory(cat)}
                            className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap border transition-all ${
                                activeCategory === cat
                                    ? 'bg-yellow-100 border-yellow-500 text-yellow-800'
                                    : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                            }`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            )}

            {stage === 'browse' && (
                <>
                    {renderList(catalog.products || [], 'สินค้า', Package)}
                    {renderList(catalog.services || [], 'บริการติดตั้ง/บำรุงรักษา', Wrench)}
                </>
            )}

            {stage === 'contact' && (
                <div className="bg-white border border-slate-200 rounded-2xl p-4 animate-in slide-in-from-right shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center">
                            <CreditCard size={16} className="text-yellow-600" />
                        </div>
                        <span className="text-sm font-bold text-slate-800">ข้อมูลติดต่อสำหรับติดตั้ง/จัดส่ง</span>
                    </div>
                    <div className="space-y-3">
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:border-yellow-500 outline-none transition-colors" placeholder="ชื่อ-นามสกุล" value={contact.name} onChange={e=>setContact({...contact,name:e.target.value})}/>
                        <input className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:border-yellow-500 outline-none transition-colors" placeholder="เบอร์โทร" value={contact.phone} onChange={e=>setContact({...contact,phone:e.target.value})}/>
                        <textarea className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-3 text-sm text-slate-800 focus:border-yellow-500 outline-none transition-colors" placeholder="ที่อยู่สำหรับติดตั้ง/จัดส่ง" rows={3} value={contact.address} onChange={e=>setContact({...contact,address:e.target.value})}/>
                    </div>
                    <button onClick={() => setStage('browse')} className="mt-4 text-xs text-slate-500 underline hover:text-slate-700">กลับไปเลือกสินค้า</button>
                </div>
            )}

            {/* Cart Actions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-50 border border-yellow-200 flex items-center justify-center">
                        <ShoppingCart size={16} className="text-yellow-600" />
                    </div>
                    <span className="text-sm font-bold text-slate-800">สรุปรายการ</span>
                </div>
                <div className="space-y-2 max-h-40 overflow-y-auto custom-scrollbar">
                    {cart.length === 0 && <div className="text-xs text-slate-400">ยังไม่มีรายการ</div>}
                    {cart.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-200">
                            <span className="text-xs text-slate-800">{c.name} × {c.qty}</span>
                            <div className="flex items-center gap-2">
                                <span className="text-xs text-yellow-600">{(c.price * c.qty).toLocaleString()}</span>
                                <button onClick={() => removeFromCart(c.id)} className="text-[10px] px-2 py-1 rounded bg-red-50 text-red-500 border border-red-200 hover:bg-red-100">ลบ</button>
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={stage === 'browse' ? handleCheckout : proceedToPayment}
                    className={`mt-3 w-full flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-sm transition-all shadow-sm ${
                        cart.length === 0
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                            : 'bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border border-yellow-600 hover:shadow-md'
                    }`}
                    disabled={cart.length === 0}
                >
                    {stage === 'browse' ? 'ดำเนินการต่อ' : 'ชำระเงิน'}
                </button>
            </div>
        </div>
    );
};

export default MobileStore;
