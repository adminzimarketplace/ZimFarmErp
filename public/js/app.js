import { 
    collection, doc, setDoc, addDoc, onSnapshot, query, limit, orderBy, runTransaction, where, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    signInWithEmailAndPassword, signOut, onAuthStateChanged, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// State variables
// State variables
// State variables
const state = {
    currency: 'USD',
    exchangeRate: 13.56, 
    usdBalance: 0.00,
    isOffline: !navigator.onLine,
    version: '5.1.0',
    user: null, // Removed bypass
    role: 'Worker', 
    userName: '',
    farmId: null,      // Multi-tenant tether
    status: 'Pending', // Security status: Active, Pending, or Invited
    authReady: false,
    farmSettings: {
        name: 'ZimFarm ERP',
        location: 'Harare',
        lat: -17.8252,
        lon: 31.0335,
        zesaStatus: 'off',
        fallbackRate: 24.63,
        enabledModules: {
            fields: true,
            livestock: true,
            equipment: true,
            stock: true,
            financials: true
        }
    }
};
console.log("ZimFarm ERP App Module Loaded [v5.1.0 | Phase 5+7 Active]");

// Initial state from localStorage for immediate load
let activities = [];
let inventory = [];
let farmFields = [];
let farmEquipment = [];
let livestock = [];

// Phase 5 Labor state
let teamWorkers = [];
let teamTasks = [];
let teamPayroll = [];

// Firestore integration
let db;

// Formatting utilities
const formatCurrency = (amount, symbol) => {
    return `${symbol === 'USD' ? '$' : 'ZiG '}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Shona time-based greeting
function getShonaGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Mangwanani';
    if (hour < 17) return 'Masikati';
    return 'Manheru';
}

// Zimbabwe common farm products
const ZW_COMMODITIES = [
    'Tobacco', 'Maize', 'Soyabeans', 'Wheat', 'Cotton', 'Groundnuts', 'Sunflower',
    'Sugar Beans', 'Paprika', 'Potatoes', 'Tomatoes', 'Onions', 'Cabbage',
    'Broilers', 'Layers/Eggs', 'Beef', 'Pork', 'Goats', 'Milk',
    'Honey', 'Mushrooms', 'Macadamia', 'Horticulture'
];
const ZW_STOCK_ITEMS = [
    'Diesel', 'Petrol', 'Compound D', 'Ammonium Nitrate', 'Super Phosphate',
    'Lime', 'Maize Seed', 'Soya Seed', 'Tobacco Seed', 'Wheat Seed',
    'Roundup', 'Gramoxone', 'Acetochlor', 'Dimethoate', 'Cypermethrin',
    'Broiler Starter', 'Broiler Grower', 'Broiler Finisher', 'Layer Mash',
    'Cattle Feed', 'Salt Lick', 'Vaccines', 'Dip Chemical', 'Fencing Wire',
    'Empty Grain Bags', 'Coal', 'Lubricants'
];

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initDate();
    initCurrencyToggle();
    initNetworkStatus();
    initNavigation();
    initAuth(); // Start Auth check
    
    // Initial render from localStorage (fast/offline)
    renderAll();
    renderReports();
    initReportPeriodTabs();
    initLaborTabs();
    
    // Initial dynamic updates
    initFarmDynamicUpdates();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.log('Service Worker Failed: ', err));
    }
});

function initAuth() {
    const loginOverlay = document.getElementById('login-overlay');
    const blackoutOverlay = document.getElementById('blackout-overlay');
    const setupWizardModal = document.getElementById('setup-wizard-modal');
    
    // Check Email Verification Button
    const checkVerifyBtn = document.getElementById('btn-check-verification');
    if (checkVerifyBtn) {
        checkVerifyBtn.onclick = async () => {
            if (state.user) {
                await state.user.reload();
                if (state.user.emailVerified) {
                    location.reload();
                } else {
                    alert("Email not verified yet. Please check your inbox and click the link.");
                }
            }
        };
    }
    onAuthStateChanged(window.auth, async (user) => {
        if (user) {
            state.user = user;
            state.isMasterAdmin = (user.email === 'adminzimarketplace@gmail.com' || user.email === 'master');
            
            try {
                if (state.isMasterAdmin) {
                    state.role = 'SuperAdmin';
                    state.status = 'Active';
                    state.farmId = 'GLOBAL';
                    state.userName = 'Master Admin';
                    
                    const loginOverlay = document.getElementById('login-overlay');
                    const setupWizardModal = document.getElementById('setup-wizard-modal');
                    const verifOverlay = document.getElementById('verification-overlay');
                    const initialLoader = document.getElementById('initial-loader');
                    
                    if (loginOverlay) loginOverlay.classList.add('hidden');
                    if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
                    if (setupWizardModal) setupWizardModal.classList.add('hidden');
                    if (verifOverlay) verifOverlay.classList.add('hidden');
                    if (initialLoader) initialLoader.classList.add('hidden');
                    
                    if (loginOverlay) loginOverlay.classList.add('hidden');
                    if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
                    if (setupWizardModal) setupWizardModal.classList.add('hidden');
                    if (verifOverlay) verifOverlay.classList.add('hidden');
                    if (initialLoader) initialLoader.classList.add('hidden');
                    
                    updateUIForRole();
                    renderExecutiveDashboard();
                    initGlobalAnnouncementListener();
                    
                    // Force navigation to executive view
                    document.getElementById('nav-executive').click();
                    return;
                }

                // 1. Fetch User Profile
                const userDocRef = doc(window.db, "users", user.uid);
                let userSnap = await window.firebaseHelpers.getDoc(userDocRef);
                
                // Phase 6: Email Verification Check
                if (!user.emailVerified) {
                    const verificationOverlay = document.getElementById('verification-overlay');
                    if (verificationOverlay) verificationOverlay.classList.remove('hidden');
                    if (loginOverlay) loginOverlay.classList.add('hidden');
                    const blackoutOverlay = document.getElementById('blackout-overlay');
                    if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
                    const setupWizardModal = document.getElementById('setup-wizard-modal');
                    if (setupWizardModal) setupWizardModal.classList.add('hidden');
                    
                    // 1. Start polling for verification
                    const pollInterval = setInterval(async () => {
                        if (state.user) {
                            await state.user.reload();
                            if (state.user.emailVerified) {
                                clearInterval(pollInterval);
                                location.reload();
                            }
                        } else {
                            clearInterval(pollInterval);
                        }
                    }, 3000);

                    // 2. Logout Handler
                    const logoutVerifyBtn = document.getElementById('btn-logout-verify');
                    if (logoutVerifyBtn) {
                        logoutVerifyBtn.onclick = () => signOut(window.auth).then(() => location.reload());
                    }
                    
                    // 3. Resend Verification Handler
                    const resendBtn = document.getElementById('btn-resend-verification');
                    if (resendBtn) {
                        resendBtn.onclick = async () => {
                            try {
                                await sendEmailVerification(state.user);
                                resendBtn.disabled = true;
                                resendBtn.textContent = "Sent! Wait 60s...";
                                resendBtn.style.opacity = "0.5";
                                setTimeout(() => {
                                    resendBtn.disabled = false;
                                    resendBtn.textContent = "Resend Verification Link";
                                    resendBtn.style.opacity = "1";
                                }, 60000);
                                showSuccessToast("Verification email resent!");
                            } catch (err) {
                                console.error("Resend failed:", err);
                                alert("Error resending email: " + err.message);
                            }
                        };
                    }

                    if (document.getElementById('initial-loader')) document.getElementById('initial-loader').classList.add('hidden');
                    return;
                }
                
                const verifOverlay = document.getElementById('verification-overlay');
                if (verifOverlay) verifOverlay.classList.add('hidden');

                // 2. Handle New User / Invitations
                if (!userSnap.exists()) {
                    // Check if this is an invited user — read invite doc directly by email key
                    const inviteDocRef = doc(window.db, "users", "invite-" + user.email);
                    const inviteSnap = await window.firebaseHelpers.getDoc(inviteDocRef);
                    
                    if (inviteSnap.exists()) {
                        // Matching Invite found! Tether them.
                        const inviteData = inviteSnap.data();
                        
                        await setDoc(userDocRef, {
                            ...inviteData,
                            uid: user.uid,
                            status: 'Active',
                            name: user.displayName || inviteData.name,
                            joinedAt: new Date().toISOString()
                        });
                        
                        // Clean up the placeholder invite doc
                        await window.firebaseHelpers.deleteDoc(inviteDocRef);
                        
                        userSnap = await window.firebaseHelpers.getDoc(userDocRef);
                    } else {
                        // No Invite. Check if this is the very first system user
                        const setupDocRef = doc(window.db, "metadata", "setup");
                        const setupSnap = await window.firebaseHelpers.getDoc(setupDocRef);
                        
                        if (!setupSnap.exists()) {
                            state.role = 'Admin';
                        } else {
                            state.role = 'Worker';
                        }
                        state.status = 'SettingUp';
                        if (setupWizardModal) setupWizardModal.classList.remove('hidden');
                        if (loginOverlay) loginOverlay.classList.add('hidden');
                        if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
                        // Populate wizard checklists
                        populateWizardChecklists();
                        if (document.getElementById('initial-loader')) document.getElementById('initial-loader').classList.add('hidden');
                        return;
                    }
                }

                const userData = userSnap.data();
                state.role = userData.role || 'Worker';
                state.userName = userData.name || user.email.split('@')[0];
                state.farmId = userData.farmId || null;
                state.status = userData.status || (state.role === 'Admin' ? 'Active' : 'Pending');

                // 3. Handle Missing Farm (Setup) - pre-fill farmId if user has it from invite
                if (!state.farmId) {
                    console.log("User detected without FarmId. Launching Wizard.");
                    state.status = 'SettingUp';
                    if (setupWizardModal) setupWizardModal.classList.remove('hidden');
                    if (loginOverlay) loginOverlay.classList.add('hidden');
                    if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
                    populateWizardChecklists();
                    // Auto-switch to join tab and pre-fill farmId if user has one from invite
                    const invitedFarmId = userData.farmId || null;
                    if (invitedFarmId) {
                        const joinTab = document.getElementById('tab-setup-join');
                        if (joinTab) joinTab.click();
                        const joinInput = document.getElementById('wizard-join-id');
                        if (joinInput) joinInput.value = invitedFarmId;
                    }
                    if (document.getElementById('initial-loader')) document.getElementById('initial-loader').classList.add('hidden');
                    return;
                }
                
                // 4. Check Account Status (With Diagnostics)
                if (state.status !== 'Active') {
                    console.warn(`Access denied. Role: ${state.role}, Status: ${state.status}`);
                    const diagEl = document.getElementById('blackout-diag');
                    if (diagEl) diagEl.textContent = `Role: ${state.role} | Status: ${state.status}`;
                    
                    if (blackoutOverlay) blackoutOverlay.classList.remove('hidden');
                    if (loginOverlay) loginOverlay.classList.add('hidden');
                    if (document.getElementById('initial-loader')) document.getElementById('initial-loader').classList.add('hidden');
                    return;
                }

                // 4. Authorized: Load Farm Data
                state.role = userData.role;
                state.userName = userData.name;
                state.farmId = userData.farmId;
                state.status = 'Active';

                // Load Farm Settings
                const farmDoc = await window.firebaseHelpers.getDoc(doc(window.db, "farms", state.farmId));
                if (farmDoc.exists()) {
                    state.farmSettings = { ...state.farmSettings, ...farmDoc.data() };
                    document.title = state.farmSettings.name + " | ZimFarm ERP";
                    state.currency = state.farmSettings.currency || 'USD';
                }

                if (loginOverlay) loginOverlay.classList.add('hidden');
                if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
                if (document.getElementById('initial-loader')) document.getElementById('initial-loader').classList.add('hidden');
                
                updateUIForRole();
                initFirestoreSync();
                initGlobalAnnouncementListener();
                
            } catch (e) {
                console.error("Auth routing error:", e);
            }
        } else {
            state.user = null;
            state.farmId = null;
            state.isMasterAdmin = false;
            
            const initialLoader = document.getElementById('initial-loader');
            if (initialLoader) initialLoader.classList.add('hidden');
            
            if (loginOverlay) loginOverlay.classList.remove('hidden');
            if (blackoutOverlay) blackoutOverlay.classList.add('hidden');
            if (setupWizardModal) setupWizardModal.classList.add('hidden');
        }
    });

    // Logout button for Blackout Screen
    const logoutBlackout = document.getElementById('btn-logout-blackout');
    if (logoutBlackout) {
        logoutBlackout.onclick = () => signOut(window.auth);
    }
    
    // Logout button for Verification Screen
    const logoutVerify = document.getElementById('btn-logout-verify');
    if (logoutVerify) {
        logoutVerify.onclick = () => {
            signOut(window.auth).then(() => {
                state.user = null;
                location.reload();
            });
        };
    }
    
    // Setup Wizard Toggle
    const tabSetupCreate = document.getElementById('tab-setup-create');
    const tabSetupJoin = document.getElementById('tab-setup-join');
    const setupWizardForm = document.getElementById('setup-wizard-form');
    const joinFarmForm = document.getElementById('join-farm-form');

    if (tabSetupCreate && tabSetupJoin) {
        tabSetupCreate.addEventListener('click', () => {
            tabSetupCreate.classList.add('active');
            tabSetupJoin.classList.remove('active');
            setupWizardForm.classList.remove('hidden');
            joinFarmForm.classList.add('hidden');
        });
        tabSetupJoin.addEventListener('click', () => {
            tabSetupJoin.classList.add('active');
            tabSetupCreate.classList.remove('active');
            joinFarmForm.classList.remove('hidden');
            setupWizardForm.classList.add('hidden');
        });
    }

    if (joinFarmForm) {
        joinFarmForm.onsubmit = async (e) => {
            e.preventDefault();
            if (!state.user) return;
            const farmId = document.getElementById('wizard-join-id').value.trim();
            try {
                // Update user doc requesting to join
                await window.firebaseHelpers.setDoc(window.firebaseHelpers.doc(window.db, "users", state.user.uid), {
                    uid: state.user.uid,
                    name: state.user.displayName || state.user.email.split('@')[0],
                    email: state.user.email,
                    role: 'Worker',
                    farmId: farmId,
                    status: 'Pending',
                    createdAt: new Date().toISOString()
                }, { merge: true });
                window.location.reload();
            } catch (err) {
                alert("Join failed: " + err.message);
            }
        };
    }

    // Wizard Form Handler
    const wizardForm = document.getElementById('setup-wizard-form');
    if (wizardForm) {
        wizardForm.onsubmit = async (e) => {
            e.preventDefault();
            if (!state.user) return;
            
            const farmName = document.getElementById('wizard-farm-name').value;
            const currency = document.getElementById('wizard-farm-currency').value;
            const farmLocation = document.getElementById('wizard-farm-location').value;
            const landUnit = document.getElementById('wizard-farm-land-unit')?.value || 'Acres';
            
            const newFarmId = 'FARM-' + Math.random().toString(36).substr(2, 6).toUpperCase();
            
            try {
                // Create Farm Doc
                const coords = getCityCoords(farmLocation);
                const selectedCommodities = [...document.querySelectorAll('.wizard-comm-cb:checked')].map(cb => cb.value);
                const selectedStock = [...document.querySelectorAll('.wizard-stock-cb:checked')].map(cb => cb.value);
                
                await setDoc(doc(window.db, "farms", newFarmId), {
                    id: newFarmId,
                    name: farmName,
                    currency: currency,
                    location: farmLocation,
                    landUnit: landUnit,
                    lat: coords.lat,
                    lon: coords.lon,
                    commodities: selectedCommodities,
                    stockRegistry: selectedStock,
                    createdAt: new Date().toISOString(),
                    ownerUid: state.user.uid
                });
                
                // Create User Doc
                await setDoc(doc(window.db, "users", state.user.uid), {
                    uid: state.user.uid,
                    name: state.user.displayName || state.user.email.split('@')[0],
                    email: state.user.email,
                    role: 'Admin',
                    farmId: newFarmId,
                    status: 'Active',
                    createdAt: new Date().toISOString()
                });
                
                // Mark System Setup Complete
                await setDoc(doc(window.db, "metadata", "setup"), {
                    firstUserCreated: true,
                    firstFarmId: newFarmId,
                    setupAt: new Date().toISOString()
                }, { merge: true });
                
                window.location.reload(); // Refresh to initialize with new farmId
            } catch (err) {
                alert("Setup failed: " + err.message);
            }
        };
    }

    // Helper: Populate wizard checklists
    function populateWizardChecklists() {
        const commList = document.getElementById('wizard-commodities-list');
        const stockList = document.getElementById('wizard-stock-list');
        if (commList && commList.children.length === 0) {
            commList.innerHTML = ZW_COMMODITIES.map((item, i) => `
                <label style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:10px; background:rgba(255,255,255,0.04); cursor:pointer; font-size:0.88rem;">
                    <input type="checkbox" class="wizard-comm-cb" value="${item}" style="accent-color:var(--primary-green);">
                    ${item}
                </label>
            `).join('');
        }
        if (stockList && stockList.children.length === 0) {
            stockList.innerHTML = ZW_STOCK_ITEMS.map((item, i) => `
                <label style="display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:10px; background:rgba(255,255,255,0.04); cursor:pointer; font-size:0.88rem;">
                    <input type="checkbox" class="wizard-stock-cb" value="${item}" style="accent-color:var(--primary-green);">
                    ${item}
                </label>
            `).join('');
        }
    }

    // Login Form Handler
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const identifier = document.getElementById('login-email').value;
            const pass = document.getElementById('login-password').value;
            const errEl = document.getElementById('auth-error');
            errEl.textContent = '';

            // Map 'master' username to email
            const isMaster = identifier.toLowerCase() === 'master';
            const email = isMaster ? 'adminzimarketplace@gmail.com' : identifier;

            try {
                await signInWithEmailAndPassword(window.auth, email, pass);
            } catch (error) {
                // If master admin doesn't exist yet, create it on first attempt with default credentials
                if (isMaster && pass === 'murimisi' && (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential')) {
                    try {
                        const userCredential = await createUserWithEmailAndPassword(window.auth, email, pass);
                        const user = userCredential.user;
                        await setDoc(doc(window.db, "users", user.uid), {
                            name: 'Master Admin',
                            email: email,
                            role: 'Admin',
                            status: 'Active',
                            createdAt: new Date().toISOString()
                        });
                        // Mark as setup to ensure future signups are 'Worker' by default
                        const setupDocRef = window.firebaseHelpers.doc(window.db, "metadata", "setup");
                        await setDoc(setupDocRef, { firstUserCreated: true, adminInit: 'master', createdAt: new Date().toISOString() });
                        return; // onAuthStateChanged will handle the UI
                    } catch (signupError) {
                        errEl.textContent = "Error initializing admin account: " + signupError.message;
                        return;
                    }
                }
                errEl.innerHTML = `Invalid username/email or password.<br><a href="#" id="link-forgot-password" style="color:var(--primary-light); text-decoration:underline; font-size:0.85rem; margin-top:6px; display:inline-block;">Forgot Password?</a>`;
                console.error("Auth Error:", error);
                
                setTimeout(() => {
                    const forgotLink = document.getElementById('link-forgot-password');
                    if (forgotLink && email) {
                        forgotLink.onclick = async (ev) => {
                            ev.preventDefault();
                            if (email.toLowerCase() === 'master' || email === 'adminzimarketplace@gmail.com') return; 
                            try {
                                await sendPasswordResetEmail(window.auth, email);
                                errEl.innerHTML = `<span style="color:var(--primary-light);">Password reset link sent to ${email}</span>`;
                            } catch (resetErr) {
                                errEl.textContent = 'Failed to send reset email: ' + resetErr.message;
                            }
                        };
                    }
                }, 0);
            }
        });
    }

    // Signup Form Handler
    const signupForm = document.getElementById('signup-form');
    if (signupForm) {
        signupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('signup-name').value;
            const email = document.getElementById('signup-email').value;
            const pass = document.getElementById('signup-password').value;
            const passConfirm = document.getElementById('signup-password-confirm').value;
            const errEl = document.getElementById('signup-error');
            errEl.textContent = '';
            
            if (pass !== passConfirm) {
                errEl.textContent = "Passwords do not match.";
                return;
            }

            try {
                const userCredential = await createUserWithEmailAndPassword(window.auth, email, pass);
                const user = userCredential.user;
                const userProfileRef = doc(window.db, "users", user.uid);
                
                // Now authenticated, we can check for setup and invites
                const setupDocRef = window.firebaseHelpers.doc(window.db, "metadata", "setup");
                const setupSnap = await window.firebaseHelpers.getDoc(setupDocRef);
                const isFirstUser = !setupSnap.exists();
                
                const inviteDocRef = window.firebaseHelpers.doc(window.db, "users", "invite-" + email);
                const inviteSnap = await window.firebaseHelpers.getDoc(inviteDocRef);

                if (inviteSnap.exists()) {
                    // Invited user - pre-populate their profile from invite data
                    const inviteData = inviteSnap.data();
                    await setDoc(userProfileRef, {
                        ...inviteData,
                        uid: user.uid,
                        name: name || inviteData.name,
                        email: email,
                        status: 'Active', // Auto-activate if invited
                        joinedAt: new Date().toISOString()
                    });
                    // Clean up placeholder invite doc
                    await window.firebaseHelpers.deleteDoc(inviteDocRef);
                } else {
                    await setDoc(userProfileRef, {
                        name: name,
                        email: email,
                        role: isFirstUser ? 'Admin' : 'Worker',
                        status: isFirstUser ? 'Active' : 'Pending',
                        createdAt: new Date().toISOString()
                    });
                }
                
                if (isFirstUser) {
                    await setDoc(setupDocRef, { firstUserCreated: true, createdAt: new Date().toISOString() });
                }
                
                await sendEmailVerification(user);
                
                if (inviteSnap && inviteSnap.exists()) {
                    errEl.innerHTML = `<span style="color:var(--primary-light);">Account created! Please check your email to verify. You have been pre-assigned to your farm — approval pending from your Farm Admin.</span>`;
                } else {
                    errEl.innerHTML = `<span style="color:var(--primary-light);">Account created! Please check your email to verify.</span>`;
                }
            } catch (error) {
                if (error.code === 'auth/email-already-in-use') {
                    errEl.textContent = 'This email is already registered. Please log in instead.';
                } else {
                    errEl.textContent = error.message;
                }
                console.error("Signup Error:", error);
            }
        });
    }

    // Toggle between Login and Signup (Links)
    const linkLogin = document.getElementById('link-to-login');
    const linkSignup = document.getElementById('link-to-signup');
    const loginSection = document.getElementById('login-section');
    const signupSection = document.getElementById('signup-section');

    if (linkLogin && linkSignup) {
        const switchTab = (tab) => {
            if (tab === 'login') {
                loginSection.classList.remove('hidden');
                signupSection.classList.add('hidden');
            } else {
                signupSection.classList.remove('hidden');
                loginSection.classList.add('hidden');
            }
        };

        linkLogin.addEventListener('click', (e) => { e.preventDefault(); switchTab('login'); });
        linkSignup.addEventListener('click', (e) => { e.preventDefault(); switchTab('signup'); });
    }

    // Logout Handler
    const logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            signOut(window.auth).then(() => {
                state.user = null;
                activities = [];
                inventory = [];
                farmFields = [];
                farmEquipment = [];
                livestock = [];
                teamWorkers = [];
                teamTasks = [];
                teamPayroll = [];
                location.reload();
            });
        });
    }
}

function initWorkerStatusToggle() {
    const toggleContainer = document.getElementById('status-toggle-container');
    const selectEl = document.getElementById('worker-status-select');
    const dotEl = document.getElementById('worker-presence-indicator');
    
    if (toggleContainer && state.status === 'Active' && state.user) {
        toggleContainer.classList.remove('hidden');
        
        onSnapshot(window.firebaseHelpers.doc(window.db, "users", state.user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const presence = data.presence || 'Offline';
                if (selectEl) selectEl.value = presence;
                if (dotEl) dotEl.className = `presence-dot ${presence.toLowerCase()}`;
            }
        });
        
        if (selectEl) {
            selectEl.onchange = async (e) => {
                const newPresence = e.target.value;
                if (dotEl) dotEl.className = `presence-dot ${newPresence.toLowerCase()}`;
                try {
                    await window.firebaseHelpers.setDoc(window.firebaseHelpers.doc(window.db, "users", state.user.uid), { presence: newPresence }, { merge: true });
                } catch (err) {
                    console.error("Failed to update presence:", err);
                }
            };
        }
    }
}

function updateUIForRole() {
    const role = state.role;
    console.log(`Updating UI for role: ${role}`);
    
    // Update Profile UI
    document.getElementById('user-name').textContent = state.userName;
    document.getElementById('user-role-badge').textContent = role;
    document.getElementById('user-greeting').textContent = `${getShonaGreeting()}, ${state.userName}`;
    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${state.userName}&background=4CAF50&color=fff`;

    // Initialize Worker Status Toggle
    initWorkerStatusToggle();

    // Filter elements based on data-role
    const elements = document.querySelectorAll('[data-role]');
    elements.forEach(el => {
        const allowedRoles = el.getAttribute('data-role').split(',');
        // Provide Admin views to Manager and SuperAdmin can see Admin stuff if needed, though they stay on executive tab
        if (allowedRoles.includes(role) || (role === 'SuperAdmin' && allowedRoles.includes('Admin'))) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    if (role === 'Admin') {
        renderUsers();
    }
    
    if (role === 'SuperAdmin') {
        const execNav = document.getElementById('nav-executive');
        if (execNav) execNav.classList.remove('hidden');
    }
}

async function renderUsers() {
    const usersListEl = document.getElementById('users-list');
    if (!usersListEl) return;
    
    // Query 1: Users tethered to this farm (Active/Suspended)
    const farmUsersQuery = query(collection(db, "users"), where("farmId", "==", state.farmId));
    // Query 2: Users invited to this farm who signed up but are pending (invitedBy links them indirectly via farmId)
    const pendingQuery = query(collection(db, "users"), where("farmId", "==", state.farmId));

    const renderSnapshot = (snapshot) => {
        usersListEl.innerHTML = '';
        snapshot.forEach((userDoc) => {
            const userData = userDoc.data();
            const userId = userDoc.id;
            const isSelf = state.user && userId === state.user.uid;
            const isInvite = userId.startsWith('invite-');
            const statusColor = userData.status === 'Active' ? 'var(--primary-light)' : (userData.status === 'Pending' ? 'var(--accent-gold)' : 'var(--text-muted)');

            usersListEl.innerHTML += `
                <div class="glass-card activity-item" style="padding: 16px; flex-wrap: wrap; gap: 10px;">
                    <div class="activity-icon ${userData.status === 'Active' ? 'success' : 'warning'}">
                        <i class="fa-solid ${isInvite ? 'fa-envelope' : (userData.role === 'Admin' ? 'fa-user-shield' : 'fa-user')}"></i>
                    </div>
                    <div class="activity-details" style="flex:1; min-width:0;">
                        <h4>${userData.name || userData.email} ${isSelf ? '<span style="font-size:0.7rem; opacity:0.6;">(You)</span>' : ''}</h4>
                        <p style="font-size:0.8rem;">${userData.email || ''}</p>
                        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                            <span style="font-size:0.7rem; padding:2px 8px; border-radius:8px; background:rgba(46,139,87,0.15); color:var(--primary-light);">${userData.role || 'Worker'}</span>
                            <span style="font-size:0.7rem; padding:2px 8px; border-radius:8px; background:rgba(255,255,255,0.07); color:${statusColor};">${userData.status || 'Unknown'}</span>
                        </div>
                    </div>
                    ${!isSelf ? `
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                        <select onchange="updateUserRole('${userId}', this.value)" style="padding:4px 8px; border-radius:8px; font-size:0.78rem; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-glass);">
                            <option value="Worker" ${userData.role === 'Worker' ? 'selected' : ''}>Worker</option>
                            <option value="Manager" ${userData.role === 'Manager' ? 'selected' : ''}>Manager</option>
                            <option value="Admin" ${userData.role === 'Admin' ? 'selected' : ''}>Admin</option>
                        </select>
                        <select onchange="updateUserStatus('${userId}', this.value)" style="padding:4px 8px; border-radius:8px; font-size:0.78rem; background:var(--bg-dark); color:var(--text-main); border:1px solid var(--border-glass);">
                            <option value="Active" ${userData.status === 'Active' ? 'selected' : ''}>Active</option>
                            <option value="Pending" ${userData.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Suspended" ${userData.status === 'Suspended' ? 'selected' : ''}>Suspended</option>
                        </select>
                    </div>
                    ` : ''}
                </div>
            `;
        });

        // Show Farm ID at top
        const farmIdBanner = document.createElement('div');
        farmIdBanner.style.cssText = 'text-align:center; font-size:0.78rem; color:var(--text-muted); padding:8px; margin-bottom:8px; background:rgba(255,255,255,0.03); border-radius:12px;';
        farmIdBanner.innerHTML = `<i class="fa-solid fa-fingerprint" style="margin-right:6px;"></i>Farm ID: <strong style="color:var(--primary-light); user-select:all;">${state.farmId}</strong>`;
        usersListEl.insertBefore(farmIdBanner, usersListEl.firstChild);
    };

    onSnapshot(farmUsersQuery, renderSnapshot);
}

async function updateUserRole(uid, newRole) {
    if (!confirm(`Change user role to ${newRole}?`)) return;
    try {
        await setDoc(doc(db, "users", uid), { role: newRole }, { merge: true });
        showSuccessToast(`Role updated to ${newRole}`);
    } catch (e) {
        console.error("Failed to update role:", e);
        showSuccessToast("Error: Permission Denied");
    }
}

async function updateUserStatus(uid, newStatus) {
    if (!confirm(`Change user status to ${newStatus}?`)) return;
    try {
        await setDoc(doc(db, "users", uid), { status: newStatus }, { merge: true });
        showSuccessToast(`Status updated to ${newStatus}`);
    } catch (e) {
        console.error("Failed to update status:", e);
        showSuccessToast("Error: Permission Denied");
    }
}

// ==========================================
// EXECUTIVE DASHBOARD LOGIC
// ==========================================

function initGlobalAnnouncementListener() {
    onSnapshot(doc(window.db, "metadata", "announcement"), (docSnap) => {
        const banner = document.getElementById('system-announcement-banner');
        const textSpan = document.getElementById('system-announcement-text');
        const execDisplay = document.getElementById('current-announcement-display');
        
        if (docSnap.exists() && docSnap.data().message) {
            const msg = docSnap.data().message;
            if (banner && textSpan) {
                textSpan.textContent = msg;
                banner.classList.remove('hidden');
            }
            if (execDisplay) execDisplay.textContent = msg;
        } else {
            if (banner) banner.classList.add('hidden');
            if (execDisplay) execDisplay.textContent = 'None';
        }
    });
}

async function publishAnnouncement() {
    const input = document.getElementById('exec-announcement-input');
    if (!input || !input.value.trim()) return;
    
    try {
        await setDoc(doc(window.db, "metadata", "announcement"), { 
            message: input.value.trim(),
            updatedAt: new Date().toISOString(),
            by: state.userName
        });
        showSuccessToast("System announcement published!");
        input.value = '';
    } catch (e) {
        console.error("Failed to publish announcement", e);
        showSuccessToast("Failed to publish. Check permissions.");
    }
}

async function clearAnnouncement() {
    try {
        await window.firebaseHelpers.deleteDoc(doc(window.db, "metadata", "announcement"));
        showSuccessToast("Announcement cleared.");
    } catch (e) {
        console.error("Failed to clear announcement", e);
    }
}

async function renderExecutiveDashboard() {
    const fromFirestore = window.firebaseHelpers.getDocs ? window.firebaseHelpers.getDocs : async (q) => {
        // Fallback if not exported, using standard getting
        return new Promise((resolve) => {
            onSnapshot(q, snap => resolve(snap));
        });
    };

    try {
        const farmsCol = collection(window.db, "farms");
        const usersCol = collection(window.db, "users");
        
        onSnapshot(farmsCol, (snapshot) => {
            const execFarmList = document.getElementById('exec-farm-list');
            if (execFarmList) execFarmList.innerHTML = '';
            
            document.getElementById('exec-total-farms').textContent = snapshot.size;
            
            snapshot.forEach(docSnap => {
                const farmId = docSnap.id;
                const data = docSnap.data();
                const plan = data.plan || 'Solo';
                const createdDate = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : 'Unknown';
                
                const card = document.createElement('div');
                card.className = "glass-card activity-item";
                card.style.cssText = "padding: 16px; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;";
                               card.innerHTML = `
                    <div class="activity-icon ${plan === 'Premium' ? 'success' : 'info'}">
                        <i class="fa-solid fa-tractor"></i>
                    </div>
                    <div class="activity-details" style="flex:1; min-width:0;">
                        <h4>${data.name || 'Unnamed Farm'} <span style="font-size:0.7rem; font-weight:normal; color:var(--text-muted);">(${farmId})</span></h4>
                        <p style="font-size:0.8rem;"><i class="fa-solid fa-location-dot" style="margin-right:4px;"></i>${data.location || 'Unknown'}</p>
                        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                            <span style="font-size:0.7rem; padding:2px 8px; border-radius:8px; background:rgba(255,255,255,0.07); color:var(--text-main);">Joined: ${createdDate}</span>
                            <span style="font-size:0.7rem; padding:2px 8px; border-radius:8px; background:${plan === 'Premium' ? 'rgba(74,222,128,0.15)' : 'var(--border-glass)'}; color:${plan === 'Premium' ? 'var(--primary-light)' : 'var(--text-muted)'};">  ${plan} Plan</span>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:6px; align-items:flex-end;">
                        ${plan !== 'Premium' ? `
                            <button onclick="upgradeFarmToPremium('${farmId}')" style="background:var(--primary-light); color:var(--bg-dark); border:none; padding:6px 12px; border-radius:8px; font-size:0.8rem; font-weight:bold; cursor:pointer;">
                                <i class="fa-solid fa-gem" style="margin-right:4px;"></i> Upgrade
                            </button>
                        ` : `
                            <button onclick="downgradeFarmToSolo('${farmId}')" style="background:transparent; color:var(--text-muted); border:1px solid var(--border-glass); padding:6px 12px; border-radius:8px; font-size:0.8rem; cursor:pointer;">
                                Downgrade
                            </button>
                        `}
                        <button onclick="deleteFarm('${farmId}')" style="background:transparent; color:var(--accent-danger); border:1px solid rgba(244,63,94,0.3); padding:4px 10px; border-radius:6px; font-size:0.72rem; cursor:pointer;">
                            <i class="fa-solid fa-trash"></i> Delete Farm
                        </button>
                    </div>
                `;
                execFarmList.appendChild(card);
            });
        });
        
        onSnapshot(usersCol, (snapshot) => {
            const execUserList = document.getElementById('exec-user-list');
            if (execUserList) execUserList.innerHTML = '';
            
            document.getElementById('exec-total-users').textContent = snapshot.size;
            
            snapshot.forEach(docSnap => {
                const userId = docSnap.id;
                const data = docSnap.data();
                if (!data.email) return; // Skip non-user docs
                
                if (execUserList && data.email !== 'adminzimarketplace@gmail.com') {
                    const card = document.createElement('div');
                    card.className = "glass-card activity-item";
                    card.style.cssText = "padding: 12px; gap: 10px; margin-bottom: 8px;";
                    card.innerHTML = `
                        <div class="activity-icon info"><i class="fa-solid fa-user"></i></div>
                        <div class="activity-details" style="flex:1; min-width:0;">
                            <h4 style="font-size:0.85rem;">${data.name || data.email}</h4>
                            <p style="font-size:0.75rem;">${data.email} | Farm: ${data.farmId || 'None'}</p>
                        </div>
                        <button onclick="deleteUserAccount('${userId}')" style="background:transparent; color:var(--accent-danger); border:1px solid rgba(244,63,94,0.3); padding:4px 8px; border-radius:6px; font-size:0.7rem; cursor:pointer;">
                            <i class="fa-solid fa-trash"></i> Delete
                        </button>
                    `;
                    execUserList.appendChild(card);
                }
            });
        });

    } catch (e) {
        console.error("Failed to load executive dashboard data:", e);
    }
}

async function deleteUserAccount(userId) {
    if (!confirm(`Are you sure you want to completely delete the user document for ${userId}? This cannot be undone.`)) return;
    try {
        await window.firebaseHelpers.deleteDoc(doc(window.db, "users", userId));
        showSuccessToast("User account document successfully deleted.");
    } catch (e) {
        console.error("Failed to delete user:", e);
        showSuccessToast("Failed to delete user. Check permissions.");
    }
}

async function deleteFarm(farmId) {
    if (!confirm(`⚠️ Permanently delete farm "${farmId}"? This cannot be undone!`)) return;
    try {
        await window.firebaseHelpers.deleteDoc(doc(window.db, "farms", farmId));
        showSuccessToast(`Farm ${farmId} has been deleted.`);
    } catch (e) {
        console.error("Failed to delete farm:", e);
        showSuccessToast('Failed to delete farm. Check permissions.');
    }
}

async function upgradeFarmToPremium(farmId) {
    if (!confirm(`Upgrade farm ${farmId} to Premium Plan?`)) return;
    try {
        await setDoc(doc(window.db, "farms", farmId), { plan: "Premium" }, { merge: true });
        showSuccessToast("Farm successfully upgraded to Premium!");
    } catch (e) {
        console.error("Upgrade failed:", e);
        showSuccessToast("Failed to upgrade server.");
    }
}

async function downgradeFarmToSolo(farmId) {
    if (!confirm(`Downgrade farm ${farmId} back to Solo Plan?`)) return;
    try {
        await setDoc(doc(window.db, "farms", farmId), { plan: "Solo" }, { merge: true });
        showSuccessToast("Farm downgraded to Solo plan.");
    } catch (e) {
        console.error("Downgrade failed:", e);
        showSuccessToast("Failed to downgrade farm.");
    }
}

function renderAll() {
    renderActivities();
    renderInventory();
    renderFields();
    renderEquipment();
    renderLivestock();
    renderWorkers();
    renderTasks();
    renderPayroll();
}

// =====================================================
// PHASE 4: FINANCIAL REPORTS ENGINE
// =====================================================

const fmt = (n) => `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// =====================================================
// PHASE 7: STRUCTURED FINANCIAL CATEGORIES
// Activities now carry .category, .amount, .impact fields
// =====================================================
const EXPENSE_MAP = {
    'diesel':         { label: 'Diesel / Fuel',      icon: 'fa-gas-pump',     color: '#f87171' },
    'labor':          { label: 'Labour (Maricho)',    icon: 'fa-users',        color: '#60a5fa' },
    'wages':          { label: 'Registered Wages',   icon: 'fa-money-bill-wave', color: '#818cf8' },
    'inputs':         { label: 'Farm Inputs',        icon: 'fa-seedling',     color: '#4ade80' },
    'maintenance':    { label: 'Equipment Maint.',   icon: 'fa-wrench',       color: '#fb923c' },
    'treatment':      { label: 'Vet / Health',       icon: 'fa-syringe',      color: '#a78bfa' },
    'stock-purchase': { label: 'Stock Purchases',    icon: 'fa-boxes-stacked',color: '#38bdf8' },
};

const INCOME_MAP = {
    'sales': { label: 'Crop / Product Sales', icon: 'fa-truck-fast', color: '#4ade80' },
};

// Resolve category from structured field first, fallback to icon-based detection
function getActivityCategory(act) {
    // Prefer structured category field (new activities)
    if (act.category) {
        const isExpense = EXPENSE_MAP[act.category];
        const isIncome  = INCOME_MAP[act.category];
        if (isExpense) return { type: 'expense', key: act.category };
        if (isIncome)  return { type: 'income',  key: act.category };
    }
    // Legacy fallback — icon-based detection for old records
    const icon = act.icon || '';
    if (icon.includes('gas-pump'))     return { type: 'expense', key: 'diesel' };
    if (icon.includes('users'))        return { type: 'expense', key: 'labor' };
    if (icon.includes('money-bill'))   return { type: 'expense', key: 'wages' };
    if (icon.includes('seedling'))     return { type: 'expense', key: 'inputs' };
    if (icon.includes('wrench'))       return { type: 'expense', key: 'maintenance' };
    if (icon.includes('syringe'))      return { type: 'expense', key: 'treatment' };
    if (icon.includes('boxes-stacked') && act.title?.toLowerCase().includes('receiv')) return { type: 'expense', key: 'stock-purchase' };
    if (icon.includes('truck-fast'))   return { type: 'income',  key: 'sales' };
    return null;
}

// Resolve amount from structured field first, fallback to regex
function resolveAmount(act, map) {
    if (act.amount !== undefined && act.amount !== null && !isNaN(act.amount)) {
        return parseFloat(act.amount);
    }
    // Legacy regex extractors
    const legacyExtractors = {
        'diesel':         (a) => { const m = a.info?.match(/(\d+\.?\d*)L/i); return m ? parseFloat(m[1]) * 1.50 : 0; },
        'labor':          (a) => { const m = a.info?.match(/\$(\d+\.?\d*)/); return m ? parseFloat(m[1]) : 0; },
        'wages':          (a) => { const m = a.info?.match(/\$(\d+\.?\d*)/); return m ? parseFloat(m[1]) : 0; },
        'maintenance':    (a) => { const m = a.info?.match(/Cost:\s*\$(\d+\.?\d*)/); return m ? parseFloat(m[1]) : 0; },
        'treatment':      (a) => { const m = a.info?.match(/Cost:\s*\$(\d+\.?\d*)/); return m ? parseFloat(m[1]) : 0; },
        'stock-purchase': (a) => { const m = a.info?.match(/Cost:\s*\$(\d+\.?\d*)/); return m ? parseFloat(m[1]) : 0; },
        'sales':          (a) => { const m = a.info?.match(/\$(\d+\.?\d*)/); return m ? parseFloat(m[1]) : 0; },
        'inputs':         (a) => 0,
    };
    const catKey = act.category || '';
    const fn = legacyExtractors[catKey];
    return fn ? fn(act) : 0;
}

function filterActivitiesByPeriod(acts, period) {
    const now = new Date();
    return acts.filter(a => {
        if (!a.time) return true;
        const d = new Date(a.time);
        if (period === 'month') {
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        } else if (period === 'quarter') {
            const q = Math.floor(now.getMonth() / 3);
            const dq = Math.floor(d.getMonth() / 3);
            return dq === q && d.getFullYear() === now.getFullYear();
        } else if (period === 'year') {
            return d.getFullYear() === now.getFullYear();
        }
        return true; // 'all'
    });
}

let currentReportPeriod = 'month';

function renderReports() {
    const acts = filterActivitiesByPeriod(activities, currentReportPeriod);
    
    // Aggregate — uses structured .amount where available, regex as legacy fallback
    const incomeByKey   = {};
    const expenseByKey  = {};
    const transactions  = [];

    acts.forEach(act => {
        const cat = getActivityCategory(act);
        if (!cat) return;

        if (cat.type === 'income') {
            const m = INCOME_MAP[cat.key];
            if (!m) return;
            const amount = resolveAmount(act, m);
            if (amount <= 0) return;
            incomeByKey[cat.key] = (incomeByKey[cat.key] || 0) + amount;
            transactions.push({ type: 'income', key: cat.key, label: act.title || m.label, info: act.info, amount, time: act.time, icon: m.icon, color: m.color });
        } else {
            const m = EXPENSE_MAP[cat.key];
            if (!m) return;
            const amount = resolveAmount(act, m);
            if (amount <= 0) return;
            expenseByKey[cat.key] = (expenseByKey[cat.key] || 0) + amount;
            transactions.push({ type: 'expense', key: cat.key, label: act.title || m.label, info: act.info, amount, time: act.time, icon: m.icon, color: m.color });
        }
    });

    const totalIncome   = Object.values(incomeByKey).reduce((a, b) => a + b, 0);
    const totalExpenses = Object.values(expenseByKey).reduce((a, b) => a + b, 0);
    const netProfit     = totalIncome - totalExpenses;
    const margin        = totalIncome > 0 ? ((netProfit / totalIncome) * 100).toFixed(1) : 0;
    const gaugeWidth    = totalIncome > 0 ? Math.min((totalIncome / (totalIncome + totalExpenses)) * 100, 100) : 0;

    // Update header figures
    document.getElementById('report-income').textContent   = fmt(totalIncome);
    document.getElementById('report-expenses').textContent = fmt(totalExpenses);

    const netEl = document.getElementById('report-net');
    netEl.textContent = (netProfit < 0 ? '-' : '') + fmt(netProfit);
    netEl.classList.toggle('negative', netProfit < 0);

    const netCard = document.getElementById('net-profit-card');
    netCard.classList.toggle('loss', netProfit < 0);

    const gaugeFill = document.getElementById('gauge-fill');
    gaugeFill.style.width = gaugeWidth + '%';
    gaugeFill.classList.toggle('negative', netProfit < 0);

    document.getElementById('report-margin').textContent = `Profit Margin: ${margin}% ${netProfit >= 0 ? '📈' : '📉'}`;

    // Render income breakdown
    const incomeEl = document.getElementById('income-breakdown');
    const maxIncome = Math.max(...Object.values(incomeByKey), 0.01);
    if (Object.keys(incomeByKey).length === 0) {
        incomeEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-receipt"></i>No income recorded for this period.</div>`;
    } else {
        incomeEl.innerHTML = Object.entries(incomeByKey).map(([key, amount]) => {
            const m = INCOME_MAP[key];
            const pct = (amount / maxIncome) * 100;
            return `<div class="breakdown-row">
                <div class="breakdown-row-header">
                    <span class="breakdown-category"><i class="fa-solid ${m.icon}" style="color:${m.color}; width:16px;"></i> ${m.label}</span>
                    <span class="breakdown-amount" style="color:var(--primary-light);">+${fmt(amount)}</span>
                </div>
                <div class="breakdown-bar-track"><div class="breakdown-bar-fill income" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
    }

    // Render expense breakdown
    const expenseEl = document.getElementById('expense-breakdown');
    const maxExpense = Math.max(...Object.values(expenseByKey), 0.01);
    if (Object.keys(expenseByKey).length === 0) {
        expenseEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-circle-check"></i>No expenses recorded for this period.</div>`;
    } else {
        expenseEl.innerHTML = Object.entries(expenseByKey).map(([key, amount]) => {
            const m = EXPENSE_MAP[key];
            const pct = (amount / maxExpense) * 100;
            return `<div class="breakdown-row">
                <div class="breakdown-row-header">
                    <span class="breakdown-category"><i class="fa-solid ${m.icon}" style="color:${m.color}; width:16px;"></i> ${m.label}</span>
                    <span class="breakdown-amount" style="color:var(--accent-danger);">-${fmt(amount)}</span>
                </div>
                <div class="breakdown-bar-track"><div class="breakdown-bar-fill expense" style="width:${pct}%"></div></div>
            </div>`;
        }).join('');
    }

    // Render transaction log (most recent first)
    const txEl = document.getElementById('transaction-log');
    const sorted = [...transactions].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 15);
    if (sorted.length === 0) {
        txEl.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clock-rotate-left"></i>No transactions yet for this period.</div>`;
    } else {
        txEl.innerHTML = sorted.map(tx => {
            const date = tx.time ? new Date(tx.time).toLocaleDateString('en-ZW', { day: 'numeric', month: 'short' }) : '—';
            return `<div class="tx-row">
                <div class="tx-icon ${tx.type}"><i class="fa-solid ${tx.icon}"></i></div>
                <div class="tx-details">
                    <h4>${tx.label}</h4>
                    <p>${date}</p>
                </div>
                <span class="tx-amount ${tx.type}">${tx.type === 'income' ? '+' : '-'}${fmt(tx.amount)}</span>
            </div>`;
        }).join('');
    }
}

function initReportPeriodTabs() {
    const periodLabels = { month: 'This Month', quarter: 'This Quarter', year: 'This Year', all: 'All Time' };
    document.querySelectorAll('.report-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentReportPeriod = tab.dataset.period;
            document.getElementById('report-period-label').textContent = periodLabels[currentReportPeriod];
            renderReports();
        });
    });
}

// =====================================================
// PHASE 5: LABOR & MARICHO ENGINE
// =====================================================

function initLaborTabs() {
    const tabs = ['tab-workers', 'tab-tasks', 'tab-payroll', 'tab-app-users'];
    tabs.forEach(tabId => {
        const tabEl = document.getElementById(tabId);
        if (tabEl) {
            tabEl.addEventListener('click', () => {
                // Remove active from all tabs
                tabs.forEach(t => {
                    const el = document.getElementById(t);
                    if (el) el.classList.remove('active');
                });
                tabEl.classList.add('active');
                
                // Hide all sections
                document.querySelectorAll('.labor-section').forEach(sec => sec.classList.add('hidden'));
                
                // Show selected section
                const targetSec = document.getElementById(`labor-sec-${tabId.split('-')[1]}`);
                if (targetSec) targetSec.classList.remove('hidden');
                
                if (tabId === 'tab-app-users') {
                    const targetAppUsersSec = document.getElementById('labor-sec-app-users');
                    if(targetAppUsersSec) targetAppUsersSec.classList.remove('hidden');
                }
            });
        }
    });
}

function renderWorkers() {
    const el = document.getElementById('workers-list');
    if (!el) return;
    if (teamWorkers.length === 0) {
        el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-hard-hat" style="font-size:2rem; color:var(--text-muted); display:block; margin-bottom:10px;"></i>No workers registered.<br><small style="color:var(--text-muted); font-size:0.8rem;">Add workers using the + button above.</small></div>`;
        return;
    }
    el.innerHTML = teamWorkers.map(w => {
        const totalPaid = teamPayroll.filter(p => p.workerId === w.id).reduce((sum, p) => sum + (p.amount || 0), 0);
        const pendingTasks = teamTasks.filter(t => t.workerId === w.id && t.status !== 'Completed').length;
        const isPerm = w.type === 'Permanent';
        return `
        <div class="glass-card activity-item" style="padding: 16px; flex-wrap:wrap; gap:10px;">
            <div class="activity-icon ${isPerm ? 'success' : 'warning'}">
                <i class="fa-solid ${isPerm ? 'fa-id-card' : 'fa-hard-hat'}"></i>
            </div>
            <div class="activity-details" style="flex:1; min-width:0;">
                <h4>${w.name}</h4>
                <p style="font-size:0.82rem;">${w.type} &nbsp;·&nbsp; $${w.rate}/${w.rateType}</p>
                <div style="display:flex; gap:8px; margin-top:6px; flex-wrap:wrap;">
                    <span style="font-size:0.72rem; padding:2px 8px; border-radius:8px; background:rgba(74,222,128,0.1); color:var(--primary-light);">
                        <i class="fa-solid fa-money-bill-wave" style="margin-right:3px;"></i>Total Paid: $${totalPaid.toFixed(2)}
                    </span>
                    <span style="font-size:0.72rem; padding:2px 8px; border-radius:8px; background:rgba(251,191,36,0.1); color:var(--accent-gold);">
                        <i class="fa-solid fa-list-check" style="margin-right:3px;"></i>${pendingTasks} Pending Task${pendingTasks !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:6px;">
                <button onclick="openPayForWorker('${w.id}')" style="background:rgba(74,222,128,0.1); color:var(--primary-light); border:1px solid rgba(74,222,128,0.2); padding:5px 10px; border-radius:8px; font-size:0.75rem; cursor:pointer;">
                    <i class="fa-solid fa-dollar-sign"></i> Pay
                </button>
                <button onclick="openAssignForWorker('${w.id}')" style="background:rgba(96,165,250,0.1); color:#60a5fa; border:1px solid rgba(96,165,250,0.2); padding:5px 10px; border-radius:8px; font-size:0.75rem; cursor:pointer;">
                    <i class="fa-solid fa-clipboard-list"></i> Task
                </button>
            </div>
        </div>`;
    }).join('');
}

function renderTasks() {
    const el = document.getElementById('tasks-list');
    if (!el) return;
    if (teamTasks.length === 0) {
        el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-clipboard-list" style="font-size:2rem; color:var(--text-muted); display:block; margin-bottom:10px;"></i>No tasks assigned.<br><small style="color:var(--text-muted); font-size:0.8rem;">Assign tasks to workers using the + button above.</small></div>`;
        return;
    }
    // Sort: Pending first, then by date assigned
    const sorted = [...teamTasks].sort((a, b) => {
        if (a.status === 'Completed' && b.status !== 'Completed') return 1;
        if (a.status !== 'Completed' && b.status === 'Completed') return -1;
        return new Date(b.dateAssigned || 0) - new Date(a.dateAssigned || 0);
    });
    const priorityColors = { 'High': '#f43f5e', 'Medium': '#fbbf24', 'Low': '#4ade80' };
    el.innerHTML = sorted.map(t => {
        const worker = teamWorkers.find(w => w.id === t.workerId);
        const wName = worker ? worker.name : 'No Assignee';
        const isDone = t.status === 'Completed';
        const priority = t.priority || 'Medium';
        const pColor = priorityColors[priority] || '#fbbf24';
        const dateAssigned = t.dateAssigned ? new Date(t.dateAssigned).toLocaleDateString('en-ZW', { day: 'numeric', month: 'short' }) : '—';
        const dueDate = t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-ZW', { day: 'numeric', month: 'short' }) : null;
        const isOverdue = !isDone && t.dueDate && new Date(t.dueDate) < new Date();
        return `
        <div class="glass-card activity-item" style="padding: 16px; flex-wrap:wrap; gap:10px; ${isDone ? 'opacity:0.6;' : ''}">
            <div class="activity-icon ${isDone ? 'success' : (isOverdue ? 'danger' : 'info')}">
                <i class="fa-solid ${isDone ? 'fa-circle-check' : 'fa-clipboard-list'}"></i>
            </div>
            <div class="activity-details" style="flex:1; min-width:0;">
                <h4 style="${isDone ? 'text-decoration:line-through;' : ''}">${t.desc}</h4>
                <p style="font-size:0.82rem;"><i class="fa-solid fa-user" style="margin-right:4px; color:var(--text-muted);"></i>${wName}</p>
                <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
                    <span style="font-size:0.7rem; padding:2px 8px; border-radius:8px; background:rgba(255,255,255,0.06); color:${pColor};">
                        ${priority} Priority
                    </span>
                    <span style="font-size:0.7rem; padding:2px 8px; border-radius:8px; background:rgba(255,255,255,0.05); color:var(--text-muted);">
                        <i class="fa-regular fa-calendar" style="margin-right:3px;"></i>Assigned: ${dateAssigned}
                    </span>
                    ${dueDate ? `<span style="font-size:0.7rem; padding:2px 8px; border-radius:8px; background:${isOverdue ? 'rgba(244,63,94,0.15)' : 'rgba(255,255,255,0.05)'}; color:${isOverdue ? 'var(--accent-danger)' : 'var(--text-muted)'};"><i class="fa-regular fa-clock" style="margin-right:3px;"></i>${isOverdue ? 'Overdue:' : 'Due:'} ${dueDate}</span>` : ''}
                </div>
            </div>
            ${!isDone ? `
            <button onclick="completeTask('${t.id}')" style="background:rgba(74,222,128,0.12); color:var(--primary-light); border:1px solid rgba(74,222,128,0.2); padding:6px 12px; border-radius:8px; font-size:0.78rem; cursor:pointer; white-space:nowrap;">
                <i class="fa-solid fa-check" style="margin-right:4px;"></i>Done
            </button>` : `<span style="font-size:0.75rem; color:var(--primary-light); padding:4px 8px; border-radius:8px; background:rgba(74,222,128,0.08);">✓ Done</span>`}
        </div>`;
    }).join('');
}

window.completeTask = async function(taskId) {
    let task = teamTasks.find(t => t.id === taskId);
    if (task) {
        task.status = 'Completed';
        task.completedAt = new Date().toISOString();
        await saveData('tasks', taskId, task);
        // Log a completion activity
        await saveData('activities', null, {
            type: 'success',
            icon: 'fa-circle-check',
            title: `Task Completed`,
            info: `"${task.desc}" marked as done.`,
            time: new Date().toISOString(),
            visibility: 'Public',
            farmId: state.farmId,
            updatedBy: { uid: state.user?.uid || 'system', name: state.userName || 'System' }
        });
        showSuccessToast('Task marked as completed!');
    }
};

window.openPayForWorker = function(workerId) {
    openAction('pay-wage');
    setTimeout(() => {
        const select = document.getElementById('field-wage-worker');
        if (select) select.value = workerId;
    }, 20);
};

window.openAssignForWorker = function(workerId) {
    openAction('assign-task');
    setTimeout(() => {
        const select = document.getElementById('field-task-worker');
        if (select) select.value = workerId;
    }, 20);
};

function renderPayroll() {
    const el = document.getElementById('payroll-list');
    if (!el) return;
    if (teamPayroll.length === 0) {
        el.innerHTML = `<div class="empty-state"><i class="fa-solid fa-money-bill-wave" style="font-size:2rem; color:var(--text-muted); display:block; margin-bottom:10px;"></i>No payroll yet.<br><small style="color:var(--text-muted); font-size:0.8rem;">Pay workers using the Pay button in Workers tab.</small></div>`;
        return;
    }
    // Compute per-worker totals
    const workerTotals = {};
    teamPayroll.forEach(p => {
        workerTotals[p.workerId] = (workerTotals[p.workerId] || 0) + (p.amount || 0);
    });
    const grandTotal = Object.values(workerTotals).reduce((s, v) => s + v, 0);

    // Summary banner
    const summaryHtml = `
        <div class="glass-card" style="padding:14px 16px; margin-bottom:12px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
            <div>
                <p style="font-size:0.78rem; color:var(--text-muted); margin:0;">Total Wages Paid (All Time)</p>
                <h3 style="color:var(--accent-gold); margin:4px 0 0; font-size:1.4rem;">$${grandTotal.toFixed(2)}</h3>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${Object.entries(workerTotals).map(([wid, total]) => {
                    const worker = teamWorkers.find(w => w.id === wid);
                    return worker ? `<span style="font-size:0.72rem; padding:3px 9px; border-radius:8px; background:rgba(251,191,36,0.1); color:var(--accent-gold);">${worker.name}: $${total.toFixed(2)}</span>` : '';
                }).join('')}
            </div>
        </div>`;

    const sorted = [...teamPayroll].sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
    el.innerHTML = summaryHtml + sorted.map(p => {
        const worker = teamWorkers.find(w => w.id === p.workerId);
        const wName = worker ? worker.name : 'Unknown';
        const date = new Date(p.date || p.createdAt || Date.now()).toLocaleDateString('en-ZW', { day: 'numeric', month: 'short', year: 'numeric' });
        return `
        <div class="glass-card activity-item" style="padding: 14px;">
            <div class="activity-icon success">
                <i class="fa-solid fa-money-bill-wave"></i>
            </div>
            <div class="activity-details">
                <h4>$${parseFloat(p.amount).toFixed(2)} → ${wName}</h4>
                <p style="font-size:0.8rem;">${p.scope} &nbsp;·&nbsp; ${date}</p>
            </div>
        </div>`;
    }).join('');
}

function renderAppUsers(users) {
    const el = document.getElementById('users-list');
    if (!el) return;
    if (users.length === 0) {
        el.innerHTML = '<div class="empty-state">No app users found in this farm.</div>';
        return;
    }
    el.innerHTML = users.map(u => `
        <div class="glass-card activity-item" style="padding: 16px;">
            <div class="activity-icon ${u.status === 'Active' ? 'success' : 'warning'}">
                <i class="fa-solid ${u.role === 'Admin' ? 'fa-user-shield' : 'fa-user'}"></i>
            </div>
            <div class="activity-details">
                <h4>${u.name || u.email}</h4>
                <p>${u.role} | ${u.status}</p>
            </div>
        </div>
    `).join('');
}

async function initFirestoreSync() {
    if (!window.db) {
        setTimeout(initFirestoreSync, 100);
        return;
    }
    db = window.db;
    console.log("Firestore sync active.");
    
    if (!localStorage.getItem('zimFarmMigrated')) {
        await migrateToFirestore();
    }

    setupFirestoreListeners();
    syncFarmSettings();
}

async function syncFarmSettings() {
    if (!state.farmId) return;
    const settingsRef = doc(window.db, "farms", state.farmId);
    onSnapshot(settingsRef, (snapshot) => {
        if (snapshot.exists()) {
            const data = snapshot.data();
            state.farmSettings = { ...state.farmSettings, ...data };
            applyFarmSettingsUI();
            updateWeather(); // Refresh weather if location changed
        } else {
            // Initialize default settings if missing
            setDoc(settingsRef, state.farmSettings, { merge: true });
        }
    });

    // ZESA Toggle listener
    const zesaCard = document.getElementById('zesa-card');
    if (zesaCard) {
        zesaCard.onclick = () => {
            const newStatus = state.farmSettings.zesaStatus === 'on' ? 'off' : 'on';
            setDoc(settingsRef, { zesaStatus: newStatus }, { merge: true });
        };
    }

    // Reset Password Button
    const resetBtn = document.getElementById('btn-reset-password');
    if (resetBtn) {
        resetBtn.onclick = async () => {
            if (!state.user || !state.user.email) return;
            try {
                await sendPasswordResetEmail(window.auth, state.user.email);
                showSuccessToast('Password reset email sent. Check your inbox.');
            } catch (error) {
                console.error("Error sending reset email:", error);
                alert("Failed to send reset email: " + error.message);
            }
        };
    }

    // Farm Settings Form
    const farmForm = document.getElementById('farm-settings-form');
    if (farmForm) {
        farmForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('farm-name-input').value;
            const farmLocation = document.getElementById('farm-location-input').value;
            const rate = parseFloat(document.getElementById('farm-rate-input').value);
            const displayName = document.getElementById('user-display-name-input')?.value.trim();
            const commoditiesRaw = document.getElementById('farm-commodities-input')?.value || '';
            const commodities = commoditiesRaw.split(',').map(c => c.trim()).filter(c => c.length > 0);
            const stockRegistryRaw = document.getElementById('farm-stock-registry-input')?.value || '';
            const stockRegistry = stockRegistryRaw.split(',').map(c => c.trim()).filter(c => c.length > 0);
            
            // Gather module toggles
            const enabledModules = {};
            ['fields', 'livestock', 'equipment', 'stock', 'financials'].forEach(key => {
                const checkbox = document.getElementById(`module-toggle-${key}`);
                if (checkbox) enabledModules[key] = checkbox.checked;
            });

            const coords = getCityCoords(farmLocation);
            try {
                await setDoc(settingsRef, {
                    name,
                    location: farmLocation,
                    lat: coords.lat,
                    lon: coords.lon,
                    fallbackRate: rate,
                    enabledModules,
                    commodities,
                    stockRegistry
                }, { merge: true });

                // Update user display name if changed
                if (displayName && displayName !== state.userName && state.user) {
                    await setDoc(doc(window.db, "users", state.user.uid), { name: displayName }, { merge: true });
                    state.userName = displayName;
                    document.getElementById('user-name').textContent = displayName;
                    document.getElementById('user-greeting').textContent = `${getShonaGreeting()}, ${displayName}`;
                    document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${displayName}&background=4CAF50&color=fff`;
                }

                closeAction('edit-farm');
                showSuccessToast('Farm Settings Updated');
            } catch (err) {
                console.error('Failed to save settings:', err);
                showSuccessToast('Error: ' + err.message);
            }
        };
    }

    // Populate modal inputs when opened
    window.openFarmSettings = function() {
        const s = state.farmSettings;
        const nameEl = document.getElementById('farm-name-input');
        const locEl = document.getElementById('farm-location-input');
        const rateEl = document.getElementById('farm-rate-input');
        const displayNameEl = document.getElementById('user-display-name-input');
        const commoditiesEl = document.getElementById('farm-commodities-input');
        const stockRegEl = document.getElementById('farm-stock-registry-input');
        if (nameEl) nameEl.value = s.name || '';
        if (locEl) locEl.value = s.location || 'harare';
        if (rateEl) rateEl.value = s.fallbackRate || 24.63;
        if (displayNameEl) displayNameEl.value = state.userName || '';
        if (commoditiesEl) commoditiesEl.value = (s.commodities || []).join(', ');
        if (stockRegEl) stockRegEl.value = (s.stockRegistry || []).join(', ');
        const mods = s.enabledModules || {};
        ['fields', 'livestock', 'equipment', 'stock', 'financials'].forEach(key => {
            const cb = document.getElementById(`module-toggle-${key}`);
            if (cb) cb.checked = mods[key] !== false;
        });
        const modal = document.getElementById('modal-edit-farm');
        if (modal) modal.classList.remove('hidden');
    };
}

function applyFarmSettingsUI() {
    // Apply ZESA UI
    const card = document.getElementById('zesa-card');
    const icon = document.getElementById('zesa-icon');
    const title = document.getElementById('zesa-title');
    const sub = document.getElementById('zesa-status-text');
    
    if (state.farmSettings.zesaStatus === 'on') {
        card.classList.remove('off');
        icon.className = 'fa-solid fa-bolt icon';
        title.textContent = 'ZESA On';
        sub.textContent = 'Main Grid Active';
    } else {
        card.classList.add('off');
        icon.className = 'fa-solid fa-bolt-slash icon';
        title.textContent = 'ZESA Off';
        sub.textContent = 'Generator Running';
    }

    // Update Exchange Rate in UI
    const rateEl = document.getElementById('exchange-rate');
    if (rateEl && state.exchangeRate === 13.56) { // Only update if not yet scraped
        state.exchangeRate = state.farmSettings.fallbackRate;
        rateEl.textContent = `Rate: 1 USD = ${state.exchangeRate} ZiG`;
    }

    // Update Banner/Name if exists
    console.log(`Farm Name: ${state.farmSettings.name}`);

    // Apply module visibility
    applyModuleVisibility();
}

function applyModuleVisibility() {
    const modules = state.farmSettings.enabledModules || {};
    const role = state.role;

    // Module map: module key -> { navTarget, actionBtn, view }
    const moduleConfig = [
        { key: 'fields',    navTarget: 'view-fields',    actionBtnId: null },
        { key: 'livestock', navTarget: 'view-livestock', actionBtnId: 'action-btn-animal' },
        { key: 'equipment', navTarget: 'view-equipment', actionBtnId: null },
        { key: 'stock',     navTarget: 'view-stock',     actionBtnId: null },
        { key: 'financials',navTarget: null,             actionBtnId: 'action-btn-sales' },
        { key: 'labor',     navTarget: 'view-labor',     actionBtnId: null },
    ];

    moduleConfig.forEach(({ key, navTarget, actionBtnId }) => {
        const isEnabled = modules[key] !== false; // default true if not set

        // Toggle nav item visibility
        if (navTarget) {
            const navItem = document.querySelector(`.bottom-nav .nav-item[data-target="${navTarget}"]`);
            if (navItem) {
                if (isEnabled) {
                    navItem.classList.remove('module-hidden');
                } else {
                    navItem.classList.add('module-hidden');
                    // If current view is this hidden one, navigate home
                    const currentView = document.getElementById(navTarget);
                    if (currentView && !currentView.classList.contains('hidden')) {
                        document.getElementById('view-home').classList.remove('hidden');
                        currentView.classList.add('hidden');
                        document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
                        document.querySelector('.bottom-nav .nav-item[data-target="view-home"]')?.classList.add('active');
                    }
                }
            }
        }

        // Toggle quick action buttons
        if (actionBtnId) {
            const btn = document.getElementById(actionBtnId);
            if (btn) {
                if (isEnabled) {
                    btn.classList.remove('module-hidden');
                } else {
                    btn.classList.add('module-hidden');
                }
            }
        }

        // Toggle balance card for financials
        if (key === 'financials') {
            const balanceCard = document.querySelector('.balance-card');
            if (balanceCard) {
                if (isEnabled) {
                    balanceCard.classList.remove('module-hidden');
                } else {
                    balanceCard.classList.add('module-hidden');
                }
            }
        }
    });

    // Sync checkbox UI in settings modal (if open)
    Object.keys(modules).forEach(key => {
        const checkbox = document.getElementById(`module-toggle-${key}`);
        if (checkbox) checkbox.checked = modules[key] !== false;
    });
}

function getCityCoords(city) {
    const map = {
        harare: { lat: -17.8252, lon: 31.0335 },
        bulawayo: { lat: -20.15, lon: 28.5833 },
        mutare: { lat: -18.97, lon: 32.67 },
        gweru: { lat: -19.45, lon: 29.8167 },
        kwekwe: { lat: -18.9167, lon: 29.8167 },
        masvingo: { lat: -20.0637, lon: 30.8277 },
        chinhoyi: { lat: -17.3667, lon: 30.2 },
        bindura: { lat: -17.3, lon: 31.3333 },
        marondera: { lat: -18.1833, lon: 31.55 },
        zvishavane: { lat: -20.3333, lon: 30.0667 }
    };
    return map[city] || map.harare;
}

function initFarmDynamicUpdates() {
    updateWeather();
    updateRBZRate();
    
    // Set hourly intervals
    setInterval(updateWeather, 3600000);
    setInterval(updateRBZRate, 3600000);
}

async function updateWeather() {
    const { lat, lon } = state.farmSettings;
    try {
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        if (data && data.current_weather) {
            const temp = Math.round(data.current_weather.temperature);
            const code = data.current_weather.weathercode;
            const desc = getWeatherDesc(code);
            
            document.getElementById('weather-temp').textContent = `${temp}°C`;
            document.getElementById('weather-desc').textContent = desc;
            
            // Optional: update icon based on code
        }
    } catch (e) {
        console.error("Weather Update Failed:", e);
    }
}

function getWeatherDesc(code) {
    if (code === 0) return "Clear Sky";
    if (code <= 3) return "Partly Cloudy";
    if (code >= 45 && code <= 48) return "Foggy";
    if (code >= 51 && code <= 67) return "Raining";
    if (code >= 71 && code <= 77) return "Snowing";
    if (code >= 80 && code <= 82) return "Showers";
    if (code >= 95) return "Thunderstorm";
    return "Cloudy";
}

async function updateRBZRate() {
    const rateEl = document.getElementById('exchange-rate');
    try {
        // Attempt scraping via CORS proxy
        // RBZ official exchange rates page usually has a clear pattern
        const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent('https://www.rbz.co.zw/');
        const response = await fetch(proxyUrl);
        const data = await response.json();
        const html = data.contents;
        
        // Find ZiG rate pattern like "ZiG 24.6288" or similar
        // We look for "ZiG" followed by a number
        const match = html.match(/ZiG\s*(\d+\.\d+)/i);
        if (match && match[1]) {
            state.exchangeRate = parseFloat(match[1]);
            rateEl.textContent = `Rate: 1 USD = ${state.exchangeRate} ZiG (Official)`;
            console.log("Updated ZiG rate from RBZ:", state.exchangeRate);
        } else {
            throw new Error("Pattern not found");
        }
    } catch (e) {
        console.warn("RBZ Scraper Failed, using fallback:", e);
        state.exchangeRate = state.farmSettings.fallbackRate;
        rateEl.textContent = `Rate: 1 USD = ${state.exchangeRate} ZiG (Fallback)`;
    }
}

async function migrateToFirestore() {
    console.log("Migrating localStorage to Firestore...");
    try {
        for (const item of inventory) await setDoc(doc(db, "inventory", item.id), item);
        for (const field of farmFields) await setDoc(doc(db, "fields", field.id), field);
        for (const eq of farmEquipment) await setDoc(doc(db, "equipment", eq.id), eq);
        for (const animal of livestock) await setDoc(doc(db, "livestock", animal.id), animal);
        for (const act of activities) await addDoc(collection(db, "activities"), act);
        
        for (const worker of teamWorkers) await setDoc(doc(db, "workers", worker.id), worker);
        for (const task of teamTasks) await setDoc(doc(db, "tasks", task.id), task);
        for (const payroll of teamPayroll) await setDoc(doc(db, "payroll", payroll.id), payroll);
        
        await setDoc(doc(db, "financials", "main_balance"), { usdBalance: state.usdBalance });
        
        localStorage.setItem('zimFarmMigrated', 'true');
        console.log("Migration complete.");
    } catch (e) {
        console.error("Migration failed:", e);
    }
}

function setupFirestoreListeners() {
    if (!state.farmId) {
        console.warn("Listeners skipped: No farmId tethered.");
        return;
    }

    // Fetch activities — use simple where+limit (no orderBy) to avoid composite index requirement.
    // Sort and filter client-side for real-time multi-browser sync.
    const actsQuery = query(collection(db, "activities"), where("farmId", "==", state.farmId), limit(500));
        
    onSnapshot(actsQuery, (snapshot) => {
        let acts = snapshot.docs.map(d => d.data());
        if (state.role === 'Worker') {
            acts = acts.filter(a => a.visibility !== 'Sensitive');
        }
        activities = acts.sort((a, b) => new Date(b.time) - new Date(a.time));
        renderActivities();
        renderReports();
    });

    onSnapshot(query(collection(db, "inventory"), where("farmId", "==", state.farmId)), (snapshot) => {
        inventory = snapshot.docs.map(doc => doc.data());
        renderInventory();
    });

    onSnapshot(query(collection(db, "fields"), where("farmId", "==", state.farmId)), (snapshot) => {
        farmFields = snapshot.docs.map(doc => doc.data());
        renderFields();
    });

    onSnapshot(query(collection(db, "equipment"), where("farmId", "==", state.farmId)), (snapshot) => {
        farmEquipment = snapshot.docs.map(doc => doc.data());
        renderEquipment();
    });

    onSnapshot(query(collection(db, "livestock"), where("farmId", "==", state.farmId)), (snapshot) => {
        livestock = snapshot.docs.map(doc => doc.data());
        renderLivestock();
    });

    onSnapshot(query(collection(db, "workers"), where("farmId", "==", state.farmId)), (snapshot) => {
        teamWorkers = snapshot.docs.map(doc => doc.data());
        renderWorkers();
        renderPayroll(); // Re-render payroll (worker names) when workers update
    });
    
    onSnapshot(query(collection(db, "tasks"), where("farmId", "==", state.farmId)), (snapshot) => {
        teamTasks = snapshot.docs.map(doc => doc.data());
        renderTasks();
        renderWorkers(); // Re-render workers (pending task count) when tasks update
    });

    onSnapshot(query(collection(db, "payroll"), where("farmId", "==", state.farmId)), (snapshot) => {
        teamPayroll = snapshot.docs.map(doc => doc.data());
        renderPayroll();
        renderWorkers(); // Re-render workers (total paid) when payroll updates
    });
    
    onSnapshot(query(collection(db, "users"), where("farmId", "==", state.farmId)), (snapshot) => {
        const users = snapshot.docs.map(doc => doc.data());
        renderAppUsers(users);
    });

    onSnapshot(doc(db, "financials", state.farmId), (snapshot) => {
        if (snapshot.exists()) {
            state.usdBalance = snapshot.data().usdBalance;
            const balanceAmount = document.getElementById('balance-amount');
            if (balanceAmount) {
                const isUsd = document.getElementById('btn-usd')?.classList.contains('active');
                if (isUsd) {
                    balanceAmount.textContent = formatCurrency(state.usdBalance, 'USD');
                } else {
                    balanceAmount.textContent = formatCurrency(state.usdBalance * state.exchangeRate, 'ZIG');
                }
            }
        }
    });
}

// Helper to save data (Firestore + LocalStorage backup)
async function saveData(col, id, data) {
    if (!db) return;
    
    // Inject farmId for multi-tenancy (except for core metadata)
    if (state.farmId && col !== 'metadata' && col !== 'users' && col !== 'farms') {
        data.farmId = state.farmId;
    }
    
    try {
        if (col === 'financials') {
            // Keep financials tethered by farmId doc ID
            const docId = id || state.farmId;
            await setDoc(doc(db, col, docId), data, { merge: true });
        } else if (col === 'inventory') {
            await setDoc(id ? doc(db, col, id) : doc(collection(db, col)), data, { merge: true });
        } else {
            if (id) {
                await setDoc(doc(db, col, id), data);
            } else {
                await addDoc(collection(db, col), data);
            }
        }
    } catch (e) {
        console.error(`Firestore save failed for ${col}:`, e);
        // Don't show toast for permission errors — the success toast handles UX
    }
}

// Expose functions to window (for HTML onclick handlers)
window.openAction = openAction;
window.closeModal = closeModal;
window.openMaintenanceLog = openMaintenanceLog;
window.openAnimalTreatmentLog = openAnimalTreatmentLog;
window.navigateToView = navigateToView;
window.updateUserRole = updateUserRole;
window.updateUserStatus = updateUserStatus;
window.closeAction = closeAction;
window.upgradeFarmToPremium = upgradeFarmToPremium;
window.downgradeFarmToSolo = downgradeFarmToSolo;
window.renderExecutiveDashboard = renderExecutiveDashboard;
window.publishAnnouncement = publishAnnouncement;
window.clearAnnouncement = clearAnnouncement;
window.deleteUserAccount = deleteUserAccount;
window.deleteFarm = deleteFarm;

window.openPlantCrop = function(fieldId) {
    openAction('plant-crop');
    setTimeout(() => {
        const select = document.getElementById('field-plant-id');
        if (select) select.value = fieldId;
    }, 20);
};

window.openHarvestCrop = function(fieldId) {
    openAction('harvest-crop');
    setTimeout(() => {
        const select = document.getElementById('field-harvest-id');
        if (select) select.value = fieldId;
    }, 20);
};

window.openAdjustStock = function(itemId) {
    openAction('adjust-stock');
    setTimeout(() => {
        const select = document.getElementById('field-adjust-item');
        if (select) select.value = itemId;
    }, 20);
};

window.updateFieldStatus = async function(fieldId, status) {
    let field = farmFields.find(f => f.id === fieldId);
    if (field) {
        field.status = status;
        await saveData('fields', field.id, field);
        showSuccessToast(`Field status updated to ${status}`);
    }
};

window.applyTemplate = function(type) {
    document.querySelectorAll('.wizard-comm-cb, .wizard-stock-cb').forEach(cb => cb.checked = false);
    if (type === 'tobacco_maize') {
        ['Tobacco', 'Maize'].forEach(item => {
            const cb = document.querySelector(`.wizard-comm-cb[value="${item}"]`);
            if (cb) cb.checked = true;
        });
        ['Diesel'].forEach(item => {
            const cb = document.querySelector(`.wizard-stock-cb[value="${item}"]`);
            if (cb) cb.checked = true;
        });
    } else if (type === 'poultry') {
        ['Broilers', 'Eggs'].forEach(item => {
            const cb = document.querySelector(`.wizard-comm-cb[value="${item}"]`);
            if (cb) cb.checked = true;
        });
        ['Broiler Feed', 'Layer Feed'].forEach(item => {
            const cb = document.querySelector(`.wizard-stock-cb[value="${item}"]`);
            if (cb) cb.checked = true;
        });
    } else if (type === 'livestock') {
        ['Beef'].forEach(item => {
            const cb = document.querySelector(`.wizard-comm-cb[value="${item}"]`);
            if (cb) cb.checked = true;
        });
    }
};

// Helper: open/close overlay modals (Farm Settings, etc.)
function closeAction(type) {
    const modal = document.getElementById(`modal-${type}`);
    if (modal) modal.classList.add('hidden');
}

// Make openFarmSettings accessible globally (set in syncFarmSettings)
// It becomes window.openFarmSettings once syncFarmSettings() runs.
// Provide a safe fallback in case it's called before sync:
window.openFarmSettings = function() {
    const s = state.farmSettings;
    const nameEl = document.getElementById('farm-name-input');
    const locEl = document.getElementById('farm-location-input');
    const rateEl = document.getElementById('farm-rate-input');
    if (nameEl) nameEl.value = s.name || '';
    if (locEl) locEl.value = s.location || 'harare';
    if (rateEl) rateEl.value = s.fallbackRate || 24.63;
    const mods = s.enabledModules || {};
    ['fields', 'livestock', 'equipment', 'stock', 'financials'].forEach(key => {
        const cb = document.getElementById(`module-toggle-${key}`);
        if (cb) cb.checked = mods[key] !== false;
    });
    const modal = document.getElementById('modal-edit-farm');
    if (modal) modal.classList.remove('hidden');
};


function initDate() {
    const dateEl = document.getElementById('current-date');
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateEl.textContent = new Date().toLocaleDateString('en-US', options);
}

function initCurrencyToggle() {
    const btnUsd = document.getElementById('btn-usd');
    const btnZig = document.getElementById('btn-zig');
    const balanceAmount = document.getElementById('balance-amount');
    
    const updateBalance = (curr) => {
        state.currency = curr;
        if (curr === 'USD') {
            btnUsd.classList.add('active');
            btnZig.classList.remove('active');
            balanceAmount.textContent = formatCurrency(state.usdBalance, 'USD');
        } else {
            btnZig.classList.add('active');
            btnUsd.classList.remove('active');
            const zigBalance = state.usdBalance * state.exchangeRate;
            balanceAmount.textContent = formatCurrency(zigBalance, 'ZIG');
        }
    };

    btnUsd.addEventListener('click', () => updateBalance('USD'));
    btnZig.addEventListener('click', () => updateBalance('ZiG'));
}

function initNavigation() {
    const navItems = document.querySelectorAll('.bottom-nav .nav-item[data-target]');
    navItems.forEach(nav => {
        nav.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
            nav.classList.add('active');
            
            const targetId = nav.getAttribute('data-target');
            document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
            document.getElementById(targetId).classList.remove('hidden');
        });
    });
}

function initNetworkStatus() {
    const toast = document.getElementById('offline-toast');
    
    // Check if navigator handles 'onLine', otherwise default to true/false mock
    const updateNetworkStatus = () => {
        state.isOffline = !navigator.onLine;
        if (state.isOffline) {
            toast.classList.remove('hidden');
        } else {
            toast.classList.add('hidden');
            console.log("Online: Syncing offline queues...");
        }
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    
    // Initial check
    updateNetworkStatus();
}

// Modal Elements
const modal = document.getElementById('action-modal');
const form = document.getElementById('action-form');
const dynamicFields = document.getElementById('dynamic-fields');
const modalTitle = document.getElementById('modal-title');

function renderActivities() {
    const activityListEl = document.getElementById('activity-list');
    if (!activityListEl) return;
    activityListEl.innerHTML = '';
    const recent = activities.slice(0, 10);
    if (recent.length === 0) {
        activityListEl.innerHTML = `<div class="empty-state" style="padding:20px;"><i class="fa-solid fa-seedling"></i>No activities yet. Log your first action!</div>`;
        return;
    }
    recent.forEach(act => {
        const timeLabel = act.time ? new Date(act.time).toLocaleString('en-ZW', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
        activityListEl.innerHTML += `
            <div class="activity-item glass-card">
                <div class="activity-icon ${act.type}"><i class="fa-solid ${act.icon}"></i></div>
                <div class="activity-details">
                    <h4>${act.title}</h4>
                    <p>${act.info}</p>
                </div>
                <span class="time">${timeLabel}</span>
            </div>
        `;
    });
}

function renderInventory() {
    const listEl = document.getElementById('inventory-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    inventory.forEach(item => {
        listEl.innerHTML += `
            <div class="glass-card stock-item" style="display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div class="stock-icon"><i class="fa-solid ${item.icon}"></i></div>
                    <div class="stock-details">
                        <h4>${item.name}</h4>
                        <p style="color:var(--primary-light)">Remaining: ${item.qty} ${item.unit || 'units'}</p>
                    </div>
                </div>
                <button class="auth-btn" style="width:auto; padding:6px 12px; font-size:0.8rem;" onclick="openAdjustStock('${item.id}')">Adjust</button>
            </div>
        `;
    });
}

function renderFields() {
    const listEl = document.getElementById('fields-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    farmFields.forEach(field => {
        listEl.innerHTML += `
            <div class="glass-card activity-item" style="padding: 16px; flex-direction: column; align-items: stretch;">
                <div style="display:flex; align-items:center; gap:16px;">
                    <div class="activity-icon success"><i class="fa-solid fa-map"></i></div>
                    <div class="activity-details">
                        <h4>${field.name} (<span style="color:var(--primary-light)">${field.acres} ${state.farmSettings.landUnit || 'Acres'}</span>)</h4>
                        <p style="margin-top:4px;">Crop: ${field.crop}<br>
                           Status: <select class="presence-select" style="color:var(--text-main); font-weight:600; padding:0; display:inline;" onchange="updateFieldStatus('${field.id}', this.value)">
                                <option value="New" ${field.status === 'New' ? 'selected' : ''}>New</option>
                                <option value="Preparing Land" ${field.status === 'Preparing Land' ? 'selected' : ''}>Preparing Land</option>
                                <option value="Ready for Prep" ${field.status === 'Ready for Prep' ? 'selected' : ''}>Ready for Prep</option>
                                <option value="Planted" ${field.status === 'Planted' ? 'selected' : ''}>Planted</option>
                                <option value="Growing" ${field.status === 'Growing' ? 'selected' : ''}>Growing</option>
                                <option value="Needs Weeding" ${field.status === 'Needs Weeding' ? 'selected' : ''}>Needs Weeding</option>
                                <option value="Ready for Harvest" ${field.status === 'Ready for Harvest' ? 'selected' : ''}>Ready for Harvest</option>
                           </select>
                        </p>
                    </div>
                </div>
                <div class="field-actions" style="display:flex; gap:8px; margin-top:12px;">
                     <button class="btn-submit" style="flex:1; padding:8px; font-size:0.8rem; background:rgba(255,255,255,0.05); color:var(--text-main); border:1px solid var(--border-glass);" onclick="openPlantCrop('${field.id}')"><i class="fa-solid fa-seedling"></i> Plant</button>
                     ${field.crop !== 'None' && field.crop !== 'Fallow' ? `<button class="btn-submit" style="flex:1; padding:8px; font-size:0.8rem; background:var(--primary-green); border:none;" onclick="openHarvestCrop('${field.id}')"><i class="fa-solid fa-sickle"></i> Harvest</button>` : ''}
                </div>
            </div>
        `;
    });
}

function renderEquipment() {
    const listEl = document.getElementById('equipment-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    farmEquipment.forEach(eq => {
        listEl.innerHTML += `
            <div class="glass-card" style="padding: 16px; margin-bottom: 12px; border-radius: 20px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div class="activity-icon ${eq.status==='Running'?'success':'warning'}"><i class="fa-solid ${eq.icon}"></i></div>
                    <div class="activity-details">
                        <h4>${eq.name}</h4>
                        <p style="margin-top:4px;">Status: <span style="color:var(${eq.status==='Running'?'--primary-light':'--accent-gold'})">${eq.status}</span> &nbsp;|&nbsp; Hours: ${eq.hours}</p>
                        <p style="font-size:0.8rem; color:var(--text-muted);">Last Service: ${eq.lastService}</p>
                    </div>
                </div>
                <button class="btn-submit" style="width:100%; margin-top:12px; padding:10px; font-size:0.9rem;" onclick="openMaintenanceLog('${eq.id}')">
                    <i class="fa-solid fa-wrench"></i> &nbsp;Log Maintenance
                </button>
            </div>
        `;
    });
}

function renderLivestock() {
    const listEl = document.getElementById('livestock-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    livestock.forEach(animal => {
        const statusColor = animal.status === 'Healthy' ? '--primary-light' : '--accent-danger';
        listEl.innerHTML += `
            <div class="glass-card" style="padding: 16px; margin-bottom: 12px; border-radius: 20px;">
                <div style="display:flex; align-items:center; gap:14px;">
                    <div class="activity-icon ${animal.status === 'Healthy' ? 'success' : 'warning'}">
                        <i class="fa-solid ${animal.icon}"></i>
                    </div>
                    <div class="activity-details">
                        <h4>${animal.name} <span style="font-weight:400; font-size:0.85rem; color:var(--text-muted)">[${animal.tag}]</span></h4>
                        <p style="margin-top:4px;">Count: <strong>${animal.count}</strong> &nbsp;|&nbsp; Status: <span style="color:var(${statusColor})">${animal.status}</span></p>
                        <p style="font-size:0.8rem; color:var(--text-muted);">${animal.breed} &mdash; ${animal.notes}</p>
                    </div>
                </div>
                <button class="btn-submit" style="width:100%; margin-top:12px; padding:10px; font-size:0.9rem;" onclick="openAnimalTreatmentLog('${animal.id}')">
                    <i class="fa-solid fa-syringe"></i> &nbsp;Log Treatment
                </button>
            </div>
        `;
    });
}

// Action Handlers (Phase 2 logic)
let currentAction = null;

function openAction(actionType) {
    currentAction = actionType;
    modal.classList.remove('hidden');
    dynamicFields.innerHTML = ''; // Clear fields
    
    // Premium Plan Constraint Checks
    let plan = state.farmSettings.plan || 'Solo';
    if (plan === 'Solo') {
        let upgradePrompt = null;
        if (actionType === 'add-field' && farmFields.length >= 1) {
            upgradePrompt = "Fields (Max 1)";
        } else if (actionType === 'add-worker' && teamWorkers.length >= 1) {
            upgradePrompt = "Workers (Max 1)";
        } else if (actionType === 'add-equipment' && farmEquipment.length >= 2) {
            upgradePrompt = "Equipment (Max 2)";
        } else if (actionType === 'add-animal' && livestock.length >= 2) {
            upgradePrompt = "Livestock Batches (Max 2)";
        }

        const submitBtn = document.querySelector('#action-form .btn-submit');
        
        if (upgradePrompt) {
            modalTitle.innerHTML = `<i class="fa-solid fa-gem" style="margin-right:8px; color:var(--primary-light);"></i>Upgrade to Premium`;
            dynamicFields.innerHTML = `
                <div class="upgrade-prompt" style="text-align:center; padding: 10px;">
                    <div style="font-size: 3.5rem; color: var(--primary-light); margin-bottom: 20px; text-shadow: 0 0 25px rgba(74,222,128,0.2);">
                        <i class="fa-solid fa-rocket"></i>
                    </div>
                    <h3 style="margin-bottom: 12px; color: var(--text-main);">Unlock Unlimited Potential</h3>
                    <p style="color: var(--text-muted); font-size: 0.95rem; margin-bottom: 25px; line-height: 1.6;">
                        You've reached the <strong>${upgradePrompt}</strong> limit on your Solo plan. Upgrade to Premium to manage unlimited fields, workers, and livestock.
                    </p>
                    
                    <div style="background: rgba(46,139,87,0.1); border: 1px solid rgba(74,222,128,0.2); border-radius: 16px; padding: 20px; text-align: left; margin-bottom: 25px;">
                        <h4 style="color: var(--primary-light); font-size: 0.95rem; margin-bottom: 12px;"><i class="fa-solid fa-star" style="margin-right:8px;"></i>Premium Features</h4>
                        <ul style="list-style: none; color: var(--text-main); font-size: 0.88rem; padding: 0; margin: 0; display: grid; gap: 10px;">
                            <li style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-check" style="color:var(--primary-light);"></i> Unlimited Farm Resources</li>
                            <li style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-check" style="color:var(--primary-light);"></i> Advanced Financial Reporting</li>
                            <li style="display:flex; align-items:center; gap:10px;"><i class="fa-solid fa-check" style="color:var(--primary-light);"></i> Priority System Support</li>
                        </ul>
                    </div>

                    <a href="https://wa.me/263778223973?text=Hi%20ZimFarm%20Support!%20I%20would%20like%20to%20upgrade%20my%20farm%20to%20Premium.%20FarmID:%20${state.farmId}" 
                       target="_blank" 
                       class="btn-submit" 
                       style="display: flex; align-items: center; justify-content: center; gap: 10px; background: #25D366; color: white; text-decoration: none; font-weight: 600; padding: 14px; border-radius: 12px; transition: transform 0.2s;">
                        <i class="fa-brands fa-whatsapp" style="font-size: 1.3rem;"></i>
                        Upgrade via WhatsApp
                    </a>
                    <p style="margin-top: 15px; font-size: 0.75rem; color: var(--text-muted);">Instant activation once payment is confirmed.</p>
                </div>
            `;
            if (submitBtn) submitBtn.style.display = 'none';
            return;
        } else {
            if (submitBtn) submitBtn.style.display = 'block';
        }
    }
    
    if (actionType === 'diesel') {
        modalTitle.textContent = "Log Diesel Usage";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Equipment</label>
                <select id="field-equipment" required>
                    <!-- Filled dynamically -->
                </select>
            </div>
            <div class="form-group">
                <label>Liters Used</label>
                <input type="number" id="field-liters" placeholder="e.g. 50" required>
            </div>
        `;
        setTimeout(() => {
            const select = document.getElementById('field-equipment');
            if(select) select.innerHTML = farmEquipment.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        }, 10);
    } else if (actionType === 'labor') {
        modalTitle.textContent = "Log Maricho (Piecework)";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Activity</label>
                <select id="field-task" required>
                    <option value="Weeding">Weeding</option>
                    <option value="Harvesting">Harvesting</option>
                    <option value="Fertilizer">Applying Fertilizer</option>
                </select>
            </div>
            <div class="form-group">
                <label>Number of Casuals</label>
                <input type="number" id="field-workers" placeholder="e.g. 10" required>
            </div>
            <div class="form-group">
                <label>Total Wage (USD)</label>
                <input type="number" id="field-wage" placeholder="0.00" step="0.5" required>
            </div>
        `;
    } else if (actionType === 'inputs') {
        modalTitle.textContent = "Log Farm Inputs";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Item</label>
                <select id="field-input-type" required>
                    <option value="Compound D">Compound D Fertilizer (50kg)</option>
                    <option value="Ammonium Nitrate">Ammonium Nitrate (50kg)</option>
                    <option value="Pannar Seed">Pannar Maize Seed (25kg)</option>
                </select>
            </div>
            <div class="form-group">
                <label>Quantity Used</label>
                <input type="number" id="field-qty" placeholder="e.g. 5 bags" required>
            </div>
            <div class="form-group">
                <label>Assigned Field</label>
                <select id="field-location" required>
                    <option value="North Field">North Field</option>
                    <option value="South Quarter">South Quarter</option>
                </select>
            </div>
        `;
    } else if (actionType === 'sales') {
        modalTitle.textContent = "Log Crop / Product Sales";
        // Build commodity options from farm settings, fallback to defaults
        const farmCommodities = (state.farmSettings.commodities && state.farmSettings.commodities.length > 0)
            ? state.farmSettings.commodities
            : ['Tobacco', 'Maize', 'Soyabeans', 'Broilers', 'Eggs', 'Beef', 'Wheat'];
        const commodityOptions = farmCommodities.map(c => `<option value="${c}">${c}</option>`).join('');
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Commodity</label>
                <select id="field-crop" required>
                    ${commodityOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Unit (Qty Sold)</label>
                <input type="number" id="field-sale-qty" placeholder="e.g. 10" required>
            </div>
            <div class="form-group">
                <label>Total Revenue (USD)</label>
                <input type="number" id="field-revenue" placeholder="0.00" step="10" required>
            </div>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Add more commodities in <strong>Farm Settings → Sales Commodities</strong>.</p>
        `;
    } else if (actionType === 'receive-stock') {
        modalTitle.textContent = "Receive New Stock";
        // Build stock options from farm settings stockRegistry, fallback to defaults
        const farmStockItems = (state.farmSettings.stockRegistry && state.farmSettings.stockRegistry.length > 0)
            ? state.farmSettings.stockRegistry
            : ['Diesel', 'Compound D', 'Ammonium Nitrate', 'Maize Seed', 'Roundup', 'Broiler Feed'];
        const stockOptions = farmStockItems.map(item => `<option value="${item}">${item}</option>`).join('');
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Item Category</label>
                <select id="field-stock-item" required>
                    ${stockOptions}
                </select>
            </div>
            <div class="form-group">
                <label>Quantity Received</label>
                <input type="number" id="field-receive-qty" placeholder="e.g. 50" required>
            </div>
            <div class="form-group">
                <label>Total Cost (USD)</label>
                <input type="number" id="field-purchase-cost" placeholder="0.00" step="1" required>
            </div>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Manage items in <strong>Farm Settings → Stock Item Registry</strong>.</p>
        `;
    } else if (actionType === 'add-field') {
        modalTitle.textContent = "Add New Field";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Field Name</label>
                <input type="text" id="field-new-name" placeholder="e.g. East Block" required>
            </div>
            <div class="form-group">
                <label>Size (Acres)</label>
                <input type="number" id="field-new-size" placeholder="e.g. 10" required>
            </div>
        `;
    } else if (actionType === 'add-equipment') {
        modalTitle.textContent = "Add Equipment";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Name / Model</label>
                <input type="text" id="field-eq-name" placeholder="e.g. Massey Ferguson" required>
            </div>
            <div class="form-group">
                <label>Current Hours</label>
                <input type="number" id="field-eq-hours" placeholder="e.g. 500" required>
            </div>
        `;
    } else if (actionType === 'log-maintenance') {
        modalTitle.textContent = "Log Maintenance";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Equipment</label>
                <select id="field-maint-equipment" required></select>
            </div>
            <div class="form-group">
                <label>Service Type</label>
                <select id="field-maint-type" required>
                    <option value="Oil Change">Oil Change</option>
                    <option value="Filter Replacement">Filter Replacement</option>
                    <option value="Tyre Check">Tyre Check</option>
                    <option value="Greasing">Full Greasing</option>
                    <option value="Repair">Repair / Breakdown</option>
                    <option value="General Service">General Service</option>
                </select>
            </div>
            <div class="form-group">
                <label>Current Hours at Service</label>
                <input type="number" id="field-maint-hours" placeholder="e.g. 1500" required>
            </div>
            <div class="form-group">
                <label>Cost (USD)</label>
                <input type="number" id="field-maint-cost" placeholder="0.00" step="1">
            </div>
            <div class="form-group">
                <label>Notes</label>
                <input type="text" id="field-maint-notes" placeholder="e.g. Changed engine oil">
            </div>
        `;
        setTimeout(() => {
            const select = document.getElementById('field-maint-equipment');
            if (select) select.innerHTML = farmEquipment.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
        }, 10);
    } else if (actionType === 'plant-crop') {
        modalTitle.textContent = "Plant Crop";
        const farmCommodities = (state.farmSettings.commodities && state.farmSettings.commodities.length > 0)
            ? state.farmSettings.commodities
            : ['Tobacco', 'Maize', 'Soyabeans', 'Broilers', 'Eggs', 'Beef', 'Wheat'];
        const commodityOptions = farmCommodities.map(c => `<option value="${c}">${c}</option>`).join('');
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Field</label>
                <select id="field-plant-id" required></select>
            </div>
            <div class="form-group">
                <label>Crop / Commodity</label>
                <select id="field-plant-crop" required>
                    ${commodityOptions}
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Planting Date</label>
                <input type="date" id="field-plant-date" required>
            </div>
        `;
        setTimeout(() => {
            document.getElementById('field-plant-date').valueAsDate = new Date();
            const select = document.getElementById('field-plant-id');
            if (select) select.innerHTML = farmFields.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
        }, 10);
    } else if (actionType === 'harvest-crop') {
        modalTitle.textContent = "Harvest Crop";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Field</label>
                <select id="field-harvest-id" required></select>
            </div>
            <div class="form-group">
                <label>Harvest Yield (Qty)</label>
                <input type="number" id="field-harvest-qty" placeholder="e.g. 50" required>
            </div>
            <div class="form-group">
                <label>Unit (e.g. Tonnes, Bales)</label>
                <input type="text" id="field-harvest-unit" placeholder="e.g. Bales" required>
            </div>
        `;
        setTimeout(() => {
            const select = document.getElementById('field-harvest-id');
            if (select) select.innerHTML = farmFields.filter(f => f.crop !== 'None' && f.crop !== 'Fallow').map(f => `<option value="${f.id}">${f.name} (${f.crop})</option>`).join('');
        }, 10);
    } else if (actionType === 'adjust-stock') {
        modalTitle.textContent = "Adjust Stock";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Item</label>
                <select id="field-adjust-item" required></select>
            </div>
            <div class="form-group">
                <label>Corrected Quantity</label>
                <input type="number" id="field-adjust-qty" placeholder="e.g. 100" required>
            </div>
            <div class="form-group">
                <label>Reason / Notes</label>
                <input type="text" id="field-adjust-notes" placeholder="e.g. Physical stock count">
            </div>
        `;
        setTimeout(() => {
            const select = document.getElementById('field-adjust-item');
            if (select) select.innerHTML = inventory.map(i => `<option value="${i.id}">${i.name} (Current: ${i.qty})</option>`).join('');
        }, 10);
    } else if (actionType === 'add-animal') {
        modalTitle.textContent = "Register Animal / Batch";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Tag / Batch ID</label>
                <input type="text" id="field-animal-tag" placeholder="e.g. C-025" required>
            </div>
            <div class="form-group">
                <label>Species</label>
                <select id="field-animal-species" required>
                    <option value="Cattle">Cattle</option>
                    <option value="Goats">Goats</option>
                    <option value="Sheep">Sheep</option>
                    <option value="Pigs">Pigs</option>
                    <option value="Poultry">Poultry</option>
                    <option value="Other">Other</option>
                </select>
            </div>
            <div class="form-group">
                <label>Breed</label>
                <input type="text" id="field-animal-breed" placeholder="e.g. Brahman" required>
            </div>
            <div class="form-group">
                <label>Number of Animals</label>
                <input type="number" id="field-animal-count" placeholder="e.g. 10" required>
            </div>
            <div class="form-group">
                <label>Notes</label>
                <input type="text" id="field-animal-notes" placeholder="e.g. Breeding herd">
            </div>
        `;
    } else if (actionType === 'log-treatment') {
        modalTitle.textContent = "Log Health Treatment";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Animal / Batch</label>
                <select id="field-treat-animal" required></select>
            </div>
            <div class="form-group">
                <label>Condition / Illness</label>
                <input type="text" id="field-treat-condition" placeholder="e.g. Foot &amp; Mouth" required>
            </div>
            <div class="form-group">
                <label>Treatment Given</label>
                <input type="text" id="field-treat-medicine" placeholder="e.g. Terramycin injection">
            </div>
            <div class="form-group">
                <label>Animals Affected</label>
                <input type="number" id="field-treat-count" placeholder="e.g. 3">
            </div>
            <div class="form-group">
                <label>New Status</label>
                <select id="field-treat-status">
                    <option value="Healthy">Recovered / Healthy</option>
                    <option value="Sick">Still Sick</option>
                    <option value="Quarantined">Quarantined</option>
                    <option value="Deceased">Deceased</option>
                </select>
            </div>
            <div class="form-group">
                <label>Vet Cost (USD)</label>
                <input type="number" id="field-treat-cost" placeholder="0.00" step="1">
            </div>
        `;
        setTimeout(() => {
            const select = document.getElementById('field-treat-animal');
            if (select) select.innerHTML = livestock.map(a => `<option value="${a.id}">${a.name} [${a.tag}]</option>`).join('');
        }, 10);
    } else if (actionType === 'add-worker') {
        modalTitle.textContent = "Register Worker";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Full Name</label>
                <input type="text" id="field-worker-name" placeholder="e.g. John Doe" required>
            </div>
            <div class="form-group">
                <label>Worker Type</label>
                <select id="field-worker-type" required>
                    <option value="Permanent">Permanent</option>
                    <option value="Casual">Casual / Maricho</option>
                </select>
            </div>
            <div class="form-group">
                <label>Pay Rate (USD)</label>
                <input type="number" id="field-worker-rate" placeholder="e.g. 10.00" step="0.5" required>
            </div>
            <div class="form-group">
                <label>Rate Type</label>
                <select id="field-worker-ratetype" required>
                    <option value="Day">Per Day</option>
                    <option value="Month">Per Month</option>
                    <option value="Task">Per Task</option>
                </select>
            </div>
        `;
    } else if (actionType === 'assign-task') {
        modalTitle.textContent = "Assign Task";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Task Description</label>
                <input type="text" id="field-task-desc" placeholder="e.g. Weed the North Field" required>
            </div>
            <div class="form-group">
                <label>Assign To</label>
                <select id="field-task-worker" required></select>
            </div>
            <div class="form-group">
                <label>Priority</label>
                <select id="field-task-priority" required>
                    <option value="High">🔴 High</option>
                    <option value="Medium" selected>🟡 Medium</option>
                    <option value="Low">🟢 Low</option>
                </select>
            </div>
            <div class="form-group">
                <label>Due Date <span style="color:var(--text-muted); font-size:0.8em;">(Optional)</span></label>
                <input type="date" id="field-task-due">
            </div>
        `;
        setTimeout(() => {
            const select = document.getElementById('field-task-worker');
            if (select) select.innerHTML = teamWorkers.length > 0
                ? teamWorkers.map(w => `<option value="${w.id}">${w.name} (${w.type})</option>`).join('')
                : '<option value="">No workers registered yet</option>';
        }, 10);
    } else if (actionType === 'pay-wage') {
        modalTitle.textContent = "Pay Wages";
        dynamicFields.innerHTML = `
            <div class="form-group">
                <label>Worker</label>
                <select id="field-wage-worker" required></select>
            </div>
            <div class="form-group">
                <label>Amount (USD)</label>
                <input type="number" id="field-wage-amount" placeholder="0.00" step="0.5" required>
            </div>
            <div class="form-group">
                <label>Scope / Notes</label>
                <input type="text" id="field-wage-scope" placeholder="e.g. May Salary" required>
            </div>
        `;
        setTimeout(() => {
            const select = document.getElementById('field-wage-worker');
            if (select) select.innerHTML = teamWorkers.map(w => `<option value="${w.id}">${w.name} ($${w.rate}/${w.rateType})</option>`).join('');
        }, 10);
    } else if (actionType === 'invite-user') {
        modalTitle.textContent = "Invite App User";
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${state.farmId}`;
        dynamicFields.innerHTML = `
            <div style="text-align:center; margin-bottom:15px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 12px; border: 1px solid var(--border-glass);">
                <img src="${qrUrl}" alt="Farm ID QR Code" style="border-radius:10px; border:2px solid var(--border-glass); background: white; padding: 5px;">
                <p style="font-size:0.9rem; color:var(--text-main); margin-top:8px;">Farm ID: <strong style="color:var(--primary-light); user-select:all;">${state.farmId}</strong></p>
                <p style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Have them enter this ID to join.</p>
            </div>
            <div class="form-group">
                <label>User Full Name</label>
                <input type="text" id="field-invite-name" placeholder="e.g. Joseph M." required>
            </div>
            <div class="form-group">
                <label>Email Address</label>
                <input type="email" id="field-invite-email" placeholder="e.g. j.m@gmail.com" required>
            </div>
            <div class="form-group">
                <label>Role</label>
                <select id="field-invite-role" required>
                    <option value="Worker">Worker (No Financials)</option>
                    <option value="Manager">Manager (Reports Access)</option>
                    <option value="Admin">Admin (Full Access)</option>
                </select>
            </div>
            <p style="font-size:0.75rem; color:var(--text-muted); margin-top:10px;">The user must sign up using this exact email to be tethered to your farm.</p>
        `;
    } else {
        modalTitle.textContent = "Action Coming Soon";
        dynamicFields.innerHTML = `<p style="color:var(--text-muted); font-size: 0.9rem;">The module '${actionType}' is under development.</p>`;
    }
}

function openMaintenanceLog(equipmentId) {
    openAction('log-maintenance');
    setTimeout(() => {
        const select = document.getElementById('field-maint-equipment');
        if (select) select.value = equipmentId;
    }, 20);
}

function openAnimalTreatmentLog(animalId) {
    openAction('log-treatment');
    setTimeout(() => {
        const select = document.getElementById('field-treat-animal');
        if (select) select.value = animalId;
    }, 20);
}

function closeModal() {
    // Force-hide instantly to prevent double-tap entries
    modal.style.display = 'none';
    setTimeout(() => {
        modal.style.display = '';
        modal.classList.add('hidden');
    }, 50);
    form.reset();
}

function navigateToView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
    const targetEl = document.getElementById(viewId);
    if (targetEl) targetEl.classList.remove('hidden');
    const navEl = document.querySelector(`.bottom-nav .nav-item[data-target="${viewId}"]`);
    if (navEl) navEl.classList.add('active');
}

function showSuccessToast(msg) {
    const toast = document.getElementById('success-toast');
    if (!toast) return;
    document.getElementById('success-message').textContent = msg;
    toast.classList.remove('hidden');
    // Ensure toast is always on top
    toast.style.zIndex = '9999';
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            let newActivity = {
                time: new Date().toISOString(),
                status: 'new',
                visibility: 'Public',
                updatedBy: { uid: state.user?.uid || 'system', name: state.userName || 'System' }
            };
            
            let auditAction = null;
            let auditDetails = '';
        
        if (currentAction === 'diesel') {
            const eq = document.getElementById('field-equipment').value;
            const liters = parseFloat(document.getElementById('field-liters').value);
            
            let invItem = inventory.find(i => i.id === 'diesel');
            if(invItem) {
                invItem.qty -= liters;
                await saveData('inventory', 'diesel', invItem);
            }

            const cost = liters * 1.50;
            newActivity.type = 'warning';
            newActivity.icon = 'fa-gas-pump';
            newActivity.category = 'diesel';
            newActivity.amount = cost;
            newActivity.impact = 'expense';
            newActivity.title = `${eq} Fueled`;
            newActivity.info = `${liters}L of diesel used. Cost: $${cost.toFixed(2)}`;
            newActivity.visibility = 'Sensitive';
            state.usdBalance -= cost;
            auditAction = 'LOG_DIESEL';
            auditDetails = `Cost: $${cost.toFixed(2)}, Liters: ${liters}`;
        } else if (currentAction === 'labor') {
            const task = document.getElementById('field-task').value;
            const workers = document.getElementById('field-workers').value;
            const wage = parseFloat(document.getElementById('field-wage').value);
            
            newActivity.type = 'success';
            newActivity.icon = 'fa-users';
            newActivity.category = 'labor';
            newActivity.amount = wage;
            newActivity.impact = 'expense';
            newActivity.title = `Maricho: ${task}`;
            newActivity.info = `${workers} casuals paid $${wage.toFixed(2)} total.`;
            newActivity.visibility = 'Sensitive';
            state.usdBalance -= wage;
            auditAction = 'LOG_MARICHO';
            auditDetails = `Paid $${wage.toFixed(2)} to ${workers} casuals`;
        } else if (currentAction === 'inputs') {
            const type = document.getElementById('field-input-type').value;
            const qty = parseFloat(document.getElementById('field-qty').value);
            const field = document.getElementById('field-location').value;
            
            let invItem = inventory.find(i => i.id === type);
            if(invItem) {
                invItem.qty -= qty;
                await saveData('inventory', type, invItem);
            }
            
            newActivity.type = 'warning';
            newActivity.icon = 'fa-seedling';
            newActivity.category = 'inputs';
            newActivity.amount = 0; // cost not captured for inputs application
            newActivity.impact = 'expense';
            newActivity.title = `${typeof invItem !== 'undefined' ? invItem.name : type} Applied`;
            newActivity.info = `${qty} units used on ${field}.`;
        } else if (currentAction === 'sales') {
            const crop = document.getElementById('field-crop').value;
            const qty = document.getElementById('field-sale-qty').value;
            const rev = parseFloat(document.getElementById('field-revenue').value);
            
            newActivity.type = 'success';
            newActivity.icon = 'fa-truck-fast';
            newActivity.category = 'sales';
            newActivity.amount = rev;
            newActivity.impact = 'income';
            newActivity.title = `${crop} Sold`;
            newActivity.info = `Sold ${qty} units for $${rev.toFixed(2)}.`;
            newActivity.visibility = 'Sensitive';
            state.usdBalance += rev;
            auditAction = 'LOG_SALE';
            auditDetails = `Sold ${qty} ${crop} for $${rev.toFixed(2)}`;
        } else if (currentAction === 'receive-stock') {
            const itemId = document.getElementById('field-stock-item').value;
            const qty = parseFloat(document.getElementById('field-receive-qty').value);
            const cost = parseFloat(document.getElementById('field-purchase-cost').value);
            
            let invItem = inventory.find(i => i.id === itemId);
            if(invItem) {
                invItem.qty += qty;
                await saveData('inventory', itemId, invItem);
            } else {
                invItem = {
                    id: itemId,
                    name: itemId,
                    qty: qty,
                    unit: 'units',
                    icon: 'fa-box',
                    farmId: state.farmId
                };
                await saveData('inventory', itemId, invItem);
            }
            
            newActivity.type = 'info';
            newActivity.icon = 'fa-boxes-stacked';
            newActivity.category = 'stock-purchase';
            newActivity.amount = cost;
            newActivity.impact = 'expense';
            newActivity.title = `${invItem ? invItem.name : itemId} Received`;
            newActivity.info = `${qty} units received. Cost: $${cost.toFixed(2)}`;
            newActivity.visibility = 'Sensitive';
            state.usdBalance -= cost;
            auditAction = 'RECEIVE_STOCK';
            auditDetails = `${itemId}: ${qty} units, Cost: $${cost.toFixed(2)}`;
        } else if (currentAction === 'add-field') {
            const name = document.getElementById('field-new-name').value;
            const acres = document.getElementById('field-new-size').value;
            const fieldData = { id: name, name: name, crop: 'None', acres: parseFloat(acres), status: 'New', farmId: state.farmId };
            await saveData('fields', name, fieldData);
            
            newActivity.type = 'success';
            newActivity.icon = 'fa-map';
            newActivity.title = `Field Added`;
            newActivity.info = `${name} (${acres} Acres) created.`;
        } else if (currentAction === 'add-equipment') {
            const name = document.getElementById('field-eq-name').value;
            const hours = parseInt(document.getElementById('field-eq-hours').value);
            const eqData = { id: name, name: name, status: 'Running', hours: hours, lastService: 'Not yet serviced', icon: 'fa-tractor', farmId: state.farmId };
            await saveData('equipment', name, eqData);
            
            newActivity.type = 'success';
            newActivity.icon = 'fa-tractor';
            newActivity.title = `Equipment Added`;
            newActivity.info = `${name} tracked.`;
        } else if (currentAction === 'log-maintenance') {
            const eqId = document.getElementById('field-maint-equipment').value;
            const type = document.getElementById('field-maint-type').value;
            const hours = parseFloat(document.getElementById('field-maint-hours').value);
            const cost = parseFloat(document.getElementById('field-maint-cost').value) || 0;
            const notes = document.getElementById('field-maint-notes').value;
            
            let eq = farmEquipment.find(e => e.id === eqId);
            if (eq) {
                eq.hours = hours;
                eq.lastService = `${type} @ ${hours}hrs`;
                await saveData('equipment', eq.id, eq);
            }
            
            newActivity.type = 'warning';
            newActivity.icon = 'fa-wrench';
            newActivity.title = `${eq ? eq.name : eqId}: ${type}`;
            newActivity.info = `${notes || type} at ${hours}hrs. Cost: $${cost}`;
            newActivity.visibility = cost > 0 ? 'Sensitive' : 'Public';
            if (cost > 0) {
                state.usdBalance -= cost;
                auditAction = 'LOG_MAINTENANCE';
                auditDetails = `Cost: $${cost}`;
            }
        } else if (currentAction === 'plant-crop') {
            const fieldId = document.getElementById('field-plant-id').value;
            const crop = document.getElementById('field-plant-crop').value;
            let fieldInfo = farmFields.find(f => f.id === fieldId);
            if (fieldInfo) {
                fieldInfo.crop = crop;
                fieldInfo.status = 'Planted';
                await saveData('fields', fieldId, fieldInfo);
            }
            newActivity.type = 'success';
            newActivity.icon = 'fa-seedling';
            newActivity.title = `Field Planted`;
            newActivity.info = `${crop} planted in ${fieldInfo ? fieldInfo.name : fieldId}.`;
        } else if (currentAction === 'harvest-crop') {
            const fieldId = document.getElementById('field-harvest-id').value;
            const qty = document.getElementById('field-harvest-qty').value;
            const unit = document.getElementById('field-harvest-unit').value;
            let fieldInfo = farmFields.find(f => f.id === fieldId);
            let harvestedCrop = fieldInfo ? fieldInfo.crop : 'Crop';
            
            if (fieldInfo) {
                fieldInfo.crop = 'Fallow';
                fieldInfo.status = 'Ready for Prep';
                await saveData('fields', fieldId, fieldInfo);
            }
            newActivity.type = 'success';
            newActivity.icon = 'fa-sickle';
            newActivity.title = `Harvest Complete`;
            newActivity.info = `Harvested ${qty} ${unit} of ${harvestedCrop} from ${fieldInfo ? fieldInfo.name : fieldId}.`;
        } else if (currentAction === 'adjust-stock') {
            const itemId = document.getElementById('field-adjust-item').value;
            const newQty = parseFloat(document.getElementById('field-adjust-qty').value);
            const notes = document.getElementById('field-adjust-notes').value;
            
            let invItem = inventory.find(i => i.id === itemId);
            if(invItem) {
                invItem.qty = newQty;
                await saveData('inventory', itemId, invItem);
            }
            
            newActivity.type = 'info';
            newActivity.icon = 'fa-boxes-stacked';
            newActivity.title = `Stock Adjusted`;
            newActivity.info = `${invItem ? invItem.name : itemId} corrected to ${newQty}. ${notes}`;
        } else if (currentAction === 'add-animal') {
            const tag = document.getElementById('field-animal-tag').value;
            const species = document.getElementById('field-animal-species').value;
            const breed = document.getElementById('field-animal-breed').value;
            const count = parseInt(document.getElementById('field-animal-count').value);
            const notes = document.getElementById('field-animal-notes').value;
            const id = tag + '-' + Date.now();
            const animalData = { id, tag, name: species, breed, count, status: 'Healthy', notes: notes || 'Newly registered', icon: 'fa-cow', farmId: state.farmId };
            await saveData('livestock', id, animalData);
            newActivity.type = 'success';
            newActivity.icon = 'fa-cow';
            newActivity.title = `${species} Registered`;
            newActivity.info = `${count} ${breed} ${species}. Tag: ${tag}`;
        } else if (currentAction === 'log-treatment') {
            const animalId = document.getElementById('field-treat-animal').value;
            const condition = document.getElementById('field-treat-condition').value;
            const medicine = document.getElementById('field-treat-medicine').value;
            const affected = document.getElementById('field-treat-count').value;
            const newStatus = document.getElementById('field-treat-status').value;
            const cost = parseFloat(document.getElementById('field-treat-cost').value) || 0;
            let animal = livestock.find(a => a.id === animalId);
            if (animal) {
                animal.status = newStatus;
                await saveData('livestock', animal.id, animal);
            }
            newActivity.type = newStatus === 'Healthy' ? 'success' : 'warning';
            newActivity.icon = 'fa-syringe';
            newActivity.category = 'treatment';
            newActivity.amount = cost;
            newActivity.impact = cost > 0 ? 'expense' : null;
            newActivity.title = `${animal ? animal.name : 'Animal'}: ${condition}`;
            newActivity.info = `${medicine || 'Treated'} — ${affected || '?'} affected. Status: ${newStatus}. Cost: $${cost.toFixed(2)}`;
            newActivity.visibility = cost > 0 ? 'Sensitive' : 'Public';
            if (cost > 0) {
                state.usdBalance -= cost;
                auditAction = 'LOG_TREATMENT';
                auditDetails = `${condition} on ${animal ? animal.name : 'Animal'}, Cost: $${cost.toFixed(2)}`;
            }
        } else if (currentAction === 'add-worker') {
            const name = document.getElementById('field-worker-name').value;
            const type = document.getElementById('field-worker-type').value;
            const rate = parseFloat(document.getElementById('field-worker-rate').value);
            const rateType = document.getElementById('field-worker-ratetype').value;
            
            const workerId = 'W-' + Date.now();
            const workerData = { id: workerId, name, type, rate, rateType, createdAt: new Date().toISOString(), farmId: state.farmId };
            await saveData('workers', workerId, workerData);
            
            newActivity.type = 'success';
            newActivity.icon = 'fa-hard-hat';
            newActivity.title = `Worker Registered`;
            newActivity.info = `${name} (${type}) registered at $${rate}/${rateType}.`;
            newActivity.visibility = 'Sensitive';
            
            auditAction = 'CREATE_WORKER';
            auditDetails = `Added ${name} at $${rate}/${rateType}`;
        } else if (currentAction === 'assign-task') {
            const desc = document.getElementById('field-task-desc').value;
            const workerId = document.getElementById('field-task-worker').value;
            const priority = document.getElementById('field-task-priority')?.value || 'Medium';
            const dueDate = document.getElementById('field-task-due')?.value || null;
            
            const taskId = 'T-' + Date.now();
            const taskData = { id: taskId, workerId, desc, priority, dueDate, status: 'Pending', dateAssigned: new Date().toISOString(), farmId: state.farmId };
            await saveData('tasks', taskId, taskData);
            
            const worker = teamWorkers.find(w => w.id === workerId);
            
            newActivity.type = 'info';
            newActivity.icon = 'fa-clipboard-list';
            newActivity.title = `Task Assigned`;
            newActivity.info = `"${desc}" assigned to ${worker ? worker.name : 'Unknown'}.${dueDate ? ` Due: ${dueDate}.` : ''}`;
        } else if (currentAction === 'pay-wage') {
            const workerId = document.getElementById('field-wage-worker').value;
            const amount = parseFloat(document.getElementById('field-wage-amount').value);
            const scope = document.getElementById('field-wage-scope').value;
            
            const payId = 'P-' + Date.now();
            const payData = { id: payId, workerId, amount, scope, date: new Date().toISOString(), farmId: state.farmId };
            await saveData('payroll', payId, payData);
            
            const worker = teamWorkers.find(w => w.id === workerId);
            state.usdBalance -= amount;
            
            newActivity.type = 'warning';
            newActivity.icon = 'fa-money-bill-wave';
            newActivity.category = 'wages';
            newActivity.amount = amount;
            newActivity.impact = 'expense';
            newActivity.title = `Payslip: ${worker ? worker.name : 'Worker'}`;
            newActivity.info = `Paid $${amount.toFixed(2)} for ${scope}.`;
            newActivity.visibility = 'Sensitive';
            
            auditAction = 'PAY_WAGES';
            auditDetails = `Paid $${amount.toFixed(2)} to ${worker ? worker.name : workerId}`;
        } else if (currentAction === 'invite-user') {
            const name = document.getElementById('field-invite-name').value;
            const email = document.getElementById('field-invite-email').value;
            const role = document.getElementById('field-invite-role').value;
            
            // Create Placeholder Invite doc
            // In a multi-tenant setup, we use email as the tether point
            await setDoc(doc(window.db, "users", `invite-${email}`), {
                email,
                name,
                role,
                status: 'Invited',
                farmId: state.farmId,
                invitedAt: new Date().toISOString(),
                invitedBy: state.user.uid
            });
            
            showSuccessToast(`Invite registered! Opening mail client...`);
            
            const subject = encodeURIComponent("You are invited to ZimFarm ERP");
            const body = encodeURIComponent(`Hi ${name},\n\nYou have been invited to join our farm on ZimFarm ERP as a ${role}.\n\nOur Farm ID is: ${state.farmId}\n\nPlease click here to securely sign up and join the team: ${window.location.origin}\n\nWelcome aboard!`);
            window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
            
            closeModal();
            return;
        } else {
            closeModal();
            return;
        }
        
        document.getElementById('btn-usd').click();
        
        await saveData('activities', null, newActivity);
        await saveData('financials', state.farmId, { usdBalance: state.usdBalance });
        
        if (auditAction && state.user) {
            await addDoc(collection(window.db, "logs"), {
                action: auditAction,
                details: auditDetails,
                time: new Date().toISOString(),
                user: { uid: state.user.uid, name: state.userName || 'System' }
            });
        }

        closeModal();
        const toastMsg = newActivity.title + ' saved!';
        setTimeout(() => {
            showSuccessToast(toastMsg);
            if (currentAction === 'add-equipment') {
                navigateToView('view-equipment');
            } else if (currentAction === 'add-field') {
                navigateToView('view-fields');
            } else if (currentAction === 'receive-stock') {
                navigateToView('view-stock');
            } else if (currentAction === 'add-animal' || currentAction === 'log-treatment') {
                navigateToView('view-livestock');
            } else if (['add-worker', 'assign-task', 'pay-wage'].includes(currentAction)) {
                navigateToView('view-labor');
            } else {
                navigateToView('view-home');
            }
        }, 100);
    });
}
