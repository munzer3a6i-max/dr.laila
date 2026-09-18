/* ============================================================
   i18n — Arabic / English
   ------------------------------------------------------------
   Loaded in <head> (not deferred) so the document direction is
   set before first paint and the page never flashes the wrong
   way round.

   To edit copy: change the strings below. To add a language:
   copy the `en` block, give it a code, and add that code to
   `ORDER`.
   ============================================================ */
(function () {
  'use strict';

  var DICT = {

    /* ══════════════════════ العربية ══════════════════════ */
    ar: {
      dir: 'rtl',
      locale: 'ar',
      name: 'العربية',

      'meta.title': 'د. دلال العصيمي — أخصائية نفسية للأطفال والمراهقين',
      'meta.description': 'أخصائية نفسية للأطفال والمراهقين في الرياض. جلسات قائمة على الأدلة تساعد الأطفال والعائلات على تجاوز التحديات العاطفية وبناء المرونة. احجز استشارتك اليوم.',
      'meta.ogTitle': 'د. دلال العصيمي — أخصائية نفسية للأطفال والمراهقين',
      'meta.ogDescription': 'مساحة آمنة للعقول الشابة لتنمو. احجز استشارتك اليوم.',

      'a11y.skip': 'تخطَّ إلى الحجز',
      'a11y.primaryNav': 'التنقل الرئيسي',
      'a11y.menuOpen': 'فتح القائمة',
      'a11y.menuClose': 'إغلاق القائمة',

      'header.name': 'د. دلال العصيمي',
      'header.role': 'أخصائية نفسية',
      'header.logoAria': 'د. دلال العصيمي — الصفحة الرئيسية',
      'header.bookBtn': 'حجز جلسة',

      'nav.about': 'نبذة عني',
      'nav.services': 'الخدمات',
      'nav.testimonials': 'قصص العملاء',
      'nav.booking': 'الحجز',

      'hero.pill': 'علم نفس الطفل والمراهق',
      'hero.title': 'مساحة آمنة للعقول الشابة لتنمو',
      'hero.lead': 'أعمل مع الأطفال والمراهقين - وعائلاتهم - لمساعدتهم على تجاوز التحديات العاطفية، وبناء المرونة، وإيجاد موطئ قدم لهم خلال السنوات المحورية.',
      'hero.ctaPrimary': 'إحجز إستشارة',
      'hero.ctaSecondary': 'تعرف على منهجية عملنا',
      'hero.stat1': 'شهادة خبرة',
      'hero.stat2': 'إستشارة',
      'hero.stat3': 'سنة خبرة',
      'hero.imgAlt': 'أم تحتضن طفلتها في جلسة دافئة',
      'hero.floatTitle': 'الرعاية القائمة على الأدلة',
      'hero.floatSub': 'العلاج السلوكي المعرفي',

      'services.eyebrow': 'ما أقدمه',
      'services.title': 'خدمات مصممة خصيصاً لكل مرحلة',
      'services.s1title': 'استشارات القلق والمخاوف والوسواس',
      'services.s1body': 'نساعدك على فهم القلق والمخاوف والأفكار المتكررة، وتطوير استراتيجيات عملية لاستعادة الهدوء والشعور بالأمان في حياتك اليومية.',
      'services.s2title': 'خدمات الصحة النفسية والمزاجية',
      'services.s2body': 'نقدم دعمًا نفسيًا متخصصًا للتعامل مع الاكتئاب، وتقلبات المزاج، والإدمان، واضطرابات النوم، والاحتراق الوظيفي، وغيرها من التحديات النفسية.',
      'services.s3title': 'استشارات اضطرابات الشخصية',
      'services.s3body': 'نساعدك على فهم أنماط التفكير والسلوك والتعامل مع الآخرين، وبناء مهارات أكثر توازنًا لتحسين العلاقات وجودة الحياة.',
      'services.s4title': 'استشارات الزواج والعلاقات الزوجية',
      'services.s4body': 'نوفر إرشادًا يساعد الأزواج على تحسين التواصل، وإدارة الخلافات، واستعادة الثقة والمودة، واتخاذ قرارات واعية بشأن مستقبل العلاقة.',
      'services.s5title': 'استشارات الأطفال والمراهقين',
      'services.s5body': 'جلسات فردية وعائلية تدعم الطفل والمراهق في تنظيم المشاعر، وتحسين السلوك والتحصيل الدراسي، وبناء علاقة صحية مع من حوله.',

      'about.eyebrow': 'نبذة عني',
      'about.title': 'أؤمن بأن لكل طفل الحق في أن يشعر بأن صوته مسموع',
      'about.p1': 'بخبرة تزيد عن 15 عامًا في علم نفس الأطفال والمراهقين، أقدم نهجًا قائمًا على الأدلة ومراعيًا للظروف. ينطلق عملي من فهمي بأن الصحة النفسية في المراحل المبكرة من العمر تُشكل الشخصية التي نصبح عليها.',
      'about.p2': 'أعمل مع عائلات من خلفيات متنوعة، وأقدم جلسات باللغتين العربية والإنجليزية. مكتبي مكان هادئ ومريح مصمم ليُشعر الأطفال بالراحة فوراً.',
      'about.cred1': 'بكلاريوس علم النفس',
      'about.cred1sub': 'كليات بريدة الاهلية',
      'about.cred2': 'ماجستير الإرشاد النفسي',
      'about.cred2sub': 'جامعة الملك سعود',
      'about.name': 'د. دلال العصيمي',
      'about.role': 'أخصائي نفسي',
      'about.imgAlt': 'د. دلال العصيمي مع إحدى الأطفال',

      'testimonials.eyebrow': 'قصص العملاء',
      'testimonials.title': 'ما تقوله العائلات',
      'testimonials.starsAria': 'تقييم 5 من 5',
      'testimonials.q1': '“دعمها النفسي لابنتي كان له تأثير إيجابي ملحوظ، حيث أصبحت أكثر ثقة في نفسها.”',
      'testimonials.n1': 'منى الجابري',
      'testimonials.r1': 'والدة مراهقة',
      'testimonials.q2': '“ساعدتني جلساتنا في فهم مشاعر ابني بشكل أفضل، وأصبح أكثر انفتاحًا في التعبير عن نفسه.”',
      'testimonials.n2': 'علي الحسن',
      'testimonials.r2': 'والد طالب',
      'testimonials.q3': '“استراتيجيات اللعب التفاعلي لتنمية المهارات الاجتماعية لدى الأطفال، بما يعزز التواصل الفعّال والعلاقات الصحية.”',
      'testimonials.n3': 'سارة الرفاعي',
      'testimonials.r3': 'أخصائية نفسية للأطفال',

      'booking.eyebrow': 'الحجز',
      'booking.title': 'احجز موعد استشارتك',
      'booking.note': 'اختر التاريخ والوقت الأنسب لعائلتك. مدة الاستشارة الأولى 50 دقيقة.',
      'booking.step1': 'نوع الجلسة',
      'booking.step2': 'اختر اليوم',
      'booking.step3': 'اختر الوقت',
      'booking.step4': 'التأكيد والدفع',
      'booking.serviceLabel': 'الخدمة',
      'booking.typeLabel': 'نوع الجلسة',
      'booking.prevMonth': 'الشهر السابق',
      'booking.nextMonth': 'الشهر التالي',
      'booking.nameLabel': 'الاسم',
      'booking.namePh': 'الاسم بالكامل',
      'booking.childLabel': 'اسم الطفل وعمره',
      'booking.childPh': 'مها ، 6 سنوات',
      'booking.emailLabel': 'البريد الالكتروني',
      'booking.reasonLabel': 'سبب الجلسة باختصار',
      'booking.reasonPh': 'اختياري — يساعدني في التحضير لاجتماعنا الأول',
      'booking.summaryLabel': 'ملخص الحجز',
      'booking.summaryEmpty': 'اختر نوع الجلسة واليوم والوقت',
      'booking.submit': 'تأكيد الحجز والدفع',
      'booking.submitNote': 'سوف تقوم بإستلام ايميل ببيانات الحجز خلال 24 ساعة',
      'booking.doneTitle': 'تم تأكيد حجزك',
      'booking.doneNote': 'سوف تقوم بإستلام ايميل ببيانات الحجز خلال 24 ساعة.',
      'booking.again': 'حجز موعد آخر',

      /* booking — dynamic strings */
      'bk.pickDayFirst': 'اختر اليوم أولاً لعرض الأوقات المتاحة.',
      'bk.noSlots': 'لا توجد مواعيد متاحة في هذا اليوم.',
      'bk.loadingSlots': 'جارٍ تحميل الأوقات المتاحة…',
      'bk.slotsError': 'تعذّر تحميل الأوقات. حاول مرة أخرى.',
      'bk.taken': 'محجوز',
      'bk.unavailableDay': 'غير متاح',
      'bk.tzNote': 'جميع الأوقات بتوقيت الرياض',
      'bk.errName': 'الرجاء إدخال الاسم.',
      'bk.errChild': 'الرجاء إدخال اسم الطفل وعمره.',
      'bk.errEmail': 'الرجاء إدخال البريد الالكتروني.',
      'bk.errEmailFormat': 'صيغة البريد الالكتروني غير صحيحة.',
      'bk.errPickDay': 'الرجاء اختيار اليوم المناسب لك.',
      'bk.errPickTime': 'الرجاء اختيار الوقت المناسب لك.',
      'bk.errFields': 'الرجاء تعبئة الحقول المطلوبة.',
      'bk.errSend': 'تعذّر إتمام الحجز. الرجاء المحاولة مرة أخرى أو التواصل معنا مباشرة.',
      'bk.errNetwork': 'تعذّر الاتصال بالخادم. تحقق من اتصالك بالإنترنت وحاول مرة أخرى.',
      'bk.errTaken': 'هذا الموعد لم يعد متاحًا. الرجاء اختيار وقت آخر.',
      'bk.currency': 'ريال',
      'bk.minutes': 'دقيقة',
      'bk.hour': 'ساعة',
      'bk.hourHalf': 'ساعة ونصف',
      'bk.halfHour': 'نصف ساعة',
      'bk.am': 'ص',
      'bk.pm': 'م',

      'bk.months': ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'],
      'bk.dowShort': ['أحد','اثنين','ثلاثاء','اربعاء','خميس','جمعة','سبت'],
      'bk.dowLong': ['الأحد','الاثنين','الثلاثاء','الاربعاء','الخميس','الجمعة','السبت'],

      'svc.anxiety': 'القلق والمخاوف والوسواس',
      'svc.mood': 'الصحة النفسية والمزاجية',
      'svc.personality': 'اضطرابات الشخصية',
      'svc.marriage': 'الزواج والعلاقات الزوجية',
      'svc.children': 'الأطفال والمراهقين',

      'type.intro': 'جلسة تعريفية',
      'type.individual': 'جلسة فردية',
      'type.family': 'جلسة عائلية',
      'type.followup': 'جلسة متابعة',

      'footer.hoursTitle': 'ساعات العمل',
      'footer.days1': 'الاحد - الخميس',
      'footer.time1': '9 صباحاً - 12 ظهراً',
      'footer.days2': 'الجمعة - السبت',
      'footer.time2': '7 مساءً - 10 مساءً',
      'footer.contactTitle': 'التواصل',
      'footer.address': 'الرياض ، المملكة العربية السعودية',
      'footer.sectionsTitle': 'الأقسام',
      'footer.brandBlurb': 'أخصائية نفسية للأطفال والمراهقين في السعودية. أساعد الشباب والعائلات على إيجاد طريقهم.',
      'footer.copyright': '© ٢٠٢٥ د. دلال العصيمي. جميع الحقوق محفوظة.'
    },

    /* ══════════════════════ English ══════════════════════ */
    en: {
      dir: 'ltr',
      locale: 'en',
      name: 'English',

      'meta.title': 'Dr. Dalal Al-Osaimy — Child & Adolescent Psychologist',
      'meta.description': 'Child and adolescent psychologist in Riyadh. Evidence-based sessions helping children and families work through emotional challenges and build resilience. Book your consultation today.',
      'meta.ogTitle': 'Dr. Dalal Al-Osaimy — Child & Adolescent Psychologist',
      'meta.ogDescription': 'A safe space for young minds to grow. Book your consultation today.',

      'a11y.skip': 'Skip to booking',
      'a11y.primaryNav': 'Primary navigation',
      'a11y.menuOpen': 'Open menu',
      'a11y.menuClose': 'Close menu',

      'header.name': 'Dr. Dalal Al-Osaimy',
      'header.role': 'Psychologist',
      'header.logoAria': 'Dr. Dalal Al-Osaimy — home',
      'header.bookBtn': 'Book a session',

      'nav.about': 'About me',
      'nav.services': 'Services',
      'nav.testimonials': 'Stories',
      'nav.booking': 'Booking',

      'hero.pill': 'Child & adolescent psychology',
      'hero.title': 'A safe space for young minds to grow',
      'hero.lead': 'I work with children and teenagers — and their families — to help them move through emotional challenges, build resilience, and find their footing during these pivotal years.',
      'hero.ctaPrimary': 'Book a consultation',
      'hero.ctaSecondary': 'See how I work',
      'hero.stat1': 'certifications',
      'hero.stat2': 'consultations',
      'hero.stat3': 'years of experience',
      'hero.imgAlt': 'A mother holding her daughter during a warm moment',
      'hero.floatTitle': 'Evidence-based care',
      'hero.floatSub': 'Cognitive behavioural therapy',

      'services.eyebrow': 'What I offer',
      'services.title': 'Services shaped around every stage',
      'services.s1title': 'Anxiety, fears & OCD',
      'services.s1body': 'We work together to understand anxiety, fears and intrusive thoughts, and to build practical strategies that restore calm and a sense of safety in daily life.',
      'services.s2title': 'Mental health & mood',
      'services.s2body': 'Specialised psychological support for depression, mood swings, addiction, sleep difficulties, burnout and other mental health challenges.',
      'services.s3title': 'Personality disorders',
      'services.s3body': 'Understand your patterns of thinking, behaviour and relating to others, and build more balanced skills that improve relationships and quality of life.',
      'services.s4title': 'Marriage & couples counselling',
      'services.s4body': 'Guidance that helps couples communicate better, manage conflict, rebuild trust and affection, and make considered decisions about their future together.',
      'services.s5title': 'Children & adolescents',
      'services.s5body': 'Individual and family sessions supporting children and teenagers with emotional regulation, behaviour, school performance, and healthy relationships.',

      'about.eyebrow': 'About me',
      'about.title': 'I believe every child has the right to feel heard',
      'about.p1': 'With more than 15 years in child and adolescent psychology, I offer an evidence-based and circumstance-aware approach. My work starts from the understanding that mental health in the earliest years shapes the person we become.',
      'about.p2': 'I work with families from many different backgrounds, and offer sessions in both Arabic and English. My practice is a calm, comfortable place designed to put children at ease straight away.',
      'about.cred1': 'BSc in Psychology',
      'about.cred1sub': 'Buraydah Private Colleges',
      'about.cred2': 'MSc in Counselling Psychology',
      'about.cred2sub': 'King Saud University',
      'about.name': 'Dr. Dalal Al-Osaimy',
      'about.role': 'Psychologist',
      'about.imgAlt': 'Dr. Dalal Al-Osaimy with a child',

      'testimonials.eyebrow': 'Client stories',
      'testimonials.title': 'What families say',
      'testimonials.starsAria': 'Rated 5 out of 5',
      'testimonials.q1': '“Her support made a real difference for my daughter — she has become noticeably more confident in herself.”',
      'testimonials.n1': 'Mona Al-Jabri',
      'testimonials.r1': 'Mother of a teenager',
      'testimonials.q2': '“Our sessions helped me understand my son’s feelings much better, and he has become far more open about expressing himself.”',
      'testimonials.n2': 'Ali Al-Hassan',
      'testimonials.r2': 'Father of a student',
      'testimonials.q3': '“Interactive play strategies that develop children’s social skills, strengthening real communication and healthy relationships.”',
      'testimonials.n3': 'Sarah Al-Rifai',
      'testimonials.r3': 'Child psychologist',

      'booking.eyebrow': 'Booking',
      'booking.title': 'Book your consultation',
      'booking.note': 'Choose the date and time that suits your family. The first consultation lasts 50 minutes.',
      'booking.step1': 'Session type',
      'booking.step2': 'Choose a day',
      'booking.step3': 'Choose a time',
      'booking.step4': 'Confirm & pay',
      'booking.serviceLabel': 'Service',
      'booking.typeLabel': 'Session type',
      'booking.prevMonth': 'Previous month',
      'booking.nextMonth': 'Next month',
      'booking.nameLabel': 'Name',
      'booking.namePh': 'Full name',
      'booking.childLabel': 'Child’s name and age',
      'booking.childPh': 'Maha, 6 years old',
      'booking.emailLabel': 'Email address',
      'booking.reasonLabel': 'Reason for the session',
      'booking.reasonPh': 'Optional — helps me prepare for our first meeting',
      'booking.summaryLabel': 'Booking summary',
      'booking.summaryEmpty': 'Choose a session type, day and time',
      'booking.submit': 'Confirm booking & pay',
      'booking.submitNote': 'You will receive an email with your booking details within 24 hours',
      'booking.doneTitle': 'Your booking is confirmed',
      'booking.doneNote': 'You will receive an email with your booking details within 24 hours.',
      'booking.again': 'Book another appointment',

      'bk.pickDayFirst': 'Choose a day first to see available times.',
      'bk.noSlots': 'No times available on this day.',
      'bk.loadingSlots': 'Loading available times…',
      'bk.slotsError': 'Could not load times. Please try again.',
      'bk.taken': 'booked',
      'bk.unavailableDay': 'unavailable',
      'bk.tzNote': 'All times shown in Riyadh time',
      'bk.errName': 'Please enter your name.',
      'bk.errChild': 'Please enter the child’s name and age.',
      'bk.errEmail': 'Please enter your email address.',
      'bk.errEmailFormat': 'That email address does not look right.',
      'bk.errPickDay': 'Please choose a day.',
      'bk.errPickTime': 'Please choose a time.',
      'bk.errFields': 'Please fill in the required fields.',
      'bk.errSend': 'We could not complete the booking. Please try again or contact us directly.',
      'bk.errNetwork': 'Could not reach the server. Check your connection and try again.',
      'bk.errTaken': 'That time has just been taken. Please choose another.',
      'bk.currency': 'SAR',
      'bk.minutes': 'minutes',
      'bk.hour': '1 hour',
      'bk.hourHalf': '1.5 hours',
      'bk.halfHour': '30 minutes',
      'bk.am': 'AM',
      'bk.pm': 'PM',

      'bk.months': ['January','February','March','April','May','June','July','August','September','October','November','December'],
      'bk.dowShort': ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'],
      'bk.dowLong': ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],

      'svc.anxiety': 'Anxiety, fears & OCD',
      'svc.mood': 'Mental health & mood',
      'svc.personality': 'Personality disorders',
      'svc.marriage': 'Marriage & couples',
      'svc.children': 'Children & adolescents',

      'type.intro': 'Introductory session',
      'type.individual': 'Individual session',
      'type.family': 'Family session',
      'type.followup': 'Follow-up session',

      'footer.hoursTitle': 'Working hours',
      'footer.days1': 'Sunday – Thursday',
      'footer.time1': '9 AM – 12 PM',
      'footer.days2': 'Friday – Saturday',
      'footer.time2': '7 PM – 10 PM',
      'footer.contactTitle': 'Contact',
      'footer.address': 'Riyadh, Saudi Arabia',
      'footer.sectionsTitle': 'Sections',
      'footer.brandBlurb': 'Child and adolescent psychologist in Saudi Arabia. I help young people and families find their way.',
      'footer.copyright': '© 2025 Dr. Dalal Al-Osaimy. All rights reserved.'
    }
  };

  var ORDER = ['ar', 'en'];
  var DEFAULT = 'ar';
  var STORAGE = 'drdalal.lang';

  /* Set to true to open in the visitor's browser language instead of
     always starting in Arabic. A visitor who uses the switch always
     gets their own choice back on the next visit either way. */
  var DETECT_FROM_BROWSER = false;

  function pickInitial() {
    var stored;
    try { stored = window.localStorage.getItem(STORAGE); } catch (e) { stored = null; }
    if (stored && DICT[stored]) return stored;

    if (DETECT_FROM_BROWSER) {
      var nav = (navigator.language || '').toLowerCase();
      if (nav.indexOf('ar') === 0) return 'ar';
      if (nav.indexOf('en') === 0) return 'en';
    }
    return DEFAULT;
  }

  var current = pickInitial();
  var listeners = [];

  /* Set direction before first paint — no flash of the wrong layout. */
  document.documentElement.lang = current;
  document.documentElement.dir = DICT[current].dir;

  function t(key) {
    var pack = DICT[current];
    if (pack && Object.prototype.hasOwnProperty.call(pack, key)) return pack[key];
    var fb = DICT[DEFAULT];
    if (fb && Object.prototype.hasOwnProperty.call(fb, key)) return fb[key];
    return key;             /* surfaces missing keys instead of blanking the UI */
  }

  var ATTRS = {
    'data-i18n-placeholder': 'placeholder',
    'data-i18n-aria-label': 'aria-label',
    'data-i18n-alt': 'alt',
    'data-i18n-content': 'content',
    'data-i18n-title': 'title'
  };

  function apply() {
    var pack = DICT[current];
    document.documentElement.lang = current;
    document.documentElement.dir = pack.dir;

    var nodes = document.querySelectorAll('[data-i18n]'), i;
    for (i = 0; i < nodes.length; i++) {
      nodes[i].textContent = t(nodes[i].getAttribute('data-i18n'));
    }

    Object.keys(ATTRS).forEach(function (dataAttr) {
      var list = document.querySelectorAll('[' + dataAttr + ']'), j;
      for (j = 0; j < list.length; j++) {
        list[j].setAttribute(ATTRS[dataAttr], t(list[j].getAttribute(dataAttr)));
      }
    });

    /* og:locale mirrors the active language */
    var og = document.querySelector('meta[property="og:locale"]');
    if (og) og.setAttribute('content', current === 'ar' ? 'ar_SA' : 'en_US');

    for (i = 0; i < listeners.length; i++) listeners[i](current);
  }

  function set(lang) {
    if (!DICT[lang] || lang === current) return;
    current = lang;
    try { window.localStorage.setItem(STORAGE, lang); } catch (e) { /* private mode */ }
    apply();
  }

  function next() {
    return ORDER[(ORDER.indexOf(current) + 1) % ORDER.length];
  }

  window.Lang = {
    t: t,
    set: set,
    next: next,
    get current() { return current; },
    get dir() { return DICT[current].dir; },
    nameOf: function (code) { return DICT[code] ? DICT[code].name : code; },
    /** Register a callback fired on every language change (and once at boot). */
    onChange: function (fn) { listeners.push(fn); },
    apply: apply
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', apply);
  } else {
    apply();
  }
})();
