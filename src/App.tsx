import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Settings, 
  PlusCircle, 
  Trash2, 
  FileDown, 
  Printer,
  LayoutDashboard,
  CreditCard,
  History,
  TrendingUp,
  Package,
  User as UserIcon,
  Hash,
  Plus,
  X,
  Pencil,
  Sliders,
  Calendar,
  Type,
  PieChart as PieChartIcon,
  BarChart3,
  ChevronRight,
  Search,
  ChevronDown,
  Check,
  Info,
  LogIn,
  LogOut,
  Mail,
  Lock,
  UserCircle
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Pricing, SaleRecord, SizePricing, CartItem, CustomField, PaymentMode, UserRole, User } from './types';
import { DEFAULT_PRICING, CLASSES } from './constants';

const INITIAL_ADMIN: User = {
  id: 'admin-1',
  email: 'ruhilvishal123@gmail.com',
  name: 'Admin User',
  password: 'Password@1',
  role: 'Admin',
  createdAt: new Date().toISOString()
};

export default function App() {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>(() => {
    const saved = localStorage.getItem('uniform_users');
    return saved ? JSON.parse(saved) : [INITIAL_ADMIN];
  });
  const [confirmState, setConfirmState] = useState<{ 
    isOpen: boolean; 
    title: string; 
    message: string; 
    onConfirm: () => void;
    type: 'danger' | 'info'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    type: 'danger'
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [editingRecord, setEditingRecord] = useState<SaleRecord | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // --- State ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pricing' | 'sales' | 'ledger' | 'reports' | 'profile' | 'admin'>('dashboard');
  const [pricing, setPricing] = useState<Pricing>(() => {
    const saved = localStorage.getItem('uniform_pricing');
    return saved ? JSON.parse(saved) : DEFAULT_PRICING;
  });
  const [records, setRecords] = useState<SaleRecord[]>(() => {
    const saved = localStorage.getItem('uniform_records');
    return saved ? JSON.parse(saved) : [];
  });
  const [customFields, setCustomFields] = useState<CustomField[]>(() => {
    const saved = localStorage.getItem('uniform_custom_fields');
    return saved ? JSON.parse(saved) : [];
  });

  const [showConfig, setShowConfig] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<any>('Pending');
  const [paidAmount, setPaidAmount] = useState<string>('');
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [srNo, setSrNo] = useState<number>(1);
  const [transactionDate, setTransactionDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [studentName, setStudentName] = useState('');
  const [studentClass, setStudentClass] = useState(CLASSES[0]);
  const [generalNotes, setGeneralNotes] = useState('');
  const [discountAmount, setDiscountAmount] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  // --- Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');

  // --- Reports Filter State ---
  const [reportDateStart, setReportDateStart] = useState('');
  const [reportDateEnd, setReportDateEnd] = useState('');
  const [reportItemFilter, setReportItemFilter] = useState('All');
  const [reportClassFilter, setReportClassFilter] = useState('All');

  const [newItem, setNewItem] = useState({
    item: Object.keys(DEFAULT_PRICING)[0],
    size: Object.keys(DEFAULT_PRICING[Object.keys(DEFAULT_PRICING)[0]])[0],
    qty: 1,
    notes: ''
  });

  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  // --- Effects ---
  useEffect(() => {
    const savedUser = localStorage.getItem('uniform_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    setAuthLoading(false);
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    localStorage.setItem('uniform_pricing', JSON.stringify(pricing));
  }, [pricing]);

  useEffect(() => {
    localStorage.setItem('uniform_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('uniform_custom_fields', JSON.stringify(customFields));
  }, [customFields]);

  // Handle auto-increment for Sr. No.
  useEffect(() => {
    if (records.length > 0) {
      const maxSr = Math.max(...records.map(r => r.srNo || 0));
      setSrNo(maxSr + 1);
    } else {
      setSrNo(1);
    }
  }, [records]);

  useEffect(() => {
    localStorage.setItem('uniform_users', JSON.stringify(users));
  }, [users]);

  // Permissions helper
  const can = (action: 'add' | 'edit' | 'delete' | 'manage-users') => {
    if (!user) return false;
    if (user.role === 'Admin') return true;
    if (user.role === 'Editor') {
      return action !== 'manage-users';
    }
    return false; // Viewer has no write access
  };

  // --- Computed ---
  const currentRate = useMemo(() => {
    return pricing[newItem.item]?.[newItem.size] || 0;
  }, [pricing, newItem.item, newItem.size]);

  const itemTotal = newItem.qty * currentRate;

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.qty * item.rate), 0);
  }, [cart]);

  const finalPayable = useMemo(() => {
    const discount = Number(discountAmount) || 0;
    return Math.max(0, cartTotal - discount);
  }, [cartTotal, discountAmount]);

  const grandTotal = useMemo(() => {
    return records.reduce((sum, r) => sum + r.totalAmount, 0);
  }, [records]);

  const filteredRecords = useMemo(() => {
    return records.filter(rec => {
      const matchesSearch = rec.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || rec.paymentMode === statusFilter;
      const matchesDateStart = !dateStart || rec.date >= dateStart;
      const matchesDateEnd = !dateEnd || rec.date <= dateEnd;
      return matchesSearch && matchesStatus && matchesDateStart && matchesDateEnd;
    });
  }, [records, searchQuery, statusFilter, dateStart, dateEnd]);

  const dashboardData = useMemo(() => {
    // Sales by Date
    const dateMap: Record<string, { total: number, UPI: number, Cash: number, Pending: number }> = {};
    const paymentMap: Record<string, number> = { UPI: 0, Cash: 0, Pending: 0 };
    const itemMap: Record<string, Record<string, number>> = {}; // item -> size -> qty

    records.forEach(r => {
      // Date stats
      if (!dateMap[r.date]) {
        dateMap[r.date] = { total: 0, UPI: 0, Cash: 0, Pending: 0 };
      }
      dateMap[r.date].total += r.totalAmount;
      if (r.paymentMode === 'UPI') dateMap[r.date].UPI += r.totalAmount;
      else if (r.paymentMode === 'Cash') dateMap[r.date].Cash += r.totalAmount;
      else if (r.paymentMode === 'Pending') dateMap[r.date].Pending += r.totalAmount;
      
      // Payment stats
      paymentMap[r.paymentMode] = (paymentMap[r.paymentMode] || 0) + 1;

      // Item stats
      r.items.forEach(i => {
        if (!itemMap[i.item]) itemMap[i.item] = {};
        itemMap[i.item][i.size] = (itemMap[i.item][i.size] || 0) + i.qty;
      });
    });

    const timeSeries = Object.entries(dateMap)
      .map(([date, stats]) => ({ 
        date, 
        amount: stats.total,
        UPI: stats.UPI,
        Cash: stats.Cash,
        Pending: stats.Pending
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-10); // Last 10 days

    const paymentData = Object.entries(paymentMap).map(([name, value]) => ({ name, value }));
    
    const itemAnalysis = Object.entries(itemMap).map(([name, sizes]) => ({
      name,
      total: Object.values(sizes).reduce((a, b) => a + b, 0),
      sizes: Object.entries(sizes).map(([size, qty]) => ({ size, qty }))
    })).sort((a, b) => b.total - a.total);

    return { timeSeries, paymentData, itemAnalysis };
  }, [records]);

  const stats = useMemo(() => {
    const totalSales = records.length;
    const pendingAmount = records
      .filter(r => r.paymentMode === 'Pending')
      .reduce((sum, r) => sum + r.totalAmount, 0);
    const paidAmount = records
      .filter(r => r.paymentMode !== 'Pending')
      .reduce((sum, r) => sum + (r.paidAmount || 0), 0);
    
    return { totalSales, pendingAmount, paidAmount };
  }, [records]);

  // --- Handlers ---
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 800));

    const foundUser = users.find(u => u.email === email && u.password === password);
    if (foundUser) {
      setUser(foundUser);
      localStorage.setItem('uniform_user', JSON.stringify(foundUser));
    } else {
      setLoginError("Invalid email or password. Please use correct credentials.");
    }
    setLoginLoading(false);
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('uniform_user');
    setActiveTab('dashboard');
  };

  const handlePriceChange = (item: string, size: string, value: number) => {
    setPricing(prev => ({
      ...prev,
      [item]: {
        ...prev[item],
        [size]: value
      }
    }));
  };

  const renameItem = (oldName: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName || cleanName === oldName || pricing[cleanName]) return;
    
    setPricing(prev => {
      const next = { ...prev };
      const sizes = next[oldName];
      next[cleanName] = sizes;
      delete next[oldName];
      return next;
    });

    if (newItem.item === oldName) {
      setNewItem(p => ({ ...p, item: cleanName }));
    }
  };

  const renameSize = (item: string, oldSize: string, newSize: string) => {
    const cleanSize = newSize.trim();
    if (!cleanSize || cleanSize === oldSize || pricing[item][cleanSize]) return;
    
    setPricing(prev => {
      const next = { ...prev };
      const itemSizes = { ...next[item] };
      const price = itemSizes[oldSize];
      delete itemSizes[oldSize];
      itemSizes[cleanSize] = price;
      next[item] = itemSizes;
      return next;
    });
  };

  const addNewItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemName = (formData.get('itemName') as string).trim();
    if (!itemName || pricing[itemName]) return;
    
    setPricing(prev => ({
      ...prev,
      [itemName]: {}
    }));
    (e.target as HTMLFormElement).reset();
  };

  const deleteItem = (item: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete "${item}"? This will remove all associated sizes and pricing configurations.`,
      onConfirm: () => {
        setPricing(prev => {
          const next = { ...prev };
          delete next[item];
          return next;
        });

        if (newItem.item === item) {
          const nextPricing = { ...pricing };
          delete nextPricing[item];
          const firstAvailable = Object.keys(nextPricing)[0];
          setNewItem(p => ({
            ...p,
            item: firstAvailable || '',
            size: firstAvailable ? Object.keys(nextPricing[firstAvailable])[0] || '' : ''
          }));
        }
      },
      type: 'danger'
    });
  };

  const addNewSize = (item: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const size = (formData.get('size') as string).trim();
    const price = Number(formData.get('price'));
    
    if (!size) return;

    setPricing(prev => ({
      ...prev,
      [item]: {
        ...prev[item],
        [size]: price
      }
    }));
    (e.target as HTMLFormElement).reset();
  };

  const deleteSize = (item: string, size: string) => {
    setPricing(prev => ({
      ...prev,
      [item]: Object.fromEntries(
        Object.entries(prev[item]).filter(([s]) => s !== size)
      )
    }));
  };

  const addCustomField = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const label = (formData.get('label') as string).trim();
    const type = formData.get('type') as any;
    const required = formData.get('required') === 'on';

    if (!label) return;

    if (customFields.some(f => f.label.toLowerCase() === label.toLowerCase())) {
        alert("A field with this name already exists.");
        return;
    }

    setCustomFields(prev => [
      ...prev,
      { id: crypto.randomUUID(), label, type, required }
    ]);
    (e.target as HTMLFormElement).reset();
  };

  const removeCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
    setCustomValues(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const addToCart = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate student name
    if (!studentName.trim()) {
        setFormError("Student name is required.");
        return;
    }

    // Validate required custom fields
    const missing = customFields.find(f => f.required && !customValues[f.id]);
    if (missing) {
      setFormError(`"${missing.label}" is required.`);
      return;
    }

    const item: CartItem = {
      id: crypto.randomUUID(),
      item: newItem.item,
      size: newItem.size,
      qty: newItem.qty,
      rate: currentRate,
      customData: { ...customValues }
    };
    if (newItem.notes.trim()) {
      item.notes = newItem.notes.trim();
    }
    setCart(prev => [...prev, item]);
    setNewItem(prev => ({ ...prev, qty: 1, notes: '' }));
    setCustomValues({});
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const submitTransaction = () => {
    if (!studentName.trim() || cart.length === 0) return;

    const timestamp = new Date().toISOString();
    const displayDate = new Date(transactionDate).toLocaleDateString('en-IN');

    const newRecord: SaleRecord = {
      id: crypto.randomUUID(),
      srNo: srNo,
      name: studentName,
      studentClass: studentClass,
      items: cart,
      totalAmount: finalPayable,
      discount: Number(discountAmount) || 0,
      date: displayDate,
      timestamp,
      paymentMode,
    };

    if (paymentMode !== 'Pending') {
      newRecord.paidAmount = Number(paidAmount);
      newRecord.paymentDate = paymentDate;
    }
    
    if (generalNotes.trim()) {
      newRecord.notes = generalNotes.trim();
    }

    setRecords(prev => [newRecord, ...prev]);
    setSrNo(prev => prev + 1);
    setCart([]);
    setStudentName('');
    setStudentClass(CLASSES[0]);
    setGeneralNotes('');
    setDiscountAmount('');
    setPaymentMode('Pending');
    setPaidAmount('');
    setShowConfirmation(false);
  };

  const deleteRecord = (id: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Record',
      message: 'Are you sure you want to permanently delete this transaction record? This action cannot be undone.',
      onConfirm: () => setRecords(prev => prev.filter(r => r.id !== id)),
      type: 'danger'
    });
  };

  const updateRecord = (id: string, updates: any) => {
    setRecords(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    setEditingRecord(null);
  };

  const bulkDeleteRecords = (ids: string[]) => {
    setConfirmState({
      isOpen: true,
      title: 'Bulk Delete',
      message: `Are you sure you want to delete ${ids.length} selected records? This action is permanent.`,
      onConfirm: () => {
        setRecords(prev => prev.filter(r => !ids.includes(r.id)));
        setSelectedRecordIds([]);
      },
      type: 'danger'
    });
  };

  const bulkUpdateStatus = (ids: string[], mode: PaymentMode) => {
    const timestamp = new Date().toISOString();
    const pDate = new Date().toISOString().split('T')[0];
    
    setRecords(prev => prev.map(r => {
      if (ids.includes(r.id)) {
        const updates: any = {
          paymentMode: mode,
          updatedAt: timestamp
        };
        
        if (mode !== 'Pending') {
          if (r.paymentMode === 'Pending') {
            updates.paidAmount = r.totalAmount;
            updates.paymentDate = pDate;
          }
        } else {
          updates.paidAmount = null;
          updates.paymentDate = null;
        }
        return { ...r, ...updates };
      }
      return r;
    }));
    setSelectedRecordIds([]);
  };

  const clearRecords = () => {
    setConfirmState({
      isOpen: true,
      title: 'Clear Ledger',
      message: 'Are you sure you want to permanently delete all sales history? This action cannot be undone.',
      onConfirm: () => {
        setRecords([]);
        setSelectedRecordIds([]);
      },
      type: 'danger'
    });
  };

  const exportCSV = () => {
    if (filteredRecords.length === 0) return;
    
    const itemNames = Object.keys(pricing);
    
    // Header Row 1: Fixed fields then item names with empty spacers
    let row1 = ["Sr. No.", "Date", "Student Name", "Class", "General Notes"];
    itemNames.forEach(name => {
      row1.push(name, "", ""); // Colspan 3 for each item
    });
    row1.push("Total Qty", "Total Amount", "Payment Mode", "Paid Amount", "Payment Date");
    
    // Header Row 2: Sub-headings
    let row2 = ["", "", "", "", ""];
    itemNames.forEach(() => {
      row2.push("Size", "Qty", "Price");
    });
    row2.push("", "", "", "", "");

    let csv = row1.join(",") + "\n" + row2.join(",") + "\n";
    
    filteredRecords.forEach(r => {
      const totalQty = r.items.reduce((s, i) => s + i.qty, 0);
      
      let row = [
        r.srNo,
        r.date,
        `"${r.name.replace(/"/g, '""')}"`,
        `"${r.studentClass}"`,
        `"${(r.notes || '').replace(/"/g, '""')}"`
      ];

      // Fill item columns
      itemNames.forEach(itemName => {
        const lineItem = r.items.find(i => i.item === itemName);
        if (lineItem) {
          row.push(`"${lineItem.size}"`, lineItem.qty, lineItem.qty * lineItem.rate);
        } else {
          row.push("", "", "");
        }
      });

      row.push(
        totalQty,
        r.totalAmount,
        r.paymentMode,
        r.paidAmount || 0,
        r.paymentDate || ''
      );

      csv += row.join(",") + "\n";
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Uniform_Sales_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`);
    a.click();
  };

  const handlePrint = () => {
    const originalTitle = document.title;
    document.title = `Uniform_Sales_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 100);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <ConfirmDialog 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(p => ({ ...p, isOpen: false }))}
      />

      {/* Navigation */}
      <nav className="bg-slate-900 text-white px-8 py-4 shadow-lg flex justify-between items-center sticky top-0 z-50 print:hidden">
        <div className="flex items-center gap-3">
          <motion.div 
            initial={{ rotate: -10 }}
            animate={{ rotate: 0 }}
            className="bg-blue-600 p-2 rounded-lg shadow-inner"
          >
            <FileSpreadsheet size={20} />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold tracking-tight leading-tight">UNIFORM SALES CRM</h1>
            <p className="text-[10px] text-slate-400 font-mono tracking-widest uppercase">Next-Gen International</p>
          </div>
        </div>
        <nav className="hidden sm:flex items-center gap-1 bg-slate-900/50 p-1 rounded-2xl relative" role="tablist" aria-label="Main Navigation">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'pricing', icon: Settings, label: 'Pricing' },
            { id: 'sales', icon: PlusCircle, label: 'New Sale' },
            { id: 'ledger', icon: History, label: 'Ledger' },
            { id: 'reports', icon: BarChart3, label: 'Reports' },
            { id: 'profile', icon: UserCircle, label: 'Profile' },
            ...(user?.role === 'Admin' ? [{ id: 'admin', icon: Settings, label: 'Admin' }] : []),
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              id={`${tab.id}-tab`}
              onClick={() => setActiveTab(tab.id as any)}
              className={`relative flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black tracking-wider transition-all z-10 ${
                activeTab === tab.id 
                  ? 'text-white' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTabIndicator"
                  className="absolute inset-0 bg-blue-600 rounded-xl -z-10 shadow-lg shadow-blue-500/20"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              )}
              <tab.icon size={14} aria-hidden="true" strokeWidth={2.5} />
              {tab.label.toUpperCase()}
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <div className="hidden lg:block text-right">
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Authenticated as</p>
             <p className="text-xs font-bold text-white">{user?.name || user?.email}</p>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-400 rounded-xl hover:text-white hover:bg-slate-700 transition-all font-black text-[10px] uppercase tracking-widest border border-slate-700"
          >
            <LogOut size={14} /> Log Out
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6 w-full max-w-[1600px] mx-auto pb-24 sm:pb-6">
        <AnimatePresence mode="wait">
          {authLoading ? (
            <motion.div 
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center min-h-[60vh] space-y-4"
            >
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Initializing System...</p>
            </motion.div>
          ) : !user ? (
            <motion.div 
              key="login"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 max-w-sm mx-auto text-center"
            >
              <div className="w-24 h-24 bg-blue-600 rounded-3xl flex items-center justify-center text-white shadow-2xl shadow-blue-500/20">
                <FileSpreadsheet size={48} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Access Restricted</h2>
                <p className="text-slate-500 text-sm">Sign in to access the Uniform Sales CRM.</p>
              </div>

              {loginError && (
                <div className="w-full p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                  {loginError}
                </div>
              )}

              <form onSubmit={handleEmailAuth} className="w-full space-y-4">
                <div className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="email" 
                      required 
                      placeholder="Administrator ID" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-all font-medium text-sm shadow-sm"
                    />
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="password" 
                      required 
                      placeholder="Security PIN" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-all font-medium text-sm shadow-sm"
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={loginLoading}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all shadow-xl disabled:opacity-50"
                >
                  {loginLoading ? 'Authenticating...' : 'Sign In to CRM'}
                </button>
              </form>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Authorized Personnel Only</div>
            </motion.div>
          ) : (
            <>
          {activeTab === 'dashboard' && (
            <motion.div 
              key="dashboard"
              id="dashboard-panel"
              role="tabpanel"
              aria-labelledby="dashboard-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <button 
                  onClick={() => setActiveTab('sales')}
                  className="group relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl text-left shadow-xl shadow-blue-500/20 active:scale-[0.98] transition-all"
                >
                  <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform">
                    <PlusCircle size={120} />
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <h4 className="text-white text-xl font-black mb-2 flex items-center gap-2">
                        Create Sale Record <ChevronRight size={20} />
                      </h4>
                      <p className="text-blue-100/80 text-sm max-w-[200px]">Start a new transaction for uniforms or books.</p>
                    </div>
                    <div className="mt-8 flex items-center gap-3">
                      <div className="bg-white/20 p-2 rounded-lg backdrop-blur-md">
                         <Plus size={16} className="text-white" />
                      </div>
                      <span className="text-white text-[10px] font-bold uppercase tracking-widest">New Record</span>
                    </div>
                  </div>
                </button>

                <button 
                  onClick={() => setActiveTab('ledger')}
                  className="group relative overflow-hidden bg-white p-8 rounded-3xl text-left border border-slate-200 shadow-sm hover:shadow-xl hover:border-blue-100 transition-all active:scale-[0.98]"
                >
                  <div className="absolute top-0 right-0 p-6 text-slate-50 group-hover:scale-110 transition-transform">
                    <History size={120} />
                  </div>
                  <div className="relative z-10 flex flex-col h-full justify-between">
                    <div>
                      <h4 className="text-slate-900 text-xl font-black mb-2 flex items-center gap-2">
                        View Sales Ledger <ChevronRight size={20} className="text-blue-500" />
                      </h4>
                      <p className="text-slate-500 text-sm max-w-[200px]">Audit transactions and export reports.</p>
                    </div>
                    <div className="mt-8 flex items-center gap-3">
                      <div className="bg-slate-100 p-2 rounded-lg group-hover:bg-blue-50 transition-colors">
                         <History size={16} className="text-slate-400 group-hover:text-blue-500" />
                      </div>
                      <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest group-hover:text-blue-600">History</span>
                    </div>
                  </div>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Revenue</span>
                   </div>
                   <div className="text-3xl font-black text-slate-900 font-mono">₹{grandTotal}</div>
                   <div className="text-xs text-slate-500 mt-1">Gross sales lifetime</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><History size={20} /></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sales</span>
                   </div>
                   <div className="text-3xl font-black text-slate-900 font-mono">{stats.totalSales}</div>
                   <div className="text-xs text-slate-500 mt-1">Confirmed transactions</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><CreditCard size={20} /></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unpaid/Pending</span>
                   </div>
                   <div className="text-3xl font-black text-slate-900 font-mono">₹{stats.pendingAmount}</div>
                   <div className="text-xs text-slate-500 mt-1 text-amber-600 font-medium">Pending collection</div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                   <div className="flex justify-between items-start mb-4">
                      <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Package size={20} /></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Realized Revenue</span>
                   </div>
                   <div className="text-3xl font-black text-slate-900 font-mono">₹{stats.paidAmount}</div>
                   <div className="text-xs text-slate-500 mt-1 text-emerald-600 font-medium">Cash & UPI collected</div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[350px]">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <BarChart3 size={14} className="text-blue-500" /> Daily Revenue & Payments
                    </h3>
                    <div className="flex gap-2">
                       <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-indigo-500" /><span className="text-[8px] font-black uppercase text-slate-400">UPI</span></div>
                       <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" /><span className="text-[8px] font-black uppercase text-slate-400">Cash</span></div>
                       <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" /><span className="text-[8px] font-black uppercase text-slate-400">Pending</span></div>
                    </div>
                  </div>
                  <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboardData.timeSeries}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          labelStyle={{ fontWeight: 'bold', fontSize: '12px' }}
                          cursor={{ fill: '#f8fafc' }}
                        />
                        <Bar dataKey="UPI" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Cash" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
                        <Bar dataKey="Pending" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 min-h-[350px]">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                    <PieChartIcon size={14} className="text-blue-500" /> Transaction Type Mix
                  </h3>
                  <div className="h-[250px] w-full flex items-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={dashboardData.paymentData}
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {dashboardData.paymentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={['#f59e0b', '#6366f1', '#10b981'][index % 3]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="w-1/3 space-y-4">
                       {dashboardData.paymentData.map((d, i) => (
                         <div key={d.name} className="flex flex-col">
                            <span className="text-[10px] font-black uppercase text-slate-400 leading-none mb-1">{d.name}</span>
                            <span className="text-xl font-black text-slate-800 leading-none">{d.value} <span className="text-[9px] font-medium text-slate-400 uppercase tracking-tighter">Records</span></span>
                         </div>
                       ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <Package size={14} className="text-blue-500" /> Granular Item Analysis (Sold Qty)
                  </h3>
                </div>
                <div className="p-6">
                   <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                      {dashboardData.itemAnalysis.map((item) => (
                        <div key={item.name} className="flex flex-col bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden">
                           <div className="px-4 py-3 bg-white border-b border-slate-100 flex justify-between items-center">
                              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest">{item.name}</span>
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold font-mono">Total {item.total}</span>
                           </div>
                           <div className="p-4 grid grid-cols-2 gap-2 max-h-[150px] overflow-y-auto custom-scroll">
                              {item.sizes.map(s => (
                                <div key={s.size} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100 shadow-sm">
                                   <span className="text-[10px] font-black text-slate-400 uppercase">{s.size}</span>
                                   <span className="text-xs font-black text-slate-800 font-mono">{s.qty}</span>
                                </div>
                              ))}
                           </div>
                        </div>
                      ))}
                   </div>
                </div>
              </div>
              <div className="flex justify-center pt-8">
                <button 
                  onClick={() => setActiveTab('sales')}
                  className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-full font-black text-sm hover:bg-blue-700 transition-all shadow-lg hover:translate-y-[-2px] active:translate-y-0"
                >
                  START NEW SALE <PlusCircle size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'pricing' && (
            <motion.div 
              key="pricing"
              id="pricing-panel"
              role="tabpanel"
              aria-labelledby="pricing-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-4xl mx-auto"
            >
              <PriceConfigSection 
                pricing={pricing}
                handlePriceChange={handlePriceChange}
                renameItem={renameItem}
                renameSize={renameSize}
                addNewItem={addNewItem}
                deleteItem={deleteItem}
                addNewSize={addNewSize}
                deleteSize={deleteSize}
                newItem={newItem}
                setNewItem={setNewItem}
                can={can}
              />
              <div className="flex justify-center mt-8">
                <button 
                  onClick={() => setActiveTab('sales')}
                  className="flex items-center gap-2 px-6 py-2.5 border-2 border-blue-600 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all"
                >
                  PROCEED TO BILLING <ChevronRight size={16} />
                </button>
              </div>
            </motion.div>
          )}

          {activeTab === 'sales' && (
            <motion.div 
              key="sales"
              id="sales-panel"
              role="tabpanel"
              aria-labelledby="sales-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="max-w-3xl mx-auto"
            >
              <SalesFormSection 
                showConfig={showConfig}
                setShowConfig={setShowConfig}
                formError={formError}
                srNo={srNo}
                setSrNo={setSrNo}
                transactionDate={transactionDate}
                setTransactionDate={setTransactionDate}
                studentName={studentName}
                setStudentName={setStudentName}
                studentClass={studentClass}
                setStudentClass={setStudentClass}
                generalNotes={generalNotes}
                setGeneralNotes={setGeneralNotes}
                newItem={newItem}
                setNewItem={setNewItem}
                pricing={pricing}
                currentRate={currentRate}
                customFields={customFields}
                customValues={customValues}
                setCustomValues={setCustomValues}
                discountAmount={discountAmount}
                setDiscountAmount={setDiscountAmount}
                finalPayable={finalPayable}
                addToCart={addToCart}
                cart={cart}
                cartTotal={cartTotal}
                removeFromCart={removeFromCart}
                onSubmitClick={() => setShowConfirmation(true)}
                paymentMode={paymentMode}
                setPaymentMode={setPaymentMode}
                paidAmount={paidAmount}
                setPaidAmount={setPaidAmount}
                paymentDate={paymentDate}
                setPaymentDate={setPaymentDate}
                addCustomField={addCustomField}
                removeCustomField={removeCustomField}
                updateCustomField={updateCustomField}
                recentRecords={records.slice(0, 3)}
                can={can}
              />
            </motion.div>
          )}

          {activeTab === 'ledger' && (
            <motion.div 
              key="ledger"
              id="ledger-panel"
              role="tabpanel"
              aria-labelledby="ledger-tab"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <LedgerSection 
                records={filteredRecords}
                allRecords={records}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                statusFilter={statusFilter}
                setStatusFilter={setStatusFilter}
                dateStart={dateStart}
                setDateStart={setDateStart}
                dateEnd={dateEnd}
                setDateEnd={setDateEnd}
                exportCSV={exportCSV}
                handlePrint={handlePrint}
                deleteRecord={deleteRecord}
                setEditingRecord={setEditingRecord}
                updateRecord={updateRecord}
                addRecord={(r: any) => setRecords((prev: any) => [r, ...prev])}
                selectedRecordIds={selectedRecordIds}
                setSelectedRecordIds={setSelectedRecordIds}
                bulkDeleteRecords={bulkDeleteRecords}
                bulkUpdateStatus={bulkUpdateStatus}
                customFields={customFields}
                grandTotal={filteredRecords.reduce((sum, r) => sum + r.totalAmount, 0)}
                pricing={pricing}
                can={can}
              />
            </motion.div>
          )}

          {activeTab === 'reports' && (
            <motion.div 
              key="reports"
              id="reports-panel"
              role="tabpanel"
              aria-labelledby="reports-tab"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
            >
              <ReportsSection 
                records={records}
                pricing={pricing}
                dateStart={reportDateStart}
                setDateStart={setReportDateStart}
                dateEnd={reportDateEnd}
                setDateEnd={setReportDateEnd}
                itemFilter={reportItemFilter}
                setItemFilter={setReportItemFilter}
                classFilter={reportClassFilter}
                setClassFilter={setReportClassFilter}
              />
            </motion.div>
          )}

          {activeTab === 'profile' && (
            <motion.div 
              key="profile"
              id="profile-panel"
              role="tabpanel"
              aria-labelledby="profile-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <ProfileSection 
                user={user}
                setUser={(updated: User) => {
                   setUser(updated);
                   localStorage.setItem('uniform_user', JSON.stringify(updated));
                   // Also update in users list
                   setUsers(prev => prev.map(u => u.id === updated.id ? updated : u));
                }}
                logout={logout}
              />
            </motion.div>
          )}

          {activeTab === 'admin' && user?.role === 'Admin' && (
            <motion.div 
              key="admin"
              id="admin-panel"
              role="tabpanel"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <AdminDashboard 
                users={users}
                setUsers={setUsers}
                currentUser={user}
              />
            </motion.div>
          )}
          </>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {editingRecord && (
            <EditRecordModal 
              record={editingRecord}
              onClose={() => setEditingRecord(null)}
              onUpdate={updateRecord}
              pricing={pricing}
              customFields={customFields}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showConfirmation && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center space-y-6"
              >
                <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                  <PlusCircle size={40} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-black text-slate-900">Final Confirmation</h3>
                  <p className="text-sm text-slate-500">Are you sure you want to complete this transaction of <span className="font-bold text-slate-900">₹{finalPayable}</span> for <span className="font-bold text-slate-900">{studentName}</span>?</p>
                </div>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowConfirmation(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                  >
                    Review
                  </button>
                  <button 
                    onClick={submitTransaction}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20"
                  >
                    Save & Post
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      <footer className="hidden sm:block py-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 bg-white">
        Uniform Sales CRM &bull; &copy; 2026 Internal Operations &bull; Restricted Access
      </footer>

      {/* Mobile Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-2 py-2 flex sm:hidden justify-around items-center z-[100] shadow-[0_-10px_20px_rgba(0,0,0,0.05)]" role="tablist" aria-label="Mobile Navigation">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
          { id: 'pricing', icon: Settings, label: 'Pricing' },
          { id: 'sales', icon: PlusCircle, label: 'Sale' },
          { id: 'ledger', icon: History, label: 'Ledger' },
          { id: 'reports', icon: BarChart3, label: 'Reports' },
          { id: 'profile', icon: UserCircle, label: 'Profile' },
        ].map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
              activeTab === tab.id ? 'text-blue-600' : 'text-slate-400'
            }`}
          >
            <div className={`p-2 rounded-xl transition-colors ${activeTab === tab.id ? 'bg-blue-50' : 'bg-transparent'}`}>
               <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} aria-hidden="true" />
            </div>
            <span className="text-[9px] font-black uppercase tracking-tighter">{tab.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProfileSection({ user, setUser, logout }: any) {
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleUpdateName = (e: React.FormEvent) => {
    e.preventDefault();
    const updatedUser = { ...user, name };
    setUser(updatedUser);
    localStorage.setItem('uniform_user', JSON.stringify(updatedUser));
    setMsg({ type: 'success', text: 'Profile name updated successfully.' });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, we would verify current password. 
    // Here we just simulate for the mock admin.
    if (newPassword.length < 6) {
      setMsg({ type: 'error', text: 'New password must be at least 6 characters.' });
      return;
    }
    setMsg({ type: 'success', text: 'Password changed successfully.' });
    setCurrentPassword('');
    setNewPassword('');
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          <div className="w-32 h-32 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 text-white shrink-0">
             <UserCircle size={64} />
          </div>
          <div className="space-y-4 flex-1">
             <div className="space-y-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Account Settings</h2>
                <p className="text-slate-500 font-medium">Manage your administrator profile and security.</p>
             </div>
             
             {msg && (
               <motion.div 
                 initial={{ opacity: 0, y: -10 }} 
                 animate={{ opacity: 1, y: 0 }}
                 className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}
               >
                 {msg.text}
               </motion.div>
             )}

             <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4">
                <form onSubmit={handleUpdateName} className="space-y-4">
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Basic Information</h3>
                   <div className="space-y-4">
                      <div className="space-y-1">
                         <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Email Address (Read Only)</label>
                         <div className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 font-bold text-sm cursor-not-allowed">
                            {user?.email}
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Display Name</label>
                         <input 
                           type="text" 
                           value={name}
                           onChange={(e) => setName(e.target.value)}
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold text-sm focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all"
                         />
                      </div>
                      <button type="submit" className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg">
                        Update Information
                      </button>
                   </div>
                </form>

                <form onSubmit={handleChangePassword} className="space-y-4">
                   <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Security & PIN</h3>
                   <div className="space-y-4">
                      <div className="space-y-1">
                         <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Current Password</label>
                         <input 
                           type="password" 
                           placeholder="••••••••"
                           value={currentPassword}
                           onChange={(e) => setCurrentPassword(e.target.value)}
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold text-sm focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all"
                         />
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-black uppercase text-slate-400 ml-1">New Password</label>
                         <input 
                           type="password" 
                           placeholder="••••••••"
                           value={newPassword}
                           onChange={(e) => setNewPassword(e.target.value)}
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 font-bold text-sm focus:border-blue-600 focus:ring-4 focus:ring-blue-600/5 outline-none transition-all"
                         />
                      </div>
                      <button type="submit" className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20">
                        Change Password
                      </button>
                   </div>
                </form>
             </div>

             <div className="pt-8 border-t border-slate-100 mt-8 flex justify-between items-center">
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sign Out</p>
                   <p className="text-xs text-slate-500">End your current session securely.</p>
                </div>
                <button 
                  onClick={logout}
                  className="px-6 py-3 border-2 border-red-500/20 text-red-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition-all"
                >
                  Logout Session
                </button>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}


function AdminDashboard({ users, setUsers, currentUser }: any) {
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('Viewer');
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleAddUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (users.some((u: User) => u.email === newUserEmail)) {
      setMsg({ type: 'error', text: 'User with this email already exists.' });
      return;
    }
    const newUser: User = {
      id: crypto.randomUUID(),
      email: newUserEmail,
      name: newUserName,
      password: newUserPassword,
      role: newUserRole,
      createdAt: new Date().toISOString()
    };
    setUsers([...users, newUser]);
    setMsg({ type: 'success', text: `User ${newUserName} added successfully.` });
    setNewUserEmail('');
    setNewUserName('');
    setNewUserPassword('');
    setTimeout(() => setMsg(null), 3000);
  };

  const handleDeleteUser = (id: string) => {
    if (id === currentUser.id) {
      setMsg({ type: 'error', text: 'You cannot delete yourself.' });
      return;
    }
    setUsers(users.filter((u: User) => u.id !== id));
    setMsg({ type: 'success', text: 'User deleted successfully.' });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleUpdateRole = (id: string, role: UserRole) => {
    if (id === currentUser.id) {
      setMsg({ type: 'error', text: 'You cannot change your own role.' });
      return;
    }
    setUsers(users.map((u: User) => u.id === id ? { ...u, role } : u));
    setMsg({ type: 'success', text: 'User role updated successfully.' });
    setTimeout(() => setMsg(null), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm space-y-8">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
            <Settings className="text-blue-600" size={32} /> Admin Control Center
          </h2>
          <p className="text-slate-500 font-medium">Manage user identities, access levels, and security permissions.</p>
        </div>

        {msg && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }} 
            animate={{ opacity: 1, y: 0 }}
            className={`p-4 rounded-2xl text-[10px] font-black uppercase tracking-widest ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}
          >
            {msg.text}
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Add User Form */}
          <div className="lg:col-span-1 bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Add New User</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Full Name</label>
                <input 
                  type="text" 
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 font-bold text-sm focus:border-blue-600 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 font-bold text-sm focus:border-blue-600 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Security PIN / Password</label>
                <input 
                  type="text" 
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 font-bold text-sm focus:border-blue-600 outline-none transition-all"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Access Level</label>
                <select 
                  value={newUserRole}
                  onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-slate-900 font-bold text-sm focus:border-blue-600 outline-none transition-all"
                >
                  <option value="Viewer">Viewer (Read Only)</option>
                  <option value="Editor">Editor (Full CRM Access)</option>
                  <option value="Admin">Admin (Full Control)</option>
                </select>
              </div>
              <button 
                type="submit"
                className="w-full px-6 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl"
              >
                Create User Profile
              </button>
            </form>
          </div>

          {/* User List Table */}
          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 font-mono">Managed Personnel ({users.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2">
                <thead>
                  <tr className="text-[9px] font-black uppercase tracking-widest text-slate-400">
                    <th className="px-4 py-2">User Information</th>
                    <th className="px-4 py-2">Access Level</th>
                    <th className="px-4 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.map((u: User) => (
                    <tr key={u.id} className="bg-white border border-slate-100 rounded-2xl overflow-hidden group">
                      <td className="px-4 py-4 rounded-l-2xl">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                            u.role === 'Admin' ? 'bg-blue-100 text-blue-600' : 
                            u.role === 'Editor' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {u.name.charAt(0)}
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-800">{u.name} {u.id === currentUser.id && <span className="text-[8px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full ml-1">YOU</span>}</div>
                            <div className="text-[10px] font-bold text-slate-400 font-mono">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <select 
                          value={u.role}
                          disabled={u.id === currentUser.id}
                          onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-[10px] font-black uppercase tracking-tight outline-none focus:border-blue-400 disabled:opacity-50"
                        >
                          <option value="Admin">Admin</option>
                          <option value="Editor">Editor</option>
                          <option value="Viewer">Viewer</option>
                        </select>
                      </td>
                      <td className="px-4 py-4 rounded-r-2xl text-right">
                        {u.id !== currentUser.id && (
                          <button 
                            onClick={() => handleDeleteUser(u.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          >
                            <Trash2 size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportsSection({ 
  records, pricing, dateStart, setDateStart, dateEnd, setDateEnd, 
  itemFilter, setItemFilter, classFilter, setClassFilter 
}: any) {
  const itemNames = Object.keys(pricing);

  const filteredData = useMemo(() => {
    return records.filter((r: SaleRecord) => {
      const matchesDateStart = !dateStart || r.date >= dateStart;
      const matchesDateEnd = !dateEnd || r.date <= dateEnd;
      const matchesClass = classFilter === 'All' || r.studentClass === classFilter;
      const matchesItem = itemFilter === 'All' || r.items.some(i => i.item === itemFilter);
      return matchesDateStart && matchesDateEnd && matchesClass && matchesItem;
    });
  }, [records, dateStart, dateEnd, classFilter, itemFilter]);

  const reportStats = useMemo(() => {
    const totalRev = filteredData.reduce((sum: number, r: SaleRecord) => sum + r.totalAmount, 0);
    const totalPaid = filteredData.reduce((sum: number, r: SaleRecord) => sum + (r.paidAmount || 0), 0);
    const totalPending = totalRev - totalPaid;
    const totalItems = filteredData.reduce((sum: number, r: SaleRecord) => sum + r.items.reduce((s, i) => s + i.qty, 0), 0);

    // Sales by Date for Chart
    const dateMap: Record<string, number> = {};
    const itemMap: Record<string, number> = {};
    const classMap: Record<string, number> = {};

    filteredData.forEach((r: SaleRecord) => {
      dateMap[r.date] = (dateMap[r.date] || 0) + r.totalAmount;
      r.studentClass && (classMap[r.studentClass] = (classMap[r.studentClass] || 0) + r.totalAmount);
      r.items.forEach(i => {
        itemMap[i.item] = (itemMap[i.item] || 0) + (i.qty * i.rate);
      });
    });

    const timeline = Object.entries(dateMap)
      .map(([date, amount]) => ({ date, amount }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const itemContribution = Object.entries(itemMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const classContribution = Object.entries(classMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return { totalRev, totalPaid, totalPending, totalItems, timeline, itemContribution, classContribution };
  }, [filteredData]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
        <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
          <Sliders size={14} className="text-blue-500" /> Advanced Report Filters
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Start Date</label>
            <input type="date" value={dateStart} onChange={e => setDateStart(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-medium" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">End Date</label>
            <input type="date" value={dateEnd} onChange={e => setDateEnd(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-medium" />
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Filter by Item</label>
            <select value={itemFilter} onChange={e => setItemFilter(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-medium">
              <option value="All">All Items</option>
              {itemNames.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1">Filter by Class</label>
            <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-medium">
              <option value="All">All Classes</option>
              {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Report Revenue', val: `₹${reportStats.totalRev}`, bgColor: 'bg-blue-50', textColor: 'text-blue-600', icon: TrendingUp },
          { label: 'Amount Collected', val: `₹${reportStats.totalPaid}`, bgColor: 'bg-emerald-50', textColor: 'text-emerald-600', icon: CreditCard },
          { label: 'Outstanding', val: `₹${reportStats.totalPending}`, bgColor: 'bg-amber-50', textColor: 'text-amber-600', icon: History },
          { label: 'Items Sold', val: reportStats.totalItems, bgColor: 'bg-indigo-50', textColor: 'text-indigo-600', icon: Package },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className={`p-2 ${stat.bgColor} ${stat.textColor} rounded-lg w-fit mb-3`}>
              <stat.icon size={16} />
            </div>
            <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 leading-none mb-1">{stat.label}</div>
            <div className="text-xl font-black text-slate-900 font-mono">{stat.val}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-[400px]">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Revenue Timeline</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={reportStats.timeline}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip 
                   contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                   labelStyle={{ fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="amount" stroke="#2563eb" strokeWidth={3} dot={{ r: 4, fill: '#2563eb' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-[400px]">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Revenue by Item</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportStats.itemContribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" hide />
                <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} width={100} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm h-[400px] lg:col-span-2">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-6">Revenue by Class</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reportStats.classContribution}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditRecordModal({ record, onClose, onUpdate, pricing, customFields }: any) {
  const [studentName, setStudentName] = useState(record.name);
  const [studentClass, setStudentClass] = useState(record.studentClass);
  const [transactionDate, setTransactionDate] = useState(() => {
    // Try to parse display date back to ISO date for the input
    const parts = record.date.split('/');
    if (parts.length === 3) {
      // Assuming DD/MM/YYYY from en-IN
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
  });
  const [generalNotes, setGeneralNotes] = useState(record.notes || '');
  const [paymentMode, setPaymentMode] = useState(record.paymentMode);
  const [paidAmount, setPaidAmount] = useState(record.paidAmount?.toString() || '');
  const [paymentDate, setPaymentDate] = useState(record.paymentDate || new Date().toISOString().split('T')[0]);
  const [cart, setCart] = useState<CartItem[]>(record.items);
  const [customValues, setCustomValues] = useState(record.customValues || {});
  const [discountAmount, setDiscountAmount] = useState<string>(record.discount?.toString() || '0');
  
  const [newItem, setNewItem] = useState({
    item: Object.keys(pricing)[0] || '',
    size: pricing[Object.keys(pricing)[0]] ? Object.keys(pricing[Object.keys(pricing)[0]])[0] : '',
    qty: 1,
    notes: ''
  });

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.qty * item.rate), 0), [cart]);
  
  const finalPayable = useMemo(() => {
    const discount = Number(discountAmount) || 0;
    return Math.max(0, cartTotal - discount);
  }, [cartTotal, discountAmount]);

  const currentRate = useMemo(() => {
    return pricing[newItem.item]?.[newItem.size] || 0;
  }, [pricing, newItem.item, newItem.size]);

  const handleUpdate = () => {
    if (!studentName.trim() || cart.length === 0) return;
    
    const displayDate = new Date(transactionDate).toLocaleDateString('en-IN');
    const updates: any = {
      name: studentName,
      studentClass,
      date: displayDate,
      items: cart,
      totalAmount: finalPayable,
      discount: Number(discountAmount) || 0,
      paymentMode,
      notes: generalNotes.trim(),
      customValues
    };

    if (paymentMode !== 'Pending') {
      updates.paidAmount = Number(paidAmount);
      updates.paymentDate = paymentDate;
    } else {
      updates.paidAmount = null; // Use null or delete to clear in Firestore
      updates.paymentDate = null;
    }

    onUpdate(record.id, updates);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="bg-slate-900 px-6 py-4 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl"><Pencil size={18} /></div>
            <div>
              <h3 className="font-black uppercase text-xs tracking-widest leading-none">Edit Record</h3>
              <p className="text-[10px] text-slate-400 font-mono mt-1">SR NO #{record.srNo}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-all"><X size={20} /></button>
        </div>

        <div className="p-6 overflow-y-auto custom-scroll space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Date</label>
              <input type="date" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-medium" />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Class</label>
              <select value={studentClass} onChange={e => setStudentClass(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-medium">
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Student Name</label>
            <input type="text" value={studentName} onChange={e => setStudentName(e.target.value)} className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium" />
          </div>

          {customFields.length > 0 && (
            <div className="grid grid-cols-2 gap-4">
              {customFields.map((field: any) => (
                <div key={field.id} className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase ml-1">{field.label}</label>
                  <input 
                    type={field.type} 
                    value={customValues[field.id] || ''} 
                    onChange={e => setCustomValues((p: any) => ({ ...p, [field.id]: e.target.value }))}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-medium"
                  />
                </div>
              ))}
            </div>
          )}

          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <select value={newItem.item} onChange={e => setNewItem(p => ({ ...p, item: e.target.value, size: Object.keys(pricing[e.target.value] || {})[0] || '' }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs">
                {Object.keys(pricing).map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <select value={newItem.size} onChange={e => setNewItem(p => ({ ...p, size: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs">
                {Object.keys(pricing[newItem.item] || {}).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="flex gap-2">
              <input type="number" value={newItem.qty} onChange={e => setNewItem(p => ({ ...p, qty: Number(e.target.value) }))} className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs" />
              <div className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-3 flex items-center text-xs font-bold text-slate-600">₹ {currentRate}</div>
              <button 
                onClick={() => {
                  const item: CartItem = { id: crypto.randomUUID(), item: newItem.item, size: newItem.size, qty: newItem.qty, rate: currentRate };
                  if (newItem.notes.trim()) item.notes = newItem.notes.trim();
                  setCart(p => [...p, item]);
                  setNewItem(p => ({ ...p, qty: 1, notes: '' }));
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
              >
                Add
              </button>
            </div>
          </div>

          {cart.length > 0 && (
            <div className="space-y-2 max-h-40 overflow-y-auto custom-scroll pr-2">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                  <div className="text-[11px] font-bold text-slate-700 capitalize">{item.item} - {item.size} <span className="text-slate-400 font-mono">x {item.qty}</span></div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono font-black text-slate-900">₹ {item.qty * item.rate}</span>
                    <button onClick={() => setCart(p => p.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600 transition-colors"><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase ml-1">Notes</label>
            <textarea value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium min-h-[60px]" placeholder="Add remarks..." />
          </div>

          <div className="p-4 bg-slate-900 rounded-2xl text-white space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-800">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Cart Subtotal</span>
              <span className="text-sm font-black font-mono text-slate-300">₹ {cartTotal}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Discount Applied</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">-</span>
                <input 
                  type="number" 
                  value={discountAmount} 
                  onChange={e => setDiscountAmount(e.target.value)} 
                  placeholder="₹"
                  className="w-16 bg-slate-800 border-b border-slate-700 text-right px-1 py-0.5 text-xs text-blue-400 font-bold outline-none"
                />
              </div>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-slate-800">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Final Payable</span>
              <span className="text-lg font-black font-mono text-blue-400">₹ {finalPayable}</span>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none">
                <option value="Pending">Pending</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
              </select>
              {paymentMode !== 'Pending' && (
                <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white outline-none" placeholder="Paid ₹" />
              )}
            </div>
          </div>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-100 transition-all">Cancel</button>
          <button onClick={handleUpdate} className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">Save Changes</button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Sub-components (extracted for tabs) ---

function SearchableSelect({ 
  options, 
  value, 
  onChange, 
  placeholder = "Select an option...", 
  disabled = false,
  label = ""
}: { 
  options: string[], 
  value: string, 
  onChange: (val: string) => void, 
  placeholder?: string,
  disabled?: boolean,
  label?: string
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filteredOptions = options.filter(opt => 
    opt.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="relative space-y-1">
      {label && <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">{label}</label>}
      <div 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full px-4 py-3 bg-white border ${isOpen ? 'border-blue-500 ring-4 ring-blue-50' : 'border-slate-200'} rounded-2xl flex items-center justify-between cursor-pointer transition-all ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span className={`text-sm font-bold ${value ? 'text-slate-900' : 'text-slate-400'}`}>
          {value || placeholder}
        </span>
        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>

      <AnimatePresence>
        {isOpen && !disabled && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
            >
              <div className="p-2 border-b border-slate-50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    autoFocus
                    type="text"
                    placeholder="Search options..."
                    className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 rounded-xl outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all font-medium"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              </div>
              <div className="max-h-48 overflow-y-auto custom-scroll p-1">
                {filteredOptions.length > 0 ? (
                  filteredOptions.map((opt) => (
                    <div 
                      key={opt}
                      onClick={(e) => {
                        e.stopPropagation();
                        onChange(opt);
                        setIsOpen(false);
                        setSearch('');
                      }}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between cursor-pointer transition-colors ${
                        value === opt ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt}
                      {value === opt && <Check size={14} />}
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest italic">
                    No results found
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function PriceConfigSection({ pricing, handlePriceChange, renameItem, renameSize, addNewItem, deleteItem, addNewSize, deleteSize, newItem, setNewItem, can }: any) {
  return (
    <section className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
      <div className="bg-slate-50 px-5 py-4 border-b border-slate-200 flex justify-between items-center">
        <h2 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
          <Settings size={14} className="text-blue-500" />
          Price Configuration
        </h2>
      </div>
      
      <div className="p-5 overflow-x-auto custom-scroll">
        <div className="flex gap-6 min-w-max pb-4">
          <AnimatePresence mode="popLayout">
            {Object.entries(pricing).map(([item, sizes]: [string, any]) => (
              <motion.div 
                key={item} 
                layout
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-80 bg-slate-50/50 rounded-2xl border border-slate-200 flex flex-col overflow-hidden shrink-0 group/item transition-shadow hover:shadow-xl hover:shadow-slate-200/50"
              >
                {/* Header: Item Name */}
                <div className="bg-white px-5 py-4 border-b border-slate-200 flex justify-between items-center">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-500">
                      <Package size={16} />
                    </div>
                    {can('edit') ? (
                      <input 
                        type="text"
                        defaultValue={item}
                        aria-label={`Rename item ${item}`}
                        onBlur={(e) => renameItem(item, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="text-[11px] font-black text-slate-800 uppercase tracking-widest bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-500 outline-none w-full transition-all cursor-edit"
                      />
                    ) : (
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{item}</span>
                    )}
                  </div>
                  {can('delete') && (
                    <button 
                      onClick={() => deleteItem(item)}
                      aria-label={`Delete ${item}`}
                      className="text-slate-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all ml-2"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>

                {/* Sub-headings Row */}
                <div className="grid grid-cols-3 px-5 py-3 bg-slate-100/80 border-b border-slate-200">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Size</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Quantity</span>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Price</span>
                </div>

                {/* Rows Area */}
                <div className="flex-1 overflow-y-auto max-h-[400px] custom-scroll">
                  {Object.entries(sizes).map(([size, price]: [string, any]) => (
                    <div key={size} className="grid grid-cols-3 items-center px-5 py-3 border-b border-slate-100 hover:bg-white transition-colors group/row">
                      {can('edit') ? (
                        <input 
                          type="text"
                          defaultValue={size}
                          onBlur={(e) => renameSize(item, size, e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                          className="text-[10px] font-bold text-slate-600 uppercase bg-transparent outline-none border-b border-transparent hover:border-blue-200 transition-all w-full pr-2"
                        />
                      ) : (
                        <span className="text-[10px] font-bold text-slate-600 uppercase truncate pr-2">{size}</span>
                      )}
                      <div className="text-[10px] text-slate-400 font-mono font-medium text-center">1 Unit</div>
                      <div className="flex items-center justify-end gap-1 relative">
                        <span className="text-[10px] text-slate-400 font-bold">₹</span>
                        {can('edit') ? (
                          <input 
                            type="number" 
                            value={price}
                            onChange={(e) => handlePriceChange(item, size, Number(e.target.value))}
                            className="w-16 text-right text-[11px] font-black text-slate-900 bg-transparent outline-none"
                          />
                        ) : (
                          <span className="text-[11px] font-black text-slate-900">{price}</span>
                        )}
                        {can('delete') && (
                          <button 
                            onClick={() => deleteSize(item, size)}
                            className="absolute -right-4 text-slate-200 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-all p-1"
                          >
                            <X size={10} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  
                  {Object.entries(sizes).length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-2 opacity-40">
                      <Hash size={24} className="text-slate-300" />
                      <p className="text-[10px] font-bold uppercase tracking-widest">No sizes added</p>
                    </div>
                  )}
                </div>

                {/* Footer: Add New Size Form */}
                {can('add') && (
                  <form 
                    onSubmit={(e) => addNewSize(item, e)}
                    className="p-4 bg-white border-t border-slate-200 mt-auto"
                  >
                    <div className="flex gap-2">
                      <input name="size" placeholder="SIZE" className="w-16 px-3 py-2 text-[10px] uppercase font-black bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all text-center" required />
                      <input name="price" type="number" placeholder="PRICE ₹" className="flex-1 px-3 py-2 text-[10px] font-bold bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 focus:bg-white transition-all" required />
                      <button type="submit" className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-md shadow-blue-500/20">
                        <Plus size={14} strokeWidth={3} />
                      </button>
                    </div>
                  </form>
                )}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add New Item Column Form */}
          {can('add') && (
            <div className="w-80 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex flex-col shrink-0 overflow-hidden hover:border-blue-300 hover:bg-blue-50/20 transition-all group/newitem">
               <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 group-hover/newitem:text-blue-500 group-hover/newitem:scale-110 transition-all">
                    <PlusCircle size={24} strokeWidth={1.5} />
                  </div>
                  <div>
                     <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">New Category</h3>
                     <p className="text-[10px] text-slate-400 font-medium">Add a new item to price list</p>
                  </div>
                  <form onSubmit={addNewItem} className="w-full space-y-3">
                    <input 
                      name="itemName"
                      placeholder="Item Name (e.g. Tie)"
                      className="w-full px-4 py-3 text-xs text-center border border-slate-200 rounded-xl bg-white focus:border-blue-500 outline-none transition-all font-semibold shadow-sm"
                      required
                    />
                    <button type="submit" className="w-full bg-slate-900 text-white font-black text-[10px] py-3 rounded-xl tracking-[0.2em] hover:bg-blue-600 transition-all shadow-lg active:scale-95">
                      CREATE COLUMN
                    </button>
                  </form>
               </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function SalesFormSection({ 
  showConfig, setShowConfig, formError, srNo, setSrNo, transactionDate, setTransactionDate, 
  studentName, setStudentName, studentClass, setStudentClass, generalNotes, setGeneralNotes, newItem, setNewItem, pricing, currentRate, customFields, customValues, 
  setCustomValues, discountAmount, setDiscountAmount, finalPayable, addToCart, cart, cartTotal, removeFromCart, onSubmitClick, 
  paymentMode, setPaymentMode, paidAmount, setPaidAmount, paymentDate, setPaymentDate,
  addCustomField, removeCustomField, updateCustomField, recentRecords, can
}: any) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
          <div className="bg-blue-600 px-6 py-5 text-white flex justify-between items-center">
            <div>
              <h2 className="font-black uppercase text-[10px] tracking-widest opacity-80">Point of Sale</h2>
              <h3 className="font-black text-lg tracking-tight">New Transaction</h3>
            </div>
            {can('manage-users') && ( // Use manage-users as a proxy for 'Admin' level config
              <button 
                onClick={() => setShowConfig(!showConfig)}
                className={`p-2 rounded-xl transition-all ${showConfig ? 'bg-white text-blue-600 shadow-lg' : 'bg-blue-500 hover:bg-blue-400'}`}
              >
                <Sliders size={20} />
              </button>
            )}
          </div>
          
          <AnimatePresence>
            {showConfig && can('manage-users') && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-slate-900 text-white overflow-hidden">
                <div className="p-6 space-y-4">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Custom Form Fields</h3>
                  <div className="space-y-2 max-h-56 overflow-y-auto custom-scroll pr-2">
                    {customFields.map((field: any) => (
                      <div key={field.id} className="flex gap-2 bg-slate-800 p-2.5 rounded-xl border border-slate-700">
                        <input type="text" value={field.label} onChange={(e) => updateCustomField(field.id, { label: e.target.value })} className="bg-transparent text-xs font-bold w-full outline-none focus:text-blue-400" />
                        <select value={field.type} onChange={(e) => updateCustomField(field.id, { type: e.target.value as any })} className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[9px] font-black uppercase outline-none text-slate-400">
                          <option value="text">TEXT</option>
                          <option value="number">NUM</option>
                          <option value="date">DATE</option>
                        </select>
                        <button onClick={() => removeCustomField(field.id)} className="text-slate-600 hover:text-red-400 transition-colors px-1"><X size={16} /></button>
                      </div>
                    ))}
                  </div>
                  <form onSubmit={addCustomField} className="space-y-3 pt-4 border-t border-slate-800">
                    <div className="grid grid-cols-2 gap-3">
                      <input name="label" placeholder="Grade/Section" className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-blue-500" required />
                      <select name="type" className="bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-xs outline-none">
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                      </select>
                    </div>
                    <button type="submit" className="bg-blue-600 text-white py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 w-full flex items-center justify-center gap-2 shadow-lg shadow-blue-500/10">
                      <Plus size={14} /> ADD FIELD
                    </button>
                  </form>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="p-8 space-y-8">
            {formError && <div className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 text-xs font-bold text-center animate-shake uppercase tracking-wider">{formError}</div>}
            
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">SR Number</label>
                <div className="relative">
                  <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                  <input 
                    disabled={!can('add')}
                    value={srNo} 
                    onChange={(e) => setSrNo(Number(e.target.value))} 
                    type="number" 
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all disabled:opacity-50" 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">Bill Date</label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={16} />
                  <input 
                    disabled={!can('add')}
                    value={transactionDate} 
                    onChange={(e) => setTransactionDate(e.target.value)} 
                    type="date" 
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all disabled:opacity-50" 
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">Student Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                  <input 
                    disabled={!can('add')}
                    value={studentName} 
                    onChange={(e) => setStudentName(e.target.value)} 
                    type="text" 
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all disabled:opacity-50" 
                    placeholder="Enter name..." 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <SearchableSelect 
                  label="Assigned Class"
                  options={CLASSES}
                  value={studentClass}
                  disabled={!can('add')}
                  onChange={(val) => setStudentClass(val)}
                  placeholder="Select class..."
                />
              </div>
            </div>

            <div className="p-6 bg-slate-50/50 rounded-3xl border border-slate-100 space-y-6">
              <div className="flex items-center gap-3 mb-2">
                 <div className="h-1 w-8 bg-blue-600 rounded-full" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Inventory Selection</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SearchableSelect 
                  label="Category / Item"
                  options={Object.keys(pricing)}
                  value={newItem.item}
                  disabled={!can('add')}
                  onChange={(val) => setNewItem((p: any) => ({ ...p, item: val, size: Object.keys(pricing[val] || {})[0] }))}
                  placeholder="Select item..."
                />
                <SearchableSelect 
                  label="Size / Variant"
                  options={Object.keys(pricing[newItem.item] || {})}
                  value={newItem.size}
                  disabled={!can('add')}
                  onChange={(val) => setNewItem((p: any) => ({ ...p, size: val }))}
                  placeholder="Select size..."
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <div className="absolute inset-y-0 left-4 flex items-center text-[10px] font-black text-slate-400 uppercase">Qty</div>
                  <input 
                    disabled={!can('add')}
                    value={newItem.qty} 
                    onChange={(e) => setNewItem((p: any) => ({ ...p, qty: Number(e.target.value) }))} 
                    type="number" 
                    min="1" 
                    className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-mono font-black disabled:opacity-50" 
                  />
                </div>
                <div className="px-5 py-3 bg-slate-100 border border-slate-200 rounded-2xl text-slate-600 font-mono font-black text-sm flex items-center transition-colors">
                  <span className="text-[10px] mr-auto uppercase tracking-widest text-slate-400">Unit Price</span>
                  ₹ {currentRate}
                </div>
              </div>
              
              {customFields.length > 0 && (
                <div className="grid grid-cols-2 gap-4">
                  {customFields.map((field: any) => (
                    <div key={field.id} className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400 ml-2 tracking-widest">{field.label}</label>
                      <input 
                        disabled={!can('add')}
                        type={field.type} 
                        value={customValues[field.id] || ''} 
                        onChange={(e) => setCustomValues((p: any) => ({ ...p, [field.id]: e.target.value }))} 
                        className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none text-xs font-bold disabled:opacity-50" 
                      />
                    </div>
                  ))}
                </div>
              )}

              {can('add') && (
                <button onClick={addToCart} className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-3 shadow-xl hover:translate-y-[-2px] active:translate-y-0 uppercase tracking-widest text-[10px]">
                  <PlusCircle size={18} /> Append to Shipment
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 text-xs">Transaction Remarks</label>
              <textarea 
                disabled={!can('add')}
                value={generalNotes} 
                onChange={(e) => setGeneralNotes(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-3xl outline-none text-sm font-medium resize-none min-h-[100px] focus:ring-4 focus:ring-blue-50 transition-all disabled:opacity-50"
                placeholder="Optional notes for this sale (appears on ledger)..."
              />
            </div>
          </div>
        </section>

        <div className="space-y-6">
          <section className="bg-slate-900 rounded-3xl shadow-xl overflow-hidden text-white flex flex-col h-fit">
            <div className="p-6 border-b border-slate-800">
               <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-4">Cart Summary</h3>
               {cart.length === 0 ? (
                 <div className="py-12 flex flex-col items-center justify-center text-center space-y-3 opacity-30">
                    <History size={40} />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Cart is empty</p>
                 </div>
               ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scroll pr-2 mb-6">
                  <AnimatePresence mode="popLayout">
                    {cart.map((item: any) => (
                      <motion.div 
                        key={item.id} 
                        layout
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="flex justify-between items-center bg-slate-800 p-3 rounded-2xl border border-slate-700/50 group"
                      >
                         <div className="flex-1">
                           <div className="text-[11px] font-black uppercase tracking-tight text-slate-200">{item.item}</div>
                           <div className="text-[9px] font-bold text-slate-500 uppercase">{item.size} &bull; Qty: {item.qty}</div>
                         </div>
                         <div className="flex items-center gap-3">
                            <span className="text-xs font-black font-mono">₹{item.qty * item.rate}</span>
                            {can('add') && (
                              <button onClick={() => removeFromCart(item.id)} className="text-slate-600 hover:text-red-400 p-1.5 rounded-xl hover:bg-slate-700 transition-all"><X size={14} /></button>
                            )}
                         </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
               )}
            </div>
            
            <div className="p-8 space-y-5 bg-gradient-to-b from-slate-900 to-black">
               <div className="flex justify-between items-center text-slate-400">
                  <span className="text-[10px] font-black uppercase tracking-widest">Subtotal</span>
                  <span className="text-sm font-black font-mono">₹ {cartTotal}</span>
               </div>
               
               <div className="flex justify-between items-center group">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 group-hover:text-amber-500 transition-colors">Discount</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600">-</span>
                    <input 
                      disabled={!can('add')}
                      type="number" 
                      value={discountAmount} 
                      onChange={(e) => setDiscountAmount(e.target.value)} 
                      placeholder="₹0"
                      className="w-16 bg-transparent border-b border-slate-700 focus:border-amber-500 text-right px-1 py-1 text-xs text-amber-500 font-black outline-none transition-all disabled:opacity-50"
                    />
                  </div>
               </div>

               <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                  <span className="text-xs font-black uppercase tracking-[0.2em] text-blue-500">Net Payable</span>
                  <span className="text-2xl font-black font-mono text-white tracking-tighter">₹ {finalPayable}</span>
               </div>

               <div className="space-y-3 pt-2">
                  <label className="text-[9px] font-black uppercase tracking-widest text-slate-500">Settlement Method</label>
                  <select 
                    disabled={!can('add')}
                    value={paymentMode} 
                    onChange={(e) => setPaymentMode(e.target.value)} 
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none transition-all disabled:opacity-50"
                  >
                    <option value="Pending">🕒 Pending / Credit</option>
                    <option value="UPI">💳 UPI Payment</option>
                    <option value="Cash">💵 Cash Payment</option>
                  </select>
                  
                  {paymentMode !== 'Pending' && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                       <input 
                        disabled={!can('add')}
                        type="number" 
                        value={paidAmount} 
                        onChange={(e) => setPaidAmount(e.target.value)} 
                        placeholder="Amount Paid ₹" 
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none disabled:opacity-50" 
                      />
                       <input 
                        disabled={!can('add')}
                        type="date" 
                        value={paymentDate} 
                        onChange={(e) => setPaymentDate(e.target.value)} 
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs font-bold text-white outline-none font-mono disabled:opacity-50" 
                      />
                    </motion.div>
                  )}
               </div>

               {can('add') && (
                 <button 
                  onClick={onSubmitClick}
                  disabled={cart.length === 0 || !studentName.trim()}
                  className="w-full bg-blue-600 text-white font-black py-4 rounded-2xl mt-4 shadow-2xl shadow-blue-500/20 hover:bg-blue-500 hover:translate-y-[-2px] active:translate-y-0 transition-all uppercase tracking-[0.2em] text-[11px] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed group"
                 >
                   POST TRANSACTION <ChevronRight className="inline-block ml-1 group-hover:translate-x-1 transition-transform" size={14} />
                 </button>
               )}
            </div>
          </section>

          {/* Recent Records Sidebar */}
          <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
             <div className="px-5 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2"><History size={12} /> Recent History</span>
                <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
             </div>
             <div className="p-4 space-y-3">
                {recentRecords.length === 0 ? (
                  <p className="text-[10px] text-center py-6 text-slate-400 font-bold uppercase tracking-widest opacity-50">No activity yet</p>
                ) : (
                  recentRecords.map((r: any) => (
                    <div key={r.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-blue-100 transition-all group">
                       <div className="flex justify-between items-start mb-1">
                          <span className="text-[11px] font-black text-slate-800 uppercase line-clamp-1">{r.name}</span>
                          <span className="text-[9px] font-mono font-bold text-blue-600">₹{r.totalAmount}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">{r.date} &bull; {r.studentClass}</span>
                          <div className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded ${
                            r.paymentMode === 'Pending' ? 'text-amber-600 bg-amber-50' : 
                            r.paymentMode === 'UPI' ? 'text-indigo-600 bg-indigo-50' : 'text-emerald-600 bg-emerald-50'
                          }`}>
                            {r.paymentMode}
                          </div>
                       </div>
                    </div>
                  ))
                )}
             </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function BulkActionBar({ selectedCount, onClear, onBulkDelete, onBulkStatusUpdate, can }: any) {
  return (
    <motion.div 
      initial={{ y: 100, x: '-50%', opacity: 0 }}
      animate={{ y: 0, x: '-50%', opacity: 1 }}
      exit={{ y: 100, x: '-50%', opacity: 0 }}
      className="fixed bottom-10 left-1/2 z-[100] bg-slate-900 shadow-2xl text-white px-6 py-4 rounded-3xl flex items-center gap-6 border border-slate-700/50 backdrop-blur-md"
    >
      <div className="flex items-center gap-3 pr-6 border-r border-slate-700">
        <div className="bg-blue-600 text-white w-8 h-8 rounded-full flex items-center justify-center font-black text-xs shadow-lg shadow-blue-500/20">{selectedCount}</div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Selected</span>
      </div>
      
      {can('edit') && (
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onBulkStatusUpdate('UPI')}
            className="px-4 py-2 hover:bg-slate-800 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
          >
            <CreditCard size={14} className="text-indigo-400" /> Mark UPI
          </button>
          <button 
            onClick={() => onBulkStatusUpdate('Cash')}
            className="px-4 py-2 hover:bg-slate-800 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
          >
            <span className="w-3.5 h-3.5 flex items-center justify-center text-emerald-400 font-bold">₹</span> Mark Cash
          </button>
          <button 
            onClick={() => onBulkStatusUpdate('Pending')}
            className="px-4 py-2 hover:bg-slate-800 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center gap-2"
          >
            <History size={14} className="text-amber-400" /> Mark Pending
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 pl-6 border-l border-slate-700">
        {can('delete') && (
          <button 
            onClick={onBulkDelete}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
            title="Delete selected"
          >
            <Trash2 size={18} />
          </button>
        )}
        <button 
          onClick={onClear}
          className="p-2 text-slate-400 hover:bg-slate-800 rounded-xl transition-all"
          title="Clear selection"
        >
          <X size={18} />
        </button>
      </div>
    </motion.div>
  );
}

function LedgerSection({ 
  records, 
  allRecords,
  searchQuery, 
  setSearchQuery, 
  statusFilter, 
  setStatusFilter, 
  dateStart, 
  setDateStart, 
  dateEnd, 
  setDateEnd, 
  exportCSV, 
  handlePrint, 
  deleteRecord,
  setEditingRecord,
  updateRecord,
  addRecord,
  selectedRecordIds,
  setSelectedRecordIds,
  bulkDeleteRecords,
  bulkUpdateStatus,
  customFields, 
  grandTotal, 
  pricing,
  can
}: any) {
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [quickAdd, setQuickAdd] = useState({ name: '', studentClass: CLASSES[0], notes: '' });
  const itemNames = Object.keys(pricing);

  const toggleSelectAll = () => {
    if (selectedRecordIds.length === records.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(records.map((r: any) => r.id));
    }
  };

  const toggleSelectRecord = (id: string) => {
    if (selectedRecordIds.includes(id)) {
      setSelectedRecordIds(selectedRecordIds.filter((rid: string) => rid !== id));
    } else {
      setSelectedRecordIds([...selectedRecordIds, id]);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col min-h-[70vh] overflow-hidden print:shadow-none print:border-none relative">
      <div className="px-6 py-5 border-b border-slate-100 bg-white print:hidden">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1">
            <h2 className="font-bold text-slate-800 text-lg flex items-center gap-2">
              <History className="text-blue-500" size={20} /> Sales Spreadsheet
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Managing {records.length} of {allRecords.length} records</p>
          </div>
          <div className="flex flex-wrap gap-2 w-full lg:w-auto">
            <button onClick={exportCSV} disabled={allRecords.length === 0} className="flex-1 lg:flex-none bg-emerald-50 text-emerald-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100 transition-all font-mono flex items-center justify-center gap-2 border border-emerald-100">
              <FileDown size={14} /> EXPORT CSV
            </button>
            <button onClick={handlePrint} disabled={allRecords.length === 0} className="flex-1 lg:flex-none bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-all font-mono flex items-center justify-center gap-2 border border-blue-100">
              <Printer size={14} /> PRINT PDF
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search Student..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-medium focus:border-blue-500 transition-all shadow-sm"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
              <input 
                type="date"
                value={dateStart}
                onChange={(e) => setDateStart(e.target.value)}
                className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-bold focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
            <div className="relative flex-1">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
              <input 
                type="date"
                value={dateEnd}
                onChange={(e) => setDateEnd(e.target.value)}
                className="w-full pl-8 pr-2 py-2 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-bold focus:border-blue-500 transition-all shadow-sm"
              />
            </div>
          </div>

          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-bold appearance-none focus:border-blue-500 transition-all shadow-sm"
            >
              <option value="All">All Payments</option>
              <option value="UPI">UPI Only</option>
              <option value="Cash">Cash Only</option>
              <option value="Pending">Pending Only</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
          </div>

          <button 
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
              setDateStart('');
              setDateEnd('');
            }}
            className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase hover:bg-slate-100 transition-all text-slate-500 shadow-sm"
          >
            Reset Filters
          </button>
        </div>
      </div>
      
      <div className="hidden print:block mb-8 border-b-2 border-slate-900 pb-6 uppercase font-black">
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-3xl tracking-tight">Sales Spreadsheet Report</h1>
            <p className="text-sm text-slate-500 mt-1">Generated on {new Date().toLocaleDateString()} • Next-Gen International</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-400">Ledger Count</p>
            <p className="text-lg font-black">{records.length} Transactions</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto custom-scroll print:overflow-visible pb-24">
        <table className="w-full text-left border-separate border-spacing-0 print:border-collapse print:text-[10px]">
          <thead className="sticky top-0 z-30 bg-slate-50 border-b border-slate-200 print:static print:bg-white text-[9px] uppercase tracking-widest font-black">
            {/* Top Header Row for Items */}
            <tr className="text-slate-400">
              <th rowSpan={2} className="sticky left-0 z-40 bg-slate-50 px-4 py-4 border-b border-r border-slate-100 min-w-[50px] print:hidden">
                {can('delete') && (
                  <input 
                    type="checkbox" 
                    checked={records.length > 0 && selectedRecordIds.length === records.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                )}
              </th>
              <th rowSpan={2} className="sticky left-[50px] z-40 bg-slate-50 px-4 py-4 border-b border-r border-slate-100 min-w-[50px]">Sr.</th>
              <th rowSpan={2} className="sticky left-[100px] z-40 bg-slate-50 px-4 py-4 border-b border-r border-slate-100 min-w-[100px]">Date</th>
              <th rowSpan={2} className="sticky left-[200px] z-40 bg-slate-50 px-6 py-4 border-b border-r-[2px] border-slate-200 min-w-[180px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]">Student & Notes</th>
              
              {itemNames.map(name => (
                <th key={name} colSpan={3} className="px-6 py-4 border-b border-r border-slate-200 bg-blue-50/50 text-blue-600 text-center">
                  {name}
                </th>
              ))}

              <th rowSpan={2} className="px-6 py-4 border-b border-r border-slate-100">Total Qty</th>
              <th rowSpan={2} className="px-6 py-4 border-b border-r border-slate-100 text-right min-w-[100px]">Grand Total</th>
              <th rowSpan={2} className="px-6 py-4 border-b border-slate-100 min-w-[100px]">Payment</th>
              <th rowSpan={2} className="px-6 py-4 border-b border-slate-100 print:hidden text-center">Action</th>
            </tr>
            
            {/* Sub-header Row for Size/Qty/Price */}
            <tr className="text-slate-400">
              {itemNames.map(name => (
                <React.Fragment key={`${name}-sub`}>
                  <th className="px-3 py-2 border-b border-r border-slate-100 text-[8px] font-black text-center bg-white/50 min-w-[60px]">Size</th>
                  <th className="px-3 py-2 border-b border-r border-slate-100 text-[8px] font-black text-center bg-white/50 min-w-[40px]">Qty</th>
                  <th className="px-3 py-2 border-b border-r border-slate-100 text-[8px] font-black text-right bg-white/50 min-w-[60px]">Price</th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {/* Quick Add Row */}
            {can('add') && (
              <tr className="bg-blue-50/20 group/quickadd print:hidden">
                <td className="sticky left-0 z-20 bg-blue-50/30 px-4 py-3 border-r border-slate-50"></td>
                <td className="sticky left-[50px] z-20 bg-blue-50/30 px-4 py-3 border-r border-slate-50 font-mono text-[10px] text-blue-400 font-bold italic">NEW</td>
                <td className="sticky left-[100px] z-20 bg-blue-50/30 px-4 py-3 border-r border-slate-50 font-mono text-[10px] text-slate-400 italic">Auto</td>
                <td className="sticky left-[200px] z-20 bg-blue-50/30 px-6 py-3 border-r-[2px] border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                  <div className="space-y-1">
                    <input 
                      type="text"
                      placeholder="Quick Add Name..."
                      className="w-full px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:border-blue-400 bg-white"
                      value={quickAdd.name}
                      onChange={(e) => setQuickAdd(p => ({ ...p, name: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <select
                        className="text-[9px] px-1 py-0.5 border border-slate-200 rounded outline-none bg-white font-bold"
                        value={quickAdd.studentClass}
                        onChange={(e) => setQuickAdd(p => ({ ...p, studentClass: e.target.value }))}
                      >
                        {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                      </select>
                      <input 
                        type="text"
                        placeholder="Add notes..."
                        className="text-[9px] px-2 py-0.5 border border-slate-200 rounded outline-none w-full bg-white"
                        value={quickAdd.notes}
                        onChange={(e) => setQuickAdd(p => ({ ...p, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                </td>
                {itemNames.map(name => (
                  <React.Fragment key={`quick-${name}`}>
                    <td className="px-3 py-3 border-r border-slate-50 bg-slate-50/30"></td>
                    <td className="px-3 py-3 border-r border-slate-50 bg-slate-50/30"></td>
                    <td className="px-3 py-3 border-r border-slate-50 bg-slate-50/30"></td>
                  </React.Fragment>
                ))}
                <td colSpan={3} className="px-6 py-3 text-right">
                  <button 
                    disabled={!quickAdd.name.trim()}
                    onClick={() => {
                      const timestamp = new Date().toISOString();
                      const displayDate = new Date().toLocaleDateString('en-IN');
                      const nextSr = allRecords.length > 0 ? Math.max(...allRecords.map((r:any) => r.srNo)) + 1 : 1;
                      
                      const newRec: any = {
                        id: crypto.randomUUID(),
                        srNo: nextSr,
                        name: quickAdd.name,
                        studentClass: quickAdd.studentClass,
                        items: [],
                        totalAmount: 0,
                        discount: 0,
                        date: displayDate,
                        timestamp,
                        paymentMode: 'Pending',
                        notes: quickAdd.notes
                      };
                      
                      addRecord(newRec);
                      setQuickAdd({ name: '', studentClass: CLASSES[0], notes: '' });
                    }}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-[9px] font-black uppercase tracking-widest disabled:opacity-20 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/20"
                  >
                    Quick Add
                  </button>
                </td>
              </tr>
            )}

            {records.map((rec: any) => (
              <tr key={rec.id} className={`hover:bg-slate-50 transition-colors text-xs print:hover:bg-transparent group/row ${selectedRecordIds.includes(rec.id) ? 'bg-blue-50/30' : ''}`}>
                <td className="sticky left-0 z-10 bg-inherit px-4 py-4 border-r border-slate-50 print:hidden text-center group-hover/row:bg-slate-100">
                  {can('delete') && (
                    <input 
                      type="checkbox" 
                      checked={selectedRecordIds.includes(rec.id)}
                      onChange={() => toggleSelectRecord(rec.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    />
                  )}
                </td>
                <td className="sticky left-[50px] z-10 bg-inherit px-4 py-4 font-mono font-bold text-slate-400 border-r border-slate-50 print:text-black group-hover/row:bg-slate-100">#{rec.srNo}</td>
                <td className="sticky left-[100px] z-10 bg-inherit px-4 py-4 text-slate-400 font-mono border-r border-slate-50 print:text-black group-hover/row:bg-slate-100">{rec.date}</td>
                <td className="sticky left-[200px] z-10 bg-inherit px-6 py-4 border-r-[2px] border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)] group-hover/row:bg-slate-100">
                  {can('edit') && editingCell?.id === rec.id && editingCell?.field === 'name' ? (
                    <input 
                      autoFocus
                      type="text"
                      className="w-full px-2 py-1 text-xs border border-blue-500 rounded outline-none"
                      defaultValue={rec.name}
                      onBlur={(e) => {
                        updateRecord(rec.id, { name: e.target.value });
                        setEditingCell(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <div 
                      className={`font-bold text-slate-700 uppercase leading-none rounded px-1 transition-colors ${can('edit') ? 'cursor-pointer hover:bg-blue-50/50' : ''}`}
                      onClick={() => can('edit') && setEditingCell({ id: rec.id, field: 'name' })}
                    >
                      {rec.name}
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                    {can('edit') && editingCell?.id === rec.id && editingCell?.field === 'studentClass' ? (
                      <select
                        autoFocus
                        className="text-[9px] px-1 py-0.5 border border-blue-500 rounded outline-none bg-white"
                        defaultValue={rec.studentClass}
                        onBlur={(e) => {
                          updateRecord(rec.id, { studentClass: e.target.value });
                          setEditingCell(null);
                        }}
                        onChange={(e) => {
                          updateRecord(rec.id, { studentClass: e.target.value });
                          setEditingCell(null);
                        }}
                      >
                        {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
                      </select>
                    ) : (
                      <div 
                        className={`text-[9px] text-slate-400 font-black uppercase tracking-tighter shadow-sm inline-block px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 print:border-slate-300 print:bg-transparent transition-all ${can('edit') ? 'cursor-pointer hover:border-blue-300 hover:text-blue-600' : ''}`}
                        onClick={() => can('edit') && setEditingCell({ id: rec.id, field: 'studentClass' })}
                      >
                        {rec.studentClass}
                      </div>
                    )}

                    {can('edit') && editingCell?.id === rec.id && editingCell?.field === 'notes' ? (
                      <input 
                        autoFocus
                        type="text"
                        placeholder="Add notes..."
                        className="text-[9px] px-2 py-0.5 border border-blue-500 rounded outline-none w-full"
                        defaultValue={rec.notes || ''}
                        onBlur={(e) => {
                          updateRecord(rec.id, { notes: e.target.value });
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <div 
                        className={`text-[8px] text-blue-500 font-medium italic truncate max-w-[120px] px-1 rounded ${can('edit') ? 'cursor-pointer hover:bg-blue-50' : ''}`} 
                        title={rec.notes || 'Notes'}
                        onClick={() => can('edit') && setEditingCell({ id: rec.id, field: 'notes' })}
                      >
                        &ldquo;{rec.notes || '...'}&rdquo;
                      </div>
                    )}
                  </div>
                </td>

                {/* Dynamic Item Cells */}
                {itemNames.map(itemName => {
                  const lineItem = rec.items.find((i: any) => i.item === itemName);
                  return (
                    <React.Fragment key={`${rec.id}-${itemName}`}>
                      <td className="px-3 py-4 text-center border-r border-slate-50 font-mono text-[10px]">
                        {lineItem ? lineItem.size : "-"}
                      </td>
                      <td className="px-3 py-4 text-center border-r border-slate-50 font-bold">
                        {lineItem ? lineItem.qty : ""}
                      </td>
                      <td className="px-3 py-4 text-right border-r border-slate-50 font-mono text-slate-500">
                        {lineItem ? `₹${lineItem.qty * lineItem.rate}` : ""}
                      </td>
                    </React.Fragment>
                  );
                })}

                <td className="px-6 py-4 text-center border-r border-slate-50 font-black text-slate-400">
                  {rec.items.reduce((s: number, i: any) => s + i.qty, 0)}
                </td>
                <td className="px-6 py-4 font-black text-right border-r border-slate-50 text-sm font-mono tracking-tighter print:text-black min-w-[120px]">
                  ₹ {rec.totalAmount}
                </td>
                <td className="px-6 py-4 min-w-[120px]">
                  {can('edit') && editingCell?.id === rec.id && editingCell?.field === 'paymentMode' ? (
                    <select
                      autoFocus
                      className="text-[9px] px-2 py-1 border border-blue-500 rounded outline-none bg-white w-full"
                      defaultValue={rec.paymentMode}
                      onBlur={() => setEditingCell(null)}
                      onChange={(e) => {
                        const mode = e.target.value as PaymentMode;
                        const updates: any = { paymentMode: mode };
                        if (mode !== 'Pending' && !rec.paidAmount) {
                          updates.paidAmount = rec.totalAmount;
                          updates.paymentDate = new Date().toISOString().split('T')[0];
                        } else if (mode === 'Pending') {
                          updates.paidAmount = null;
                          updates.paymentDate = null;
                        }
                        updateRecord(rec.id, updates);
                        setEditingCell(null);
                      }}
                    >
                      <option value="Pending">Pending</option>
                      <option value="UPI">UPI</option>
                      <option value="Cash">Cash</option>
                    </select>
                  ) : (
                    <div 
                      onClick={() => can('edit') && setEditingCell({ id: rec.id, field: 'paymentMode' })}
                      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border inline-block cursor-pointer transition-all ${
                        rec.paymentMode === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                        rec.paymentMode === 'UPI' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                        'bg-emerald-50 text-emerald-600 border-emerald-100'
                      } ${!can('edit') ? 'cursor-default' : ''}`}
                    >
                      {rec.paymentMode}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-center print:hidden border-l border-slate-50">
                  <div className="flex items-center justify-center gap-1">
                    {can('edit') && (
                      <button 
                        onClick={() => setEditingRecord(rec)} 
                        title="Edit record"
                        className="text-slate-300 hover:text-blue-600 p-2 rounded-xl hover:bg-blue-50 transition-all opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    {can('delete') && (
                      <button 
                        onClick={() => deleteRecord(rec.id)} 
                        title="Delete record"
                        className="text-slate-300 hover:text-red-600 p-2 rounded-xl hover:bg-red-50 transition-all opacity-0 group-hover/row:opacity-100 focus:opacity-100"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="p-6 bg-slate-900 text-white flex justify-between items-center rounded-b-2xl print:bg-white print:text-black print:border-t print:border-slate-300">
         <div className="flex gap-8">
            <div className="flex flex-col">
               <span className="text-[10px] uppercase font-black text-slate-500">Transactions</span>
               <span className="text-xl font-black">{records.length}</span>
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] uppercase font-black text-slate-500">Revenue</span>
               <span className="text-xl font-black font-mono tracking-tighter">₹ {grandTotal}</span>
            </div>
         </div>
         <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest hidden sm:block print:block">Structured CRM Data</div>
      </div>

      <AnimatePresence>
        {selectedRecordIds.length > 0 && (
          <BulkActionBar 
            selectedCount={selectedRecordIds.length}
            onClear={() => setSelectedRecordIds([])}
            onBulkDelete={() => bulkDeleteRecords(selectedRecordIds)}
            onBulkStatusUpdate={(mode: PaymentMode) => bulkUpdateStatus(selectedRecordIds, mode)}
            can={can}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, type = 'danger' }: any) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden font-sans"
      >
        <div className="p-8 space-y-6">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
            {type === 'danger' ? <Trash2 size={32} /> : <Info size={32} />}
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">{message}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={onCancel} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
            <button onClick={() => { onConfirm(); onCancel(); }} className={`flex-1 px-6 py-3 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg ${type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>Confirm</button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
