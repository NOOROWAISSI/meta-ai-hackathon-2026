# حالة الفرونت: الاكتشاف وتفاصيل الهاكاثون

المرجع هو Frontend Contract v0.2 وطلب تنفيذ الشاشة الثانية. التنفيذ ديمو أمامي؛ لا يفترض اتفاقًا نهائيًا على API أو خدمات الباك إند.

## التصميم والتنقل

- فاتح افتراضي بأبيض وكحلي، ودارك مجرّة؛ تركواز وأزرق مع نحاسي وموف خفيف. الاختيار محفوظ محليًا.
- مجموعات فرص كرزم ورق، تتفتح كروتها داخل الصفحة. الفلاتر والبحث يحدّثان المجموعات.
- View opportunity يفتح شاشة كاملة بعنوان قابل للمشاركة مثل `/?event=aurora-ai`.
- تبقى شاشة الاكتشاف مركبة أثناء التفاصيل؛ الرجوع يعيد البحث والفلاتر والرزمة المفتوحة والتمرير وتركيز لوحة المفاتيح. الحفظ مشترك بين الشاشتين.

## الشاشة الثانية المنفذة

- هيدر مع العنوان والمنظم والوسوم والملخص والحفظ ورابط رسمي تجريبي.
- بطاقات معلومات وتحديد المنطقة الزمنية، مع فصل التسجيل والتسليم. الغائب يظهر Not specified، والتكلفة لا تظهر كبطاقة إلا إذا كانت منشورة.
- خط زمني مرتب للمراحل الموجودة فقط، وفوائد مستخرجة حصرًا من الملخصات الخيالية السابقة.
- Overview، وRequirements & My Fit، وPreparation، مع تنقل تبويبات قابل للاستخدام بلوحة المفاتيح.
- My Fit مختصر كمخطط تفاعلي: ملف المستخدم وأربع مجموعات قابلة للاختيار، مع نقاط تمثل الشروط وعدّ حالات واضح دون نسبة أهلية. الشروط والشرح والأدلة مغلقة افتراضيًا، والتحليل بطاقات بصيرة قابلة للفتح، والمصادر والخط الزمني مطويان داخل هذا التبويب.
- فصل المشاركة والتسليم والوصول العملي والتحضير. حالات Supported / Not met / Unknown / Source conflict / Not applicable، ودليل الإفادة الذاتية وإفصاح مصدر قابل للتوسيع.
- لا نسبة أهلية ولا حكم أهلية شامل. المصدر غير المراجع أو القديم لا ينتج إخفاقًا مؤكدًا. المهارات المبلغ عنها ليست شهادة كفاءة.
- ملف اختياري للاهتمامات والمهارات والأهداف والخبرة والساعات ونوع المشارك وحجم الفريق، مع إصدار يزيد عند الحفظ.
- تحليل Meta موسوم Demo AI analysis، وأسئلة سياقية بأجوبة مستندة للسجل المختار؛ لا استدعاءات نموذج حية. كل مخرجات التحليل تمر بطبقة `src/lib/details/api.ts` المستقبلية.
- تعديل الملف يوسم النتيجة السابقة Outdated فورًا، ويحتفظ بها حتى استجابة صالحة. الاستجابة المتأخرة لسياق أقدم لا تستبدل التصحيح.
- إعداد الساعات وموارد مجانية فقط أو ميزانية تعلم مدفوعة بعملة يختارها المستخدم، ومعاينة الأولويات وإنشاء خطة قالب تجريبية. لا نختلق روابط موارد.
- الخطة غير مؤقتة بموعد تسليم مجهول؛ لا نستعمل موعد التسجيل بديلًا عنه. الشرط الإلزامي المؤكد المخالف يمنع إنشاء الخطة.
- تأكيد نجاح التخزين المحلي قبل Saved، مع بقاء مرشح الخطة غير المحفوظ وإعادة محاولة الحفظ عند الفشل.
- Continue my plan يفتح مساحة المهام المنفصلة في My Plans؛ حالة المهمة تؤكد بعد التخزين وتبقى إفادة ذاتية منفصلة عن الأهلية والتسليم.
- مصادر وحالة حداثة مع تمييز المنظم عن موقع الإدراج، وتحذير الروابط التجريبية وغياب المقاطع الأصلية.
- زر التحضير سهل الوصول على الهاتف مع مساحة أسفل المحتوى فوق شريط التنقل.

## معاينة الحالات

أثناء التطوير، افتح Details preview controls لاختبار loading وunavailable وsource-unavailable وstale وconflicting-dates وincomplete-profile وai-error وhard-blocker. سيناريو التعارض والشرط المانع موسومان بوضوح كمحاكاة، ولا يعدّلان حقائق الحدث الأصلية أو الملف المحفوظ.

السجلات الخمسة القديمة لم تتغير. لا تحتوي ساعات بدء ذات مناطق زمنية أصلية أو مواعيد تسليم أو تكلفة أو نصوص منظّم موثقة. كل ذلك يبقى مجهولًا؛ خدمات الديمو لا تُنشئ حقائق مفقودة. سيناريو المانع يستخدم إفادة فردية مؤقتة وشرط فريق مراجعًا اصطناعيًا لعرض الحالة فقط.

## التحقق والحدود

نجح TypeScript والبناء، ونجحت 24 حالة اختبار تشمل فصل مسارات المتطلبات، منع التخمين في الوقت والمواعيد، تثبيت السجلات الخمسة، الأسئلة السياقية، منع تجاوز شرط مشاركة بالخطة، وتقادم التحليل بعد تعديل الملف. تم فحص المسار في متصفح اختباري معزول بعرض 1440 و390 بكسل، بما فيه الحفظ والرجوع والتعارض وفشل التحليل وإعادة المحاولة وحفظ الخطة والتقدم. لا يوجد تجاوز أفقي على الهاتف.

يبقى ربط الباك إند والتحقق من DTOs وقت التشغيل والمصادر الحقيقية والتغطية البشرية الكاملة للشروط وموارد التعلم المراجعة وخطط الجدوى المؤقتة والتعديلات الآمنة للخطة خارج هذا الديمو. صفحة Saved الكاملة ما زالت مؤقتة. شاشة Profile مستقلة ومربوطة بالاكتشاف والتفاصيل. اللغة الحالية إنجليزية؛ الترجمة وRTL لم يُنفذا.

- My Fit: مخطط مداري تفاعلي مفتوح بدل شبكة البطاقات، وتحليل مرقّم قابل للتوسيع. أحجام الكواكب زخرفية ولا تمثل الأهلية. تم فحص التفاعل وعرض الموبايل 390px دون تجاوز أفقي.

## Student Profile

The `/profile` screen has four sections: education/background, interests/goals, self-reported skills/projects, and availability/practical preferences. A field-count indicator measures form completion only. All profile fields are optional; added project entries need a title. Weekly hours accept zero or unknown. Age is not requested because none of the fictional records has a reviewed published age condition.

Profile navigation and event Edit my profile actions open this screen. An event-specific link retains the selected event. Discover search, filters, open collection and saved opportunities survive this round trip within the current app visit. Unsaved drafts trigger an explicit leave/discard dialog and a browser unload warning. Pending text in tag inputs must be added or cleared before saving.

The replaceable `src/lib/profile/service.ts` interface loads and confirms profiles using localStorage. Failed writes retain the draft for Retry. Concurrent profile writes are rejected rather than silently replacing a newer profile. Saving touches only the profile key: existing plans and task progress are preserved. Relevant confirmed changes mark an existing in-session opportunity analysis outdated; name-only edits do not. Update my opportunity analysis explicitly regenerates it from confirmed facts. Profile preparation preferences carry into new plan forms; personal target dates do not become organizer deadlines.

Project wording help is labelled demo behavior. It compares original and editable proposed wording, asks for a personal contribution when unclear, and requires explicit acceptance. Skill suggestions come only from the student's entered project technologies and start unchecked. Changes to a project invalidate a pending suggestion. No live Meta calls, frontend credentials, CV uploads, or identity uploads are included.

Development-only Profile demo controls can fail the next save or experience suggestions without resetting stored data. `/profile?event=aurora-ai` previews event context. A new browser with no saved profile naturally shows the blank state; partial and saved states come from the actual entered values.

Profile validation: TypeScript and production build passed; all 24 automated tests passed. The isolated browser flow checked blank/partial/saved profiles, step preservation, unknown versus zero hours, inline invalid-URL rejection, a failed save and explicit Retry, personal-contribution clarification, original/proposed wording acceptance, stale suggestions, unsaved leave/discard, keyboard tag removal, project removal/undo, failed demo suggestions and retry, analysis becoming outdated and explicitly updated, unchanged completed plan data, restored Discover search/filter/save state, and 390px mobile layout without horizontal overflow. Both light and dark themes were visually reviewed.

Profile visual update: a local developer-with-laptop SVG avatar and optional PNG/JPG/WebP profile photo (up to 400 KB), saved only on explicit profile Save. Photo/name metadata is excluded from opportunity-analysis comparisons. The summary now uses an interest constellation, a goal marker, skill tags, and an availability/format composition; teal, muted violet and copper accents follow the existing palette. Browser checks confirmed image selection, save, reload restoration, removal, and a 390px viewport without overflow.

The other three profile sections now share the compact numbered composition: interests use topic chips and icon-based goal/format choices; skills use a toolbox with optional notes and individually expandable project notebook entries; availability uses a large confirmed-hours display, explicit zero/unknown shortcuts, a personal target, and icon-based budget/team choices. All existing fields, validation, privacy choices and explicit save behavior are retained. A focused isolated-browser test verified radio values and section persistence, project add/remove, zero/unknown/fractional hours, preservation of budget values when toggling, unchanged existing plan data, and 390px mobile layout for all three sections. The decorative time curve is not a generated schedule or an assessment.
