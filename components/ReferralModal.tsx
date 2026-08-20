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
        className="ios-overlay fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="ios-modal w-full max-w-lg overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="ios-modal-header">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="text-blue-400" size={22} />
              {t('referral_title')}
            </h2>
            <button
              onClick={onClose}
              className="ios-icon-btn"
            >
              <X size={18} />
            </button>
          </div>

          {/* Stats */}
          <div className="p-6 grid grid-cols-2 gap-4 border-b border-white/5">
            <div className="ios-stat p-4 text-center">
              <div className="text-3xl font-bold text-white">{loading ? '...' : referralStats.count}</div>
              <div className="text-white/50 text-sm mt-1">{t('invited')}</div>
            </div>
            <div className="ios-stat p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400 flex items-center justify-center gap-1">
                {loading ? '...' : referralStats.earned}
                <Star size={20} className="fill-yellow-400" />
              </div>
              <div className="text-white/50 text-sm mt-1">{t('earned')}</div>
            </div>
          </div>

          {/* Info */}
          <div className="p-6 text-center">
            <p className="text-white/50 mb-4" dangerouslySetInnerHTML={{ __html: t('referral_hint') }} />

            <button
              className="ios-btn ios-btn-primary w-full py-4 text-lg flex items-center justify-center gap-2"
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
