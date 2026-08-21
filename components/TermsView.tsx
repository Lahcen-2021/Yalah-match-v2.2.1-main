
import React from 'react';

const TermsView: React.FC = () => {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl font-tajawal text-right animate-fadeInUp" dir="rtl">
            <div className="mb-8 text-center">
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">الشروط والأحكام</h1>
                <div className="h-1.5 w-24 bg-emerald-600 rounded-full mx-auto"></div>
            </div>
            
            <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-gray-100 space-y-8 text-gray-700 leading-relaxed text-sm sm:text-base">
                <section>
                    <p className="mb-4">
                        أهلاً بك في موقع <strong>يلا ماتش</strong> (<a href="https://yallamatch.online" className="text-emerald-600 hover:underline font-bold dir-ltr">yallamatch.online</a>). 
                        يرجى قراءة هذه الشروط والأحكام بعناية قبل استخدام الموقع. باستخدامك لهذا الموقع، فإنك توافق على الالتزام بهذه الشروط. إذا كنت لا توافق على أي جزء من هذه الشروط، فلا يحق لك استخدام الموقع.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        1. حقوق الملكية الفكرية
                    </h2>
                    <p>
                        جميع المحتويات المنشورة على موقع <strong>يلا ماتش</strong>، بما في ذلك النصوص، التصاميم، الشعارات، والأكواد البرمجية، هي ملك لموقع يلا ماتش أو المرخصين له ومحمية بموجب قوانين حقوق النشر والملكية الفكرية. لا يجوز نسخ أو إعادة إنتاج أي جزء من الموقع دون إذن كتابي مسبق.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        2. المحتوى وإخلاء المسؤولية
                    </h2>
                    <ul className="list-disc list-inside space-y-2 mr-4 marker:text-emerald-500">
                        <li>موقع <strong>يلا ماتش</strong> يعمل كمحرك بحث ومجمع للأخبار الرياضية وجداول المباريات.</li>
                        <li>نحن <strong>لا نستضيف</strong> أي محتوى فيديو أو بث مباشر على خوادمنا الخاصة.</li>
                        <li>جميع الروابط ومقاطع الفيديو (Embeds) المعروضة على الموقع هي روابط متاحة للعموم من مواقع خارجية (مثل YouTube, Dailymotion, أو منصات أخرى).</li>
                        <li>موقع يلا ماتش غير مسؤول عن محتوى هذه المواقع الخارجية أو قانونيتها. حقوق الملكية لهذه الفيديوهات تعود لأصحابها الأصليين.</li>
                        <li>إذا كنت تعتقد أن هناك محتوى ينتهك حقوق الملكية الخاصة بك، يرجى التواصل مع الموقع المستضيف للفيديو لإزالته.</li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        3. الاستخدام المقبول
                    </h2>
                    <p>
                        يُحظر استخدام موقع <strong>yallamatch.online</strong> لأي أغراض غير قانونية أو تسبب ضرراً للموقع أو للمستخدمين الآخرين. يشمل ذلك، على سبيل المثال لا الحصر، محاولات الاختراق، نشر البرمجيات الخبيثة، أو جمع البيانات بطرق غير مشروعة.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        4. الروابط الخارجية
                    </h2>
                    <p>
                        قد يحتوي الموقع على روابط لمواقع طرف ثالث. نحن لسنا مسؤولين عن دقة أو محتوى المعلومات الموجودة على تلك المواقع. زيارتك لتلك المواقع تكون على مسؤوليتك الخاصة.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        5. التعديلات على الشروط
                    </h2>
                    <p>
                        نحتفظ بالحق في تعديل هذه الشروط والأحكام في أي وقت. سيتم نشر أي تغييرات على هذه الصفحة، ويعتبر استمرارك في استخدام الموقع بعد نشر التعديلات قبولاً لها.
                    </p>
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center text-sm text-gray-500">
                        آخر تحديث للشروط: 2025
                    </div>
                </section>
            </div>
        </div>
    );
};

export default TermsView;
