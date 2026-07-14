
import React from 'react';
import { AppView } from './Header';

interface FooterProps {
    setView: (view: AppView) => void;
}

const Footer: React.FC<FooterProps> = ({ setView }) => {
  const handleLinkClick = (view: AppView) => {
      try {
          // Reset URL to root to close match details if open
          if (window.location.pathname !== '/' && window.location.pathname !== '') {
               window.history.pushState({}, '', '/');
               window.dispatchEvent(new PopStateEvent('popstate'));
          }
      } catch (e) {
          console.warn('Navigation history update failed (ignoring):', e);
      }
      
      setView(view);
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-white mt-12 border-t font-tajawal">
      <div className="container mx-auto py-8 px-4 sm:px-6 lg:px-8 text-center text-gray-500">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm">
                <p>&copy; {new Date().getFullYear()} <span className="font-bold text-gray-700">يلا ماتش</span>. جميع الحقوق محفوظة.</p>
            </div>
            <div className="flex justify-center gap-6">
              <button onClick={() => handleLinkClick('privacy')} className="text-sm hover:text-green-600 transition-colors">سياسة الخصوصية</button>
              <button onClick={() => handleLinkClick('terms')} className="text-sm hover:text-green-600 transition-colors">الشروط والأحكام</button>
            </div>
        </div>
      </div>
    </footer>
  );
};

export default React.memo(Footer);
