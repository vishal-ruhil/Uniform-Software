import React, { useState, useEffect, useMemo, useRef } from 'react';
import { toPng, toJpeg } from 'html-to-image';
import download from 'downloadjs';
import { 
  FileSpreadsheet, 
  Settings, 
  PlusCircle, 
  Trash2, 
  FileDown, 
  Printer,
  PackageSearch,
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
  ArrowRight,
  Search,
  ChevronDown,
  ChevronUp,
  Check,
  CheckCircle2,
  Loader2,
  ArrowLeft,
  Info,
  AlertCircle,
  Tag,
  Database,
  LogIn,
  LogOut,
  Mail,
  Lock,
  UserCircle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Layout,
  Bell,
  DownloadCloud,
  Users,
  Upload,
  CloudLightning,
  Sparkles,
  CheckCircle,
  ExternalLink,
  RefreshCw,
  Share
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
import { motion, AnimatePresence, Reorder } from 'motion/react';
import * as XLSX from 'xlsx';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  addDoc, 
  deleteDoc, 
  writeBatch,
  updateDoc,
  getDocs,
  getDocFromServer
} from 'firebase/firestore';

import firebaseConfig from '../firebase-applet-config.json';
import { Pricing, SaleRecord, SizePricing, CartItem, CustomField, PaymentMode, UserRole, User } from './types';
import { DEFAULT_PRICING, CLASSES } from './constants';
import { initGsi, getAccessToken } from './services/auth';
import * as sheetService from './services/sheetService';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function testConnection() {
  try {
    // Testing connection to a dummy path as per instructions
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if(error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('Could not reach Cloud Firestore'))) {
      console.error("CRITICAL: Firestore is offline. Please check if the database is provisioned and reachable.");
    }
  }
}
testConnection();

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
  const errStack = error instanceof Error ? error.stack : 'No stack trace';
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
  }
  console.error('Firestore Error Detailed:', JSON.stringify(errInfo));
  console.error('Original Error Stack:', errStack);
  throw new Error(JSON.stringify(errInfo));
}

export default function App() {
  // --- Auth State ---
  const [user, setUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
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
  const [isOffline, setIsOffline] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  const [isSignUp, setIsSignUp] = useState(false);

  const triggerRetry = () => {
    setRetryCount(prev => prev + 1);
    setAuthLoading(true);
    setIsOffline(false);
  };
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [editingRecord, setEditingRecord] = useState<SaleRecord | null>(null);
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);

  // --- State ---
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved ? JSON.parse(saved) : false;
  });
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pricing' | 'sales' | 'ledger' | 'reports' | 'profile' | 'admin'>(() => {
    return (localStorage.getItem('active_tab') as any) || 'dashboard';
  });

  useEffect(() => {
    localStorage.setItem('active_tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('sidebar_collapsed', JSON.stringify(isSidebarCollapsed));
  }, [isSidebarCollapsed]);
  const [pricingMode, setPricingMode] = useState<'prices' | 'inventory'>('prices');
  const [pricing, setPricing] = useState<Pricing>(DEFAULT_PRICING);
  const [itemOrder, setItemOrder] = useState<string[]>([]);
  const [records, setRecords] = useState<SaleRecord[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);

  // --- Sync State ---
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSettings, setSyncSettings] = useState<{ enabled: boolean, spreadsheetId: string | null }>({ enabled: false, spreadsheetId: null });

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // --- Filter State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateStart, setDateStart] = useState('');
  const [dateEnd, setDateEnd] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ 
    key: 'srNo', 
    direction: 'desc' 
  });

  const handleSort = (key: string) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const summarizeNotes = async () => {
    if (!generalNotes.trim()) return;
    setIsSummarizing(true);
    try {
      const response = await fetch('/api/summarize-notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: generalNotes }),
      });

      if (!response.ok) throw new Error('Failed to summarize notes');
      const { summary } = await response.json();
      setGeneralNotes(summary);
      setMsg({ type: 'success', text: 'Notes summarized by Gemini AI' });
      setTimeout(() => setMsg(null), 3000);
    } catch (error: any) {
      console.error('Gemini Summary error:', error);
      setMsg({ type: 'error', text: 'Summarization Failed: ' + error.message });
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setIsSummarizing(false);
    }
  };

  const importFromSpreadsheet = async (file: File) => {
    setIsAnalyzing(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      const response = await fetch('/api/analyze-spreadsheet', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: JSON.stringify(jsonData),
          pricingContext: pricing,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to analyze spreadsheet');
      }
      
      const mappedItems = await response.json();
      
      const newItems = mappedItems.map((item: any) => ({
        id: crypto.randomUUID(),
        ...item,
        notes: item.notes || 'Imported via Gemini AI'
      }));
      
      setCart((prev: any) => [...prev, ...newItems]);
      setMsg({ type: 'success', text: `Gemini analyzed and added ${newItems.length} items to your list.` });
      setTimeout(() => setMsg(null), 4000);
    } catch (error: any) {
      console.error('Gemini Import error:', error);
      setMsg({ type: 'error', text: 'Gemini Analysis Failed: ' + error.message });
      setTimeout(() => setMsg(null), 4000);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const [itemFilter, setItemFilter] = useState<string[]>([]);
  const [classFilter, setClassFilter] = useState('All');

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
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Fetch user metadata from Firestore
        try {
          // Attempt to get user doc, if it fails with offline, we handle it
          const userDoc = await getDoc(doc(db, 'users', fbUser.uid)).catch(err => {
             if (err?.message?.includes('offline') || err?.message?.includes('reach Cloud Firestore')) {
                setIsOffline(true);
                throw err;
             }
             return getDoc(doc(db, 'users', fbUser.uid)); // Retry once
          });

          let userData: User;
          
          if (userDoc.exists()) {
            userData = userDoc.data() as User;
            userData.emailVerified = fbUser.emailVerified;
            // Force admin role for the designated emails
            const adminEmails = ['vishal@unicrm.in', 'vishaldalamwala@gmail.com', 'ruhilvishal123@gmail.com'];
            if (fbUser.email && adminEmails.includes(fbUser.email) && userData.role !== 'Admin') {
                userData.role = 'Admin';
                try {
                  await setDoc(doc(db, 'users', fbUser.uid), userData, { merge: true });
                } catch (e) {
                  console.warn("Self-promotion failed, may lack rules permission yet", e);
                }
            }
          } else {
            // Handle case where user is in Auth but not in Firestore
            const adminEmails = ['vishal@unicrm.in', 'vishaldalamwala@gmail.com', 'ruhilvishal123@gmail.com'];
            userData = {
              id: fbUser.uid,
              email: fbUser.email || '',
              name: fbUser.displayName || fbUser.email?.split('@')[0] || 'User',
              role: fbUser.email && adminEmails.includes(fbUser.email) ? 'Admin' : 'Viewer',
              createdAt: new Date().toISOString(),
              emailVerified: fbUser.emailVerified
            };
            try {
              await setDoc(doc(db, 'users', fbUser.uid), userData);
            } catch (e) {
              console.error("Failed to create user profile", e);
              if (e instanceof Error && (e.message.includes('offline') || e.message.includes('reach Cloud Firestore'))) {
                setIsOffline(true);
              }
            }
          }
          setUser(userData);
          setIsOffline(false);
        } catch (error: any) {
          if (error?.message?.includes('offline') || error?.message?.includes('reach Cloud Firestore')) {
            setIsOffline(true);
          } else {
            handleFirestoreError(error, OperationType.GET, `users/${fbUser.uid}`);
          }
        }
      } else {
        setUser(null);
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, [retryCount]);

  // Firestore Sync
  useEffect(() => {
    if (!user) return;

    // Sync Pricing
    const unsubPricing = onSnapshot(doc(db, 'users', user.id, 'pricing', 'current'), (snapshot) => {
      if (snapshot.exists()) {
        const pData = snapshot.data();
        setPricing(pData.data);
        if (pData.order && Array.isArray(pData.order)) {
          setItemOrder(pData.order);
        } else {
          setItemOrder(Object.keys(pData.data));
        }
      } else {
        // Initialize pricing if missing for EVERY new user
        setDoc(doc(db, 'users', user.id, 'pricing', 'current'), { 
          data: DEFAULT_PRICING,
          order: Object.keys(DEFAULT_PRICING)
        }).catch(err => {
           console.error("Failed to init pricing", err);
        });
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.id}/pricing/current`));

    // Sync Records
    const qSales = query(collection(db, 'users', user.id, 'sales'), orderBy('srNo', 'desc'));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ ...d.data(), id: d.id } as SaleRecord));
      setRecords(docs);
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.id}/sales`));

    // Sync Custom Fields
    const unsubFields = onSnapshot(doc(db, 'users', user.id, 'settings', 'customFields'), (snapshot) => {
      if (snapshot.exists()) {
        setCustomFields(snapshot.data().fields || []);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, `users/${user.id}/settings/customFields`));

    // Sync Users (Admin only)
    let unsubUsers: any = () => {};
    if (user.role === 'Admin') {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        const docs = snapshot.docs.map(d => d.data() as User);
        setUsers(docs);
      });
    }

    return () => {
      unsubPricing();
      unsubSales();
      unsubFields();
      unsubUsers();
    };
  }, [user]);

  // Save changes to Firestore
  const updatePricingInCloud = async (newPricing: Pricing, newOrder?: string[]) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.id, 'pricing', 'current'), { 
        data: newPricing,
        order: newOrder || itemOrder
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}/pricing/current`);
    }
  };

  const updateItemOrder = (newOrder: string[]) => {
    setItemOrder(newOrder);
    updatePricingInCloud(pricing, newOrder);
  };

  const updateFieldsInCloud = async (newFields: CustomField[]) => {
    if (!user) return;
    try {
      await setDoc(doc(db, 'users', user.id, 'settings', 'customFields'), { fields: newFields });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}/settings/customFields`);
    }
  };

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
    return (pricing[newItem.item]?.[newItem.size] as any)?.price || 0;
  }, [pricing, newItem.item, newItem.size]);

  const itemTotal = newItem.qty * currentRate;

  const cartTotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + (item.qty * item.rate), 0);
  }, [cart]);

  const finalPayable = useMemo(() => {
    const dPercent = Number(discountAmount) || 0;
    const dVal = (cartTotal * dPercent) / 100;
    return Math.max(0, cartTotal - dVal);
  }, [cartTotal, discountAmount]);

  const grandTotal = useMemo(() => {
    return records.reduce((sum, r) => sum + r.totalAmount, 0);
  }, [records]);

  const filteredRecords = useMemo(() => {
    const sorted = [...records].filter(rec => {
      const matchesSearch = rec.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'All' || rec.paymentMode === statusFilter;
      const matchesDateStart = !dateStart || rec.date >= dateStart;
      const matchesDateEnd = !dateEnd || rec.date <= dateEnd;
      const matchesItem = itemFilter.length === 0 || rec.items.some(i => itemFilter.includes(i.item));
      const matchesClass = classFilter === 'All' || rec.studentClass === classFilter;
      return matchesSearch && matchesStatus && matchesDateStart && matchesDateEnd && matchesItem && matchesClass;
    });

    return sorted.sort((a: any, b: any) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      // Handle special keys
      if (sortConfig.key === 'items') {
        valA = a.items.length;
        valB = b.items.length;
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [records, searchQuery, statusFilter, dateStart, dateEnd, itemFilter, classFilter, sortConfig]);

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

    const lowStockItems: any[] = [];
    Object.entries(pricing).forEach(([item, sizes]) => {
      const itemLowStock: any[] = [];
      Object.entries(sizes).forEach(([size, info]: [string, any]) => {
        if (info.stock <= info.minStock) {
          itemLowStock.push({ size, stock: info.stock, minStock: info.minStock });
        }
      });
      if (itemLowStock.length > 0) {
        lowStockItems.push({ item, sizes: itemLowStock });
      }
    });

    return { timeSeries, paymentData, itemAnalysis, lowStockItems };
  }, [records, pricing]);

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
    
    try {
      if (isSignUp) {
        const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name || email.split('@')[0] });
        
        // Send verification email
        await sendEmailVerification(cred.user);
        
        // Create user record in Firestore
        await setDoc(doc(db, 'users', cred.user.uid), {
          id: cred.user.uid,
          email: cred.user.email,
          name: name || email.split('@')[0],
          role: 'Viewer',
          createdAt: new Date().toISOString()
        });

        setMsg({ type: 'success', text: 'Account created! A verification email has been sent to your inbox.' });
        setTimeout(() => setMsg(null), 5000);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error: any) {
      console.error("Auth error", error);
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setLoginError("Invalid email or password. Please check your credentials.");
      } else if (error.code === 'auth/email-already-in-use') {
        setLoginError("This email is already registered. Please sign in instead.");
      } else if (error.code === 'auth/popup-closed-by-user') {
        setLoginError("Login cancelled.");
      } else {
        setLoginError(error.message || "An unexpected error occurred.");
      }
    }
    setLoginLoading(false);
  };

  const resendVerification = async () => {
    if (!auth.currentUser) return;
    try {
      await sendEmailVerification(auth.currentUser);
      setMsg({ type: 'success', text: 'Verification email sent!' });
      setTimeout(() => setMsg(null), 3000);
    } catch (err: any) {
      setMsg({ type: 'error', text: err.message || 'Failed to send verification email.' });
      setTimeout(() => setMsg(null), 3000);
    }
  };

  const signInWithGoogle = async () => {
    setLoginLoading(true);
    setLoginError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // Check if user exists in Firestore, if not create record
      const userDoc = await getDoc(doc(db, 'users', result.user.uid));
      if (!userDoc.exists()) {
        await setDoc(doc(db, 'users', result.user.uid), {
          id: result.user.uid,
          email: result.user.email,
          name: result.user.displayName || result.user.email?.split('@')[0] || 'Unknown User',
          photoURL: result.user.photoURL || null,
          role: 'Viewer', // Default role
          createdAt: new Date().toISOString()
        });
      }
    } catch (error: any) {
      console.error("Google Auth error", error);
      if (error.code !== 'auth/popup-closed-by-user') {
        setLoginError("Failed to sign in with Google. Please try again.");
      }
    }
    setLoginLoading(false);
  };

  const handleResetPassword = async () => {
    if (!email) {
      setLoginError("Please enter your email address first.");
      return;
    }
    setLoginLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMsg({ type: 'success', text: 'Password reset link sent to your email.' });
      setTimeout(() => setMsg(null), 5000);
    } catch (error: any) {
      setLoginError(error.message || "Failed to send reset email.");
    }
    setLoginLoading(false);
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setPricing(DEFAULT_PRICING);
      setRecords([]);
      setCustomFields([]);
      setActiveTab('dashboard');
    } catch (error) {
      console.error("Logout error", error);
    }
  };

  const handlePriceChange = (item: string, size: string, value: number) => {
    const next = {
      ...pricing,
      [item]: {
        ...pricing[item],
        [size]: { ...pricing[item][size], price: value }
      }
    };
    setPricing(next);
    updatePricingInCloud(next);
  };

  const handleStockChange = (item: string, size: string, value: number) => {
    const next = {
      ...pricing,
      [item]: {
        ...pricing[item],
        [size]: { ...pricing[item][size], stock: value }
      }
    };
    setPricing(next);
    updatePricingInCloud(next);
  };

  const handleMinStockChange = (item: string, size: string, value: number) => {
    const next = {
      ...pricing,
      [item]: {
        ...pricing[item],
        [size]: { ...pricing[item][size], minStock: value }
      }
    };
    setPricing(next);
    updatePricingInCloud(next);
  };

  const renameItem = (oldName: string, newName: string) => {
    const cleanName = newName.trim();
    if (!cleanName || cleanName === oldName || pricing[cleanName]) return;
    
    const next = { ...pricing };
    const sizes = next[oldName];
    next[cleanName] = sizes;
    delete next[oldName];

    const nextOrder = itemOrder.map(it => it === oldName ? cleanName : it);
    setItemOrder(nextOrder);
    setPricing(next);
    updatePricingInCloud(next, nextOrder);

    if (newItem.item === oldName) {
      setNewItem(p => ({ ...p, item: cleanName }));
    }
  };

  const renameSize = (item: string, oldSize: string, newSize: string) => {
    const cleanSize = newSize.trim();
    if (!cleanSize || cleanSize === oldSize || pricing[item][cleanSize]) return;
    
    const next = { ...pricing };
    const itemSizes = { ...next[item] };
    const price = itemSizes[oldSize];
    delete itemSizes[oldSize];
    itemSizes[cleanSize] = price;
    next[item] = itemSizes;
    setPricing(next);
    updatePricingInCloud(next);
  };

  const addNewItem = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const itemName = (formData.get('itemName') as string).trim();
    if (!itemName || pricing[itemName]) return;
    
    const next = {
      ...pricing,
      [itemName]: {}
    };
    const nextOrder = [...itemOrder, itemName];
    setItemOrder(nextOrder);
    setPricing(next);
    updatePricingInCloud(next, nextOrder);
    (e.target as HTMLFormElement).reset();
  };

  const deleteItem = (item: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Delete Category',
      message: `Are you sure you want to delete "${item}"? This will remove all associated sizes and pricing configurations.`,
      onConfirm: () => {
        const next = { ...pricing };
        delete next[item];
        const nextOrder = itemOrder.filter(it => it !== item);
        setItemOrder(nextOrder);
        setPricing(next);
        updatePricingInCloud(next, nextOrder);

        if (newItem.item === item) {
          const firstAvailable = Object.keys(next)[0];
          setNewItem(p => ({
            ...p,
            item: firstAvailable || '',
            size: firstAvailable ? Object.keys(next[firstAvailable])[0] || '' : ''
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

    const next = {
      ...pricing,
      [item]: {
        ...pricing[item],
        [size]: { price, stock: 0, minStock: 5 }
      }
    };
    setPricing(next);
    updatePricingInCloud(next);
    (e.target as HTMLFormElement).reset();
  };

  const deleteSize = (item: string, size: string) => {
    const nextSizes = { ...pricing[item] };
    delete nextSizes[size];
    const next = {
        ...pricing,
        [item]: nextSizes
    };
    setPricing(next);
    updatePricingInCloud(next);
  };

  const exportPricing = () => {
    const dataStr = JSON.stringify(pricing, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `pricing_chart_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const importPricing = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const importedPricing = JSON.parse(event.target?.result as string);
        if (typeof importedPricing === 'object' && importedPricing !== null) {
          setPricing(importedPricing);
          updatePricingInCloud(importedPricing);
          setMsg({ text: 'Pricing chart imported successfully!', type: 'success' });
          setTimeout(() => setMsg(null), 3000);
        } else {
          throw new Error('Invalid format');
        }
      } catch (err) {
        setMsg({ text: 'Failed to import pricing. Invalid file format.', type: 'error' });
        setTimeout(() => setMsg(null), 3000);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const exportPricingExcel = () => {
    const rows: any[] = [];
    Object.entries(pricing).forEach(([item, sizes]: [string, any]) => {
      Object.entries(sizes).forEach(([size, info]: [string, any]) => {
        rows.push({
          "Item": item,
          "Size": size,
          "Price": info.price,
          "Stock": info.stock || 0,
          "Min Stock": info.minStock || 0
        });
      });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Pricing_Inventory");
    XLSX.writeFile(workbook, `Pricing_Inventory_${new Date().toISOString().split('T')[0]}.xlsx`);
    setMsg({ text: 'Price & Inventory list exported as Excel.', type: 'success' });
    setTimeout(() => setMsg(null), 3000);
  };

  const [importResult, setImportResult] = useState<{
    successCount: number;
    errors: { row: number; item: string; size: string; reason: string }[];
  } | null>(null);

  const importPricingExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet) as any[];

        const nextPricing: any = { ...pricing };
        const errors: { row: number; item: string; size: string; reason: string }[] = [];
        let successCount = 0;

        data.forEach((row: any, index: number) => {
          const item = row["Item"];
          const size = String(row["Size"] || "");
          const priceRaw = row["Price"];
          const stockRaw = row["Stock"];
          const minStockRaw = row["Min Stock"];
          
          const rowNum = index + 2; // +1 for 0-indexed, +1 for header row

          if (!item) {
            errors.push({ row: rowNum, item: "N/A", size: size || "N/A", reason: "Missing Item name" });
            return;
          }
          if (!size) {
            errors.push({ row: rowNum, item: item, size: "N/A", reason: "Missing Size" });
            return;
          }

          const price = Number(priceRaw);
          const stock = Number(stockRaw);
          const minStock = Number(minStockRaw);

          let hasError = false;
          if (priceRaw !== undefined && isNaN(price)) {
            errors.push({ row: rowNum, item, size, reason: `Invalid Price: ${priceRaw}` });
            hasError = true;
          }
          if (stockRaw !== undefined && isNaN(stock)) {
            errors.push({ row: rowNum, item, size, reason: `Invalid Stock: ${stockRaw}` });
            hasError = true;
          }
          if (minStockRaw !== undefined && isNaN(minStock)) {
            errors.push({ row: rowNum, item, size, reason: `Invalid Min Stock: ${minStockRaw}` });
            hasError = true;
          }

          if (!hasError) {
            if (!nextPricing[item]) nextPricing[item] = {};
            nextPricing[item][size] = {
              price: isNaN(price) ? (nextPricing[item][size]?.price || 0) : price,
              stock: isNaN(stock) ? (nextPricing[item][size]?.stock || 0) : stock,
              minStock: isNaN(minStock) ? (nextPricing[item][size]?.minStock || 0) : minStock
            };
            successCount++;
          }
        });

        if (successCount > 0) {
          const newItems = Object.keys(nextPricing).filter(item => !itemOrder.includes(item));
          const nextOrder = [...itemOrder, ...newItems];
          
          setPricing(nextPricing);
          setItemOrder(nextOrder);
          updatePricingInCloud(nextPricing, nextOrder);
        }

        if (errors.length > 0) {
          setImportResult({ successCount, errors });
          setMsg({ text: `Import completed with ${errors.length} errors.`, type: 'error' });
        } else {
          setImportResult(null);
          setMsg({ text: `Successfully imported ${successCount} items!`, type: 'success' });
        }
        setTimeout(() => setMsg(null), 5000);
      } catch (err) {
        console.error("Import error:", err);
        setMsg({ text: 'Failed to import Excel. Invalid format.', type: 'error' });
        setTimeout(() => setMsg(null), 3000);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = '';
  };

  const addCustomField = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const label = (formData.get('label') as string).trim();
    const type = formData.get('type') as any;
    const required = formData.get('required') === 'on';

    if (!label) return;

    if (customFields.some(f => f.label.toLowerCase() === label.toLowerCase())) {
        setMsg({ type: 'error', text: "A field with this name already exists." });
        setTimeout(() => setMsg(null), 3000);
        return;
    }

    const next = [
        ...customFields,
        { id: crypto.randomUUID(), label, type, required }
    ];
    setCustomFields(next);
    updateFieldsInCloud(next);
    (e.target as HTMLFormElement).reset();
  };

  const removeCustomField = (id: string) => {
    const next = customFields.filter(f => f.id !== id);
    setCustomFields(next);
    updateFieldsInCloud(next);
    setCustomValues(prev => {
      const remaining: Record<string, string> = {};
      Object.entries(prev).forEach(([key, val]) => {
          if (key !== id) remaining[key] = val as string;
      });
      return remaining;
    });
  };

  const updateCustomField = (id: string, updates: Partial<CustomField>) => {
    const next = customFields.map(f => f.id === id ? { ...f, ...updates } : f);
    setCustomFields(next);
    updateFieldsInCloud(next);
  };

  const addToCart = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validate student name
    if (!studentName.trim()) {
        setFormError("Student name is required.");
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
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  // --- Sync Effects ---
  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || (firebaseConfig as any).oauthClientId;
    if (clientId) {
      initGsi(clientId);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const unsubSync = onSnapshot(doc(db, 'users', user.id, 'settings', 'sync'), (snapshot) => {
      if (snapshot.exists()) {
        setSyncSettings(snapshot.data() as any);
      }
    });
    return () => unsubSync();
  }, [user]);

  const performSheetSync = async (action: 'create' | 'update' | 'delete', recordId: string, record?: SaleRecord) => {
    if (!syncSettings.enabled || !syncSettings.spreadsheetId) return;
    
    try {
      const token = await getAccessToken(false).catch(() => getAccessToken(true));
      const itemNames = Object.keys(pricing);

      if (action === 'create' || action === 'update') {
        const rec = record || records.find(r => r.id === recordId);
        if (!rec) return;
        const row = sheetService.recordToRow(rec, itemNames, customFields);
        if (action === 'create') {
          await sheetService.appendRecords(token, syncSettings.spreadsheetId, [row]);
        } else {
          await sheetService.updateRecordInSheet(token, syncSettings.spreadsheetId, recordId, row);
        }
      } else if (action === 'delete') {
        await sheetService.deleteRecordInSheet(token, syncSettings.spreadsheetId, recordId);
      }
    } catch (err) {
      console.error('Sheet Sync Error:', err);
      setMsg({ type: 'error', text: 'Google Sheet Sync failed. Check authentication.' });
      setTimeout(() => setMsg(null), 5000);
    }
  };

  const setupGoogleSheet = async () => {
    setIsSyncing(true);
    try {
      const token = await getAccessToken(true);
      const spreadsheetId = await sheetService.createSpreadsheet(token, `Uniform Sales Ledger - ${new Date().toLocaleDateString()}`);
      
      const itemNames = Object.keys(pricing);
      const headers = sheetService.prepareHeaders(itemNames, customFields);
      await sheetService.setupSheetHeaders(token, spreadsheetId, headers);

      // Initial Sync
      const rows = records.map(r => sheetService.recordToRow(r, itemNames, customFields));
      if (rows.length > 0) {
        await sheetService.appendRecords(token, spreadsheetId, rows);
      }

      await setDoc(doc(db, 'users', user.id, 'settings', 'sync'), { enabled: true, spreadsheetId });
      setMsg({ type: 'success', text: 'Google Sheet connected and synchronized.' });
    } catch (err: any) {
      console.error('Setup Sheet Error:', err);
      setMsg({ type: 'error', text: `Failed to setup sheet: ${err.message}` });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setMsg(null), 5000);
    }
  };

  const toggleSync = async (enabled: boolean) => {
    if (!user) return;
    await updateDoc(doc(db, 'users', user.id, 'settings', 'sync'), { enabled });
  };

  const manualFullSync = async () => {
    if (!syncSettings.spreadsheetId) return;
    setIsSyncing(true);
    try {
      const token = await getAccessToken(true);
      await sheetService.clearSheet(token, syncSettings.spreadsheetId);
      
      const itemNames = Object.keys(pricing);
      const headers = sheetService.prepareHeaders(itemNames, customFields);
      await sheetService.setupSheetHeaders(token, syncSettings.spreadsheetId, headers);

      const rows = records.map(r => sheetService.recordToRow(r, itemNames, customFields));
      if (rows.length > 0) {
        await sheetService.appendRecords(token, syncSettings.spreadsheetId, rows);
      }
      setMsg({ type: 'success', text: 'Full synchronization complete.' });
    } catch (err: any) {
      console.error('Manual Sync Error:', err);
      setMsg({ type: 'error', text: `Failed manual sync: ${err.message}` });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setMsg(null), 5000);
    }
  };

  const submitTransaction = async () => {
    const isCustomFieldsValid = customFields.every((f: any) => !f.required || (customValues[f.id] && String(customValues[f.id]).trim() !== ''));
    if (!studentName.trim() || cart.length === 0 || !isCustomFieldsValid || isSubmitting) return;

    setIsSubmitting(true);
    const timestamp = new Date().toISOString();
    const displayDate = new Date(transactionDate).toLocaleDateString('en-IN');

    const newRecord: SaleRecord = {
      id: crypto.randomUUID(),
      srNo: srNo,
      name: studentName,
      studentClass: studentClass,
      items: cart,
      totalAmount: finalPayable,
      discountPercent: Number(discountAmount) || 0,
      date: displayDate,
      timestamp,
      paymentMode,
      customData: { ...customValues }
    };

    if (paymentMode !== 'Pending') {
      newRecord.paidAmount = Number(paidAmount);
      newRecord.paymentDate = paymentDate;
    }
    
    if (generalNotes.trim()) {
      newRecord.notes = generalNotes.trim();
    }

    try {
      // Add to Firestore
      await addDoc(collection(db, 'users', user.id, 'sales'), newRecord);
      
      // Update Stock in Firestore via transaction or batch
      const batch = writeBatch(db);
      const nextPricing = { ...pricing };
      cart.forEach(item => {
        if (nextPricing[item.item] && nextPricing[item.item][item.size]) {
          nextPricing[item.item][item.size] = {
            ...nextPricing[item.item][item.size],
            stock: nextPricing[item.item][item.size].stock - item.qty
          };
        }
      });
      batch.set(doc(db, 'users', user.id, 'pricing', 'current'), { data: nextPricing });
      await batch.commit();

      // Sync to Sheet
      performSheetSync('create', newRecord.id, newRecord);

      setSrNo(prev => prev + 1);
      setCart([]);
      setStudentName('');
      setStudentClass(CLASSES[0]);
      setGeneralNotes('');
      setCustomValues({});
      setDiscountAmount('');
      setPaymentMode('Pending');
      setPaidAmount('');
      setShowConfirmation(false);
      setMsg({ type: 'success', text: 'Transaction recorded successfully.' });
      setTimeout(() => setMsg(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${user.id}/sales`);
      setMsg({ type: 'error', text: 'Failed to record transaction. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteRecord = (id: string) => {
    const rec = records.find(r => r.id === id);
    setConfirmState({
      isOpen: true,
      title: 'Delete Record',
      message: 'Are you sure you want to permanently delete this transaction record? This action cannot be undone.',
      onConfirm: async () => {
        if (!user) return;
        try {
          const batch = writeBatch(db);
          batch.delete(doc(db, 'users', user.id, 'sales', id));
          
          // Revert Stock
          if (rec && rec.items && rec.items.length > 0) {
            const nextPricing = { ...pricing };
            rec.items.forEach(item => {
              if (nextPricing[item.item] && nextPricing[item.item][item.size]) {
                nextPricing[item.item][item.size] = {
                  ...nextPricing[item.item][item.size],
                  stock: nextPricing[item.item][item.size].stock + item.qty
                };
              }
            });
            batch.set(doc(db, 'users', user.id, 'pricing', 'current'), { data: nextPricing });
          }
          
          await batch.commit();
          performSheetSync('delete', id);
          setMsg({ type: 'success', text: 'Record deleted.' });
          setTimeout(() => setMsg(null), 3000);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.id}/sales/${id}`);
        }
      },
      type: 'danger'
    });
  };

  const updateRecord = async (id: string, updates: any) => {
    if (!user) return;
    try {
      const oldRec = records.find(r => r.id === id);
      const batch = writeBatch(db);
      
      // If items changed, adjust stock
      if (updates.items && oldRec) {
        const nextPricing = { ...pricing };
        
        // 1. Add back old items to stock
        oldRec.items.forEach(item => {
          if (nextPricing[item.item] && nextPricing[item.item][item.size]) {
            nextPricing[item.item][item.size] = {
              ...nextPricing[item.item][item.size],
              stock: nextPricing[item.item][item.size].stock + item.qty
            };
          }
        });
        
        // 2. Subtract new items from stock
        updates.items.forEach((item: CartItem) => {
          if (nextPricing[item.item] && nextPricing[item.item][item.size]) {
            nextPricing[item.item][item.size] = {
              ...nextPricing[item.item][item.size],
              stock: nextPricing[item.item][item.size].stock - item.qty
            };
          }
        });
        
        batch.set(doc(db, 'users', user.id, 'pricing', 'current'), { data: nextPricing });
      }
      
      batch.update(doc(db, 'users', user.id, 'sales', id), updates);
      await batch.commit();

      if (oldRec) {
        performSheetSync('update', id, { ...oldRec, ...updates });
      }
      setEditingRecord(null);
      setMsg({ type: 'success', text: 'Record updated.' });
      setTimeout(() => setMsg(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}/sales/${id}`);
    }
  };

  const bulkDeleteRecords = (ids: string[]) => {
    setConfirmState({
      isOpen: true,
      title: 'Bulk Delete',
      message: `Are you sure you want to delete ${ids.length} selected records? This action is permanent.`,
      onConfirm: async () => {
        if (!user) return;
        setIsSubmitting(true);
        try {
          const batch = writeBatch(db);
          const nextPricing = { ...pricing };
          let stockChanged = false;

          const syncPromises = ids.map(async (id) => {
            const rec = records.find(r => r.id === id);
            batch.delete(doc(db, 'users', user.id, 'sales', id));
            
            if (rec && rec.items && rec.items.length > 0) {
              stockChanged = true;
              rec.items.forEach(item => {
                if (nextPricing[item.item] && nextPricing[item.item][item.size]) {
                  nextPricing[item.item][item.size] = {
                    ...nextPricing[item.item][item.size],
                    stock: nextPricing[item.item][item.size].stock + item.qty
                  };
                }
              });
            }
            return performSheetSync('delete', id);
          });

          if (stockChanged) {
            batch.set(doc(db, 'users', user.id, 'pricing', 'current'), { data: nextPricing });
          }

          await Promise.all([batch.commit(), ...syncPromises]);
          setSelectedRecordIds([]);
          setMsg({ type: 'success', text: `${ids.length} records deleted.` });
          setTimeout(() => setMsg(null), 3000);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.id}/sales (bulk)`);
        } finally {
          setIsSubmitting(false);
        }
      },
      type: 'danger'
    });
  };

  const bulkUpdateStatus = (ids: string[], mode: PaymentMode) => {
    const timestamp = new Date().toISOString();
    const pDate = new Date().toISOString().split('T')[0];
    
    setConfirmState({
        isOpen: true,
        title: 'Bulk Update Status',
        message: `Update ${ids.length} records to ${mode}?`,
        onConfirm: async () => {
            if (!user) return;
            setIsSubmitting(true);
            try {
                const batch = writeBatch(db);
                const syncPromises = ids.map(async (id) => {
                    const r = records.find(record => record.id === id);
                    if (r) {
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
                        batch.update(doc(db, 'users', user.id, 'sales', id), updates);
                        return performSheetSync('update', id, { ...r, ...updates });
                    }
                });
                await Promise.all([batch.commit(), ...syncPromises]);
                setSelectedRecordIds([]);
                setMsg({ type: 'success', text: 'Status updated.' });
                setTimeout(() => setMsg(null), 3000);
            } catch (error) {
                handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}/sales (bulk status)`);
            } finally {
                setIsSubmitting(false);
            }
        },
        type: 'info'
    });
  };

  const clearRecords = () => {
    setConfirmState({
      isOpen: true,
      title: 'Clear Ledger',
      message: 'Are you sure you want to permanently delete all sales history? This action cannot be undone.',
      onConfirm: async () => {
        if (!user) return;
        try {
          const batch = writeBatch(db);
          records.forEach(r => {
            batch.delete(doc(db, 'users', user.id, 'sales', r.id));
            performSheetSync('delete', r.id);
          });
          await batch.commit();
          setSelectedRecordIds([]);
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.id}/sales (clear all)`);
        }
      },
      type: 'danger'
    });
  };

  const exportLedger = (format: 'xlsx' | 'csv') => {
    if (filteredRecords.length === 0) {
      setMsg({ type: 'error', text: 'No records to export' });
      return;
    }

    const itemNames = Object.keys(pricing);
    
    // Create data rows
    const dataRows = filteredRecords.map(r => {
      const totalQty = r.items.reduce((s, i) => s + i.qty, 0);
      const paidNum = r.paidAmount || 0;
      const balance = r.totalAmount - paidNum;

      const row: any = {
        "Sr. No.": r.srNo,
        "Date": r.date,
        "Student Name": r.name,
        "Class": r.studentClass,
        "General Notes": r.notes || "",
      };

      // Add item detailed breakdown
      itemNames.forEach(itemName => {
        const lineItem = r.items.find((i: any) => i.item === itemName);
        row[`${itemName}_Size`] = lineItem ? lineItem.size : "";
        row[`${itemName}_Qty`] = lineItem ? lineItem.qty : 0;
        row[`${itemName}_Price`] = lineItem ? lineItem.qty * lineItem.rate : 0;
      });

      row["Total Qty"] = totalQty;
      row["Total Amount"] = r.totalAmount;
      row["Discount %"] = r.discountPercent || 0;
      row["Payment Mode"] = r.paymentMode;
      row["Paid Amount"] = paidNum;
      row["Balance Due"] = balance;
      row["Payment Date"] = r.paymentDate || "";

      // Add custom fields
      customFields.forEach((f: any) => {
        row[f.label] = r.customData?.[f.id] || "";
      });

      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Ledger");

    const fileName = `Uniform_Sales_Report_${new Date().toLocaleDateString().replace(/\//g, '-')}.${format}`;

    if (format === 'xlsx') {
      XLSX.writeFile(workbook, fileName);
    } else {
      XLSX.writeFile(workbook, fileName, { bookType: 'csv' });
    }
    
    setMsg({ type: 'success', text: `Ledger exported as ${format.toUpperCase()}` });
  };

  const importLedger = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsSubmitting(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet) as any[];

        const itemNames = Object.keys(pricing);
        const timestamp = new Date().toISOString();
        
        let importedCount = 0;
        const batchSize = 400;
        
        for (let i = 0; i < data.length; i += batchSize) {
          const chunk = data.slice(i, i + batchSize);
          const batch = writeBatch(db);
          
          chunk.forEach((row, index) => {
            const items: CartItem[] = [];
            itemNames.forEach(itemName => {
              const sizeKey = `${itemName}_Size`;
              const qtyKey = `${itemName}_Qty`;
              const priceKey = `${itemName}_Price`;
              
              const size = row[sizeKey];
              const qty = Number(row[qtyKey] || 0);
              const price = Number(row[priceKey] || 0);
              
              if (qty > 0) {
                let rate = 0;
                if (qty > 0) rate = price / qty;
                if (rate === 0 && pricing[itemName] && size && pricing[itemName][size]) {
                  rate = pricing[itemName][size].rate;
                }

                items.push({
                  id: crypto.randomUUID(),
                  item: itemName,
                  size: String(size || ""),
                  qty,
                  rate
                });
              }
            });

            const customData: Record<string, any> = {};
            customFields.forEach((f: any) => {
              if (row[f.label] !== undefined) {
                customData[f.id] = row[f.label];
              }
            });

            const newRecord: SaleRecord = {
              id: crypto.randomUUID(),
              srNo: Number(row["Sr. No."]) || (records.length + i + index + 1),
              date: row["Date"] || new Date().toLocaleDateString('en-IN'),
              timestamp,
              name: String(row["Student Name"] || "Unknown"),
              studentClass: String(row["Class"] || CLASSES[0]),
              items,
              totalAmount: Number(row["Total Amount"] || 0),
              discountPercent: Number(row["Discount %"] || 0),
              paymentMode: (row["Payment Mode"] as PaymentMode) || 'Pending',
              paidAmount: row["Paid Amount"] ? Number(row["Paid Amount"]) : null,
              paymentDate: row["Payment Date"] || null,
              notes: row["General Notes"] || "",
              customData
            };
            
            const docRef = doc(collection(db, 'users', user.id, 'sales'));
            newRecord.id = docRef.id; // use firestore id
            batch.set(docRef, newRecord);
            importedCount++;
          });
          
          await batch.commit();
        }

        setMsg({ type: 'success', text: `${importedCount} records imported and synced to database` });
        setTimeout(() => setMsg(null), 3000);
      } catch (err) {
        console.error("Import error:", err);
        setMsg({ type: 'error', text: 'Failed to import ledger. Please check file format.' });
      } finally {
        setIsSubmitting(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ''; // Reset input
  };

  const downloadTemplate = () => {
    const itemNames = Object.keys(pricing);
    const headers: any = {
      "Sr. No.": "Ex: 1",
      "Date": new Date().toLocaleDateString('en-IN'),
      "Student Name": "Ex: John Doe",
      "Class": CLASSES[0],
      "General Notes": "Example entry",
    };

    itemNames.forEach(itemName => {
      headers[`${itemName}_Size`] = Object.keys(pricing[itemName])[0] || "M";
      headers[`${itemName}_Qty`] = 0;
      headers[`${itemName}_Price`] = 0;
    });

    headers["Total Amount"] = 0;
    headers["Discount %"] = 0;
    headers["Payment Mode"] = "Pending";
    headers["Paid Amount"] = 0;
    headers["Payment Date"] = "";

    customFields.forEach((f: any) => {
      headers[f.label] = "";
    });

    const worksheet = XLSX.utils.json_to_sheet([headers]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "ImportTemplate");
    XLSX.writeFile(workbook, "Ledger_Import_Template.xlsx");
    
    setMsg({ type: 'success', text: 'Template downloaded successfully' });
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
      <AnimatePresence>
        {isOffline && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-red-600 text-white py-3 px-6 flex items-center justify-between sticky top-0 z-[200] overflow-hidden"
          >
            <div className="flex items-center gap-3">
              <CloudLightning className="animate-pulse" size={20} />
              <p className="text-xs font-bold uppercase tracking-widest">
                System Offline: Could not reach Cloud Firestore. Retrying connection...
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={triggerRetry}
                className="bg-white text-red-600 hover:bg-white/90 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2"
              >
                <RefreshCw size={12} className={authLoading ? "animate-spin" : ""} />
                {authLoading ? "Checking..." : "Try Reconnect"}
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all"
              >
                Force Reload
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {user && !authLoading && !user.emailVerified && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-amber-500 text-white py-3 px-6 flex items-center justify-between sticky top-0 z-[190] overflow-hidden border-b border-amber-600/20 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="animate-bounce" />
              <div>
                <p className="text-xs font-black uppercase tracking-widest leading-none">
                  Email Verification Required
                </p>
                <p className="text-[10px] font-bold text-amber-100 mt-1 uppercase tracking-tighter">
                  Check your inbox for a verification link to ensure full account access.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={resendVerification}
                className="bg-white text-amber-600 hover:bg-amber-50 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all flex items-center gap-2"
              >
                <Mail size={12} />
                Resend Email
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="bg-white/20 hover:bg-white/30 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all"
              >
                I've Verified
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <ConfirmDialog 
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        isLoading={isSubmitting}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState(p => ({ ...p, isOpen: false }))}
      />
      
      <ImportResultModal 
        result={importResult} 
        onClose={() => setImportResult(null)} 
      />

      {/* Dashboard Layout */}
      <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
        {/* Mobile Drawer Overlay */}
        <AnimatePresence>
          {user && isMobileMenuOpen && (
            <>
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMobileMenuOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] md:hidden"
              />
              <motion.div 
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                className="fixed inset-y-0 left-0 w-[280px] bg-slate-900 z-[101] md:hidden shadow-2xl flex flex-col pt-20"
              >
                <div className="flex-1 py-8 overflow-y-auto custom-scroll space-y-2 px-6">
                  <div className="mb-8 px-2">
                    <div className="flex items-center gap-3">
                       <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                          <FileSpreadsheet size={20} className="text-white" />
                       </div>
                       <div>
                          <h1 className="text-sm font-black text-white leading-none">UNIFORM CRM</h1>
                          <p className="text-[9px] text-slate-500 font-bold mt-1 uppercase tracking-widest">Digital Terminal</p>
                       </div>
                    </div>
                  </div>

                  {[
                    { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
                    { id: 'pricing', icon: Database, label: 'Inventory' },
                    { id: 'sales', icon: PlusCircle, label: 'New Sale' },
                    { id: 'ledger', icon: History, label: 'Transactions' },
                    { id: 'reports', icon: BarChart3, label: 'Analytics' },
                    { id: 'profile', icon: UserCircle, label: 'Account' },
                    ...(user?.role === 'Admin' ? [{ id: 'admin', icon: Settings, label: 'Settings' }] : []),
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => { setActiveTab(tab.id as any); setIsMobileMenuOpen(false); }}
                      className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-all ${
                        activeTab === tab.id 
                          ? 'bg-blue-600 text-white font-black shadow-lg shadow-blue-500/20' 
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <tab.icon size={20} />
                      <span className="text-xs uppercase tracking-widest">{tab.label}</span>
                    </button>
                  ))}
                </div>
                <div className="p-6 border-t border-white/5">
                   <button onClick={logout} className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-500 hover:text-red-400">
                      <LogOut size={20} />
                      <span className="text-xs font-black uppercase tracking-widest">Sign Out</span>
                   </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Mobile Bottom Nav */}
        {user && !authLoading && (
          <div className="fixed bottom-0 left-0 right-0 py-2 bg-white/95 backdrop-blur-xl border-t border-slate-200 z-[90] md:hidden shadow-[0_-10px_30px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-around px-2">
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`flex flex-col items-center gap-1 p-2 min-w-[80px] transition-all relative ${activeTab === 'dashboard' ? 'text-blue-600' : 'text-slate-400'}`}
              >
                <LayoutDashboard size={20} strokeWidth={activeTab === 'dashboard' ? 2.5 : 2} />
                <span className="text-[9px] font-black uppercase tracking-tighter">Home</span>
              </button>

              {/* Central Quick Add Action - Prominent New Sale */}
              <div className="relative -top-4">
                <button 
                  onClick={() => setActiveTab('sales')}
                  className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-90 ${activeTab === 'sales' ? 'bg-blue-600 text-white shadow-blue-500/40 ring-4 ring-blue-50' : 'bg-slate-900 text-white shadow-slate-900/20'}`}
                >
                  <Plus size={28} strokeWidth={3} />
                </button>
                <div className="absolute top-16 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span className={`text-[8px] font-black uppercase tracking-tighter ${activeTab === 'sales' ? 'text-blue-600' : 'text-slate-400'}`}>New Sale</span>
                </div>
              </div>

              <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="flex flex-col items-center gap-1 p-2 min-w-[80px] text-slate-400 transition-all"
              >
                <Menu size={20} />
                <span className="text-[9px] font-black uppercase tracking-tighter">More</span>
              </button>
            </div>
          </div>
        )}

        {/* Modern Collapsible Sidebar */}
        {user && !authLoading && (
          <motion.aside
            initial={false}
            animate={{ width: isSidebarCollapsed ? 80 : 280 }}
            className="hidden md:flex flex-col bg-slate-900 text-white border-r border-slate-800 relative z-30 transition-all duration-300 shadow-2xl"
          >
            <div className="p-6 h-20 flex items-center justify-between border-b border-white/5">
              {!isSidebarCollapsed && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 overflow-hidden whitespace-nowrap"
                >
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <FileSpreadsheet size={20} className="text-white" />
                  </div>
                  <div>
                    <h1 className="text-sm font-black tracking-tighter leading-none">UNIFORM CRM</h1>
                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">NEXT-GEN INT.</p>
                  </div>
                </motion.div>
              )}
              {isSidebarCollapsed && (
                <div className="mx-auto">
                   <FileSpreadsheet size={24} className="text-blue-500" />
                </div>
              )}
            </div>

            <div className="flex-1 py-8 overflow-y-auto custom-scroll space-y-2 px-3">
              {[
                { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
                { id: 'pricing', icon: Database, label: 'Inventory' },
                { id: 'sales', icon: PlusCircle, label: 'New Sale' },
                { id: 'ledger', icon: History, label: 'Transactions' },
                { id: 'reports', icon: BarChart3, label: 'Analytics' },
                { id: 'profile', icon: UserCircle, label: 'Account' },
                ...(user?.role === 'Admin' ? [{ id: 'admin', icon: Settings, label: 'Settings' }] : []),
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all relative group ${
                    activeTab === tab.id 
                      ? 'bg-blue-600/10 text-blue-400 font-black shadow-inner shadow-blue-500/10' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {activeTab === tab.id && (
                    <motion.div 
                      layoutId="sidebarActiveIndicator"
                      className="absolute left-0 w-1 y-2 h-8 bg-blue-500 rounded-r-full shadow-lg shadow-blue-500/50"
                    />
                  )}
                  <tab.icon size={20} className={`flex-shrink-0 ${activeTab === tab.id ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-300'} transition-colors`} />
                  {!isSidebarCollapsed && (
                    <span className="text-[11px] uppercase tracking-[0.2em]">{tab.label}</span>
                  )}
                  {isSidebarCollapsed && (
                    <div className="absolute left-16 bg-slate-900 border border-slate-700 px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50 shadow-xl">
                      {tab.label}
                    </div>
                  )}
                </button>
              ))}
            </div>

            <div className="p-4 border-t border-white/5">
               <button 
                onClick={logout}
                className={`w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-slate-500 hover:text-red-400 hover:bg-red-400/5 transition-all group`}
               >
                  <LogOut size={20} className="flex-shrink-0" />
                  {!isSidebarCollapsed && <span className="text-[11px] font-black uppercase tracking-widest">Sign Out</span>}
               </button>
            </div>
          </motion.aside>
        )}

        <div className="flex-1 flex flex-col min-w-0 transition-all duration-300 overflow-hidden">
          {/* Modern Header */}
          {user && !authLoading && (
            <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 relative z-20 sticky top-0 shrink-0">
               <div className="flex items-center gap-6">
                  <button 
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        setIsMobileMenuOpen(true);
                      } else {
                        setIsSidebarCollapsed(!isSidebarCollapsed);
                      }
                    }}
                    className="p-3 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-500 rounded-2xl transition-all shadow-sm group"
                  >
                    <Menu size={20} />
                  </button>
                  <div>
                     <h2 className="text-xs font-black uppercase tracking-[0.3em] text-slate-300">Workstation</h2>
                     <p className="text-xl font-black text-slate-900 tracking-tight capitalize">{activeTab}</p>
                  </div>
               </div>

               <div className="flex items-center gap-6">
                  <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-2xl">
                     <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                     <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">System Live</span>
                  </div>
                  
                  <div className="h-10 w-px bg-slate-100 mx-2" />

                  <div className="flex items-center gap-4">
                     <div className="text-right hidden sm:block">
                        <p className="text-xs font-black text-slate-900 leading-none">{user.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-1">{user.role}</p>
                     </div>
                     <div className="relative">
                        <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-2xl flex items-center justify-center text-white font-black shadow-xl shadow-blue-500/20 ring-4 ring-white overflow-hidden">
                           {user.photoURL ? (
                              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                           ) : user.name.charAt(0)}
                        </div>
                        <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
                     </div>
                  </div>
               </div>
            </header>
          )}

          <div className="flex-1 overflow-y-auto custom-scroll bg-slate-50/50 relative">
            {/* Conditional Render Main Container Padding */}
            <main className={`${user && !authLoading ? 'max-w-[1400px]' : ''} mx-auto w-full p-8 md:p-12 pb-32 md:pb-12 h-full flex flex-col`}>
              {msg && (
                <motion.div 
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`fixed top-8 left-1/2 -translate-x-1/2 z-[100] px-6 py-4 rounded-2xl shadow-2xl border text-[10px] font-black uppercase tracking-widest flex items-center gap-3 backdrop-blur-md ${
                    msg.type === 'success' 
                      ? 'bg-emerald-50/90 text-emerald-600 border-emerald-100' 
                      : 'bg-red-50/90 text-red-600 border-red-100'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full ${msg.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'} animate-pulse`} />
                  {msg.text}
                </motion.div>
              )}
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
                   {isSignUp && (
                     <motion.div 
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative"
                     >
                        <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                        <input 
                          type="text" 
                          required 
                          placeholder="Full Name" 
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-12 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl outline-none focus:border-blue-500 transition-all font-medium text-sm shadow-sm"
                        />
                     </motion.div>
                   )}
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      type="email" 
                      required 
                      placeholder="Email Address" 
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
                  {loginLoading ? 'Authenticating...' : (isSignUp ? 'Create Account' : 'Login')}
                </button>

                {!isSignUp && (
                  <button 
                    type="button"
                    onClick={handleResetPassword}
                    className="text-[10px] font-bold text-slate-400 hover:text-blue-600 uppercase tracking-widest block mx-auto py-2"
                  >
                    Forgot Credentials?
                  </button>
                )}

                <div className="relative py-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200"></div>
                  </div>
                  <div className="relative flex justify-center text-[10px] uppercase font-black tracking-widest">
                    <span className="bg-slate-50 px-4 text-slate-400">Signup</span>
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={signInWithGoogle}
                  disabled={loginLoading}
                  className="w-full bg-white border border-slate-200 text-slate-700 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    <path fill="none" d="M1 1h22v22H1z"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="pt-6">
                  <button 
                    type="button"
                    onClick={() => {
                        setIsSignUp(!isSignUp);
                        setLoginError(null);
                    }}
                    className="w-full py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-blue-600 border border-transparent hover:border-blue-100 hover:bg-blue-50 transition-all"
                  >
                    {isSignUp ? (
                        <>Already registered? <span className="text-blue-600 ml-1">Secure Sign In</span></>
                    ) : (
                        <>New User? <span className="text-blue-600 ml-1">Create Account</span></>
                    )}
                  </button>
                </div>
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
              initial={{ opacity: 0, x: 20, rotateY: 10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -20, rotateY: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <History size={14} className="text-blue-500" /> Recent Transactions
                  </h3>
                  <button 
                    onClick={() => setActiveTab('ledger')}
                    className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest flex items-center gap-1"
                  >
                    View All <ArrowRight size={12} />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-[9px] uppercase font-black text-slate-400">
                      <tr>
                        <th className="px-6 py-3">Sr.</th>
                        <th className="px-6 py-3">Student</th>
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Items</th>
                        <th className="px-6 py-3 text-right">Amount</th>
                        <th className="px-6 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {records.slice(0, 5).map((r: any) => (
                        <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4 font-mono text-[10px] text-slate-400">#{r.srNo}</td>
                          <td className="px-6 py-4">
                             <p className="text-[11px] font-black text-slate-800 uppercase leading-none">{r.name}</p>
                             <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">{r.studentClass}</p>
                          </td>
                          <td className="px-6 py-4 text-[10px] font-mono text-slate-500">{r.date}</td>
                          <td className="px-6 py-4">
                             <div className="flex flex-wrap gap-1">
                                {r.items.slice(0, 2).map((it: any) => (
                                  <span key={it.id} className="px-1.5 py-0.5 bg-slate-100 rounded text-[8px] font-bold text-slate-600 border border-slate-200">
                                    {it.item}
                                  </span>
                                ))}
                                {r.items.length > 2 && <span className="text-[8px] font-bold text-slate-400">+{r.items.length - 2} more</span>}
                             </div>
                          </td>
                          <td className="px-6 py-4 text-right font-black text-slate-900 text-[11px] font-mono">₹{r.totalAmount}</td>
                          <td className="px-6 py-4">
                             <span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase border ${
                               r.paymentMode === 'Pending' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                               r.paymentMode === 'UPI' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                               'bg-emerald-50 text-emerald-600 border-emerald-100'
                             }`}>
                               {r.paymentMode}
                             </span>
                          </td>
                        </tr>
                      ))}
                      {records.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-6 py-12 text-center">
                            <p className="text-[10px] font-black uppercase text-slate-300 italic tracking-widest">No recent transactions found</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
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
              {dashboardData.lowStockItems.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden mb-6">
                  <div className="px-6 py-4 border-b border-red-50 bg-red-50/50 flex justify-between items-center">
                    <h3 className="text-xs font-black uppercase tracking-widest text-red-600 flex items-center gap-2">
                       <AlertCircle size={14} /> Low Stock Alerts
                    </h3>
                    <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[9px] font-black uppercase">{dashboardData.lowStockItems.length} Alerts</span>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {dashboardData.lowStockItems.map((item, idx) => (
                        <div key={`${item.item}-${idx}`} className="bg-slate-50 rounded-2xl border border-slate-100 overflow-hidden flex flex-col shadow-sm">
                           <div className="px-5 py-3 bg-white border-b border-slate-100 flex items-center gap-3">
                              <div className="p-1.5 bg-red-50 text-red-500 rounded-lg">
                                <Package size={14} />
                              </div>
                              <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest truncate">{item.item}</span>
                           </div>
                           <div className="p-4 space-y-2">
                             {item.sizes.map((s: any, sIdx: number) => {
                               const isCritical = s.stock <= 0;
                               return (
                                 <div key={sIdx} className={`flex items-center justify-between p-2.5 rounded-xl border group transition-all ${isCritical ? 'bg-red-50 border-red-100 animate-pulse' : 'bg-white border-slate-100'}`}>
                                    <div className="flex items-center gap-2">
                                       <span className={`text-[10px] font-black uppercase ${isCritical ? 'text-red-700' : 'text-slate-400'}`}>{s.size}</span>
                                       {isCritical && <span className="text-[7px] font-black bg-red-600 text-white px-1 py-0.5 rounded uppercase">Out</span>}
                                    </div>
                                    <div className="text-right">
                                       <div className={`text-xs font-black ${isCritical ? 'text-red-600' : 'text-red-500'}`}>{s.stock}</div>
                                       <div className="text-[8px] font-black uppercase text-slate-300 tracking-tighter">Left</div>
                                    </div>
                                 </div>
                               );
                             })}
                           </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

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
              initial={{ opacity: 0, x: 20, rotateY: 10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -20, rotateY: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="max-w-4xl mx-auto space-y-6"
            >
              {/* Sub-navigation for Pricing */}
              <div className="flex bg-slate-200/50 p-1.5 rounded-[20px] w-fit mx-auto shadow-inner relative gap-1">
                {[
                  { id: 'prices', icon: Tag, label: 'Standard Rates', color: 'text-blue-600', activeBg: 'bg-blue-50' },
                  { id: 'inventory', icon: Package, label: 'Inventory Control', color: 'text-orange-600', activeBg: 'bg-orange-50' }
                ].map(mode => (
                  <button 
                    key={mode.id}
                    onClick={() => setPricingMode(mode.id as any)}
                    className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 relative z-10 ${
                      pricingMode === mode.id ? mode.color : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {pricingMode === mode.id && (
                      <motion.div
                        layoutId="activePricingMode"
                        className={`absolute inset-0 bg-white rounded-2xl shadow-sm ring-1 ring-slate-200 -z-10`}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                      />
                    )}
                    <mode.icon size={14} /> {mode.label}
                  </button>
                ))}
              </div>

              {pricingMode === 'prices' ? (
                <PriceConfigSection 
                  pricing={pricing}
                  itemOrder={itemOrder}
                  updateItemOrder={updateItemOrder}
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
                  exportPricing={exportPricing}
                  importPricing={importPricing}
                  exportPricingExcel={exportPricingExcel}
                  importPricingExcel={importPricingExcel}
                  setMsg={setMsg}
                />
              ) : (
                <InventoryConfigSection 
                  pricing={pricing}
                  itemOrder={itemOrder}
                  handleStockChange={handleStockChange}
                  handleMinStockChange={handleMinStockChange}
                  can={can}
                  exportPricing={exportPricing}
                  importPricing={importPricing}
                  exportPricingExcel={exportPricingExcel}
                  importPricingExcel={importPricingExcel}
                  renameItem={renameItem}
                  renameSize={renameSize}
                  setMsg={setMsg}
                />
              )}

              <div className="flex justify-center mt-8">
                <button 
                  onClick={() => setActiveTab('sales')}
                  className="flex items-center gap-2 px-6 py-2.5 border-2 border-blue-600 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all font-mono"
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
              initial={{ opacity: 0, x: 20, rotateY: 10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -20, rotateY: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
                isAnalyzing={isAnalyzing}
                importFromSpreadsheet={importFromSpreadsheet}
                summarizeNotes={summarizeNotes}
                isSummarizing={isSummarizing}
              />
            </motion.div>
          )}

          {activeTab === 'ledger' && (
            <motion.div 
              key="ledger"
              id="ledger-panel"
              role="tabpanel"
              aria-labelledby="ledger-tab"
              initial={{ opacity: 0, x: 20, rotateY: 10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -20, rotateY: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
                itemFilter={itemFilter}
                setItemFilter={setItemFilter}
                classFilter={classFilter}
                setClassFilter={setClassFilter}
                exportLedger={exportLedger}
                importLedger={importLedger}
                importFromSpreadsheet={importFromSpreadsheet}
                isAnalyzing={isAnalyzing}
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
                onSort={handleSort}
                sortConfig={sortConfig}
                downloadTemplate={downloadTemplate}
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
              initial={{ opacity: 0, x: 20, rotateY: 10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -20, rotateY: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
              initial={{ opacity: 0, x: 20, rotateY: 10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -20, rotateY: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
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
              initial={{ opacity: 0, x: 20, rotateY: 10 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -20, rotateY: -10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <AdminDashboard 
                users={users}
                setUsers={setUsers}
                currentUser={user}
                customFields={customFields}
                addCustomField={addCustomField}
                removeCustomField={removeCustomField}
                updateCustomField={updateCustomField}
                syncSettings={syncSettings}
                setupGoogleSheet={setupGoogleSheet}
                toggleSync={toggleSync}
                manualFullSync={manualFullSync}
                isSyncing={isSyncing}
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
                    disabled={isSubmitting}
                    onClick={() => setShowConfirmation(false)}
                    className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50"
                  >
                    Review
                  </button>
                  <button 
                    disabled={isSubmitting}
                    onClick={submitTransaction}
                    className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin" size={14} />
                        Posting...
                      </>
                    ) : 'Save & Post'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
            </main>
          </div>
        </div>
      </div>

      <footer className="hidden sm:block py-6 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest border-t border-slate-100 bg-white">
        {user ? (
          <>Uniform Sales CRM &bull; &copy; 2026 Internal Operations &bull; Restricted Access</>
        ) : (
          <>Unauthorized Access Prohibited &bull; System Monitoring Active</>
        )}
      </footer>

      {/* Mobile Bottom Nav */}
      <AnimatePresence>
        {user && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 20, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200 px-4 py-2 flex sm:hidden justify-between items-center z-[100] shadow-[0_-10px_30px_rgba(0,0,0,0.08)] pb-safe" 
            role="tablist" 
            aria-label="Mobile Navigation"
          >
            {[
              { id: 'dashboard', icon: LayoutDashboard, label: 'Home' },
              { id: 'ledger', icon: History, label: 'Ledger' },
              { id: 'pricing', icon: Database, label: 'Stock' },
              { id: 'profile', icon: UserCircle, label: 'Account' },
            ].map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex flex-col items-center gap-1 p-2 flex-1 transition-all ${
                  activeTab === tab.id ? 'text-blue-600' : 'text-slate-400 opacity-60'
                }`}
              >
                <tab.icon size={20} strokeWidth={activeTab === tab.id ? 2.5 : 2} aria-hidden="true" />
                <span className="text-[8px] font-black uppercase tracking-tighter">{tab.label}</span>
              </button>
            ))}

            {/* Central Prominent Quick Add */}
            <div className="relative -top-6 flex flex-col items-center">
              <button 
                onClick={() => setActiveTab('sales')}
                className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 ${
                  activeTab === 'sales' ? 'bg-blue-600 text-white shadow-blue-500/40 ring-4 ring-white' : 'bg-slate-900 text-white shadow-slate-900/40 ring-4 ring-white'
                }`}
              >
                <Plus size={28} strokeWidth={3} />
              </button>
              <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mt-2">New Sale</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProfileSection({ user, setUser, logout }: any) {
  const [name, setName] = useState(user?.name || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setMsg({ type: 'error', text: 'File too large. Max 2MB.' });
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new (window as any).Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 300;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            const size = Math.min(img.width, img.height);
            const x = (img.width - size) / 2;
            const y = (img.height - size) / 2;
            ctx.drawImage(img, x, y, size, size, 0, 0, 300, 300);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            updatePhoto(dataUrl);
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const updatePhoto = async (photoURL: string) => {
    try {
      await updateDoc(doc(db, 'users', user.id), { photoURL });
      const updatedUser = { ...user, photoURL };
      setUser(updatedUser);
      setMsg({ type: 'success', text: 'Profile picture updated successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to save profile picture to database.' });
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateDoc(doc(db, 'users', user.id), { name });
      const updatedUser = { ...user, name };
      setUser(updatedUser);
      setMsg({ type: 'success', text: 'Profile name updated successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Failed to update name in database.' });
    }
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
          <div className="relative group self-center md:self-start">
            <div className="w-32 h-32 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl shadow-blue-500/20 text-white shrink-0 overflow-hidden relative">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <UserCircle size={64} />
              )}
            </div>

            <div className="absolute -bottom-3 -right-3 flex flex-col gap-2 z-30">
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-indigo-600 transition-all border-4 border-white"
                  title="Upload photo"
                >
                  <Upload size={18} />
                </button>
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
          </div>

          <div className="space-y-4 flex-1 w-full text-left">
             <div className="space-y-1">
                <h2 className="text-3xl font-black text-slate-900 tracking-tight">Account Settings</h2>
                <p className="text-slate-500 font-medium">Manage your profile identification and security.</p>
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
                         <label className="text-[9px] font-black uppercase text-slate-400 ml-1 flex items-center gap-2">
                           Email Address (Read Only)
                           {user?.emailVerified ? (
                             <span className="text-[8px] bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                               <Check size={8} /> Verified
                             </span>
                           ) : (
                             <span className="text-[8px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                               <AlertCircle size={8} /> Pending
                             </span>
                           ) }
                         </label>
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


function AdminDashboard({ 
  users, 
  currentUser, 
  customFields, 
  addCustomField, 
  removeCustomField, 
  updateCustomField,
  syncSettings,
  setupGoogleSheet,
  toggleSync,
  manualFullSync,
  isSyncing
}: any) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'settings' | 'sync'>('users');
  const [msg, setMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMsg({ type, text });
    setTimeout(() => setMsg(null), 3000);
  };

  const handleUpdateRole = async (userId: string, role: UserRole) => {
    if (userId === currentUser.id) {
      showMsg('error', 'You cannot change your own role.');
      return;
    }
    setIsProcessing(true);
    try {
      await setDoc(doc(db, 'users', userId), { role }, { merge: true });
      showMsg('success', 'User role updated successfully.');
    } catch (error) {
      showMsg('error', 'Failed to update role.');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (userId === currentUser.id) {
      showMsg('error', 'You cannot delete yourself.');
      return;
    }
    
    // Using a more structured confirm check
    const userName = users.find((u: User) => u.id === userId)?.name || 'this user';
    if (!window.confirm(`Are you sure you want to delete ${userName}'s account? This action is permanent and will revoke all system access immediately.`)) return;
    
    setIsProcessing(true);
    try {
      await deleteDoc(doc(db, 'users', userId));
      showMsg('success', `${userName}'s account has been successfully deleted.`);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
      showMsg('error', 'Failed to delete user. Check console for details.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-32">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 text-left">
        <div>
          <h1 className="text-4xl font-black text-slate-900 tracking-tighter">System Control</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Management Framework &bull; Admin Level</p>
        </div>
        
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          {[
            { id: 'users', label: 'Access Control', icon: Users },
            { id: 'settings', label: 'Field Architecture', icon: Sliders },
            { id: 'sync', label: 'Cloud Sync', icon: FileSpreadsheet }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
                activeSubTab === tab.id ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <tab.icon size={14} /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {msg && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-2xl flex items-center gap-3 ${
            msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {msg.type === 'success' ? <Check size={18} /> : <AlertCircle size={18} />}
          <span className="text-xs font-black uppercase tracking-widest">{msg.text}</span>
        </motion.div>
      )}

      {activeSubTab === 'users' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-1 space-y-6">
             <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-left">
                <div className="relative z-10 space-y-4">
                   <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                      <Users size={24} />
                   </div>
                   <h3 className="text-2xl font-black tracking-tight leading-tight">Identity Directory</h3>
                   <p className="text-slate-400 text-xs font-medium">Manage user permissions and platform access. Users must register an account before appearing here.</p>
                </div>
                <div className="absolute -right-8 -bottom-8 opacity-10">
                   <Users size={160} />
                </div>
             </div>

             <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 px-1 text-left">Quick Invite Info</h4>
                <div className="space-y-4">
                   <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-left">
                      <p className="text-[10px] font-bold text-blue-800 leading-relaxed">To add a new user, have them sign up with their email. Their default role will be 'Viewer'. You can then change their role to 'Editor' or 'Admin' from this dashboard.</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="xl:col-span-3">
             <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                   <table className="w-full text-left">
                      <thead>
                         <tr className="bg-slate-50 border-b border-slate-100 text-[9px] font-black uppercase tracking-widest text-slate-400">
                            <th className="px-8 py-5">User Profile</th>
                            <th className="px-8 py-5">System Role</th>
                            <th className="px-8 py-5">Registered At</th>
                            <th className="px-8 py-5 text-right">Actions</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                         {users.map((u: User) => (
                            <tr key={u.id} className="hover:bg-slate-50/30 transition-colors group">
                               <td className="px-8 py-6">
                                  <div className="flex items-center gap-4 text-left">
                                     <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg overflow-hidden ${
                                        u.role === 'Admin' ? 'bg-blue-600 text-white' : 
                                        u.role === 'Editor' ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-400'
                                     }`}>
                                        {u.photoURL ? <img src={u.photoURL} alt="" className="w-full h-full object-cover" /> : u.name.charAt(0)}
                                     </div>
                                     <div>
                                        <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">{u.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 font-mono mt-0.5">{u.email}</p>
                                     </div>
                                  </div>
                               </td>
                               <td className="px-8 py-6">
                                  <select 
                                     value={u.role}
                                     disabled={u.id === currentUser.id || isProcessing}
                                     onChange={(e) => handleUpdateRole(u.id, e.target.value as UserRole)}
                                     className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none border transition-all ${
                                        u.role === 'Admin' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                        u.role === 'Editor' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                        'bg-slate-50 text-slate-500 border-slate-200'
                                     } ${u.id === currentUser.id ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-blue-300'}`}
                                  >
                                     <option value="Viewer">Viewer</option>
                                     <option value="Editor">Editor</option>
                                     <option value="Admin">Admin</option>
                                  </select>
                               </td>
                               <td className="px-8 py-6">
                                  <p className="text-[10px] font-bold text-slate-400 font-mono uppercase">
                                     {u.createdAt ? new Date(u.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '---'}
                                  </p>
                               </td>
                               <td className="px-8 py-6 text-right">
                                  {u.id !== currentUser.id ? (
                                     <button 
                                        onClick={() => handleDeleteUser(u.id)}
                                        disabled={isProcessing}
                                        className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                                     >
                                        <Trash2 size={18} />
                                     </button>
                                  ) : (
                                     <span className="text-[8px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full tracking-widest">Self</span>
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
      ) : activeSubTab === 'settings' ? (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
          <div className="xl:col-span-1 space-y-6">
             <div className="bg-blue-600 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-left">
                <div className="relative z-10 space-y-4">
                   <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                      <Sliders size={24} />
                   </div>
                   <h3 className="text-2xl font-black tracking-tight leading-tight">Data Architecture</h3>
                   <p className="text-blue-100 text-xs font-medium">Define and configure custom metrics to capture specific information during the billing process.</p>
                </div>
                <div className="absolute -right-8 -bottom-8 opacity-10">
                   <Sliders size={160} />
                </div>
             </div>
          </div>

          <div className="xl:col-span-3 space-y-4">
             {customFields.map((field: any) => (
                <div key={field.id} className="bg-white p-6 rounded-[2.5rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-6 items-start sm:items-center group hover:border-blue-200 transition-colors text-left">
                   <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center shrink-0 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      {field.type === 'number' ? <Hash size={20} /> : field.type === 'date' ? <Calendar size={20} /> : <Type size={20} />}
                   </div>
                   
                   <div className="flex-1 min-w-0 space-y-1">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Field Identifier</p>
                      <input 
                         type="text" 
                         value={field.label}
                         onChange={(e) => updateCustomField(field.id, { label: e.target.value })}
                         className="w-full text-lg font-black text-slate-900 border-none bg-transparent p-0 outline-none focus:ring-0"
                      />
                   </div>

                   <div className="flex flex-wrap gap-2 items-center">
                      <select 
                         value={field.type}
                         onChange={(e) => updateCustomField(field.id, { type: e.target.value as any })}
                         className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-300"
                      >
                         <option value="text">Textual</option>
                         <option value="number">Numeric</option>
                         <option value="date">Temporal</option>
                      </select>

                      <button 
                         onClick={() => removeCustomField(field.id)}
                         className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
                      >
                         <Trash2 size={18} />
                      </button>
                   </div>
                </div>
             ))}

             <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-4 text-left">
                <form onSubmit={addCustomField} className="flex flex-col sm:flex-row gap-4">
                   <input 
                      name="label"
                      placeholder="Enter new field label..."
                      required
                      className="flex-1 bg-white border border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-blue-600 transition-all shadow-sm"
                   />
                   <select 
                      name="type"
                      className="bg-white border border-slate-200 rounded-2xl px-6 py-4 text-xs font-bold outline-none focus:border-blue-600 transition-all shadow-sm appearance-none"
                   >
                      <option value="text">Text Input</option>
                      <option value="number">Number Input</option>
                      <option value="date">Date Picker</option>
                   </select>
                   <button 
                      type="submit"
                      className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
                   >
                      Construct Field
                   </button>
                </form>
             </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-8">
           <div className="xl:col-span-1 space-y-6">
              <div className="bg-emerald-600 text-white p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden text-left">
                 <div className="relative z-10 space-y-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center">
                       <FileSpreadsheet size={24} />
                    </div>
                    <h3 className="text-2xl font-black tracking-tight leading-tight">Google Sheets<br/>Backup</h3>
                    <p className="text-emerald-100 text-xs font-medium">Synchronize all ledger records with a live spreadsheet for external analysis and backup.</p>
                 </div>
                 <div className="absolute -right-8 -bottom-8 opacity-10">
                    <CloudLightning size={160} />
                 </div>
              </div>

              <div className="bg-white p-6 rounded-[2.5rem] border border-slate-200">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 px-1 text-left">Sync Invariant</h4>
                <div className="space-y-4">
                   <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-left">
                      <p className="text-[10px] font-bold text-emerald-800 leading-relaxed">
                        Data synchronization is real-time. Any entry, update, or deletion in the system is instantly reflected in your connected Google Sheet.
                      </p>
                   </div>
                </div>
              </div>
           </div>

           <div className="xl:col-span-3">
              <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10 text-left">
                 {!syncSettings || !syncSettings.spreadsheetId ? (
                   <div className="space-y-8 max-w-lg">
                      <div className="space-y-2">
                        <h3 className="text-2xl font-black text-slate-900">Initialize Integration</h3>
                        <p className="text-slate-500 text-sm">Connect your Google workspace account to begin the synchronization process.</p>
                      </div>

                      <div className="space-y-4 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600">
                               <CheckCircle size={20} />
                            </div>
                            <p className="text-xs font-bold text-slate-700">Automatic real-time data push</p>
                         </div>
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600">
                               <CheckCircle size={20} />
                            </div>
                            <p className="text-xs font-bold text-slate-700">One-click spreadsheet generation</p>
                         </div>
                         <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600">
                               <CheckCircle size={20} />
                            </div>
                            <p className="text-xs font-bold text-slate-700">Dynamic column architecture</p>
                         </div>
                      </div>

                      <button 
                        onClick={setupGoogleSheet}
                        disabled={isSyncing}
                        className="w-full sm:w-auto px-10 py-5 bg-slate-900 text-white rounded-full font-black text-xs uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-4"
                      >
                        {isSyncing ? 'Configuring Nodes...' : 'Connect Google Sheets'}
                        <ExternalLink size={18} />
                      </button>
                   </div>
                 ) : (
                   <div className="space-y-8">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 pb-8 border-b border-slate-100">
                        <div className="space-y-2">
                           <div className="flex items-center gap-3">
                              <h3 className="text-2xl font-black text-slate-900">Sync Status</h3>
                              <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-tighter ${syncSettings.enabled ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600 animate-pulse'}`}>
                                {syncSettings.enabled ? 'Active Pulse' : 'Paused'}
                              </span>
                           </div>
                           <p className="text-slate-500 text-xs font-mono truncate max-w-xs md:max-w-md">ID: {syncSettings.spreadsheetId}</p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                           <button 
                             onClick={() => toggleSync(!syncSettings.enabled)}
                             className={`px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all ${
                               syncSettings.enabled 
                                 ? 'bg-red-50 text-red-600 hover:bg-red-100' 
                                 : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                             }`}
                           >
                             {syncSettings.enabled ? 'Disable Sync' : 'Enable Sync'}
                           </button>

                           <a 
                             href={`https://docs.google.com/spreadsheets/d/${syncSettings.spreadsheetId}`}
                             target="_blank"
                             rel="noopener noreferrer"
                             className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10 flex items-center gap-2"
                           >
                             Open Sheet <ExternalLink size={14} />
                           </a>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                         <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
                            <div className="space-y-2">
                               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Maintenance Mode</p>
                               <h4 className="text-lg font-black text-slate-900">Force Full Refresh</h4>
                               <p className="text-xs text-slate-500 leading-relaxed">
                                  Resets the spreadsheet and re-uploads all current ledger records. Useful if the sheet was manually edited or shared incorrectly.
                               </p>
                            </div>
                            <button 
                              onClick={manualFullSync}
                              disabled={isSyncing}
                              className="w-full py-4 bg-white border-2 border-slate-200 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-emerald-500 hover:text-emerald-600 transition-all flex items-center justify-center gap-2"
                            >
                              {isSyncing ? 'Syncing...' : 'Initiate Full Sync'}
                              <RefreshCw size={14} />
                            </button>
                         </div>

                         <div className="p-8 bg-blue-50/30 rounded-[2.5rem] border border-blue-100/50 space-y-6">
                            <div className="space-y-2">
                               <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Integration Health</p>
                               <h4 className="text-lg font-black text-slate-900">Migration & Swap</h4>
                               <p className="text-xs text-slate-500 leading-relaxed">
                                  Need a new sheet? Disconnecting will clear the current connection but won't delete the file in your Google Drive.
                               </p>
                            </div>
                            <button 
                              onClick={async () => {
                                if(window.confirm("Are you sure? This will stop syncing to this sheet.")) {
                                    await setupGoogleSheet();
                                }
                              }}
                              className="w-full py-4 bg-white border-2 border-blue-200 text-blue-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-2"
                            >
                              Swap Target Sheet
                              <Share size={14} />
                            </button>
                         </div>
                      </div>
                   </div>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
}


function ReportsSection({ 
  records, pricing, dateStart, setDateStart, dateEnd, setDateEnd, 
  itemFilter, setItemFilter, classFilter, setClassFilter 
}: any) {
  const itemNames = Object.keys(pricing);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportReady, setReportReady] = useState(false);

  // References for chart export
  const timelineRef = useRef<HTMLDivElement>(null);
  const itemsChartRef = useRef<HTMLDivElement>(null);
  const classChartRef = useRef<HTMLDivElement>(null);

  const exportChart = async (ref: React.RefObject<HTMLDivElement>, name: string) => {
    if (ref.current === null) return;
    try {
      const dataUrl = await toPng(ref.current, { backgroundColor: '#ffffff', quality: 1 });
      download(dataUrl, `${name}-${new Date().toISOString().split('T')[0]}.png`);
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const generateReport = () => {
    setIsGenerating(true);
    // Simulate generation for better UX
    setTimeout(() => {
      setIsGenerating(false);
      setReportReady(true);
    }, 800);
  };

  const filteredData = useMemo(() => {
    if (!reportReady) return [];
    return records.filter((r: SaleRecord) => {
      const matchesDateStart = !dateStart || r.date >= dateStart;
      const matchesDateEnd = !dateEnd || r.date <= dateEnd;
      const matchesClass = classFilter === 'All' || r.studentClass === classFilter;
      const matchesItem = itemFilter === 'All' || r.items.some(i => i.item === itemFilter);
      return matchesDateStart && matchesDateEnd && matchesClass && matchesItem;
    });
  }, [records, dateStart, dateEnd, classFilter, itemFilter, reportReady]);

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
      if (r.studentClass) {
        classMap[r.studentClass] = (classMap[r.studentClass] || 0) + r.totalAmount;
      }
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

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl shadow-2xl border border-slate-100 ring-1 ring-black/5">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">{label}</p>
          <p className="text-sm font-black text-slate-900">₹{payload[0].value.toLocaleString()}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-8 text-left">
      <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-200 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Sliders size={28} className="text-blue-600" /> Analytical Workspace
            </h2>
            <p className="text-slate-500 font-medium tracking-tight">Configure parameters to synthesize business intelligence reports.</p>
          </div>
          
          <button 
            onClick={generateReport}
            disabled={isGenerating}
            className={`flex items-center gap-3 px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-xl ${isGenerating ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-blue-600 shadow-blue-500/20 active:scale-95'}`}
          >
            {isGenerating ? (
              <div className="w-5 h-5 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
            ) : (
              <Search size={18} />
            )}
            {isGenerating ? 'Synthesizing...' : 'Generate Report'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 pt-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest block">Date Range</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="date" 
                    value={dateStart} 
                    onChange={e => { setDateStart(e.target.value); setReportReady(false); }} 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold focus:bg-white focus:border-blue-500 transition-all shadow-sm" 
                  />
                </div>
                <div className="relative flex-1">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="date" 
                    value={dateEnd} 
                    onChange={e => { setDateEnd(e.target.value); setReportReady(false); }} 
                    className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold focus:bg-white focus:border-blue-500 transition-all shadow-sm" 
                  />
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1 items-center px-1">
              {[
                { label: 'Today', d: 0 },
                { label: 'Last 7 Days', d: 7 },
                { label: 'This Month', d: 30 }
              ].map(q => (
                <button 
                  key={q.label}
                  onClick={() => {
                    const end = new Date().toISOString().split('T')[0];
                    const start = new Date(Date.now() - q.d * 86400000).toISOString().split('T')[0];
                    setDateStart(start);
                    setDateEnd(end);
                    setReportReady(false);
                  }}
                  className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-[8px] font-black uppercase rounded-lg text-slate-500 transition-all"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest block">Category Focus</label>
            <div className="relative">
              <Package className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select 
                value={itemFilter} 
                onChange={e => { setItemFilter(e.target.value); setReportReady(false); }} 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold focus:bg-white focus:border-blue-500 transition-all appearance-none cursor-pointer shadow-sm"
              >
                <option value="All">Cross-Item Analysis</option>
                {itemNames.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
            </div>
          </div>
          <div className="space-y-2">
            <label className="text-[9px] font-black uppercase text-slate-400 ml-1 tracking-widest block">Class Segmentation</label>
            <div className="relative">
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <select 
                value={classFilter} 
                onChange={e => { setClassFilter(e.target.value); setReportReady(false); }} 
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold focus:bg-white focus:border-blue-500 transition-all appearance-none cursor-pointer shadow-sm"
              >
                <option value="All">Global Overview</option>
                {CLASSES.map(cls => <option key={cls} value={cls}>{cls}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" size={12} />
            </div>
          </div>
        </div>
      </div>

      {!reportReady ? (
        <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-[2.5rem] p-24 flex flex-col items-center justify-center text-center space-y-4">
           <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center text-slate-300 shadow-xl shadow-slate-100 border border-slate-100">
              <TrendingUp size={40} />
           </div>
           <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase tracking-widest">Awaiting Command</h3>
              <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Press 'Generate Report' to visualize your filtered data.</p>
           </div>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Synthesized Revenue', val: `₹${reportStats.totalRev.toLocaleString()}`, bgColor: 'bg-blue-600', textColor: 'text-white', icon: TrendingUp },
              { label: 'Realized Liquidity', val: `₹${reportStats.totalPaid.toLocaleString()}`, bgColor: 'bg-emerald-500', textColor: 'text-white', icon: CreditCard },
              { label: 'Exposure Gap', val: `₹${reportStats.totalPending.toLocaleString()}`, bgColor: 'bg-rose-500', textColor: 'text-white', icon: History },
              { label: 'Volume Dispatched', val: reportStats.totalItems, bgColor: 'bg-indigo-600', textColor: 'text-white', icon: Package },
            ].map((stat, i) => (
              <div key={i} className={`${stat.bgColor} p-6 rounded-3xl shadow-xl shadow-slate-100 border border-white/10 relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
                  <stat.icon size={64} />
                </div>
                <div className="relative z-10">
                   <div className="text-[10px] font-black uppercase tracking-[0.2em] text-white/60 mb-2">{stat.label}</div>
                   <div className="text-2xl font-black text-white font-mono tracking-tighter">{stat.val}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Revenue Timeline */}
            <div ref={timelineRef} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Revenue Timeline</h3>
                  <div className="text-lg font-black text-slate-900 tracking-tight">Growth Trajectory</div>
                </div>
                <button 
                  onClick={() => exportChart(timelineRef, 'revenue-timeline')}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                  title="Export PNG"
                >
                  <DownloadCloud size={20} />
                </button>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={reportStats.timeline}>
                    <defs>
                      <linearGradient id="lineGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis 
                      dataKey="date" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 700 }} 
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="amount" 
                      stroke="#2563eb" 
                      strokeWidth={4} 
                      dot={{ r: 0 }} 
                      activeDot={{ r: 8, fill: '#2563eb', stroke: '#fff', strokeWidth: 4 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue by Item */}
            <div ref={itemsChartRef} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Inventory Performance</h3>
                  <div className="text-lg font-black text-slate-900 tracking-tight">Revenue contribution</div>
                </div>
                <button 
                  onClick={() => exportChart(itemsChartRef, 'item-performance')}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                  title="Export PNG"
                >
                  <DownloadCloud size={20} />
                </button>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportStats.itemContribution} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f8fafc" />
                    <XAxis type="number" hide />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#64748b', fontWeight: 800 }} 
                      width={120} 
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar 
                      dataKey="value" 
                      fill="#6366f1" 
                      radius={[0, 12, 12, 0]} 
                      barSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Revenue by Class */}
            <div ref={classChartRef} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm transition-all hover:shadow-md lg:col-span-2">
              <div className="flex items-center justify-between mb-8">
                <div className="space-y-1">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400">Cohort Analysis</h3>
                  <div className="text-lg font-black text-slate-900 tracking-tight">Financial segmentation by class</div>
                </div>
                <button 
                  onClick={() => exportChart(classChartRef, 'class-segmentation')}
                  className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
                  title="Export PNG"
                >
                  <DownloadCloud size={20} />
                </button>
              </div>
              <div className="h-[320px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportStats.classContribution}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f8fafc" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} 
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fontSize: 9, fill: '#94a3b8', fontWeight: 800 }} 
                    />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8fafc' }} />
                    <Bar 
                      dataKey="value" 
                      fill="#10b981" 
                      radius={[12, 12, 0, 0]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </motion.div>
      )}
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
  const [customData, setCustomData] = useState(record.customData || {});
  const [discountAmount, setDiscountAmount] = useState<string>(record.discount?.toString() || '0');
  
  const [newItem, setNewItem] = useState({
    item: Object.keys(pricing)[0] || '',
    size: pricing[Object.keys(pricing)[0]] ? Object.keys(pricing[Object.keys(pricing)[0]])[0] : '',
    qty: 1,
    notes: ''
  });

  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + (item.qty * item.rate), 0), [cart]);
  
  const finalPayable = useMemo(() => {
    const dp = Number(discountAmount) || 0;
    const dv = (cartTotal * dp) / 100;
    return Math.max(0, cartTotal - dv);
  }, [cartTotal, discountAmount]);

  const currentRate = useMemo(() => {
    return pricing[newItem.item]?.[newItem.size]?.price || 0;
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
      discountPercent: Number(discountAmount) || 0,
      paymentMode,
      notes: generalNotes.trim(),
      customData
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
                    value={customData[field.id] || ''} 
                    onChange={e => setCustomData((p: any) => ({ ...p, [field.id]: e.target.value }))}
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
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Discount (%)</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-500 text-xs">-</span>
                <input 
                  type="number" 
                  value={discountAmount} 
                  onChange={e => setDiscountAmount(e.target.value)} 
                  placeholder="0"
                  className="w-12 bg-slate-800 border-b border-slate-700 text-right px-1 py-0.5 text-xs text-blue-400 font-bold outline-none"
                />
                <span className="text-[10px] font-black text-slate-600">%</span>
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

function PriceConfigSection({ pricing, itemOrder, updateItemOrder, handlePriceChange, renameItem, renameSize, addNewItem, deleteItem, addNewSize, deleteSize, newItem, setNewItem, can, exportPricing, importPricing, exportPricingExcel, importPricingExcel, setMsg }: any) {
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
      <div className="bg-slate-900 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="font-black text-white uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
          <Tag size={16} className="text-blue-400" />
          Price Configuration
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="group relative">
            <button 
              onClick={exportPricingExcel}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95"
            >
              <DownloadCloud size={14} /> Export
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
               <button onClick={exportPricingExcel} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 border-b border-slate-50 text-slate-700">
                  <FileSpreadsheet size={16} className="text-emerald-500" /> Excel (.xlsx)
               </button>
               <button onClick={exportPricing} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700">
                  <PackageSearch size={16} className="text-blue-500" /> JSON (.json)
               </button>
            </div>
          </div>

          <button 
            onClick={exportPricingExcel}
            className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white border border-slate-700 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" /> Template
          </button>

          <div className="group relative">
            <input type="file" accept=".json" ref={jsonFileInputRef} onChange={importPricing} className="hidden" />
            <input type="file" accept=".xlsx,.xls,.csv" ref={excelFileInputRef} onChange={importPricingExcel} className="hidden" />
            
            <button 
              onClick={() => excelFileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-blue-500 transition-all shadow-lg active:scale-95"
            >
              <Upload size={14} /> Import
            </button>
            
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
               <button onClick={() => excelFileInputRef.current?.click()} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 border-b border-slate-50 text-slate-700">
                  <FileSpreadsheet size={16} className="text-emerald-500" /> Excel (.xlsx)
               </button>
               <button onClick={() => jsonFileInputRef.current?.click()} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700">
                  <PackageSearch size={16} className="text-blue-500" /> JSON (.json)
               </button>
            </div>
          </div>
        </div>
      </div>
      
      <div className="p-8 overflow-x-auto custom-scroll">
        <Reorder.Group 
          axis="x" 
          values={itemOrder} 
          onReorder={updateItemOrder} 
          className="flex gap-6 min-w-max pb-4"
        >
          <AnimatePresence mode="popLayout">
            {itemOrder.map((item) => {
              const sizes = pricing[item] || {};
              return (
                <Reorder.Item 
                  key={item} 
                  value={item}
                  dragListener={true}
                  className="w-72 bg-slate-50/50 rounded-[32px] border border-slate-200 flex flex-col overflow-hidden shrink-0 group/item transition-all hover:shadow-2xl hover:shadow-blue-500/5 hover:-translate-y-1 relative"
                >
                  {/* Header: Item Name */}
                  <div className="bg-white px-6 py-5 border-b border-slate-200 flex justify-between items-center cursor-grab active:cursor-grabbing">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                        <Package size={16} />
                      </div>
                      {can('edit') ? (
                        <div className="relative flex-1 group/input">
                          <input 
                            type="text"
                            defaultValue={item}
                            aria-label={`Rename item ${item}`}
                            onBlur={(e) => {
                              const newVal = e.target.value.trim();
                              if (newVal && newVal !== item) {
                                if (pricing[newVal]) {
                                  setMsg({ type: 'error', text: `Category "${newVal}" already exists.` });
                                  e.target.value = item;
                                } else {
                                  renameItem(item, newVal);
                                }
                              } else {
                                e.target.value = item;
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                              if (e.key === 'Escape') {
                                e.currentTarget.value = item;
                                e.currentTarget.blur();
                              }
                              e.stopPropagation();
                            }}
                            className="text-[11px] font-black text-slate-800 uppercase tracking-widest bg-transparent border-b-2 border-transparent hover:border-blue-100 focus:border-blue-500 focus:bg-blue-50/50 px-1 -ml-1 rounded-md outline-none w-full transition-all cursor-text"
                          />
                          <Pencil size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover/input:opacity-100 pointer-events-none transition-opacity" />
                        </div>
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
                  <div className="grid grid-cols-2 px-6 py-3 bg-slate-100/50 border-b border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Price (₹)</span>
                  </div>

                  {/* Rows Area */}
                  <div className="flex-1 overflow-y-auto max-h-[350px] custom-scroll">
                    {Object.entries(sizes).map(([size, info]: [string, any]) => (
                      <div key={size} className="grid grid-cols-2 items-center px-6 py-4 border-b border-slate-100 hover:bg-white transition-colors group/row">
                        {can('edit') ? (
                          <div className="relative group/input">
                            <input 
                              type="text"
                              defaultValue={size}
                              onBlur={(e) => {
                                const newVal = e.target.value.trim();
                                if (newVal && newVal !== size) {
                                  if (pricing[item][newVal]) {
                                    setMsg({ type: 'error', text: `Size "${newVal}" already exists for this item.` });
                                    e.target.value = size;
                                  } else {
                                    renameSize(item, size, newVal);
                                  }
                                } else {
                                  e.target.value = size;
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') e.currentTarget.blur();
                                if (e.key === 'Escape') {
                                  e.currentTarget.value = size;
                                  e.currentTarget.blur();
                                }
                              }}
                              className="text-[10px] font-bold text-slate-600 uppercase bg-transparent outline-none border-b-2 border-transparent hover:border-blue-100 focus:border-blue-500 focus:bg-blue-50/50 px-1 -ml-1 rounded-sm transition-all w-full pr-4"
                            />
                            <Pencil size={8} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover/input:opacity-100 pointer-events-none transition-opacity" />
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-600 uppercase truncate pr-2">{size}</span>
                        )}
                        
                        <div className="flex items-center justify-end gap-1 relative">
                          {can('edit') ? (
                            <input 
                              type="number" 
                              value={info.price}
                              onChange={(e) => handlePriceChange(item, size, Number(e.target.value))}
                              className="w-20 text-right text-[11px] font-black text-slate-900 bg-slate-100/50 px-3 py-2 rounded-xl outline-none focus:bg-blue-50 focus:ring-4 focus:ring-blue-100 transition-all"
                            />
                          ) : (
                            <span className="text-[11px] font-black text-slate-900">{info.price}</span>
                          )}
                          {can('delete') && (
                            <button 
                              onClick={() => deleteSize(item, size)}
                              className="absolute -right-5 text-slate-200 hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-all p-1"
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
                      className="p-5 bg-white border-t border-slate-200"
                    >
                      <div className="flex gap-2">
                        <input name="size" placeholder="SIZE" className="w-16 px-3 py-2 text-[10px] uppercase font-black bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 focus:bg-white transition-all text-center" required />
                        <input name="price" type="number" placeholder="PRICE ₹" className="flex-1 px-3 py-2 text-[10px] font-bold bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 focus:bg-white transition-all" required />
                        <button type="submit" className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-lg shadow-blue-500/20">
                          <Plus size={14} strokeWidth={3} />
                        </button>
                      </div>
                    </form>
                  )}
                </Reorder.Item>
              );
            })}
          </AnimatePresence>

          {/* Add New Item Column Form */}
          {can('add') && (
            <div className="w-72 bg-slate-50 border-2 border-dashed border-slate-200 rounded-[32px] flex flex-col shrink-0 overflow-hidden hover:border-blue-300 hover:bg-blue-50/20 transition-all group/newitem">
               <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
                  <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-slate-300 shadow-sm border border-slate-100 group-hover/newitem:text-blue-500 group-hover/newitem:scale-110 group-hover/newitem:shadow-lg transition-all">
                    <PlusCircle size={28} strokeWidth={1.5} />
                  </div>
                  <div>
                     <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest mb-1">New Category</h3>
                     <p className="text-[10px] text-slate-400 font-medium">Extend your product range</p>
                  </div>
                  <form onSubmit={addNewItem} className="w-full space-y-3">
                    <input 
                      name="itemName"
                      placeholder="Item Name (e.g. Tie)"
                      className="w-full px-5 py-4 text-xs text-center border-2 border-slate-100 rounded-2xl bg-white focus:border-blue-500 focus:ring-8 focus:ring-blue-50 outline-none transition-all font-semibold shadow-sm"
                      required
                    />
                    <button type="submit" className="w-full bg-slate-900 text-white font-black text-[10px] py-4 rounded-2xl tracking-[0.2em] hover:bg-blue-600 transition-all shadow-xl active:scale-95 uppercase">
                      INITIALIZE COLUMN
                    </button>
                  </form>
               </div>
            </div>
          )}
        </Reorder.Group>
      </div>
    </section>
  );
}

function InventoryConfigSection({ pricing, itemOrder, handleStockChange, handleMinStockChange, can, exportPricing, importPricing, exportPricingExcel, importPricingExcel, renameItem, renameSize, setMsg }: any) {
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const excelFileInputRef = useRef<HTMLInputElement>(null);

  return (
    <section className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
      <div className="bg-slate-900 px-8 py-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="font-black text-white uppercase text-[10px] tracking-[0.2em] flex items-center gap-2">
          <Package size={16} className="text-orange-400" />
          Inventory Management
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <div className="group relative">
            <button 
              onClick={exportPricingExcel}
              className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95"
            >
              <DownloadCloud size={14} /> Export
            </button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
               <button onClick={exportPricingExcel} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 border-b border-slate-50 text-slate-700">
                  <FileSpreadsheet size={16} className="text-emerald-500" /> Excel (.xlsx)
               </button>
               <button onClick={exportPricing} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700">
                  <PackageSearch size={16} className="text-blue-500" /> JSON (.json)
               </button>
            </div>
          </div>

          <button 
            onClick={exportPricingExcel}
            className="flex items-center gap-2 px-5 py-3 bg-slate-800 text-white border border-slate-700 rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all shadow-lg active:scale-95"
          >
            <FileSpreadsheet size={14} className="text-emerald-400" /> Template
          </button>

          <div className="group relative">
            <input type="file" accept=".json" ref={jsonFileInputRef} onChange={importPricing} className="hidden" />
            <input type="file" accept=".xlsx,.xls,.csv" ref={excelFileInputRef} onChange={importPricingExcel} className="hidden" />
            
            <button 
              onClick={() => excelFileInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 bg-orange-600 text-white rounded-2xl text-[9px] font-black uppercase tracking-widest hover:bg-orange-500 transition-all shadow-lg active:scale-95"
            >
              <Upload size={14} /> Import
            </button>
            
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-2xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden">
               <button onClick={() => excelFileInputRef.current?.click()} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 border-b border-slate-50 text-slate-700">
                  <FileSpreadsheet size={16} className="text-emerald-500" /> Excel (.xlsx)
               </button>
               <button onClick={() => jsonFileInputRef.current?.click()} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 text-slate-700">
                  <PackageSearch size={16} className="text-blue-500" /> JSON (.json)
               </button>
            </div>
          </div>
          
          <div className="h-6 w-px bg-slate-700 mx-2 hidden md:block" />

          <div className="flex items-center gap-4 text-[10px] font-black uppercase text-slate-400">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500" /> Low Stock</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-200" /> Sufficient</div>
          </div>
        </div>
      </div>
      
      <div className="p-8 overflow-x-auto custom-scroll">
        <div className="flex gap-6 min-w-max pb-4">
          <AnimatePresence mode="popLayout">
            {itemOrder.map((item: string) => {
              const sizes = pricing[item] || {};
              return (
                <motion.div 
                  key={item} 
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="w-72 bg-slate-50/50 rounded-[32px] border border-slate-200 flex flex-col overflow-hidden shrink-0 group/item transition-all hover:shadow-2xl hover:shadow-orange-500/5 hover:-translate-y-1"
                >
                  {/* Header: Item Name */}
                  <div className="bg-white px-6 py-5 border-b border-slate-200 flex justify-between items-center">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="p-2 bg-orange-50 text-orange-600 rounded-xl">
                        <Package size={16} />
                      </div>
                      {can('edit') ? (
                        <div className="relative flex-1 group/input">
                          <input 
                            type="text"
                            defaultValue={item}
                            aria-label={`Rename item ${item}`}
                            onBlur={(e) => {
                              const newVal = e.target.value.trim();
                              if (newVal && newVal !== item) {
                                if (pricing[newVal]) {
                                  setMsg({ type: 'error', text: `Category "${newVal}" already exists.` });
                                  e.target.value = item;
                                } else {
                                  renameItem(item, newVal);
                                }
                              } else {
                                e.target.value = item;
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') e.currentTarget.blur();
                              if (e.key === 'Escape') {
                                e.currentTarget.value = item;
                                e.currentTarget.blur();
                              }
                            }}
                            className="text-[11px] font-black text-slate-800 uppercase tracking-widest bg-transparent border-b-2 border-transparent hover:border-orange-100 focus:border-orange-500 focus:bg-orange-50/50 px-1 -ml-1 rounded-md outline-none w-full transition-all cursor-text"
                          />
                          <Pencil size={10} className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover/input:opacity-100 pointer-events-none transition-opacity" />
                        </div>
                      ) : (
                        <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">{item}</span>
                      )}
                    </div>
                  </div>

                  {/* Sub-headings Row */}
                  <div className="grid grid-cols-3 px-6 py-3 bg-slate-100/50 border-b border-slate-200">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Size</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock</span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Min</span>
                  </div>

                  {/* Rows Area */}
                  <div className="flex-1 overflow-y-auto max-h-[350px] custom-scroll">
                    {Object.entries(sizes).map(([size, info]: [string, any]) => {
                      const isLowStock = info.stock <= (info.minStock || 0);
                      return (
                        <div key={size} className="grid grid-cols-3 items-center px-6 py-4 border-b border-slate-100 hover:bg-white transition-colors group/row">
                          {can('edit') ? (
                            <div className="relative group/input">
                              <input 
                                type="text"
                                defaultValue={size}
                                onBlur={(e) => {
                                  const newVal = e.target.value.trim();
                                  if (newVal && newVal !== size) {
                                    if (pricing[item][newVal]) {
                                      setMsg({ type: 'error', text: `Size "${newVal}" already exists for this item.` });
                                      e.target.value = size;
                                    } else {
                                      renameSize(item, size, newVal);
                                    }
                                  } else {
                                    e.target.value = size;
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') e.currentTarget.blur();
                                  if (e.key === 'Escape') {
                                    e.currentTarget.value = size;
                                    e.currentTarget.blur();
                                  }
                                }}
                                className="text-[10px] font-bold text-slate-600 uppercase bg-transparent outline-none border-b-2 border-transparent hover:border-orange-100 focus:border-orange-500 focus:bg-orange-50/50 px-1 -ml-1 rounded-sm transition-all w-full pr-4"
                              />
                              <Pencil size={8} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-300 opacity-0 group-hover/input:opacity-100 pointer-events-none transition-opacity" />
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-slate-600 uppercase truncate pr-2">{size}</span>
                          )}
                          
                          <div className="flex justify-center">
                            {can('edit') ? (
                              <input 
                                type="number" 
                                value={info.stock}
                                onChange={(e) => handleStockChange(item, size, Number(e.target.value))}
                                className={`w-16 text-center text-[11px] font-black px-2 py-1.5 rounded-lg outline-none focus:ring-4 transition-all ${
                                  isLowStock ? 'bg-red-50 text-red-600 focus:ring-red-100' : 'bg-slate-100/50 text-slate-900 focus:ring-slate-100'
                                }`}
                              />
                            ) : (
                              <span className={`text-[11px] font-black ${isLowStock ? 'text-red-500' : 'text-slate-900'}`}>{info.stock}</span>
                            )}
                          </div>

                          <div className="flex justify-end">
                            {can('edit') ? (
                              <input 
                                type="number" 
                                value={info.minStock || 0}
                                onChange={(e) => handleMinStockChange(item, size, Number(e.target.value))}
                                className="w-14 text-right text-[10px] font-bold text-slate-400 bg-transparent outline-none focus:text-blue-600 transition-all"
                              />
                            ) : (
                              <span className="text-[10px] font-bold text-slate-400">{info.minStock || 0}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    
                    {Object.entries(sizes).length === 0 && (
                      <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-2 opacity-40">
                        <Package size={24} className="text-slate-300" />
                        <p className="text-[10px] font-bold uppercase tracking-widest">No sizes added</p>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
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
  addCustomField, removeCustomField, updateCustomField, recentRecords, can,
  isAnalyzing, importFromSpreadsheet, summarizeNotes, isSummarizing
}: any) {
  const [activeStep, setActiveStep] = useState(1);
  const [showAddedMsg, setShowAddedMsg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importFromSpreadsheet(file);
    }
  };

  const handleAddToCart = (e: any) => {
    addToCart(e);
    if (!studentName.trim()) return; // addToCart validates studentName
    setShowAddedMsg(true);
    setTimeout(() => setShowAddedMsg(false), 2000);
  };

  const handleAddToCartAndGoToRemarks = (e: any) => {
    handleAddToCart(e);
    if (!studentName.trim()) return;
    setActiveStep(4);
  };
  const isCustomFieldsValid = customFields.every((f: any) => !f.required || (customValues[f.id] && String(customValues[f.id]).trim() !== ''));
  const missingFields = customFields.filter((f: any) => f.required && (!customValues[f.id] || String(customValues[f.id]).trim() === ''));

  const steps = [
    { id: 1, name: 'Identity', icon: <Hash size={12} /> },
    { id: 2, name: 'Student', icon: <UserIcon size={12} /> },
    { id: 3, name: 'Inventory', icon: <Package size={12} /> },
    { id: 4, name: 'Checkout', icon: <CreditCard size={12} /> }
  ];

  return (
    <div className="space-y-8 pb-20">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 px-2">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900">New Sale</h2>
          <p className="text-slate-500 font-medium text-sm mt-1">Create a new student billing record.</p>
        </div>

        <div className="flex items-center gap-4">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImport} 
            className="hidden" 
            accept=".csv,.xlsx,.xls"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isAnalyzing}
            className="flex items-center gap-2 bg-white border border-slate-200 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {isAnalyzing ? (
              <Loader2 className="animate-spin" size={12} />
            ) : (
              <Upload size={12} />
            )}
            {isAnalyzing ? 'Analyzing...' : 'AI Import'}
          </button>
          
          {/* Modern Step Indicator */}
          <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200">
          {steps.map((step) => (
            <div 
              key={step.id}
              onClick={() => setActiveStep(step.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 cursor-pointer ${
                activeStep === step.id 
                  ? 'bg-white text-blue-600 shadow-sm ring-1 ring-slate-200 shadow-slate-200' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-[10px] font-black ${
                activeStep === step.id ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-500'
              }`}>
                {step.id}
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">{step.name}</span>
            </div>
          ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Form Area */}
        <div className="lg:col-span-8 space-y-6">
          <section className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
            <div className="bg-slate-900 px-8 py-6 text-white flex justify-between items-center group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/40 group-hover:scale-110 transition-transform">
                  <CreditCard className="text-white" size={24} />
                </div>
                <div>
                  <h3 className="font-black text-xl tracking-tight">Billing Assistant</h3>
                  <div className="flex items-center gap-2 mt-0.5 opacity-60">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Active Terminal</span>
                  </div>
                </div>
              </div>
              {can('manage-users') && (
                <button 
                  onClick={() => setShowConfig(!showConfig)}
                  className={`p-3 rounded-2xl transition-all ${showConfig ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'}`}
                >
                  <Settings size={20} />
                </button>
              )}
            </div>
            
            <AnimatePresence>
              {showConfig && can('manage-users') && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="bg-slate-50 border-b border-slate-100 overflow-hidden">
                  <div className="p-8 space-y-4">
                    <div className="flex items-center gap-2 mb-2">
                       <Sliders className="text-blue-500" size={14} />
                       <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Form Configuration</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-56 overflow-y-auto custom-scroll pr-2">
                      {customFields.map((field: any) => (
                        <div key={field.id} className="flex gap-2 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                          <input type="text" value={field.label} onChange={(e) => updateCustomField(field.id, { label: e.target.value })} className="bg-transparent text-xs font-bold w-full outline-none focus:text-blue-600" />
                          <div className="h-6 w-px bg-slate-100 mx-1" />
                          <button onClick={() => removeCustomField(field.id)} className="text-slate-300 hover:text-red-500 transition-colors"><X size={16} /></button>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={addCustomField} className="flex gap-3 pt-4 border-t border-slate-100">
                      <input name="label" placeholder="New field label..." className="flex-1 bg-white border border-slate-200 rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-blue-50 focus:border-blue-500 transition-all" required />
                      <button type="submit" className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-600 transition-all flex items-center gap-2">
                        <Plus size={14} /> ADD
                      </button>
                    </form>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="p-8 space-y-12">
              {formError && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-red-50 text-red-600 p-4 rounded-2xl border border-red-100 text-xs font-bold text-center flex items-center justify-center gap-2 shadow-inner">
                  <AlertCircle size={16} /> {formError}
                </motion.div>
              )}
              
              {missingFields.length > 0 && cart.length > 0 && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-amber-50 text-amber-700 p-4 rounded-2xl border border-amber-100 text-[10px] font-black uppercase tracking-widest flex items-start gap-3">
                  <AlertCircle size={16} className="shrink-0" />
                  <div>
                    <p className="mb-1">Missing Mandatory Information:</p>
                    <ul className="list-disc list-inside opacity-70">
                      {missingFields.map((f: any) => (
                        <li key={f.id}>{f.label}</li>
                      ))}
                    </ul>
                  </div>
                </motion.div>
              )}
              
              {/* Identity Section */}
              <motion.div 
                onViewportEnter={() => setActiveStep(1)}
                viewport={{ margin: "-100px" }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                   <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 min-w-max">01 / BASICS</div>
                   <div className="h-px bg-slate-100 w-full" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Serial Number</label>
                    <div className="relative group/field">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within/field:text-blue-500">
                        <Hash size={18} />
                      </div>
                      <input 
                        disabled={!can('add')}
                        value={srNo} 
                        onChange={(e) => setSrNo(Number(e.target.value))} 
                        type="number" 
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] outline-none text-base font-bold focus:bg-white focus:border-blue-500 focus:ring-8 focus:ring-blue-50 transition-all disabled:opacity-50" 
                        placeholder="000"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Invoice Date</label>
                    <div className="relative group/field">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within/field:text-blue-500">
                        <Calendar size={18} />
                      </div>
                      <input 
                        disabled={!can('add')}
                        value={transactionDate} 
                        onChange={(e) => setTransactionDate(e.target.value)} 
                        type="date" 
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] outline-none text-base font-bold focus:bg-white focus:border-blue-500 focus:ring-8 focus:ring-blue-50 transition-all disabled:opacity-50" 
                      />
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <button 
                    onClick={() => setActiveStep(2)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    Next Step <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>

              {/* Student Identification */}
              <motion.div 
                onViewportEnter={() => setActiveStep(2)}
                viewport={{ margin: "-100px" }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                   <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 min-w-max">02 / STUDENT</div>
                   <div className="h-px bg-slate-100 w-full" />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Student Particulars</label>
                    <div className="relative group/field">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within/field:text-blue-500">
                        <UserIcon size={20} />
                      </div>
                      <input 
                        disabled={!can('add')}
                        value={studentName} 
                        onChange={(e) => setStudentName(e.target.value)} 
                        type="text" 
                        className="w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] outline-none text-base font-bold focus:bg-white focus:border-blue-500 focus:ring-8 focus:ring-blue-50 transition-all disabled:opacity-50" 
                        placeholder="John Doe..." 
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <SearchableSelect 
                      label="Academic Grade"
                      options={CLASSES}
                      value={studentClass}
                      disabled={!can('add')}
                      onChange={(val) => setStudentClass(val)}
                      placeholder="Select grade..."
                    />
                  </div>
                </div>

                {customFields.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                    {customFields.map((field: any) => (
                      <div key={field.id} className="space-y-3">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">
                          {field.label} {field.required && <span className="text-red-500">*</span>}
                        </label>
                        <div className="relative group/field">
                          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within/field:text-blue-500">
                             {field.type === 'text' && <Type size={18} />}
                             {field.type === 'number' && <Hash size={18} />}
                             {field.type === 'date' && <Calendar size={18} />}
                          </div>
                          <input 
                            disabled={!can('add')}
                            type={field.type} 
                            value={customValues[field.id] || ''} 
                            onChange={(e) => setCustomValues((p: any) => ({ ...p, [field.id]: e.target.value }))} 
                            className={`w-full pl-14 pr-6 py-4 bg-slate-50 border-2 border-transparent rounded-[20px] outline-none text-base font-bold focus:bg-white focus:border-blue-500 focus:ring-8 focus:ring-blue-50 transition-all disabled:opacity-50 ${field.required && !customValues[field.id] ? 'border-dashed border-red-100' : ''}`} 
                            placeholder={`Enter ${field.label}...`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="pt-4 flex justify-between">
                  <button 
                    onClick={() => setActiveStep(1)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button 
                    onClick={() => setActiveStep(3)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    Next Step <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>

              {/* Inventory Selection */}
              <motion.div 
                onViewportEnter={() => setActiveStep(3)}
                viewport={{ margin: "-100px" }}
                className="space-y-8"
              >
                <div className="flex items-center gap-4">
                   <div className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-300 min-w-max">03 / INVENTORY</div>
                   <div className="h-px bg-slate-100 w-full" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <SearchableSelect 
                    label="Item Category"
                    options={Object.keys(pricing)}
                    value={newItem.item}
                    disabled={!can('add')}
                    onChange={(val) => setNewItem((p: any) => ({ ...p, item: val, size: Object.keys(pricing[val] || {})[0] }))}
                    placeholder="Choose item..."
                  />
                  <SearchableSelect 
                    label="Variants / Size"
                    options={Object.keys(pricing[newItem.item] || {})}
                    value={newItem.size}
                    disabled={!can('add')}
                    onChange={(val) => setNewItem((p: any) => ({ ...p, size: val }))}
                    placeholder="Choose size..."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Quantity</label>
                    <div className="relative group/field">
                      <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs group-focus-within/field:text-blue-500 transition-colors uppercase">PCS</div>
                      <input 
                        disabled={!can('add')}
                        value={newItem.qty} 
                        onChange={(e) => setNewItem((p: any) => ({ ...p, qty: Number(e.target.value) }))} 
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddToCart(e);
                          }
                        }}
                        type="number" 
                        min="1" 
                        className={`w-full pl-14 pr-6 py-4 bg-slate-50 border-2 rounded-[20px] outline-none text-base font-mono font-black focus:bg-white focus:ring-8 transition-all disabled:opacity-50 text-right ${
                          newItem.qty > (pricing[newItem.item]?.[newItem.size]?.stock || 0) 
                            ? 'border-red-500 focus:ring-red-50 text-red-600' 
                            : 'border-transparent focus:border-blue-500 focus:ring-blue-50'
                        }`} 
                        placeholder="1"
                      />
                    </div>
                    {newItem.qty > (pricing[newItem.item]?.[newItem.size]?.stock || 0) && (
                      <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 animate-pulse">Insufficient Stock!</p>
                    )}
                  </div>
                  
                  <div className="relative px-6 py-5 bg-white border-2 border-slate-100 rounded-[20px] flex items-center justify-between shadow-sm overflow-hidden transition-all hover:border-blue-200">
                    <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-blue-600" />
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Unit Rate</span>
                      <span className="text-2xl font-black font-mono text-slate-900 tracking-tighter">₹ {currentRate}</span>
                    </div>
                    <div className="text-right">
                       <span className="block text-[9px] font-black uppercase text-slate-400 mb-1">Availability</span>
                       <div className="flex items-center gap-2 justify-end">
                         <span className={`text-[11px] font-black uppercase ${pricing[newItem.item]?.[newItem.size]?.stock <= pricing[newItem.item]?.[newItem.size]?.minStock ? 'text-red-500' : 'text-emerald-600'}`}>
                           {pricing[newItem.item]?.[newItem.size]?.stock || 0} In Stock
                         </span>
                       </div>
                    </div>
                  </div>
                </div>

                {can('add') && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 relative">
                    <button 
                      onClick={handleAddToCart} 
                      className="py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-200 hover:bg-slate-800 hover:-translate-y-1 transition-all active:translate-y-0 flex items-center justify-center gap-3 overflow-hidden relative group"
                    >
                      <PlusCircle size={18} className="relative z-10" />
                      <span className="relative z-10">Add to List</span>
                    </button>

                    <button 
                      onClick={handleAddToCartAndGoToRemarks} 
                      className="py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-blue-500/20 hover:bg-blue-700 hover:-translate-y-1 transition-all active:translate-y-0 flex items-center justify-center gap-3 overflow-hidden relative group"
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                      <CheckCircle2 size={18} className="relative z-10" />
                      <span className="relative z-10">Add & Next</span>
                    </button>
                    
                    <AnimatePresence>
                      {showAddedMsg && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10, scale: 0.9 }}
                          animate={{ opacity: 1, y: -40, scale: 1 }}
                          exit={{ opacity: 0, y: -60, scale: 0.9 }}
                          className="absolute left-1/4 -translate-x-1/2 whitespace-nowrap bg-emerald-600 text-white px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 pointer-events-none z-50"
                        >
                          <CheckCircle2 size={12} /> Item Added
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
                <div className="pt-4 flex justify-between">
                  <button 
                    onClick={() => setActiveStep(2)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button 
                    onClick={() => setActiveStep(4)}
                    className="px-6 py-3 bg-blue-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2"
                  >
                    Next Step <ArrowRight size={14} />
                  </button>
                </div>
              </motion.div>

              {/* Remarks Section */}
              <motion.div 
                onViewportEnter={() => setActiveStep(4)}
                className="space-y-4"
              >
                <div className="flex justify-between items-center mb-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Additional Observations</label>
                  <button 
                    onClick={summarizeNotes}
                    disabled={isSummarizing || !generalNotes.trim()}
                    className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[9px] font-black uppercase tracking-widest hover:bg-blue-100 transition-all border border-blue-100 disabled:opacity-30 disabled:cursor-not-allowed group active:scale-95"
                  >
                    {isSummarizing ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} className="group-hover:scale-110 transition-transform" />}
                    {isSummarizing ? "Summarizing..." : "AI Summary"}
                  </button>
                </div>
                <textarea 
                  disabled={!can('add')}
                  value={generalNotes} 
                  onChange={(e) => setGeneralNotes(e.target.value)}
                  className="w-full px-8 py-6 bg-slate-50 border-2 border-transparent rounded-[32px] outline-none text-sm font-medium resize-none min-h-[120px] focus:bg-white focus:border-blue-500 focus:ring-8 focus:ring-blue-50 transition-all disabled:opacity-50"
                  placeholder="Type any special instructions or transaction notes here..."
                />
                <div className="pt-4 flex justify-start">
                  <button 
                    onClick={() => setActiveStep(3)}
                    className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2"
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                </div>
              </motion.div>
            </div>
          </section>
        </div>

        {/* Right Sidebar: Cart & Analytics */}
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-slate-900 rounded-[32px] shadow-2xl overflow-hidden text-white sticky top-24 border border-slate-800">
            <div className="p-8 border-b border-white/5 bg-gradient-to-br from-slate-800/50 to-transparent">
               <div className="flex items-center justify-between mb-8">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400">Order Manifest</h3>
                  <div className="px-3 py-1 bg-blue-500/10 text-blue-400 rounded-full text-[9px] font-black uppercase tracking-widest">
                    {cart.length} Items
                  </div>
               </div>
               
               <div className="space-y-4 max-h-[350px] overflow-y-auto custom-scroll pr-3">
                 <AnimatePresence mode="popLayout">
                   {cart.length === 0 ? (
                     <div className="py-10 text-center opacity-20">
                        <Package className="mx-auto mb-3" size={32} />
                        <p className="text-[10px] font-black uppercase tracking-widest leading-relaxed">Your order list is currently<br/>empty</p>
                     </div>
                   ) : (
                     cart.map((item: any) => (
                        <motion.div 
                          key={item.id} 
                          layout
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5 group hover:bg-white/10 transition-colors"
                        >
                           <div className="flex-1 min-w-0">
                              <div className="text-xs font-black uppercase tracking-tight truncate text-white">{item.item}</div>
                              <div className="text-[9px] font-bold text-slate-500 mt-0.5 uppercase tracking-wide">
                                {item.size} &bull; {item.qty} PCS x ₹{item.rate}
                              </div>
                           </div>
                           <div className="text-right">
                              <div className="text-sm font-black font-mono text-white mb-1">₹{item.qty * item.rate}</div>
                              {can('add') && (
                                <button onClick={() => removeFromCart(item.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                                  <X size={12} />
                                </button>
                              )}
                           </div>
                        </motion.div>
                     ))
                   )}
                 </AnimatePresence>
               </div>
            </div>
            
            <div className="p-8 bg-black/40 backdrop-blur-2xl">
               <div className="space-y-5">
                 <div className="flex justify-between items-center text-slate-500">
                    <span className="text-[10px] font-black uppercase tracking-widest">Gross Total</span>
                    <span className="text-sm font-black font-mono">₹ {cartTotal}</span>
                 </div>
                 
                 <div className="flex justify-between items-center group">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-amber-500 transition-colors">Adjustments (%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="text-xs text-slate-700">-</span>
                       <input 
                        disabled={!can('add')}
                        type="number" 
                        value={discountAmount} 
                        onChange={(e) => setDiscountAmount(e.target.value)} 
                        placeholder="0"
                        className="w-12 bg-white/5 border-b border-white/10 focus:border-amber-500 text-right px-2 py-1 text-xs text-amber-500 font-black outline-none transition-all rounded"
                      />
                      <span className="text-[10px] font-black text-slate-700">%</span>
                    </div>
                 </div>

                 <div className="pt-6 border-t border-white/10 flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-[0.3em] text-blue-500">Total Payable</span>
                    <div className="flex items-baseline justify-between">
                      <span className="text-slate-500 font-black text-[10px] uppercase">Amount INR</span>
                      <span className="text-3xl font-black font-mono text-white tracking-tighter">₹ {finalPayable}</span>
                    </div>
                 </div>

                 <div className="pt-8 space-y-4">
                    <div className="space-y-2">
                      <label className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Payment Method</label>
                      <div className="relative">
                        <select 
                          disabled={!can('add')}
                          value={paymentMode} 
                          onChange={(e) => setPaymentMode(e.target.value)} 
                          className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-[11px] font-black uppercase tracking-widest text-white outline-none focus:ring-4 focus:ring-blue-500/20 appearance-none transition-all shadow-inner"
                        >
                          <option value="Pending">🕒 Pending</option>
                          <option value="UPI">💳 UPI Link</option>
                          <option value="Cash">💵 Hard Cash</option>
                        </select>
                        <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <ChevronDown size={14} />
                        </div>
                      </div>
                    </div>
                    
                    <AnimatePresence>
                      {paymentMode !== 'Pending' && (
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4 pt-2">
                           <div className="relative">
                             <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-[10px]">₹</div>
                             <input 
                              disabled={!can('add')}
                              type="number" 
                              value={paidAmount} 
                              onChange={(e) => setPaidAmount(e.target.value)} 
                              placeholder="Deposit Amount" 
                              className="w-full bg-slate-800 border border-slate-700 rounded-2xl pl-8 pr-5 py-4 text-xs font-black text-white outline-none focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-600" 
                            />
                           </div>
                           <input 
                            disabled={!can('add')}
                            type="date" 
                            value={paymentDate} 
                            onChange={(e) => setPaymentDate(e.target.value)} 
                            className="w-full bg-slate-800 border border-slate-700 rounded-2xl px-5 py-4 text-[10px] font-black uppercase text-white outline-none font-mono tracking-widest" 
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>
                 </div>

                 {can('add') && (
                   <button 
                    onClick={onSubmitClick}
                    disabled={cart.length === 0 || !studentName.trim() || !isCustomFieldsValid}
                    className="w-full relative group mt-6"
                   >
                     <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl blur opacity-30 group-hover:opacity-70 transition duration-1000 group-hover:duration-200"></div>
                     <div className="relative w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl transition-all hover:bg-blue-500 hover:-translate-y-1 active:translate-y-0 uppercase tracking-[0.2em] text-[11px] disabled:opacity-30 disabled:grayscale disabled:cursor-not-allowed flex items-center justify-center gap-2 overflow-hidden">
                       Confirm Recording <ArrowRight size={16} />
                     </div>
                   </button>
                 )}
               </div>
            </div>
          </section>

          {/* Activity Log Context */}
          <section className="bg-white rounded-[32px] border border-slate-200 shadow-xl shadow-slate-100 overflow-hidden">
             <div className="px-6 py-5 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2"><History size={14} className="text-blue-500" /> Recent Flows</span>
             </div>
             <div className="p-4 space-y-3">
                {recentRecords.length === 0 ? (
                  <div className="py-12 text-center opacity-30 italic">
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No session history</p>
                  </div>
                ) : (
                  recentRecords.map((r: any) => (
                    <div key={r.id} className="p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-lg hover:shadow-blue-500/5 transition-all group">
                       <div className="flex justify-between items-start mb-2">
                          <span className="text-xs font-black text-slate-800 uppercase line-clamp-1 flex-1 pr-2">{r.name}</span>
                          <span className="text-xs font-black font-mono text-blue-600">₹{r.totalAmount}</span>
                       </div>
                       <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                             <div className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                             <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">{r.studentClass}</span>
                          </div>
                          <div className={`text-[8px] font-black uppercase px-2 py-1 rounded-lg ${
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

function ItemMultiSelect({ options, selected, onChange }: { options: string[], selected: string[], onChange: (vals: string[]) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => opt.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative w-full" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-bold cursor-pointer flex items-center justify-between shadow-sm min-h-[36px]"
      >
        <div className="flex flex-wrap gap-1 items-center overflow-hidden">
          {selected.length === 0 ? (
            <span className="text-slate-400">All Items</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {selected.slice(0, 2).map(s => (
                <span key={s} className="bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-lg text-[8px] font-black border border-blue-100 flex items-center gap-1">
                  {s}
                  <X size={10} className="hover:text-blue-800" onClick={(e) => { e.stopPropagation(); onChange(selected.filter(i => i !== s)); }} />
                </span>
              ))}
              {selected.length > 2 && (
                <span className="text-slate-400 text-[8px] font-black">+{selected.length - 2}</span>
              )}
            </div>
          )}
        </div>
        <ChevronDown size={12} className={`text-slate-300 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </div>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[100] overflow-hidden"
          >
            <div className="p-3 border-b border-slate-100 bg-slate-50">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text"
                  autoFocus
                  placeholder="Search items..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-[10px] bg-white border border-slate-200 rounded-xl outline-none focus:border-blue-500 font-bold"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto custom-scroll p-2 space-y-1">
              <div className="flex gap-1 p-1 mb-2">
                <button 
                  onClick={(e) => { e.stopPropagation(); onChange([]); }}
                  className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-[8px] font-black uppercase rounded-lg text-slate-500"
                >
                  Clear All
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); onChange(options); }}
                  className="flex-1 py-1.5 bg-blue-50 hover:bg-blue-100 text-[8px] font-black uppercase rounded-lg text-blue-600"
                >
                  Select All
                </button>
              </div>
              {filteredOptions.map(opt => (
                <label key={opt} className="flex items-center px-3 py-2 hover:bg-slate-50 rounded-xl cursor-pointer gap-3 transition-colors group">
                  <input 
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => {
                      if (selected.includes(opt)) onChange(selected.filter(s => s !== opt));
                      else onChange([...selected, opt]);
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                  />
                  <span className="text-[10px] font-bold text-slate-600 group-hover:text-blue-600 truncate">{opt}</span>
                </label>
              ))}
              {filteredOptions.length === 0 && (
                <div className="p-4 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest italic">No items found</div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SortHeader({ label, sortKey, currentSort, onSort, className = "", ...props }: any) {
  const isActive = currentSort.key === sortKey;
  return (
    <th 
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer hover:bg-slate-100 transition-colors group ${className}`}
      {...props}
    >
      <div className="flex items-center gap-1.5 justify-center">
        <span>{label}</span>
        <div className="flex flex-col -space-y-1">
          <ChevronUp size={8} className={isActive && currentSort.direction === 'asc' ? 'text-blue-600' : 'text-slate-300'} />
          <ChevronDown size={8} className={isActive && currentSort.direction === 'desc' ? 'text-blue-600' : 'text-slate-300'} />
        </div>
      </div>
    </th>
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
  itemFilter,
  setItemFilter,
  classFilter,
  setClassFilter,
  exportLedger, 
  importLedger,
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
  can,
  importFromSpreadsheet,
  isAnalyzing,
  onSort,
  sortConfig,
  downloadTemplate
}: any) {
  const [editingCell, setEditingCell] = useState<{ id: string, field: string } | null>(null);
  const [quickAdd, setQuickAdd] = useState({ name: '', studentClass: CLASSES[0], notes: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
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
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto mt-4 lg:mt-0">
            <div className="relative group/export flex-1 sm:flex-none">
              <button className="w-full bg-emerald-50 text-emerald-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100 transition-all font-mono flex items-center justify-center gap-2 border border-emerald-100">
                <FileDown size={14} /> <span className="hidden sm:inline">EXPORT</span><span className="sm:hidden">EX</span>
              </button>
              <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl opacity-0 invisible group-hover/export:opacity-100 group-hover/export:visible transition-all z-50">
                <button onClick={() => exportLedger('xlsx')} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2 border-b border-slate-50">
                  <FileSpreadsheet size={16} className="text-emerald-500" /> Excel (.xlsx)
                </button>
                <button onClick={() => exportLedger('csv')} className="w-full text-left px-4 py-4 text-[10px] font-black uppercase hover:bg-slate-50 transition-colors flex items-center gap-2">
                  <FileSpreadsheet size={16} className="text-blue-500" /> CSV (.csv)
                </button>
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept=".xlsx,.xls,.csv" 
              onChange={importLedger} 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="flex-1 sm:flex-none bg-indigo-50 text-indigo-700 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100 transition-all font-mono flex items-center justify-center gap-2 border border-indigo-100"
            >
              <Upload size={14} /> <span className="hidden sm:inline">IMPORT</span><span className="sm:hidden">IM</span>
            </button>

            <button 
              onClick={downloadTemplate}
              className="flex-1 sm:flex-none bg-slate-800 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-slate-700 transition-all font-mono flex items-center justify-center gap-2 shadow-lg"
            >
              <FileSpreadsheet size={14} className="text-emerald-400" /> <span className="hidden sm:inline">TEMPLATE</span><span className="sm:hidden">TMP</span>
            </button>

            <input 
              type="file" 
              ref={aiFileInputRef} 
              className="hidden" 
              accept=".xlsx,.xls,.csv" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) importFromSpreadsheet(file);
                e.target.value = '';
              }} 
            />
            <button 
              onClick={() => aiFileInputRef.current?.click()}
              disabled={isAnalyzing}
              className="flex-1 sm:flex-none bg-blue-600 text-white px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-700 transition-all font-mono flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed group relative"
            >
              {isAnalyzing ? <Loader2 size={14} className="animate-spin" /> : <CloudLightning size={14} className="text-blue-200 group-hover:text-white transition-colors" />}
              <span className="hidden sm:inline">AI IMPORT</span><span className="sm:hidden">AI</span>
              {isAnalyzing && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-slate-800 text-white text-[8px] rounded whitespace-nowrap">
                  Gemini is analyzing...
                </span>
              )}
            </button>

            <button onClick={handlePrint} disabled={allRecords.length === 0} className="flex-1 sm:flex-none bg-blue-50 text-blue-600 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase hover:bg-blue-100 transition-all font-mono flex items-center justify-center gap-2 border border-blue-100">
              <Printer size={14} /> <span className="hidden sm:inline">PRINT</span><span className="sm:hidden">PDF</span>
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="mt-6 flex flex-col gap-4 p-4 bg-slate-50/50 rounded-2xl border border-slate-100">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
            <div className="relative group lg:col-span-3">
              <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block px-1">Search Records</label>
              <Search className="absolute left-3 top-7 text-slate-400" size={14} />
              <input 
                type="text" 
                placeholder="Student Name..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-bold focus:border-blue-500 transition-all shadow-sm"
              />
            </div>

            <div className="space-y-1 lg:col-span-3">
              <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block px-1">Date Range</label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                  <input 
                    type="date"
                    value={dateStart}
                    onChange={(e) => setDateStart(e.target.value)}
                    className="w-full h-9 pl-8 pr-2 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-bold focus:border-blue-500 transition-all shadow-sm text-center sm:text-left"
                  />
                </div>
                <div className="relative flex-1">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={12} />
                  <input 
                    type="date"
                    value={dateEnd}
                    onChange={(e) => setDateEnd(e.target.value)}
                    className="w-full h-9 pl-8 pr-2 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-bold focus:border-blue-500 transition-all shadow-sm text-center sm:text-left"
                  />
                </div>
              </div>
            </div>

            <div className="relative lg:col-span-2">
              <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block px-1">Payment</label>
              <CreditCard className="absolute left-3 top-7 text-slate-400 pointer-events-none" size={14} />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-bold appearance-none focus:border-blue-500 transition-all shadow-sm"
              >
                <option value="All">All Modes</option>
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Pending">Pending</option>
              </select>
              <ChevronDown className="absolute right-3 top-7 text-slate-300 pointer-events-none" size={12} />
            </div>

            <div className="relative lg:col-span-2">
              <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block px-1">Items Sold</label>
              <Package className="absolute left-3 top-7 text-slate-400 pointer-events-none z-10" size={14} />
              <ItemMultiSelect 
                options={itemNames} 
                selected={itemFilter} 
                onChange={setItemFilter} 
              />
            </div>

            <div className="relative lg:col-span-2">
              <label className="text-[9px] font-black uppercase text-slate-400 mb-1 block px-1">Classes</label>
              <UserCircle className="absolute left-3 top-7 text-slate-400 pointer-events-none" size={14} />
              <select 
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full h-9 pl-9 pr-4 bg-white border border-slate-200 rounded-xl outline-none text-[10px] font-bold appearance-none focus:border-blue-500 transition-all shadow-sm"
              >
                <option value="All">All Classes</option>
                {CLASSES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-7 text-slate-300 pointer-events-none" size={12} />
            </div>
          </div>

          <div className="flex flex-wrap gap-2 items-center border-t border-slate-100 pt-3">
             <div className="flex flex-wrap gap-2 flex-1">
                <span className="text-[8px] font-black uppercase text-slate-400 tracking-tighter self-center mr-2">Quick Dates:</span>
                {[
                  { label: 'Today', getValue: () => {
                    const today = new Date().toISOString().split('T')[0];
                    return { start: today, end: today };
                  }},
                  { label: 'Yesterday', getValue: () => {
                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    return { start: yesterday, end: yesterday };
                  }},
                  { label: 'This Week', getValue: () => {
                    const curr = new Date();
                    const first = curr.getDate() - curr.getDay() + (curr.getDay() === 0 ? -6 : 1); // Monday
                    const firstday = new Date(curr.setDate(first)).toISOString().split('T')[0];
                    const lastday = new Date(curr.setDate(first + 6)).toISOString().split('T')[0];
                    return { start: firstday, end: lastday };
                  }},
                  { label: 'This Month', getValue: () => {
                    const date = new Date();
                    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
                    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];
                    return { start: firstDay, end: lastDay };
                  }}
                ].map(range => (
                  <button 
                    key={range.label}
                    onClick={() => {
                      const { start, end } = range.getValue();
                      setDateStart(start);
                      setDateEnd(end);
                    }}
                    className={`px-3 py-1 rounded-full text-[9px] font-bold uppercase transition-all border ${
                      dateStart === range.getValue().start && dateEnd === range.getValue().end
                      ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-200' 
                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
             </div>
             
             <button 
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setDateStart('');
                  setDateEnd('');
                  setItemFilter([]);
                  setClassFilter('All');
                }}
                className="h-7 px-3 bg-slate-200/50 text-slate-600 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
              >
                <X size={12} /> Reset
              </button>
          </div>

          {/* Active Filter Chips */}
          <AnimatePresence>
            {(searchQuery || statusFilter !== 'All' || dateStart || dateEnd || itemFilter.length > 0 || classFilter !== 'All') && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 overflow-hidden"
              >
                {searchQuery && (
                  <div className="bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg text-[8px] font-black flex items-center gap-1 border border-blue-100">
                    SEARCH: {searchQuery} <X size={10} className="cursor-pointer" onClick={() => setSearchQuery('')} />
                  </div>
                )}
                {statusFilter !== 'All' && (
                  <div className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-lg text-[8px] font-black flex items-center gap-1 border border-indigo-100">
                    PAYMENT: {statusFilter} <X size={10} className="cursor-pointer" onClick={() => setStatusFilter('All')} />
                  </div>
                )}
                {(dateStart || dateEnd) && (
                  <div className="bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg text-[8px] font-black flex items-center gap-1 border border-emerald-100">
                    DATE: {dateStart || '...'} to {dateEnd || '...'} <X size={10} className="cursor-pointer" onClick={() => { setDateStart(''); setDateEnd(''); }} />
                  </div>
                )}
                {classFilter !== 'All' && (
                  <div className="bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg text-[8px] font-black flex items-center gap-1 border border-amber-100">
                    CLASS: {classFilter} <X size={10} className="cursor-pointer" onClick={() => setClassFilter('All')} />
                  </div>
                )}
                {itemFilter.map(item => (
                  <div key={item} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg text-[8px] font-black flex items-center gap-1 border border-slate-200">
                    ITEM: {item} <X size={10} className="cursor-pointer" onClick={() => setItemFilter(itemFilter.filter(i => i !== item))} />
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
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
              <SortHeader 
                label="Sr." 
                sortKey="srNo" 
                currentSort={sortConfig} 
                onSort={onSort} 
                className="sticky left-0 z-40 bg-slate-50 px-4 py-4 border-b border-r border-slate-100 min-w-[60px] shadow-[2px_0_5px_rgba(0,0,0,0.05)]"
                rowSpan={2}
              />
              <th rowSpan={2} className="px-4 py-4 border-b border-r border-slate-100 min-w-[50px] print:hidden">
                {(can('delete') || can('edit')) && (
                  <input 
                    type="checkbox" 
                    checked={records.length > 0 && records.every((r: any) => selectedRecordIds.includes(r.id))}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                  />
                )}
              </th>
              <SortHeader 
                label="Date" 
                sortKey="date" 
                currentSort={sortConfig} 
                onSort={onSort} 
                className="px-4 py-4 border-b border-r border-slate-100 min-w-[100px]"
                rowSpan={2}
              />
              <SortHeader 
                label="Student & Notes" 
                sortKey="name" 
                currentSort={sortConfig} 
                onSort={onSort} 
                className="px-6 py-4 border-b border-r-[2px] border-slate-200 min-w-[180px]"
                rowSpan={2}
              />
              
              {itemNames.map(name => (
                <th key={name} colSpan={3} className="px-6 py-4 border-b border-r border-slate-200 bg-blue-50/50 text-blue-600 text-center">
                  {name}
                </th>
              ))}

              <SortHeader 
                label="Total Qty" 
                sortKey="items" 
                currentSort={sortConfig} 
                onSort={onSort} 
                className="px-6 py-4 border-b border-r border-slate-100"
                rowSpan={2}
              />
              <SortHeader 
                label="Grand Total" 
                sortKey="totalAmount" 
                currentSort={sortConfig} 
                onSort={onSort} 
                className="px-6 py-4 border-b border-r border-slate-100 text-right min-w-[100px]"
                rowSpan={2}
              />
              <SortHeader 
                label="Disc. %" 
                sortKey="discountPercent" 
                currentSort={sortConfig} 
                onSort={onSort} 
                className="px-6 py-4 border-b border-r border-slate-100 text-center min-w-[70px]"
                rowSpan={2}
              />
              <SortHeader 
                label="Paid Amt." 
                sortKey="paidAmount" 
                currentSort={sortConfig} 
                onSort={onSort} 
                className="px-6 py-4 border-b border-r border-slate-100 text-right min-w-[100px]"
                rowSpan={2}
              />
              <SortHeader 
                label="Pay. Date" 
                sortKey="paymentDate" 
                currentSort={sortConfig} 
                onSort={onSort} 
                className="px-6 py-4 border-b border-r border-slate-100 text-center min-w-[100px]"
                rowSpan={2}
              />
              
              {/* Custom Fields Headers */}
              {customFields?.map((f: any) => (
                <th key={f.id} rowSpan={2} className="px-6 py-4 border-b border-r border-slate-100 text-left min-w-[120px]">
                  {f.label}
                </th>
              ))}

              <SortHeader 
                label="Payment" 
                sortKey="paymentMode" 
                currentSort={sortConfig} 
                onSort={onSort} 
                className="px-6 py-4 border-b border-slate-100 min-w-[100px]"
                rowSpan={2}
              />
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
                <td className="sticky left-0 z-20 bg-blue-50 px-4 py-3 border-r border-slate-100 shadow-[2px_0_5px_rgba(0,0,0,0.02)] font-mono text-[10px] text-blue-500 font-bold italic">NEW</td>
                <td className="px-4 py-3 border-r border-slate-50 bg-blue-50/30"></td>
                <td className="px-4 py-3 border-r border-slate-50 bg-blue-50/30 font-mono text-[10px] text-slate-400 italic">Auto</td>
                <td className="px-6 py-3 border-r-[2px] border-slate-100">
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
                <td colSpan={5} className="px-6 py-3 text-right">
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

            {records.map((rec: any, index: number) => (
              <tr 
                key={rec.id} 
                className={`transition-colors text-xs print:hover:bg-transparent group/row ${
                  selectedRecordIds.includes(rec.id) 
                    ? 'bg-blue-50/50' 
                    : index % 2 === 0 
                      ? 'bg-white hover:bg-slate-50' 
                      : 'bg-slate-50/40 hover:bg-slate-100/60'
                }`}
              >
                <td className="sticky left-0 z-10 bg-inherit px-4 py-4 font-mono font-bold text-slate-400 border-r border-slate-100 print:text-black shadow-[2px_0_5px_rgba(0,0,0,0.02)] transition-colors">#{rec.srNo}</td>
                <td className="bg-inherit px-4 py-4 border-r border-slate-50 print:hidden text-center transition-colors">
                  {(can('delete') || can('edit')) && (
                    <input 
                      type="checkbox" 
                      checked={selectedRecordIds.includes(rec.id)}
                      onChange={() => toggleSelectRecord(rec.id)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4"
                    />
                  )}
                </td>
                <td className="bg-inherit px-4 py-4 text-slate-400 font-mono border-r border-slate-50 print:text-black transition-colors">{rec.date}</td>
                <td className="bg-inherit px-6 py-4 border-r-[2px] border-slate-100 transition-colors">
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
                <td className="px-6 py-4 text-center border-r border-slate-50 font-mono text-[10px] text-slate-400">
                  {rec.discountPercent || 0}%
                </td>
                <td className="px-6 py-4 text-right border-r border-slate-50 font-mono text-[10px] min-w-[100px]">
                  {can('edit') && rec.paymentMode !== 'Pending' && editingCell?.id === rec.id && editingCell?.field === 'paidAmount' ? (
                    <input 
                      autoFocus
                      type="number"
                      className="w-full px-2 py-1 text-xs border border-blue-500 rounded outline-none text-right"
                      defaultValue={rec.paidAmount || 0}
                      onBlur={(e) => {
                        updateRecord(rec.id, { paidAmount: Number(e.target.value) });
                        setEditingCell(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') e.currentTarget.blur();
                        if (e.key === 'Escape') setEditingCell(null);
                      }}
                    />
                  ) : (
                    <div 
                      className={`font-bold transition-colors ${can('edit') && rec.paymentMode !== 'Pending' ? 'cursor-pointer hover:text-blue-600' : 'text-slate-400'}`}
                      onClick={() => can('edit') && rec.paymentMode !== 'Pending' && setEditingCell({ id: rec.id, field: 'paidAmount' })}
                    >
                      ₹ {rec.paidAmount || 0}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-center border-r border-slate-50 font-mono text-[10px] min-w-[100px]">
                  {can('edit') && rec.paymentMode !== 'Pending' && editingCell?.id === rec.id && editingCell?.field === 'paymentDate' ? (
                    <input 
                      autoFocus
                      type="date"
                      className="w-full px-2 py-1 text-[9px] border border-blue-500 rounded outline-none"
                      defaultValue={rec.paymentDate || ''}
                      onBlur={(e) => {
                        updateRecord(rec.id, { paymentDate: e.target.value });
                        setEditingCell(null);
                      }}
                      onChange={(e) => {
                        updateRecord(rec.id, { paymentDate: e.target.value });
                        setEditingCell(null);
                      }}
                    />
                  ) : (
                    <div 
                      className={`font-bold transition-colors ${can('edit') && rec.paymentMode !== 'Pending' ? 'cursor-pointer hover:text-blue-600' : 'text-slate-400'}`}
                      onClick={() => can('edit') && rec.paymentMode !== 'Pending' && setEditingCell({ id: rec.id, field: 'paymentDate' })}
                    >
                      {rec.paymentDate ? new Date(rec.paymentDate).toLocaleDateString('en-GB') : '-'}
                    </div>
                  )}
                </td>
                
                {/* Custom Field Values */}
                {customFields?.map((f: any) => (
                  <td key={f.id} className="px-6 py-4 border-r border-slate-50 text-[10px] min-w-[120px]">
                    {can('edit') && editingCell?.id === rec.id && editingCell?.field === f.id ? (
                      <input 
                        autoFocus
                        type={f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text'}
                        className="w-full px-2 py-1 text-[10px] border border-blue-500 rounded outline-none"
                        defaultValue={rec.customData?.[f.id] || ''}
                        onBlur={(e) => {
                          const val = f.type === 'number' ? Number(e.target.value) : e.target.value;
                          updateRecord(rec.id, { customData: { ...(rec.customData || {}), [f.id]: val } });
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') setEditingCell(null);
                        }}
                      />
                    ) : (
                      <div 
                        className={`font-medium transition-colors ${can('edit') ? 'cursor-pointer hover:text-blue-600' : 'text-slate-500'}`}
                        onClick={() => can('edit') && setEditingCell({ id: rec.id, field: f.id })}
                      >
                        {rec.customData?.[f.id] ? (
                          f.type === 'date' ? new Date(rec.customData[f.id]).toLocaleDateString('en-GB') : String(rec.customData[f.id])
                        ) : '-'}
                      </div>
                    )}
                  </td>
                ))}

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

function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel, type = 'danger', isLoading = false }: any) {
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
            {isLoading ? <Loader2 size={32} className="animate-spin" /> : (type === 'danger' ? <Trash2 size={32} /> : <Info size={32} />)}
          </div>
          <div className="text-center space-y-2">
            <h3 className="text-xl font-bold text-slate-800">{title}</h3>
            <p className="text-sm text-slate-500 font-medium leading-relaxed">{message}</p>
          </div>
          <div className="flex gap-3">
            <button disabled={isLoading} onClick={onCancel} className="flex-1 px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all disabled:opacity-50">Cancel</button>
            <button disabled={isLoading} onClick={async () => { await onConfirm(); onCancel(); }} className={`flex-1 px-6 py-3 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 ${type === 'danger' ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'}`}>
              {isLoading && <Loader2 size={12} className="animate-spin" />}
              {isLoading ? 'Processing...' : 'Confirm'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function ImportResultModal({ result, onClose }: { result: any; onClose: () => void }) {
  if (!result) return null;
  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full overflow-hidden font-sans flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center">
                <AlertCircle size={24} />
             </div>
             <div>
                <h3 className="text-xl font-bold text-slate-800">Import Summary</h3>
                <p className="text-sm text-slate-500 font-medium">Successfully imported {result.successCount} rows, {result.errors.length} failed.</p>
             </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-all">
            <X size={20} className="text-slate-400" />
          </button>
        </div>
        <div className="overflow-y-auto p-4 flex-1">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="border-b border-slate-50">
                    <th className="p-3 text-[10px] font-black uppercase text-slate-400">Row</th>
                    <th className="p-3 text-[10px] font-black uppercase text-slate-400">Item</th>
                    <th className="p-3 text-[10px] font-black uppercase text-slate-400">Size</th>
                    <th className="p-3 text-[10px] font-black uppercase text-slate-400 text-red-500">Reason</th>
                 </tr>
              </thead>
              <tbody>
                 {result.errors.map((err: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                       <td className="p-3 text-xs font-bold text-slate-500">#{err.row}</td>
                       <td className="p-3 text-xs font-bold text-slate-800">{err.item}</td>
                       <td className="p-3 text-xs font-bold text-slate-800">{err.size}</td>
                       <td className="p-3 text-xs font-bold text-red-500">{err.reason}</td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
        <div className="p-6 bg-slate-50 flex justify-end">
           <button onClick={onClose} className="px-8 py-3 bg-white text-slate-900 border border-slate-200 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:border-slate-300 transition-all shadow-sm">Close</button>
        </div>
      </motion.div>
    </div>
  );
}
