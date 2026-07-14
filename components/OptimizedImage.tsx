
import React, { useState, useMemo, useCallback } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null;
  alt?: string;
  width?: number;
  height?: number;
  fallbackSrc?: string;
  fallbackElement?: React.ReactNode;
}

const OptimizedImage: React.FC<OptimizedImageProps> = ({ src, alt = '', width, height, fallbackSrc, fallbackElement, className = '', ...props }) => {
    // Hooks must be declared unconditionally at the top level.
    // Eager images (e.g. the LCP team logo) skip the opacity-0 fade-in: starting hidden would
    // defer their first paint until onLoad fires, which delays Largest Contentful Paint.
    const eager = props.loading === 'eager';
    const [isLoaded, setIsLoaded] = useState(eager);
    const [hasError, setHasError] = useState(false);

    // Determine validity for effect logic
    const isValidSrc = !!(src && typeof src === 'string' && src.trim() !== '');

    const optimized = useMemo(() => {
        if (!isValidSrc || !src) return null;
        if (src.startsWith('data:') || src.startsWith('blob:')) return src;
        
        // Clean up common issues
        const cleanSrc = src.replace(/&amp;/g, '&');
        
        // If it's already using wsrv.nl, don't wrap it again
        if (cleanSrc.includes('wsrv.nl')) return cleanSrc;
        
        let url = `https://wsrv.nl/?url=${encodeURIComponent(cleanSrc)}&output=webp&q=80`;
        if (width) url += `&w=${width}`;
        if (height) url += `&h=${height}`;
        return url;
    }, [src, width, height, isValidSrc]);

    const [prevOptimized, setPrevOptimized] = useState(optimized);
    if (optimized !== prevOptimized) {
        setPrevOptimized(optimized);
        setIsLoaded(eager);
        setHasError(false);
    }

    const handleLoad = () => setIsLoaded(true);

    const handleError = () => {
        setHasError(true);
        setIsLoaded(true);
    };

    const currentSrc = hasError ? (fallbackSrc ?? null) : optimized;

    // A cached image can reach `complete` before React attaches onLoad, so that handler never fires
    // and the element would stay stuck at opacity-0 (invisible). This bit any logo reused after it
    // was shown elsewhere — e.g. H2H rows reusing the main match's already-cached team/league crests.
    // A ref callback (re-run on mount via the key below) reflects the <img>'s real load state.
    const handleImgRef = useCallback((node: HTMLImageElement | null) => {
        if (!node || !node.complete) return;
        if (node.naturalWidth > 0) {
            setIsLoaded(true);
        } else {
            setHasError(true);
            setIsLoaded(true);
        }
    }, []);

    if (!isValidSrc || !currentSrc) {
        return fallbackElement ? <>{fallbackElement}</> : null;
    }

    const combinedClasses = `
        transition-opacity duration-500 ease-out
        ${isLoaded ? 'opacity-100' : 'opacity-0'}
        ${hasError ? 'grayscale opacity-60 p-1' : ''}
        ${className}
    `.trim();

    return (
        <img
            key={currentSrc}
            ref={handleImgRef}
            src={currentSrc || undefined}
            alt={alt}
            onLoad={handleLoad}
            onError={handleError}
            loading={props.loading || "lazy"}
            decoding="async"
            className={combinedClasses}
            {...props}
        />
    );
};

export default React.memo(OptimizedImage);
