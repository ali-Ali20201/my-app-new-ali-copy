import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { io } from "socket.io-client";
import { apiFetch } from '../utils/api';

type CurrencyContextType = {
  sypRate: number;
  tryRate: number;
  convert: (amount: number, from: string, to: string) => number;
};

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rates, setRates] = useState({ syp: 1, try: 1 });
  const { user } = useAuth();

  const fetchRates = () => {
    apiFetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch settings');
        return res.json();
      })
      .then((data) => {
        setRates({
          syp: parseFloat(data.syp_rate) || 1,
          try: parseFloat(data.try_rate) || 1,
        });
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchRates();

    const socket = io();
    socket.on('settings_updated', fetchRates);

    return () => {
      socket.disconnect();
    };
  }, []);

  const convert = (amount: number, from: string, to: string) => {
    if (from === to) return amount;
    
    let amountInUsd = amount;
    if (from === "SYP") amountInUsd = amount / rates.syp;
    else if (from === "TRY") amountInUsd = amount / rates.try;
    
    if (to === "SYP") return amountInUsd * rates.syp;
    if (to === "TRY") return amountInUsd * rates.try;
    return amountInUsd;
  };

  return (
    <CurrencyContext.Provider value={{ sypRate: rates.syp, tryRate: rates.try, convert }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within a CurrencyProvider");
  return context;
};
