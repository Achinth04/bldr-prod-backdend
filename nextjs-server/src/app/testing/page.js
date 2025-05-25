'use client';

import { useState } from 'react';

export default function TestingPage() {
  const [onlineID, setOnlineID] = useState('');
  const [password, setPassword] = useState('');
  const [response, setResponse] = useState('');

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
    <div className="p-8 max-w-xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold mb-4">🧪 API Testing Page</h1>

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
      </div>

      <div className="space-x-2 mt-4">
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

      <div className="mt-6">
        <h2 className="font-semibold">Response:</h2>
        <pre className="bg-gray-100 p-4 rounded text-sm text-black">{response}</pre>
      </div>
    </div>
  );
}
