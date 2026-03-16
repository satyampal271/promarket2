import React, { useState, useEffect, Component, useRef, useMemo } from 'react';
import { 
  Search, Menu, Home, Gamepad2, LayoutGrid, 
  Tag, User, LogIn, LogOut, Star, Download, Plus, X, CheckCircle2, AlertTriangle, Info, ExternalLink, Image as ImageIcon, Wallet, Gift, Lock, History, Settings, Edit2, Trash2, ShieldCheck, PackageSearch, MessageSquare, Send,
  Volume2, VolumeX
} from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { collection, addDoc, onSnapshot, query, orderBy, Timestamp, doc, setDoc, updateDoc, deleteDoc, increment, where, getDocs, serverTimestamp } from 'firebase/firestore';
import { auth, googleProvider, db } from './lib/firebase';

// Types
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
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
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
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      let errorDetails: FirestoreErrorInfo | null = null;
      try {
        errorDetails = JSON.parse(this.state.error?.message || '');
      } catch (e) {
        // Not a Firestore error
      }

      return (
        <div className="min-h-screen bg-[#0f1115] flex items-center justify-center p-4">
          <div className="bg-[#16181d] border border-white/10 rounded-3xl p-8 max-w-md w-full text-center">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Something went wrong</h2>
            <p className="text-gray-400 mb-6">
              {errorDetails ? `Permission denied for ${errorDetails.operationType} on ${errorDetails.path}` : this.state.error?.message}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2 rounded-xl font-bold transition-all"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Product {
  id: string;
  title: string;
  developer: string;
  description: string;
  price: string;
  rating: number;
  icon: string;
  category: string;
  createdAt: any;
  screenshots?: string[];
  downloadUrl?: string;
  sellerId?: string;
  sellerName?: string;
}

function getYoutubeId(url: string) {
  if (!url) return null;
  try {
    if (url.includes('youtu.be/')) {
      return url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('youtube.com/watch')) {
      const urlParams = new URLSearchParams(new URL(url).search);
      return urlParams.get('v') || '';
    } else if (url.includes('youtube.com/live/')) {
      return url.split('youtube.com/live/')[1].split('?')[0];
    } else if (url.includes('youtube.com/embed/')) {
      return url.split('youtube.com/embed/')[1].split('?')[0];
    }
  } catch (e) {
    return null;
  }
  return null;
}

function getVideoInfo(url: string, muted: boolean = true) {
  if (!url) return null;
  
  // Check for raw video files
  if (url.match(/\.(mp4|webm|ogg)$/i)) {
    return { type: 'raw', url };
  }

  const videoId = getYoutubeId(url);
  if (videoId) {
    // Add parameters to hide controls, branding, and prevent interaction
    return { 
      type: 'youtube', 
      url: `https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muted ? 1 : 0}&loop=1&playlist=${videoId}&controls=0&modestbranding=1&rel=0&disablekb=1&playsinline=1&iv_load_policy=3&enablejsapi=1` 
    };
  }

  // Fallback to generic iframe
  return { type: 'iframe', url };
}

const MOCK_FALLBACK: Product[] = [
  { id: 'm1', title: 'Nova Launcher', developer: 'TeslaCoil', rating: 4.8, price: '$4.99', icon: 'https://picsum.photos/seed/nova/150/150', category: 'Apps', description: 'Custom home screen', createdAt: null },
  { id: 'm2', title: 'Minecraft', developer: 'Mojang', rating: 4.6, price: '$6.99', icon: 'https://picsum.photos/seed/mc/150/150', category: 'Games', description: 'Build anything', createdAt: null },
  { id: 'm3', title: 'Tasker', developer: 'joaomgcd', rating: 4.7, price: '$3.49', icon: 'https://picsum.photos/seed/tasker/150/150', category: 'Apps', description: 'Automation', createdAt: null },
  { id: 'm4', title: 'Terraria', developer: '505 Games', rating: 4.7, price: '$4.99', icon: 'https://picsum.photos/seed/terraria/150/150', category: 'Games', description: 'Adventure', createdAt: null },
];

const MoneyRain = () => {
  return (
    <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
      {[...Array(50)].map((_, i) => (
        <div 
          key={i} 
          className="absolute text-3xl animate-money-fall"
          style={{
            left: `${Math.random() * 100}vw`,
            animationDuration: `${Math.random() * 3 + 2}s`,
            animationDelay: `${Math.random() * 2}s`,
            opacity: Math.random() * 0.5 + 0.5
          }}
        >
          {Math.random() > 0.5 ? '💸' : '₹'}
        </div>
      ))}
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeTab, setActiveTab] = useState('Home');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeemStatus, setRedeemStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [isRedeeming, setIsRedeeming] = useState(false);
  
  // Add Money State
  const [walletTab, setWalletTab] = useState<'add' | 'redeem' | 'history'>('add');
  const [addAmount, setAddAmount] = useState<number | ''>(100);
  const [utrNumber, setUtrNumber] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [paymentTimer, setPaymentTimer] = useState<number>(300); // 5 minutes in seconds
  const [isTimerActive, setIsTimerActive] = useState(false);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerActive && paymentTimer > 0) {
      interval = setInterval(() => {
        setPaymentTimer((prev) => prev - 1);
      }, 1000);
    } else if (paymentTimer === 0) {
      setIsTimerActive(false);
      setPaymentStatus({ type: 'error', msg: 'Payment session expired. Please try again.' });
    }
    return () => clearInterval(interval);
  }, [isTimerActive, paymentTimer]);

  const startPaymentTimer = () => {
    setPaymentTimer(300);
    setIsTimerActive(true);
    setPaymentStatus(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Confirmation Dialog State
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  } | null>(null);

  // Profile State
  const [showProfileForm, setShowProfileForm] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profilePhone, setProfilePhone] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [purchaseHistory, setPurchaseHistory] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [isLoadingPaymentHistory, setIsLoadingPaymentHistory] = useState(false);
  const [isRainingMoney, setIsRainingMoney] = useState(false);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [adminTab, setAdminTab] = useState<'products' | 'users' | 'featured'>('products');
  const [featuredBanner, setFeaturedBanner] = useState<any>(null);
  const [bannerYoutubeUrl, setBannerYoutubeUrl] = useState('');
  const [isBannerMuted, setIsBannerMuted] = useState(true);
  const bannerIframeRef = useRef<HTMLIFrameElement>(null);
  const bannerVideoInfo = useMemo(() => {
    return featuredBanner?.youtubeUrl ? getVideoInfo(featuredBanner.youtubeUrl, true) : null;
  }, [featuredBanner?.youtubeUrl]);

  useEffect(() => {
    if (bannerIframeRef.current && bannerVideoInfo?.type === 'youtube') {
      const message = JSON.stringify({
        event: 'command',
        func: isBannerMuted ? 'mute' : 'unMute',
        args: []
      });
      bannerIframeRef.current.contentWindow?.postMessage(message, '*');
    }
  }, [isBannerMuted, bannerVideoInfo]);

  // Chat State
  const [chatTab, setChatTab] = useState<'world' | 'private'>('world');
  const [worldMessages, setWorldMessages] = useState<any[]>([]);
  const [privateChats, setPrivateChats] = useState<any[]>([]);
  const [selectedChatUser, setSelectedChatUser] = useState<any | null>(null);
  const [privateMessages, setPrivateMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [showSetupGuide, setShowSetupGuide] = useState(false);

  // Form State
  const [newProduct, setNewProduct] = useState({
    title: '',
    developer: '',
    description: '',
    price: 'Free',
    category: 'Apps',
    icon: '',
    downloadUrl: ''
  });
  const [screenshotUrls, setScreenshotUrls] = useState('');
  
  // Purchased Products State
  const [purchasedProductIds, setPurchasedProductIds] = useState<string[]>([]);

  const isAdmin = userProfile?.role === 'admin' || user?.email === 'satyampal271@gmail.com';

  useEffect(() => {
    if (isProfileModalOpen && user) {
      const fetchHistory = async () => {
        setIsLoadingHistory(true);
        try {
          const q = query(
            collection(db, 'transactions'), 
            where('userId', '==', user.uid)
          );
          const snapshot = await getDocs(q);
          const history = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .filter((tx: any) => tx.type === 'purchase')
            .sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
          setPurchaseHistory(history);
        } catch (err) {
          console.error("Error fetching history:", err);
        }
        setIsLoadingHistory(false);
      };
      fetchHistory();
    }
  }, [isProfileModalOpen, user]);

  useEffect(() => {
    if (isWalletModalOpen && walletTab === 'history' && user) {
      const fetchPaymentHistory = async () => {
        setIsLoadingPaymentHistory(true);
        try {
          const q = query(
            collection(db, 'payment_requests'),
            where('userId', '==', user.uid)
          );
          const snapshot = await getDocs(q);
          const history = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a: any, b: any) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
          setPaymentHistory(history);
        } catch (err) {
          console.error("Error fetching payment history:", err);
        }
        setIsLoadingPaymentHistory(false);
      };
      fetchPaymentHistory();
    }
  }, [isWalletModalOpen, walletTab, user]);

  useEffect(() => {
    let unsubscribeWallet: () => void;
    if (user) {
      setIsProfileLoading(true);
      const userRef = doc(db, 'users', user.uid);
      unsubscribeWallet = onSnapshot(userRef, async (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setWalletBalance(data.walletBalance || 0);
          setUserProfile(data);
          setPurchasedProductIds(data.purchasedProducts || []);
          if (!data.phoneNumber || !data.displayName) {
            setProfileName(user.displayName || '');
            setShowProfileForm(true);
          } else {
            setShowProfileForm(false);
          }
        } else {
          setProfileName(user.displayName || '');
          setShowProfileForm(true);
          setWalletBalance(0);
          setPurchasedProductIds([]);
        }
        setIsProfileLoading(false);
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      });
    } else {
      setWalletBalance(0);
      setUserProfile(null);
      setShowProfileForm(false);
      setIsProfileLoading(false);
    }
    return () => {
      if (unsubscribeWallet) unsubscribeWallet();
    };
  }, [user]);

  // Fetch all users for Admin Panel
  useEffect(() => {
    if (isAdmin && activeTab === 'Admin') {
      const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
        const usersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setAllUsers(usersData);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'users');
      });
      return () => unsubscribe();
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    try {
      const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
      const unsubscribeProducts = onSnapshot(q, (snapshot) => {
        const productsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Product[];
        setProducts(productsData);
        setLoading(false);
        setError(null);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'products');
      });

      const unsubscribeFeatured = onSnapshot(doc(db, 'settings', 'featured'), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setFeaturedBanner(data);
          setBannerYoutubeUrl(data.youtubeUrl || '');
        }
      }, (err) => {
        handleFirestoreError(err, OperationType.GET, 'settings/featured');
      });

      return () => {
        unsubscribeAuth();
        unsubscribeProducts();
        unsubscribeFeatured();
      };
    } catch (err) {
      console.error("Setup error:", err);
      setError("Firebase initialization failed. Check your config.");
      setLoading(false);
    }
  }, []);

  // Fetch World Chat
  useEffect(() => {
    if (activeTab === 'Chat') {
      const q = query(collection(db, 'world_chat'), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setWorldMessages(msgs);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'world_chat');
      });
      return () => unsubscribe();
    }
  }, [activeTab]);

  // Fetch Private Chats List
  useEffect(() => {
    if (activeTab === 'Chat' && user) {
      const q = query(collection(db, 'private_chats'), where('participants', 'array-contains', user.uid));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const chats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
        // Sort manually to avoid composite index requirement
        const sortedChats = chats.sort((a, b) => {
          const timeA = a.updatedAt?.seconds || 0;
          const timeB = b.updatedAt?.seconds || 0;
          return timeB - timeA;
        });
        setPrivateChats(sortedChats);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, 'private_chats');
      });
      return () => unsubscribe();
    }
  }, [activeTab, user]);

  // Fetch Private Messages
  useEffect(() => {
    if (activeTab === 'Chat' && selectedChatUser && user) {
      const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
      const q = query(collection(db, `private_chats/${chatId}/messages`), orderBy('createdAt', 'asc'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPrivateMessages(msgs);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, `private_chats/${chatId}/messages`);
      });
      return () => unsubscribe();
    }
  }, [activeTab, selectedChatUser, user]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chatInput.trim()) return;

    const text = chatInput.trim();
    setChatInput('');

    try {
      if (chatTab === 'world') {
        await addDoc(collection(db, 'world_chat'), {
          text,
          senderId: user.uid,
          senderName: userProfile?.displayName || user.displayName || 'Anonymous',
          senderPhoto: userProfile?.photoURL || user.photoURL || '',
          createdAt: serverTimestamp()
        });
      } else if (chatTab === 'private' && selectedChatUser) {
        const chatId = [user.uid, selectedChatUser.uid].sort().join('_');
        const chatRef = doc(db, 'private_chats', chatId);
        
        await setDoc(chatRef, {
          participants: [user.uid, selectedChatUser.uid],
          users: {
            [user.uid]: { name: userProfile?.displayName || user.displayName || 'Anonymous', photo: userProfile?.photoURL || user.photoURL || '' },
            [selectedChatUser.uid]: { name: selectedChatUser.displayName || selectedChatUser.name || 'Anonymous', photo: selectedChatUser.photoURL || selectedChatUser.photo || '' }
          },
          lastMessage: text,
          updatedAt: serverTimestamp()
        }, { merge: true });

        await addDoc(collection(db, `private_chats/${chatId}/messages`), {
          text,
          senderId: user.uid,
          createdAt: serverTimestamp()
        });
      }
    } catch (err) {
      console.error("Error sending message:", err);
      alert("Failed to send message. Check Firestore rules.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Domain copied! Now paste it in Firebase Console.");
  };

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setError(null);
    } catch (err: any) {
      console.error("Login failed:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setError("Google Sign-in is not enabled in Firebase Console.");
      } else if (err.code === 'auth/unauthorized-domain') {
        const domain = window.location.hostname;
        setError(`Domain Unauthorized! Firebase is blocking login from this URL. You must add "${domain}" to your Authorized Domains.`);
      } else {
        setError("Login failed: " + err.message);
      }
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!profileName.trim() || !profilePhone.trim()) return;
    
    setIsSavingProfile(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        displayName: profileName.trim(),
        phoneNumber: profilePhone.trim(),
        email: user.email,
        walletBalance: walletBalance || 0,
        updatedAt: Timestamp.now()
      }, { merge: true });
      setShowProfileForm(false);
    } catch (err) {
      console.error("Error saving profile:", err);
      alert("Failed to save profile. Please check Firestore rules.");
    }
    setIsSavingProfile(false);
  };

  const handleRedeem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const code = redeemCode.trim().toUpperCase();
    if (!code) return;

    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Redemption',
      message: `Are you sure you want to redeem the code "${code}"?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsRedeeming(true);
        setRedeemStatus(null);

        let amount = 0;
        if (code === 'WELCOME50') amount = 50;
        else if (code === 'PROMO10') amount = 10;
        else if (code === 'MEGA100') amount = 100;

        if (amount > 0) {
          try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
              walletBalance: increment(amount)
            });
            setRedeemStatus({ type: 'success', msg: `Successfully redeemed ₹${amount}!` });
            setRedeemCode('');
          } catch (err: any) {
            console.error("Redeem error:", err);
            setRedeemStatus({ type: 'error', msg: 'Failed to redeem. Check Firestore rules.' });
          }
        } else {
          setRedeemStatus({ type: 'error', msg: 'Invalid or expired code.' });
        }
        setIsRedeeming(false);
      }
    });
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    
    const amountToProcess = Number(addAmount);
    if (isNaN(amountToProcess) || amountToProcess <= 0) {
      setPaymentStatus({ type: 'error', msg: 'Please enter a valid amount.' });
      return;
    }

    if (utrNumber.trim().length < 12) {
      setPaymentStatus({ type: 'error', msg: 'Please enter a valid 12-digit UTR number.' });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Payment Request',
      message: `Are you sure you want to submit a payment request for ₹${amountToProcess} with UTR: ${utrNumber}?`,
      onConfirm: async () => {
        setConfirmDialog(null);
        setIsSubmittingPayment(true);
        setPaymentStatus(null);
        try {
          await addDoc(collection(db, 'payment_requests'), {
            userId: user.uid,
            userName: userProfile?.displayName || user.displayName,
            userEmail: user.email,
            userPhone: userProfile?.phoneNumber || '',
            amount: amountToProcess,
            utr: utrNumber,
            status: 'pending',
            createdAt: Timestamp.now()
          });
          setPaymentStatus({ type: 'success', msg: 'Payment request submitted successfully! Our team will verify it soon.' });
          setUtrNumber('');
          setAddAmount(0);
          setIsTimerActive(false);
          
          // Success feedback: Trigger money rain for a second
          setIsRainingMoney(true);
          setTimeout(() => setIsRainingMoney(false), 2000);
        } catch (err: any) {
          console.error("Payment submit error:", err);
          setPaymentStatus({ type: 'error', msg: 'Failed to submit payment. Check Firestore rules.' });
        }
        setIsSubmittingPayment(false);
      }
    });
  };

  const handlePurchase = async (product: Product) => {
    if (!user) {
      setError("You must be logged in to purchase.");
      return;
    }

    const priceNum = parseFloat(product.price.replace(/[^0-9.]/g, ''));
    if (isNaN(priceNum)) return;

    if (walletBalance < priceNum) {
      setConfirmDialog({
        isOpen: true,
        title: 'Insufficient Balance',
        message: `You need ₹${priceNum} to buy this, but you only have ₹${walletBalance.toFixed(2)}. Please recharge your wallet.`,
        confirmText: 'Recharge Now',
        onConfirm: () => {
          setConfirmDialog(null);
          setIsWalletModalOpen(true);
          setWalletTab('add');
        }
      });
      return;
    }

    setConfirmDialog({
      isOpen: true,
      title: 'Confirm Purchase',
      message: `Are you sure you want to buy ${product.title} for ₹${priceNum}? This will be deducted from your wallet.`,
      confirmText: 'Buy Now',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const userRef = doc(db, 'users', user.uid);
          
          // Add to purchased products and deduct balance
          const newPurchased = [...purchasedProductIds, product.id];
          await updateDoc(userRef, {
            walletBalance: increment(-priceNum),
            purchasedProducts: newPurchased
          });
          
          setPurchasedProductIds(newPurchased);
          
          // Record the transaction
          await addDoc(collection(db, 'transactions'), {
            userId: user.uid,
            productId: product.id,
            productTitle: product.title,
            amount: priceNum,
            type: 'purchase',
            createdAt: Timestamp.now()
          });
          
          // If there's a download URL, open it
          if (product.downloadUrl) {
            window.open(product.downloadUrl, '_blank');
          }
        } catch (err: any) {
          console.error("Purchase error:", err);
          setError("Failed to complete purchase.");
        }
      }
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!user) return;
    
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Product',
      message: 'Are you sure you want to delete this product? This action cannot be undone.',
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'products', productId));
          setConfirmDialog(null);
          setError(null);
        } catch (err: any) {
          console.error("Delete error:", err);
          setError("Failed to delete product: " + err.message);
        }
      }
    });
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setScreenshotUrls(product.screenshots?.join(', ') || '');
    setIsEditModalOpen(true);
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingProduct || isPublishing) return;

    setIsPublishing(true);
    try {
      const parsedUrls = screenshotUrls
        .split(',')
        .map(url => url.trim())
        .filter(url => url.startsWith('http'));

      const productRef = doc(db, 'products', editingProduct.id);
      await updateDoc(productRef, {
        ...editingProduct,
        screenshots: parsedUrls,
        updatedAt: Timestamp.now()
      });
      
      setIsEditModalOpen(false);
      setEditingProduct(null);
      setScreenshotUrls('');
      setError(null);
    } catch (err: any) {
      console.error("Update error:", err);
      setError("Failed to update product: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Attempting to add product...", { user, isPublishing, newProduct });
    if (!user || isPublishing) {
      console.log("Submission blocked:", { user: !!user, isPublishing });
      if (!user) setError("You must be logged in to publish.");
      return;
    }

    if (!db) {
      setError("Database not connected. Please check your Firebase configuration.");
      return;
    }

    setIsPublishing(true);
    try {
      const parsedUrls = screenshotUrls
        .split(',')
        .map(url => url.trim())
        .filter(url => url.startsWith('http'));

      await addDoc(collection(db, 'products'), {
        ...newProduct,
        rating: 5.0,
        icon: newProduct.icon || `https://picsum.photos/seed/${Math.random()}/150/150`,
        screenshots: parsedUrls,
        createdAt: Timestamp.now(),
        sellerId: user.uid,
        sellerName: user.displayName
      });
      setIsModalOpen(false);
      setNewProduct({ title: '', developer: '', description: '', price: 'Free', category: 'Apps', icon: '', downloadUrl: '' });
      setScreenshotUrls('');
      setError(null);
    } catch (err: any) {
      console.error("Error adding product:", err);
      if (err.code === 'storage/unauthorized') {
        setError("Storage rules not set. Please enable Firebase Storage and set rules to allow read/write.");
      } else {
        setError("Failed to publish: " + err.message);
      }
    } finally {
      setIsPublishing(false);
    }
  };

  const displayProducts = products.length > 0 ? products : MOCK_FALLBACK;
  const filteredProducts = displayProducts.filter(p => {
    if (activeTab === 'My Apps') return p.sellerId === user?.uid;
    const matchesTab = activeTab === 'Home' || p.category === activeTab;
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.developer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#0f1115] text-white font-sans flex relative overflow-hidden">
      {/* Animated Background */}
      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_right,#4f4f4f1a_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f1a_1px,transparent_1px)] bg-[size:24px_24px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-50" />
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-indigo-500/5 via-transparent to-emerald-500/5 animate-pulse" style={{ animationDuration: '4s' }} />
      
      {isRainingMoney && <MoneyRain />}

      {/* Sidebar */}
      <aside className="w-64 bg-[#16181d] border-r border-white/5 hidden md:flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Download className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight">AppStore</span>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 mt-4">
          {[
            { name: 'Home', icon: Home },
            { name: 'Games', icon: Gamepad2 },
            { name: 'Apps', icon: LayoutGrid },
            { name: 'My Apps', icon: User },
            { name: 'Chat', icon: MessageSquare },
            { name: 'Offers', icon: Tag },
          ].map((item) => (
            <button
              key={item.name}
              onClick={() => setActiveTab(item.name)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative overflow-hidden ${
                activeTab === item.name 
                  ? 'bg-indigo-500/10 text-indigo-400' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {activeTab === item.name && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              )}
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => setActiveTab('Admin')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all relative overflow-hidden ${
                activeTab === 'Admin' 
                  ? 'bg-red-500/10 text-red-400' 
                  : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {activeTab === 'Admin' && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-full shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
              )}
              <ShieldCheck className="w-5 h-5" />
              <span className="font-medium">Admin Panel</span>
            </button>
          )}
        </nav>

        <div className="p-4 border-t border-white/5">
          {user ? (
            <div className="space-y-4">
              <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-gray-400">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xs font-medium uppercase tracking-wider">Wallet</span>
                  </div>
                  {isProfileLoading ? (
                    <div className="h-5 bg-white/10 rounded w-16 animate-pulse" />
                  ) : (
                    <span className="text-sm font-bold text-emerald-400">₹{walletBalance.toFixed(2)}</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setIsWalletModalOpen(true)}
                    className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-1.5 rounded-lg text-sm font-medium transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Add Money
                  </button>
                  <button 
                    onClick={() => {
                      setIsRainingMoney(true);
                      setTimeout(() => setIsRainingMoney(false), 5000);
                    }}
                    className="w-10 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white py-1.5 rounded-lg text-sm transition-colors"
                    title="Make it Rain"
                  >
                    💸
                  </button>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Publish App
              </button>
              <div className="flex items-center gap-3 px-2">
                {isProfileLoading ? (
                  <div className="flex flex-1 items-center gap-3 p-1.5 -ml-1.5 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 bg-white/10 rounded w-2/3" />
                      <div className="h-2 bg-white/5 rounded w-1/2" />
                    </div>
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsProfileModalOpen(true)}
                    className="flex flex-1 items-center gap-3 hover:bg-white/5 p-1.5 -ml-1.5 rounded-xl transition-colors text-left"
                  >
                    <img 
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                      alt="Profile" 
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.displayName}`; }}
                      className="w-10 h-10 rounded-full border border-white/10"
                    />
                    <div className="flex-1 overflow-hidden">
                      <p className="text-sm font-medium truncate">{userProfile?.displayName || user.displayName}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                  </button>
                )}
                <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Log Out">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl font-medium transition-colors"
            >
              <LogIn className="w-4 h-4" />
              Sign In with Google
            </button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Top Header */}
        <header className="h-20 px-4 md:px-8 flex items-center justify-between border-b border-white/5 bg-[#0f1115]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-4 md:hidden">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <Menu className="w-6 h-6" />
            </button>
            <span className="text-xl font-bold">AppStore</span>
          </div>

          <div className="hidden md:flex flex-1 max-w-2xl">
            <div className="relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search apps, games & more..." 
                className="w-full bg-[#16181d] border border-white/5 rounded-full py-3 pl-12 pr-6 text-sm focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-gray-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowSetupGuide(!showSetupGuide)}
              className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-colors"
              title="Setup Guide"
            >
              <Info className="w-5 h-5" />
            </button>
            <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3" />
              Firebase Connected
            </div>
          </div>
        </header>

        {/* Error Banner */}
        {error && (
          <div className="mx-8 mt-4 p-5 bg-red-500/15 border border-red-500/30 rounded-3xl flex flex-col md:flex-row items-start md:items-center gap-4 text-red-400 shadow-2xl shadow-red-500/10">
            <div className="p-3 bg-red-500/20 rounded-2xl">
              <AlertTriangle className="w-6 h-6 shrink-0" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-lg mb-1">
                {error.includes('Login') || error.includes('Domain') || error.includes('Sign-in') 
                  ? 'Action Required: Fix Login Error' 
                  : 'Action Required: Database Error'}
              </p>
              <p className="text-sm opacity-90">{error}</p>
              {error.includes("Domain Unauthorized") && (
                <div className="mt-4 flex flex-wrap gap-3">
                  <button 
                    onClick={() => copyToClipboard(window.location.hostname)}
                    className="px-4 py-2 bg-white text-red-600 hover:bg-gray-100 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                  >
                    1. Copy Domain
                  </button>
                  <a 
                    href="https://console.firebase.google.com/project/pro-app-market/authentication/settings"
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-xl text-sm font-bold transition-all flex items-center gap-2"
                  >
                    2. Open Firebase Console
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-bold transition-all"
                  >
                    3. I've added it (Refresh)
                  </button>
                </div>
              )}
            </div>
            <button onClick={() => setError(null)} className="p-2 hover:bg-white/10 rounded-full self-start md:self-center">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Setup Guide Overlay */}
        {showSetupGuide && (
          <div className="mx-8 mt-4 p-6 bg-indigo-600/10 border border-indigo-600/20 rounded-3xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-indigo-400 flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Firebase Setup Instructions
              </h3>
              <button onClick={() => setShowSetupGuide(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-gray-300">
              <div className="space-y-2">
                <p className="font-bold text-white">1. Enable Auth</p>
                <p>Go to Firebase Console &gt; Build &gt; Authentication &gt; Sign-in method &gt; Enable **Google**.</p>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-white">2. Authorize Domain</p>
                <p>Add this URL to **Authorized Domains** in Auth settings: <br/><code className="text-indigo-400 break-all">{window.location.hostname}</code></p>
              </div>
              <div className="space-y-2">
                <p className="font-bold text-white">3. Firestore Rules</p>
                <p>Go to Firestore &gt; Rules &gt; Set to:<br/><code className="text-indigo-400">allow read, write: if true;</code> (for testing)</p>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-10">
            
            {/* Admin Panel Section */}
            {activeTab === 'Admin' && isAdmin && (
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-3xl font-bold flex items-center gap-3">
                    <ShieldCheck className="w-8 h-8 text-red-500" />
                    Admin Control Panel
                  </h2>
                  <div className="px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm font-bold">
                    System Administrator
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-[#16181d] border border-white/5 rounded-3xl p-6">
                    <p className="text-gray-400 text-sm font-medium mb-1">Total Products</p>
                    <h3 className="text-3xl font-bold">{displayProducts.length}</h3>
                  </div>
                  <div className="bg-[#16181d] border border-white/5 rounded-3xl p-6">
                    <p className="text-gray-400 text-sm font-medium mb-1">Total Users</p>
                    <h3 className="text-3xl font-bold">{allUsers.length}</h3>
                  </div>
                  <div className="bg-[#16181d] border border-white/5 rounded-3xl p-6">
                    <p className="text-gray-400 text-sm font-medium mb-1">System Status</p>
                    <h3 className="text-3xl font-bold text-emerald-400">Active</h3>
                  </div>
                </div>

                <div className="flex gap-2 p-1 bg-white/5 rounded-2xl w-fit">
                  <button 
                    onClick={() => setAdminTab('products')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${adminTab === 'products' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    Products
                  </button>
                  <button 
                    onClick={() => setAdminTab('users')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${adminTab === 'users' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    Users
                  </button>
                  <button 
                    onClick={() => setAdminTab('featured')}
                    className={`px-6 py-2 rounded-xl text-sm font-bold transition-all ${adminTab === 'featured' ? 'bg-white text-black shadow-lg' : 'text-gray-400 hover:text-white'}`}
                  >
                    Featured Banner
                  </button>
                </div>

                {adminTab === 'featured' ? (
                  <div className="bg-[#16181d] border border-white/5 rounded-3xl overflow-hidden p-6">
                    <h3 className="font-bold mb-6">Update Featured Banner</h3>
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const youtubeUrl = (form.elements.namedItem('youtubeUrl') as HTMLInputElement).value;
                      const title = (form.elements.namedItem('title') as HTMLInputElement).value;
                      const description = (form.elements.namedItem('description') as HTMLInputElement).value;
                      const buttonText = (form.elements.namedItem('buttonText') as HTMLInputElement).value;
                      
                      try {
                        await setDoc(doc(db, 'settings', 'featured'), {
                          youtubeUrl,
                          title,
                          description,
                          buttonText,
                          updatedAt: serverTimestamp()
                        }, { merge: true });
                        alert('Featured banner updated successfully!');
                      } catch (err) {
                        console.error('Error updating banner:', err);
                        alert('Failed to update banner. Check permissions.');
                      }
                    }} className="space-y-4 max-w-2xl">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Video URL (YouTube, MP4, or any Embed link)</label>
                        <input 
                          type="text" 
                          name="youtubeUrl"
                          value={bannerYoutubeUrl}
                          onChange={(e) => setBannerYoutubeUrl(e.target.value)}
                          placeholder="e.g. https://www.youtube.com/watch?v=... or https://.../video.mp4" 
                          className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                        />
                        {getYoutubeId(bannerYoutubeUrl) && (
                          <div className="mt-4 relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                            <div className="relative bg-[#0f1115] rounded-xl overflow-hidden border border-white/10">
                              <div className="aspect-video w-full max-w-md">
                                <img 
                                  src={`https://img.youtube.com/vi/${getYoutubeId(bannerYoutubeUrl)}/maxresdefault.jpg`}
                                  alt="Thumbnail Preview"
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.src = `https://img.youtube.com/vi/${getYoutubeId(bannerYoutubeUrl)}/hqdefault.jpg`;
                                  }}
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                  <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center border border-white/30">
                                    <ImageIcon className="w-6 h-6 text-white" />
                                  </div>
                                </div>
                              </div>
                              <div className="p-3 bg-white/5 border-t border-white/10">
                                <p className="text-xs text-gray-400 flex items-center gap-2">
                                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  YouTube Thumbnail Preview
                                </p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
                        <input 
                          type="text" 
                          name="title"
                          defaultValue={featuredBanner?.title || 'Procreate Dreams'}
                          className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Description</label>
                        <textarea 
                          name="description"
                          defaultValue={featuredBanner?.description || 'Create rich 2D animations, expressive videos, and breathtaking stories.'}
                          rows={3}
                          className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Button Text</label>
                        <input 
                          type="text" 
                          name="buttonText"
                          defaultValue={featuredBanner?.buttonText || '$19.99'}
                          className="w-full bg-[#0f1115] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button type="submit" className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold transition-colors">
                        Save Changes
                      </button>
                    </form>
                  </div>
                ) : adminTab === 'products' ? (
                  <div className="bg-[#16181d] border border-white/5 rounded-3xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/5">
                      <h3 className="font-bold">Manage All Products</h3>
                    </div>
                    <div className="divide-y divide-white/5">
                      {displayProducts.map((product) => (
                        <div key={product.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-4">
                            <img src={product.icon} alt="" className="w-12 h-12 rounded-xl object-cover" referrerPolicy="no-referrer" />
                            <div>
                              <h4 className="font-bold">{product.title}</h4>
                              <p className="text-xs text-gray-400">By {product.developer} • {product.category}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleEditProduct(product)}
                              className="p-2 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white rounded-xl transition-all"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-2 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="bg-[#16181d] border border-white/5 rounded-3xl overflow-hidden">
                    <div className="p-6 border-b border-white/5 bg-white/5">
                      <h3 className="font-bold">Manage User Roles</h3>
                    </div>
                    <div className="divide-y divide-white/5">
                      {allUsers.map((u) => (
                        <div key={u.id} className="p-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold">
                              {u.displayName?.charAt(0) || u.email?.charAt(0) || '?'}
                            </div>
                            <div>
                              <h4 className="font-bold">{u.displayName || 'Anonymous'}</h4>
                              <p className="text-xs text-gray-400">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${u.role === 'admin' ? 'bg-red-500/20 text-red-400 border border-red-500/20' : 'bg-white/5 text-gray-400 border border-white/10'}`}>
                              {u.role || 'user'}
                            </span>
                            <select 
                              value={u.role || 'user'}
                              onChange={async (e) => {
                                const newRole = e.target.value;
                                try {
                                  await updateDoc(doc(db, 'users', u.id), { role: newRole });
                                } catch (err) {
                                  console.error("Failed to update role:", err);
                                  alert("Failed to update role. Check Firestore rules.");
                                }
                              }}
                              className="bg-[#0f1115] border border-white/10 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-indigo-500"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Featured Banner */}
            {activeTab === 'Home' && (
              <section className="mb-8">
                <div className="bg-[#16181d] rounded-3xl overflow-hidden border border-white/5">
                  {/* Video Section */}
                  <div className="relative w-full aspect-video bg-black overflow-hidden pointer-events-none select-none">
                    {(() => {
                      const videoInfo = bannerVideoInfo;
                      
                      if (videoInfo?.type === 'youtube' || videoInfo?.type === 'iframe') {
                        return (
                          <iframe
                            ref={bannerIframeRef}
                            src={videoInfo.url}
                            title="Featured Video"
                            className="absolute top-[-20%] left-[-10%] w-[120%] h-[140%] object-cover pointer-events-none"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            style={{ border: 'none' }}
                          ></iframe>
                        );
                      } else if (videoInfo?.type === 'raw') {
                        return (
                          <video 
                            src={videoInfo.url}
                            autoPlay 
                            muted={isBannerMuted}
                            loop 
                            playsInline
                            className="absolute top-0 left-0 w-full h-full object-cover pointer-events-none"
                          />
                        );
                      } else {
                        return (
                          <img 
                            src="https://picsum.photos/seed/procreate/1200/500" 
                            alt="Featured"
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.currentTarget.src = 'https://picsum.photos/seed/featured/1200/500'; }}
                            className="w-full h-full object-cover"
                          />
                        );
                      }
                    })()}
                  </div>

                  {/* Details Section (Below Video) */}
                  <div className="p-6 md:p-8">
                    <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider rounded-full border border-indigo-500/20 mb-4 inline-block">
                      Featured
                    </span>
                    <h1 className="text-2xl md:text-4xl font-bold mb-3 text-white">{featuredBanner?.title || 'Procreate Dreams'}</h1>
                    <p className="text-gray-400 max-w-3xl mb-6 text-sm md:text-base leading-relaxed">{featuredBanner?.description || 'Create rich 2D animations, expressive videos, and breathtaking stories.'}</p>
                    <div className="flex items-center gap-4">
                      <button className="bg-white text-black px-8 py-3 rounded-full font-bold hover:bg-gray-200 transition-colors shadow-lg">
                        {featuredBanner?.buttonText || '$19.99'}
                      </button>
                      
                      {featuredBanner?.youtubeUrl && (
                        <button 
                          onClick={() => setIsBannerMuted(!isBannerMuted)}
                          className="p-3 bg-white/10 hover:bg-white/20 rounded-full transition-all border border-white/10 group"
                          title={isBannerMuted ? "Unmute" : "Mute"}
                        >
                          {isBannerMuted ? (
                            <VolumeX className="w-5 h-5 text-gray-400 group-hover:text-white" />
                          ) : (
                            <Volume2 className="w-5 h-5 text-indigo-400 group-hover:text-indigo-300" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Chat Section */}
            {activeTab === 'Chat' && (
              <section className="h-[calc(100vh-120px)] flex flex-col bg-[#16181d] border border-white/5 rounded-3xl overflow-hidden">
                <div className="flex border-b border-white/5">
                  <button 
                    onClick={() => { setChatTab('world'); setSelectedChatUser(null); }}
                    className={`flex-1 py-4 text-sm font-bold transition-colors ${chatTab === 'world' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}
                  >
                    World Chat
                  </button>
                  <button 
                    onClick={() => setChatTab('private')}
                    className={`flex-1 py-4 text-sm font-bold transition-colors ${chatTab === 'private' ? 'text-indigo-400 border-b-2 border-indigo-400' : 'text-gray-400 hover:text-white'}`}
                  >
                    Private Messages
                  </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                  {/* Private Chat Sidebar */}
                  {chatTab === 'private' && (
                    <div className="w-64 border-r border-white/5 flex flex-col bg-[#0f1115]">
                      <div className="p-4 border-b border-white/5 font-bold text-sm text-gray-400 uppercase tracking-wider">
                        Conversations
                      </div>
                      <div className="flex-1 overflow-y-auto">
                        {privateChats.map(chat => {
                          const otherUserId = chat.participants.find((p: string) => p !== user?.uid);
                          const otherUser = chat.users?.[otherUserId];
                          return (
                            <button
                              key={chat.id}
                              onClick={() => setSelectedChatUser({ uid: otherUserId, ...otherUser })}
                              className={`w-full p-4 flex items-center gap-3 hover:bg-white/5 transition-colors text-left ${selectedChatUser?.uid === otherUserId ? 'bg-white/5 border-l-2 border-indigo-500' : ''}`}
                            >
                              <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0 overflow-hidden">
                                {otherUser?.photo ? <img src={otherUser.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : (otherUser?.name?.charAt(0) || '?')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-sm truncate">{otherUser?.name || 'Anonymous'}</h4>
                                <p className="text-xs text-gray-400 truncate">{chat.lastMessage}</p>
                              </div>
                            </button>
                          );
                        })}
                        {privateChats.length === 0 && (
                          <div className="p-4 text-center text-gray-500 text-sm">
                            No conversations yet.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chat Area */}
                  <div className="flex-1 flex flex-col bg-[#16181d]">
                    {chatTab === 'private' && !selectedChatUser ? (
                      <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                        <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                        <p>Select a conversation to start chatting</p>
                      </div>
                    ) : (
                      <>
                        {/* Chat Header */}
                        {chatTab === 'private' && selectedChatUser && (
                          <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-white/5">
                            <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold overflow-hidden">
                              {selectedChatUser.photo ? <img src={selectedChatUser.photo} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : (selectedChatUser.name?.charAt(0) || '?')}
                            </div>
                            <h3 className="font-bold">{selectedChatUser.name || 'Anonymous'}</h3>
                          </div>
                        )}

                        {/* Messages List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-4">
                          {(chatTab === 'world' ? worldMessages : privateMessages).map((msg) => {
                            const isMe = msg.senderId === user?.uid;
                            return (
                              <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : ''}`}>
                                {!isMe && (
                                  <div 
                                    onClick={() => {
                                      if (user && chatTab === 'world') {
                                        setSelectedChatUser({ uid: msg.senderId, name: msg.senderName, photo: msg.senderPhoto });
                                        setChatTab('private');
                                      }
                                    }}
                                    className={`w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-bold shrink-0 overflow-hidden ${chatTab === 'world' ? 'hover:ring-2 hover:ring-indigo-500 transition-all cursor-pointer' : ''}`}
                                    title={chatTab === 'world' ? `Message ${msg.senderName}` : ''}
                                  >
                                    {msg.senderPhoto ? <img src={msg.senderPhoto} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" /> : (msg.senderName?.charAt(0) || '?')}
                                  </div>
                                )}
                                <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                  {!isMe && chatTab === 'world' && (
                                    <span className="text-xs text-gray-400 mb-1 ml-1">{msg.senderName}</span>
                                  )}
                                  <div className={`px-4 py-2 ${isMe ? 'bg-indigo-500 text-white rounded-2xl rounded-tr-sm' : 'bg-white/10 text-gray-100 rounded-2xl rounded-tl-sm'}`}>
                                    {msg.text}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {(chatTab === 'world' ? worldMessages : privateMessages).length === 0 && (
                            <div className="h-full flex items-center justify-center text-gray-500 text-sm">
                              No messages yet. Be the first to say hello!
                            </div>
                          )}
                        </div>

                        {/* Message Input */}
                        <form onSubmit={handleSendMessage} className="p-4 border-t border-white/5 bg-[#0f1115]">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              placeholder={user ? "Type a message..." : "Login to chat"}
                              disabled={!user}
                              className="flex-1 bg-[#16181d] border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            />
                            <button
                              type="submit"
                              disabled={!user || !chatInput.trim()}
                              className="bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
                            >
                              <Send className="w-5 h-5" />
                              <span className="hidden sm:inline">Send</span>
                            </button>
                          </div>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </section>
            )}

            {/* Products Section */}
            {activeTab !== 'Admin' && activeTab !== 'Chat' && (
              <section>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold">{activeTab === 'Home' ? 'Recommended for you' : activeTab}</h2>
                  <button className="text-indigo-400 text-sm font-medium hover:text-indigo-300">See all</button>
                </div>
                
                {loading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                      <div key={i} className="bg-[#16181d] border border-white/5 rounded-2xl p-4 animate-pulse">
                        <div className="flex items-start gap-4">
                          <div className="w-16 h-16 rounded-xl bg-white/5 shrink-0" />
                          <div className="flex-1 min-w-0 py-1">
                            <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
                            <div className="h-3 bg-white/5 rounded w-1/2 mb-3" />
                            <div className="h-3 bg-white/5 rounded w-1/4" />
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <div className="h-5 bg-white/5 rounded w-16" />
                          <div className="h-5 bg-white/10 rounded w-12" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center bg-[#16181d] border border-dashed border-white/10 rounded-3xl">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <PackageSearch className="w-10 h-10 text-gray-500" />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No Products Found</h3>
                    <p className="text-gray-400 max-w-xs">We couldn't find any products in this category. Try exploring other tabs!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    {filteredProducts.map((product) => (
                      <div 
                        key={product.id} 
                        onClick={() => setSelectedProduct(product)}
                        className="bg-[#16181d] border border-white/5 rounded-2xl p-4 hover:bg-[#1c1e24] hover:border-white/10 transition-all cursor-pointer group"
                      >
                        <div className="flex items-start gap-4">
                          <img 
                            src={product.icon} 
                            alt={product.title} 
                            referrerPolicy="no-referrer"
                            onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/${product.id}/150/150`; }}
                            className="w-16 h-16 rounded-xl object-cover shadow-lg group-hover:shadow-indigo-500/20 transition-all"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-base truncate">{product.title}</h3>
                              {(isAdmin || product.sellerId === user?.uid) && (
                                <div className="flex gap-1 shrink-0">
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleEditProduct(product); }}
                                    className="p-1.5 bg-white/5 hover:bg-indigo-500/20 text-gray-400 hover:text-indigo-400 rounded-lg transition-colors"
                                    title="Edit"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteProduct(product.id); }}
                                    className="p-1.5 bg-white/5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                                    title="Delete"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                            <p className="text-xs text-gray-400 truncate mt-0.5">{product.developer}</p>
                            <div className="flex items-center gap-1 mt-2">
                              <span className="text-xs font-medium">{product.rating}</span>
                              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                            </div>
                          </div>
                        </div>
                        <div className="mt-4 flex items-center justify-between">
                          <span className="text-xs text-gray-500 bg-white/5 px-2 py-1 rounded-md">{product.category}</span>
                          {product.price === 'Free' || purchasedProductIds.includes(product.id) ? (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                if (product.downloadUrl) {
                                  window.open(product.downloadUrl, '_blank');
                                } else {
                                  setSelectedProduct(product);
                                }
                              }}
                              className="bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1"
                            >
                              <Download className="w-3 h-3" />
                              Download
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePurchase(product);
                              }}
                              className="bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500 hover:text-white px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5"
                            >
                              <Lock className="w-3 h-3" />
                              {product.price}
                            </button>
                          )}
                        </div>
                        {product.screenshots && product.screenshots.length > 0 && (
                          <div className="mt-4 flex gap-2 overflow-x-auto pb-2 snap-x hide-scrollbar">
                            {product.screenshots.map((url, idx) => (
                              <a key={idx} href={url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="shrink-0 group/link relative block" title={url}>
                                <img 
                                  src={url} 
                                  alt={`Screenshot ${idx + 1}`} 
                                  referrerPolicy="no-referrer"
                                  onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/screenshot${idx}/400/800`; }}
                                  className="h-24 w-auto rounded-lg object-cover snap-center border border-white/10 hover:border-indigo-500 transition-colors"
                                />
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/link:opacity-100 transition-opacity flex items-center justify-center rounded-lg">
                                  <ExternalLink className="w-5 h-5 text-white" />
                                </div>
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

          </div>
        </div>
      </main>

      {/* Product Detail Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#16181d] w-full max-w-2xl flex flex-col rounded-3xl border border-white/10 overflow-hidden shadow-2xl my-auto max-h-[90vh]">
            <div className="relative h-48 bg-gradient-to-br from-indigo-500/20 to-purple-600/20 shrink-0">
              <button onClick={() => setSelectedProduct(null)} className="absolute top-4 right-4 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur-md transition-colors z-10">
                <X className="w-5 h-5" />
              </button>
              <div className="absolute -bottom-8 left-6 flex items-end gap-4">
                <img src={selectedProduct.icon} alt={selectedProduct.title} referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/${selectedProduct.id}/150/150`; }} className="w-24 h-24 rounded-2xl border-4 border-[#16181d] object-cover bg-[#16181d] shadow-xl" />
                <div className="mb-1">
                  <h2 className="text-2xl font-bold text-white">{selectedProduct.title}</h2>
                  <p className="text-indigo-400 font-medium">{selectedProduct.developer}</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 pt-12 overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
                    <span className="font-bold">{selectedProduct.rating}</span>
                    <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  </div>
                  <span className="text-sm text-gray-400 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">{selectedProduct.category}</span>
                </div>
                {selectedProduct.price === 'Free' || purchasedProductIds.includes(selectedProduct.id) ? (
                  <button 
                    onClick={() => selectedProduct.downloadUrl ? window.open(selectedProduct.downloadUrl, '_blank') : alert('Download link not available')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20 flex items-center gap-2"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </button>
                ) : (
                  <button 
                    onClick={() => handlePurchase(selectedProduct)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                  >
                    <Lock className="w-4 h-4" />
                    Buy {selectedProduct.price}
                  </button>
                )}
              </div>

              {selectedProduct.screenshots && selectedProduct.screenshots.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-4">Screenshots</h3>
                  <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar">
                    {selectedProduct.screenshots.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="shrink-0 group/link relative block">
                        <img 
                          src={url} 
                          alt={`Screenshot ${idx + 1}`} 
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.currentTarget.src = `https://picsum.photos/seed/screenshot${idx}/400/800`; }}
                          className="h-48 w-auto rounded-xl object-cover snap-center border border-white/10 hover:border-indigo-500 transition-colors"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/link:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
                          <ExternalLink className="w-6 h-6 text-white" />
                        </div>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-lg font-bold mb-3">About this {selectedProduct.category.toLowerCase() === 'games' ? 'game' : 'app'}</h3>
                <p className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {selectedProduct.description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#16181d] w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold">Edit App</h2>
              <button onClick={() => setIsEditModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form 
              onSubmit={handleUpdateProduct} 
              className="p-6 space-y-4 overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">App Title</label>
                <input 
                  required
                  type="text" 
                  value={editingProduct.title}
                  onChange={e => setEditingProduct({...editingProduct, title: e.target.value})}
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Developer</label>
                  <input 
                    required
                    type="text" 
                    value={editingProduct.developer}
                    onChange={e => setEditingProduct({...editingProduct, developer: e.target.value})}
                    className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Price</label>
                  <input 
                    required
                    type="text" 
                    value={editingProduct.price}
                    onChange={e => setEditingProduct({...editingProduct, price: e.target.value})}
                    className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">App Icon URL</label>
                <input 
                  type="text" 
                  value={editingProduct.icon}
                  onChange={e => setEditingProduct({...editingProduct, icon: e.target.value})}
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Category</label>
                <select 
                  value={editingProduct.category}
                  onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 appearance-none"
                >
                  <option value="Apps">Apps</option>
                  <option value="Games">Games</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Description</label>
                <textarea 
                  required
                  rows={3}
                  value={editingProduct.description}
                  onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Screenshots (Image URLs)</label>
                <textarea 
                  rows={2}
                  value={screenshotUrls}
                  onChange={e => setScreenshotUrls(e.target.value)}
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Download Link</label>
                <input 
                  type="url" 
                  value={editingProduct.downloadUrl}
                  onChange={e => setEditingProduct({...editingProduct, downloadUrl: e.target.value})}
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
              <button 
                type="submit"
                disabled={isPublishing}
                className={`w-full ${isPublishing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white py-4 rounded-2xl font-bold transition-all mt-4 flex items-center justify-center gap-2`}
              >
                {isPublishing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Publish Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#16181d] w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-white/10 overflow-hidden">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold">Publish New App</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form 
              onSubmit={handleAddProduct} 
              onInvalid={(e) => console.log("Form validation failed:", e)}
              className="p-6 space-y-4 overflow-y-auto"
            >
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">App Title</label>
                <input 
                  required
                  type="text" 
                  value={newProduct.title}
                  onChange={e => setNewProduct({...newProduct, title: e.target.value})}
                  placeholder="e.g. Minecraft, WhatsApp"
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Developer</label>
                  <input 
                    required
                    type="text" 
                    value={newProduct.developer}
                    onChange={e => setNewProduct({...newProduct, developer: e.target.value})}
                    placeholder="Company Name"
                    className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Price</label>
                  <input 
                    required
                    type="text" 
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                    placeholder="Free or $9.99"
                    className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">App Icon URL (Optional)</label>
                <input 
                  type="text" 
                  value={newProduct.icon}
                  onChange={e => setNewProduct({...newProduct, icon: e.target.value})}
                  placeholder="https://example.com/icon.png"
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Category</label>
                <select 
                  value={newProduct.category}
                  onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 appearance-none"
                >
                  <option value="Apps">Apps</option>
                  <option value="Games">Games</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Description</label>
                <textarea 
                  required
                  rows={3}
                  value={newProduct.description}
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  placeholder="Tell users what your app does..."
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Screenshots (Image URLs)</label>
                <textarea 
                  rows={2}
                  value={screenshotUrls}
                  onChange={e => setScreenshotUrls(e.target.value)}
                  placeholder="Paste image links separated by commas (e.g. https://link1.png, https://link2.jpg)"
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 resize-none text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Download Link (APK/ZIP/URL)</label>
                <input 
                  type="url" 
                  value={newProduct.downloadUrl}
                  onChange={e => setNewProduct({...newProduct, downloadUrl: e.target.value})}
                  placeholder="https://example.com/download.apk"
                  className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-indigo-500 text-sm"
                />
              </div>
              <button 
                type="submit"
                disabled={isPublishing}
                onClick={() => console.log("Publish button clicked")}
                className={`w-full ${isPublishing ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white py-4 rounded-2xl font-bold transition-all mt-4 flex items-center justify-center gap-2`}
              >
                {isPublishing ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish to Store'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {/* Wallet Modal */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#16181d] w-full max-w-md flex flex-col rounded-3xl border border-white/10 overflow-hidden shadow-2xl my-auto">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-gradient-to-r from-emerald-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Wallet className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Wallet</h2>
                  {isProfileLoading ? (
                    <div className="h-4 bg-white/10 rounded w-24 mt-1 animate-pulse" />
                  ) : (
                    <p className="text-sm text-emerald-400 font-medium">Balance: ₹{walletBalance.toFixed(2)}</p>
                  )}
                </div>
              </div>
              <button onClick={() => { setIsWalletModalOpen(false); setRedeemStatus(null); setPaymentStatus(null); setUtrNumber(''); }} className="p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-white/5">
              <button 
                onClick={() => setWalletTab('add')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${walletTab === 'add' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400 hover:text-white'}`}
              >
                Add Money
              </button>
              <button 
                onClick={() => setWalletTab('redeem')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${walletTab === 'redeem' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400 hover:text-white'}`}
              >
                Redeem Code
              </button>
              <button 
                onClick={() => setWalletTab('history')}
                className={`flex-1 py-3 text-sm font-bold transition-colors ${walletTab === 'history' ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-gray-400 hover:text-white'}`}
              >
                History
              </button>
            </div>

            {walletTab === 'add' && (
              <form onSubmit={handlePaymentSubmit} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-2 flex justify-between items-center">
                    <span>Select Amount</span>
                    {isTimerActive && (
                      <span className="text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded">
                        {formatTime(paymentTimer)}
                      </span>
                    )}
                  </label>
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    {[100, 300, 500].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => {
                          setAddAmount(amt);
                          startPaymentTimer();
                        }}
                        className={`py-2 rounded-xl font-bold text-sm transition-all ${addAmount === amt ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                      >
                        ₹{amt}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
                    <input 
                      type="number" 
                      value={addAmount}
                      onChange={e => {
                        setAddAmount(e.target.value === '' ? '' : Number(e.target.value));
                        if (!isTimerActive) startPaymentTimer();
                      }}
                      placeholder="Enter custom amount"
                      className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 pl-8 pr-4 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                </div>

                <div className="bg-white/5 rounded-2xl p-4 flex flex-col items-center text-center border border-white/5 relative overflow-hidden group">
                  {/* Rainbow Border Animation */}
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_2s_infinite] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                  <div className="absolute -inset-[2px] bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500 rounded-2xl opacity-50 animate-[spin_4s_linear_infinite] blur-sm -z-10" />
                  <div className="absolute inset-0 bg-[#16181d] rounded-2xl -z-10" />

                  <p className="text-sm font-medium text-gray-300 mb-3 z-10">Scan to pay <span className="text-emerald-400 font-bold">₹{addAmount || 0}</span></p>
                  <div className="bg-white p-2 rounded-xl mb-4 z-10 shadow-xl">
                    <img 
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=upi://pay?pa=promarket.com@ybl&pn=AppStore&am=${addAmount || 0}&cu=INR`} 
                      alt="UPI QR Code" 
                      referrerPolicy="no-referrer"
                      onError={(e) => { e.currentTarget.src = 'https://picsum.photos/seed/qr/150/150'; }}
                      className="w-32 h-32"
                    />
                  </div>
                  <div className="space-y-1 text-xs text-gray-400 z-10">
                    <p>UPI ID: <span className="text-white font-medium select-all">promarket.com@ybl</span></p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Enter UTR / Reference No.</label>
                  <input 
                    required
                    type="text" 
                    value={utrNumber}
                    onChange={e => setUtrNumber(e.target.value)}
                    placeholder="12-digit UTR number"
                    className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 font-mono tracking-wider"
                  />
                  <p className="text-[10px] text-gray-500 mt-1.5">Enter the 12-digit UTR number after making the payment.</p>
                </div>

                {paymentStatus && (
                  <div className={`p-3 rounded-xl text-sm font-medium flex items-start gap-2 ${
                    paymentStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {paymentStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                    {paymentStatus.msg}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isSubmittingPayment || !utrNumber.trim() || paymentTimer === 0}
                  className={`w-full ${isSubmittingPayment || !utrNumber.trim() || paymentTimer === 0 ? 'bg-emerald-500/50 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'} text-white py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2`}
                >
                  {isSubmittingPayment ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Submit Request'
                  )}
                </button>
              </form>
            )}

            {walletTab === 'redeem' && (
              <form onSubmit={handleRedeem} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Redeem Gift Code</label>
                  <div className="relative">
                    <Gift className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input 
                      required
                      type="text" 
                      value={redeemCode}
                      onChange={e => setRedeemCode(e.target.value.toUpperCase())}
                      placeholder="Enter code (e.g. WELCOME50)"
                      className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-emerald-500 uppercase font-mono tracking-wider"
                    />
                  </div>
                </div>
                
                {redeemStatus && (
                  <div className={`p-3 rounded-xl text-sm font-medium flex items-start gap-2 ${
                    redeemStatus.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {redeemStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <AlertTriangle className="w-5 h-5 shrink-0" />}
                    {redeemStatus.msg}
                  </div>
                )}

                <button 
                  type="submit"
                  disabled={isRedeeming || !redeemCode.trim()}
                  className={`w-full ${isRedeeming || !redeemCode.trim() ? 'bg-emerald-500/50 cursor-not-allowed' : 'bg-emerald-500 hover:bg-emerald-600'} text-white py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2`}
                >
                  {isRedeeming ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    'Redeem Now'
                  )}
                </button>
                <p className="text-xs text-gray-500 text-center mt-4">
                  Try codes: WELCOME50, PROMO10, MEGA100
                </p>
              </form>
            )}

            {walletTab === 'history' && (
              <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {isLoadingPaymentHistory ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />
                    ))}
                  </div>
                ) : paymentHistory.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">No payment history found.</div>
                ) : (
                  paymentHistory.map(req => (
                    <div key={req.id} className="bg-white/5 border border-white/5 rounded-xl p-4 flex items-center justify-between">
                      <div>
                        <p className="font-bold text-white">₹{req.amount}</p>
                        <p className="text-xs text-gray-400 mt-1">UTR: {req.utr}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">{req.createdAt ? new Date(req.createdAt.toMillis()).toLocaleString() : 'Just now'}</p>
                      </div>
                      <div className={`px-3 py-1 rounded-full text-xs font-medium ${
                        req.status === 'approved' ? 'bg-emerald-500/20 text-emerald-400' :
                        req.status === 'rejected' ? 'bg-red-500/20 text-red-400' :
                        'bg-amber-500/20 text-amber-400'
                      }`}>
                        {typeof req.status === 'string' && req.status.length > 0 ? req.status.charAt(0).toUpperCase() + req.status.slice(1) : 'Pending'}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsMobileMenuOpen(false)} />
          <div className="relative w-[80%] max-w-sm bg-[#16181d] h-full border-r border-white/10 flex flex-col shadow-2xl">
            <div className="p-6 flex items-center justify-between border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                  <Download className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold tracking-tight">AppStore</span>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <nav className="flex-1 overflow-y-auto p-4 space-y-2">
              {[
                { name: 'Home', icon: Home },
                { name: 'Games', icon: Gamepad2 },
                { name: 'Apps', icon: LayoutGrid },
                { name: 'My Apps', icon: User },
                { name: 'Chat', icon: MessageSquare },
                { name: 'Offers', icon: Tag },
              ].map((item) => (
                <button 
                  key={item.name}
                  onClick={() => { setActiveTab(item.name); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all relative overflow-hidden ${
                    activeTab === item.name 
                      ? 'bg-indigo-500/10 text-indigo-400' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {activeTab === item.name && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                  )}
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium text-lg">{item.name}</span>
                </button>
              ))}

              {isAdmin && (
                <button 
                  onClick={() => { setActiveTab('Admin'); setIsMobileMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl transition-all relative overflow-hidden ${
                    activeTab === 'Admin' 
                      ? 'bg-red-500/10 text-red-400' 
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {activeTab === 'Admin' && (
                    <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500 rounded-r-full shadow-[0_0_8px_rgba(239,68,68,0.6)]" />
                  )}
                  <ShieldCheck className="w-5 h-5" />
                  <span className="font-medium text-lg">Admin Panel</span>
                </button>
              )}
            </nav>

            <div className="p-4 border-t border-white/5 space-y-4 bg-[#0f1115]/50">
              {user ? (
                <>
                  <div className="bg-white/5 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-gray-400">
                        <Wallet className="w-4 h-4" />
                        <span className="text-xs font-medium uppercase tracking-wider">Wallet</span>
                      </div>
                      {isProfileLoading ? (
                        <div className="h-5 bg-white/10 rounded w-16 animate-pulse" />
                      ) : (
                        <span className="text-sm font-bold text-emerald-400">₹{walletBalance.toFixed(2)}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => { setIsWalletModalOpen(true); setIsMobileMenuOpen(false); }}
                        className="flex-1 flex items-center justify-center gap-2 bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Add Money
                      </button>
                      <button 
                        onClick={() => {
                          setIsRainingMoney(true);
                          setTimeout(() => setIsRainingMoney(false), 5000);
                        }}
                        className="w-12 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white py-2 rounded-lg text-sm transition-colors"
                        title="Make it Rain"
                      >
                        💸
                      </button>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setIsModalOpen(true); setIsMobileMenuOpen(false); }}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white py-3.5 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20"
                  >
                    <Plus className="w-5 h-5" />
                    Publish App
                  </button>
                  <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
                    {isProfileLoading ? (
                      <div className="flex flex-1 items-center gap-3 animate-pulse">
                        <div className="w-10 h-10 rounded-full bg-white/10 shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="h-3 bg-white/10 rounded w-2/3" />
                          <div className="h-2 bg-white/5 rounded w-1/2" />
                        </div>
                      </div>
                    ) : (
                      <button 
                        onClick={() => { setIsProfileModalOpen(true); setIsMobileMenuOpen(false); }}
                        className="flex flex-1 items-center gap-3 text-left"
                      >
                        <img 
                          src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                          alt="Profile" 
                          referrerPolicy="no-referrer"
                          onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.displayName}`; }}
                          className="w-10 h-10 rounded-full border border-white/10"
                        />
                        <div className="flex-1 overflow-hidden">
                          <p className="text-sm font-medium truncate text-white">{userProfile?.displayName || user.displayName}</p>
                          <p className="text-xs text-gray-400 truncate">{user.email}</p>
                        </div>
                      </button>
                    )}
                    <button onClick={() => { handleLogout(); setIsMobileMenuOpen(false); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors" title="Log Out">
                      <LogOut className="w-5 h-5" />
                    </button>
                  </div>
                </>
              ) : (
                <button 
                  onClick={() => { handleLogin(); setIsMobileMenuOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 bg-white text-black py-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  <LogIn className="w-5 h-5" />
                  Sign In with Google
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Profile & History Modal */}
      {isProfileModalOpen && user && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-[#16181d] w-full max-w-2xl flex flex-col rounded-3xl border border-white/10 overflow-hidden shadow-2xl my-auto max-h-[90vh]">
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0 bg-gradient-to-r from-indigo-500/10 to-transparent">
              {isProfileLoading ? (
                <div className="flex items-center gap-4 animate-pulse">
                  <div className="w-14 h-14 rounded-full bg-white/10 shrink-0" />
                  <div className="space-y-2">
                    <div className="h-5 bg-white/10 rounded w-32" />
                    <div className="h-3 bg-white/5 rounded w-40" />
                    <div className="h-3 bg-white/5 rounded w-24" />
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <img 
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                    alt="Profile" 
                    referrerPolicy="no-referrer"
                    onError={(e) => { e.currentTarget.src = `https://ui-avatars.com/api/?name=${user.displayName}`; }}
                    className="w-14 h-14 rounded-full border-2 border-indigo-500/50 shadow-lg"
                  />
                  <div>
                    <h2 className="text-xl font-bold">{userProfile?.displayName || user.displayName}</h2>
                    <p className="text-sm text-gray-400">{user.email}</p>
                    {userProfile?.phoneNumber && (
                      <p className="text-xs text-indigo-400 mt-0.5">+91 {userProfile.phoneNumber}</p>
                    )}
                  </div>
                </div>
              )}
              <button onClick={() => setIsProfileModalOpen(false)} className="p-2 hover:bg-white/5 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              {/* Wallet Balance Card */}
              <div className="bg-gradient-to-br from-indigo-500/10 to-purple-600/10 border border-indigo-500/20 rounded-2xl p-5 mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <Wallet className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm text-indigo-300 font-medium mb-1">Current Balance</p>
                    {isProfileLoading ? (
                      <div className="h-8 bg-white/10 rounded w-24 animate-pulse" />
                    ) : (
                      <h3 className="text-2xl font-bold text-white">₹{walletBalance.toFixed(2)}</h3>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    setIsWalletModalOpen(true);
                    setWalletTab('add');
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Money
                </button>
              </div>

              <div className="flex items-center gap-2 mb-6">
                <History className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold">Purchase History</h3>
              </div>

              {isLoadingHistory ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-white/5 rounded-2xl animate-pulse" />
                  ))}
                </div>
              ) : purchaseHistory.length > 0 ? (
                <div className="space-y-4">
                  {purchaseHistory.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-4 rounded-2xl bg-[#0f1115] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                          <Download className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{tx.productTitle}</h4>
                          <p className="text-xs text-gray-400 mt-1">
                            {tx.createdAt ? new Date(tx.createdAt.toMillis()).toLocaleDateString('en-US', {
                              year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                            }) : 'Processing...'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-emerald-400">₹{tx.amount.toFixed(2)}</span>
                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mt-1">Paid</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 bg-[#0f1115] rounded-2xl border border-white/5">
                  <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mx-auto mb-4">
                    <History className="w-8 h-8 text-gray-500" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2">No purchases yet</h4>
                  <p className="text-sm text-gray-400 max-w-xs mx-auto">
                    Apps and games you buy will appear here.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Completion Modal */}
      {showProfileForm && user && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-[#16181d] w-full max-w-md flex flex-col rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-white/5 bg-gradient-to-r from-indigo-500/10 to-transparent">
              <h2 className="text-xl font-bold">Complete Your Profile</h2>
              <p className="text-sm text-gray-400 mt-1">Please provide your details to continue using the app.</p>
            </div>
            <form onSubmit={handleProfileSubmit} className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Full Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input 
                    required
                    type="text" 
                    value={profileName}
                    onChange={e => setProfileName(e.target.value)}
                    placeholder="Enter your name"
                    className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">+91</span>
                  <input 
                    required
                    type="tel" 
                    value={profilePhone}
                    onChange={e => setProfilePhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="10-digit mobile number"
                    maxLength={10}
                    minLength={10}
                    className="w-full bg-[#0f1115] border border-white/5 rounded-xl py-3 pl-14 pr-4 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <p className="text-[10px] text-gray-500 mt-1.5">This helps us verify your payments.</p>
              </div>
              <button 
                type="submit"
                disabled={isSavingProfile || profilePhone.length < 10 || !profileName.trim()}
                className={`w-full ${isSavingProfile || profilePhone.length < 10 || !profileName.trim() ? 'bg-indigo-500/50 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'} text-white py-3.5 rounded-xl font-bold transition-all flex items-center justify-center gap-2`}
              >
                {isSavingProfile ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  'Save Profile & Continue'
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmDialog?.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-[#16181d] w-full max-w-sm flex flex-col rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-2">{confirmDialog.title}</h3>
              <p className="text-gray-400 text-sm">{confirmDialog.message}</p>
            </div>
            <div className="p-4 border-t border-white/5 flex gap-3 bg-[#0f1115]/50">
              <button 
                onClick={() => setConfirmDialog(null)}
                className="flex-1 py-2.5 rounded-xl font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDialog.onConfirm}
                className="flex-1 py-2.5 rounded-xl font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-lg shadow-indigo-500/20"
              >
                {confirmDialog.confirmText || 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </ErrorBoundary>
  );
}


