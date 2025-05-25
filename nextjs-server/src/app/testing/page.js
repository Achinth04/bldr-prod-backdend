'use client';

import { useState, useEffect } from 'react';

export default function TestingPage() {
  const [onlineID, setOnlineID] = useState('');
  const [password, setPassword] = useState('');
  const [response, setResponse] = useState('');

  const [search, setSearch] = useState('');
  const [classResults, setClassResults] = useState([]);

  // Debounce logic
  useEffect(() => {
    const delay = setTimeout(() => {
      if (search.trim().length === 0) {
        setClassResults([]);
        return;
      }

      fetch('/api/searchclass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: search }),
      })
        .then(res => res.json())
        .then(data => setClassResults(data || []))
        .catch(err => {
          console.error('Search error:', err);
          setClassResults([]);
        });
    }, 300);

    return () => clearTimeout(delay);
  }, [search]);

  const callAPI = async (endpoint) => {
    const res = await fetch(`/api/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ onlineID, password }),
    });

    const data = await res.json();
    setResponse(JSON.stringify(data, null, 2));
  };

  return (
    <div className="p-8 max-w-xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold mb-4">🧪 API Testing Page</h1>

      {/* Signup/Login Section */}
      <div className="space-y-2">
        <input
          className="border p-2 w-full"
          type="text"
          placeholder="Online ID"
          value={onlineID}
          onChange={(e) => setOnlineID(e.target.value)}
        />
        <input
          className="border p-2 w-full"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="space-x-2 mt-2">
          <button
            className="bg-green-600 text-white px-4 py-2 rounded"
            onClick={() => callAPI('signUp')}
          >
            Signup
          </button>
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => callAPI('login')}
          >
            Login
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-semibold">Signup/Login Response:</h2>
        <pre className="bg-gray-100 p-4 rounded text-sm text-black">{response}</pre>
      </div>

      {/* Live Class Search Section */}
      <div className="border-t pt-6 space-y-2">
        <h2 className="text-xl font-semibold">🔎 Live Class Search</h2>
        <input
          className="border p-2 w-full"
          type="text"
          placeholder="Search class title or dept..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {classResults.length > 0 && (
          <ul className="border rounded bg-white shadow mt-2 max-h-64 overflow-y-auto">
            {classResults.map((cls) => (
              <li key={cls.uuid} className="p-2 border-b last:border-0">
                <strong>{cls.dept} {cls.code}</strong> - {cls.title}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
