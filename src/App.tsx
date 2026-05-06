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
  User,
  Hash,
  Plus,
  X,
  Sliders,
  Calendar,
  Type,
  PieChart as PieChartIcon,
  BarChart3,
  ChevronRight,
  Search,
  ChevronDown,
  LogIn,
  LogOut,
  Mail,
  Lock
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
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  setDoc, 
  getDoc,
  getDocs,
  query,
  orderBy,
  getDocFromServer
} from 'firebase/firestore';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification
} from 'firebase/auth';
import { db, auth } from './firebase';
import { Pricing, SaleRecord, SizePricing, CartItem, CustomField, PaymentMode } from './types';
import { DEFAULT_PRICING, CLASSES } from './constants';

// --- Error Handling ---
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  // --- Auth State ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  
  const [authMode, setAuthMode] = useState<'google' | 'email-signin' | 'email-signup'>('google');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);

  // --- State ---
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pricing' | 'sales' | 'ledger' | 'reports'>('dashboard');
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

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
  const [cart, setCart] = useState<CartItem[]>([]);
  
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
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      
      if (u) {
        // Test connection
        getDocFromServer(doc(db, 'test', 'connection')).catch(err => {
          if (err.message?.includes('offline')) {
             console.error("Please check your Firebase configuration.");
          }
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Real-time pricing sync
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'pricing'), (snapshot) => {
      const newPricing: Pricing = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        newPricing[data.itemName] = data.sizes;
      });
      if (Object.keys(newPricing).length > 0) {
        setPricing(newPricing);
      }
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'pricing'));
    return () => unsub();
  }, [user]);

  // Real-time custom fields sync
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, 'customFields'), (snapshot) => {
      const fields: CustomField[] = [];
      snapshot.forEach(doc => {
        fields.push({ id: doc.id, ...doc.data() } as CustomField);
      });
      setCustomFields(fields);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'customFields'));
    return () => unsub();
  }, [user]);

  // Real-time sales records sync
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'sales'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const recs: SaleRecord[] = [];
      snapshot.forEach(doc => {
        recs.push({ id: doc.id, ...doc.data() } as SaleRecord);
      });
      setRecords(recs);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'sales'));
    return () => unsub();
  }, [user]);

  // Handle auto-increment for Sr. No.
  useEffect(() => {
    if (records.length > 0) {
      const maxSr = Math.max(...records.map(r => r.srNo || 0));
      setSrNo(maxSr + 1);
    } else {
      setSrNo(1);
    }
  }, [records]);

  // --- Computed ---
  const currentRate = useMemo(() => {
    return pricing[newItem.item]?.[newItem.size] || 0;
  }, [pricing, newItem.item, newItem.size]);

  const itemTotal = newItem.qty * currentRate;

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.qty * item.rate), 0);
  }, [cart]);

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
  const loginWithGoogle = async () => {
    setLoginLoading(true);
    setLoginError(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login failed:", error);
      if (error.code === 'auth/popup-closed-by-user') {
        setLoginError("Sign-in popup was closed before completion. Please try again.");
      } else if (error.code === 'auth/popup-blocked') {
        setLoginError("Sign-in popup was blocked by your browser. Please allow popups for this site.");
      } else {
        setLoginError(error.message || "An error occurred during sign-in.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    
    try {
      if (authMode === 'email-signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        setVerificationSent(true);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Email auth failed:", error);
      setLoginError(error.message || "Authentication failed. Please check your credentials.");
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setRecords([]);
      setPricing(DEFAULT_PRICING);
      setCustomFields([]);
      setVerificationSent(false);
      setAuthMode('google');
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handlePriceChange = async (item: string, size: string, value: number) => {
    const newSizes = { ...pricing[item], [size]: value };
    try {
      await setDoc(doc(db, 'pricing', item), {
        itemName: item,
        sizes: newSizes
      }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `pricing/${item}`);
    }
  };

  const renameItem = async (oldName: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName || cleanName === oldName || pricing[cleanName]) return;
    
    try {
      const sizes = pricing[oldName];
      await setDoc(doc(db, 'pricing', cleanName), { itemName: cleanName, sizes });
      await deleteDoc(doc(db, 'pricing', oldName));
      
      if (newItem.item === oldName) {
        setNewItem(p => ({ ...p, item: cleanName }));
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `pricing/${cleanName}`);
    }
  };

  const renameSize = async (item: string, oldSize: string, newSize: string) => {
    const cleanSize = newSize.trim();
    if (!cleanSize || cleanSize === oldSize || pricing[item][cleanSize]) return;
    
    const newSizes = { ...pricing[item] };
    const price = newSizes[oldSize];
    delete newSizes[oldSize];
    newSizes[cleanSize] = price;

    try {
      await updateDoc(doc(db, 'pricing', item), { sizes: newSizes });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pricing/${item}`);
    }
  };

  const addNewItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemName = (formData.get('itemName') as string).trim();
    if (!itemName || pricing[itemName]) return;
    
    try {
      await setDoc(doc(db, 'pricing', itemName), {
        itemName,
        sizes: {}
      });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `pricing/${itemName}`);
    }
  };

  const deleteItem = async (item: string) => {
    if (confirm(`Delete entire item "${item}" and all its associated pricing?`)) {
      try {
        await deleteDoc(doc(db, 'pricing', item));
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
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `pricing/${item}`);
      }
    }
  };

  const addNewSize = async (item: string, e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const size = (formData.get('size') as string).trim();
    const price = Number(formData.get('price'));
    
    if (!size) return;

    try {
      const newSizes = { ...pricing[item], [size]: price };
      await updateDoc(doc(db, 'pricing', item), { sizes: newSizes });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pricing/${item}`);
    }
  };

  const deleteSize = async (item: string, size: string) => {
    try {
      const newSizes = { ...pricing[item] };
      delete newSizes[size];
      await updateDoc(doc(db, 'pricing', item), { sizes: newSizes });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `pricing/${item}`);
    }
  };

  const addCustomField = async (e: React.FormEvent<HTMLFormElement>) => {
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

    try {
      await addDoc(collection(db, 'customFields'), {
        label,
        type,
        required
      });
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'customFields');
    }
  };

  const removeCustomField = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'customFields', id));
      setCustomValues(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `customFields/${id}`);
    }
  };

  const updateCustomField = async (id: string, updates: Partial<CustomField>) => {
    try {
      await updateDoc(doc(db, 'customFields', id), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `customFields/${id}`);
    }
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
      notes: newItem.notes.trim() || undefined,
      customData: { ...customValues }
    };
    setCart(prev => [...prev, item]);
    setNewItem(prev => ({ ...prev, qty: 1, notes: '' }));
    setCustomValues({});
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const submitTransaction = async () => {
    if (!studentName.trim() || cart.length === 0) return;

    const timestamp = new Date().toISOString();
    const displayDate = new Date(transactionDate).toLocaleDateString('en-IN');

    const newRecord: Omit<SaleRecord, 'id'> = {
      srNo: srNo,
      name: studentName,
      studentClass: studentClass,
      items: [...cart],
      totalAmount: cartTotal,
      date: displayDate,
      timestamp,
      paymentMode,
      paidAmount: paymentMode !== 'Pending' ? Number(paidAmount) : undefined,
      paymentDate: paymentMode !== 'Pending' ? paymentDate : undefined,
      notes: generalNotes.trim() || undefined,
      customData: undefined
    };

    try {
      await addDoc(collection(db, 'sales'), newRecord);
      setSrNo(prev => prev + 1);
      setCart([]);
      setStudentName('');
      setStudentClass(CLASSES[0]);
      setGeneralNotes('');
      setPaymentMode('Pending');
      setPaidAmount('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'sales');
    }
  };

  const deleteRecord = async (id: string) => {
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      await deleteDoc(doc(db, 'sales', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `sales/${id}`);
    }
  };

  const clearRecords = () => {
    if (confirm("Permanently delete all sales history?")) {
      setRecords([]);
    }
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
    window.print();
  };

  return (
    <div className="min-h-screen flex flex-col font-sans">
      {/* Navigation */}
      <nav className="bg-slate-900 text-white px-8 py-4 shadow-lg flex justify-between items-center sticky top-0 z-50">
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
          ].map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`${tab.id}-panel`}
              id={`${tab.id}-tab`}
              onClick={() => setActiveTab(tab.id as any)}
              onKeyDown={(e) => {
                const tabs = ['dashboard', 'pricing', 'sales', 'ledger', 'reports'];
                const idx = tabs.indexOf(activeTab);
                if (e.key === 'ArrowRight') setActiveTab(tabs[(idx + 1) % tabs.length] as any);
                if (e.key === 'ArrowLeft') setActiveTab(tabs[(idx - 1 + tabs.length) % tabs.length] as any);
              }}
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
          <div className="hidden lg:flex items-center gap-4 text-xs text-slate-400 px-4 py-1 bg-slate-800 rounded-full border border-slate-700">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Session 2026-2027
          </div>
          {user && (
            <button 
              onClick={logout}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-slate-400 rounded-xl hover:text-white hover:bg-slate-700 transition-all font-black text-[10px] uppercase tracking-widest border border-slate-700"
            >
              <LogOut size={14} /> Log Out
            </button>
          )}
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
              <p className="font-black text-slate-400 uppercase tracking-widest text-[10px]">Initializing Cloud Sync...</p>
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
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">
                  {authMode === 'email-signup' ? 'Create Account' : 
                   authMode === 'email-signin' ? 'Welcome Back' : 'Get Started'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {authMode === 'email-signup' ? 'Sign up with your organizational email.' : 
                   'Sign in to access the Uniform Sales CRM.'}
                </p>
              </div>

              {loginError && (
                <div className="w-full p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold flex items-center gap-3">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />
                  {loginError}
                </div>
              )}

              {verificationSent ? (
                <div className="w-full p-6 bg-blue-50 border border-blue-100 rounded-2xl space-y-4">
                  <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto">
                    <Mail size={24} />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-bold text-blue-900">Verify your Email</h3>
                    <p className="text-xs text-blue-700">We've sent a verification link to <strong>{email}</strong>. Please check your inbox.</p>
                  </div>
                  <button 
                    onClick={() => {
                      setVerificationSent(false);
                      setAuthMode('email-signin');
                    }}
                    className="text-xs font-black text-blue-600 uppercase tracking-widest hover:underline"
                  >
                    Back to Sign In
                  </button>
                </div>
              ) : (
                <>
                  {authMode === 'google' ? (
                    <div className="w-full space-y-4">
                      <button 
                        onClick={loginWithGoogle}
                        disabled={loginLoading}
                        className="w-full bg-slate-900 text-white flex items-center justify-center gap-3 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loginLoading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <LogIn size={18} />}
                        {loginLoading ? 'Signing In...' : 'Sign In with Google'}
                      </button>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                        <div className="relative flex justify-center text-[10px]"><span className="bg-slate-50 px-3 text-slate-400 font-bold uppercase tracking-widest leading-none">OR</span></div>
                      </div>
                      <button 
                        onClick={() => setAuthMode('email-signin')}
                        className="w-full bg-white border-2 border-slate-200 text-slate-800 flex items-center justify-center gap-3 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:border-blue-600 hover:text-blue-600 transition-all"
                      >
                        <Mail size={18} /> Continue with Email
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleEmailAuth} className="w-full space-y-4">
                      <div className="space-y-3">
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                          <input 
                            type="email" 
                            required 
                            placeholder="Organizational Email" 
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
                            placeholder="Password" 
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
                        {loginLoading ? 'Processing...' : (authMode === 'email-signup' ? 'Create Account' : 'Sign In')}
                      </button>
                      <div className="flex flex-col gap-2">
                        <button 
                          type="button"
                          onClick={() => setAuthMode(authMode === 'email-signin' ? 'email-signup' : 'email-signin')}
                          className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-blue-600 transition-colors"
                        >
                          {authMode === 'email-signin' ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                        </button>
                        <button 
                          type="button"
                          onClick={() => setAuthMode('google')}
                          className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Authorized Personnel Only</div>
            </motion.div>
          ) : !user.emailVerified && authMode !== 'google' ? (
            <motion.div 
              key="verify"
              className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 max-w-sm mx-auto text-center"
            >
              <div className="w-24 h-24 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center shadow-lg shadow-amber-500/10">
                <Mail size={48} />
              </div>
              <div className="space-y-2">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Check your Email</h2>
                <p className="text-slate-500 text-sm">Please verify your email address to access the CRM. We've sent a link to <strong>{user.email}</strong>.</p>
              </div>
              <div className="flex flex-col w-full gap-4">
                <button 
                  onClick={() => window.location.reload()}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all"
                >
                  I've Verified My Email
                </button>
                <button 
                  onClick={logout}
                  className="text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
                >
                  Sign in with a different account
                </button>
              </div>
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
                addToCart={addToCart}
                cart={cart}
                cartTotal={cartTotal}
                removeFromCart={removeFromCart}
                submitTransaction={submitTransaction}
                paymentMode={paymentMode}
                setPaymentMode={setPaymentMode}
                paidAmount={paidAmount}
                setPaidAmount={setPaidAmount}
                paymentDate={paymentDate}
                setPaymentDate={setPaymentDate}
                addCustomField={addCustomField}
                removeCustomField={removeCustomField}
                updateCustomField={updateCustomField}
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
                customFields={customFields}
                grandTotal={filteredRecords.reduce((sum, r) => sum + r.totalAmount, 0)}
                pricing={pricing}
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
          </>
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

// --- Sub-components (extracted for tabs) ---

function PriceConfigSection({ pricing, handlePriceChange, renameItem, renameSize, addNewItem, deleteItem, addNewSize, deleteSize, newItem, setNewItem }: any) {
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
                    <input 
                      type="text"
                      defaultValue={item}
                      aria-label={`Rename item ${item}`}
                      onBlur={(e) => renameItem(item, e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                      className="text-[11px] font-black text-slate-800 uppercase tracking-widest bg-transparent border-b border-transparent hover:border-blue-200 focus:border-blue-500 outline-none w-full transition-all cursor-edit"
                    />
                  </div>
                  <button 
                    onClick={() => deleteItem(item)}
                    aria-label={`Delete ${item}`}
                    className="text-slate-300 hover:text-red-500 p-2 rounded-xl hover:bg-red-50 transition-all ml-2"
                  >
                    <Trash2 size={16} />
                  </button>
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
                      <input 
                        type="text"
                        defaultValue={size}
                        onBlur={(e) => renameSize(item, size, e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                        className="text-[10px] font-bold text-slate-600 uppercase bg-transparent outline-none border-b border-transparent hover:border-blue-200 transition-all w-full pr-2"
                      />
                      <div className="text-[10px] text-slate-400 font-mono font-medium text-center">1 Unit</div>
                      <div className="flex items-center justify-end gap-1 relative">
                        <span className="text-[10px] text-slate-400 font-bold">₹</span>
                        <input 
                          type="number" 
                          value={price}
                          onChange={(e) => handlePriceChange(item, size, Number(e.target.value))}
                          className="w-16 text-right text-[11px] font-black text-slate-900 bg-transparent outline-none"
                        />
                        <button 
                          onClick={() => deleteSize(item, size)}
                          className="absolute -right-4 text-slate-200 hover:text-red-500 opacity-0 group-row:hover:opacity-100 transition-all p-1"
                        >
                          <X size={10} />
                        </button>
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
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Add New Item Column Form */}
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
        </div>
      </div>
    </section>
  );
}

function SalesFormSection({ 
  showConfig, setShowConfig, formError, srNo, setSrNo, transactionDate, setTransactionDate, 
  studentName, setStudentName, studentClass, setStudentClass, generalNotes, setGeneralNotes, newItem, setNewItem, pricing, currentRate, customFields, customValues, 
  setCustomValues, addToCart, cart, cartTotal, removeFromCart, submitTransaction, 
  paymentMode, setPaymentMode, paidAmount, setPaidAmount, paymentDate, setPaymentDate,
  addCustomField, removeCustomField, updateCustomField
}: any) {
  return (
    <section className="bg-white rounded-2xl shadow-md border border-slate-200 overflow-hidden">
      <div className="bg-blue-600 px-5 py-4 text-white flex justify-between items-center">
        <h2 className="font-bold uppercase text-xs tracking-widest">New Sales Record</h2>
        <button 
          onClick={() => setShowConfig(!showConfig)}
          aria-label="Toggle custom field configuration"
          aria-expanded={showConfig}
          className={`p-1.5 rounded-lg transition-all ${showConfig ? 'bg-white text-blue-600' : 'bg-blue-500 hover:bg-blue-400'}`}
        >
          <Sliders size={16} aria-hidden="true" />
        </button>
      </div>
      
      <AnimatePresence>
        {showConfig && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-slate-900 text-white overflow-hidden">
            <div className="p-5 space-y-4">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Custom Form Fields</h3>
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scroll pr-2">
                {customFields.map((field: any) => (
                  <div key={field.id} className="flex gap-2 bg-slate-800 p-2 rounded-lg border border-slate-700">
                    <input type="text" value={field.label} onChange={(e) => updateCustomField(field.id, { label: e.target.value })} className="bg-transparent text-xs font-bold w-full outline-none focus:text-blue-400" />
                    <select value={field.type} onChange={(e) => updateCustomField(field.id, { type: e.target.value as any })} className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 text-[9px] font-black uppercase outline-none text-slate-400">
                      <option value="text">TEXT</option>
                      <option value="number">NUM</option>
                      <option value="date">DATE</option>
                    </select>
                    <button onClick={() => removeCustomField(field.id)} className="text-slate-600 hover:text-red-400 transition-colors px-1"><X size={14} /></button>
                  </div>
                ))}
              </div>
              <form onSubmit={addCustomField} className="space-y-3 pt-2 border-t border-slate-800">
                <div className="grid grid-cols-2 gap-2">
                  <input name="label" placeholder="Grade/Section" className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none" required />
                  <select name="type" className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-xs outline-none">
                    <option value="text">Text</option>
                    <option value="number">Number</option>
                    <option value="date">Date</option>
                  </select>
                </div>
                <button type="submit" className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-blue-500 w-full flex items-center justify-center gap-1">
                  <Plus size={12} /> ADD FIELD
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-6 space-y-6">
        {formError && <div className="bg-red-50 text-red-600 p-3 rounded-xl border border-red-100 text-xs font-bold text-center">{formError}</div>}
        
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label htmlFor="srNo-input" className="block text-[10px] font-black text-slate-400 uppercase ml-1">Sr. No.</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} aria-hidden="true" />
              <input id="srNo-input" value={srNo} onChange={(e) => setSrNo(Number(e.target.value))} type="number" className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-medium" />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="transactionDate-input" className="block text-[10px] font-black text-slate-400 uppercase ml-1">Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={14} aria-hidden="true" />
              <input id="transactionDate-input" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} type="date" className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-xs font-medium" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2 space-y-1">
            <label htmlFor="studentName-input" className="block text-[10px] font-black text-slate-400 uppercase ml-1">Student Name</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} aria-hidden="true" />
              <input id="studentName-input" value={studentName} onChange={(e) => setStudentName(e.target.value)} type="text" aria-required="true" className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-medium text-sm" placeholder="Full Name" />
            </div>
          </div>
          <div className="space-y-1">
            <label htmlFor="studentClass-select" className="block text-[10px] font-black text-slate-400 uppercase ml-1">Class</label>
            <select 
              id="studentClass-select" 
              value={studentClass} 
              onChange={(e) => setStudentClass(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium transition-all"
            >
              {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
            </select>
          </div>
        </div>

        <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <select value={newItem.item} onChange={(e) => setNewItem((p: any) => ({ ...p, item: e.target.value, size: Object.keys(pricing[e.target.value] || {})[0] }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm">
              {Object.keys(pricing).map(item => <option key={item} value={item}>{item}</option>)}
            </select>
            <select value={newItem.size} onChange={(e) => setNewItem((p: any) => ({ ...p, size: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm">
              {Object.keys(pricing[newItem.item] || {}).map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <input value={newItem.qty} onChange={(e) => setNewItem((p: any) => ({ ...p, qty: Number(e.target.value) }))} type="number" min="1" className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-sm" placeholder="Qty" />
            <div className="px-3 py-2 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 font-mono font-bold text-sm flex items-center">₹ {currentRate}</div>
          </div>
          <input value={newItem.notes} onChange={(e) => setNewItem((p: any) => ({ ...p, notes: e.target.value }))} type="text" placeholder="Remarks..." className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs" />
          
          {customFields.map((field: any) => (
             <div key={field.id} className="space-y-1">
               <label className="text-[9px] font-black uppercase text-slate-400 ml-1">{field.label}</label>
               <input type={field.type} value={customValues[field.id] || ''} onChange={(e) => setCustomValues((p: any) => ({ ...p, [field.id]: e.target.value }))} className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-xs font-medium" />
             </div>
          ))}

          <button onClick={addToCart} className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-xl hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg">
            <PlusCircle size={16} /> ADD TO CART
          </button>
        </div>

        <div className="space-y-1">
          <label htmlFor="generalNotes-input" className="block text-[10px] font-black text-slate-400 uppercase ml-1">Transaction Notes (General Remarks)</label>
          <textarea 
            id="generalNotes-input" 
            value={generalNotes} 
            onChange={(e) => setGeneralNotes(e.target.value)}
            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm font-medium resize-none min-h-[80px] focus:border-blue-300 transition-all"
            placeholder="Enter general remarks for this entire sale..."
          />
        </div>

        {cart.length > 0 && (
          <div className="space-y-4 pt-4 border-t border-slate-100">
             <div className="space-y-2">
                {cart.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                     <div className="text-[10px] font-bold text-slate-700">{item.item} ({item.size}) x{item.qty}</div>
                     <button onClick={() => removeFromCart(item.id)} className="text-red-400 p-1"><X size={12} /></button>
                  </div>
                ))}
             </div>
             <div className="p-4 bg-slate-900 rounded-xl text-white">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Total payable</span>
                  <span className="text-lg font-black font-mono">₹ {cartTotal}</span>
                </div>
                <div className="space-y-3">
                   <select value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none">
                      <option value="Pending">Pending / Credit</option>
                      <option value="UPI">UPI Payment</option>
                      <option value="Cash">Cash Payment</option>
                   </select>
                   {paymentMode !== 'Pending' && (
                     <div className="flex gap-2">
                        <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="Paid ₹" className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                        <input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none" />
                     </div>
                   )}
                </div>
                <button onClick={submitTransaction} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg mt-4 shadow-xl hover:bg-blue-500 text-xs">COMPLETE TRANSACTION</button>
             </div>
          </div>
        )}
      </div>
    </section>
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
  customFields, 
  grandTotal, 
  pricing 
}: any) {
  const itemNames = Object.keys(pricing);

  return (
    <div className="bg-white rounded-2xl shadow-md border border-slate-200 flex flex-col min-h-[70vh] overflow-hidden print:shadow-none print:border-none">
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
      
      <div className="flex-1 overflow-x-auto custom-scroll print:overflow-visible">
        <table className="w-full text-left border-separate border-spacing-0 print:border-collapse">
          <thead className="sticky top-0 bg-slate-50/95 backdrop-blur shadow-sm z-10 print:static print:bg-white text-[9px] uppercase tracking-widest font-black">
            {/* Top Header Row for Items */}
            <tr className="text-slate-400">
              <th rowSpan={2} className="px-4 py-4 border-b border-r border-slate-100 min-w-[50px]">Sr.</th>
              <th rowSpan={2} className="px-4 py-4 border-b border-r border-slate-100 min-w-[100px]">Date</th>
              <th rowSpan={2} className="px-6 py-4 border-b border-r border-slate-100 min-w-[150px]">Student & Notes</th>
              
              {itemNames.map(name => (
                <th key={name} colSpan={3} className="px-6 py-4 border-b border-r border-slate-200 bg-blue-50/50 text-blue-600 text-center">
                  {name}
                </th>
              ))}

              <th rowSpan={2} className="px-6 py-4 border-b border-r border-slate-100">Total Qty</th>
              <th rowSpan={2} className="px-6 py-4 border-b border-r border-slate-100 text-right min-w-[100px]">Grand Total</th>
              <th rowSpan={2} className="px-6 py-4 border-b border-slate-100 min-w-[100px]">Payment</th>
              <th rowSpan={2} className="px-6 py-4 border-b border-slate-100 print:hidden"></th>
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
            {records.map((rec: any) => (
              <tr key={rec.id} className="hover:bg-slate-50 transition-colors text-xs print:hover:bg-transparent">
                <td className="px-4 py-4 font-mono font-bold text-slate-400 border-r border-slate-50 print:text-black">#{rec.srNo}</td>
                <td className="px-4 py-4 text-slate-400 font-mono border-r border-slate-50 print:text-black">{rec.date}</td>
                <td className="px-6 py-4 border-r border-slate-50">
                  <div className="font-bold text-slate-700 uppercase leading-none">{rec.name}</div>
                  <div className="flex flex-wrap gap-2 mt-1.5 items-center">
                    <div className="text-[9px] text-slate-400 font-black uppercase tracking-tighter shadow-sm inline-block px-1.5 py-0.5 bg-slate-100 rounded border border-slate-200 print:border-slate-300 print:bg-transparent">{rec.studentClass}</div>
                    {rec.notes && (
                      <div className="text-[8px] text-blue-500 font-medium italic truncate max-w-[120px]" title={rec.notes}>
                        &ldquo;{rec.notes}&rdquo;
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
                  <div className={`px-2 py-0.5 rounded text-[8px] font-black uppercase border inline-block ${
                    rec.paymentMode === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100 print:bg-transparent print:border-slate-300' :
                    rec.paymentMode === 'UPI' ? 'bg-indigo-50 text-indigo-600 border-indigo-100 print:bg-transparent print:border-slate-300' :
                    'bg-emerald-50 text-emerald-600 border-emerald-100 print:bg-transparent print:border-slate-300'
                  }`}>{rec.paymentMode}</div>
                </td>
                <td className="px-4 py-4 text-right print:hidden">
                  <button onClick={() => deleteRecord(rec.id)} className="text-slate-200 hover:text-red-500 p-2 transition-all"><Trash2 size={14} /></button>
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
    </div>
  );
}
