import React, { useState, useEffect } from 'react';
import { fetchFootballNews, fetchNewsArticle } from '../services/api';
import { NewsItem, NewsArticle } from '../types';
import { useCache } from '../context/CacheContext';
import OptimizedImage from './OptimizedImage';
import { Newspaper, Clock, ChevronRight } from 'lucide-react';

const NewsSkeleton: React.FC = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fadeIn">
        {[...Array(9)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="h-40 bg-gray-100 animate-shimmer"></div>
                <div className="p-4 space-y-3">
                    <div className="h-4 bg-gray-100 rounded animate-shimmer"></div>
                    <div className="h-4 bg-gray-50 rounded w-3/4 animate-shimmer"></div>
                    <div className="h-3 bg-gray-50 rounded w-1/2 animate-shimmer"></div>
                </div>
            </div>
        ))}
    </div>
);

// Relative Arabic timestamp: "منذ ٣ ساعات" style, falling back to a date for old items.
const timeAgo = (iso: string): string => {
    const diffMs = Date.now() - new Date(iso).getTime();
    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `منذ ${hours} ${hours === 1 ? 'ساعة' : hours === 2 ? 'ساعتين' : hours <= 10 ? 'ساعات' : 'ساعة'}`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `منذ ${days} ${days === 1 ? 'يوم' : days === 2 ? 'يومين' : 'أيام'}`;
    return new Date(iso).toLocaleDateString('ar-MA', { day: 'numeric', month: 'long' });
};

const NewsCard: React.FC<{ item: NewsItem; featured?: boolean; onOpen: (item: NewsItem) => void }> = ({ item, featured, onOpen }) => (
    <button
        onClick={() => onOpen(item)}
        className={`group text-right bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-md hover:border-emerald-200 transition-all flex flex-col ${featured ? 'sm:col-span-2 lg:col-span-2 lg:row-span-2' : ''}`}
    >
        <div className={`relative w-full bg-gray-100 overflow-hidden ${featured ? 'h-56 sm:h-72' : 'h-40'}`}>
            {item.imageUrl ? (
                <OptimizedImage
                    src={item.imageUrl}
                    alt={item.title}
                    width={featured ? 800 : 400}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
            ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-emerald-50 to-gray-100">
                    <Newspaper className="w-10 h-10 text-emerald-200" />
                </div>
            )}
            <span className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-[10px] font-black px-2.5 py-1 rounded-full">
                {item.source}
            </span>
        </div>
        <div className="p-4 flex flex-col flex-1 w-full">
            <h3 className={`font-black text-gray-900 leading-snug group-hover:text-emerald-700 transition-colors ${featured ? 'text-lg sm:text-xl' : 'text-sm'}`}>
                {item.title}
            </h3>
            {item.description && (
                <p className={`mt-2 text-gray-500 font-medium leading-relaxed ${featured ? 'text-sm line-clamp-3' : 'text-xs line-clamp-2'}`}>
                    {item.description}
                </p>
            )}
            <div className="mt-auto pt-3 flex items-center justify-between text-[10px] font-bold text-gray-400 w-full">
                <span>{timeAgo(item.publishedAt)}</span>
                <span className="text-emerald-600 opacity-0 group-hover:opacity-100 transition-opacity">اقرأ الخبر ←</span>
            </div>
        </div>
    </button>
);

// Full dedicated article page (a real view, not a modal). The visitor reads the
// translated story here without ever being redirected to the source site.
export const NewsArticleView: React.FC<{ item: NewsItem; onBack: () => void }> = ({ item, onBack }) => {
    const { fetchWithCache } = useCache();
    const [article, setArticle] = useState<NewsArticle | null>(null);
    const [loading, setLoading] = useState(true);

    // App remounts this view per article (key={item.id}), so loading starts true and
    // this effect only needs to clear it when the fetch settles.
    useEffect(() => {
        let cancelled = false;
        // Article bodies are immutable once published — cache aggressively client-side too.
        fetchWithCache(`article-${item.id}`, () => fetchNewsArticle(item.id), 3600000)
            .then(data => { if (!cancelled) setArticle(data); })
            .catch(() => {})
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [item.id, fetchWithCache]);

    useEffect(() => { window.scrollTo({ top: 0, behavior: 'auto' }); }, []);

    const paragraphs = article?.paragraphs?.length ? article.paragraphs : (item.description ? [item.description] : []);

    return (
        <div className="py-4 font-tajawal w-full max-w-3xl mx-auto animate-fadeInUp">
            <button
                onClick={onBack}
                className="mb-4 inline-flex items-center gap-1.5 px-4 py-2 bg-white text-gray-600 rounded-full border border-gray-200 hover:bg-gray-50 hover:text-emerald-600 hover:border-emerald-200 transition-all shadow-sm text-sm font-bold"
            >
                <ChevronRight className="w-4 h-4" />
                العودة إلى الأخبار
            </button>

            <article className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="relative">
                    {item.imageUrl ? (
                        <div className="h-56 sm:h-80 bg-gray-100">
                            <OptimizedImage src={item.imageUrl} alt={item.title} width={1000} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="h-24 bg-gradient-to-l from-emerald-700 to-[#071B3B]"></div>
                    )}
                    <span className="absolute bottom-3 right-3 bg-emerald-600 text-white text-[11px] font-black px-3 py-1 rounded-full shadow">
                        {item.source}
                    </span>
                </div>

                <div className="p-5 sm:p-8">
                    <h1 className="text-xl sm:text-3xl font-black text-gray-900 leading-snug">{item.title}</h1>
                    <div className="flex items-center gap-1.5 mt-3 text-xs font-bold text-gray-400">
                        <Clock className="w-4 h-4" />
                        <span>{timeAgo(item.publishedAt)}</span>
                    </div>

                    <div className="mt-6 space-y-4">
                        {loading ? (
                            [...Array(5)].map((_, i) => (
                                <div key={i} className="space-y-2">
                                    <div className="h-4 bg-gray-100 rounded animate-shimmer"></div>
                                    <div className="h-4 bg-gray-100 rounded animate-shimmer w-11/12"></div>
                                    <div className="h-4 bg-gray-50 rounded animate-shimmer w-4/5"></div>
                                </div>
                            ))
                        ) : (
                            paragraphs.map((p, i) => (
                                <p key={i} className="text-gray-700 text-[15px] sm:text-base font-medium leading-loose">
                                    {p}
                                </p>
                            ))
                        )}
                    </div>

                    <p className="mt-10 pt-5 border-t border-gray-100 text-[11px] font-bold text-gray-400">
                        المصدر: {item.source}
                    </p>
                </div>
            </article>
        </div>
    );
};

const NewsView: React.FC<{ onOpenArticle: (item: NewsItem) => void }> = ({ onOpenArticle }) => {
    const { fetchWithCache } = useCache();
    const [news, setNews] = useState<NewsItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadNews = async (forceRefresh = false) => {
        setLoading(true);
        setError(null);
        try {
            // 10-minute client cache on top of the server's 15-minute cache.
            const data = await fetchWithCache('football-news', fetchFootballNews, 600000, forceRefresh);
            setNews(data);
            if (data.length === 0) setError('لا توجد أخبار متاحة حالياً');
        } catch {
            setError('حدث خطأ أثناء جلب الأخبار');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadNews().catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="py-4 font-tajawal w-full max-w-6xl mx-auto animate-fadeInUp">
            <div className="flex items-center justify-between mb-6 px-1">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-sm">
                        <Newspaper className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-gray-900">أخبار كرة القدم</h2>
                        <p className="text-xs font-bold text-gray-400">آخر أخبار الكرة العربية والعالمية</p>
                    </div>
                </div>
                <button
                    onClick={() => loadNews(true)}
                    className="px-4 py-2 text-xs font-bold bg-white text-gray-600 border border-gray-200 rounded-full hover:bg-gray-50 hover:text-emerald-600 transition-colors"
                >
                    تحديث
                </button>
            </div>

            {loading ? (
                <NewsSkeleton />
            ) : error ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-200 text-gray-400">
                    <p className="font-bold mb-4">{error}</p>
                    <button onClick={() => loadNews(true)} className="text-emerald-600 font-bold hover:underline">
                        إعادة المحاولة
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {news.map((item, i) => (
                        <NewsCard key={item.id} item={item} featured={i === 0} onOpen={onOpenArticle} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default NewsView;
