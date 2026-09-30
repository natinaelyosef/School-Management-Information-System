import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  Laptop,
  Library as LibraryIcon,
  MapPin,
  MessageSquare,
  Microscope,
  Phone,
  School,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Users,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import Card from '../../components/ui/Card';
import Badge from '../../components/ui/Badge';
import { useSchool } from '../../stores/SchoolContext';
import { fetchPublicEvents, fetchPublicNews, fetchPublicTeachers } from '../../api/public';
import { formatDate } from '../../utils/format';

const PROGRAMS = [
  {
    key: 'preschool',
    to: '/preschool',
    icon: Sparkles,
    titleKey: 'nav.preschool',
    stageBadge: 'Early Discovery',
    ages: 'Ages 3–5',
    image: '/images/preschool.jpg',
    bodyKey: 'home.programPreschool',
    highlights: [
      'Phonics & early literacy development',
      'Play-based numeracy & motor skills',
      'Creative arts, music & storytelling',
      'Small classes with dedicated assistants',
    ],
  },
  {
    key: 'middle',
    to: '/middle',
    icon: BookOpen,
    titleKey: 'nav.middle',
    stageBadge: 'Inquiry & Growth',
    ages: 'Grades 1–8',
    image: '/images/middle_school.jpg',
    bodyKey: 'home.programMiddle',
    highlights: [
      'Core STEM & mathematics foundation',
      'Interactive science & digital literacy',
      'Language arts, debate & civics',
      'Termly parent conferences & feedback',
    ],
  },
  {
    key: 'high',
    to: '/high',
    icon: Award,
    titleKey: 'nav.high',
    stageBadge: 'College Preparatory',
    ages: 'Grades 9–12',
    image: '/images/high_school.jpg',
    bodyKey: 'home.programHigh',
    highlights: [
      'University entrance examination mastery',
      'Advanced chemistry, biology & physics labs',
      'National olympiad & coding mentorship',
      'Career advisory & leadership coaching',
    ],
  },
];

const FACILITIES = [
  {
    id: 'labs',
    titleKey: 'home.facilityLabTitle',
    descKey: 'home.facilityLabDesc',
    image: '/images/high_school.jpg',
    icon: Microscope,
    tags: ['Modern Equipment', 'Digital Microscopes', 'Robotics Hub'],
  },
  {
    id: 'library',
    titleKey: 'home.facilityLibraryTitle',
    descKey: 'home.facilityLibraryDesc',
    image: '/images/library.jpg',
    icon: LibraryIcon,
    tags: ['10,000+ Volumes', 'Quiet Study Pods', 'Digital Research'],
  },
  {
    id: 'sports',
    titleKey: 'home.facilitySportsTitle',
    descKey: 'home.facilitySportsDesc',
    image: '/images/sports.jpg',
    icon: Trophy,
    tags: ['All-Weather Track', 'Football Pitch', 'Athletics Coaching'],
  },
  {
    id: 'early_learning',
    titleKey: 'home.facilityPreschoolTitle',
    descKey: 'home.facilityPreschoolDesc',
    image: '/images/preschool.jpg',
    icon: Sparkles,
    tags: ['Montessori Play', 'Sensory Materials', 'Safe Courtyard'],
  },
];

const WHY_US = [
  {
    key: 'academics',
    num: '01',
    icon: GraduationCap,
    titleKey: 'home.whyAcademics',
    bodyKey: 'home.whyAcademicsBody',
    color: 'from-blue-600 to-indigo-600',
    stat: '98%',
    statLabel: 'University Pass Rate',
  },
  {
    key: 'character',
    num: '02',
    icon: ShieldCheck,
    titleKey: 'home.whyCharacter',
    bodyKey: 'home.whyCharacterBody',
    color: 'from-emerald-600 to-teal-600',
    stat: '100%',
    statLabel: 'Values-Led Education',
  },
  {
    key: 'tech',
    num: '03',
    icon: Laptop,
    titleKey: 'home.whyTech',
    bodyKey: 'home.whyTechBody',
    color: 'from-violet-600 to-purple-600',
    stat: '1:1',
    statLabel: 'Smart Tech Access',
  },
  {
    key: 'care',
    num: '04',
    icon: HeartHandshake,
    titleKey: 'home.whyCare',
    bodyKey: 'home.whyCareBody',
    color: 'from-amber-500 to-rose-500',
    stat: '1:12',
    statLabel: 'Teacher-Student Ratio',
  },
];

const TESTIMONIALS = [
  {
    id: 1,
    name: 'Dr. Aster Alemayehu',
    role: 'Parent of Grade 4 & Grade 9 Students',
    quote:
      'Bright Future Academy has provided our children with both exceptional academic rigour and genuine moral mentorship. The faculty knows each child personally and nurtures their unique strengths.',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=256&q=80',
    initials: 'AA',
  },
  {
    id: 2,
    name: 'Dawit Kebede',
    role: 'Alumni · Class of 2024 (Engineering Scholar)',
    quote:
      'The modern science labs and coding competitions gave me the practical confidence I needed. I entered university at the top of my class thanks to teachers who truly believed in me.',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    initials: 'DK',
  },
  {
    id: 3,
    name: 'Marcus & Helen Vance',
    role: 'Kindergarten & Grade 2 Parents',
    quote:
      'Seeing our daughter eagerly rush to school every single morning is the greatest testament to the teachers. The atmosphere is warm, disciplined, creative, and inspiring.',
    rating: 5,
    avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80',
    initials: 'HV',
  },
];

const GALLERY_ITEMS = [
  {
    id: 1,
    title: 'Vibrant Campus Life',
    category: 'Campus Community',
    image: '/images/hero.jpg',
    span: 'md:col-span-2 lg:col-span-2',
  },
  {
    id: 2,
    title: 'Advanced Science Research',
    category: 'STEM & Labs',
    image: '/images/high_school.jpg',
    span: 'col-span-1',
  },
  {
    id: 3,
    title: 'Architectural Library Commons',
    category: 'Academic Commons',
    image: '/images/library.jpg',
    span: 'col-span-1',
  },
  {
    id: 4,
    title: 'Athletics & Track Competitions',
    category: 'Sports & Spirit',
    image: '/images/sports.jpg',
    span: 'md:col-span-2 lg:col-span-2',
  },
  {
    id: 5,
    title: 'Collaborative Group Study',
    category: 'Middle School',
    image: '/images/middle_school.jpg',
    span: 'col-span-1',
  },
  {
    id: 6,
    title: 'Joyful Early Discovery',
    category: 'Pre-School',
    image: '/images/preschool.jpg',
    span: 'col-span-1',
  },
];

export default function Home() {
  const { t } = useTranslation();
  const { name, motto, stats, established, address, phone, email } = useSchool();
  const [activeTab, setActiveTab] = useState<'all' | 'academics' | 'athletics' | 'early'>('all');

  const newsQ = useQuery({
    queryKey: ['public-news', 1],
    queryFn: () => fetchPublicNews(1),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const eventsQ = useQuery({
    queryKey: ['public-events', 1],
    queryFn: () => fetchPublicEvents(1),
    staleTime: 5 * 60_000,
    retry: 1,
  });
  const teachersQ = useQuery({
    queryKey: ['public-teachers', 1],
    queryFn: () => fetchPublicTeachers(1),
    staleTime: 5 * 60_000,
    retry: 1,
  });

  const news = (newsQ.data ?? []).slice(0, 3);
  const events = (eventsQ.data ?? []).slice(0, 3);
  const teachers = (teachersQ.data ?? []).slice(0, 4);

  const figures = [
    {
      k: stats.students || '2,400+',
      v: t('nav.students'),
      icon: Users,
      desc: 'Active young learners',
      gradient: 'from-blue-500/20 to-indigo-500/20',
      iconColor: 'text-blue-500',
    },
    {
      k: stats.teachers || '120+',
      v: t('public.expertTeachers'),
      icon: GraduationCap,
      desc: 'Certified educators',
      gradient: 'from-emerald-500/20 to-teal-500/20',
      iconColor: 'text-emerald-500',
    },
    {
      k: stats.levels || 'K-12 (3 Stages)',
      v: t('public.levels'),
      icon: School,
      desc: 'Holistic curriculum',
      gradient: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-500',
    },
    {
      k: established ? `Est. ${established}` : stats.years || '20+ Years',
      v: t('public.yearsExcellence'),
      icon: Award,
      desc: 'Academic legacy',
      gradient: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-500',
    },
  ];

  const filteredGallery =
    activeTab === 'all'
      ? GALLERY_ITEMS
      : activeTab === 'academics'
      ? GALLERY_ITEMS.filter((g) => g.id === 2 || g.id === 3 || g.id === 5)
      : activeTab === 'athletics'
      ? GALLERY_ITEMS.filter((g) => g.id === 1 || g.id === 4)
      : GALLERY_ITEMS.filter((g) => g.id === 6 || g.id === 5);

  return (
    <div className="overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ---------------- 1. Hero Section ---------------- */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-blue-950 to-slate-900 text-white pt-10 pb-20 lg:pt-16 lg:pb-28">
        {/* Ambient atmospheric lighting */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 top-0 h-96 w-96 rounded-full bg-blue-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 bottom-10 h-96 w-96 rounded-full bg-indigo-500/15 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/3 -translate-x-1/2 h-72 w-72 rounded-full bg-sky-400/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid items-center gap-12 lg:grid-cols-12 lg:gap-8">
            {/* Left text column */}
            <div className="lg:col-span-7 space-y-6">
              {/* Admissions Announcement Badge */}
              <div className="inline-flex items-center gap-2.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-200 backdrop-blur-md shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>{t('home.admissionsOpen')}</span>
                <span className="text-blue-400/60">|</span>
                <span className="text-blue-300">2026/27 Session</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl leading-[1.15]">
                {motto ? (
                  <span className="block">{motto}</span>
                ) : (
                  <>
                    <span className="block text-white">{t('home.heroLine1')}</span>
                    <span className="block bg-gradient-to-r from-blue-300 via-indigo-200 to-sky-300 bg-clip-text text-transparent">
                      {t('home.heroLine2')}
                    </span>
                  </>
                )}
              </h1>

              {/* Lead Paragraph */}
              <p className="max-w-2xl text-sm sm:text-lg text-slate-300 leading-relaxed font-normal">
                {t('home.heroBody', { name })}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2.5 sm:gap-3.5 pt-2">
                <Link
                  to="/apply"
                  className="group inline-flex w-full sm:w-auto items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 px-6 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02] hover:shadow-blue-500/40 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  <span>{t('public.apply')}</span>
                  <ArrowRight size={17} className="transition-transform group-hover:translate-x-1" />
                </Link>

                <Link
                  to="/track"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-5 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:bg-white/20 hover:border-white/40"
                >
                  <CalendarDays size={17} className="text-blue-300" />
                  <span>{t('public.track')}</span>
                </Link>

                <Link
                  to="/about"
                  className="inline-flex items-center gap-1.5 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-300 transition hover:text-white hover:bg-white/5"
                >
                  <span>{t('public.about')}</span>
                  <ChevronRight size={16} />
                </Link>
              </div>

              {/* Campus Highlights / Quick Contact Pills */}
              <div className="pt-4 border-t border-white/10 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-300">
                {address && (
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500/20 text-blue-300">
                      <MapPin size={13} />
                    </span>
                    <span>{address}</span>
                  </div>
                )}
                {phone && (
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500/20 text-indigo-300">
                      <Phone size={13} />
                    </span>
                    <span>{phone}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-amber-300 font-medium">
                  <Star size={14} className="fill-amber-400 text-amber-400" />
                  <span>Accredited Academic Excellence</span>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Image Centerpiece with Floating Badges */}
            <div className="lg:col-span-5 relative">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Glow ring */}
                <div className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-blue-500 to-indigo-500 opacity-30 blur-xl transition duration-1000 group-hover:opacity-100" />

                {/* Main Hero Photo */}
                <div className="relative overflow-hidden rounded-3xl border border-white/15 bg-slate-900/60 shadow-2xl backdrop-blur-sm">
                  <img
                    src="/images/hero.jpg"
                    alt={`${name} Students on Campus`}
                    className="h-[260px] sm:h-[380px] lg:h-[440px] w-full object-cover object-center transition-transform duration-700 hover:scale-105"
                    loading="eager"
                  />

                  {/* Gradient shadow overlay for badge readability */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-black/20 pointer-events-none" />

                  {/* Floating Badge 1: Top Right Rating */}
                  <div className="absolute top-4 right-4 rounded-2xl border border-white/20 bg-slate-900/85 px-3.5 py-2.5 shadow-xl backdrop-blur-md">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="mt-1 text-[11px] font-bold text-white tracking-wide">
                      Top-Rated K-12 Academy
                    </p>
                  </div>

                  {/* Floating Badge 2: Bottom Left University Acceptance */}
                  <div className="absolute bottom-4 left-4 right-4 sm:right-auto rounded-2xl border border-white/20 bg-slate-900/90 p-3.5 shadow-2xl backdrop-blur-md flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
                      <GraduationCap size={22} />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-base font-extrabold text-white">98% Pass Rate</span>
                        <CheckCircle2 size={14} className="text-emerald-400" />
                      </div>
                      <p className="text-[11px] text-slate-300">University entrance qualification</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- 2. Impact Figures Strip ---------------- */}
      <section className="relative z-10 -mt-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4 sm:gap-5">
          {figures.map((s) => (
            <div
              key={s.v}
              className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 p-5 shadow-lg shadow-slate-200/50 backdrop-blur-sm transition-all hover:-translate-y-1 hover:shadow-xl hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900/95 dark:shadow-black/40 dark:hover:border-blue-700"
            >
              <div className="flex items-center justify-between">
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} ${s.iconColor}`}
                >
                  <s.icon size={20} />
                </span>
                <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">Live</span>
              </div>
              <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white sm:text-3xl tracking-tight">
                {s.k}
              </p>
              <p className="font-semibold text-xs text-slate-700 dark:text-slate-200 mt-0.5">{s.v}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 3. Academic Programs / Pathways with Rich Images ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto">
          <Badge tone="blue">Academic Pathways</Badge>
          <h2 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl tracking-tight">
            {t('home.programsTitle')}
          </h2>
          <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
            {t('home.programsSubtitle')}
          </p>
        </div>

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {PROGRAMS.map((p) => (
            <div
              key={p.key}
              className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-400 hover:shadow-xl dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
            >
              {/* Image with zoom and badge overlays */}
              <div className="relative h-56 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                <img
                  src={p.image}
                  alt={t(p.titleKey)}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-108"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />

                {/* Stage tag */}
                <div className="absolute top-3 left-3 rounded-full bg-slate-950/70 px-3 py-1 text-xs font-semibold text-white backdrop-blur-md border border-white/20">
                  {p.stageBadge}
                </div>

                {/* Age pill */}
                <div className="absolute bottom-3 left-3 rounded-full bg-blue-600 px-3 py-0.5 text-xs font-bold text-white shadow-sm">
                  {p.ages}
                </div>
              </div>

              {/* Card Body */}
              <div className="flex flex-1 flex-col p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/80 dark:text-blue-300">
                    <p.icon size={20} />
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                    {t(p.titleKey)}
                  </h3>
                </div>

                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {t(p.bodyKey)}
                </p>

                {/* Highlights List */}
                <ul className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-300">
                  {p.highlights.map((h, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>

                {/* Action Link */}
                <div className="mt-6 pt-2">
                  <Link
                    to={p.to}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-50 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:bg-slate-800 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white"
                  >
                    <span>{t('auth.readMore')}</span>
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 4. World-Class Campus & Modern Facilities ---------------- */}
      <section className="bg-slate-100/70 py-20 dark:bg-slate-900/60 border-y border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <Badge tone="purple">Campus Environment</Badge>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl tracking-tight">
              {t('home.campusFacilitiesTitle')}
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              {t('home.campusFacilitiesSubtitle')}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FACILITIES.map((facility) => (
              <div
                key={facility.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
              >
                {/* Facility Image */}
                <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={facility.image}
                    alt={t(facility.titleKey)}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/90 text-blue-700 shadow-md backdrop-blur-sm dark:bg-slate-900/90 dark:text-blue-300">
                    <facility.icon size={18} />
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {t(facility.titleKey)}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                    {t(facility.descKey)}
                  </p>

                  {/* Feature chips */}
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {facility.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 5. Why Families Choose Us (Pillars) ---------------- */}
      <section className="bg-white py-20 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <Badge tone="blue">Pillars of Distinction</Badge>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl tracking-tight">
              {t('home.whyTitle')}
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              {t('home.whySubtitle', { name })}
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {WHY_US.map((w) => (
              <div
                key={w.key}
                className="group relative flex flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-blue-400 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-600"
              >
                {/* Header with Icon and Step Number */}
                <div className="flex items-center justify-between">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${w.color} text-white shadow-md`}
                  >
                    <w.icon size={22} />
                  </span>
                  <span className="text-2xl font-black text-slate-200 dark:text-slate-800">
                    {w.num}
                  </span>
                </div>

                <h3 className="mt-5 text-lg font-bold text-slate-900 dark:text-white">
                  {t(w.titleKey)}
                </h3>
                <p className="mt-2 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
                  {t(w.bodyKey)}
                </p>

                {/* Micro stat footer */}
                <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between dark:border-slate-800">
                  <span className="text-xs text-slate-400 dark:text-slate-500">{w.statLabel}</span>
                  <span className="font-extrabold text-sm text-blue-600 dark:text-blue-400">
                    {w.stat}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 6. Campus Life & Memories Photo Mosaic ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Badge tone="green">Campus Life</Badge>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl tracking-tight">
              {t('home.galleryTitle')}
            </h2>
            <p className="mt-2 text-base text-slate-600 dark:text-slate-400">
              {t('home.gallerySubtitle')}
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'All Photos' },
              { id: 'academics', label: 'STEM & Labs' },
              { id: 'athletics', label: 'Sports & Spirit' },
              { id: 'early', label: 'Early Years' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Mosaic Grid */}
        <div className="mt-8 grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filteredGallery.map((item) => (
            <div
              key={item.id}
              className={`group relative overflow-hidden rounded-2xl bg-slate-900 shadow-md ${item.span} h-64`}
            >
              <img
                src={item.image}
                alt={item.title}
                className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-108"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent opacity-80 transition-opacity group-hover:opacity-90" />

              <div className="absolute bottom-4 left-4 right-4">
                <span className="inline-block rounded-md bg-blue-600/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                  {item.category}
                </span>
                <h4 className="mt-1 text-base font-bold text-white drop-shadow-sm">
                  {item.title}
                </h4>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- 7. Testimonials (Voices of Our Community) ---------------- */}
      <section className="bg-slate-100/70 py-20 dark:bg-slate-900/60 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto">
            <Badge tone="yellow">Community Trust</Badge>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl tracking-tight">
              {t('home.testimonialsTitle')}
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-400">
              {t('home.testimonialsSubtitle', { name })}
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <div
                key={item.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-slate-800 dark:bg-slate-900"
              >
                <div>
                  {/* Star Rating */}
                  <div className="flex items-center gap-1 text-amber-400">
                    {[...Array(item.rating)].map((_, i) => (
                      <Star key={i} size={15} className="fill-amber-400 text-amber-400" />
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="mt-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300 italic">
                    "{item.quote}"
                  </p>
                </div>

                {/* Author Info */}
                <div className="mt-6 flex items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs ring-2 ring-blue-500/20">
                    <img
                      src={item.avatar}
                      alt={item.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        // Fallback gracefully to initials if network image unavailable
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                    <span>{item.initials}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {item.name}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{item.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------- 8. Quick Access Services ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white sm:text-3xl">
            {t('home.quickAccessTitle')}
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {t('home.quickAccessSubtitle')}
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              to: '/apply',
              icon: GraduationCap,
              titleKey: 'home.quickApply',
              bodyKey: 'home.quickApplyBody',
              badge: 'Admissions Open',
            },
            {
              to: '/track',
              icon: CalendarDays,
              titleKey: 'home.quickTrack',
              bodyKey: 'home.quickTrackBody',
              badge: 'Online Portal',
            },
            {
              to: '/teachers',
              icon: Users,
              titleKey: 'home.quickTeachers',
              bodyKey: 'home.quickTeachersBody',
              badge: 'Meet Faculty',
            },
            {
              to: '/contact',
              icon: MessageSquare,
              titleKey: 'home.quickContact',
              bodyKey: 'home.quickContactBody',
              badge: 'Help Desk',
            },
          ].map((q) => (
            <Link
              key={q.to + q.titleKey}
              to={q.to}
              className="group flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-600"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white dark:bg-blue-950/80 dark:text-blue-300 dark:group-hover:bg-blue-600 dark:group-hover:text-white">
                    <q.icon size={20} />
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                    {q.badge}
                  </span>
                </div>
                <h4 className="mt-4 font-bold text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                  {t(q.titleKey)}
                </h4>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t(q.bodyKey)}</p>
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                <span>Access Now</span>
                <ChevronRight size={14} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- 9. Teachers & Faculty ---------------- */}
      <section className="bg-white py-20 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Badge tone="blue">{t('public.teachers')}</Badge>
              <h2 className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white sm:text-4xl">
                Our Distinguished Faculty
              </h2>
              <p className="mt-2 text-slate-500 dark:text-slate-400 text-sm">
                {t('home.teachersSubtitle', { count: stats.teachers || '120+' })}
              </p>
            </div>
            <Link
              to="/teachers"
              className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <span>{t('home.viewAll')}</span>
              <ArrowRight size={16} />
            </Link>
          </div>

          {teachersQ.isError ? (
            <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              {t('home.teachersUnavailable')}
            </p>
          ) : teachers.length === 0 && !teachersQ.isPending ? (
            <p className="mt-6 rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
              {t('home.teachersEmpty')}
            </p>
          ) : (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {teachers.map((teacher, index) => {
                const initials = `${teacher.first_name?.[0] ?? ''}${teacher.last_name?.[0] ?? ''}`;
                const colors = [
                  'from-blue-500 to-indigo-600',
                  'from-emerald-500 to-teal-600',
                  'from-purple-500 to-violet-600',
                  'from-amber-500 to-orange-600',
                ];
                const gradient = colors[index % colors.length];

                return (
                  <div
                    key={teacher.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div
                      className={`mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${gradient} text-white font-extrabold text-lg shadow-md group-hover:scale-105 transition-transform`}
                    >
                      {initials || <Users size={24} />}
                    </div>
                    <p className="mt-4 font-bold text-base text-slate-900 dark:text-white">
                      {teacher.first_name} {teacher.last_name}
                    </p>
                    {teacher.specialization ? (
                      <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 mt-1">
                        {teacher.specialization}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1">Faculty Educator</p>
                    )}
                    {teacher.qualification && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        {teacher.qualification}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ---------------- 10. News & Events ---------------- */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Latest News */}
          <Card
            title={t('home.latestNews')}
            subtitle={t('home.newsSubtitle')}
            action={
              <Link
                to="/news"
                className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <span>{t('home.viewAll')}</span>
                <ArrowRight size={14} />
              </Link>
            }
          >
            {news.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('common.noResults')}
              </p>
            ) : (
              <ul className="space-y-3.5 text-sm">
                {news.map((item) => (
                  <li
                    key={item.id}
                    className="group rounded-xl border border-slate-200 p-4 transition hover:border-blue-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-slate-900 group-hover:text-blue-600 dark:text-slate-100 dark:group-hover:text-blue-400 transition">
                        {item.title}
                      </p>
                      {item.is_pinned && (
                        <span className="shrink-0 rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                          Notice
                        </span>
                      )}
                    </div>
                    {item.body && (
                      <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                        {item.body}
                      </p>
                    )}
                    {item.published_at && (
                      <p className="mt-2 text-[11px] font-medium text-slate-400 dark:text-slate-500">
                        {formatDate(item.published_at)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Upcoming Events */}
          <Card
            title={t('home.upcomingEvents')}
            subtitle={t('home.eventsSubtitle')}
            action={
              <Link
                to="/events"
                className="inline-flex items-center gap-1 text-sm font-bold text-blue-700 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
              >
                <span>{t('home.viewAll')}</span>
                <ArrowRight size={14} />
              </Link>
            }
          >
            {events.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {t('common.noResults')}
              </p>
            ) : (
              <ul className="space-y-3.5 text-sm">
                {events.map((event) => (
                  <li
                    key={event.id}
                    className="flex gap-4 rounded-xl border border-slate-200 p-3.5 transition hover:border-blue-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
                  >
                    {/* Date Block */}
                    <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm">
                      <span className="text-[10px] uppercase font-bold tracking-wider leading-none">
                        {new Date(event.starts_at).toLocaleString(undefined, { month: 'short' })}
                      </span>
                      <span className="text-lg font-black leading-tight mt-0.5">
                        {new Date(event.starts_at).getDate()}
                      </span>
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-slate-900 dark:text-slate-100">
                        {event.title}
                      </span>
                      {event.location && (
                        <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                          <MapPin size={13} className="text-blue-500 shrink-0" />
                          <span>{event.location}</span>
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </section>

      {/* ---------------- 11. Admissions & Campus Visit CTA Banner ---------------- */}
      <section className="relative overflow-hidden bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 py-16 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -bottom-20 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl"
        />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start justify-between gap-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <Badge tone="yellow">Join Our Family</Badge>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
                {t('home.visitTitle', { name })}
              </h2>
              <p className="mt-3 text-base text-blue-100 leading-relaxed">
                Take the first step toward giving your child a world-class education rooted in
                academic excellence, innovation, and character.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-blue-200">
                {address && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin size={13} /> {address}
                  </span>
                )}
                {phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone size={13} /> {phone}
                  </span>
                )}
                {email && (
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare size={13} /> {email}
                  </span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3.5">
              <Link
                to="/apply"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-7 py-3.5 font-bold text-blue-900 shadow-xl transition-all hover:bg-blue-50 hover:scale-[1.02]"
              >
                <School size={18} />
                <span>{t('public.apply')}</span>
              </Link>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 py-3.5 font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                <MessageSquare size={18} />
                <span>{t('public.contact')}</span>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
