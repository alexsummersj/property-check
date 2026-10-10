import React, { useState, useEffect } from 'react';
import { 
  Building2, Search, Shield, TrendingUp, Globe, FileText, 
  CheckCircle, ArrowRight, Star, Zap, BarChart3, Upload,
  ChevronRight, Play, Menu, X
} from 'lucide-react';
import { useT, LanguageSelector } from './i18n/LanguageContext';

const LandingPage = ({ onEnterApp }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null); // 'privacy' | 'terms'
  const t = useT();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const LEGAL = {
    privacy: {
      title: t('landing.legal.privacyTitle'),
      body: [1, 2, 3, 4].map((i) => t(`landing.legal.privacy${i}`))
    },
    terms: {
      title: t('landing.legal.termsTitle'),
      body: [1, 2, 3, 4].map((i) => t(`landing.legal.terms${i}`))
    }
  };

  const features = [
    {
      icon: <Upload className="w-8 h-8" />,
      title: t('landing.features.i1title'),
      description: t('landing.features.i1desc')
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: t('landing.features.i2title'),
      description: t('landing.features.i2desc')
    },
    {
      icon: <Globe className="w-8 h-8" />,
      title: t('landing.features.i3title'),
      description: t('landing.features.i3desc')
    },
    {
      icon: <BarChart3 className="w-8 h-8" />,
      title: t('landing.features.i4title'),
      description: t('landing.features.i4desc')
    }
  ];

  const steps = [
    {
      number: "01",
      title: t('landing.how.s1title'),
      description: t('landing.how.s1desc')
    },
    {
      number: "02", 
      title: t('landing.how.s2title'),
      description: t('landing.how.s2desc')
    },
    {
      number: "03",
      title: t('landing.how.s3title'),
      description: t('landing.how.s3desc')
    }
  ];

  const testimonials = [
    {
      text: t('landing.testimonials.t1text'),
      author: t('landing.testimonials.t1author'),
      role: t('landing.testimonials.t1role'),
      rating: 5
    },
    {
      text: t('landing.testimonials.t2text'),
      author: t('landing.testimonials.t2author'),
      role: t('landing.testimonials.t2role'),
      rating: 5
    },
    {
      text: t('landing.testimonials.t3text'),
      author: t('landing.testimonials.t3author'),
      role: t('landing.testimonials.t3role'),
      rating: 5
    }
  ];

  const pricingPlans = [
    {
      name: t('landing.pricing.free'),
      price: t('landing.pricing.freePrice'),
      period: t('landing.pricing.freePeriod'),
      features: [1, 2, 3, 4].map((i) => t(`landing.pricing.f${i}`)),
      cta: t('landing.pricing.freeCta'),
      popular: false
    },
    {
      name: t('landing.pricing.pro'),
      price: t('landing.pricing.proPrice'),
      period: t('landing.pricing.proPeriod'),
      features: [1, 2, 3, 4, 5, 6].map((i) => t(`landing.pricing.p${i}`)),
      cta: t('landing.pricing.proCta'),
      popular: true
    },
    {
      name: t('landing.pricing.ent'),
      price: t('landing.pricing.entPrice'),
      period: "",
      features: [1, 2, 3, 4, 5, 6].map((i) => t(`landing.pricing.e${i}`)),
      cta: t('landing.pricing.entCta'),
      popular: false
    }
  ];

  const stats = [
    { value: "10K+", label: t('landing.stats.s1') },
    { value: "50+", label: t('landing.stats.s2') },
    { value: "13", label: t('landing.stats.s3') },
    { value: "98%", label: t('landing.stats.s4') }
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled ? 'bg-slate-950/95 backdrop-blur-md shadow-lg' : 'bg-transparent'
      }`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">Property Check</span>
            </div>
            
            {/* Desktop Menu */}
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-gray-300 hover:text-white transition">{t('landing.nav.features')}</a>
              <a href="#how-it-works" className="text-gray-300 hover:text-white transition">{t('landing.nav.how')}</a>
              <a href="#pricing" className="text-gray-300 hover:text-white transition">{t('landing.nav.pricing')}</a>
            </div>

            <div className="hidden md:flex items-center gap-4">
              <LanguageSelector />
              <button 
                onClick={onEnterApp}
                className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-medium transition-all hover:shadow-lg hover:shadow-purple-500/25"
              >
                {t('landing.nav.tryFree')}
              </button>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden p-2"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pb-4 border-t border-white/10 pt-4">
              <div className="flex flex-col gap-4">
                <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition">{t('landing.nav.features')}</a>
                <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition">{t('landing.nav.how')}</a>
                <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="text-gray-300 hover:text-white transition">{t('landing.nav.pricing')}</a>
                <button 
                  onClick={() => { setMobileMenuOpen(false); onEnterApp(); }}
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-medium w-full"
                >
                  {t('landing.nav.tryFree')}
                </button>
                <LanguageSelector />
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
        </div>

        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full text-sm mb-8 border border-white/10">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>{t('landing.hero.badge')}</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
              {t('landing.hero.title1')}
              <span className="block bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                {t('landing.hero.title2')}
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 mb-10 max-w-2xl mx-auto">
              {t('landing.hero.subtitle')}
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <button 
                onClick={onEnterApp}
                className="group px-8 py-4 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-semibold text-lg transition-all hover:shadow-xl hover:shadow-purple-500/25 flex items-center gap-2"
              >
                {t('landing.hero.ctaPrimary')}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
              <button className="px-8 py-4 bg-white/10 hover:bg-white/20 rounded-xl font-semibold text-lg transition-all flex items-center gap-2 border border-white/10">
                <Play className="w-5 h-5" />
                {t('landing.hero.ctaDemo')}
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-3xl mx-auto">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                    {stat.value}
                  </div>
                  <div className="text-gray-500 text-sm mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Hero Image/Screenshot */}
          <div className="mt-20 relative">
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent z-10 pointer-events-none" />
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="bg-slate-800 px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="ml-4 text-sm text-gray-400">property-check.com</span>
              </div>
              <div className="p-8 bg-gradient-to-br from-slate-900 via-blue-900/20 to-slate-900">
                <div className="grid md:grid-cols-3 gap-6">
                  {/* Property Card Preview */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-semibold">{t('landing.demo.villa')}</h3>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded-full text-xs">{t('landing.demo.lowRisk')}</span>
                    </div>
                    <p className="text-sm text-gray-400 mb-4">{t('landing.demo.location')}</p>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('landing.demo.price')}</span>
                      <span className="text-green-400 font-semibold">{t('landing.demo.priceValue')}</span>
                    </div>
                  </div>
                  
                  {/* Risk Score Preview */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 className="font-semibold mb-4">{t('landing.demo.riskScore')}</h3>
                    <div className="flex items-center gap-4 mb-4">
                      <div className="text-4xl font-bold text-green-400">28%</div>
                      <div className="text-sm text-gray-400">{t('landing.demo.lowRisk')}<br/>{t('landing.demo.investment')}</div>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full w-[28%] bg-gradient-to-r from-green-500 to-green-400 rounded-full" />
                    </div>
                  </div>

                  {/* Analysis Preview */}
                  <div className="bg-white/5 rounded-xl p-6 border border-white/10">
                    <h3 className="font-semibold mb-4">{t('landing.demo.aiAnalysis')}</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-gray-300">{t('landing.demo.pro1')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <span className="text-gray-300">{t('landing.demo.pro2')}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-yellow-400" />
                        <span className="text-gray-300">{t('landing.demo.warn')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('landing.features.title1')}
              <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                {t('landing.features.title2')}
              </span>
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('landing.features.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index}
                className="group p-8 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/10 hover:border-purple-500/50 transition-all hover:shadow-xl hover:shadow-purple-500/10"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-6 bg-gradient-to-b from-transparent via-blue-950/20 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('landing.how.title')}
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('landing.how.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 relative">
            {/* Connection Line */}
            <div className="hidden md:block absolute top-24 left-1/4 right-1/4 h-0.5 bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500" />
            
            {steps.map((step, index) => (
              <div key={index} className="relative text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-2xl font-bold relative z-10">
                  {step.number}
                </div>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-gray-400">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('landing.testimonials.title')}
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('landing.testimonials.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div 
                key={index}
                className="p-8 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/10"
              >
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-300 mb-6 text-lg">"{testimonial.text}"</p>
                <div>
                  <div className="font-semibold">{testimonial.author}</div>
                  <div className="text-gray-500 text-sm">{testimonial.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6 bg-gradient-to-b from-transparent via-purple-950/20 to-transparent">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {t('landing.pricing.title')}
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              {t('landing.pricing.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {pricingPlans.map((plan, index) => (
              <div 
                key={index}
                className={`relative p-8 rounded-2xl border transition-all ${
                  plan.popular 
                    ? 'bg-gradient-to-br from-blue-500/20 to-purple-500/20 border-purple-500/50 scale-105' 
                    : 'bg-white/5 border-white/10 hover:border-white/20'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full text-sm font-medium">
                    {t('landing.pricing.popular')}
                  </div>
                )}
                <div className="text-center mb-8">
                  <h3 className="text-xl font-semibold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-gray-400">{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                      <span className="text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>
                <button 
                  onClick={onEnterApp}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700'
                      : 'bg-white/10 hover:bg-white/20'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            {t('landing.cta.title1')}
            <span className="block bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              {t('landing.cta.title2')}
            </span>
          </h2>
          <p className="text-xl text-gray-400 mb-10">
            {t('landing.cta.subtitle')}
          </p>
          <button 
            onClick={onEnterApp}
            className="group px-10 py-5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 rounded-xl font-semibold text-xl transition-all hover:shadow-xl hover:shadow-purple-500/25 inline-flex items-center gap-3"
          >
            {t('landing.cta.button')}
            <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="text-gray-500 mt-4 text-sm">{t('landing.cta.note')}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 border-t border-white/10">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Search className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold">Property Check</span>
            </div>
            <div className="flex items-center gap-8 text-gray-400 text-sm">
              <button onClick={() => setLegalDoc('privacy')} className="hover:text-white transition">{t('landing.footer.privacy')}</button>
              <button onClick={() => setLegalDoc('terms')} className="hover:text-white transition">{t('landing.footer.terms')}</button>
              <a href="mailto:hello@property-check.com" className="hover:text-white transition">{t('landing.footer.contact')}</a>
            </div>
            <div className="text-gray-500 text-sm">
              {t('landing.footer.rights', { year: new Date().getFullYear() })}
            </div>
          </div>
        </div>
      </footer>

      {/* Legal modal — ссылки в футере раньше вели в никуда (href="#") */}
      {legalDoc && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLegalDoc(null)}>
          <div className="bg-slate-800 rounded-2xl p-6 max-w-lg w-full border border-white/10 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{LEGAL[legalDoc].title}</h3>
              <button onClick={() => setLegalDoc(null)} className="p-2 hover:bg-white/10 rounded-lg transition"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3 text-sm text-gray-300 leading-relaxed">
              {LEGAL[legalDoc].body.map((line, i) => <p key={i}>{line}</p>)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LandingPage;
