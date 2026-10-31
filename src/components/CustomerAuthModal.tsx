import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Phone, ArrowRight, Loader2, AlertCircle, CheckCircle2, ShieldCheck, KeyRound } from 'lucide-react';
import { signInCustomer, signUpCustomer, resetCustomerPassword, updateCustomerPassword } from '../utils/supabaseClient';
import { CustomerUser } from '../types';

interface CustomerAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: CustomerUser) => void;
  initialMode?: 'login' | 'register' | 'forgot' | 'recovery';
}

export const CustomerAuthModal: React.FC<CustomerAuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'recovery'>(initialMode);
  
  // Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  
  // States
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialMode) {
      setMode(initialMode);
      setErrorMessage(null);
      setSuccessMessage(null);
    }
  }, [initialMode, isOpen]);

  if (!isOpen) return null;

  const resetState = () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsLoading(false);
  };

  const switchMode = (newMode: 'login' | 'register' | 'forgot' | 'recovery') => {
    resetState();
    setMode(newMode);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const validate = (): boolean => {
    setErrorMessage(null);

    // Password recovery mode only requires new password and confirmation
    if (mode === 'recovery') {
      if (!password || password.length < 6) {
        setErrorMessage('New password must be at least 6 characters long.');
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-enter your password.');
        return false;
      }
      return true;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email.trim())) {
      setErrorMessage('Please enter a valid email address.');
      return false;
    }

    if (mode === 'forgot') return true;

    if (!password || password.length < 6) {
      setErrorMessage('Password must be at least 6 characters long.');
      return false;
    }

    if (mode === 'register') {
      if (!fullName.trim()) {
        setErrorMessage('Please enter your full name.');
        return false;
      }
      if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) {
        setErrorMessage('Please enter a valid 10-digit mobile number starting with 6, 7, 8, or 9.');
        return false;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match. Please re-type your password.');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (mode === 'login') {
        const { user, error } = await signInCustomer({ email, password });
        if (error) {
          setErrorMessage(error);
          setIsLoading(false);
          return;
        }
        if (user) {
          onSuccess(user);
          handleClose();
        }
      } else if (mode === 'register') {
        const { user, session, error } = await signUpCustomer({
          email,
          password,
          fullName,
          phone: phone.trim() || undefined,
        });

        if (error) {
          setErrorMessage(error);
          setIsLoading(false);
          return;
        }

        if (user) {
          if (session) {
            // Immediate login: Supabase returned a valid session directly on signup
            onSuccess(user);
            handleClose();
          } else {
            // Immediately attempt automatic sign-in with the registered email & password
            const signInRes = await signInCustomer({ email, password });
            if (signInRes.session && signInRes.user) {
              onSuccess(signInRes.user);
              handleClose();
            } else if (signInRes.error && signInRes.error.toLowerCase().includes('email not confirmed')) {
              setErrorMessage(
                'Account created! Direct sign-in without verification requires turning OFF "Confirm email" in Supabase Auth (Dashboard -> Authentication -> Providers -> Email). Please toggle it off in your project settings, or check your inbox.'
              );
              setMode('login');
            } else {
              setSuccessMessage('Account created successfully! Please sign in with your email and password.');
              setMode('login');
            }
          }
        }
      } else if (mode === 'forgot') {
        const { success, error } = await resetCustomerPassword(email);
        if (error) {
          setErrorMessage(error);
          setIsLoading(false);
          return;
        }
        if (success) {
          setSuccessMessage(
            'Password reset link has been dispatched to your email. Please follow the instructions to set a new password.'
          );
        }
      } else if (mode === 'recovery') {
        const { success, error } = await updateCustomerPassword(password);
        if (error) {
          setErrorMessage(error);
          setIsLoading(false);
          return;
        }
        if (success) {
          setSuccessMessage(
            'Your password has been updated successfully! Redirecting you to sign in...'
          );
          setPassword('');
          setConfirmPassword('');
          setTimeout(() => {
            switchMode('login');
          }, 2000);
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="relative bg-white rounded-3xl max-w-md w-full shadow-2xl border border-neutral-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="px-6 pt-6 pb-4 border-b border-[#E7E5E0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-[#C9A44C]/30 flex items-center justify-center text-[#C9A44C]">
              {mode === 'recovery' ? <KeyRound className="w-4 h-4" /> : <User className="w-4 h-4" />}
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#171717]">
                {mode === 'login' && 'Sign In to YEM MART'}
                {mode === 'register' && 'Create Customer Account'}
                {mode === 'forgot' && 'Reset Your Password'}
                {mode === 'recovery' && 'Set New Password'}
              </h2>
              <p className="text-xs text-neutral-500">
                {mode === 'login' && 'Access saved addresses and order tracking'}
                {mode === 'register' && 'Fast checkout & express delivery across Kerala'}
                {mode === 'forgot' && 'Enter your registered email address'}
                {mode === 'recovery' && 'Enter your new secure password below'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle for Login / Register (Hidden in forgot and recovery mode) */}
        {mode !== 'forgot' && mode !== 'recovery' && (
          <div className="px-6 pt-4 flex gap-2">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:text-black'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'register'
                  ? 'bg-[#171717] text-white shadow-xs'
                  : 'bg-neutral-100 text-neutral-600 hover:text-black'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <p className="leading-relaxed">{successMessage}</p>
            </div>
          )}

          {/* Registration Fields */}
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Rahul Menon"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border border-[#E7E5E0] text-sm text-[#171717] outline-none focus:border-[#C9A44C] focus:bg-white transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                  10-Digit Mobile Number (Optional)
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="e.g. 9876543210"
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border border-[#E7E5E0] text-sm text-[#171717] outline-none focus:border-[#C9A44C] focus:bg-white transition-all"
                  />
                </div>
              </div>
            </>
          )}

          {/* Email (Hidden in recovery mode because session is already active) */}
          {mode !== 'recovery' && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border border-[#E7E5E0] text-sm text-[#171717] outline-none focus:border-[#C9A44C] focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          {/* Password (for login, register, and recovery) */}
          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-neutral-700 uppercase tracking-wider">
                  {mode === 'recovery' ? 'New Password' : 'Password'} <span className="text-red-500">*</span>
                </label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="text-xs text-[#C9A44C] hover:underline font-medium"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border border-[#E7E5E0] text-sm text-[#171717] outline-none focus:border-[#C9A44C] focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          {/* Confirm Password (register and recovery) */}
          {(mode === 'register' || mode === 'recovery') && (
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Confirm {mode === 'recovery' ? 'New Password' : 'Password'} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-type your password"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border border-[#E7E5E0] text-sm text-[#171717] outline-none focus:border-[#C9A44C] focus:bg-white transition-all"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-[#171717] text-white font-bold text-sm hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center justify-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed active:scale-98"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#C9A44C]" />
                <span>Please wait...</span>
              </>
            ) : (
              <>
                <span>
                  {mode === 'login' && 'Sign In'}
                  {mode === 'register' && 'Create Account'}
                  {mode === 'forgot' && 'Send Password Reset Link'}
                  {mode === 'recovery' && 'Set New Password'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Back to sign in link for forgot & recovery */}
          {(mode === 'forgot' || mode === 'recovery') && (
            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="text-xs text-neutral-600 hover:text-black font-semibold"
              >
                ← Back to Sign In
              </button>
            </div>
          )}

          {/* Privacy & Security Note */}
          <div className="pt-3 border-t border-[#E7E5E0] flex items-center justify-center gap-1.5 text-[11px] text-neutral-400">
            <ShieldCheck className="w-3.5 h-3.5 text-[#C9A44C]" />
            <span>Encrypted credentials • Built for YEM MART Kerala</span>
          </div>
        </form>
      </div>
    </div>
  );
};

