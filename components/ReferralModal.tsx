import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Users, Star } from 'lucide-react';
import { useI18n } from '../i18n';

function authHeaders(): Record<string, string> {
    try {
        const initData = (window as any).Telegram?.WebApp?.initData;
        return initData ? { 'x-telegram-initdata': initData } : {};
    } catch { return {}; }
}

interface ReferralModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: number | null;
}

export default function ReferralModal({ isOpen, onClose, userId }: ReferralModalProps) {
  const { t } = useI18n();
  const [referralStats, setReferralStats] = useState({ count: 0, earned: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && userId) {
      setLoading(true);
      fetch(`/api/referrals/${userId}`, { headers: authHeaders() })
        .then(res => res.json())
        .then(data => {
          setReferralStats({ count: data.count || 0, earned: data.earned || 0 });
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [isOpen, userId]);

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
          className="bg-[#17212b] w-full max-w-lg rounded-3xl overflow-hidden flex flex-col shadow-2xl border border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/5 bg-[#232e3c]">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Users className="text-blue-400" />
              {t('referral_title')}
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          {/* Stats */}
          <div className="p-6 grid grid-cols-2 gap-4 border-b border-white/5">
            <div className="bg-[#232e3c] rounded-2xl p-4 text-center">
              <div className="text-3xl font-bold text-white">{loading ? '...' : referralStats.count}</div>
              <div className="text-gray-400 text-sm mt-1">{t('invited')}</div>
            </div>
            <div className="bg-[#232e3c] rounded-2xl p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400 flex items-center justify-center gap-1">
                {loading ? '...' : referralStats.earned}
                <Star size={20} className="fill-yellow-400" />
              </div>
              <div className="text-gray-400 text-sm mt-1">{t('earned')}</div>
            </div>
          </div>

          {/* Info */}
          <div className="p-6 text-center">
            <p className="text-gray-400 mb-4" dangerouslySetInnerHTML={{ __html: t('referral_hint') }} />

            <button
              className="w-full bg-[#0098ea] hover:bg-[#0098ea]/90 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2"
              onClick={async () => {
                // @ts-ignore
                if (window.Telegram?.WebApp && userId) {
                  try {
                    const response = await fetch('/api/prepare-share', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', ...authHeaders() },
                      body: JSON.stringify({ userId })
                    });
                    const data = await response.json();

                    if (data.prepared_message_id) {
                      // @ts-ignore
                      window.Telegram.WebApp.shareMessage(data.prepared_message_id, (success: boolean) => {
                        if (success) {
                          console.log('Message shared successfully');
                        }
                      });
                    } else {
                      console.error('Failed to prepare message:', data.error);
                    }
                  } catch (error) {
                    console.error('Error preparing share:', error);
                  }
                } else {
                  console.log('Invite clicked (WebApp not detected or no userId)');
                }
              }}
            >
              <Users size={20} />
              {t('invite_friend')}
            </button>
          </div>

        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
