import React, { useEffect, useState } from "react";
import { apiService } from "../services/apiService";
import { Search, MapPin, Globe, Phone, Clock, Plus, ShieldCheck, ShieldAlert, Trash2, Edit2 } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";

interface Props {
  userRole: string;
  onOpenEmergency: () => void;
}

/**
 * A stored address turned into something a browser will actually follow.
 *
 * Entries are typed in by counsellors, so plenty arrive as "befrienders.org"
 * with no scheme. Handed straight to href that becomes a relative link and
 * navigates to /befrienders.org inside the app — a dead end on a screen whose
 * whole purpose is getting someone to help.
 */
export function resourceHref(raw: string): string {
  const url = (raw || "").trim();
  if (!url) return "";
  return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

/**
 * The address as it is shown: scheme, "www." and any trailing slash removed.
 *
 * Showing the real destination rather than the word "Website" lets someone
 * see who they are about to contact before they tap — which matters when the
 * list mixes helplines, legal services and shelters, and when tapping the
 * wrong one is not a neutral mistake. The full address stays on the link's
 * title and in the href.
 */
export function resourceLinkText(raw: string): string {
  const url = (raw || "").trim();
  if (!url) return "";
  return url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

export const SupportResources: React.FC<Props> = ({ userRole, onOpenEmergency }) => {
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRegion, setFilterRegion] = useState("");
  const [filterType, setFilterType] = useState("");
  
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: "", resource_type: "Crisis Support", region: "Global", phone: "", website: "", hours: "24/7", 
    accessibility: "", emergency_flag: false, contact_method: "Phone"
  });

  const isWorker = userRole === "admin" || userRole === "support_worker";

  const fetchResources = async () => {
    try {
      setLoading(true);
      const res = await apiService.supportResources.getAll({ 
        region: filterRegion, 
        type: filterType 
      });
      setResources(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, [filterRegion, filterType]);

  const handleSave = async () => {
    try {
      // transform languages string to array if needed, but for simplicity we keep it as strings in UI or array in DB
      const payload = {
        ...formData,
        language: ['English'], // hardcoded for brevity
      };
      
      if (editId) {
        await apiService.supportResources.update(editId, payload);
      } else {
        await apiService.supportResources.create(payload);
      }
      setShowAdminForm(false);
      setEditId(null);
      fetchResources();
    } catch (e) {
      console.error("Failed to save", e);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.supportResources.delete(id);
      fetchResources();
      setConfirmDeleteId(null);
    } catch (e) {
      console.error(e);
    }
  };
  
  const handleVerify = async (id: string) => {
    try {
      await apiService.supportResources.update(id, { 
        verification_status: "verified", 
        last_verified_date: new Date().toISOString() 
      });
      fetchResources();
    } catch (e) {
      console.error(e);
    }
  };

  const handleEdit = (res: any) => {
    setFormData({
      name: res.name || "",
      resource_type: res.resource_type || "Crisis Support",
      region: res.region || "Global",
      phone: res.phone || "",
      website: res.website || "",
      hours: res.hours || "",
      accessibility: res.accessibility || "",
      emergency_flag: !!res.emergency_flag,
      contact_method: res.contact_method || "Phone"
    });
    setEditId(res.id);
    setShowAdminForm(true);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 lg:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-[#3C3530]">Support Directory</h1>
          <p className="text-[#7A726C]">Verified crisis lines, grounding groups, and caseworkers.</p>
        </div>
        <div className="flex items-center gap-3">
          {isWorker && (
            <button 
              onClick={() => { setEditId(null); setShowAdminForm(true); }}
              className="bg-[#5A5049] hover:bg-[#3C3530] text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center shadow-xs transition-all"
            >
              <Plus size={16} className="mr-2" /> Add Resource
            </button>
          )}
          <button
            onClick={onOpenEmergency}
            className="inline-flex items-center gap-1.5 bg-[#F3E7D8] hover:bg-[#EBDAC6] text-[#9A5B33] border border-[#C48A55]/35 px-4 py-2 rounded-xl text-sm font-semibold shadow-xs transition-all"
          >
            <ShieldAlert size={15} />
            Crisis Support
          </button>
        </div>
      </div>

      <div className="flex gap-4">
        <input 
          type="text" 
          placeholder="Filter by Region..." 
          className="px-4 py-2 bg-white border border-[#EFE8E2] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5049] w-64"
          value={filterRegion}
          onChange={(e) => setFilterRegion(e.target.value)}
        />
        <select 
          className="px-4 py-2 bg-white border border-[#EFE8E2] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#5A5049]"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="Crisis Support">Crisis Support</option>
          <option value="Legal & Psychological">Legal & Psychological</option>
          <option value="Peer Connection">Peer Connection</option>
        </select>
      </div>

      {showAdminForm && isWorker && (
        <div className="bg-white p-6 rounded-3xl border border-[#EFE8E2] shadow-xs">
          <h3 className="font-bold text-lg mb-4">{editId ? "Edit Resource" : "Add Support Resource"}</h3>
          <div className="grid grid-cols-2 gap-4">
            <input placeholder="Name" className="p-2 border rounded" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
            <select className="p-2 border rounded" value={formData.resource_type} onChange={e => setFormData({...formData, resource_type: e.target.value})}>
              <option value="Crisis Support">Crisis Support</option>
              <option value="Legal & Psychological">Legal & Psychological</option>
              <option value="Peer Connection">Peer Connection</option>
            </select>
            <input placeholder="Region" className="p-2 border rounded" value={formData.region} onChange={e => setFormData({...formData, region: e.target.value})} />
            <input placeholder="Phone" className="p-2 border rounded" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
            <input placeholder="Website" className="p-2 border rounded" value={formData.website} onChange={e => setFormData({...formData, website: e.target.value})} />
            <input placeholder="Hours" className="p-2 border rounded" value={formData.hours} onChange={e => setFormData({...formData, hours: e.target.value})} />
            <input placeholder="Accessibility" className="p-2 border rounded" value={formData.accessibility} onChange={e => setFormData({...formData, accessibility: e.target.value})} />
            <label className="flex items-center space-x-2 text-sm font-semibold">
              <input type="checkbox" checked={formData.emergency_flag} onChange={e => setFormData({...formData, emergency_flag: e.target.checked})} />
              <span>Emergency Resource</span>
            </label>
          </div>
          <div className="mt-6 flex justify-end gap-3">
            <button onClick={() => setShowAdminForm(false)} className="px-4 py-2 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancel</button>
            <button onClick={handleSave} className="px-4 py-2 font-bold bg-[#5A5049] text-white rounded-xl">Save</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-white rounded-3xl border border-[#EFE8E2]"></div>
          <div className="h-32 bg-white rounded-3xl border border-[#EFE8E2]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {resources.map(res => (
            <div key={res.id} className="bg-white rounded-3xl border border-[#EFE8E2] p-6 shadow-xs flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md ${res.emergency_flag ? 'bg-rose-100 text-rose-700' : 'bg-[#EFE8E2] text-[#5A5049]'}`}>
                  {res.resource_type}
                </span>
                {res.verification_status === "verified" ? (
                  <div className="flex items-center text-emerald-600 text-xs font-semibold" title="Verified Resource">
                    <ShieldCheck size={14} className="mr-1" />
                  </div>
                ) : (
                  <div className="flex items-center text-amber-500 text-xs font-semibold" title="Unverified">
                    <ShieldAlert size={14} className="mr-1" />
                  </div>
                )}
              </div>
              <h3 className="font-bold text-lg text-[#3C3530] leading-tight mb-2">{res.name}</h3>
              
              <div className="space-y-2 mt-auto pt-4 text-sm text-[#7A726C]">
                {res.region && (
                  <div className="flex items-start">
                    <MapPin size={16} className="mr-2 shrink-0 mt-0.5 text-slate-400" />
                    <span>{res.region}</span>
                  </div>
                )}
                {res.phone && (
                  <div className="flex items-start">
                    <Phone size={16} className="mr-2 shrink-0 mt-0.5 text-slate-400" />
                    <span className="font-semibold text-[#3C3530]">{res.phone}</span>
                  </div>
                )}
                {res.website && (
                  <div className="flex items-start min-w-0">
                    <Globe size={16} className="mr-2 shrink-0 mt-0.5 text-slate-400" />
                    <a
                      href={resourceHref(res.website)}
                      target="_blank"
                      rel="noreferrer noopener"
                      title={res.website}
                      data-no-translate
                      className="text-violet-600 hover:underline break-all min-w-0"
                    >
                      {resourceLinkText(res.website)}
                    </a>
                  </div>
                )}
                {res.hours && (
                  <div className="flex items-start">
                    <Clock size={16} className="mr-2 shrink-0 mt-0.5 text-slate-400" />
                    <span>{res.hours}</span>
                  </div>
                )}
              </div>

              {isWorker && (
                <div className="mt-4 pt-4 border-t border-[#EFE8E2] flex items-center justify-between text-slate-400">
                  <div className="flex gap-2">
                    <button onClick={() => handleEdit(res)} className="p-1.5 hover:bg-slate-100 rounded-md transition-colors" title="Edit"><Edit2 size={14} /></button>
                    <button onClick={() => setConfirmDeleteId(res.id)} className="p-1.5 hover:bg-rose-50 text-rose-400 rounded-md transition-colors" title="Delete"><Trash2 size={14} /></button>
                  </div>
                  {res.verification_status !== "verified" && (
                    <button onClick={() => handleVerify(res.id)} className="text-xs font-bold text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded-md">
                      Verify Now
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmDeleteId}
        title="Delete Support Resource"
        message="Are you sure you want to permanently delete this support resource? This action cannot be undone."
        confirmText="Delete Resource"
        onConfirm={() => confirmDeleteId && handleDelete(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
};
