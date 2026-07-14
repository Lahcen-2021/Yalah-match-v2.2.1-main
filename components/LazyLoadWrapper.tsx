
import React, { useState, useEffect, useRef } from 'react';

interface LazyLoadWrapperProps {
  children: React.ReactNode;
  placeholderHeight?: string; // CSS height value
}

const LazyLoadWrapper: React.FC<LazyLoadWrapperProps> = ({ children, placeholderHeight = '180px' }) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // When the element is near the viewport (rootMargin), render the content
        if (entry.isIntersecting) {
          setIsVisible(true);
          // Once visible, we can stop observing to save resources
          if (elementRef.current) {
            observer.unobserve(elementRef.current);
          }
        }
      },
      {
        root: null, // viewport
        rootMargin: '400px 0px', // Render ~half a screen ahead — enough for smooth scroll without
                                 // mounting (and channel-fetching) many off-screen cards on load.
        threshold: 0,
      }
    );

    const currentElement = elementRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, []);

  return (
    <div ref={elementRef} style={{ minHeight: isVisible ? 'auto' : placeholderHeight }}>
      {isVisible ? children : null}
    </div>
  );
};

export default LazyLoadWrapper;
