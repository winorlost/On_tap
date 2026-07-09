// ==================== STATE ====================
let state = {
  token: localStorage.getItem('token') || '',
  user: null,
  currentPage: 'home',
  currentSubject: null,
  subjects: [],
  musicList: [],
  currentMusicIndex: -1,
  audio: new Audio(),
  isPlaying: false,
  examMode: false,
  examQuestions: [],
  examAnswers: {},
  examTimer: null,
  examTimeLeft: 0,
  notifCount: 0,
  calendarEvents: [],
  sidebarCollapsed: false,
  loginTime: null,
  visitCount: 0,
  totalStudyMinutes: 0
};

// ==================== INIT ====================
document.addEventListener('DOMContentLoaded', async () => {
  // Disable right-click
  document.addEventListener('contextmenu', e => e.preventDefault());
  
  // Disable keyboard shortcuts for dev tools
  document.addEventListener('keydown', e => {
    // F12
    if (e.key === 'F12') {
      e.preventDefault();
      return false;
    }
    // Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) {
      e.preventDefault();
      return false;
    }
    // Ctrl+U (view source)
    if (e.ctrlKey && e.key.toUpperCase() === 'U') {
      e.preventDefault();
      return false;
    }
  });

  // Create sidebar overlay for mobile
  const overlay = document.createElement('div');
  overlay.className = 'sidebar-overlay';
  overlay.id = 'sidebar-overlay';
  overlay.onclick = () => toggleSidebar();
  document.body.appendChild(overlay);

  // Auth tabs
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab + '-form').classList.add('active');
    });
  });

  // Enter key for login
  document.getElementById('login-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('login-username').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Enter key for register
  document.getElementById('register-confirm').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleRegister();
  });
  document.getElementById('register-password').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleRegister();
  });
  document.getElementById('register-username').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleRegister();
  });

  // Sidebar menu toggle - only one submenu open at a time
  document.querySelectorAll('[data-toggle]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const parent = el.closest('.menu-has-sub');
      const toggleId = el.dataset.toggle;
      // Close all other submenus
      document.querySelectorAll('.menu-has-sub.open').forEach(s => {
        const sToggle = s.querySelector('[data-toggle]');
        if (sToggle && sToggle.dataset.toggle !== toggleId) {
          s.classList.remove('open');
        }
      });
      // Toggle current
      parent.classList.toggle('open');
    });
  });

  // Sidebar navigation - auto-close submenu after click
  document.querySelectorAll('.menu-item[data-page]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const page = el.dataset.page;
      const subject = el.dataset.subject;
      navigateTo(page, subject);
      // Auto-close the parent submenu after selecting a subject
      const parent = el.closest('.menu-has-sub');
      if (parent) {
        parent.classList.remove('open');
      }
      // If sidebar is collapsed, auto-collapse it
      if (state.sidebarCollapsed && window.innerWidth > 768) {
        // Show submenu popup then auto-collapse
        setTimeout(() => {
          const sidebar = document.getElementById('sidebar');
          sidebar.classList.remove('collapsed');
          state.sidebarCollapsed = false;
          const toggleBtn = document.querySelector('.sidebar-toggle');
          toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
          checkCollapsibleVisibility();
        }, 100);
      }
    });
  });

  // Close dropdown panels when clicking outside
  document.addEventListener('click', (e) => {
    const notifPanel = document.getElementById('notif-panel');
    const accountPopup = document.getElementById('account-popup');
    const notifBtn = document.getElementById('notif-btn');
    const sidebarUser = document.querySelector('.sidebar-user');
    
    if (notifPanel.style.display !== 'none' && !notifPanel.contains(e.target) && !notifBtn.contains(e.target)) {
      notifPanel.style.display = 'none';
    }
    if (accountPopup.style.display !== 'none' && !accountPopup.contains(e.target) && !sidebarUser.contains(e.target)) {
      accountPopup.style.display = 'none';
    }
  });

  // Check auth
  if (state.token) {
    try {
      const res = await fetch('/api/me', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      if (res.ok) {
        state.user = await res.json();
        showApp();
        return;
      }
    } catch (e) {}
    state.token = '';
    localStorage.removeItem('token');
  }
  showLogin();
});

// ==================== AUTH ====================
function showLogin() {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
}

function showApp() {
  document.getElementById('loading-screen').classList.add('hidden');
  document.getElementById('login-page').style.display = 'none';
  document.getElementById('main-app').style.display = 'block';
  
  updateUserDisplay();
  state.loginTime = Date.now();
  
  if (state.user.role === 'admin') {
    document.body.classList.add('role-admin');
  } else {
    document.body.classList.remove('role-admin');
  }
  
  loadSubjects();
  navigateTo('home');
  startNotifPolling();
  initMusicPlayerDrag();
  startClock();
  trackVisit();
  
  // Add footer
  addFooter();
}

function updateUserDisplay() {
  document.getElementById('sidebar-username').textContent = state.user.username;
  document.getElementById('sidebar-role').textContent = state.user.role;
  document.getElementById('popup-username').textContent = state.user.username;
  document.getElementById('popup-role').textContent = state.user.role;
  
  // Avatar
  const avatarText = document.getElementById('avatar-text');
  const avatarImg = document.getElementById('avatar-img');
  
  if (state.user.avatar) {
    avatarImg.src = state.user.avatar;
    avatarImg.style.display = 'block';
    avatarText.style.display = 'none';
  } else {
    avatarImg.style.display = 'none';
    avatarText.textContent = state.user.username.charAt(0).toUpperCase();
    avatarText.style.display = 'flex';
  }
}

async function handleLogin() {
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  
  if (!username || !password) {
    errorEl.textContent = 'Vui lòng nhập đầy đủ thông tin';
    return;
  }
  
  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      state.token = data.token;
      localStorage.setItem('token', data.token);
      state.user = { id: data.id, username: data.username, role: data.role, avatar: data.avatar || '' };
      showApp();
    } else {
      errorEl.textContent = data.error || 'Đăng nhập thất bại';
    }
  } catch (e) {
    errorEl.textContent = 'Lỗi kết nối server';
  }
}

async function handleRegister() {
  const username = document.getElementById('register-username').value.trim();
  const password = document.getElementById('register-password').value;
  const confirm = document.getElementById('register-confirm').value;
  const errorEl = document.getElementById('register-error');
  
  if (!username || !password) {
    errorEl.textContent = 'Vui lòng nhập đầy đủ thông tin';
    return;
  }
  if (password !== confirm) {
    errorEl.textContent = 'Mật khẩu không khớp';
    return;
  }
  if (password.length < 6) {
    errorEl.textContent = 'Mật khẩu phải có ít nhất 6 ký tự';
    return;
  }
  
  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Đăng ký thành công! Vui lòng đăng nhập.', 'success');
      document.querySelector('.auth-tab[data-tab="login"]').click();
      document.getElementById('login-username').value = username;
    } else {
      errorEl.textContent = data.error || 'Đăng ký thất bại';
    }
  } catch (e) {
    errorEl.textContent = 'Lỗi kết nối server';
  }
}

async function handleLogout() {
  try {
    await api('/api/logout', { method: 'POST' });
  } catch (e) {}
  state.token = '';
  localStorage.removeItem('token');
  state.user = null;
  state.musicList = [];
  state.audio.pause();
  document.getElementById('login-page').style.display = 'flex';
  document.getElementById('main-app').style.display = 'none';
  document.getElementById('login-username').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-error').textContent = '';
  document.getElementById('account-popup').style.display = 'none';
}

function toggleAccountPopup(event) {
  event.stopPropagation();
  const popup = document.getElementById('account-popup');
  popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
}

function showAvatarUpload() {
  document.getElementById('account-popup').style.display = 'none';
  
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>📷 Đổi avatar</h3>
      <div class="avatar-upload-area">
        <div class="avatar-preview">
          <div class="avatar-placeholder" id="avatar-preview-placeholder">
            <i class="fas fa-user-circle"></i>
          </div>
          <img id="avatar-preview-img" src="" style="display:none">
        </div>
        <input type="file" id="avatar-file-input" accept="image/*" style="display:none">
        <div class="form-row">
          <button class="btn btn-secondary" onclick="document.getElementById('avatar-file-input').click()">
            <i class="fas fa-folder-open"></i> Chọn ảnh
          </button>
          <button class="btn btn-primary" onclick="uploadAvatar()">
            <i class="fas fa-upload"></i> Lưu
          </button>
        </div>
        <div style="margin-top:8px">
          <button class="btn btn-sm btn-danger" onclick="removeAvatar()">
            <i class="fas fa-trash"></i> Xóa avatar
          </button>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  document.getElementById('avatar-file-input').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(ev) {
        document.getElementById('avatar-preview-placeholder').style.display = 'none';
        const img = document.getElementById('avatar-preview-img');
        img.src = ev.target.result;
        img.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  });
}

async function removeAvatar() {
  if (!confirm('Xóa avatar và đặt lại mặc định?')) return;
  try {
    const data = await api('/api/avatar', {
      method: 'POST',
      body: JSON.stringify({ avatar_url: '' })
    });
    if (data.success) {
      state.user.avatar = '';
      updateUserDisplay();
      showToast('Đã xóa avatar!', 'success');
      document.querySelector('.modal-overlay').remove();
    }
  } catch (e) {
    showToast('Lỗi xóa avatar', 'error');
  }
}

async function uploadAvatar() {
  const fileInput = document.getElementById('avatar-file-input');
  if (!fileInput.files.length) {
    showToast('Vui lòng chọn ảnh', 'warning');
    return;
  }
  
  const file = fileInput.files[0];
  const base64 = await fileToBase64(file);
  const ext = '.' + file.name.split('.').pop();
  
  try {
    const uploadData = await api('/api/upload', {
      method: 'POST',
      body: JSON.stringify({ file: base64, ext: ext, type: 'avatar' })
    });
    
    if (uploadData.success) {
      const data = await api('/api/avatar', {
        method: 'POST',
        body: JSON.stringify({ avatar_url: uploadData.url })
      });
      if (data.success) {
        state.user.avatar = data.avatar;
        updateUserDisplay();
        showToast('Đã cập nhật avatar!', 'success');
        document.querySelector('.modal-overlay').remove();
      }
    }
  } catch (e) {
    showToast('Lỗi upload ảnh', 'error');
  }
}

// ==================== CLOCK ====================
function startClock() {
  updateClock();
  setInterval(updateClock, 1000);
}

function updateClock() {
  const el = document.getElementById('digital-clock');
  if (!el) return;
  const now = new Date();
  const h = now.getHours().toString().padStart(2, '0');
  const m = now.getMinutes().toString().padStart(2, '0');
  const s = now.getSeconds().toString().padStart(2, '0');
  el.textContent = `${h}:${m}:${s}`;
}

// ==================== FOOTER & FEEDBACK ====================
function addFooter() {
  const mainContent = document.getElementById('main-content');
  let footer = document.getElementById('copyright-footer');
  if (footer) return;
  
  footer = document.createElement('footer');
  footer.id = 'copyright-footer';
  footer.style.cssText = 'text-align:center;padding:16px 24px;border-top:1px solid var(--border);display:flex;align-items:center;justify-content:center;gap:16px;flex-wrap:wrap;font-size:13px;color:var(--text-muted)';
  footer.innerHTML = `
    <span>Tạo ra bởi WoL © 2026</span>
    <button class="btn btn-sm btn-secondary" onclick="showFeedback()" style="font-size:12px;padding:4px 14px"><i class="fas fa-comment"></i> Phản hồi</button>
  `;
  mainContent.appendChild(footer);
}

function showFeedback() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:500px">
      <h3>📩 Gửi phản hồi</h3>
      <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px">
        Đóng góp ý kiến của bạn để giúp chúng tôi cải thiện trang web tốt hơn!
      </p>
      <textarea id="feedback-text" placeholder="Nhập ý kiến của bạn..." style="width:100%;min-height:120px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit;resize:vertical;outline:none;margin-bottom:16px"></textarea>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
        <button class="btn btn-primary" onclick="sendFeedback()"><i class="fas fa-paper-plane"></i> Gửi phản hồi</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function sendFeedback() {
  const message = document.getElementById('feedback-text').value.trim();
  if (!message) {
    showToast('Vui lòng nhập nội dung phản hồi', 'warning');
    return;
  }
  
  try {
    const data = await api('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
    if (data.success) {
      showToast('Đã gửi phản hồi đến admin!', 'success');
      document.querySelector('.modal-overlay').remove();
    }
  } catch (e) {
    showToast('Lỗi gửi phản hồi', 'error');
  }
}

// ==================== VISIT TRACKING ====================
async function trackVisit() {
  try {
    // Increment visit count on server
    const data = await api('/api/sessions', { method: 'POST' });
    if (data.success) {
      state.visitCount = data.total_sessions || 0;
      state.totalStudyMinutes = data.total_minutes || 0;
    }
  } catch (e) {}
}

// ==================== NAVIGATION ====================
function navigateTo(page, subject) {
  state.currentPage = page;
  state.currentSubject = subject || null;
  
  // Close dropdown panels
  document.getElementById('notif-panel').style.display = 'none';
  
  // Update active menu
  document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll(`.menu-item[data-page="${page}"]`).forEach(el => {
    el.classList.add('active');
  });
  
  // Update title
  const titles = {
    home: 'Trang chủ',
    theory: 'Lý thuyết',
    practice: 'Luyện đề',
    music: 'Nhạc',
    ranking: 'BXH cá nhân',
    calendar: 'Lịch',
    'admin-panel': 'Admin Panel'
  };
  document.getElementById('page-title').textContent = titles[page] || 'Trang chủ';
  
  // Render page
  const content = document.getElementById('content-area');
  switch (page) {
    case 'home': renderHome(content); break;
    case 'theory': renderTheory(content); break;
    case 'practice': renderPractice(content); break;
    case 'music': renderMusic(content); break;
    case 'ranking': renderRanking(content); break;
    case 'calendar': renderCalendar(content); break;
    case 'admin-panel': renderAdminPanel(content); break;
    default: renderHome(content);
  }
  
  // Close sidebar on mobile
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('active');
  }
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  
  if (window.innerWidth <= 768) {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('active');
  } else {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    sidebar.classList.toggle('collapsed');
    const toggleBtn = document.querySelector('.sidebar-toggle');
    if (state.sidebarCollapsed) {
      toggleBtn.innerHTML = '<i class="fas fa-chevron-right"></i>';
    } else {
      toggleBtn.innerHTML = '<i class="fas fa-bars"></i>';
    }
    checkCollapsibleVisibility();
  }
}

function checkCollapsibleVisibility() {
  // When collapsed, submenus should show as popup
  const subMenus = document.querySelectorAll('.sub-menu');
  subMenus.forEach(menu => {
    if (state.sidebarCollapsed) {
      menu.style.position = 'fixed';
      menu.style.left = '70px';
      menu.style.top = 'auto';
      menu.style.width = '200px';
      menu.style.background = 'var(--bg-card)';
      menu.style.border = '1px solid var(--border)';
      menu.style.borderRadius = 'var(--radius-sm)';
      menu.style.boxShadow = 'var(--shadow)';
      menu.style.padding = '8px';
      menu.style.zIndex = '300';
    } else {
      menu.style.position = '';
      menu.style.left = '';
      menu.style.top = '';
      menu.style.width = '';
      menu.style.background = '';
      menu.style.border = '';
      menu.style.borderRadius = '';
      menu.style.boxShadow = '';
      menu.style.padding = '';
      menu.style.zIndex = '';
    }
  });
}

// ==================== API HELPER ====================
async function api(path, options = {}) {
  const headers = { 'Authorization': `Bearer ${state.token}`, ...options.headers };
  if (!options.noJson) headers['Content-Type'] = 'application/json';
  
  const res = await fetch(path, {
    ...options,
    headers
  });
  return res.json();
}

// ==================== TOAST ====================
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== NOTIFICATIONS POLLING ====================
function startNotifPolling() {
  updateNotifBadge();
  setInterval(updateNotifBadge, 15000);
}

async function updateNotifBadge() {
  try {
    const data = await api('/api/notifications/unread-count');
    const badge = document.getElementById('notif-badge');
    if (data.count > 0) {
      badge.textContent = data.count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {}
}

// ==================== DROPDOWN PANELS ====================
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    loadNotifPanel();
  } else {
    panel.style.display = 'none';
  }
}

async function loadNotifPanel() {
  const list = document.getElementById('notif-panel-list');
  try {
    const notifs = await api('/api/notifications');
    if (notifs.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Không có thông báo</p>';
      return;
    }
    list.innerHTML = notifs.slice(0, 10).map(n => `
      <div class="notif-item ${!n.is_read ? 'unread' : ''}" onclick="markNotifRead(${n.id})">
        <div class="notif-content" style="flex:1">
          <div class="notif-message">${escapeHtml(n.message)}</div>
          <div class="notif-time">${formatDate(n.created_at)}</div>
        </div>
        <button class="btn-icon" onclick="event.stopPropagation();deleteNotification(${n.id})" title="Xóa" style="width:28px;height:28px;font-size:11px;flex-shrink:0"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  } catch (e) {
    list.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:20px">Lỗi tải</p>';
  }
}

async function deleteNotification(id) {
  try {
    await api(`/api/notifications/${id}`, { method: 'DELETE' });
    showToast('Đã xóa thông báo', 'success');
    loadNotifPanel();
    loadNotifications();
    updateNotifBadge();
  } catch (e) {
    showToast('Lỗi xóa', 'error');
  }
}

// ==================== SUBJECTS ====================
async function loadSubjects() {
  try {
    state.subjects = await api('/api/subjects');
  } catch (e) {
    state.subjects = [];
  }
}

function getSubjectName(id) {
  const s = state.subjects.find(s => s.id == id);
  return s ? s.name : 'Unknown';
}

// ==================== IMAGE VIEWER ====================
function showImageViewer(src) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cursor = 'zoom-out';
  overlay.onclick = () => overlay.remove();
  overlay.innerHTML = `
    <div style="max-width:90vw;max-height:90vh;display:flex;align-items:center;justify-content:center" onclick="event.stopPropagation()">
      <img src="${src}" style="max-width:90vw;max-height:90vh;border-radius:8px;box-shadow:0 0 40px rgba(0,0,0,0.5);object-fit:contain">
    </div>
  `;
  document.body.appendChild(overlay);
}

// ==================== HOME ====================
function renderHome(container) {
  container.innerHTML = `
    <div class="home-hero">
      <h1>Chào mừng <span>${state.user.username}</span> 👋</h1>
      <p>Học tập thông minh, hiệu quả hơn mỗi ngày</p>
    </div>
    <div class="home-cards">
      <div class="home-card" onclick="navigateTo('theory', 1)">
        <div class="home-card-icon"><i class="fas fa-book-open"></i></div>
        <h3>Lý thuyết</h3>
        <p>Ôn tập kiến thức các môn học với nội dung chi tiết, hình ảnh và file đính kèm</p>
      </div>
      <div class="home-card" onclick="navigateTo('practice', 1)">
        <div class="home-card-icon"><i class="fas fa-tasks"></i></div>
        <h3>Luyện đề</h3>
        <p>Kiểm tra kiến thức với các câu hỏi trắc nghiệm, đúng sai, trả lời ngắn</p>
      </div>
      <div class="home-card" onclick="navigateTo('ranking')">
        <div class="home-card-icon"><i class="fas fa-trophy"></i></div>
        <h3>BXH cá nhân</h3>
        <p>Theo dõi thành tích học tập và phá kỷ lục của bản thân</p>
      </div>
    </div>
    <div class="card">
      <div class="card-header">
        <div>
          <div class="card-title">📊 Thống kê nhanh</div>
          <div class="card-subtitle">Tổng quan hoạt động của bạn</div>
        </div>
      </div>
      <div id="home-stats" style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center">
        <p style="color:var(--text-muted)">Đang tải...</p>
      </div>
    </div>
  `;
  loadHomeStats();
}

async function loadHomeStats() {
  try {
    const [scores, sessions] = await Promise.all([
      api('/api/scores'),
      api('/api/sessions')
    ]);
    
    const totalExams = scores.length;
    const totalSessions = sessions.total_sessions || state.visitCount || 0;
    const totalMinutes = sessions.total_minutes || state.totalStudyMinutes || 0;
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    
    document.getElementById('home-stats').innerHTML = `
      <div>
        <div style="font-size:28px;font-weight:800;color:var(--primary)">${totalExams}</div>
        <div style="font-size:13px;color:var(--text-muted)">Bài kiểm tra</div>
      </div>
      <div>
        <div style="font-size:28px;font-weight:800;color:var(--warning)">${totalSessions}</div>
        <div style="font-size:13px;color:var(--text-muted)">Lượt truy cập</div>
      </div>
      <div>
        <div style="font-size:28px;font-weight:800;color:var(--info)">${hours}h${mins}ph</div>
        <div style="font-size:13px;color:var(--text-muted)">Thời gian học tập</div>
      </div>
    `;
  } catch (e) {
    document.getElementById('home-stats').innerHTML = '<p style="color:var(--text-muted)">Không thể tải dữ liệu</p>';
  }
}

// ==================== THEORY ====================
function renderTheory(container) {
  const subjectId = state.currentSubject || 1;
  const subjectName = getSubjectName(subjectId);
  
  container.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div>
          <div class="card-title">📚 ${subjectName}</div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="toggleAddTheoryForm()"><i class="fas fa-plus"></i> Thêm bài học</button>
      </div>
    </div>
    
    <div class="add-theory-form" id="add-theory-form" style="display:none">
      <h3 style="margin-bottom:16px;font-size:16px">📝 Thêm bài học mới</h3>
      <div class="form-row">
        <input type="text" id="theory-title" placeholder="Tiêu đề bài học">
      </div>
      <div class="form-row">
        <input type="file" id="theory-file" accept=".txt,.pdf,.doc,.docx,.md,image/*" style="flex:1;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
      </div>
      <textarea id="theory-content" placeholder="Nội dung bài học... (có thể dùng HTML, copy từ word, v.v.)"></textarea>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="addTheory()"><i class="fas fa-plus"></i> Thêm bài học</button>
        <button class="btn btn-secondary" onclick="toggleAddTheoryForm()">Hủy</button>
      </div>
    </div>
    
    <div id="theory-list" class="theory-list">
      <p style="color:var(--text-muted);text-align:center">Đang tải...</p>
    </div>
  `;
  
  loadTheory(subjectId);
}

function toggleAddTheoryForm() {
  const form = document.getElementById('add-theory-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
}

async function loadTheory(subjectId) {
  try {
    const lessons = await api(`/api/theory?subject_id=${subjectId}`);
    const list = document.getElementById('theory-list');
    
    if (lessons.length === 0) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><p>Chưa có bài học nào. Hãy thêm bài học mới!</p></div>';
      return;
    }
    
    list.innerHTML = lessons.map(lesson => `
      <div class="theory-item">
        <div class="theory-item-header">
          <div>
            <div class="theory-item-title">${escapeHtml(lesson.title)}</div>
            <div class="theory-item-meta">
              <span>📚 ${lesson.subject_name}</span>
              <span>🕐 ${formatDate(lesson.created_at)}</span>
            </div>
          </div>
          <button class="btn-icon" onclick="deleteTheory(${lesson.id})" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
        <div class="theory-item-content" id="theory-content-${lesson.id}">
          ${lesson.image_path ? `<img src="${lesson.image_path}" onclick="showImageViewer('${lesson.image_path}')" style="cursor:zoom-in" alt="${escapeHtml(lesson.image_note || '')}">${lesson.image_note ? `<p style="font-size:12px;color:var(--text-muted)">📷 ${escapeHtml(lesson.image_note)}</p>` : ''}` : ''}
          ${lesson.files && lesson.files.length > 0 ? lesson.files.map(f => `<div class="file-preview"><i class="fas fa-file"></i> ${escapeHtml(f.name || f)}</div>`).join('') : ''}
          <div>${lesson.content || ''}</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    document.getElementById('theory-list').innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Lỗi tải dữ liệu</p></div>';
  }
}

async function addTheory() {
  const title = document.getElementById('theory-title').value.trim();
  const content = document.getElementById('theory-content').value;
  const subject_id = state.currentSubject || 1;
  const fileInput = document.getElementById('theory-file');
  
  if (!title) {
    showToast('Vui lòng nhập tiêu đề', 'warning');
    return;
  }
  
  let imagePath = null;
  let files = [];
  let imageNote = '';
  
  if (fileInput.files.length > 0) {
    const file = fileInput.files[0];
    const isImage = file.type.startsWith('image/');
    const base64 = await fileToBase64(file);
    const ext = '.' + file.name.split('.').pop();
    
    if (isImage) {
      try {
        const data = await api('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64, ext: ext, name: file.name })
        });
        if (data.success) imagePath = data.url;
      } catch (e) {}
    } else {
      const text = await file.text();
      files.push({ name: file.name, content: text });
    }
  }
  
  try {
    const data = await api('/api/theory', {
      method: 'POST',
      body: JSON.stringify({ title, content, subject_id, image_path: imagePath, image_note: imageNote, files })
    });
    if (data.success) {
      showToast('Đã thêm bài học!', 'success');
      document.getElementById('theory-title').value = '';
      document.getElementById('theory-content').value = '';
      document.getElementById('theory-file').value = '';
      loadTheory(subject_id);
    }
  } catch (e) {
    showToast('Lỗi khi thêm bài học', 'error');
  }
}

async function deleteTheory(id) {
  if (!confirm('Xóa bài học này?')) return;
  try {
    await api(`/api/theory/${id}`, { method: 'DELETE' });
    showToast('Đã xóa bài học', 'success');
    loadTheory(state.currentSubject || 1);
  } catch (e) {
    showToast('Lỗi khi xóa', 'error');
  }
}

// ==================== PRACTICE ====================
function renderPractice(container) {
  const subjectId = state.currentSubject || 1;
  
  // Filter out Văn (id: 2) from practice subjects
  const filteredSubjects = state.subjects.filter(s => s.id !== 2);
  const subjectPills = filteredSubjects.map(s => 
    `<span class="subject-pill ${s.id == subjectId ? 'active' : ''}" onclick="switchPracticeSubject(${s.id})">
      <i class="fas ${s.id === 1 ? 'fa-calculator' : s.id === 3 ? 'fa-language' : s.id === 4 ? 'fa-flask' : 'fa-atom'}"></i> ${s.name}
    </span>`
  ).join('');
  
  container.innerHTML = `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <div class="card-title">📝 Luyện tập</div>
      </div>
      <div style="margin-bottom:12px;display:flex;flex-wrap:wrap;gap:4px">
        ${subjectPills}
      </div>
    </div>
    <div class="practice-controls">
      <button class="btn btn-primary" onclick="showAddQuestion()"><i class="fas fa-plus"></i> Thêm câu hỏi</button>
      <button class="btn btn-success" onclick="startExam()"><i class="fas fa-play"></i> Làm bài kiểm tra</button>
    </div>
    
    <div id="question-list" class="question-list">
      <p style="color:var(--text-muted);text-align:center">Đang tải...</p>
    </div>
  `;
  
  loadPractice(subjectId);
}

function switchPracticeSubject(subjectId) {
  state.currentSubject = subjectId;
  document.querySelectorAll('.subject-pill').forEach(p => p.classList.remove('active'));
  document.querySelectorAll(`.subject-pill`).forEach(p => {
    if (p.textContent.includes(getSubjectName(subjectId))) p.classList.add('active');
  });
  loadPractice(subjectId);
}

async function loadPractice(subjectId) {
  try {
    const questions = await api(`/api/practice?subject_id=${subjectId}`);
    const list = document.getElementById('question-list');
    
    if (questions.length === 0) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-tasks"></i><p>Chưa có câu hỏi nào. Hãy thêm câu hỏi mới!</p></div>';
      return;
    }
    
    list.innerHTML = questions.map(q => {
      let typeLabel = q.type === 'multiple' ? 'Trắc nghiệm' : q.type === 'truefalse' ? 'Đúng/Sai' : 'Trả lời ngắn';
      return `
      <div class="question-item">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">
          <span style="font-size:12px;padding:2px 8px;background:var(--bg);border-radius:4px;color:var(--text-muted)">
            ${typeLabel}
          </span>
          <div style="display:flex;gap:4px">
            <button class="btn-icon" onclick="deleteQuestion(${q.id})" title="Xóa"><i class="fas fa-trash"></i></button>
          </div>
        </div>
        <div class="question-text">
          ${q.question_image ? `<img src="${q.question_image}" onclick="showImageViewer('${q.question_image}')" style="max-width:200px;border-radius:8px;margin-bottom:8px;cursor:zoom-in">` : ''}
          ${escapeHtml(q.question_text)}
        </div>
        ${q.type === 'multiple' ? `
        <div class="question-options">
          ${['A','B','C','D'].map(k => {
            const val = q[`answer_${k.toLowerCase()}`];
            const img = q[`answer_${k.toLowerCase()}_img`];
            let html = val ? `<div class="option-label"><input type="radio" disabled> ${k}. ${escapeHtml(val)}` : '';
            if (img) html += ` <img src="${img}" style="max-width:60px;max-height:40px;border-radius:4px;vertical-align:middle;cursor:pointer" onclick="event.stopPropagation();showImageViewer('${img}')">`;
            html += val ? `</div>` : '';
            return html;
          }).join('')}
        </div>` : q.type === 'truefalse' ? `
        <div class="question-options">
          ${[1,2,3,4].map(idx => {
            const subQ = q[`sub_question_${idx}`];
            if (!subQ) return '';
            return `<div class="option-label" style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap">
              <input type="checkbox" disabled ${q[`sub_correct_${idx}`] ? 'checked' : ''} style="margin-top:3px">
              <span style="flex:1">${escapeHtml(subQ)}</span>
            </div>`;
          }).join('')}
        </div>` : `
        <div style="padding:12px;background:var(--bg);border-radius:var(--radius-sm);font-size:14px;color:var(--text-muted)">
          <i class="fas fa-pen"></i> Câu hỏi trả lời ngắn
          ${q.correct_answer ? `<div style="margin-top:8px;padding:8px;background:rgba(34,197,94,0.1);border-radius:4px;color:var(--success);font-size:13px">✓ Đáp án đúng: ${escapeHtml(q.correct_answer)}</div>` : ''}
        </div>`}
      </div>`;
    }).join('');
  } catch (e) {
    document.getElementById('question-list').innerHTML = '<div class="empty-state"><i class="fas fa-exclamation-triangle"></i><p>Lỗi tải dữ liệu</p></div>';
  }
}

function showAddQuestion() {
  const subjectId = state.currentSubject || 1;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-question-modal';
  overlay.innerHTML = `
    <div class="modal" style="max-width:650px">
      <h3>📝 Thêm câu hỏi</h3>
      <div class="form-row">
        <select id="aq-type">
          <option value="multiple">Trắc nghiệm</option>
          <option value="truefalse">Đúng/Sai (4 ý)</option>
          <option value="shortanswer">Trả lời ngắn</option>
        </select>
      </div>
      <div class="form-row">
        <input type="file" id="aq-image" accept="image/*" style="flex:1;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
      </div>
      <textarea id="aq-text" placeholder="Nội dung câu hỏi (có thể để trống nếu đã thêm ảnh)..." style="width:100%;min-height:80px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit;resize:vertical;outline:none;margin-bottom:12px"></textarea>
      
      <div id="aq-options">
        <div class="form-row">
          <div style="flex:1;display:flex;flex-direction:column;gap:4px">
            <input type="text" id="aq-answer-a" placeholder="Đáp án A" style="padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
            <input type="file" id="aq-img-a" accept="image/*" style="padding:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:12px">
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:4px">
            <input type="text" id="aq-answer-b" placeholder="Đáp án B" style="padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
            <input type="file" id="aq-img-b" accept="image/*" style="padding:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:12px">
          </div>
        </div>
        <div class="form-row">
          <div style="flex:1;display:flex;flex-direction:column;gap:4px">
            <input type="text" id="aq-answer-c" placeholder="Đáp án C" style="padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
            <input type="file" id="aq-img-c" accept="image/*" style="padding:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:12px">
          </div>
          <div style="flex:1;display:flex;flex-direction:column;gap:4px">
            <input type="text" id="aq-answer-d" placeholder="Đáp án D" style="padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
            <input type="file" id="aq-img-d" accept="image/*" style="padding:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-size:12px">
          </div>
        </div>
        <div class="form-row">
          <label style="color:var(--text-muted);font-size:14px">Đáp án đúng:</label>
          <select id="aq-correct" style="padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
          </select>
        </div>
      </div>
      
      <div id="aq-truefalse" style="display:none">
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:8px">Nhập nội dung 4 ý và tick vào ô đúng/sai cho mỗi ý:</p>
        ${[1,2,3,4].map(i => `
        <div class="form-row" style="align-items:center">
          <input type="text" id="aq-tf-sub-${i}" placeholder="Nội dung ý ${i}" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
          <label style="display:flex;align-items:center;gap:4px;color:var(--text-muted);font-size:13px;white-space:nowrap">
            <input type="checkbox" id="aq-tf-correct-${i}"> Đúng
          </label>
        </div>
        `).join('')}
      </div>
      
      <div id="aq-shortanswer" style="display:none">
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:8px">Nhập đáp án đúng cho câu hỏi trả lời ngắn:</p>
        <div class="form-row">
          <input type="text" id="aq-correct-answer" placeholder="Đáp án đúng..." style="width:100%;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
        </div>
      </div>
      
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="document.getElementById('add-question-modal').remove()">Hủy</button>
        <button class="btn btn-primary" onclick="addQuestion()">Thêm</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  document.getElementById('aq-type').addEventListener('change', function() {
    document.getElementById('aq-options').style.display = this.value === 'multiple' ? 'block' : 'none';
    document.getElementById('aq-truefalse').style.display = this.value === 'truefalse' ? 'block' : 'none';
    document.getElementById('aq-shortanswer').style.display = this.value === 'shortanswer' ? 'block' : 'none';
  });
}

async function addQuestion() {
  const type = document.getElementById('aq-type').value;
  const subject_id = state.currentSubject || 1;
  const question_text = document.getElementById('aq-text').value.trim();
  const imageInput = document.getElementById('aq-image');
  
  // Allow empty question text if image is added
  if (!question_text && !imageInput.files.length) {
    showToast('Vui lòng nhập nội dung câu hỏi hoặc thêm ảnh', 'warning');
    return;
  }
  
  let question_image = null;
  if (imageInput.files.length > 0) {
    const file = imageInput.files[0];
    const base64 = await fileToBase64(file);
    const ext = '.' + file.name.split('.').pop();
    try {
      const data = await api('/api/upload', {
        method: 'POST',
        body: JSON.stringify({ file: base64, ext: ext })
      });
      if (data.success) question_image = data.url;
    } catch (e) {}
  }
  
  const body = { subject_id, type, question_text, question_image };
  
  if (type === 'multiple') {
    body.answer_a = document.getElementById('aq-answer-a').value;
    body.answer_b = document.getElementById('aq-answer-b').value;
    body.answer_c = document.getElementById('aq-answer-c').value;
    body.answer_d = document.getElementById('aq-answer-d').value;
    body.answer_correct = document.getElementById('aq-correct').value;
    
    // Upload answer images
    for (const letter of ['a', 'b', 'c', 'd']) {
      const input = document.getElementById(`aq-img-${letter}`);
      if (input && input.files.length > 0) {
        const file = input.files[0];
        const base64 = await fileToBase64(file);
        const ext = '.' + file.name.split('.').pop();
        try {
          const data = await api('/api/upload', {
            method: 'POST',
            body: JSON.stringify({ file: base64, ext: ext })
          });
          if (data.success) body[`answer_${letter}_img`] = data.url;
        } catch (e) {}
      }
    }
  } else if (type === 'truefalse') {
    for (let i = 1; i <= 4; i++) {
      body[`sub_question_${i}`] = document.getElementById(`aq-tf-sub-${i}`).value;
      body[`sub_correct_${i}`] = document.getElementById(`aq-tf-correct-${i}`).checked;
    }
  } else if (type === 'shortanswer') {
    body.correct_answer = document.getElementById('aq-correct-answer').value.trim();
    if (!body.correct_answer) {
      showToast('Vui lòng nhập đáp án đúng', 'warning');
      return;
    }
  }
  
  try {
    const data = await api('/api/practice', {
      method: 'POST',
      body: JSON.stringify(body)
    });
    if (data.success) {
      showToast('Đã thêm câu hỏi!', 'success');
      document.getElementById('add-question-modal').remove();
      loadPractice(state.currentSubject || 1);
    }
  } catch (e) {
    showToast('Lỗi khi thêm câu hỏi', 'error');
  }
}

async function deleteQuestion(id) {
  if (!confirm('Xóa câu hỏi này?')) return;
  try {
    await api(`/api/practice/${id}`, { method: 'DELETE' });
    showToast('Đã xóa câu hỏi', 'success');
    loadPractice(state.currentSubject || 1);
  } catch (e) {
    showToast('Lỗi khi xóa', 'error');
  }
}

// ==================== EXAM MODE ====================
let examStartTime = null;

async function startExam() {
  const subjectId = state.currentSubject || 1;
  const subjectName = getSubjectName(subjectId);
  
  try {
    const questions = await api(`/api/practice?subject_id=${subjectId}`);
    if (questions.length === 0) {
      showToast('Chưa có câu hỏi cho môn này', 'warning');
      return;
    }
    
    state.examQuestions = shuffleArray([...questions]).map(q => {
      if (q.type === 'multiple') {
        // Keep A,B,C,D order, only shuffle content inside each option
        // Actually we keep the order A,B,C,D and just shuffle the content values
        const options = [
          { key: 'A', val: q.answer_a, img: q.answer_a_img },
          { key: 'B', val: q.answer_b, img: q.answer_b_img },
          { key: 'C', val: q.answer_c, img: q.answer_c_img },
          { key: 'D', val: q.answer_d, img: q.answer_d_img }
        ].filter(o => o.val);
        // Shuffle the content but keep A,B,C,D labels in order
        const shuffled = shuffleArray([...options]);
        // Reassign shuffled content to A,B,C,D in order
        const orderedKeys = ['A', 'B', 'C', 'D'];
        const shuffledMap = {};
        orderedKeys.forEach((key, idx) => {
          if (idx < shuffled.length) {
            shuffledMap[key] = shuffled[idx];
          }
        });
        q.shuffle_map = shuffledMap;
      }
      return q;
    });
    state.examAnswers = {};
    state.examMode = true;
    state.examTimeLeft = questions.length * 60;
    examStartTime = Date.now();
    
    renderExam(subjectName);
    startExamTimer();
  } catch (e) {
    showToast('Lỗi tải câu hỏi', 'error');
  }
}

function renderExam(subjectName) {
  const overlay = document.createElement('div');
  overlay.className = 'exam-overlay';
  overlay.id = 'exam-overlay';
  
  overlay.innerHTML = `
    <div class="exam-header">
      <div>
        <h2>📝 Kiểm tra: ${subjectName}</h2>
        <p style="color:var(--text-muted);font-size:14px">${state.examQuestions.length} câu hỏi</p>
      </div>
      <div class="exam-timer" id="exam-timer">${formatTime(state.examTimeLeft)}</div>
    </div>
    <div class="exam-questions">
      ${state.examQuestions.map((q, i) => `
        <div class="exam-question" id="exam-q-${i}">
          <div class="exam-question-number">Câu ${i + 1}</div>
          <div class="question-text">
            ${q.question_image ? `<img src="${q.question_image}" onclick="showImageViewer('${q.question_image}')" style="max-width:300px;border-radius:8px;margin-bottom:8px;cursor:zoom-in">` : ''}
            ${escapeHtml(q.question_text)}
          </div>
          ${q.type === 'multiple' ? `
          <div class="question-options">
            ${['A','B','C','D'].map(k => {
              const opt = q.shuffle_map ? q.shuffle_map[k] : null;
              const val = opt ? opt.val : q[`answer_${k.toLowerCase()}`];
              const img = opt ? opt.img : q[`answer_${k.toLowerCase()}_img`];
              if (!val) return '';
              return `
                <label class="option-label" onclick="selectExamAnswer(${i}, '${k}')">
                  <input type="radio" name="exam-q-${i}" value="${k}">
                  ${k}. ${escapeHtml(val)}
                  ${img ? `<img src="${img}" onclick="event.stopPropagation();showImageViewer('${img}')" style="max-width:100px;max-height:60px;border-radius:4px;margin-left:8px;cursor:zoom-in;vertical-align:middle">` : ''}
                </label>`;
            }).join('')}
          </div>` : q.type === 'truefalse' ? `
          <div class="question-options">
            ${[1,2,3,4].map(idx => {
              const subQ = q[`sub_question_${idx}`];
              const checked = state.examAnswers[i]?.[idx] || false;
              return `
                <label class="option-label ${checked ? 'selected' : ''}" onclick="selectExamTF(${i}, ${idx})" style="display:flex;align-items:flex-start;gap:8px;flex-wrap:wrap">
                  <input type="checkbox" ${checked ? 'checked' : ''} style="margin-top:3px">
                  <span style="flex:1">${subQ ? escapeHtml(subQ) : '<span style="color:var(--text-muted);font-style:italic">(Trống)</span>'}</span>
                </label>`;
            }).join('')}
          </div>` : q.type === 'shortanswer' ? `
          <div style="margin-bottom:8px">
            <textarea placeholder="Nhập câu trả lời ngắn của bạn..." onchange="selectExamAnswer(${i}, this.value)" style="width:100%;min-height:80px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit;resize:vertical;outline:none"></textarea>
          </div>` : `
          <textarea placeholder="Nhập câu trả lời ngắn của bạn..." onchange="selectExamAnswer(${i}, this.value)" style="width:100%;min-height:80px;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text);font-family:inherit;resize:vertical;outline:none"></textarea>`}
        </div>
      `).join('')}
      <div class="exam-submit">
        <button class="btn btn-success btn-full" onclick="submitExam()" style="font-size:18px;padding:16px">
          <i class="fas fa-check-circle"></i> Nộp bài
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  document.addEventListener('keydown', examKeyHandler);
  window.addEventListener('beforeunload', examBeforeUnload);
}

function examKeyHandler(e) {
  if (e.key === 'Escape' && state.examMode) {
    e.preventDefault();
    showToast('⚠️ Không thể thoát khi đang làm bài!', 'warning');
  }
}

function examBeforeUnload(e) {
  if (state.examMode) {
    e.preventDefault();
    e.returnValue = '';
  }
}

function selectExamAnswer(index, value) {
  state.examAnswers[index] = value;
  const labels = document.querySelectorAll(`#exam-q-${index} .option-label`);
  labels.forEach(l => l.classList.remove('selected'));
  const selected = document.querySelector(`#exam-q-${index} .option-label input[value="${value}"]`);
  if (selected) selected.closest('.option-label').classList.add('selected');
}

function selectExamTF(index, subIdx) {
  if (!state.examAnswers[index]) state.examAnswers[index] = {};
  state.examAnswers[index][subIdx] = !state.examAnswers[index][subIdx];
  const label = document.querySelector(`#exam-q-${index} .option-label:nth-child(${subIdx})`);
  if (label) label.classList.toggle('selected');
}

function startExamTimer() {
  state.examTimer = setInterval(() => {
    state.examTimeLeft--;
    document.getElementById('exam-timer').textContent = formatTime(state.examTimeLeft);
    if (state.examTimeLeft <= 0) {
      clearInterval(state.examTimer);
      submitExam();
    }
  }, 1000);
}

async function submitExam() {
  clearInterval(state.examTimer);
  state.examMode = false;
  document.removeEventListener('keydown', examKeyHandler);
  window.removeEventListener('beforeunload', examBeforeUnload);
  
  const answers = state.examQuestions.map((q, i) => ({
    id: q.id,
    type: q.type,
    answer: q.type === 'truefalse' ? state.examAnswers[i] || {} : state.examAnswers[i] || ''
  }));
  
  try {
    const data = await api('/api/check-exam', {
      method: 'POST',
      body: JSON.stringify({ answers, subject_id: state.currentSubject || 1 })
    });
    
    if (data.success) {
      const overlay = document.getElementById('exam-overlay');
      overlay.innerHTML = `
        <div style="max-width:600px;margin:auto;text-align:center;padding:40px">
          <div style="font-size:72px;margin-bottom:20px">${data.score >= 7 ? '🎉' : data.score >= 5 ? '👍' : '💪'}</div>
          <h2 style="font-size:32px;margin-bottom:8px">Kết quả bài kiểm tra</h2>
          <div style="font-size:64px;font-weight:800;background:linear-gradient(135deg,var(--primary),var(--secondary));-webkit-background-clip:text;-webkit-text-fill-color:transparent">
            ${data.score}/10
          </div>
          <p style="color:var(--text-muted);font-size:16px;margin:16px 0">
            Đúng ${data.correct}/${data.total} câu
          </p>
          <div id="exam-encouragement" style="font-size:18px;font-weight:600;margin:16px 0;padding:16px;border-radius:var(--radius-sm)"></div>
          <div style="margin-top:24px">
            <button class="btn btn-primary" onclick="closeExam()"><i class="fas fa-home"></i> Về trang chủ</button>
            <button class="btn btn-secondary" onclick="closeExam();navigateTo('ranking')" style="margin-left:8px"><i class="fas fa-trophy"></i> Xem BXH</button>
          </div>
        </div>
      `;
      
      showEncouragement(data.score);
      updateTopBarEvents();
    }
  } catch (e) {
    showToast('Lỗi nộp bài', 'error');
  }
}

async function showEncouragement(score) {
  try {
    const enc = await api('/api/encouragements');
    const el = document.getElementById('exam-encouragement');
    const threshold = enc.threshold || 7;
    if (score >= threshold) {
      el.textContent = '🏆 ' + (enc.message_up || '🔥 Xuất sắc! Cố gắng phát huy!');
      el.style.background = 'rgba(34,197,94,0.1)';
      el.style.color = 'var(--success)';
    } else {
      el.textContent = '😤 ' + (enc.message_down || 'Học hành kiểu gì vậy? Cố lên!');
      el.style.background = 'rgba(239,68,68,0.1)';
      el.style.color = 'var(--danger)';
    }
  } catch (e) {}
}

function closeExam() {
  document.getElementById('exam-overlay')?.remove();
  navigateTo('home');
}

// ==================== MUSIC ====================
function renderMusic(container) {
  container.innerHTML = `
    <div class="music-page">
      <div class="music-list">
        <div class="card" style="margin-bottom:16px">
          <div class="card-header">
            <div class="card-title">🎵 Thư viện nhạc</div>
          </div>
          <div class="form-row">
            <input type="text" id="music-title" placeholder="Tên bài hát" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
            <input type="text" id="music-artist" placeholder="Nghệ sĩ" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
          </div>
          <div class="form-row">
            <input type="file" id="music-file" accept="audio/*" style="flex:1;padding:8px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
          </div>
          <button class="btn btn-primary" onclick="addMusic()"><i class="fas fa-upload"></i> Thêm nhạc</button>
        </div>
        <div id="music-grid" class="music-grid">
          <p style="color:var(--text-muted);text-align:center">Đang tải...</p>
        </div>
      </div>
    </div>
  `;
  loadMusic();
}

async function loadMusic() {
  try {
    state.musicList = await api('/api/music');
    const grid = document.getElementById('music-grid');
    
    if (state.musicList.length === 0) {
      grid.innerHTML = '<div class="empty-state"><i class="fas fa-music"></i><p>Chưa có bài hát nào. Hãy thêm nhạc!</p></div>';
      return;
    }
    
    grid.innerHTML = state.musicList.map((m, i) => `
      <div class="music-card" onclick="playMusic(${i})">
        <div class="music-card-icon"><i class="fas fa-music"></i></div>
        <div class="music-card-title">${escapeHtml(m.title)}</div>
        <div class="music-card-artist">${escapeHtml(m.artist || 'Unknown')}</div>
        <div class="music-card-actions">
          <button class="btn-icon" onclick="event.stopPropagation();playMusic(${i})" title="Phát"><i class="fas fa-play"></i></button>
          <button class="btn-icon" onclick="event.stopPropagation();deleteMusic(${m.id})" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

async function addMusic() {
  const title = document.getElementById('music-title').value.trim() || 'Bài hát không tên';
  const artist = document.getElementById('music-artist').value.trim() || 'Unknown';
  const fileInput = document.getElementById('music-file');
  
  if (!fileInput.files.length) {
    showToast('Vui lòng chọn file nhạc', 'warning');
    return;
  }
  
  const file = fileInput.files[0];
  const base64 = await fileToBase64(file);
  
  try {
    const data = await api('/api/music/upload', {
      method: 'POST',
      body: JSON.stringify({ title, artist, file: base64 })
    });
    if (data.success) {
      showToast('Đã thêm bài hát!', 'success');
      document.getElementById('music-title').value = '';
      document.getElementById('music-artist').value = '';
      document.getElementById('music-file').value = '';
      loadMusic();
    }
  } catch (e) {
    showToast('Lỗi khi thêm nhạc', 'error');
  }
}

async function deleteMusic(id) {
  if (!confirm('Xóa bài hát này?')) return;
  try {
    await api(`/api/music/${id}`, { method: 'DELETE' });
    showToast('Đã xóa bài hát', 'success');
    loadMusic();
  } catch (e) {
    showToast('Lỗi khi xóa', 'error');
  }
}

function playMusic(index) {
  const music = state.musicList[index];
  if (!music) return;
  
  state.currentMusicIndex = index;
  state.audio.src = music.file_path;
  state.audio.play();
  state.isPlaying = true;
  
  document.getElementById('now-playing-title').textContent = music.title;
  document.getElementById('now-playing-artist').textContent = music.artist || 'Unknown';
  document.getElementById('play-pause-btn').innerHTML = '<i class="fas fa-pause"></i>';
  
  state.audio.ontimeupdate = () => {
    const progress = (state.audio.currentTime / state.audio.duration) * 100 || 0;
    document.getElementById('music-progress-bar').value = progress;
  };
  
  state.audio.onended = () => {
    nextMusic();
  };
}

function togglePlay() {
  if (state.audio.paused && state.audio.src) {
    state.audio.play();
    state.isPlaying = true;
    document.getElementById('play-pause-btn').innerHTML = '<i class="fas fa-pause"></i>';
  } else if (state.audio.src) {
    state.audio.pause();
    state.isPlaying = false;
    document.getElementById('play-pause-btn').innerHTML = '<i class="fas fa-play"></i>';
  }
}

function nextMusic() {
  if (state.musicList.length === 0) return;
  const next = (state.currentMusicIndex + 1) % state.musicList.length;
  playMusic(next);
}

function prevMusic() {
  if (state.musicList.length === 0) return;
  const prev = (state.currentMusicIndex - 1 + state.musicList.length) % state.musicList.length;
  playMusic(prev);
}

function seekMusic(value) {
  if (state.audio.duration) {
    state.audio.currentTime = (value / 100) * state.audio.duration;
  }
}

function setVolume(value) {
  state.audio.volume = value;
}

// Draggable Music Player
function initMusicPlayerDrag() {
  const player = document.getElementById('music-player');
  let isDragging = false;
  let startX, startY, origX, origY;

  const onMouseDown = (e) => {
    if (e.target.closest('.music-player-controls') || e.target.closest('input[type="range"]')) return;
    isDragging = true;
    const rect = player.getBoundingClientRect();
    startX = e.clientX;
    startY = e.clientY;
    origX = rect.left;
    origY = rect.top;
    player.style.cursor = 'grabbing';
    player.style.bottom = 'auto';
    player.style.right = 'auto';
    player.style.left = origX + 'px';
    player.style.top = origY + 'px';
    player.style.transition = 'none';
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    player.style.left = (origX + dx) + 'px';
    player.style.top = (origY + dy) + 'px';
    e.preventDefault();
  };

  const onMouseUp = () => {
    if (!isDragging) return;
    isDragging = false;
    player.style.cursor = 'grab';
    player.style.transition = '';
  };

  player.addEventListener('mousedown', onMouseDown);
  document.addEventListener('mousemove', onMouseMove);
  document.addEventListener('mouseup', onMouseUp);

  const onTouchStart = (e) => {
    if (e.target.closest('.music-player-controls') || e.target.closest('input[type="range"]')) return;
    isDragging = true;
    const touch = e.touches[0];
    const rect = player.getBoundingClientRect();
    startX = touch.clientX;
    startY = touch.clientY;
    origX = rect.left;
    origY = rect.top;
    player.style.bottom = 'auto';
    player.style.right = 'auto';
    player.style.left = origX + 'px';
    player.style.top = origY + 'px';
    player.style.transition = 'none';
    e.preventDefault();
  };

  const onTouchMove = (e) => {
    if (!isDragging) return;
    const touch = e.touches[0];
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    player.style.left = (origX + dx) + 'px';
    player.style.top = (origY + dy) + 'px';
    e.preventDefault();
  };

  const onTouchEnd = () => {
    if (!isDragging) return;
    isDragging = false;
    player.style.transition = '';
  };

  player.addEventListener('touchstart', onTouchStart, { passive: false });
  document.addEventListener('touchmove', onTouchMove, { passive: false });
  document.addEventListener('touchend', onTouchEnd, { passive: true });
}

// ==================== RANKING ====================
function renderRanking(container) {
  container.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div>
          <div class="card-title">🏆 Bảng xếp hạng cá nhân</div>
          <div class="card-subtitle">Thành tích học tập của bạn</div>
        </div>
        <button class="btn btn-sm btn-secondary" onclick="showEditEncouragement()"><i class="fas fa-edit"></i> Lời nhắn</button>
      </div>
    </div>
    <div id="ranking-grid" class="ranking-grid">
      <p style="color:var(--text-muted);text-align:center">Đang tải...</p>
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <div class="card-title">📊 Lịch sử điểm</div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-sm btn-danger" onclick="deleteAllScores()"><i class="fas fa-trash"></i> Xóa tất cả</button>
        </div>
      </div>
      <div id="score-history">
        <p style="color:var(--text-muted);text-align:center">Đang tải...</p>
      </div>
    </div>
  `;
  loadRanking();
}

async function loadRanking() {
  try {
    const [best, scores, enc] = await Promise.all([
      api('/api/scores/best'),
      api('/api/scores'),
      api('/api/encouragements')
    ]);
    
    const threshold = enc.threshold || 7;
    
    const grid = document.getElementById('ranking-grid');
    grid.innerHTML = best.map(s => {
      const hasScore = s.count > 0;
      const isHighScore = hasScore && s.last_score >= threshold;
      return `
        <div class="ranking-card">
          <div class="ranking-subject">${s.name}</div>
          ${hasScore ? `
            <div class="ranking-best">${s.best_score}</div>
            <div class="ranking-last">Gần nhất: ${s.last_score}</div>
            <div class="ranking-count">${s.count} lần kiểm tra</div>
            <div class="ranking-message ${isHighScore ? 'up' : 'down'}">
              ${isHighScore ? '🏆 ' + (enc.message_up || '🔥 Xuất sắc!') : '😤 ' + (enc.message_down || 'Cố lên!')}
            </div>
          ` : `
            <div style="font-size:14px;color:var(--text-muted);padding:20px 0">Chưa có điểm</div>
          `}
        </div>
      `;
    }).join('');
    
    const history = document.getElementById('score-history');
    if (scores.length === 0) {
      history.innerHTML = '<div class="empty-state"><i class="fas fa-chart-line"></i><p>Chưa có lịch sử điểm</p></div>';
    } else {
      history.innerHTML = `
        <div style="overflow-x:auto">
          <table class="admin-table">
            <thead>
              <tr><th>Môn</th><th>Điểm</th><th>Ngày</th><th></th></tr>
            </thead>
            <tbody>
              ${scores.slice(0, 50).map(s => `
                <tr>
                  <td>${s.subject_name}</td>
                  <td style="font-weight:700;color:${s.score >= 8 ? 'var(--success)' : s.score >= 5 ? 'var(--warning)' : 'var(--danger)'}">${s.score}/${s.max_score}</td>
                  <td style="color:var(--text-muted)">${formatDate(s.created_at)}</td>
                  <td><button class="btn-icon" onclick="deleteScore(${s.id})" title="Xóa"><i class="fas fa-times" style="font-size:12px"></i></button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  } catch (e) {}
}

async function deleteScore(id) {
  if (!confirm('Xóa điểm này?')) return;
  try {
    await api(`/api/scores/${id}`, { method: 'DELETE' });
    showToast('Đã xóa điểm', 'success');
    loadRanking();
  } catch (e) {
    showToast('Lỗi khi xóa', 'error');
  }
}

async function deleteAllScores() {
  if (!confirm('Xóa tất cả điểm? Điều này cũng sẽ reset kỷ lục!')) return;
  try {
    await api('/api/scores', { method: 'DELETE' });
    showToast('Đã xóa tất cả điểm', 'success');
    loadRanking();
  } catch (e) {
    showToast('Lỗi khi xóa', 'error');
  }
}

function showEditEncouragement() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>✏️ Lời nhắn cá nhân</h3>
      <p style="color:var(--text-muted);font-size:14px;margin-bottom:16px">
        Viết lời cổ vũ khi đạt điểm chuẩn và lời "động viên" khi dưới điểm chuẩn
      </p>
      <div style="margin-bottom:12px">
        <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px">🏆 Khi điểm ≥ điểm chuẩn:</label>
        <input type="text" id="enc-up" placeholder="VD: 🔥 Xuất sắc! Cố gắng phát huy!" style="width:100%;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px">😤 Khi điểm < điểm chuẩn:</label>
        <input type="text" id="enc-down" placeholder="VD: 😤 Học hành kiểu gì vậy? Cố lên!" style="width:100%;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:13px;color:var(--text-muted);display:block;margin-bottom:4px">🎯 Điểm chuẩn (mặc định 7):</label>
        <input type="number" id="enc-threshold" min="1" max="10" value="7" style="width:100%;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
        <button class="btn btn-primary" onclick="saveEncouragement()">Lưu</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  api('/api/encouragements').then(enc => {
    document.getElementById('enc-up').value = enc.message_up || '';
    document.getElementById('enc-down').value = enc.message_down || '';
    document.getElementById('enc-threshold').value = enc.threshold || 7;
  }).catch(() => {});
}

async function saveEncouragement() {
  const message_up = document.getElementById('enc-up').value.trim();
  const message_down = document.getElementById('enc-down').value.trim();
  const threshold = parseInt(document.getElementById('enc-threshold').value) || 7;
  
  try {
    await api('/api/encouragements', {
      method: 'POST',
      body: JSON.stringify({ message_up, message_down, threshold })
    });
    showToast('Đã lưu lời nhắn!', 'success');
    document.querySelector('.modal-overlay').remove();
    loadRanking();
  } catch (e) {
    showToast('Lỗi lưu', 'error');
  }
}

// ==================== CALENDAR ====================
function renderCalendar(container) {
  container.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">📅 Lịch đếm ngược</div>
      </div>
      <div class="form-row">
        <input type="text" id="cal-title" placeholder="Sự kiện" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
      </div>
      <div class="form-row">
        <input type="date" id="cal-start" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
        <input type="date" id="cal-end" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
      </div>
      <div class="form-row">
        <input type="text" id="cal-notes" placeholder="Ghi chú..." style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
        <input type="color" id="cal-color" value="#4f46e5" style="width:44px;height:44px;border:none;border-radius:var(--radius-sm);cursor:pointer">
      </div>
      <button class="btn btn-primary" onclick="addCalendarEvent()"><i class="fas fa-plus"></i> Thêm sự kiện</button>
    </div>
    <div id="calendar-list" class="calendar-list">
      <p style="color:var(--text-muted);text-align:center">Đang tải...</p>
    </div>
  `;
  loadCalendar();
}

async function loadCalendar() {
  try {
    const events = await api('/api/calendar');
    const list = document.getElementById('calendar-list');
    
    if (events.length === 0) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Chưa có sự kiện nào</p></div>';
      return;
    }
    
    list.innerHTML = events.map(e => {
      const now = new Date();
      const end = new Date(e.end_date);
      const diff = end - now;
      const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
      const countdownText = daysLeft > 0 ? `Còn ${daysLeft} ngày` : daysLeft === 0 ? 'Hôm nay!' : 'Đã qua';
      
      return `
        <div class="calendar-item" id="cal-item-${e.id}">
          <div class="calendar-color" style="background:${e.color || '#4f46e5'}"></div>
          <div class="calendar-info">
            <div class="calendar-title">${escapeHtml(e.title)}</div>
            <div class="calendar-date">${formatDate(e.start_date)} → ${formatDate(e.end_date)}</div>
            ${e.notes ? `<div class="calendar-notes">📝 ${escapeHtml(e.notes)}</div>` : ''}
          </div>
          <div class="calendar-countdown"><span class="calendar-countdown-animated"><span>${countdownText}</span></span></div>
          <button class="btn-icon" onclick="deleteCalendarEvent(${e.id})" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
      `;
    }).join('');
    
    updateTopBarEvents();
  } catch (e) {}
}

async function addCalendarEvent() {
  const title = document.getElementById('cal-title').value.trim();
  const start_date = document.getElementById('cal-start').value;
  const end_date = document.getElementById('cal-end').value;
  const notes = document.getElementById('cal-notes').value.trim();
  const color = document.getElementById('cal-color').value;
  
  if (!title || !start_date || !end_date) {
    showToast('Vui lòng nhập đầy đủ thông tin', 'warning');
    return;
  }
  
  try {
    const data = await api('/api/calendar', {
      method: 'POST',
      body: JSON.stringify({ title, start_date, end_date, notes, color })
    });
    if (data.success) {
      showToast('Đã thêm sự kiện!', 'success');
      document.getElementById('cal-title').value = '';
      document.getElementById('cal-start').value = '';
      document.getElementById('cal-end').value = '';
      document.getElementById('cal-notes').value = '';
      loadCalendar();
    }
  } catch (e) {
    showToast('Lỗi khi thêm', 'error');
  }
}

async function deleteCalendarEvent(id) {
  try {
    const item = document.getElementById(`cal-item-${id}`);
    if (item) {
      item.classList.add('deleted');
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    await api(`/api/calendar/${id}`, { method: 'DELETE' });
    if (item) item.remove();
    showToast('Đã xóa sự kiện', 'success');
    updateTopBarEvents();
    const list = document.getElementById('calendar-list');
    if (!list.querySelector('.calendar-item')) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-alt"></i><p>Chưa có sự kiện nào</p></div>';
    }
  } catch (e) {
    showToast('Lỗi khi xóa', 'error');
    loadCalendar();
  }
}

// ==================== NOTIFICATIONS ====================
function renderNotifications(container) {
  container.innerHTML = `
    <div class="card" style="margin-bottom:20px">
      <div class="card-header">
        <div class="card-title">🔔 Thông báo</div>
      </div>
    </div>
    <div id="notif-list" class="notif-list">
      <p style="color:var(--text-muted);text-align:center">Đang tải...</p>
    </div>
  `;
  loadNotifications();
}

async function loadNotifications() {
  try {
    const notifs = await api('/api/notifications');
    const list = document.getElementById('notif-list');
    
    if (notifs.length === 0) {
      list.innerHTML = '<div class="empty-state"><i class="fas fa-bell"></i><p>Không có thông báo</p></div>';
      return;
    }
    
    list.innerHTML = notifs.map(n => `
      <div class="notif-item" id="notif-full-${n.id}">
        <div class="notif-icon ${n.type}">
          <i class="fas ${n.type === 'admin' ? 'fa-shield-alt' : n.type === 'reminder' ? 'fa-clock' : 'fa-info-circle'}"></i>
        </div>
        <div class="notif-content" style="flex:1">
          <div class="notif-message">${escapeHtml(n.message)}</div>
          <div class="notif-from">Từ: ${escapeHtml(n.from_username || 'System')}</div>
          <div class="notif-time">${formatDate(n.created_at)}</div>
        </div>
        <button class="btn-icon" onclick="event.stopPropagation();deleteNotification(${n.id})" title="Xóa" style="width:32px;height:32px;font-size:12px;flex-shrink:0"><i class="fas fa-trash"></i></button>
      </div>
    `).join('');
  } catch (e) {}
}

async function markNotifRead(id) {
  try {
    await api(`/api/notifications/${id}/read`, { method: 'PUT' });
    loadNotifications();
    updateNotifBadge();
    if (document.getElementById('notif-panel').style.display !== 'none') {
      loadNotifPanel();
    }
  } catch (e) {}
}

// ==================== ADMIN PANEL ====================
function renderAdminPanel(container) {
  if (state.user.role !== 'admin') {
    container.innerHTML = '<div class="empty-state"><i class="fas fa-shield-alt"></i><p>Bạn không có quyền truy cập</p></div>';
    return;
  }
  
  container.innerHTML = `
    <div class="admin-section">
      <h3><i class="fas fa-users"></i> Quản lý người dùng</h3>
      <div class="card">
        <div id="admin-users">
          <p style="color:var(--text-muted)">Đang tải...</p>
        </div>
      </div>
    </div>
    
    <div class="admin-section">
      <h3><i class="fas fa-bell"></i> Gửi thông báo</h3>
      <div class="card">
        <div class="form-row">
          <select id="admin-notif-user" style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
            <option value="">Chọn người dùng...</option>
            <option value="all">📢 Gửi cho tất cả</option>
          </select>
        </div>
        <div class="form-row">
          <input type="text" id="admin-notif-message" placeholder="Nội dung thông báo..." style="flex:1;padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
          <button class="btn btn-primary" onclick="adminSendNotification()"><i class="fas fa-paper-plane"></i> Gửi</button>
        </div>
      </div>
    </div>
    
    <div class="admin-section">
      <h3><i class="fas fa-book"></i> Tất cả bài lý thuyết</h3>
      <div class="card">
        <div id="admin-theory">
          <p style="color:var(--text-muted)">Đang tải...</p>
        </div>
      </div>
    </div>
  `;
  
  loadAdminUsers();
  loadAdminTheory();
}

async function loadAdminUsers() {
  try {
    const users = await api('/api/admin/users-passwords');
    const container = document.getElementById('admin-users');
    const select = document.getElementById('admin-notif-user');
    
    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead>
            <tr><th>ID</th><th>Tên</th><th>Vai trò</th><th>Avatar</th><th>Mật khẩu</th><th>Ngày tạo</th><th></th></tr>
          </thead>
          <tbody>
            ${users.map(u => `
              <tr>
                <td>${u.id}</td>
                <td>${escapeHtml(u.username)}</td>
                <td><span style="padding:2px 8px;border-radius:4px;background:${u.role === 'admin' ? 'rgba(99,102,241,0.15)' : 'var(--bg)'};color:${u.role === 'admin' ? 'var(--primary-light)' : 'var(--text-muted)'}">${u.role}</span></td>
                <td>${u.avatar ? '<img src="' + u.avatar + '" style="width:30px;height:30px;border-radius:50%;object-fit:cover">' : '-'}</td>
                <td style="font-family:monospace;font-size:12px;color:var(--text-muted);max-width:150px;overflow:hidden;text-overflow:ellipsis">
                  <span title="${escapeHtml(u.password_hash)}">${u.password_hash.substring(0, 20)}...</span>
                  ${u.role !== 'admin' ? `<button class="btn btn-sm btn-secondary" onclick="showChangePassword(${u.id}, '${escapeHtml(u.username)}')" style="margin-left:4px;font-size:11px;padding:2px 8px"><i class="fas fa-key"></i> Đổi</button>` : ''}
                </td>
                <td style="color:var(--text-muted)">${formatDate(u.created_at)}</td>
                <td>${u.role !== 'admin' ? `<button class="btn-icon" onclick="deleteUser(${u.id})" title="Xóa"><i class="fas fa-trash" style="font-size:12px"></i></button>` : ''}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
    
    select.innerHTML = '<option value="">Chọn người dùng...</option><option value="all">📢 Gửi cho tất cả</option>' + 
      users.filter(u => u.role !== 'admin').map(u => `<option value="${u.id}">${escapeHtml(u.username)}</option>`).join('');
  } catch (e) {}
}

function showChangePassword(userId, username) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <h3>🔑 Đổi mật khẩu cho ${escapeHtml(username)}</h3>
      <div class="form-row">
        <input type="text" id="admin-new-password" placeholder="Mật khẩu mới" style="flex:1;padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);color:var(--text)">
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Hủy</button>
        <button class="btn btn-primary" onclick="adminChangePassword(${userId})">Lưu</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function adminChangePassword(userId) {
  const newPassword = document.getElementById('admin-new-password').value.trim();
  if (!newPassword || newPassword.length < 6) {
    showToast('Mật khẩu phải có ít nhất 6 ký tự', 'warning');
    return;
  }
  
  try {
    const data = await api('/api/admin/change-password', {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, new_password: newPassword })
    });
    if (data.success) {
      showToast('Đã đổi mật khẩu!', 'success');
      document.querySelector('.modal-overlay').remove();
      loadAdminUsers();
    }
  } catch (e) {
    showToast('Lỗi đổi mật khẩu', 'error');
  }
}

async function deleteUser(id) {
  if (!confirm('Xóa người dùng này và toàn bộ dữ liệu liên quan?')) return;
  try {
    await api(`/api/admin/users/${id}`, { method: 'DELETE' });
    showToast('Đã xóa người dùng', 'success');
    loadAdminUsers();
  } catch (e) {
    showToast('Lỗi xóa', 'error');
  }
}

async function adminSendNotification() {
  const user_id = document.getElementById('admin-notif-user').value;
  const message = document.getElementById('admin-notif-message').value.trim();
  
  if (!user_id || !message) {
    showToast('Vui lòng chọn người dùng và nhập nội dung', 'warning');
    return;
  }
  
  try {
    if (user_id === 'all') {
      // Send to all users
      const users = await api('/api/admin/users');
      for (const u of users) {
        if (u.role !== 'admin') {
          await api('/api/admin/notifications', {
            method: 'POST',
            body: JSON.stringify({ user_id: u.id, message })
          });
        }
      }
      showToast('Đã gửi thông báo cho tất cả!', 'success');
    } else {
      const data = await api('/api/admin/notifications', {
        method: 'POST',
        body: JSON.stringify({ user_id: parseInt(user_id), message })
      });
      if (data.success) {
        showToast('Đã gửi thông báo!', 'success');
      }
    }
    document.getElementById('admin-notif-message').value = '';
  } catch (e) {
    showToast('Lỗi gửi', 'error');
  }
}

async function loadAdminTheory() {
  try {
    const lessons = await api('/api/all-theory');
    const container = document.getElementById('admin-theory');
    
    if (lessons.length === 0) {
      container.innerHTML = '<div class="empty-state"><i class="fas fa-book-open"></i><p>Chưa có bài học nào</p></div>';
      return;
    }
    
    container.innerHTML = `
      <div style="overflow-x:auto">
        <table class="admin-table">
          <thead>
            <tr><th>ID</th><th>Tiêu đề</th><th>Người dùng</th><th>Môn</th><th>Ngày</th><th></th></tr>
          </thead>
          <tbody>
            ${lessons.slice(0, 30).map(l => `
              <tr>
                <td>${l.id}</td>
                <td>${escapeHtml(l.title)}</td>
                <td>${escapeHtml(l.username)}</td>
                <td>${l.subject_name}</td>
                <td style="color:var(--text-muted)">${formatDate(l.created_at)}</td>
                <td><button class="btn btn-sm btn-secondary" onclick="viewTheoryContent(${l.id})"><i class="fas fa-eye"></i> Xem</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  } catch (e) {}
}

async function viewTheoryContent(id) {
  try {
    const lesson = await api(`/api/all-theory/${id}`);
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal" style="max-width:700px">
        <h3>📖 ${escapeHtml(lesson.title)}</h3>
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:16px">
          <span>👤 ${escapeHtml(lesson.username)}</span> • 
          <span>📚 ${lesson.subject_name}</span> • 
          <span>🕐 ${formatDate(lesson.created_at)}</span>
        </div>
        <div style="max-height:400px;overflow-y:auto;padding:16px;background:var(--bg);border-radius:var(--radius-sm);font-size:14px;line-height:1.7;white-space:pre-wrap;word-break:break-word">
          ${lesson.image_path ? `<img src="${lesson.image_path}" onclick="showImageViewer('${lesson.image_path}')" style="max-width:100%;border-radius:8px;margin-bottom:12px;cursor:zoom-in">` : ''}
          ${lesson.content || '<em style="color:var(--text-muted)">(Không có nội dung)</em>'}
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Đóng</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (e) {
    showToast('Lỗi tải nội dung', 'error');
  }
}

// Calendar widget typewriter texts
const calendarTypewriterTexts = [
  'Học tập chăm chỉ 🎯',
  'Cố gắng mỗi ngày 💪',
  'Vươn tới ước mơ 🌟',
  'Kiến thức là sức mạnh 📚',
  'Thành công không ngẫu nhiên 🏆',
  'Mỗi ngày một tiến bộ 📈',
  'Học hôm nay, ngày mai tỏa sáng ✨',
  'Đam mê học hỏi 🔥',
  'Không ngừng vươn xa 🚀',
  'Tương lai trong tay bạn 🌈'
];
let calendarTypewriterIndex = 0;
let calendarTypewriterTimer = null;

function startCalendarTypewriter() {
  const el = document.getElementById('top-bar-typewriter');
  if (!el) return;
  if (calendarTypewriterTimer) clearInterval(calendarTypewriterTimer);
  
  let textIndex = 0;
  let charIndex = 0;
  let isDeleting = false;
  
  calendarTypewriterTimer = setInterval(() => {
    const currentText = calendarTypewriterTexts[textIndex];
    if (!isDeleting) {
      // Typing
      charIndex++;
      el.textContent = currentText.substring(0, charIndex);
      el.classList.add('typewriter-cursor');
      if (charIndex >= currentText.length) {
        isDeleting = true;
        // Wait 2 seconds before deleting
        clearInterval(calendarTypewriterTimer);
        setTimeout(() => {
          calendarTypewriterTimer = setInterval(typewriterDelete, 50);
        }, 2000);
      }
    }
  }, 80);
  
  function typewriterDelete() {
    charIndex--;
    el.textContent = currentText.substring(0, charIndex);
    if (charIndex <= 0) {
      isDeleting = false;
      clearInterval(calendarTypewriterTimer);
      textIndex = (textIndex + 1) % calendarTypewriterTexts.length;
      // Start typing next text after a short pause
      setTimeout(() => {
        calendarTypewriterTimer = setInterval(() => {
          const t = calendarTypewriterTexts[textIndex];
          charIndex++;
          el.textContent = t.substring(0, charIndex);
          el.classList.add('typewriter-cursor');
          if (charIndex >= t.length) {
            isDeleting = true;
            clearInterval(calendarTypewriterTimer);
            setTimeout(() => {
              calendarTypewriterTimer = setInterval(typewriterDelete, 50);
            }, 2000);
          }
        }, 80);
      }, 500);
    }
  }
}

// Update top bar events - BIG CALENDAR WIDGET with typewriter
async function updateTopBarEvents() {
  try {
    const events = await api('/api/calendar');
    state.calendarEvents = events;
    const container = document.getElementById('top-bar-events');
    
    // Create the big calendar widget
    let widgetHtml = '';
    
    if (events.length > 0) {
      const now = new Date();
      const upcoming = events.filter(e => new Date(e.end_date) >= now)
        .sort((a, b) => new Date(a.end_date) - new Date(b.end_date));
      
      if (upcoming.length > 0) {
        const next = upcoming[0];
        const diff = new Date(next.end_date) - now;
        const daysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        widgetHtml = `
          <div class="top-bar-calendar-widget" onclick="navigateTo('calendar')" title="${escapeHtml(next.title)}">
            <div class="top-bar-calendar-icon">📅</div>
            <div class="top-bar-calendar-info">
              <div class="top-bar-calendar-title">${escapeHtml(next.title)}: ${daysLeft} ngày</div>
              <div class="top-bar-calendar-typewriter" id="top-bar-typewriter"></div>
            </div>
          </div>
        `;
      }
    }
    
    if (!widgetHtml) {
      widgetHtml = `
        <div class="top-bar-calendar-widget" onclick="navigateTo('calendar')">
          <div class="top-bar-calendar-icon">📅</div>
          <div class="top-bar-calendar-info">
            <div class="top-bar-calendar-title">Chưa có sự kiện</div>
            <div class="top-bar-calendar-typewriter" id="top-bar-typewriter"></div>
          </div>
        </div>
      `;
    }
    
    container.innerHTML = widgetHtml;
    
    // Start typewriter effect
    startCalendarTypewriter();
  } catch (e) {}
}

// ==================== UTILITIES ====================
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

function formatTimeAudio(seconds) {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}