import { openDB } from 'idb';

const DB_NAME = 'kwh-split-db';
const DB_VERSION = 1;

export const initDB = async () => {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('expenses')) {
        db.createObjectStore('expenses', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('outbox')) {
        db.createObjectStore('outbox', { keyPath: 'id', autoIncrement: true });
      }
    },
  });
};

export const getExpenses = async () => {
  const db = await initDB();
  return db.getAll('expenses');
};

export const saveExpense = async (expense) => {
  const db = await initDB();
  await db.put('expenses', expense);
};

export const deleteExpense = async (id) => {
  const db = await initDB();
  await db.delete('expenses', id);
};

export const addToOutbox = async (action, payload) => {
  const db = await initDB();
  await db.add('outbox', {
    action,
    payload,
    timestamp: Date.now(),
  });
};

export const getOutbox = async () => {
  const db = await initDB();
  return db.getAll('outbox');
};

export const clearOutboxItem = async (id) => {
  const db = await initDB();
  await db.delete('outbox', id);
};
