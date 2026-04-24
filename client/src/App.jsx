import React, { useState, useEffect } from 'react';
import OfflineBanner from './components/OfflineBanner';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useSyncQueue } from './hooks/useSyncQueue';
import { getExpenses, saveExpense, addToOutbox, deleteExpense } from './db/indexeddb';
import { Plus, ChevronLeft, MoreVertical, Trash2, Edit2, User } from 'lucide-react';

function App() {
  const isOnline = useOnlineStatus();
  useSyncQueue(); // Initializes the sync queue listener

  const [expenses, setExpenses] = useState([]);
  const [activeTab, setActiveTab] = useState('EXPENSES');

  // Add Expense Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('You');

  // Load initially
  useEffect(() => {
    loadExpenses();
  }, []);

  // Poll for changes when online
  useEffect(() => {
    if (isOnline) {
      const interval = setInterval(loadExpenses, 5000);
      return () => clearInterval(interval);
    }
  }, [isOnline]);

  const loadExpenses = async () => {
    if (isOnline) {
      try {
        const res = await fetch('http://localhost:3000/api/expenses');
        if (res.ok) {
          const data = await res.json();
          // Update local DB
          for (const item of data) {
            await saveExpense(item);
          }
        }
      } catch (err) {
        console.error('Failed to fetch from API:', err);
      }
    }
    // Always read from local DB for UI
    const localData = await getExpenses();
    // Sort by timestamp descending
    setExpenses(localData.sort((a, b) => b.timestamp - a.timestamp));
  };

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!description || !amount) return;

    const newExpense = {
      id: crypto.randomUUID(),
      description,
      amount: parseFloat(amount),
      paidBy: paidBy,
      timestamp: Date.now()
    };

    // 1. Save to local UI DB
    await saveExpense(newExpense);

    // 2. Add to outbox for sync
    await addToOutbox('INSERT', newExpense);

    // 3. Update UI instantly
    setExpenses((prev) => [newExpense, ...prev].sort((a, b) => b.timestamp - a.timestamp));

    // 4. Try syncing immediately if online
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        if (reg.sync) {
          reg.sync.register('sync-expenses').catch(err => console.error('Sync registration failed:', err));
        }
      });
    } else {
      // Fallback
      window.dispatchEvent(new Event('online'));
    }

    setDescription('');
    setAmount('');
    setShowAddModal(false);
  };

  const handleDeleteExpense = async (id) => {
    // 1. Delete from local DB
    await deleteExpense(id);

    // 2. Add delete action to outbox
    await addToOutbox('DELETE', { id });

    // 3. Update UI
    setExpenses((prev) => prev.filter(exp => exp.id !== id));

    // 4. Try syncing immediately if online
    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        if (reg.sync) {
          reg.sync.register('sync-expenses').catch(err => console.error('Sync registration failed:', err));
        }
      });
    } else {
      window.dispatchEvent(new Event('online'));
    }
  };

  const groupTotal = expenses.reduce((acc, curr) => acc + curr.amount, 0);

  const formatMonth = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleString('default', { month: 'short' }).toUpperCase();
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.getDate();
  };

  return (
    <div className="app-container">
      <OfflineBanner />

      {/* Header Area */}
      <header className="app-header">
        <div className="top-nav">
          <ChevronLeft size={24} />
          <MoreVertical size={24} />
        </div>

        <div className="group-info">
          <div className="group-image">
            {/* Placeholder for group image */}
          </div>
          <div className="group-details">
            <h2>PADAGAT WHEN</h2>
            <p className="group-total-label">Group Total</p>
            <p className="group-total-amount">₱{groupTotal.toFixed(2)}</p>
          </div>
        </div>

        <button className="add-expense-btn" onClick={() => setShowAddModal(true)}>
          <Plus size={16} /> Add Expense
        </button>

        <div className="tabs">
          <div className={`tab ${activeTab === 'EXPENSES' ? 'active' : ''}`} onClick={() => setActiveTab('EXPENSES')}>EXPENSES</div>
          <div className={`tab ${activeTab === 'BALANCES' ? 'active' : ''}`} onClick={() => setActiveTab('BALANCES')}>BALANCES</div>
          <div className={`tab ${activeTab === 'MEMBERS' ? 'active' : ''}`} onClick={() => setActiveTab('MEMBERS')}>MEMBERS</div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {activeTab === 'EXPENSES' && (
          <div className="expenses-list">
            {expenses.length === 0 ? (
              <div className="empty-state">No expenses yet.</div>
            ) : (
              expenses.map((exp) => (
                <div key={exp.id} className="expense-card">
                  <div className="expense-date">
                    <span className="month">{formatMonth(exp.timestamp)}</span>
                    <span className="day">{formatDate(exp.timestamp)}</span>
                  </div>
                  <div className="expense-details">
                    <h4>{exp.description}</h4>
                    <span className="paid-by">Paid by {exp.paidBy || 'Amine'}</span>
                  </div>
                  <div className="expense-amount-col">
                    <span className="total-label">Total</span>
                    <span className="amount-value">₱{exp.amount.toFixed(2)}</span>
                    <button className="delete-btn" onClick={() => handleDeleteExpense(exp.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'BALANCES' && (
          <div className="balances-list">
            <div className="balance-card">
              <div className="balance-user">
                <div className="user-avatar"><User size={16} /></div>
                <span>Kyle Lee</span>
              </div>
              <div className="balance-amount owes-you">
                <span className="label">owes you</span>
                <span className="value">₱370.00</span>
              </div>
            </div>
            <div className="balance-card">
              <div className="balance-user">
                <div className="user-avatar"><User size={16} /></div>
                <span>Ceferino Jumao-as</span>
              </div>
              <div className="balance-amount owes-you">
                <span className="label">owes you</span>
                <span className="value">₱270.00</span>
                <span className="sub-label">₱100.00 PAID</span>
              </div>
            </div>

            <div className="settle-btn-container">
              <button className="action-btn">Settle payment</button>
            </div>
          </div>
        )}

        {activeTab === 'MEMBERS' && (
          <div className="members-list">
            <div className="member-item">
              <div className="user-avatar"><User size={16} /></div>
              <span className="member-name">Kyle Lee</span>
              <span className="member-tag">SC/PWD</span>
            </div>
            <div className="member-item">
              <div className="user-avatar"><User size={16} /></div>
              <span className="member-name">Ceferino Jumao-as</span>
            </div>
            <div className="member-item">
              <div className="user-avatar"><User size={16} /></div>
              <span className="member-name">James Ty</span>
            </div>
            <div className="member-item">
              <div className="user-avatar"><User size={16} /></div>
              <span className="member-name">Amine Conejos (you)</span>
            </div>

            <div className="add-member-container">
              <button className="action-btn">Add member</button>
            </div>
          </div>
        )}
      </main>

      {/* Add Expense Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Add New Expense</h3>
            <form onSubmit={handleAddExpense}>
              <div className="input-group">
                <label>Description</label>
                <input
                  type="text"
                  placeholder="e.g. Sugbo Wings"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Amount (₱)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div className="input-group">
                <label>Paid By</label>
                <input
                  type="text"
                  placeholder="e.g. Amine"
                  value={paidBy}
                  onChange={(e) => setPaidBy(e.target.value)}
                  required
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowAddModal(false)}>Cancel</button>
                <button type="submit" className="save-btn">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
