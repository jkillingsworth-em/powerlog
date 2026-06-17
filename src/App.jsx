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
  DollarSign
} from 'lucide-react';

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
  
  // Create logs for the last 3 days
  for (let i = 2; i >= 0; i--) {
    const targetDate = new Date(now);
    targetDate.setDate(now.getDate() - i);
    const dateStr = formatDate(targetDate);
    
    // AC ran multiple times
    logs.push({
      id: `log-ac-1-${i}`,
      applianceId: 'app-1',
      date: dateStr,
      startTime: '12:00',
      duration: 120, // 2 hours
      kwh: (3500 * 2) / 1000
    });
    logs.push({
      id: `log-ac-2-${i}`,
      applianceId: 'app-1',
      date: dateStr,
      startTime: '16:30',
      duration: 180, // 3 hours
      kwh: (3500 * 3) / 1000
    });

    // Refrigerator runs basically 35% duty cycle all day
    logs.push({
      id: `log-fridge-${i}`,
      applianceId: 'app-2',
      date: dateStr,
      startTime: '00:00',
      duration: 504, // 8.4 hours aggregate cycle time
      kwh: (180 * 8.4) / 1000
    });

    // Water Heater runs peak times
    logs.push({
      id: `log-wh-1-${i}`,
      applianceId: 'app-3',
      date: dateStr,
      startTime: '07:00',
      duration: 45, // 45 mins
      kwh: (4500 * 0.75) / 1000
    });
    logs.push({
      id: `log-wh-2-${i}`,
      applianceId: 'app-3',
      date: dateStr,
      startTime: '19:00',
      duration: 60, // 1 hour
      kwh: (4500 * 1) / 1000
    });

    // PC Gaming in the evening
    logs.push({
      id: `log-pc-${i}`,
      applianceId: 'app-4',
      date: dateStr,
      startTime: '20:00',
      duration: 150, // 2.5 hours
      kwh: (450 * 2.5) / 1000
    });

    // Microwave usage
    logs.push({
      id: `log-micro-${i}`,
      applianceId: 'app-6',
      date: dateStr,
      startTime: '12:30',
      duration: 10, 
      kwh: (1200 * (10 / 60)) / 1000
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
    
    // Sum logs for this day
    const dayLoggedKwh = logs
      .filter(l => l.date === dateStr)
      .reduce((sum, l) => sum + l.kwh, 0);
    
    // Base load is background phantom draw (roughly 6.0 kWh/day) + random fluctuation
    const baseLoadKwh = 5.8 + (Math.random() * 1.5);
    const totalUtilityKwh = parseFloat((dayLoggedKwh + baseLoadKwh).toFixed(2));
    
    data.push({
      date: dateStr,
      kwh: totalUtilityKwh,
      source: 'Imported (Utility Co)'
    });
  }
  return data;
};

export default function App() {
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

  // Navigation tab state
  const [activeTab, setActiveTab] = useState('dashboard');

  // UI Interactive States
  const [activeTimers, setActiveTimers] = useState({});
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Form states - New Appliance
  const [newAppName, setNewAppName] = useState('');
  const [newAppWattage, setNewAppWattage] = useState('');
  const [newAppCategory, setNewAppCategory] = useState('Kitchen');

  // Form states - Manual Log
  const [logApplianceId, setLogApplianceId] = useState('');
  const [logDate, setLogDate] = useState(formatDate(new Date()));
  const [logStartTime, setLogStartTime] = useState('12:00');
  const [logDuration, setLogDuration] = useState('');

  // Form states - Utility Entry
  const [utilDate, setUtilDate] = useState(formatDate(new Date()));
  const [utilKwh, setUtilKwh] = useState('');
  const [csvText, setCsvText] = useState('');

  // Form states - Settings / Rates
  const [electricityRate, setElectricityRate] = useState(0.15); // $0.15 per kWh default

  // Notifications
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    localStorage.setItem('energy_tracker_appliances', JSON.stringify(appliances));
  }, [appliances]);

  useEffect(() => {
    localStorage.setItem('energy_tracker_logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('energy_tracker_utility', JSON.stringify(utilityData));
  }, [utilityData]);

  // Live timer tick
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const triggerNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  const handleAddAppliance = (e) => {
    e.preventDefault();
    if (!newAppName.trim() || !newAppWattage) {
      triggerNotification('Please complete all appliance fields.', 'error');
      return;
    }
    const wattageVal = parseFloat(newAppWattage);
    if (isNaN(wattageVal) || wattageVal <= 0) {
      triggerNotification('Wattage must be a positive number.', 'error');
      return;
    }

    const newApp = {
      id: `app-${Date.now()}`,
      name: newAppName,
      wattage: wattageVal,
      category: newAppCategory
    };

    setAppliances([...appliances, newApp]);
    setNewAppName('');
    setNewAppWattage('');
    triggerNotification(`Added ${newApp.name} successfully!`);
  };

  const handleDeleteAppliance = (id, name) => {
    if (confirm(`Are you sure you want to delete "${name}"? This won't delete historical logs.`)) {
      setAppliances(appliances.filter(app => app.id !== id));
      triggerNotification(`Removed appliance "${name}".`);
    }
  };

  const handleStartTimer = (applianceId) => {
    setActiveTimers(prev => ({
      ...prev,
      [applianceId]: Date.now()
    }));
    triggerNotification(`Timer started for ${appliances.find(a => a.id === applianceId)?.name}`);
  };

  const handleStopTimer = (applianceId) => {
    const startTime = activeTimers[applianceId];
    if (!startTime) return;

    const stopTime = Date.now();
    const durationMs = stopTime - startTime;
    const durationMins = Math.max(1, Math.round(durationMs / 60000));
    
    const app = appliances.find(a => a.id === applianceId);
    if (!app) return;

    const calculatedKwh = parseFloat(((app.wattage * (durationMins / 60)) / 1000).toFixed(4));
    const nowObj = new Date();

    const newLog = {
      id: `log-${Date.now()}`,
      applianceId: applianceId,
      date: formatDate(nowObj),
      startTime: formatTimeStr(new Date(startTime)),
      duration: durationMins,
      kwh: calculatedKwh
    };

    setLogs([newLog, ...logs]);
    
    const updatedTimers = { ...activeTimers };
    delete updatedTimers[applianceId];
    setActiveTimers(updatedTimers);

    triggerNotification(`Logged ${durationMins}m (${calculatedKwh} kWh) for ${app.name}!`);
  };

  const handleManualLog = (e) => {
    e.preventDefault();
    if (!logApplianceId || !logDate || !logStartTime || !logDuration) {
      triggerNotification('Please fill in all run log details.', 'error');
      return;
    }

    const durationMins = parseInt(logDuration);
    if (isNaN(durationMins) || durationMins <= 0) {
      triggerNotification('Duration must be greater than zero.', 'error');
      return;
    }

    const app = appliances.find(a => a.id === logApplianceId);
    if (!app) return;

    const calculatedKwh = parseFloat(((app.wattage * (durationMins / 60)) / 1000).toFixed(4));

    const newLog = {
      id: `log-${Date.now()}`,
      applianceId: logApplianceId,
      date: logDate,
      startTime: logStartTime,
      duration: durationMins,
      kwh: calculatedKwh
    };

    setLogs([newLog, ...logs]);
    setLogDuration('');
    triggerNotification(`Manually logged ${app.name} running for ${durationMins} mins.`);
  };

  const handleDeleteLog = (id) => {
    setLogs(logs.filter(l => l.id !== id));
    triggerNotification('Log entry deleted.');
  };

  const handleAddUtilityEntry = (e) => {
    e.preventDefault();
    if (!utilDate || !utilKwh) {
      triggerNotification('Please provide both date and usage in kWh.', 'error');
      return;
    }

    const kwhVal = parseFloat(utilKwh);
    if (isNaN(kwhVal) || kwhVal < 0) {
      triggerNotification('Usage value must be a valid number.', 'error');
      return;
    }

    const cleaned = utilityData.filter(d => d.date !== utilDate);
    
    const newEntry = {
      date: utilDate,
      kwh: kwhVal,
      source: 'Manual'
    };

    setUtilityData([...cleaned, newEntry].sort((a,b) => b.date.localeCompare(a.date)));
    setUtilKwh('');
    triggerNotification(`Logged Utility usage of ${kwhVal} kWh for ${utilDate}`);
  };

  const handleDeleteUtilityEntry = (date) => {
    setUtilityData(utilityData.filter(d => d.date !== date));
    triggerNotification(`Removed utility reading for ${date}`);
  };

  const handleCsvImport = (e) => {
    e.preventDefault();
    if (!csvText.trim()) {
      triggerNotification('Please paste CSV text.', 'error');
      return;
    }

    const lines = csvText.split('\n');
    let successCount = 0;
    const importedEntries = [];

    lines.forEach(line => {
      const cols = line.split(/[,\t]/);
      if (cols.length >= 2) {
        const rawDate = cols[0].trim();
        const rawKwh = cols[1].trim();

        const dateMatch = rawDate.match(/^\d{4}-\d{2}-\d{2}$/);
        const kwhNum = parseFloat(rawKwh);

        if (dateMatch && !isNaN(kwhNum)) {
          importedEntries.push({
            date: rawDate,
            kwh: kwhNum,
            source: 'CSV Upload'
          });
          successCount++;
        }
      }
    });

    if (successCount === 0) {
      triggerNotification('Could not parse any valid rows. Format should be: YYYY-MM-DD, kWh', 'error');
      return;
    }

    const finalData = [...utilityData];
    importedEntries.forEach(entry => {
      const idx = finalData.findIndex(d => d.date === entry.date);
      if (idx !== -1) {
        finalData[idx] = entry;
      } else {
        finalData.push(entry);
      }
    });

    setUtilityData(finalData.sort((a, b) => b.date.localeCompare(a.date)));
    setCsvText('');
    triggerNotification(`Successfully imported ${successCount} daily readings!`);
  };

  const handleAutoGenerateUtility = () => {
    const loggedDates = [...new Set(logs.map(l => l.date))];
    if (loggedDates.length === 0) {
      triggerNotification('No logged runs found! Log some appliance usage first to match against.', 'error');
      return;
    }

    const generated = loggedDates.map(dateStr => {
      const dayLoggedKwh = logs
        .filter(l => l.date === dateStr)
        .reduce((sum, l) => sum + l.kwh, 0);
      
      const baseLoadKwh = 5.5 + (Math.random() * 2.0); 
      return {
        date: dateStr,
        kwh: parseFloat((dayLoggedKwh + baseLoadKwh).toFixed(2)),
        source: 'Auto-Simulated'
      };
    });

    const finalData = [...utilityData];
    generated.forEach(g => {
      const idx = finalData.findIndex(d => d.date === g.date);
      if (idx !== -1) {
        finalData[idx] = g;
      } else {
        finalData.push(g);
      }
    });

    setUtilityData(finalData.sort((a,b) => b.date.localeCompare(a.date)));
    triggerNotification(`Simulated utility company data matching your actual logged dates.`);
  };

  const handleResetData = () => {
    if (confirm('Are you sure you want to reset ALL data? This will clear logs, appliances, and utility inputs.')) {
      setAppliances(DEFAULT_APPLIANCES);
      const freshLogs = generateMockLogs(DEFAULT_APPLIANCES);
      setLogs(freshLogs);
      setUtilityData(generateMockUtilityData(freshLogs, 3));
      setActiveTimers({});
      triggerNotification('All data reset to default demonstration state.');
    }
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
      const appName = app ? app.name : 'Unknown';
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
    const startTime = activeTimers[applianceId];
    if (!startTime) return '0:00';
    const elapsedSecs = Math.floor((currentTime - startTime) / 1000);
    const mins = Math.floor(elapsedSecs / 60);
    const secs = elapsedSecs % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased">
      {/* HEADER NAVBAR */}
      <header className="border-b border-slate-800 bg-slate-900/80 sticky top-0 z-50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/30">
              <Zap className="h-6 w-6 text-emerald-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-lg font-bold bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">
                PowerLog
              </h1>
              <p className="text-xs text-slate-400 hidden sm:block">Appliance Energy Audit & Utility Comparison</p>
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
              <span>Logs</span>
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
              <span>Utility Data</span>
            </button>
          </div>
        </div>
      </header>

      {/* FLOATING ACTION NOTIFICATIONS */}
      {}
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
        
        {/* BANNER / CONFIG STATS */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div className="flex items-center space-x-3">
            <TrendingUp className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-xs text-slate-400">Current Cost Projection Baseline</p>
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
              title="Populate missing utility company readings with logged usage + standby estimates"
              className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition flex items-center gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Simulate Matching Utility readings
            </button>
            <button
              onClick={handleResetData}
              className="px-3 py-1.5 text-xs font-semibold hover:bg-rose-950 hover:text-rose-300 text-slate-400 rounded-lg transition border border-transparent hover:border-rose-900/50 flex items-center gap-1.5"
            >
              <Trash2 className="h-3 w-3" />
              Reset Demo Data
            </button>
          </div>
        </div>

        {/* ======================================================== */}
        {/* VIEW 1: DASHBOARD (ANALYTICS & COMPARISON) */}
        {/* ======================================================== */}
        {}
        {activeTab === 'dashboard' && (
          <div className="space-y-8 animate-fadeIn">
            
            {/* STATS OVERVIEW */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-emerald-500/10 text-emerald-400 p-2 rounded-xl">
                  <Zap className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logged Energy Use</p>
                <h3 className="text-3xl font-extrabold mt-2 text-slate-100">
                  {totals.totalLoggedKwh.toFixed(1)} <span className="text-lg font-normal text-slate-400">kWh</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">
                  Estimated cost: <strong className="text-emerald-400">${(totals.totalLoggedKwh * electricityRate).toFixed(2)}</strong>
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-blue-500/10 text-blue-400 p-2 rounded-xl">
                  <Activity className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Electric Co. Metered</p>
                <h3 className="text-3xl font-extrabold mt-2 text-slate-100">
                  {totals.totalUtilityKwh.toFixed(1)} <span className="text-lg font-normal text-slate-400">kWh</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">
                  Actual utility billing: <strong className="text-blue-400">${(totals.totalUtilityKwh * electricityRate).toFixed(2)}</strong>
                </p>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-amber-500/10 text-amber-400 p-2 rounded-xl">
                  <Info className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Accounted Percent</p>
                <h3 className="text-3xl font-extrabold mt-2 text-slate-100">
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
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Unlogged Background Load</p>
                <h3 className="text-3xl font-extrabold mt-2 text-slate-100">
                  {totals.averageBaseLoadPerDay.toFixed(1)} <span className="text-lg font-normal text-slate-400">kWh/day</span>
                </h3>
                <p className="text-xs text-slate-400 mt-2">
                  Average base standby & phantom draw
                </p>
              </div>
            </div>

            {/* MAIN COMPARISON CHART & INSIGHTS */}
            {}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* ADVANCED SVG CHART */}
              <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-100">Utility vs Logged Appliance Usage</h3>
                    <p className="text-xs text-slate-400">Comparing your daily utility meter with your aggregate appliance logs</p>
                  </div>
                  
                  {/* Legend */}
                  <div className="flex space-x-4 text-xs font-medium">
                    <div className="flex items-center space-x-1.5">
                      <div className="w-3 h-3 bg-blue-500 rounded"></div>
                      <span className="text-slate-300">Utility Co. (Total)</span>
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
                    <p className="text-slate-500 text-xs mt-1">Start running active logs or upload utility bills to review progress.</p>
                  </div>
                ) : (
                  <div>
                    {/* SVG Chart Container */}
                    <div className="relative w-full overflow-x-auto">
                      <div className="min-w-[450px]">
                        <svg viewBox="0 0 500 240" className="w-full h-auto">
                          {/* Y-Axis lines */}
                          <line x1="40" y1="20" x2="480" y2="20" stroke="#334155" strokeDasharray="3,3" />
                          <line x1="40" y1="80" x2="480" y2="80" stroke="#334155" strokeDasharray="3,3" />
                          <line x1="40" y1="140" x2="480" y2="140" stroke="#334155" strokeDasharray="3,3" />
                          <line x1="40" y1="200" x2="480" y2="200" stroke="#1e293b" />

                          {/* Calculate bounds */}
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
                                {/* Render Y axis scale values */}
                                <text x="10" y="25" fill="#94a3b8" className="text-[10px] font-mono">{(maxVal * 0.9).toFixed(0)}</text>
                                <text x="10" y="85" fill="#94a3b8" className="text-[10px] font-mono">{(maxVal * 0.6).toFixed(0)}</text>
                                <text x="10" y="145" fill="#94a3b8" className="text-[10px] font-mono">{(maxVal * 0.3).toFixed(0)}</text>
                                <text x="10" y="204" fill="#94a3b8" className="text-[10px] font-mono">0</text>

                                {/* Render Chart Bars */}
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
                                      {/* Utility bar background */}
                                      <rect 
                                        x={xPos} 
                                        y={utilY} 
                                        width={barWidth} 
                                        height={utilityHeight} 
                                        fill="#3b82f6" 
                                        rx="3"
                                        className="opacity-90 hover:opacity-100 transition-all duration-300"
                                      />
                                      {/* Logged bar overlay */}
                                      <rect 
                                        x={xPos + 3} 
                                        y={loggedY} 
                                        width={barWidth - 6} 
                                        height={loggedHeight} 
                                        fill="#34d399" 
                                        rx="2"
                                        className="opacity-95 hover:opacity-100 transition-all duration-300"
                                      />

                                      {/* Date Label */}
                                      <text 
                                        x={xPos + barWidth/2} 
                                        y="220" 
                                        fill="#94a3b8" 
                                        textAnchor="middle" 
                                        className="text-[9px]"
                                      >
                                        {shortLabel}
                                      </text>

                                      {/* Value labels on top of bars */}
                                      {day.utilityKwh > 0 && (
                                        <text 
                                          x={xPos + barWidth/2} 
                                          y={utilY - 5} 
                                          fill="#60a5fa" 
                                          textAnchor="middle" 
                                          className="text-[8px] font-mono font-bold"
                                        >
                                          {day.utilityKwh.toFixed(1)}
                                        </text>
                                      )}
                                      
                                      {day.loggedKwh > 0 && (
                                        <text 
                                          x={xPos + barWidth/2} 
                                          y={loggedY - 14} 
                                          fill="#34d399" 
                                          textAnchor="middle" 
                                          className="text-[8px] font-mono font-bold"
                                        >
                                          {day.loggedKwh.toFixed(1)}
                                        </text>
                                      )}
                                    </g>
                                  );
                                })}
                              </>
                            );
                          })()}
                        </svg>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between text-xs text-slate-500 bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="flex items-center gap-1.5 text-amber-400">
                        <Info className="w-3.5 h-3.5" />
                        <span><strong>The GAP</strong> between blue and green represents standby house load (phantom power).</span>
                      </div>
                      <span className="hidden sm:inline">Showing last 7 entries</span>
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
                      <p className="text-[11px] text-slate-500 mt-1">
                        {totals.overallAccountedPercent < 50 
                          ? 'A low rate suggests you have unlogged high-wattage devices or high phantom idle draw.' 
                          : 'Excellent! Your logs represent the vast majority of your energy footprint.'}
                      </p>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                      <p className="text-xs text-slate-400">Phantom Power / Base Load Cost</p>
                      <p className="text-sm font-semibold text-slate-200 mt-1">
                        Standby is costing you roughly <span className="text-amber-400 font-bold">${(totals.averageBaseLoadPerDay * electricityRate * 30).toFixed(2)} / month</span>.
                      </p>
                      <p className="text-[11px] text-slate-500 mt-1">
                        This is calculated based on the unaccounted base rate averaging {totals.averageBaseLoadPerDay} kWh/day.
                      </p>
                    </div>

                    {applianceEnergyShare.length > 0 && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                          <span>Primary Power Consumer</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-200 mt-1">
                          {applianceEnergyShare[0].name} ({applianceEnergyShare[0].category})
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          Consumes <strong className="text-rose-400">{applianceEnergyShare[0].kwh} kWh</strong> (${applianceEnergyShare[0].cost.toFixed(2)} logged so far).
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800">
                  <button 
                    onClick={() => setActiveTab('logs')}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition duration-200 flex items-center justify-center gap-1"
                  >
                    <Plus className="w-4 h-4" /> Start Logging Active Run
                  </button>
                </div>
              </div>

            </div>

            {/* APPLIANCE PIE/BAR CONSUMPTION LIST */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-slate-100 mb-2">Aggregated Appliance Run-Costs</h3>
              <p className="text-xs text-slate-400 mb-6">Calculated total consumption based on individual run times multiplied by appliance wattage ratings</p>

              {applianceEnergyShare.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No active logs recorded yet to analyze specific appliance shares.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {applianceEnergyShare.map((share, index) => {
                    const totalKwhLogged = totals.totalLoggedKwh || 1;
                    const percentOfTotalLogged = Math.round((share.kwh / totalKwhLogged) * 100);

                    return (
                      <div key={share.name} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
                        <div>
                          <div className="flex justify-between items-start">
                            <div>
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                                {share.category}
                              </span>
                              <h4 className="text-sm font-bold text-slate-200 mt-2">{share.name}</h4>
                            </div>
                            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-1 rounded">
                              {percentOfTotalLogged}% of logs
                            </span>
                          </div>

                          <div className="mt-4 flex items-baseline justify-between text-xs">
                            <span className="text-slate-400">Total Consumption:</span>
                            <span className="font-mono text-sm font-bold text-slate-200">{share.kwh} kWh</span>
                          </div>

                          <div className="mt-1 flex items-baseline justify-between text-xs">
                            <span className="text-slate-400">Estimated Cost:</span>
                            <span className="font-mono text-sm font-bold text-emerald-400">${share.cost.toFixed(2)}</span>
                          </div>
                        </div>

                        <div className="w-full bg-slate-900 h-1 rounded-full mt-4 overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-1 rounded-full" 
                            style={{ width: `${percentOfTotalLogged}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* DETAILED LEDGER GRID */}
            {}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Daily Energy Balance Ledger</h3>
                  <p className="text-xs text-slate-400">Comprehensive reconciliation of real electric logs vs company usage</p>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3 text-right">Logged Appliance Consumption</th>
                      <th className="px-6 py-3 text-right">Utility Co. Metered</th>
                      <th className="px-6 py-3 text-right">Unlogged Background Draw</th>
                      <th className="px-6 py-3 text-center">Audit Accountability</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-850 text-sm">
                    {dateWiseComparison.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                          Please record usage logs and input utility readings.
                        </td>
                      </tr>
                    ) : (
                      dateWiseComparison.map((row) => (
                        <tr key={row.date} className="hover:bg-slate-900/50 transition">
                          <td className="px-6 py-4 font-mono font-medium text-slate-300">
                            {row.date}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-emerald-400 font-semibold">
                            {row.loggedKwh.toFixed(2)} kWh
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-blue-400 font-semibold">
                            {row.utilityKwh > 0 ? `${row.utilityKwh.toFixed(2)} kWh` : <span className="text-slate-600 text-xs">— No Data —</span>}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-amber-500">
                            {row.utilityKwh > 0 
                              ? `${(row.utilityKwh - row.loggedKwh).toFixed(2)} kWh` 
                              : <span className="text-slate-600 text-xs">— Unknown —</span>
                            }
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col items-center justify-center">
                              {row.utilityKwh > 0 ? (
                                <>
                                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                    row.loggedPercent > 80 
                                      ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/40' 
                                      : row.loggedPercent > 40 
                                      ? 'bg-amber-950/80 text-amber-400 border border-amber-800/40' 
                                      : 'bg-rose-950/80 text-rose-400 border border-rose-800/40'
                                  }`}>
                                    {row.loggedPercent}% Logged
                                  </span>
                                  <span className="text-[10px] text-slate-500 mt-1 font-mono">
                                    Base load: {Math.max(0, 100 - row.loggedPercent)}%
                                  </span>
                                </>
                              ) : (
                                <button 
                                  onClick={() => {
                                    setActiveTab('utility');
                                    setUtilDate(row.date);
                                  }}
                                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                                >
                                  <Plus className="w-3 h-3" /> Input Utility Data
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 2: LOGGING AND RUNS LEDGER */}
        {/* ======================================================== */}
        {}
        {activeTab === 'logs' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            
            {/* LEFT: TIMER & NEW LOG INPUT */}
            <div className="space-y-6 lg:col-span-1">
              
              {/* TIMERS ZONE */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-md font-bold text-slate-100 flex items-center gap-2 mb-2">
                  <Play className="text-emerald-400 w-4 h-4 animate-ping" />
                  Live Appliance Timers
                </h3>
                <p className="text-xs text-slate-400 mb-4">Click "Start Run" when turning on a physical device. We calculate active real-time kilowatt-hours automatically.</p>

                {appliances.length === 0 ? (
                  <p className="text-xs text-slate-500">Please add appliance configurations to enable timers.</p>
                ) : (
                  <div className="space-y-3">
                    {appliances.map(app => {
                      const isTimerRunning = !!activeTimers[app.id];
                      return (
                        <div 
                          key={app.id} 
                          className={`p-3 rounded-xl border flex items-center justify-between transition ${
                            isTimerRunning 
                              ? 'bg-slate-950 border-emerald-500/50' 
                              : 'bg-slate-950/40 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center space-x-2">
                              <h4 className="text-xs font-bold text-slate-200">{app.name}</h4>
                              <span className="text-[10px] text-slate-400 font-mono">({app.wattage}W)</span>
                            </div>
                            
                            {isTimerRunning && (
                              <div className="flex items-center space-x-2 mt-1">
                                <span className="inline-block w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
                                <span className="text-xs font-mono font-bold text-slate-300">
                                  Running: {getTimerDurationStr(app.id)}
                                </span>
                              </div>
                            )}
                          </div>

                          <div>
                            {isTimerRunning ? (
                              <button
                                onClick={() => handleStopTimer(app.id)}
                                className="px-3 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-500 text-slate-100 rounded-lg flex items-center gap-1 transition"
                              >
                                <Square className="w-3.5 h-3.5 fill-current" /> Stop & Log
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartTimer(app.id)}
                                className="px-3 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-700 text-emerald-400 rounded-lg flex items-center gap-1 border border-slate-700 transition"
                              >
                                <Play className="w-3.5 h-3.5" /> Start Run
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* MANUAL LOGGER FORM */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-md font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <Calendar className="text-emerald-400 w-4 h-4" />
                  Manual Run Logger
                </h3>

                <form onSubmit={handleManualLog} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Appliance Selection</label>
                    <select
                      value={logApplianceId}
                      onChange={(e) => setLogApplianceId(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Choose Appliance --</option>
                      {appliances.map(app => (
                        <option key={app.id} value={app.id}>{app.name} ({app.wattage}W)</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Date Played/Run</label>
                      <input 
                        type="date"
                        value={logDate}
                        onChange={(e) => setLogDate(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Start Time</label>
                      <input 
                        type="time"
                        value={logStartTime}
                        onChange={(e) => setLogStartTime(e.target.value)}
                        required
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Duration (minutes)</label>
                    <input 
                      type="number"
                      placeholder="e.g. 45"
                      min="1"
                      value={logDuration}
                      onChange={(e) => setLogDuration(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-lg transition duration-200"
                  >
                    Save Run Log Entry
                  </button>
                </form>
              </div>

            </div>

            {/* RIGHT: RUNS HISTORY TABLE LEDGER */}
            {}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-6 py-4 border-b border-slate-800">
                  <h3 className="text-lg font-bold text-slate-100">Historical Appliance Logs</h3>
                  <p className="text-xs text-slate-400">All registered appliance runs and estimated power outputs</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="px-6 py-3">Date / Start</th>
                        <th className="px-6 py-3">Appliance</th>
                        <th className="px-6 py-3 text-right">Run Duration</th>
                        <th className="px-6 py-3 text-right">Calculated kWh</th>
                        <th className="px-6 py-3 text-right">Est. Cost</th>
                        <th className="px-6 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-xs">
                      {logs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="px-6 py-8 text-center text-slate-500">
                            No logs registered yet. Turn on live timers or log a manual run.
                          </td>
                        </tr>
                      ) : (
                        logs.map((log) => {
                          const app = appliances.find(a => a.id === log.applianceId);
                          const appCost = log.kwh * electricityRate;

                          return (
                            <tr key={log.id} className="hover:bg-slate-900/50 transition">
                              <td className="px-6 py-3">
                                <div className="font-mono text-slate-200">{log.date}</div>
                                <div className="text-[10px] text-slate-500 font-mono">{log.startTime}</div>
                              </td>
                              <td className="px-6 py-3">
                                <div className="font-bold text-slate-200">{app ? app.name : 'Deleted Appliance'}</div>
                                <div className="text-[10px] text-slate-500">{app ? app.category : 'Other'} • {app ? app.wattage : 0}W</div>
                              </td>
                              <td className="px-6 py-3 text-right font-mono font-medium text-slate-300">
                                {log.duration} mins
                              </td>
                              <td className="px-6 py-3 text-right font-mono font-bold text-emerald-400">
                                {log.kwh.toFixed(3)}
                              </td>
                              <td className="px-6 py-3 text-right font-mono text-emerald-400/80">
                                ${appCost.toFixed(2)}
                              </td>
                              <td className="px-6 py-3 text-center">
                                <button
                                  onClick={() => handleDeleteLog(log.id)}
                                  className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                                  title="Delete Log Entry"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Stats Footer on Ledger Table */}
              <div className="bg-slate-950 p-4 border-t border-slate-800 flex flex-wrap justify-between items-center text-xs gap-4">
                <div className="text-slate-400">
                  Total Logged Energy Footprint: <strong className="text-slate-100">{totals.totalLoggedKwh.toFixed(3)} kWh</strong>
                </div>
                <div className="text-slate-400">
                  Total Projected Cost: <strong className="text-emerald-400">${(totals.totalLoggedKwh * electricityRate).toFixed(2)}</strong>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 3: APPLIANCES CONFIGURATION */}
        {/* ======================================================== */}
        {}
        {activeTab === 'appliances' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            
            {/* ADD NEW APPLIANCE */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 h-fit">
              <h3 className="text-md font-bold text-slate-100 mb-4 flex items-center gap-2">
                <Sliders className="text-emerald-400 w-4 h-4" />
                Add Appliance Spec
              </h3>

              <form onSubmit={handleAddAppliance} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Appliance Identifier</label>
                  <input
                    type="text"
                    placeholder="e.g. Living Room AC, Living Room TV"
                    value={newAppName}
                    onChange={(e) => setNewAppName(e.target.value)}
                    required
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Wattage Rating (Watts)</label>
                    <input
                      type="number"
                      placeholder="e.g. 1500"
                      min="1"
                      value={newAppWattage}
                      onChange={(e) => setNewAppWattage(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Category</label>
                    <select
                      value={newAppCategory}
                      onChange={(e) => setNewAppCategory(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="Kitchen">Kitchen</option>
                      <option value="Cooling/Heating">Cooling & Heating</option>
                      <option value="Laundry">Laundry & Water</option>
                      <option value="Electronics">Entertainment/PCs</option>
                      <option value="Lighting">Lighting</option>
                      <option value="Utility">General Utility</option>
                    </select>
                  </div>
                </div>

                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-500">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-400 mb-1">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    <span>Reference Wattages:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-1 mt-1 font-mono">
                    <li>LED Light Bulb: 9–15W</li>
                    <li>Gaming Computer: 300–600W</li>
                    <li>Standard Microwave: 1000–1400W</li>
                    <li>Central AC: 3000–5000W</li>
                    <li>Electric Water Heater: 4000–5500W</li>
                  </ul>
                </div>

                <button
                  type="submit"
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-lg transition duration-200"
                >
                  Save Appliance Config
                </button>
              </form>
            </div>

            {/* LIST ACTIVE APPLIANCES */}
            <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h3 className="text-lg font-bold text-slate-100 mb-2">Registered Appliances</h3>
              <p className="text-xs text-slate-400 mb-6">Manage configurations, modify base wattage, or remove items</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {appliances.map(app => {
                  const runsCount = logs.filter(l => l.applianceId === app.id).length;
                  const aggregateKwh = logs.filter(l => l.applianceId === app.id).reduce((s,l) => s + l.kwh, 0);

                  return (
                    <div key={app.id} className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                              {app.category}
                            </span>
                            <h4 className="text-sm font-bold text-slate-100 mt-2">{app.name}</h4>
                          </div>
                          
                          <button
                            onClick={() => handleDeleteAppliance(app.id, app.name)}
                            className="text-slate-600 hover:text-rose-400 transition p-1"
                            title="Delete Appliance"
                          >
                            <Trash2 className="w-4.5 h-4.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-xs font-mono">
                          <div>
                            <span className="text-slate-500 text-[10px]">WATTAGE</span>
                            <p className="text-slate-200 font-bold">{app.wattage} W</p>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[10px]">HOURLY COST</span>
                            <p className="text-emerald-400 font-bold">
                              ${((app.wattage / 1000) * electricityRate).toFixed(3)}/hr
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-850 flex items-center justify-between text-[11px] text-slate-400">
                        <span>Logged Runs: <strong>{runsCount}</strong></span>
                        <span>Aggregate Logged: <strong>{aggregateKwh.toFixed(1)} kWh</strong></span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* ======================================================== */}
        {/* VIEW 4: ELECTRIC COMPANY / UTILITY DATA IMPORT */}
        {/* ======================================================== */}
        {}
        {activeTab === 'utility' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
            
            {/* MANUAL UTILITY INPUT */}
            <div className="space-y-6 lg:col-span-1">
              
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-md font-bold text-slate-100 mb-4 flex items-center gap-2">
                  <Calendar className="text-emerald-400 w-4 h-4" />
                  Manual Reading Input
                </h3>

                <form onSubmit={handleAddUtilityEntry} className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Usage Billing Date</label>
                    <input 
                      type="date"
                      value={utilDate}
                      onChange={(e) => setUtilDate(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Total Meter Consumption (kWh)</label>
                    <input 
                      type="number"
                      step="0.01"
                      placeholder="e.g. 15.4"
                      value={utilKwh}
                      onChange={(e) => setUtilKwh(e.target.value)}
                      required
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Found on your utility company dashboard.</p>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold rounded-lg transition duration-200"
                  >
                    Save Meter Reading
                  </button>
                </form>
              </div>

              {/* EXPLANATORY INFORMATION CARD */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-slate-400 text-xs space-y-3">
                <h4 className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                  Why compare with utility data?
                </h4>
                <p>
                  Most power utilities provide a downloadable CSV of your household's hourly or daily energy usage (usually in <strong>kWh</strong>).
                </p>
                <p>
                  By importing those numbers here and comparing them to your custom appliance run logs, you can:
                </p>
                <ul className="list-disc pl-4 space-y-1 font-medium text-slate-300">
                  <li>Detect standby "vampire" draw.</li>
                  <li>Discover which appliances you missed logging.</li>
                  <li>Assess accuracy of theoretical appliance ratings.</li>
                </ul>
              </div>

            </div>

            {/* BULK CSV IMPORT / PASTE */}
            <div className="lg:col-span-2 space-y-6">
              
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-md font-bold text-slate-100 mb-1 flex items-center gap-2">
                  <Upload className="text-emerald-400 w-4 h-4" />
                  Bulk CSV Import
                </h3>
                <p className="text-xs text-slate-400 mb-4">
                  Paste rows directly from a spreadsheet or downloaded utility file. Format: <code>YYYY-MM-DD, kWh</code> (one pair per line).
                </p>

                <form onSubmit={handleCsvImport} className="space-y-4">
                  <textarea
                    rows="6"
                    placeholder="2026-06-12, 14.5&#10;2026-06-11, 16.2&#10;2026-06-10, 15.8"
                    value={csvText}
                    onChange={(e) => setCsvText(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-emerald-500"
                  ></textarea>

                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-500">Separators can be commas or tabs. Duplicates overwrite existing dates.</span>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 font-bold text-xs rounded-lg transition border border-slate-700"
                    >
                      Process CSV Text
                    </button>
                  </div>
                </form>
              </div>

              {/* LIST OF CURRENT UTILITY ENTRIES */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-800">
                  <h3 className="text-md font-bold text-slate-100">Saved Utility Company Readings</h3>
                </div>

                <div className="overflow-y-auto max-h-96">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800">
                        <th className="px-6 py-3">Reading Date</th>
                        <th className="px-6 py-3 text-right">Consumption (kWh)</th>
                        <th className="px-6 py-3">Source/Origin</th>
                        <th className="px-6 py-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-850 text-xs">
                      {utilityData.length === 0 ? (
                        <tr>
                          <td colSpan="4" className="px-6 py-8 text-center text-slate-500">
                            No utility records saved yet. Provide manual inputs above or use the simulated generation generator.
                          </td>
                        </tr>
                      ) : (
                        utilityData.map((dataRow) => (
                          <tr key={dataRow.date} className="hover:bg-slate-900/50 transition">
                            <td className="px-6 py-3 font-mono font-bold text-slate-200">
                              {dataRow.date}
                            </td>
                            <td className="px-6 py-3 text-right font-mono text-blue-400 font-extrabold text-sm">
                              {dataRow.kwh.toFixed(2)} kWh
                            </td>
                            <td className="px-6 py-3">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-850 border border-slate-850 text-slate-400">
                                {dataRow.source || 'Manual Input'}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-center">
                              <button
                                onClick={() => handleDeleteUtilityEntry(dataRow.date)}
                                className="text-slate-500 hover:text-rose-400 p-1 rounded transition"
                                title="Remove Entry"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

          </div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="border-t border-slate-900 bg-slate-950 py-12 mt-20 text-slate-500 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <Zap className="h-4 w-4 text-emerald-400" />
            <span className="font-bold text-slate-400">PowerLog Premium</span>
            <span>• Appliance Run-Logging Audits</span>
          </div>
          <div className="flex space-x-6">
            <span>In-Memory Storage Sandbox (Saved in Browser Session)</span>
          </div>
        </div>
      </footer>
    </div>
  );
}