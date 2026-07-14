
/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface CacheContextType {
    fetchWithCache: <T>(
        key: string, 
        fetcher: () => Promise<T>, 
        ttl?: number, 
        forceRefresh?: boolean
    ) => Promise<T>;
    invalidateCache: (keyPrefix?: string) => void;
}

const CacheContext = createContext<CacheContextType | undefined>(undefined);

export const CacheProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const cacheRef = useRef<Record<string, CacheEntry<any>>>({});
    // We use a dummy state to trigger re-renders if needed, 
    // though for simple data fetching returning Promises, ref is often sufficient 
    // and prevents excessive re-renders of the Provider.
    
    // However, to ensure components using the data update if the cache updates in background:
    const [, setTick] = useState(0);

    const fetchWithCache = useCallback(async <T,>(
        key: string, 
        fetcher: () => Promise<T>, 
        ttl: number = 60000, // Default 1 minute
        forceRefresh: boolean = false
    ): Promise<T> => {
        const now = Date.now();
        const cached = cacheRef.current[key];

        if (!forceRefresh && cached && (now - cached.timestamp < ttl)) {
            return cached.data as T;
        }

        // Fetch new data
        const data = await fetcher();
        cacheRef.current[key] = { data, timestamp: now };
        return data;
    }, []);

    const invalidateCache = useCallback((keyPrefix?: string) => {
        if (!keyPrefix) {
            cacheRef.current = {};
        } else {
            Object.keys(cacheRef.current).forEach(key => {
                if (key.startsWith(keyPrefix)) {
                    delete cacheRef.current[key];
                }
            });
        }
        setTick(t => t + 1);
    }, []);

    return (
        <CacheContext.Provider value={{ fetchWithCache, invalidateCache }}>
            {children}
        </CacheContext.Provider>
    );
};

export const useCache = () => {
    const context = useContext(CacheContext);
    if (!context) {
        throw new Error('useCache must be used within a CacheProvider');
    }
    return context;
};
