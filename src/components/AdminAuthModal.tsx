import React, { useState } from 'react';
import { Lock, ShieldCheck, X, AlertCircle, ArrowRight, KeyRound, UserCheck } from 'lucide-react';
import { api, extractErrorMessage } from '../utils/api';

export interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (role: string) => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'owner' | 'manager' | 'fulfillment' | 'support'>('owner');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password.trim()) {
      setError('Please enter the Admin Security Passkey');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.loginAdmin(password.trim(), role);
      setPassword('');
      onSuccess(res.role);
    } catch (err: any) {
      const cleanMessage = extractErrorMessage(
        err,
        'Invalid admin passkey or unauthorized role. Please check your credentials.'
      );
      setError(cleanMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="relative bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-neutral-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#E7E5E0]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-[#171717] flex items-center justify-center text-[#C9A44C]">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-[#171717]">Admin Authentication</h3>
              <p className="text-[11px] text-neutral-500">Authorized personnel access only</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Notice */}
        <div className="mt-4 p-3 bg-amber-50 rounded-xl border border-amber-200/60 text-xs text-amber-900 flex items-start gap-2">
          <ShieldCheck className="w-4 h-4 text-[#C9A44C] shrink-0 mt-0.5" />
          <span>
            Server-side authorization is strictly enforced. Customer records and financial logs require a verified administrative session.
          </span>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 rounded-xl border border-red-200 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
              Admin Passkey / Secret <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center">
              <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3.5" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter admin password..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] outline-none text-sm"
                autoFocus
              />
            </div>
            <p className="text-[10px] text-neutral-400 mt-1">
              Enter the authorized store passkey configured on the server.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#171717] uppercase tracking-wider mb-1">
              Operational Role
            </label>
            <div className="relative flex items-center">
              <UserCheck className="w-4 h-4 text-neutral-400 absolute left-3.5 pointer-events-none" />
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as any)}
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-[#E7E5E0] focus:border-[#C9A44C] bg-white outline-none text-sm font-medium"
              >
                <option value="owner">Store Owner (Super Admin)</option>
                <option value="manager">Store Manager (Products & Stock)</option>
                <option value="fulfillment">Fulfillment / Dispatch Agent</option>
                <option value="support">Customer Support Lead</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 rounded-xl bg-[#171717] hover:bg-[#C9A44C] hover:text-[#171717] text-white font-bold text-sm transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
          >
            {isLoading ? (
              <span>Verifying Credentials...</span>
            ) : (
              <>
                <span>Sign In to Admin Console</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export const AdminLoginModal = AdminAuthModal;
export default AdminAuthModal;
