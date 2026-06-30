"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [data, setData] = useState<{ message: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("http://localhost:8080/api/hello")
      .then((res) => res.json())
      .then((json) => {
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching data:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-indigo-950 to-black text-white flex flex-col items-center justify-center font-sans p-6">
      <div className="max-w-2xl w-full bg-white/5 backdrop-blur-xl rounded-3xl p-10 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] transition-all hover:bg-white/10 duration-500 hover:shadow-[0_0px_40px_rgba(99,102,241,0.4)]">
        <h1 className="text-6xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 pb-2">
          Harness
        </h1>
        <p className="text-xl text-indigo-200/80 mb-10 font-light leading-relaxed">
          Full-stack Pipeline <br/>
          <span className="text-white font-medium">Next.js 15</span> ⚡ <span className="text-white font-medium">Spring Boot 17</span>
        </p>

        <div className="bg-black/50 rounded-2xl p-8 border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-indigo-500 to-pink-500 transform origin-top transition-transform duration-500 ease-out"></div>
          
          <h2 className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400 mb-3">
            Response Payload
          </h2>
          
          {loading ? (
            <div className="flex items-center space-x-4 text-gray-400">
              <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="animate-pulse">Connecting to backend...</span>
            </div>
          ) : data ? (
            <div className="text-2xl font-normal text-white flex items-center space-x-4">
              <span className="text-pink-400 text-3xl animate-bounce">✦</span>
              <span className="bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">{data.message}</span>
            </div>
          ) : (
            <div className="text-red-400 flex items-center space-x-3 bg-red-500/10 p-4 rounded-xl">
              <span className="text-xl">⚠️</span>
              <span>Backend connection failed (Check port 8080)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
