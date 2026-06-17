import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  Clock, 
  Plus, 
  Trash2, 
  BarChart3, 
  Activity, 
  Calendar, 
  Upload, 
  Info, 
  AlertTriangle, 
  Play, 
  Square, 
  CheckCircle, 
  RefreshCw,
  HelpCircle,
  TrendingUp,
  Sliders,
  DollarSign,
  Cloud,
  CloudOff,
  User,
  LogIn,
  LogOut,
  Mail,
  Lock,
  ChevronRight,
  ShieldCheck,
  Smartphone
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  signInWithCustomToken, 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  deleteDoc, 
  onSnapshot, 
  collection
} from 'firebase/firestore';

let firebaseConfig = null;

// Read config from system injects or Vercel environment variables
if (typeof __firebase_config !== 'undefined' && __firebase_config) {
  try {
    firebaseConfig = JSON.parse(__firebase_config);
  } catch (e) {
    console.error("Error parsing environment config: ", e);
  }
} else {
  // Read Vite env variables configured via Vercel / local .env
  firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
  };
}

let app = null;
let auth = null;
let db = null;
const appId = typeof __app_id !== 'undefined' ? __app_id : 'powerlog-energy-audit';

// Only initialize if we have a valid configuration setup
if (firebaseConfig && firebaseConfig.apiKey) {
  try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error("Firebase Initialization Error: ", error);
  }
}

const DEFAULT_APPLIANCES = [
  { id: 'app-1', name: 'Central Air Conditioner', wattage: 3500, category: 'Cooling/Heating' },
  { id: 'app-2', name: 'Refrigerator (Auto-Cycle)', wattage: 180, category: 'Kitchen' },
  { id: 'app-3', name: 'Water Heater', wattage: 4500, category: 'Utility' },
  { id: 'app-4', name: 'Gaming Desktop PC', wattage: 450, category: 'Electronics' },
  { id: 'app-5', name: 'Electric Clothes Dryer', wattage: 4000, category: 'Laundry' },
  { id: 'app-6', name: 'Microwave Oven', wattage: 1200, category: 'Kitchen' }
];

const formatDate = (dateObj) => {
  return dateObj.toISOString().split('T')[0];
};

const formatTimeStr = (dateObj) => {
  return dateObj.toTimeString().split(' ')[0].substring(0, 5);
};

const generateMockLogs = (appliances) => {
  const logs = [];
  const now = new Date();
  for (let i = 2; i >= 0; i--) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - i);
    const dateStr = formatDate(targetDate);
    
    logs.push({
      id: `log-ac-1-${i}`,
      applianceId: 'app-1',
      date: dateStr,
      startTime: '12:00',
      duration: 120,
      kwh: (3500 * 2) / 1000
    });
    logs.push({
      id: `log-ac-2-${i}`,
      applianceId: 'app-1',
      date: dateStr,
      startTime: '16:30',
      duration: 180,
      kwh: (3500 * 3) / 1000
    });
    logs.push({
      id: `log-fridge-${i}`,
      applianceId: 'app-2',
      date: dateStr,
      startTime: '00:00',
      duration: 504,
      kwh: (180 * 8.4) / 1000
    });
  }
  return logs;
};

const generateMockUtilityData = (logs, targetDaysCount = 3) => {
  const data = [];
  const now = new Date();
  for (let i = targetDaysCount - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const dateStr = formatDate(d);
    const dayLoggedKwh = logs
      .filter(l => l.date === dateStr)
      .reduce((sum, l) => sum + l.kwh, 0);
    const baseLoadKwh = 5.8 + (Math.random() * 1.5);
    const totalUtilityKwh = parseFloat((dayLoggedKwh + baseLoadKwh).toFixed(2));
    
    data.push({
      id: dateStr,
      date: dateStr,
      kwh: totalUtilityKwh,
      source: 'Imported (Utility Co)'
    });
  }
  return data;
};

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);
  const [syncStatus, setSyncStatus] = useState('local'); // local | syncing | synced | error
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  // Application Data States (Defaulting to sandbox if not loaded yet)
  const [appliances, setAppliances] = useState(() => {
    const saved = localStorage.getItem('energy_tracker_appliances');
    return saved ? JSON.parse(saved) : DEFAULT_APPLIANCES;
  });
  const [logs, setLogs] = useState(() => {
    const saved = localStorage.getItem('energy_tracker_logs');
    return saved ? JSON.parse(saved) : generateMockLogs(DEFAULT_APPLIANCES);
  });
  const [utilityData, setUtilityData] = useState(() => {
    const saved = localStorage.getItem('energy_tracker_utility');
    if (saved) return JSON.parse(saved);
    const initialLogs = generateMockLogs(DEFAULT_APPLIANCES);
    return generateMockUtilityData(initialLogs, 3);
  });

  // Timers and UI Interaction States
  const [activeTimers, setActiveTimers] = useState({});
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [notification, setNotification] = useState(null);
  const [modalConfig, setModalConfig] = useState(null); // Custom confirm modal state

  // Form inputs
  const [newAppName, setNewAppName] = useState('');
  const [newAppWattage, setNewAppWattage] = useState('');
  const [newAppCategory, setNewAppCategory] = useState('Kitchen');
  const [logApplianceId, setLogApplianceId] = useState('');
  const [logDate, setLogDate] = useState(formatDate(new Date()));
  const [logStartTime, setLogStartTime] = useState('12:00');
  const [logDuration, setLogDuration] = useState('');
  const [utilDate, setUtilDate] = useState(formatDate(new Date()));
  const [utilKwh, setUtilKwh] = useState('');
  const [csvText, setCsvText] = useState('');
  const [electricityRate, setElectricityRate] = useState(0.15);

  const triggerNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  useEffect(() => {
    if (!auth) {
      setSyncStatus('local');
      return;
    }

    const initAuth = async () => {
      try {
        setSyncStatus('syncing');
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          // Fallback to anonymous auth to meet database verification rules initially
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth configuration failed: ", err);
        setSyncStatus('error');
      }
    };

    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser && !currentUser.isAnonymous) {
        setSyncStatus('synced');
        triggerNotification(`Signed in successfully as ${currentUser.email}`);
      } else if (currentUser && currentUser.isAnonymous) {
        setSyncStatus('synced');
      } else {
        setSyncStatus('local');
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user || !db) return;

    setSyncStatus('syncing');

    // Subscribe to Appliances
    const appliancesCol = collection(db, 'artifacts', appId, 'users', user.uid, 'appliances');
    const unsubscribeApps = onSnapshot(appliancesCol, (snapshot) => {
      const appsList = [];
      snapshot.forEach(doc => {
        appsList.push({ id: doc.id, ...doc.data() });
      });
      if (appsList.length > 0) {
        setAppliances(appsList);
      }
    }, (error) => {
      console.error("Appliances firestore sync error:", error);
      setSyncStatus('error');
    });

    // Subscribe to Logs
    const logsCol = collection(db, 'artifacts', appId, 'users', user.uid, 'logs');
    const unsubscribeLogs = onSnapshot(logsCol, (snapshot) => {
      const logsList = [];
      snapshot.forEach(doc => {
        logsList.push({ id: doc.id, ...doc.data() });
      });
      logsList.sort((a, b) => b.date.localeCompare(a.date));
      setLogs(logsList);
    }, (error) => {
      console.error("Logs firestore sync error:", error);
      setSyncStatus('error');
    });

    // Subscribe to Utility Data
    const utilityCol = collection(db, 'artifacts', appId, 'users', user.uid, 'utility_data');
    const unsubscribeUtility = onSnapshot(utilityCol, (snapshot) => {
      const utilityList = [];
      snapshot.forEach(doc => {
        utilityList.push({ id: doc.id, ...doc.data() });
      });
      utilityList.sort((a, b) => b.date.localeCompare(a.date));
      setUtilityData(utilityList);
    }, (error) => {
      console.error("Utility firestore sync error:", error);
      setSyncStatus('error');
    });

    setSyncStatus('synced');

    return () => {
      unsubscribeApps();
      unsubscribeLogs();
      unsubscribeUtility();
    };
  }, [user]);

  // Synchronize to LocalStorage as a fallback when database is unconfigured
  useEffect(() => {
    if (!user || user.isAnonymous) {
      localStorage.setItem('energy_tracker_appliances', JSON.stringify(appliances));
    }
  }, [appliances, user]);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      localStorage.setItem('energy_tracker_logs', JSON.stringify(logs));
    }
  }, [logs, user]);

  useEffect(() => {
    if (!user || user.isAnonymous) {
      localStorage.setItem('energy_tracker_utility', JSON.stringify(utilityData));
    }
  }, [utilityData, user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pushAppliance = async (appObj) => {
    if (!user || !db) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'appliances', appObj.id), {
        name: appObj.name,
        wattage: appObj.wattage,
        category: appObj.category
      });
    } catch (e) {
      console.error("Error updating database item: ", e);
    }
  };

  const removeAppliance = async (appIdToDelete) => {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'appliances', appIdToDelete));
    } catch (e) {
      console.error("Error deleting database item: ", e);
    }
  };

  const pushLog = async (logObj) => {
    if (!user || !db) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', logObj.id), {
        applianceId: logObj.applianceId,
        date: logObj.date,
        startTime: logObj.startTime,
        duration: logObj.duration,
        kwh: logObj.kwh
      });
    } catch (e) {
      console.error("Error pushing run log: ", e);
    }
  };

  const removeLog = async (logIdToDelete) => {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'logs', logIdToDelete));
    } catch (e) {
      console.error("Error removing run log: ", e);
    }
  };

  const pushUtility = async (utilObj) => {
    if (!user || !db) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'utility_data', utilObj.id), {
        date: utilObj.date,
        kwh: utilObj.kwh,
        source: utilObj.source
      });
    } catch (e) {
      console.error("Error pushing utility record: ", e);
    }
  };

  const removeUtility = async (utilIdToDelete) => {
    if (!user || !db) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'utility_data', utilIdToDelete));
    } catch (e) {
      console.error("Error removing utility record: ", e);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    if (!auth) {
      triggerNotification('Firebase is not yet configured on this deployment.', 'error');
      return;
    }
    if (!authEmail || !authPassword) {
      triggerNotification('Email and password must not be empty.', 'error');
      return;
    }

    setAuthLoading(true);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        triggerNotification('Account successfully registered! Data is secured.', 'success');
      } else {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
        triggerNotification('Logged in successfully!', 'success');
      }
    } catch (err) {
      triggerNotification(err.message, 'error');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!auth) return;
    await signOut(auth);
    // Auto re-login anonymously to preserve sandbox experience
    await signInAnonymously(auth);
    triggerNotification('Logged out successfully. Running in sandbox Mode.');
  };

  const confirmAction = (title, message, onConfirm) => {
    setModalConfig({ title, message, onConfirm });
  };

  const handleAddAppliance = (e) => {
    e.preventDefault();
    if (!newAppName.trim() || !newAppWattage) {
      triggerNotification('Please specify both name and nominal wattage.', 'error');
      return;
    }
    const wattValue = parseFloat(newAppWattage);
    if (isNaN(wattValue) || wattValue <= 0) {
      triggerNotification('Wattage rating must be a positive number.', 'error');
      return;
    }

    const newApp = {
      id: `app-${Date.now()}`,
      name: newAppName,
      wattage: wattValue,
      category: newAppCategory
    };

    if (user && db) {
      pushAppliance(newApp);
    } else {
      setAppliances(prev => [...prev, newApp]);
    }
    setNewAppName('');
    setNewAppWattage('');
    triggerNotification(`Successfully registered "${newApp.name}".`);
  };

  const handleDeleteAppliance = (id, name) => {
    confirmAction(
      "Remove Appliance Configuration",
      `Are you sure you want to delete the configuration for "${name}"? Historical logs won't be deleted but will read as legacy items.`,
      () => {
        if (user && db) {
          removeAppliance(id);
        } else {
          setAppliances(prev => prev.filter(a => a.id !== id));
        }
        triggerNotification(`Removed configuration for "${name}".`);
      }
    );
  };

  const handleStartTimer = (applianceId) => {
    setActiveTimers(prev => ({
      ...prev,
      [applianceId]: Date.now()
    }));
    triggerNotification(`Active stopwatch started for ${appliances.find(a => a.id === applianceId)?.name}`);
  };

  const handleStopTimer = (applianceId) => {
    const startTimestamp = activeTimers[applianceId];
    if (!startTimestamp) return;

    const stopTimestamp = Date.now();
    const durationMs = stopTimestamp - startTimestamp;
    const durationMins = Math.max(1, Math.round(durationMs / 60000));

    const appObj = appliances.find(a => a.id === applianceId);
    if (!appObj) return;

    const calculatedKwh = parseFloat(((appObj.wattage * (durationMins / 60)) / 1000).toFixed(4));
    const now = new Date();

    const newLog = {
      id: `log-${Date.now()}`,
      applianceId: applianceId,
      date: formatDate(now),
      startTime: formatTimeStr(new Date(startTimestamp)),
      duration: durationMins,
      kwh: calculatedKwh
    };

    if (user && db) {
      pushLog(newLog);
    } else {
      setLogs(prev => [newLog, ...prev]);
    }

    const updatedTimers = { ...activeTimers };
    delete updatedTimers[applianceId];
    setActiveTimers(updatedTimers);

    triggerNotification(`Saved active run: logged ${durationMins}m for ${appObj.name}!`);
  };

  const handleManualLog = (e) => {
    e.preventDefault();
    if (!logApplianceId || !logDate || !logStartTime || !logDuration) {
      triggerNotification('Please specify all required run inputs.', 'error');
      return;
    }

    const durationMins = parseInt(logDuration);
    if (isNaN(durationMins) || durationMins <= 0) {
      triggerNotification('Duration must be greater than zero.', 'error');
      return;
    }

    const appObj = appliances.find(a => a.id === logApplianceId);
    if (!appObj) return;

    const calculatedKwh = parseFloat(((appObj.wattage * (durationMins / 60)) / 1000).toFixed(4));

    const newLog = {
      id: `log-${Date.now()}`,
      applianceId: logApplianceId,
      date: logDate,
      startTime: logStartTime,
      duration: durationMins,
      kwh: calculatedKwh
    };

    if (user && db) {
      pushLog(newLog);
    } else {
      setLogs(prev => [newLog, ...prev]);
    }

    setLogDuration('');
    triggerNotification(`Manually saved ${appObj.name} run of ${durationMins} minutes.`);
  };

  const handleDeleteLog = (id) => {
    confirmAction(
      "Delete Energy Run Record",
      "Are you sure you want to permanently delete this logged running event? This will lower your audited total.",
      () => {
        if (user && db) {
          removeLog(id);
        } else {
          setLogs(prev => prev.filter(l => l.id !== id));
        }
        triggerNotification('Energy audit record deleted.');
      }
    );
  };

  const handleAddUtilityEntry = (e) => {
    e.preventDefault();
    if (!utilDate || !utilKwh) {
      triggerNotification('Please specify both billing date and kWh totals.', 'error');
      return;
    }

    const kwhVal = parseFloat(utilKwh);
    if (isNaN(kwhVal) || kwhVal < 0) {
      triggerNotification('KWh volume must be a positive numeric value.', 'error');
      return;
    }

    const newEntry = {
      id: utilDate,
      date: utilDate,
      kwh: kwhVal,
      source: 'Manual'
    };

    if (user && db) {
      pushUtility(newEntry);
    } else {
      setUtilityData(prev => {
        const cleaned = prev.filter(d => d.date !== utilDate);
        return [...cleaned, newEntry].sort((a,b) => b.date.localeCompare(a.date));
      });
    }
    setUtilKwh('');
    triggerNotification(`Saved meter reading for ${utilDate}: ${kwhVal} kWh.`);
  };

  const handleDeleteUtilityEntry = (dateKey) => {
    confirmAction(
      "Delete Utility Reading",
      `Are you sure you want to remove the power provider metered totals for ${dateKey}?`,
      () => {
        if (user && db) {
          removeUtility(dateKey);
        } else {
          setUtilityData(prev => prev.filter(d => d.date !== dateKey));
        }
        triggerNotification(`Deleted utility log for ${dateKey}`);
      }
    );
  };

  const handleCsvImport = (e) => {
    e.preventDefault();
    if (!csvText.trim()) {
      triggerNotification('Please paste valid CSV contents before compiling.', 'error');
      return;
    }

    const lines = csvText.split('\n');
    let successCount = 0;

    lines.forEach(line => {
      const cols = line.split(/[,\t]/);
      if (cols.length >= 2) {
        const rawDate = cols[0].trim();
        const rawKwh = cols[1].trim();

        const dateMatch = rawDate.match(/^\d{4}-\d{2}-\d{2}$/);
        const kwhNum = parseFloat(rawKwh);

        if (dateMatch && !isNaN(kwhNum)) {
          const entry = {
            id: rawDate,
            date: rawDate,
            kwh: kwhNum,
            source: 'CSV Upload'
          };
          if (user && db) {
            pushUtility(entry);
          } else {
            setUtilityData(prev => {
              const cleaned = prev.filter(d => d.date !== rawDate);
              return [...cleaned, entry];
            });
          }
          successCount++;
        }
      }
    });

    if (successCount === 0) {
      triggerNotification('Format incorrect. Use lines with YYYY-MM-DD, kWh pairs.', 'error');
      return;
    }

    if (!user || !db) {
      setUtilityData(prev => [...prev].sort((a, b) => b.date.localeCompare(a.date)));
    }

    setCsvText('');
    triggerNotification(`Processed bulk records: ${successCount} entries compiled!`);
  };

  const handleAutoGenerateUtility = () => {
    const loggedDates = [...new Set(logs.map(l => l.date))];
    if (loggedDates.length === 0) {
      triggerNotification('You have no logged runs. Create appliance runs first to auto-generate corresponding dates!', 'error');
      return;
    }

    loggedDates.forEach(dateStr => {
      const dayLoggedKwh = logs
        .filter(l => l.date === dateStr)
        .reduce((sum, l) => sum + l.kwh, 0);
      
      const standbyLoad = 5.5 + (Math.random() * 2.0); 
      const totalUtilityKwh = parseFloat((dayLoggedKwh + standbyLoad).toFixed(2));

      const entry = {
        id: dateStr,
        date: dateStr,
        kwh: totalUtilityKwh,
        source: 'Auto-Simulated'
      };

      if (user && db) {
        pushUtility(entry);
      } else {
        setUtilityData(prev => {
          const cleaned = prev.filter(d => d.date !== dateStr);
          return [...cleaned, entry];
        });
      }
    });

    if (!user || !db) {
      setUtilityData(prev => [...prev].sort((a, b) => b.date.localeCompare(a.date)));
    }
    triggerNotification(`Simulated utility meter values for your logged dates.`);
  };

  const handleResetData = () => {
    confirmAction(
      "Reset Dashboard Database",
      "This action will return all logs, utility values, and registered appliances to pre-populated demonstration settings. Are you absolutely sure?",
      async () => {
        if (user && db) {
          // Reset cloud database
          for (const app of appliances) {
            await removeAppliance(app.id);
          }
          for (const log of logs) {
            await removeLog(log.id);
          }
          for (const util of utilityData) {
            await removeUtility(util.id);
          }
          // Seed new defaults to cloud
          const freshLogs = generateMockLogs(DEFAULT_APPLIANCES);
          const freshUtils = generateMockUtilityData(freshLogs, 3);
          
          for (const app of DEFAULT_APPLIANCES) {
            await pushAppliance(app);
          }
          for (const log of freshLogs) {
            await pushLog(log);
          }
          for (const util of freshUtils) {
            await pushUtility(util);
          }
        } else {
          // Reset local sandboxes
          setAppliances(DEFAULT_APPLIANCES);
          const freshLogs = generateMockLogs(DEFAULT_APPLIANCES);
          setLogs(freshLogs);
          setUtilityData(generateMockUtilityData(freshLogs, 3));
        }
        setActiveTimers({});
        triggerNotification('All dashboard files reset to initial demo configuration.');
      }
    );
  };

  const logsGroupedByDate = useMemo(() => {
    const groups = {};
    logs.forEach(log => {
      if (!groups[log.date]) {
        groups[log.date] = 0;
      }
      groups[log.date] += log.kwh;
    });
    return groups;
  }, [logs]);

  const dateWiseComparison = useMemo(() => {
    const allDates = new Set([
      ...Object.keys(logsGroupedByDate),
      ...utilityData.map(d => d.date)
    ]);

    return Array.from(allDates)
      .sort((a, b) => b.localeCompare(a))
      .map(date => {
        const loggedKwh = logsGroupedByDate[date] || 0;
        const utilMatch = utilityData.find(d => d.date === date);
        const utilityKwh = utilMatch ? utilMatch.kwh : 0;
        const difference = utilityKwh > 0 ? parseFloat((utilityKwh - loggedKwh).toFixed(2)) : null;
        const loggedPercent = utilityKwh > 0 
          ? Math.min(100, Math.round((loggedKwh / utilityKwh) * 100)) 
          : 0;

        return {
          date,
          loggedKwh: parseFloat(loggedKwh.toFixed(3)),
          utilityKwh: parseFloat(utilityKwh.toFixed(3)),
          difference,
          loggedPercent
        };
      });
  }, [logsGroupedByDate, utilityData]);

  const totals = useMemo(() => {
    const totalLoggedKwh = logs.reduce((sum, l) => sum + l.kwh, 0);
    const totalUtilityKwh = utilityData.reduce((sum, u) => sum + u.kwh, 0);
    const matchedUtilityDays = dateWiseComparison.filter(d => d.utilityKwh > 0);
    
    const sumMatchedUtility = matchedUtilityDays.reduce((sum, d) => sum + d.utilityKwh, 0);
    const sumMatchedLogged = matchedUtilityDays.reduce((sum, d) => sum + d.loggedKwh, 0);
    const unaccountedKwh = Math.max(0, sumMatchedUtility - sumMatchedLogged);
    const overallAccountedPercent = sumMatchedUtility > 0 
      ? Math.round((sumMatchedLogged / sumMatchedUtility) * 100) 
      : 0;

    return {
      totalLoggedKwh,
      totalUtilityKwh,
      unaccountedKwh,
      overallAccountedPercent,
      daysCount: matchedUtilityDays.length,
      averageBaseLoadPerDay: matchedUtilityDays.length > 0 
        ? parseFloat((unaccountedKwh / matchedUtilityDays.length).toFixed(2)) 
        : 0
    };
  }, [logs, utilityData, dateWiseComparison]);

  const applianceEnergyShare = useMemo(() => {
    const shares = {};
    logs.forEach(log => {
      const app = appliances.find(a => a.id === log.applianceId);
      const appName = app ? app.name : 'Legacy Item';
      const category = app ? app.category : 'Other';
      if (!shares[appName]) {
        shares[appName] = { name: appName, kwh: 0, category };
      }
      shares[appName].kwh += log.kwh;
    });

    return Object.values(shares)
      .map(item => ({
        ...item,
        kwh: parseFloat(item.kwh.toFixed(2)),
        cost: parseFloat((item.kwh * electricityRate).toFixed(2))
      }))
      .sort((a,b) => b.kwh - a.kwh);
  }, [logs, appliances, electricityRate]);

  const getTimerDurationStr = (applianceId) => {
    const start = activeTimers[applianceId];
    if (!start) return '0:00';
    const elapsedSecs = Math.floor((currentTime - start) / 1000);
    const mins = Math.floor(elapsedSecs / 60);
    const secs = elapsedSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* HEADER NAVBAR */}
      <header className="border-b border-slate-900 bg-slate-900/80 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/30">
              <Zap className="h-6 w-6 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                PowerLog
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">Real-time Appliance Audit & Meter Audit</p>
            </div>
          </div>
          
          <div className="flex space-x-1 sm:space-x-2">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'dashboard' 
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700' 
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden md:inline">Dashboard</span>
            </button>

            <button
              onClick={() => setActiveTab('logs')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'logs' 
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700' 
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>Runs</span>
              {Object.keys(activeTimers).length > 0 && (
                <span className="bg-amber-500 text-slate-950 font-bold px-1.5 py-0.5 rounded-full text-2xs animate-bounce">
                  {Object.keys(activeTimers).length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('appliances')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'appliances' 
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700' 
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <Sliders className="h-4 w-4" />
              <span>Appliances</span>
            </button>

            <button
              onClick={() => setActiveTab('utility')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'utility' 
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700' 
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <Upload className="h-4 w-4" />
              <span>Utility</span>
            </button>

            <button
              onClick={() => setActiveTab('cloud')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'cloud' 
                  ? 'bg-slate-800 text-emerald-400 shadow-sm border border-slate-700' 
                  : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
              }`}
            >
              <Cloud className="h-4 w-4" />
              <span className="hidden sm:inline">Cloud Sync</span>
            </button>
          </div>
        </div>
      </header>

      {/* CLOUD CONNECTION BAR */}
      <div className={`text-xs py-1.5 px-4 text-center font-medium border-b flex justify-center items-center gap-2 ${
        !auth 
          ? 'bg-amber-950/40 text-amber-300 border-amber-900/30' 
          : user && !user.isAnonymous
          ? 'bg-emerald-950/40 text-emerald-300 border-emerald-900/30' 
          : 'bg-blue-950/40 text-blue-300 border-blue-900/30'
      }`}>
        {!auth ? (
          <>
            <CloudOff className="w-3.5 h-3.5" />
            <span>Local Sandbox Mode. To sync across your phone and Vercel app, set up your Database Config keys.</span>
          </>
        ) : user && !user.isAnonymous ? (
          <>
            <Cloud className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cloud Database Active. Logged in as: <strong className="font-mono">{user.uid}</strong> ({user.email}).</span>
          </>
        ) : (
          <>
            <CloudOff className="w-3.5 h-3.5 text-blue-400" />
            <span>Sandbox Mode (Data stored locally). Link a permanent profile in the <strong>Cloud Sync</strong> tab to use other devices.</span>
          </>
        )}
      </div>

      {/* DYNAMIC ACTIONS CONFIRMATION DIALOG (MODAL OVERLAY) */}
      {modalConfig && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-in fade-in zoom-in duration-200">
            <h3 className="text-md font-bold text-slate-100 mb-2 flex items-center gap-1.5">
              <AlertTriangle className="text-amber-500 w-5 h-5 shrink-0" />
              {modalConfig.title}
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              {modalConfig.message}
            </p>
            <div className="flex gap-3 justify-end">
              <button 
                onClick={() => setModalConfig(null)}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  modalConfig.onConfirm();
                  setModalConfig(null);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white rounded-lg transition"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATIONS */}
      {notification && (
        <div className="fixed bottom-5 right-5 z-50 animate-bounce">
          <div className={`flex items-center space-x-2 px-4 py-3 rounded-xl border shadow-2xl ${
            notification.type === 'error' 
              ? 'bg-rose-950/90 text-rose-300 border-rose-500/50' 
              : 'bg-slate-900/95 text-emerald-300 border-emerald-500/50'
          }`}>
            <CheckCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{notification.message}</p>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* BANNER / BASICS */}
        {activeTab !== 'cloud' && (
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <div>
                <p className="text-xs text-slate-400">Current Electricity Billing Baseline</p>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-sm font-medium text-slate-300">Rate per kWh:</span>
                  <input 
                    type="number" 
                    step="0.01" 
                    value={electricityRate}
                    onChange={(e) => setElectricityRate(Math.max(0.01, parseFloat(e.target.value) || 0))}
                    className="w-20 bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-center text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="text-xs text-slate-400">USD</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={handleAutoGenerateUtility}
                title="Populate utility company data matching your actual logged dates."
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
              >
                <RefreshCw className="h-3 w-3" />
                Simulate Utility Meter
              </button>
              <button
                onClick={handleResetData}
                className="px-3 py-1.5 text-xs font-semibold hover:bg-rose-950 hover:text-rose-300 text-slate-400 rounded-lg transition border border-transparent hover:border-rose-900/50 flex items-center gap-1.5"
              >
                <Trash2 className="h-3 w-3" />
                Reset Database
              </button>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 1: DASHBOARD (METRICS & VISUAL ANALYTICS) */}
        {/* ======================================================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* AUDIT CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 p-2 rounded-xl">
                  <Zap className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logged Energy Use</p>
                <h3 className="text-3xl font-extrabold mt-2 text-slate-100 font-mono">
                  {totals.totalLoggedKwh.toFixed(1)} <span className="text-lg font-normal text-slate-400 font-sans">kWh</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">
                  Projected cost: <strong className="text-emerald-400">${(totals.totalLoggedKwh * electricityRate).toFixed(2)}</strong>
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-blue-500/10 text-blue-400 p-2 rounded-xl">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Utility Co. Metered</p>
                <h3 className="text-3xl font-extrabold mt-2 text-slate-100 font-mono">
                  {totals.totalUtilityKwh.toFixed(1)} <span className="text-lg font-normal text-slate-400 font-sans">kWh</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">
                  Meter billing amount: <strong className="text-blue-400">${(totals.totalUtilityKwh * electricityRate).toFixed(2)}</strong>
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-amber-500/10 text-amber-400 p-2 rounded-xl">
                  <Info className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accounted Percent</p>
                <h3 className="text-3xl font-extrabold mt-2 text-slate-100 font-mono">
                  {totals.overallAccountedPercent}%
                </h3>
                <div className="w-full bg-slate-800 rounded-full h-1.5 mt-3 overflow-hidden">
                  <div 
                    className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, totals.overallAccountedPercent)}%` }}
                  ></div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-purple-500/10 text-purple-400 p-2 rounded-xl">
                  <Sliders className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vampire Draw Base</p>
                <h3 className="text-3xl font-extrabold mt-2 text-slate-100 font-mono">
                  {totals.averageBaseLoadPerDay.toFixed(1)} <span className="text-lg font-normal text-slate-400 font-sans">kWh/d</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">
                  Average unlogged phantom standby
                </p>
              </div>
            </div>

            {/* BAR AND SPLINE CHART AND STATS */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Utility vs Logged Appliance Usage</h3>
                    <p className="text-xs text-slate-400">Comparing your daily utility meter with your aggregate appliance logs</p>
                  </div>
                  
                  <div className="flex space-x-4 text-xs font-medium">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span className="text-slate-300">Meter (Total)</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-3 bg-emerald-400 rounded"></div>
                      <span className="text-slate-300">Logged Appliances</span>
                    </div>
                  </div>
                </div>

                {dateWiseComparison.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 rounded-xl p-6 text-center">
                    <Activity className="h-10 w-10 text-slate-600 mb-2" />
                    <p className="text-slate-400 text-sm">No historical log data found to plot.</p>
                  </div>
                ) : (
                  <div>
                    <div className="relative w-full overflow-x-auto">
                      <div className="min-w-[450px]">
                        <svg viewBox="0 0 500 240" className="w-full h-auto">
                          <line x1="40" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3,3" />
                          <line x1="40" y1="80" x2="480" y2="80" stroke="#334155" strokeDasharray="3,3" />
                          <line x1="40" y1="140" x2="480" y2="140" stroke="#334155" strokeDasharray="3,3" />
                          <line x1="40" y1="200" x2="480" y2="200" stroke="#1e293b" />

                          {(() => {
                            const maxVal = Math.max(
                              ...dateWiseComparison.map(d => Math.max(d.utilityKwh, d.loggedKwh)),
                              10
                            ) * 1.1;

                            const chartHeight = 180;
                            const renderDays = [...dateWiseComparison].slice(0, 7).reverse();
                            const barGap = 60;
                            const barWidth = 14;

                            return (
                              <>
                                <text x="10" y="25" fill="#94a3b8" className="text-[10px] font-mono">{(maxVal * 0.9).toFixed(0)}</text>
                                <text x="10" y="85" fill="#94a3b8" className="text-[10px] font-mono">{(maxVal * 0.6).toFixed(0)}</text>
                                <text x="10" y="145" fill="#94a3b8" className="text-[10px] font-mono">{(maxVal * 0.3).toFixed(0)}</text>
                                <text x="10" y="204" fill="#94a3b8" className="text-[10px] font-mono">0</text>

                                {renderDays.map((day, idx) => {
                                  const xPos = 60 + idx * barGap;
                                  const utilityHeight = (day.utilityKwh / maxVal) * chartHeight;
                                  const loggedHeight = (day.loggedKwh / maxVal) * chartHeight;

                                  const utilY = 200 - utilityHeight;
                                  const loggedY = 200 - loggedHeight;

                                  const rawDate = new Date(day.date + 'T00:00:00');
                                  const shortLabel = rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

                                  return (
                                    <g key={day.date} className="group cursor-pointer">
                                      <rect x={xPos} y={utilY} width={barWidth} height={utilityHeight} fill="#3b82f6" rx="3" className="opacity-90 hover:opacity-100 transition-all duration-300" />
                                      <rect x={xPos + 3} y={loggedY} width={barWidth - 6} height={loggedHeight} fill="#34d399" rx="2" className="opacity-95 hover:opacity-100 transition-all duration-300" />
                                      <text x={xPos + barWidth/2} y="220" fill="#94a3b8" textAnchor="middle" className="text-[9px]">{shortLabel}</text>
                                      {day.utilityKwh > 0 && <text x={xPos + barWidth/2} y={utilY - 5} fill="#60a5fa" textAnchor="middle" className="text-[8px] font-mono font-bold">{day.utilityKwh.toFixed(1)}</text>}
                                      {day.loggedKwh > 0 && <text x={xPos + barWidth/2} y={loggedY - 14} fill="#34d399" textAnchor="middle" className="text-[8px] font-mono font-bold">{day.loggedKwh.toFixed(1)}</text>}
                                    </g>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* STATISTICAL INSIGHTS */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
                    <Activity className="text-emerald-400 w-5 h-5" />
                    Audit Insights
                  </h3>
                  
                  <div className="space-y-4">
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400">Accounted Energy Rate</p>
                      <p className="text-sm font-semibold text-slate-200 mt-1">
                        {totals.overallAccountedPercent}% of your electric bill is explained by your active logs.
                      </p>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400">Standby Draw Estimations</p>
                      <p className="text-sm font-semibold text-slate-200 mt-1">
                        Standby is costing you roughly <span className="text-amber-400 font-bold">${(totals.averageBaseLoadPerDay * electricityRate * 30).toFixed(2)} / month</span>.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* DETAILED LEDGER GRID */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800">
                <h3 className="text-lg font-bold text-slate-100">Daily Energy Balance Ledger</h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3 text-right">Logged Appliance Consumption</th>
                      <th className="px-6 py-3 text-right">Utility Co. Metered</th>
                      <th className="px-6 py-3 text-right">Unlogged Background Draw</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {dateWiseComparison.map((row) => (
                      <tr key={row.date} className="hover:bg-slate-900/50 transition">
                        <td className="px-6 py-4 font-mono font-medium text-slate-300">{row.date}</td>
                        <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">{row.loggedKwh.toFixed(2)} kWh</td>
                        <td className="px-6 py-4 text-right font-mono text-blue-400 font-semibold">
                          {row.utilityKwh > 0 ? `${row.utilityKwh.toFixed(2)} kWh` : <span className="text-slate-600 text-xs">— No Data —</span>}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-amber-500">
                          {row.utilityKwh > 0 ? `${(row.utilityKwh - row.loggedKwh).toFixed(2)} kWh` : <span className="text-slate-600 text-xs">— Unknown —</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 2: RUNS LEDGER (TIMER AND MANUAL LOGGING) */}
        {/* ======================================================== */}
        {activeTab === 'logs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            
            <div className="space-y-6 lg:col-span-1">
              {/* TIMERS ZONE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-md font-bold text-slate-100 flex items-center gap-2 mb-2">
                  <Play className="text-emerald-400 w-4 h-4 animate-ping" />
                  Live Appliance Timers
                </h3>
                
                <div className="space-y-3">
                  {appliances.map(app => {
                    const isTimerRunning = !!activeTimers[app.id];
                    return (
                      <div key={app.id} className="p-3 rounded-xl border flex items-center justify-between transition bg-slate-950 border-slate-850">
                        <div>
                          <h4 className="text-xs font-bold text-slate-200">{app.name}</h4>
                          {isTimerRunning && <span className="text-xs font-mono font-bold text-rose-400">Running: {getTimerDurationStr(app.id)}</span>}
                        </div>
                        <button
                          onClick={() => isTimerRunning ? handleStopTimer(app.id) : handleStartTimer(app.id)}
                          className={`px-3 py-1 text-xs font-bold rounded-lg ${isTimerRunning ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-emerald-400 border border-slate-700'}`}
                        >
                          {isTimerRunning ? 'Stop' : 'Start'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MANUAL LOGGER */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-md font-bold text-slate-100 mb-4">Manual Run Logger</h3>
                <form onSubmit={handleManualLog} className="space-y-4">
                  <select
                    value={logApplianceId}
                    onChange={(e) => setLogApplianceId(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200"
                  >
                    <option value="">-- Choose Appliance --</option>
                    {appliances.map(app => <option key={app.id} value={app.id}>{app.name} ({app.wattage}W)</option>)}
                  </select>

                  <div className="grid grid-cols-2 gap-3">
                    <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} required className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs" />
                    <input type="time" value={logStartTime} onChange={(e) => setLogStartTime(e.target.value)} required className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs" />
                  </div>

                  <input type="number" placeholder="Duration (mins)" value={logDuration} onChange={(e) => setLogDuration(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                  <button type="submit" className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-lg">Save Run Log Entry</button>
                </form>
              </div>
            </div>

            {/* HISTORICAL LEDGER */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-6 py-4 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-slate-100">Historical Appliance Logs</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3">Appliance</th>
                        <th className="px-6 py-3 text-right">Duration</th>
                        <th className="px-6 py-3 text-right">KWh</th>
                        <th className="px-6 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-xs">
                      {logs.map((log) => {
                        const app = appliances.find(a => a.id === log.applianceId);
                        return (
                          <tr key={log.id} className="hover:bg-slate-900/50 transition">
                            <td className="px-6 py-3 font-mono">{log.date}</td>
                            <td className="px-6 py-3 font-bold">{app ? app.name : 'Legacy Item'}</td>
                            <td className="px-6 py-3 text-right font-mono">{log.duration} mins</td>
                            <td className="px-6 py-3 text-right font-mono text-emerald-400 font-bold">{log.kwh.toFixed(3)}</td>
                            <td className="px-6 py-3 text-center">
                              <button onClick={() => handleDeleteLog(log.id)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 3: APPLIANCES CONFIGURATION */}
        {/* ======================================================== */}
        {activeTab === 'appliances' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
              <h3 className="text-md font-bold text-slate-100 mb-4">Add Appliance Spec</h3>
              <form onSubmit={handleAddAppliance} className="space-y-4">
                <input type="text" placeholder="Identifier (e.g. Fridge)" value={newAppName} onChange={(e) => setNewAppName(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                <input type="number" placeholder="Wattage (Watts)" value={newAppWattage} onChange={(e) => setNewAppWattage(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm" />
                <select value={newAppCategory} onChange={(e) => setNewAppCategory(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm">
                  <option value="Kitchen">Kitchen</option>
                  <option value="Cooling/Heating">Cooling & Heating</option>
                  <option value="Laundry">Laundry & Water</option>
                  <option value="Electronics">Entertainment/PCs</option>
                  <option value="Utility">General Utility</option>
                </select>
                <button type="submit" className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-lg">Save Appliance</button>
              </form>
            </div>

            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-slate-100 mb-4">Registered Appliances</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appliances.map(app => (
                  <div key={app.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex justify-between items-center">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-mono">{app.category}</span>
                      <h4 className="text-sm font-bold text-slate-100 mt-1">{app.name}</h4>
                      <p className="text-xs text-emerald-400 mt-1 font-mono">{app.wattage} Watts</p>
                    </div>
                    <button onClick={() => handleDeleteAppliance(app.id, app.name)} className="text-slate-600 hover:text-rose-400"><Trash2 className="w-4.5 h-4.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 4: METER UTILITY DATA IMPORT */}
        {/* ======================================================== */}
        {activeTab === 'utility' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
              <h3 className="text-md font-bold text-slate-100 mb-4">Manual Reading Input</h3>
              <form onSubmit={handleAddUtilityEntry} className="space-y-4">
                <input type="date" value={utilDate} onChange={(e) => setUtilDate(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono" />
                <input type="number" step="0.01" placeholder="Total Consumption (kWh)" value={utilKwh} onChange={(e) => setUtilKwh(e.target.value)} required className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono" />
                <button type="submit" className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-lg">Save Meter Reading</button>
              </form>
            </div>

            <div className="lg:col-span-2 space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-md font-bold text-slate-100 mb-2">Bulk CSV Import</h3>
                <form onSubmit={handleCsvImport} className="space-y-4">
                  <textarea rows="4" placeholder="YYYY-MM-DD, kWh (one per line)" value={csvText} onChange={(e) => setCsvText(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300"></textarea>
                  <button type="submit" className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-lg border border-slate-700">Process CSV</button>
                </form>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="overflow-y-auto max-h-64">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="px-6 py-3">Date</th>
                        <th className="px-6 py-3 text-right">Consumption</th>
                        <th className="px-6 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-xs">
                      {utilityData.map((dataRow) => (
                        <tr key={dataRow.date}>
                          <td className="px-6 py-3 font-mono">{dataRow.date}</td>
                          <td className="px-6 py-3 text-right font-mono text-blue-400 font-bold">{dataRow.kwh.toFixed(2)} kWh</td>
                          <td className="px-6 py-3 text-center">
                            <button onClick={() => handleDeleteUtilityEntry(dataRow.date)} className="text-slate-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================================================== */}
        {/* TAB 5: CLOUD SYNC SETTINGS */}
        {/* ======================================================== */}
        {activeTab === 'cloud' && (
          <div className="max-w-md mx-auto bg-slate-900 border border-slate-800 rounded-2xl p-8 animate-fadeIn shadow-2xl">
            <div className="text-center mb-8">
              <div className="mx-auto w-12 h-12 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-2xl flex items-center justify-center mb-3">
                <Cloud className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-100">Multi-Device Cloud Saving</h2>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Unlock cross-device sync. Link your database parameters to save, configure, and inspect appliance cycles on any smartphone or tablet instantly.
              </p>
            </div>

            {!auth ? (
              <div className="p-4 bg-amber-950/20 border border-amber-900/50 rounded-xl space-y-3 text-xs leading-relaxed">
                <div className="flex gap-2 text-amber-400 text-sm font-semibold items-center">
                  <AlertTriangle className="w-5 h-5 shrink-0 animate-pulse" />
                  <span>Cloud Integration Required</span>
                </div>
                <p className="text-slate-300">
                  The dashboard is operating in sandbox mode. To share or persist energy logs globally, append your Firebase setup credentials in your local environmental `.env` file or Vercel dashboard.
                </p>
                <div className="bg-slate-950 p-3 rounded border border-slate-850 font-mono text-slate-400 space-y-2">
                  <p className="font-bold text-slate-300">To setup on Vercel:</p>
                  <p>Add these environment variables to your Vercel project settings:</p>
                  <ul className="list-disc pl-4 space-y-1 mt-1 text-[10px]">
                    <li>`VITE_FIREBASE_API_KEY`</li>
                    <li>`VITE_FIREBASE_AUTH_DOMAIN`</li>
                    <li>`VITE_FIREBASE_PROJECT_ID`</li>
                    <li>`VITE_FIREBASE_APP_ID`</li>
                  </ul>
                </div>
              </div>
            ) : user && !user.isAnonymous ? (
              <div className="space-y-6">
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center space-x-3">
                    <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-400">Connected Profile</p>
                      <p className="text-sm font-bold text-slate-200">{user.email}</p>
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-2 border-t border-slate-900">
                    <span className="text-slate-400">Database Syncing:</span>
                    <span className="flex items-center gap-1 text-emerald-400 font-bold">
                      <CheckCircle className="w-3.5 h-3.5" /> Activated
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleSignOut}
                  className="w-full py-2.5 bg-rose-950/40 hover:bg-rose-950 text-rose-300 text-xs font-bold rounded-lg border border-rose-900/30 transition flex items-center justify-center gap-1.5"
                >
                  <LogOut className="w-3.5 h-3.5" /> Disconnect Profile
                </button>
              </div>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Email Profile Address</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Mail className="w-4 h-4" /></span>
                    <input
                      type="email"
                      placeholder="e.g. you@domain.com"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Secure Password</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500"><Lock className="w-4 h-4" /></span>
                    <input
                      type="password"
                      placeholder="••••••••"
                      value={authPassword}
                      onChange={(e) => setAuthPassword(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm rounded-lg transition duration-200 flex justify-center items-center gap-1.5"
                >
                  {authLoading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : isSignUp ? (
                    'Create Permanent Account'
                  ) : (
                    'Login Profile'
                  )}
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-xs text-blue-400 hover:underline"
                  >
                    {isSignUp ? 'Already configured? Login' : "Don't have a profile yet? Register here"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 mt-20 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="font-bold text-slate-400">PowerLog Premium</span>
            <span>• Built for Vercel Cloud hosting</span>
          </div>
          <div className="flex space-x-6 font-mono text-[10px]">
            <span>App UID: {appId}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}