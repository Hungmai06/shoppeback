import { create } from 'zustand';

export interface Order {
  id: string;
  productName: string;
  productImage: string;
  orderAmount: number;
  estimatedCashback: number;
  realCashback?: number;
  status: 'pending' | 'approved' | 'rejected' | 'returned' | 'paid';
  createdTime: string;
  userId: string;
  screenshot?: string;
  notes?: string;
}

export interface Withdrawal {
  id: string;
  userId: string;
  amount: number;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  status: 'pending' | 'approved' | 'rejected';
  requestDate: string;
  processedDate?: string;
  notes?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  telegramChatId: string;
  emailNotify: boolean;
  telegramNotify: boolean;
  role: 'user' | 'admin';
  status?: 'active' | 'locked';
  balance?: number;
  totalCashback?: number;
  pendingCashback?: number;
  referralEarnings?: number;
  referredBy?: string;
}

export interface Notification {
  id: string;
  title: string;
  content: string;
  time: string;
  read: boolean;
  type: 'order' | 'wallet' | 'system';
}

export interface SystemSettings {
  commissionPercentage: number;
  cashbackPercentage: number;
  telegramNotification: boolean;
  emailNotification: boolean;
  maintenanceMode: boolean;
  websiteName?: string;
  supportPhone?: string;
  supportZalo?: string;
  supportFacebook?: string;
  shopeeAffiliateId?: string;
}

export interface UserStats {
  pendingCashback: number;
  totalApprovedCashback100: number;
  approvedCashback: number;
  paidWithdrawals: number;
  pendingWithdrawals: number;
  availableBalance: number;
}

export interface AdminStats {
  summary: {
    totalUsers: number;
    totalOrders: number;
    totalPaidWithdrawals: number;
    platformTotalRevenue: number;
    platformTotalCashbackOwed?: number;
    netProfit: number;
  };
  statusDistribution: { name: string; value: number }[];
  monthlyAnalytics: { name: string; revenue: number; cashback: number; profit: number }[];
  dailyUserRegistrations?: { date: string; fullDate: string; count: number }[];
}

interface AppState {
  // Theme state
  theme: 'light' | 'dark';
  toggleTheme: () => void;

  // Auth state
  isAuthLoading: boolean;
  authInitialized: boolean;
  currentUser: UserProfile | null;
  users: UserProfile[];
  userStats: UserStats | null;
  adminStats: AdminStats | null;
  isAuthModalOpen: boolean;
  authModalMode: 'login' | 'register' | 'forgot' | 'reset';
  openAuthModal: (mode?: 'login' | 'register' | 'forgot' | 'reset') => void;
  closeAuthModal: () => void;
  setCurrentUser: (user: UserProfile | null) => void;
  initializeAuth: () => Promise<void>;
  login: (email: string, password: string) => Promise<UserProfile | null>;
  register: (name: string, email: string, password: string, referralCode?: string) => Promise<boolean>;
  logout: () => void;
  updateProfile: (profile: Partial<UserProfile>) => Promise<boolean>;

  // Orders state
  orders: Order[];
  totalAdminOrders: number;
  addOrder: (order: Order) => Promise<void>;
  updateOrderStatus: (id: string, status: Order['status'], realCashback?: number, notes?: string) => Promise<void>;
  uploadOrderScreenshot: (id: string, screenshotUrl: string) => void;

  // Withdrawals state
  withdrawals: Withdrawal[];
  addWithdrawalRequest: (amount: number, bankName: string, accountNumber: string, accountHolder: string) => Promise<{ success: boolean; message: string }>;
  updateWithdrawalStatus: (id: string, status: Withdrawal['status']) => Promise<void>;

  // Favorites state
  favorites: string[];
  toggleFavorite: (productId: string) => void;

  // Notifications state
  notifications: Notification[];
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => Promise<void>;
  addNotification: (title: string, content: string, type: Notification['type']) => void;

  // System Settings state
  settings: SystemSettings;
  updateSettings: (settings: Partial<SystemSettings>) => Promise<void>;

  // Reconciliation state
  reconciliationHistory: {
    id: string;
    fileName: string;
    uploadTime: string;
    totalRows: number;
    matchedCount: number;
    duplicateCount: number;
    invalidCount: number;
    missingCount: number;
  }[];
  addReconciliationLog: (log: AppState['reconciliationHistory'][0]) => void;

  // Fetch helpers
  fetchUserOrders: () => Promise<void>;
  fetchUserWithdrawals: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
  fetchAdminOrders: (page?: number, limit?: number, search?: string, status?: string) => Promise<void>;
  fetchAdminWithdrawals: () => Promise<void>;
  fetchAdminUsers: () => Promise<void>;
  fetchAdminStats: () => Promise<void>;
  fetchReconciliationLogs: () => Promise<void>;
  uploadReconciliationCSV: (file: File) => Promise<any>;
  applyReconciliationCSV: (tempFileName: string) => Promise<any>;
  updateAdminUser: (id: string, userData: Partial<UserProfile>) => Promise<boolean>;
  createAdminUser: (userData: { name: string; email: string; password: string; role: 'user' | 'admin'; phone?: string }) => Promise<boolean>;
  deleteAdminUser: (id: string) => Promise<boolean>;
  resetUserPassword: (id: string, newPassword?: string) => Promise<boolean>;
  toggleUserStatus: (id: string) => Promise<'active' | 'locked' | null>;
}

const API_BASE = import.meta.env.VITE_API_BASE || '/api';

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const useAppStore = create<AppState>((set, get) => ({
  theme: 'light',
  toggleTheme: () => set((state) => {
    const nextTheme = state.theme === 'light' ? 'dark' : 'light';
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    return { theme: nextTheme };
  }),

  isAuthLoading: !!localStorage.getItem('token'),
  authInitialized: false,
  currentUser: null,
  users: [],
  userStats: null,
  adminStats: null,
  isAuthModalOpen: false,
  authModalMode: 'login',
  openAuthModal: (mode = 'login') => set({ isAuthModalOpen: true, authModalMode: mode }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),
  orders: [],
  totalAdminOrders: 0,
  withdrawals: [],
  notifications: [],
  reconciliationHistory: [],
  favorites: [],

  setCurrentUser: (user) => set({ currentUser: user }),

  initializeAuth: async () => {
    const token = localStorage.getItem('token');
    if (token) {
      set({ isAuthLoading: true });
    }

    // 1. Fetch public system settings & user profile concurrently if token exists
    const settingsPromise = fetch(`${API_BASE}/settings`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          set({ settings: data });
        }
      })
      .catch((error) => console.error('Fetch settings failed:', error));

    if (!token) {
      await settingsPromise;
      set({ isAuthLoading: false, authInitialized: true });
      return;
    }

    try {
      const [profileRes] = await Promise.all([
        fetch(`${API_BASE}/auth/profile`, { headers: getHeaders() }),
        settingsPromise
      ]);

      if (profileRes.ok) {
        const data = await profileRes.json();
        set({
          currentUser: data.profile,
          userStats: data.stats,
          isAuthLoading: false,
          authInitialized: true
        });

        // Load personal data & admin data in parallel without blocking UI
        const loadPromises: Promise<any>[] = [
          get().fetchUserOrders(),
          get().fetchUserWithdrawals(),
          get().fetchNotifications()
        ];

        if (data.profile.role === 'admin') {
          loadPromises.push(
            get().fetchAdminOrders(),
            get().fetchAdminWithdrawals(),
            get().fetchAdminUsers(),
            get().fetchAdminStats(),
            get().fetchReconciliationLogs()
          );
        }

        Promise.allSettled(loadPromises);
      } else {
        // Try auto-refreshing token using refreshToken
        const savedRefreshToken = localStorage.getItem('refreshToken');
        if (savedRefreshToken) {
          try {
            const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: savedRefreshToken })
            });

            if (refreshRes.ok) {
              const refreshData = await refreshRes.json();
              localStorage.setItem('token', refreshData.token);
              if (refreshData.refreshToken) {
                localStorage.setItem('refreshToken', refreshData.refreshToken);
              }
              // Retry fetching profile with new token
              const retryRes = await fetch(`${API_BASE}/auth/profile`, {
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${refreshData.token}`
                }
              });

              if (retryRes.ok) {
                const data = await retryRes.json();
                set({
                  currentUser: data.profile,
                  userStats: data.stats,
                  isAuthLoading: false,
                  authInitialized: true
                });
                return;
              }
            }
          } catch (rfErr) {
            console.error('Silent token refresh failed:', rfErr);
          }
        }

        // Token completely invalid
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        set({ currentUser: null, userStats: null, isAuthLoading: false, authInitialized: true });
      }
    } catch (error) {
      console.error('Initialize auth error:', error);
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      set({ currentUser: null, userStats: null, isAuthLoading: false, authInitialized: true });
    }
  },

  login: async (email, password) => {
    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        
        // Update user state immediately for instant UI response (<100ms)
        set({
          currentUser: data.user,
          isAuthLoading: false,
          authInitialized: true
        });

        // Background non-blocking sync of orders, wallet, notifications and stats
        const bgPromises: Promise<any>[] = [
          get().fetchUserOrders(),
          get().fetchUserWithdrawals(),
          get().fetchNotifications(),
          fetch(`${API_BASE}/auth/profile`, { headers: { 'Authorization': `Bearer ${data.token}` } })
            .then(r => r.ok ? r.json() : null)
            .then(pData => {
              if (pData) {
                set({ currentUser: pData.profile, userStats: pData.stats });
              }
            })
            .catch(() => {})
        ];

        if (data.user.role === 'admin') {
          bgPromises.push(
            get().fetchAdminOrders(),
            get().fetchAdminWithdrawals(),
            get().fetchAdminUsers(),
            get().fetchAdminStats(),
            get().fetchReconciliationLogs()
          );
        }

        Promise.allSettled(bgPromises);

        return data.user as UserProfile;
      }
      return null;
    } catch (error) {
      console.error('Login API error:', error);
      return null;
    }
  },

  register: async (name, email, password, referralCode) => {
    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, referralCode })
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('token', data.token);
        if (data.refreshToken) {
          localStorage.setItem('refreshToken', data.refreshToken);
        }
        
        set({
          currentUser: data.user,
          isAuthLoading: false,
          authInitialized: true
        });

        // Trigger background initial data loading
        Promise.allSettled([
          get().fetchUserOrders(),
          get().fetchUserWithdrawals(),
          get().fetchNotifications()
        ]);

        return true;
      }
      return false;
    } catch (error) {
      console.error('Register API error:', error);
      return false;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('admin_active_tab');
    set({
      currentUser: null,
      userStats: null,
      adminStats: null,
      orders: [],
      totalAdminOrders: 0,
      withdrawals: [],
      notifications: [],
      users: [],
      isAuthLoading: false,
      authInitialized: true
    });
  },

  updateProfile: async (profile) => {
    try {
      const res = await fetch(`${API_BASE}/auth/profile`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(profile)
      });

      if (res.ok) {
        const data = await res.json();
        set({ currentUser: data.user });
        return true;
      }
      return false;
    } catch (error) {
      console.error('Update profile API error:', error);
      return false;
    }
  },

  // Orders
  fetchUserOrders: async () => {
    try {
      const res = await fetch(`${API_BASE}/orders/user`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const mappedOrders = data.map((o: any) => ({
          id: o.id,
          productName: o.product_name,
          productImage: o.product_image,
          orderAmount: o.order_amount,
          estimatedCashback: o.estimated_cashback,
          realCashback: o.real_cashback || undefined,
          status: o.status,
          createdTime: o.created_at,
          userId: o.user_id,
          notes: o.notes || undefined
        }));
        set({ orders: mappedOrders });
      }
    } catch (error) {
      console.error('Fetch user orders error:', error);
    }
  },

  addOrder: async (order) => {
    try {
      await fetch(`${API_BASE}/orders/create`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({
          id: order.id,
          productName: order.productName,
          productImage: order.productImage,
          orderAmount: order.orderAmount,
          estimatedCashback: order.estimatedCashback,
          clickId: order.id
        })
      });
      // Visual feedback: temporarily append to state so it renders instantly
      set((state) => {
        const exists = state.orders.some(o => o.id === order.id);
        return { orders: exists ? state.orders : [order, ...state.orders] };
      });
      // Refresh persistent list from server
      await get().fetchUserOrders();
    } catch (error) {
      console.error('Add order error:', error);
      set((state) => ({ orders: [order, ...state.orders] }));
    }
  },

  updateOrderStatus: async (id, status, realCashback, notes) => {
    try {
      const res = await fetch(`${API_BASE}/orders/admin/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status, realCashback, notes })
      });

      if (res.ok) {
        await get().fetchAdminOrders();
        await get().fetchAdminStats();
      }
    } catch (error) {
      console.error('Update order status error:', error);
    }
  },

  uploadOrderScreenshot: (id, screenshotUrl) => {
    // Keep local client state screenshot update
    set((state) => ({
      orders: state.orders.map(o => o.id === id ? { ...o, screenshot: screenshotUrl } : o)
    }));
  },

  // Withdrawals
  fetchUserWithdrawals: async () => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals/user`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        set({ withdrawals: data });
      }
    } catch (error) {
      console.error('Fetch user withdrawals error:', error);
    }
  },

  addWithdrawalRequest: async (amount, bankName, accountNumber, accountHolder) => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals/request`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ amount, bankName, accountNumber, accountHolder })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await get().fetchUserWithdrawals();
        await get().initializeAuth(); // refresh wallet stats
        return { success: true, message: data.message || 'Yêu cầu rút tiền đã được gửi thành công' };
      }
      return { success: false, message: data.message || 'Không thể tạo yêu cầu rút tiền' };
    } catch (error: any) {
      console.error('Add withdrawal error:', error);
      return { success: false, message: error.message || 'Lỗi kết nối máy chủ' };
    }
  },

  updateWithdrawalStatus: async (id, status) => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals/admin/${id}/status`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        await get().fetchAdminWithdrawals();
        await get().fetchAdminStats();
      }
    } catch (error) {
      console.error('Update withdrawal status error:', error);
    }
  },

  // Favorites
  toggleFavorite: (productId) => set((state) => {
    const isFav = state.favorites.includes(productId);
    const newFavs = isFav
      ? state.favorites.filter(id => id !== productId)
      : [...state.favorites, productId];
    return { favorites: newFavs };
  }),

  // Notifications
  fetchNotifications: async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/notifications`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        set({ notifications: data });
      }
    } catch (error) {
      console.error('Fetch notifications error:', error);
    }
  },

  markNotificationAsRead: async (id) => {
    // Keep client-side state responsive
    set((state) => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n)
    }));
  },

  markAllNotificationsAsRead: async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/notifications/read`, {
        method: 'PUT',
        headers: getHeaders()
      });

      if (res.ok) {
        await get().fetchNotifications();
      }
    } catch (error) {
      console.error('Mark all notification as read error:', error);
    }
  },

  addNotification: (title, content, type) => {
    set((state) => ({
      notifications: [
        {
          id: `NT${Date.now()}`,
          title,
          content,
          time: 'Vừa xong',
          read: false,
          type
        },
        ...state.notifications
      ]
    }));
  },

  // Settings
  settings: {
    commissionPercentage: 10,
    cashbackPercentage: 50,
    telegramNotification: true,
    emailNotification: true,
    maintenanceMode: false,
    websiteName: "Hoàn Tiền Mua Sắm",
    supportPhone: "0988.888.888",
    supportZalo: "https://zalo.me/g/hoantienmuasam",
    supportFacebook: "https://facebook.com/hoantienmuasam",
    shopeeAffiliateId: "173401900099",
  },

  updateSettings: async (newSettings) => {
    try {
      const res = await fetch(`${API_BASE}/settings/admin`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(newSettings)
      });

      if (res.ok) {
        set((state) => ({
          settings: { ...state.settings, ...newSettings }
        }));
      }
    } catch (error) {
      console.error('Update settings API error:', error);
    }
  },

  // Admin and reconciliation fetches
  fetchAdminOrders: async (page = 1, limit = 10, search = '', status = 'all') => {
    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString()
      });
      if (search) queryParams.append('search', search);
      if (status && status !== 'all') queryParams.append('status', status);

      const res = await fetch(`${API_BASE}/orders/admin?${queryParams.toString()}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const ordersList = Array.isArray(data.orders) ? data.orders : (Array.isArray(data) ? data : []);
        const mappedOrders = ordersList.map((o: any) => ({
          id: o.id || o.order_id,
          productName: o.product_name || o.productName || 'Sản phẩm Shopee',
          productImage: o.product_image || o.productImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&q=80&w=200',
          orderAmount: Number(o.order_amount || o.orderAmount || 0),
          estimatedCashback: Number(o.estimated_cashback !== undefined ? o.estimated_cashback : (o.estimatedCashback || Math.round((o.commission || 0) * 0.5))),
          realCashback: o.real_cashback !== undefined ? Number(o.real_cashback) : (o.realCashback !== undefined ? Number(o.realCashback) : undefined),
          status: o.status || 'pending',
          createdTime: o.created_at || o.order_time || o.createdTime || new Date().toISOString(),
          userId: o.user_id || o.userId,
          notes: o.notes || undefined
        }));
        set({
          orders: mappedOrders,
          totalAdminOrders: data.pagination ? data.pagination.total : mappedOrders.length
        });
      }
    } catch (error) {
      console.error('Fetch admin orders error:', error);
    }
  },

  fetchAdminWithdrawals: async () => {
    try {
      const res = await fetch(`${API_BASE}/withdrawals/admin`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        set({ withdrawals: data });
      }
    } catch (error) {
      console.error('Fetch admin withdrawals error:', error);
    }
  },

  fetchAdminUsers: async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        set({ users: data });
      }
    } catch (error) {
      console.error('Fetch admin users error:', error);
    }
  },

  updateAdminUser: async (id, userData) => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users/${id}`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify(userData)
      });

      if (res.ok) {
        await get().fetchAdminUsers();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Update admin user API error:', error);
      return false;
    }
  },

  createAdminUser: async (userData) => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(userData)
      });
      if (res.ok) {
        await get().fetchAdminUsers();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Create admin user error:', error);
      return false;
    }
  },

  deleteAdminUser: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (res.ok) {
        await get().fetchAdminUsers();
        return true;
      }
      return false;
    } catch (error) {
      console.error('Delete admin user error:', error);
      return false;
    }
  },

  resetUserPassword: async (id, newPassword) => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users/${id}/reset-password`, {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ newPassword: newPassword || '123456' })
      });
      return res.ok;
    } catch (error) {
      console.error('Reset password error:', error);
      return false;
    }
  },

  toggleUserStatus: async (id) => {
    try {
      const res = await fetch(`${API_BASE}/auth/admin/users/${id}/toggle-status`, {
        method: 'PUT',
        headers: getHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        await get().fetchAdminUsers();
        return data.status as 'active' | 'locked';
      }
      return null;
    } catch (error) {
      console.error('Toggle user status error:', error);
      return null;
    }
  },

  fetchAdminStats: async () => {
    try {
      const res = await fetch(`${API_BASE}/settings/admin/stats`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        set({ adminStats: data });
      }
    } catch (error) {
      console.error('Fetch admin stats error:', error);
    }
  },

  fetchReconciliationLogs: async () => {
    try {
      const res = await fetch(`${API_BASE}/reconciliation/logs`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        const mappedLogs = data.map((log: any) => ({
          id: log.id,
          fileName: log.file_name,
          uploadTime: log.upload_time,
          totalRows: log.total_rows,
          matchedCount: log.matched_count,
          duplicateCount: log.duplicate_count,
          invalidCount: log.invalid_count,
          missingCount: log.missing_count
        }));
        set({ reconciliationHistory: mappedLogs });
      }
    } catch (error) {
      console.error('Fetch reconciliation logs error:', error);
    }
  },

  uploadReconciliationCSV: async (file) => {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');

    try {
      const res = await fetch(`${API_BASE}/reconciliation/upload`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: formData
      });

      if (res.ok) {
        return await res.json();
      }
      throw new Error('Upload file đối soát thất bại');
    } catch (error) {
      console.error('Upload reconciliation error:', error);
      throw error;
    }
  },

  applyReconciliationCSV: async (tempFileName) => {
    try {
      const res = await fetch(`${API_BASE}/reconciliation/apply`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ tempFileName })
      });

      if (res.ok) {
        const data = await res.json();
        await get().fetchReconciliationLogs();
        await get().fetchAdminOrders();
        await get().fetchAdminStats();
        return data;
      }
      throw new Error('Áp dụng đối soát thất bại');
    } catch (error) {
      console.error('Apply reconciliation error:', error);
      throw error;
    }
  },

  addReconciliationLog: (log) => set((state) => ({
    reconciliationHistory: [log, ...state.reconciliationHistory]
  }))
}));
