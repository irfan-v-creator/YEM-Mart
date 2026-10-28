import React, { useState, useEffect } from 'react';
import { X, MapPin, Phone, User, Home, Briefcase, Tag, AlertCircle, Loader2, Check } from 'lucide-react';
import { SavedAddress, AddressLabel } from '../types';
import { ALL_KERALA_DISTRICTS, lookupKeralaDistrict, isKeralaPincode, KeralaDistrict } from '../data/initialData';

interface AddressFormModalProps {
  isOpen: boolean;
  initialAddress?: SavedAddress | null;
  onClose: () => void;
  onSave: (address: Partial<SavedAddress>) => Promise<void>;
}

export const AddressFormModal: React.FC<AddressFormModalProps> = ({
  isOpen,
  initialAddress,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(initialAddress);

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [landmark, setLandmark] = useState('');
  const [district, setDistrict] = useState<KeralaDistrict>('Ernakulam');
  const [pincode, setPincode] = useState('');
  const [label, setLabel] = useState<AddressLabel>('Home');
  const [isDefault, setIsDefault] = useState(false);

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialAddress) {
      setFullName(initialAddress.fullName || '');
      setPhone(initialAddress.phone || '');
      setAddress(initialAddress.address || '');
      setLandmark(initialAddress.landmark || '');
      setDistrict((initialAddress.district as KeralaDistrict) || 'Ernakulam');
      setPincode(initialAddress.pincode || '');
      setLabel(initialAddress.label || 'Home');
      setIsDefault(Boolean(initialAddress.isDefault));
    } else {
      setFullName('');
      setPhone('');
      setAddress('');
      setLandmark('');
      setDistrict('Ernakulam');
      setPincode('');
      setLabel('Home');
      setIsDefault(false);
    }
    setFormErrors({});
    setErrorMessage(null);
  }, [initialAddress, isOpen]);

  if (!isOpen) return null;

  const handlePincodeChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setPincode(cleaned);
    if (cleaned.length >= 3) {
      const detected = lookupKeralaDistrict(cleaned);
      if (detected) {
        setDistrict(detected);
      }
    }
  };

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!fullName.trim()) errors.fullName = 'Please enter recipient name';
    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      errors.phone = 'Please enter a valid 10-digit mobile number';
    }
    if (!address.trim()) errors.address = 'Please enter complete house/building and street address';
    if (!pincode.trim() || !/^\d{6}$/.test(pincode.trim())) {
      errors.pincode = 'Please enter a 6-digit PIN code';
    } else if (!isKeralaPincode(pincode.trim())) {
      errors.pincode = 'YEM MART delivers exclusively across Kerala (Pincodes starting with 67, 68, or 69).';
    }
    if (!district) errors.district = 'Please select a Kerala district';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await onSave({
        fullName: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        landmark: landmark.trim() || undefined,
        district,
        pincode: pincode.trim(),
        label,
        isDefault,
      });
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save address. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        className="relative bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-neutral-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#E7E5E0] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-50 border border-[#C9A44C]/30 flex items-center justify-center text-[#C9A44C]">
              <MapPin className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#171717]">
                {isEditing ? 'Edit Delivery Address' : 'Add New Delivery Address'}
              </h2>
              <p className="text-xs text-neutral-500">
                Kerala delivery logistics & postal address
              </p>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* Address Label Pills */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-2">
              Address Type
            </label>
            <div className="flex gap-2">
              {(['Home', 'Work', 'Other'] as AddressLabel[]).map((lbl) => (
                <button
                  key={lbl}
                  type="button"
                  onClick={() => setLabel(lbl)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-all ${
                    label === lbl
                      ? 'bg-[#171717] text-white border-[#171717] shadow-xs'
                      : 'bg-[#F7F6F2] text-neutral-600 border-[#E7E5E0] hover:border-neutral-400'
                  }`}
                >
                  {lbl === 'Home' && <Home className="w-3.5 h-3.5" />}
                  {lbl === 'Work' && <Briefcase className="w-3.5 h-3.5" />}
                  {lbl === 'Other' && <Tag className="w-3.5 h-3.5" />}
                  <span>{lbl}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Recipient Name and Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Recipient Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Anjali Nair"
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border text-sm outline-none transition-all ${
                    formErrors.fullName ? 'border-red-400 bg-red-50/30' : 'border-[#E7E5E0] focus:border-[#C9A44C] focus:bg-white'
                  }`}
                />
              </div>
              {formErrors.fullName && <p className="mt-1 text-[11px] text-red-500">{formErrors.fullName}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                10-Digit Mobile <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  maxLength={10}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 9847012345"
                  className={`w-full pl-10 pr-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border text-sm outline-none transition-all ${
                    formErrors.phone ? 'border-red-400 bg-red-50/30' : 'border-[#E7E5E0] focus:border-[#C9A44C] focus:bg-white'
                  }`}
                />
              </div>
              {formErrors.phone && <p className="mt-1 text-[11px] text-red-500">{formErrors.phone}</p>}
            </div>
          </div>

          {/* Delivery Address */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              House / Flat / Building / Street Address <span className="text-red-500">*</span>
            </label>
            <textarea
              required
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g. Flat 3B, Silver Palms, Civil Station Road"
              className={`w-full p-3 bg-[#F7F6F2] rounded-xl border text-sm outline-none transition-all resize-none ${
                formErrors.address ? 'border-red-400 bg-red-50/30' : 'border-[#E7E5E0] focus:border-[#C9A44C] focus:bg-white'
              }`}
            />
            {formErrors.address && <p className="mt-1 text-[11px] text-red-500">{formErrors.address}</p>}
          </div>

          {/* Landmark */}
          <div>
            <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
              Landmark (Optional)
            </label>
            <input
              type="text"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              placeholder="e.g. Near St. George Church, Opposite Petrol Pump"
              className="w-full px-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border border-[#E7E5E0] text-sm outline-none focus:border-[#C9A44C] focus:bg-white transition-all"
            />
          </div>

          {/* District & Pincode */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                Kerala District <span className="text-red-500">*</span>
              </label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value as KeralaDistrict)}
                className="w-full px-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border border-[#E7E5E0] text-sm font-semibold outline-none focus:border-[#C9A44C] focus:bg-white transition-all"
              >
                {ALL_KERALA_DISTRICTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-neutral-700 uppercase tracking-wider mb-1.5">
                6-Digit PIN Code <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                maxLength={6}
                value={pincode}
                onChange={(e) => handlePincodeChange(e.target.value)}
                placeholder="e.g. 682001"
                className={`w-full px-3.5 py-2.5 bg-[#F7F6F2] rounded-xl border text-sm outline-none transition-all ${
                  formErrors.pincode ? 'border-red-400 bg-red-50/30' : 'border-[#E7E5E0] focus:border-[#C9A44C] focus:bg-white'
                }`}
              />
              {formErrors.pincode && <p className="mt-1 text-[11px] text-red-500 leading-tight">{formErrors.pincode}</p>}
            </div>
          </div>

          {/* Default Address Checkbox */}
          <label className="flex items-center gap-2.5 pt-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="w-4 h-4 rounded text-[#171717] focus:ring-[#C9A44C] accent-[#171717]"
            />
            <span className="text-xs font-semibold text-neutral-700">
              Set as my default delivery address
            </span>
          </label>

          {/* Actions */}
          <div className="pt-4 border-t border-[#E7E5E0] flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-neutral-300 text-xs font-bold text-neutral-700 hover:bg-neutral-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-[#171717] text-white text-xs font-bold hover:bg-[#C9A44C] hover:text-[#171717] transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{isEditing ? 'Save Changes' : 'Save Address'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
