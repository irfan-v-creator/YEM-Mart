import React, { useState } from 'react';
import { 
  X, 
  User, 
  MapPin, 
  Package, 
  LogOut, 
  Plus, 
  Star, 
  Edit3, 
  Trash2, 
  Home, 
  Briefcase, 
  Tag, 
  Phone, 
  ShieldCheck, 
  MessageCircle,
  Loader2,
  AlertCircle,
  Check
} from 'lucide-react';
import { CustomerUser, SavedAddress } from '../types';
import { formatWhatsAppUrl } from '../utils/formatters';

interface CustomerAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerUser | null;
  addresses: SavedAddress[];
  isLoadingAddresses: boolean;
  onAddAddress: () => void;
  onEditAddress: (address: SavedAddress) => void;
  onDeleteAddress: (id: string) => Promise<void>;
  onSetDefaultAddress: (id: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenOrders: () => void;
  onOpenAuth: () => void;
  whatsappNumber?: string;
  addressStorageError?: string | null;
}

export const CustomerAccountDrawer: React.FC<CustomerAccountDrawerProps> = ({
  isOpen,
  onClose,
  customer,
  addresses,
  isLoadingAddresses,
  onAddAddress,
  onEditAddress,
  onDeleteAddress,
  onSetDefaultAddress,
  onSignOut,
  onOpenOrders,
  onOpenAuth,
  whatsappNumber,
  addressStorageError,
}) => {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  if (!isOpen) return null;

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this saved delivery address?')) return;
    setDeletingId(id);
    try {
      await onDeleteAddress(id);
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    setSettingDefaultId(id);
    try {
      await onSetDefaultAddress(id);
    } finally {
      setSettingDefaultId(null);
    }
  };

  const handleSignOutClick = async () => {
    setIsSigningOut(true);
    try {
      await onSignOut();
      onClose();
    } finally {
      setIsSigningOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-xs flex justify-end animate-in fade-in duration-200">
      <div 
        className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col border-l border-neutral-200 animate-in slide-in-from-right duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Bar */}
        <div className="p-5 border-b border-[#E7E5E0] flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-[#C9A44C]/30 flex items-center justify-center text-[#C9A44C] font-black text-sm">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#171717]">My Customer Account</h2>
              <p className="text-xs text-neutral-500">YEM MART Kerala</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-neutral-400 hover:text-black hover:bg-neutral-100 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {customer ? (
            <>
              {/* Customer Profile Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#171717] to-neutral-800 text-white shadow-md relative overflow-hidden">
                <div className="relative z-10 flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-2xl bg-[#C9A44C] text-[#171717] font-black text-lg flex items-center justify-center shrink-0">
                    {customer.fullName ? customer.fullName.charAt(0).toUpperCase() : customer.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-base truncate">{customer.fullName || 'Valued Customer'}</p>
                    <p className="text-xs text-neutral-300 truncate">{customer.email}</p>
                    {customer.phone && (
                      <p className="text-xs text-[#C9A44C] mt-0.5 flex items-center gap-1">
                        <Phone className="w-3 h-3" />
                        <span>{customer.phone}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Actions Grid */}
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    onClose();
                    onOpenOrders();
                  }}
                  className="p-3.5 rounded-xl bg-[#F7F6F2] hover:bg-neutral-200/60 border border-[#E7E5E0] text-left transition-all group"
                >
                  <Package className="w-5 h-5 text-[#C9A44C] mb-1.5 group-hover:scale-105 transition-transform" />
                  <p className="text-xs font-bold text-[#171717]">Track Orders</p>
                  <p className="text-[11px] text-neutral-500">View status & history</p>
                </button>

                {(() => {
                  const whatsappUrl = formatWhatsAppUrl(
                    whatsappNumber,
                    'Hi YEM MART, I am logged into my account and would like support with my orders.'
                  );
                  if (whatsappUrl) {
                    return (
                      <a
                        href={whatsappUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3.5 rounded-xl bg-emerald-50 hover:bg-emerald-100/60 border border-emerald-200 text-left transition-all group"
                      >
                        <MessageCircle className="w-5 h-5 text-emerald-600 mb-1.5 group-hover:scale-105 transition-transform" />
                        <p className="text-xs font-bold text-emerald-950">WhatsApp Help</p>
                        <p className="text-[11px] text-emerald-800">Direct store chat</p>
                      </a>
                    );
                  }
                  return (
                    <div
                      title="WhatsApp store support number is currently not configured"
                      className="p-3.5 rounded-xl bg-neutral-100 border border-neutral-200 text-left opacity-75 cursor-not-allowed select-none"
                    >
                      <MessageCircle className="w-5 h-5 text-neutral-400 mb-1.5" />
                      <p className="text-xs font-bold text-neutral-600">WhatsApp Help</p>
                      <p className="text-[11px] text-neutral-400">Support Offline</p>
                    </div>
                  );
                })()}
              </div>

              {/* Address Storage Warning / Missing Table Banner */}
              {addressStorageError && (
                <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <p className="font-bold">Address Persistence Notice</p>
                    <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                      {addressStorageError}
                    </p>
                    <p className="text-[10px] text-amber-700/80 mt-1">
                      Guest and direct delivery checkout remain fully functional.
                    </p>
                  </div>
                </div>
              )}

              {/* Saved Addresses Section */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-[#C9A44C]" />
                    <h3 className="text-xs font-extrabold text-[#171717] uppercase tracking-wider">
                      Saved Delivery Addresses
                    </h3>
                  </div>
                  <button
                    onClick={onAddAddress}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#171717] hover:bg-[#C9A44C] hover:text-[#171717] text-white text-xs font-bold transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add New</span>
                  </button>
                </div>

                {isLoadingAddresses ? (
                  <div className="p-8 text-center text-neutral-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#C9A44C]" />
                    <p className="text-xs">Loading saved addresses...</p>
                  </div>
                ) : addresses.length === 0 ? (
                  <div className="p-6 rounded-2xl border-2 border-dashed border-[#E7E5E0] text-center bg-[#F7F6F2]">
                    <MapPin className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
                    <p className="text-xs font-bold text-neutral-700">No saved addresses yet</p>
                    <p className="text-[11px] text-neutral-500 mt-1 max-w-xs mx-auto">
                      Save your Kerala home or workplace address for instant 1-click checkout.
                    </p>
                    <button
                      onClick={onAddAddress}
                      className="mt-3.5 px-4 py-2 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717] transition-all"
                    >
                      + Add Address Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        className={`p-4 rounded-2xl border transition-all ${
                          addr.isDefault
                            ? 'bg-amber-50/40 border-[#C9A44C] ring-1 ring-[#C9A44C]/30'
                            : 'bg-white border-[#E7E5E0] hover:border-neutral-400'
                        }`}
                      >
                        {/* Badges Row */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-800 text-[10px] font-extrabold uppercase flex items-center gap-1">
                              {addr.label === 'Home' && <Home className="w-3 h-3" />}
                              {addr.label === 'Work' && <Briefcase className="w-3 h-3" />}
                              {addr.label === 'Other' && <Tag className="w-3 h-3" />}
                              {addr.label}
                            </span>
                            {addr.isDefault && (
                              <span className="px-2 py-0.5 rounded-md bg-[#C9A44C] text-[#171717] text-[10px] font-black uppercase flex items-center gap-1 shadow-2xs">
                                <Star className="w-3 h-3 fill-current" />
                                Default
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => onEditAddress(addr)}
                              className="p-1.5 rounded-lg text-neutral-500 hover:text-black hover:bg-neutral-100 transition-colors"
                              title="Edit Address"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(addr.id)}
                              disabled={deletingId === addr.id}
                              className="p-1.5 rounded-lg text-neutral-400 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                              title="Delete Address"
                            >
                              {deletingId === addr.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-red-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Recipient Details */}
                        <p className="font-bold text-sm text-[#171717]">{addr.fullName}</p>
                        <p className="text-xs text-neutral-600 mt-0.5 leading-relaxed">{addr.address}</p>
                        {addr.landmark && (
                          <p className="text-xs text-neutral-500 mt-0.5">
                            <span className="text-neutral-400">Landmark:</span> {addr.landmark}
                          </p>
                        )}
                        <p className="text-xs font-semibold text-neutral-700 mt-1">
                          {addr.district}, Kerala — {addr.pincode}
                        </p>
                        <p className="text-xs text-neutral-500 mt-0.5 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-neutral-400" />
                          <span>+91 {addr.phone}</span>
                        </p>

                        {/* Set as default action if not default */}
                        {!addr.isDefault && (
                          <div className="mt-3 pt-2.5 border-t border-[#E7E5E0]/60 flex justify-end">
                            <button
                              onClick={() => handleSetDefault(addr.id)}
                              disabled={settingDefaultId === addr.id}
                              className="text-xs font-bold text-[#C9A44C] hover:underline flex items-center gap-1 disabled:opacity-50"
                            >
                              {settingDefaultId === addr.id ? (
                                <>
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>Setting...</span>
                                </>
                              ) : (
                                <>
                                  <Star className="w-3 h-3" />
                                  <span>Set as Default</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="p-8 text-center bg-[#F7F6F2] rounded-3xl border border-[#E7E5E0]">
              <User className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              <h3 className="font-extrabold text-base text-[#171717]">Sign In to Your Account</h3>
              <p className="text-xs text-neutral-500 mt-1.5 max-w-xs mx-auto leading-relaxed">
                Save delivery addresses, track Kerala shipments in real-time, and enjoy quick checkout.
              </p>
              <button
                onClick={() => {
                  onClose();
                  onOpenAuth();
                }}
                className="mt-5 w-full py-3 px-4 rounded-xl bg-[#171717] text-white font-bold text-xs hover:bg-[#C9A44C] hover:text-[#171717] transition-all shadow-md"
              >
                Sign In / Register
              </button>
            </div>
          )}
        </div>

        {/* Footer / Sign Out Button */}
        {customer && (
          <div className="p-5 border-t border-[#E7E5E0] bg-neutral-50 sticky bottom-0">
            <button
              onClick={handleSignOutClick}
              disabled={isSigningOut}
              className="w-full py-2.5 px-4 rounded-xl border border-neutral-300 bg-white text-xs font-bold text-neutral-700 hover:text-red-600 hover:border-red-300 hover:bg-red-50/50 transition-all flex items-center justify-center gap-2"
            >
              {isSigningOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              <span>Sign Out from YEM MART</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
