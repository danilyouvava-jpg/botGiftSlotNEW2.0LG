import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Star, CreditCard, Check } from 'lucide-react';
import { useI18n } from '../i18n';

interface DepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeposit: (amount: number, currency: 'TON' | 'STARS') => Promise<boolean>;
  onWithdraw?: (amount: number) => Promise<boolean>;
  onActivatePromo?: (code: string) => Promise<{success: boolean, message?: string, reward?: number}>;
  currentCurrency: 'TON' | 'STARS';
}

const PRESETS = {
  TON: [10, 50, 100, 500, 1000],
  STARS: [100, 500, 1000, 5000, 10000]
};

const WITHDRAW_PRESETS = [500, 1000, 2500, 5000, 10000];

export default function DepositModal({ isOpen, onClose, onDeposit, onWithdraw, onActivatePromo, currentCurrency }: DepositModalProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdrawal' | 'promo'>('deposit');
  const [promoCode, setPromoCode] = useState('');
  // Force STARS as the only currency
  const activeCurrency = 'STARS';
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [promoError, setPromoError] = useState('');

  React.useEffect(() => {
    if (isOpen) {
        setAmount('');
        setPromoCode('');
        setIsSuccess(false);
        setActiveTab('deposit');
        setPromoError('');
    }
  }, [isOpen]);

  const handleDeposit = async () => {
      const value = parseFloat(amount);
      if (value > 0) {
          const ok = await onDeposit(value, activeCurrency);
          if (ok) {
              setSuccessMessage(t('deposit_success'));
              setIsSuccess(true);
              setTimeout(() => {
                  onClose();
                  setIsSuccess(false);
              }, 1500);
          }
      }
  };

  const handleWithdraw = async () => {
      const value = parseFloat(amount);
      if (value >= 500) {
          const ok = await onWithdraw?.(value) || false;
          if (ok) {
              setSuccessMessage(t('withdraw_success'));
              setIsSuccess(true);
              setTimeout(() => {
                  onClose();
                  setIsSuccess(false);
              }, 2500);
          }
      }
  };

  const handlePromo = async () => {
      if (!onActivatePromo || !promoCode) return;
      setPromoError('');
      const res = await onActivatePromo(promoCode);
      if (res.success) {
          setSuccessMessage(res.message || t('promo_success'));
          setIsSuccess(true);
          setTimeout(() => {
              onClose();
              setIsSuccess(false);
              setPromoCode('');
          }, 1500);
      } else {
          setPromoError(res.message || t('error'));
          setTimeout(() => setPromoError(''), 3000);
      }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="ios-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="ios-modal w-full max-w-md overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
           {/* Success Overlay */}
           {isSuccess && (
               <div className="absolute inset-0 z-10 bg-[#17212b] flex flex-col items-center justify-center text-center p-6">
                   <motion.div 
                     initial={{ scale: 0 }} animate={{ scale: 1 }}
                     className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mb-4"
                   >
                       <Check size={40} className="text-white" />
                   </motion.div>
                   <h3 className="text-2xl font-bold text-white whitespace-pre-wrap">{successMessage.split('\n')[0]}</h3>
                   <p className="text-gray-400 mt-2 whitespace-pre-wrap">{successMessage.split('\n')[1]}</p>
               </div>
           )}

          {/* Header */}
          <div className="ios-modal-header">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className="text-blue-400" size={22} />
              {t('wallet')}
            </h2>
            <button
              onClick={onClose}
              className="ios-icon-btn"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="ios-segmented grid grid-cols-3 m-4 mb-0">
              <button
                  onClick={() => setActiveTab('deposit')}
                  className={activeTab === 'deposit' ? 'active' : ''}
              >
                  {t('deposit_tab')}
              </button>
              <button
                  onClick={() => setActiveTab('withdrawal')}
                  className={activeTab === 'withdrawal' ? 'active' : ''}
              >
                  {t('withdraw_tab')}
              </button>
              <button
                  onClick={() => setActiveTab('promo')}
                  className={activeTab === 'promo' ? 'active' : ''}
              >
                  {t('promo_tab')}
              </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            
            {activeTab === 'deposit' ? (
                <>
                    {/* Presets */}
                    <div className="grid grid-cols-3 gap-2">
                        {PRESETS[activeCurrency].map(val => (
                            <button
                                key={val}
                                onClick={() => setAmount(val.toString())}
                                className={`ios-chip ${amount === val.toString() ? 'selected-gold' : ''}`}
                            >
                                {val}
                            </button>
                        ))}
                    </div>

                    {/* Custom Input */}
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={t('enter_amount')}
                            className="ios-input w-full font-mono"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-xs">
                            {activeCurrency}
                        </span>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleDeposit}
                        disabled={!amount || parseFloat(amount) <= 0}
                        className="ios-btn ios-btn-gold w-full py-4 text-lg"
                    >
                        {t('pay')} {amount ? `${amount} ${activeCurrency}` : ''}
                    </button>

                </>
            ) : activeTab === 'withdrawal' ? (
                <>
                    {/* Withdraw Presets */}
                    <div className="grid grid-cols-3 gap-2">
                        {WITHDRAW_PRESETS.map(val => (
                            <button
                                key={val}
                                onClick={() => setAmount(val.toString())}
                                className={`ios-chip ${amount === val.toString() ? 'selected-purple' : ''}`}
                            >
                                {val}
                            </button>
                        ))}
                    </div>

                    {/* Custom Input */}
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder={t('enter_withdraw_amount')}
                            className="ios-input w-full font-mono"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-xs">
                            STARS
                        </span>
                    </div>

                    <div className="text-xs text-white/40 px-2">
                        {t('min_withdraw')}
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleWithdraw}
                        disabled={!amount || parseFloat(amount) < 500}
                        className="ios-btn ios-btn-purple w-full py-4 text-lg"
                    >
                        {t('withdraw_btn')} {amount ? `${amount} STARS` : ''}
                    </button>
                </>
            ) : (
                <>
                   {/* Promo Content */}
                   <div className="flex flex-col gap-4">
                       <div className="ios-card p-4">
                           <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                               <Star className="text-yellow-400" size={20} />
                               {t('promo_title')}
                           </h3>
                           <p className="text-sm text-white/50 mb-4">
                               {t('promo_hint')}
                           </p>
                           
                           <div className="relative">
                               <input
                                   type="text"
                                   value={promoCode}
                                   onChange={(e) => setPromoCode(e.target.value)}
                                   placeholder={t('enter_promo')}
                                   className="ios-input w-full font-mono uppercase"
                               />
                           </div>
                       </div>

                        <button
                            onClick={handlePromo}
                            disabled={!promoCode}
                            className="ios-btn ios-btn-gold w-full py-4 text-lg"
                        >
                            {t('activate')}
                        </button>

                        {promoError && (
                            <div className="text-red-400 text-sm text-center mt-2 font-medium">{promoError}</div>
                        )}
                   </div>
                </>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
