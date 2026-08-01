import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy, Zap, Star, Shield, Gift, Lock } from 'lucide-react';
import { SYMBOL_CONFIG, THEME_IMAGES, ThemeId } from '../constants';
import { SymbolType } from '../types';
import { useI18n } from '../i18n';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeId;
}

export default function InfoModal({ isOpen, onClose, theme }: InfoModalProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-[#17212b] w-full max-w-2xl max-h-[85vh] rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#232e3c]">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="text-yellow-400" />
              {t('rules_title')}
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
            
            {/* General Rules */}
            <section>
              <h3 className="text-lg font-bold text-blue-400 mb-3 uppercase tracking-wider">{t('how_to_play')}</h3>
              <ul className="space-y-2 text-gray-300 text-sm">
                {theme === 'obeziana' ? (
                  <>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span dangerouslySetInnerHTML={{ __html: t('obez_goal') }} />
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span dangerouslySetInnerHTML={{ __html: t('obez_field') }} />
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span dangerouslySetInnerHTML={{ __html: t('obez_symbols') }} />
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span dangerouslySetInnerHTML={{ __html: t('obez_maxwin') }} />
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      <span dangerouslySetInnerHTML={{ __html: t('obez_strategy') }} />
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      {t('rules_line')}
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      {t('rules_ltr')}
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      {t('rules_coins')}
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-400">•</span>
                      {t('rules_wild')}
                    </li>
                  </>
                )}
              </ul>
            </section>

            {/* Symbols Paytable */}
            <section>
              <h3 className="text-lg font-bold text-yellow-400 mb-4 uppercase tracking-wider">{t('paytable')}</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Object.values(SymbolType).map((type) => {
                  const symbol = SYMBOL_CONFIG[type];
                  const imageUrl = THEME_IMAGES[theme][type] || symbol.imageUrl;
                  
                  // Exclusions for Obeziana
                  if (theme === 'obeziana') {
                      if (type === SymbolType.WILD || type === SymbolType.COIN || type === SymbolType.LOCK) return null;
                  }

                  if (symbol.multiplier === 0 && type !== SymbolType.WILD) return null; // Skip specials except WILD

                  return (
                    <div key={type} className="bg-white/5 rounded-xl p-3 flex items-center gap-4 border border-white/5">
                      <div 
                        className="w-12 h-12 rounded-lg shadow-lg flex items-center justify-center text-2xl overflow-hidden"
                        style={{ backgroundColor: symbol.color }}
                      >
                        {imageUrl ? (
                            <img src={imageUrl} alt={symbol.label} className="w-full h-full object-cover" />
                        ) : (
                            symbol.icon
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-white">{type === SymbolType.WILD ? 'WILD' : ''}</div>
                        <div className="text-xs text-gray-400">
                          {type === SymbolType.WILD 
                            ? (theme === 'flour' ? t('wild_expand') : t('wild_replace')) 
                            : `x${symbol.multiplier}`}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Features */}
            {theme !== 'obeziana' && (
            <section className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 rounded-2xl p-5 border border-white/5">
              <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                <Zap className="text-yellow-400" size={20} />
                {t('features')}
              </h3>
              
              <div className="space-y-4">
                <div className="flex gap-4 items-start">
                   <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center shrink-0">
                     <Star className="text-blue-400" />
                   </div>
                   <div>
                     <h4 className="font-bold text-white">{t('bonus_game_title')}</h4>
                     <p className="text-xs text-gray-400 mt-1">
                       {t('bonus_game_desc')}
                       <span className="block text-yellow-400 font-bold mt-1">{t('bonus_end')}</span>
                       <span className="block text-red-400 font-bold mt-1">{t('red_coins')}</span>
                       <span className="block text-yellow-500 font-bold mt-1">{t('yellow_coins')}</span>
                     </p>
                   </div>
                </div>

                {theme === 'flour' && (
                  <div className="flex gap-4 items-start">
                     <div className="w-12 h-12 bg-[#839843]/20 rounded-lg flex items-center justify-center shrink-0">
                       <div className="w-8 h-8 rounded overflow-hidden">
                          <img src={THEME_IMAGES['flour'][SymbolType.WILD]} alt="Wild" className="w-full h-full object-cover" />
                       </div>
                     </div>
                     <div>
                       <h4 className="font-bold text-white">{t('expanding_wild')}</h4>
                       <p className="text-xs text-gray-400 mt-1">
                          {t('expanding_wild_desc')}
                       </p>
                     </div>
                  </div>
                )}

                <div className="flex gap-4 items-start">
                   <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center shrink-0">
                     <Gift className="text-purple-400" />
                   </div>
                   <div>
                     <h4 className="font-bold text-white">{t('win_multipliers')}</h4>
                     <p className="text-xs text-gray-400 mt-1">
                       {t('win_multipliers_desc')}
                     </p>
                   </div>
                </div>
              </div>
            </section>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
