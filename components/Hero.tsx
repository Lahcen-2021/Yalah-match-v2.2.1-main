import React, { useState, useEffect, useRef } from 'react';
import { Play, Newspaper } from 'lucide-react';
import { fetchFootballNews } from '../services/api';
import { NewsItem } from '../types';
import { useCache } from '../context/CacheContext';
import OptimizedImage from './OptimizedImage';

interface HeroProps {
    onNewsClick?: () => void;                 // go to the news list
    onOpenArticle?: (item: NewsItem) => void; // open the currently shown slide's article
}

const SLIDE_INTERVAL = 5000;
const MAX_SLIDES = 6;

// Homepage hero with an auto-advancing slider of the latest news images behind the
// headline. Falls back to a plain gradient when no news images are available, so it
// never looks broken. The slide area is clickable to open that story.
const Hero: React.FC<HeroProps> = ({ onNewsClick, onOpenArticle }) => {
    const { fetchWithCache } = useCache();
    const [slides, setSlides] = useState<NewsItem[]>([]);
    const [index, setIndex] = useState(0);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        let cancelled = false;
        // Shares the 'football-news' cache with the news page, so this adds no extra fetch.
        fetchWithCache('football-news', fetchFootballNews, 600000)
            .then(news => {
                if (cancelled) return;
                setSlides(news.filter(n => n.imageUrl).slice(0, MAX_SLIDES));
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [fetchWithCache]);

    useEffect(() => {
        if (slides.length <= 1) return;
        timer.current = setInterval(() => setIndex(i => (i + 1) % slides.length), SLIDE_INTERVAL);
        return () => { if (timer.current) clearInterval(timer.current); };
    }, [slides.length]);

    const current = slides[index];

    const goTo = (i: number) => {
        setIndex(i);
        if (timer.current) clearInterval(timer.current); // reset auto-advance after manual nav
        if (slides.length > 1) {
            timer.current = setInterval(() => setIndex(p => (p + 1) % slides.length), SLIDE_INTERVAL);
        }
    };

    return (
        <section className="relative overflow-hidden rounded-2xl sm:rounded-[24px] mb-4 bg-gradient-to-l from-emerald-800 via-emerald-700 to-[#071B3B] shadow-md">
            {/* Slider layer — clickable to open the current story */}
            <button
                type="button"
                onClick={() => current && onOpenArticle?.(current)}
                aria-label={current ? current.title : 'الأخبار'}
                className="absolute inset-0 w-full h-full cursor-pointer"
            >
                {slides.map((slide, i) => {
                    // Only mount the image for the current and next slide — otherwise all
                    // 6 external images download at once and starve the match list (the
                    // primary content) of bandwidth on mobile.
                    const isNear = i === index || i === (index + 1) % slides.length;
                    return (
                        <div
                            key={slide.id}
                            className={`absolute inset-0 transition-opacity duration-1000 ${i === index ? 'opacity-100' : 'opacity-0'}`}
                        >
                            {isNear && (
                                <OptimizedImage
                                    src={slide.imageUrl}
                                    alt=""
                                    width={768}
                                    className="w-full h-full object-cover object-center"
                                />
                            )}
                        </div>
                    );
                })}
            </button>

            {/* Readability overlay, darker on the text side (right in RTL). pointer-events-none
                so the slide underneath stays clickable; interactive children re-enable events. */}
            <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/40 to-black/20 pointer-events-none"></div>

            <div className="relative z-10 px-5 py-8 sm:px-10 sm:py-12 text-right pointer-events-none">
                <h2 className="text-white font-black text-2xl sm:text-4xl leading-tight drop-shadow-md">
                    كل مباريات اليوم في مكان واحد
                </h2>
                <p className="mt-2 text-emerald-100 font-bold text-sm sm:text-base max-w-xl drop-shadow">
                    نتائج مباشرة، القنوات الناقلة والمعلقين، ترتيب الدوريات والبطولات، وآخر أخبار الكرة العربية والعالمية
                </p>
                <div className="mt-5 flex items-center justify-start gap-3 flex-row-reverse sm:flex-row sm:justify-start">
                    <button
                        onClick={() => document.querySelector('.match-list-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-white text-emerald-800 rounded-full font-black text-sm hover:bg-emerald-50 transition-colors shadow-lg"
                    >
                        <Play className="w-4 h-4" />
                        مباريات اليوم
                    </button>
                    {onNewsClick && (
                        <button
                            onClick={onNewsClick}
                            className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-white/10 text-white border border-white/30 rounded-full font-black text-sm hover:bg-white/20 transition-colors backdrop-blur-sm"
                        >
                            <Newspaper className="w-4 h-4" />
                            آخر الأخبار
                        </button>
                    )}
                </div>
            </div>

            {/* Current story caption + slide dots */}
            {slides.length > 0 && (
                <div className="absolute bottom-3 left-4 right-4 z-20 flex items-end justify-between gap-3 pointer-events-none">
                    {current && (
                        <button
                            onClick={() => onOpenArticle?.(current)}
                            className="pointer-events-auto max-w-[60%] text-right text-white/90 text-[11px] sm:text-xs font-bold line-clamp-1 hover:text-white transition-colors"
                        >
                            {current.title}
                        </button>
                    )}
                    {slides.length > 1 && (
                        <div className="pointer-events-auto flex items-center">
                            {slides.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => goTo(i)}
                                    aria-label={`الشريحة ${i + 1}`}
                                    className="p-2.5 -m-1 flex items-center" // large tap target around a small visual dot
                                >
                                    <span className={`block h-1.5 rounded-full transition-all ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50'}`} />
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
};

export default React.memo(Hero);
