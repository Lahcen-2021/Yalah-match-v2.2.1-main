
import React from 'react';

const PrivacyPolicyView: React.FC = () => {
    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl font-tajawal text-right animate-fadeInUp" dir="rtl">
            <div className="mb-8 text-center">
                <h1 className="text-3xl sm:text-4xl font-black text-gray-900 mb-2">سياسة الخصوصية</h1>
                <div className="h-1.5 w-24 bg-emerald-600 rounded-full mx-auto"></div>
            </div>
            
            <div className="bg-white p-6 sm:p-10 rounded-3xl shadow-sm border border-gray-100 space-y-8 text-gray-700 leading-relaxed text-sm sm:text-base">
                <section>
                    <p className="mb-4">
                        مرحباً بكم في موقع <strong>يلا ماتش</strong> (<a href="https://yallamatch.online" className="text-emerald-600 hover:underline font-bold dir-ltr">yallamatch.online</a>). 
                        نحن في "يلا ماتش" نولي أهمية قصوى لخصوصية زوارنا. توضح هذه الوثيقة الخطوط العريضة لأنواع المعلومات الشخصية التي يتلقاها ويجمعها موقعنا وكيفية استخدامها، لضمان تجربة تصفح آمنة وموثوقة لمتابعة <strong>مباريات اليوم بث مباشر</strong> وآخر أخبار الكرة العالمية.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        1. ملفات الدخول (Log Files)
                    </h2>
                    <p>
                        شأننا شأن معظم خوادم المواقع الأخرى، ومنها موقع <strong>يلا ماتش (Yalla Match)</strong>، نستخدم نظام ملفات الدخول. وهذا يشمل بروتوكول الإنترنت (عناوين IP)، نوع المتصفح، مزود خدمة الإنترنت (ISP)، التاريخ/الوقت، وعدد النقرات لتحليل الاتجاهات وإدارة الموقع. 
                        نود التأكيد على أن هذه المعلومات لا يتم استخدامها لجمع أي معلومات شخصية تحدد هوية الزائر (مثل الاسم أو العنوان)، وإنما لأغراض تحسين جودة البث المباشر وتجربة المستخدم.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        2. القوائم البريدية والكوكيز
                    </h2>
                    <p className="mb-3">
                        يستخدم موقع <strong>يلا ماتش</strong> تقنية الكوكيز (Cookies) لتخزين المعلومات عن إعدادات الزوار، ولتسجيل معلومات محددة عن الصفحات التي يزورها المستخدم. بهذا، فإننا نعرف مدى اهتمام الزوار وأي المواضيع هي الأكثر تفضيلاً (مثل جداول ترتيب الدوريات أو القنوات الناقلة)، حتى نستطيع تطوير محتوانا الرياضي ليتناسب مع تطلعاتكم.
                    </p>
                    <p>
                        بعض شركائنا في الإعلانات قد يستخدمون الكوكيز والملفات على موقعنا، ويتضمن شركاؤنا الإعلانيين <strong>Google AdSense</strong>. هذه الأطراف الثالثة تستخدم هذه التقنيات لعرض الإعلانات والروابط التي تظهر على موقع يلا ماتش وترسل مباشرة إلى المتصفحات. وهي تحصل تلقائياً على عنوان IP الخاص بك عند حدوث ذلك.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        3. كوكيز دبل كليك (DoubleClick DART Cookie)
                    </h2>
                    <ul className="list-disc list-inside space-y-2 mr-4 marker:text-emerald-500">
                        <li><strong>Google</strong> كطرف ثالث بائع، تستخدم الكوكيز لخدمة الإعلانات على موقعنا.</li>
                        <li>استخدام جوجل للكوكيز DART يمهد لخدمة الإعلانات للمستخدمين بناءً على زيارتهم لموقعنا ومواقع أخرى على شبكة الإنترنت.</li>
                        <li>يجوز للمستخدمين اختيار عدم استخدام الكوكيز DART عن طريق زيارة سياسة الخصوصية الخاصة بإعلانات Google وشبكة المحتوى عبر الرابط التالي: <a href="http://www.google.com/privacy_ads.html" target="_blank" rel="noopener noreferrer" className="text-emerald-600 hover:underline">http://www.google.com/privacy_ads.html</a></li>
                    </ul>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        4. أمن المعلومات
                    </h2>
                    <p>
                        نحن نتخذ الإجراءات المناسبة لضمان حماية المعلومات التي نجمعها من الوصول غير المصرح به أو التغيير أو الإفصاح أو الإتلاف. ومع ذلك، لا يمكن ضمان أمان البيانات المرسلة عبر الإنترنت بنسبة 100%. استخدامك لموقعنا يعني موافقتك على تحمل المخاطر المتعلقة بذلك.
                    </p>
                </section>

                <section>
                    <h2 className="text-xl font-black text-gray-900 mb-3 flex items-center gap-2">
                        <span className="w-2 h-6 bg-emerald-500 rounded-sm"></span>
                        5. الاتصال بنا
                    </h2>
                    <p>
                        إذا كنت بحاجة إلى مزيد من المعلومات أو لديك أية أسئلة عن سياسة الخصوصية الخاصة بنا، لا تتردد في الاتصال بنا عن طريق صفحة "اتصل بنا" الموجودة في القائمة الرئيسية للموقع.
                    </p>
                    <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-100 text-center text-sm text-gray-500">
                        تم آخر تحديث لهذه السياسة بتاريخ: 2025
                    </div>
                </section>
            </div>
        </div>
    );
};

export default PrivacyPolicyView;
