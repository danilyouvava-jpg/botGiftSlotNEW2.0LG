import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Wallet, Star, CreditCard, Check } from 'lucide-react';

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
  const [amount, setAmount] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'deposit' | 'withdrawal' | 'promo'>('deposit');
  const [promoCode, setPromoCode] = useState('');
  // Force STARS as the only currency
  const activeCurrency = 'STARS';
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Reset state when opening
  React.useEffect(() => {
    if (isOpen) {
        setAmount('');
        setPromoCode('');
        setIsSuccess(false);
        setActiveTab('deposit');
    }
  }, [isOpen]);

  const handleDeposit = async () => {
      const value = parseFloat(amount);
      if (value > 0) {
          const ok = await onDeposit(value, activeCurrency);
          if (ok) {
              setSuccessMessage('Пополнение успешно!\nВаш баланс обновлен.');
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
              setSuccessMessage('Заявка отправлена!\nЗвезды скоро появятся на вашем счете в Gift подарке.');
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
      const res = await onActivatePromo(promoCode);
      if (res.success) {
          setSuccessMessage(res.message || 'Промокод активирован!');
          setIsSuccess(true);
          setTimeout(() => {
              onClose();
              setIsSuccess(false);
              setPromoCode('');
          }, 1500);
      } else {
          // Quick error feedback
          const original = successMessage;
          setSuccessMessage(res.message || 'Ошибка');
          // We'll use the success overlay but maybe we should style it red?
          // For now, let's just use alert to keep it simple or show in success overlay.
          // Let's reuse success overlay but it's green. That's confusing.
          // Let's just use alert for now.
          alert(res.message);
      }
  };

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
          className="bg-[#17212b] w-full max-w-md rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10 relative"
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
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#232e3c]">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <CreditCard className="text-blue-400" />
              Кошелек
            </h2>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Tabs */}
          <div className="grid grid-cols-3 p-2 gap-2 bg-[#1c2533]">
              <button
                  onClick={() => setActiveTab('deposit')}
                  className={`py-3 rounded-xl font-bold text-sm transition-all ${
                      activeTab === 'deposit' 
                      ? 'bg-[#2c3847] text-white shadow-lg' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                  Пополнение
              </button>
              <button
                  onClick={() => setActiveTab('withdrawal')}
                  className={`py-3 rounded-xl font-bold text-sm transition-all ${
                      activeTab === 'withdrawal' 
                      ? 'bg-[#2c3847] text-white shadow-lg' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                  Вывод
              </button>
              <button
                  onClick={() => setActiveTab('promo')}
                  className={`py-3 rounded-xl font-bold text-sm transition-all ${
                      activeTab === 'promo' 
                      ? 'bg-[#2c3847] text-white shadow-lg' 
                      : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                  Промо
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
                                className={`py-2 rounded-xl border transition-all font-bold ${
                                    amount === val.toString() 
                                    ? (activeCurrency === 'TON' ? 'bg-blue-500/20 border-blue-500 text-blue-400' : 'bg-yellow-500/20 border-yellow-500 text-yellow-400')
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-300'
                                }`}
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
                            placeholder="Введите сумму"
                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">
                            {activeCurrency}
                        </span>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleDeposit}
                        disabled={!amount || parseFloat(amount) <= 0}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
                            !amount || parseFloat(amount) <= 0
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : (activeCurrency === 'TON' ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/25' : 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-500/25')
                        }`}
                    >
                        Оплатить {amount ? `${amount} ${activeCurrency}` : ''}
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
                                className={`py-2 rounded-xl border transition-all font-bold ${
                                    amount === val.toString() 
                                    ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                                    : 'bg-white/5 border-white/5 hover:bg-white/10 text-gray-300'
                                }`}
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
                            placeholder="Введите сумму вывода"
                            className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors font-mono"
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xs">
                            STARS
                        </span>
                    </div>

                    <div className="text-xs text-gray-500 px-2">
                        Минимальный вывод: 500 звезд
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleWithdraw}
                        disabled={!amount || parseFloat(amount) < 500}
                        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
                            !amount || parseFloat(amount) < 500
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-purple-500 hover:bg-purple-600 text-white shadow-purple-500/25'
                        }`}
                    >
                        Вывести {amount ? `${amount} STARS` : ''}
                    </button>
                </>
            ) : (
                <>
                   {/* Promo Content */}
                   <div className="flex flex-col gap-4">
                       <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                           <h3 className="font-bold text-white mb-2 flex items-center gap-2">
                               <Star className="text-yellow-400" size={20} />
                               Активация промокода
                           </h3>
                           <p className="text-sm text-gray-400 mb-4">
                               Введите промокод, чтобы получить бонусные звезды на счет.
                           </p>
                           
                           <div className="relative">
                               <input
                                   type="text"
                                   value={promoCode}
                                   onChange={(e) => setPromoCode(e.target.value)}
                                   placeholder="Введите промокод"
                                   className="w-full bg-black/20 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 transition-colors font-mono uppercase"
                               />
                           </div>
                       </div>

                       <button
                           onClick={handlePromo}
                           disabled={!promoCode}
                           className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
                               !promoCode
                               ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                               : 'bg-yellow-500 hover:bg-yellow-600 text-white shadow-yellow-500/25'
                           }`}
                       >
                           Активировать
                       </button>
                   </div>
                </>
            )}

          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
