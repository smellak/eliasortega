import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Save, Plus, Trash2, User, Mail, Phone, Briefcase, Loader2 } from "lucide-react";
import type { Provider, ProviderContact, UpdateProviderInput } from "@shared/types";

interface ProviderEditModalProps {
  provider: Provider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: UpdateProviderInput) => Promise<void>;
  onAddContact: (providerId: string, contact: { name: string; email?: string | null; phone?: string | null; role?: string | null }) => Promise<void>;
  onUpdateContact: (providerId: string, contactId: string, contact: { name?: string; email?: string | null; phone?: string | null; role?: string | null }) => Promise<void>;
  onDeleteContact: (providerId: string, contactId: string) => Promise<void>;
  readOnly?: boolean;
}

const PROVIDER_TYPES = [
  { value: "DIRECT_SUPPLIER", label: "Proveedor directo" },
  { value: "AGENCY", label: "Agencia" },
  { value: "LOCAL_DISTRIBUTOR", label: "Distribuidor local" },
  { value: "IMPORT_PROCESS", label: "Importación" },
];

const TRANSPORT_TYPES = [
  { value: "OWN_TRUCK", label: "Camión propio" },
  { value: "VIA_AGENCY", label: "Vía agencia" },
  { value: "MIXED", label: "Mixto" },
  { value: "IS_AGENCY", label: "Es agencia" },
  { value: "COURIER", label: "Mensajería" },
];

const VOLUME_TYPES = [
  { value: "full_truck", label: "Camión completo" },
  { value: "half_truck", label: "Medio camión" },
  { value: "groupage", label: "Grupaje" },
  { value: "parcels", label: "Paquetería" },
  { value: "container", label: "Contenedor" },
];

const CATEGORIES = [
  "Tapicería", "Electro", "Mobiliario", "Cocina", "Colchonería",
  "Baño", "Asientos", "PAE", "Decoración", "Iluminación", "Otro",
];

interface ContactForm {
  id?: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  isNew?: boolean;
  isEditing?: boolean;
}

export function ProviderEditModal({
  provider,
  open,
  onOpenChange,
  onSave,
  onAddContact,
  onUpdateContact,
  onDeleteContact,
  readOnly = false,
}: ProviderEditModalProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    officialName: "",
    type: "DIRECT_SUPPLIER",
    category: "",
    subcategory: "",
    transportType: "",
    typicalVolume: "",
    avgLeadDays: "",
    automated: false,
    specialNotes: "",
    notes: "",
  });
  const [contacts, setContacts] = useState<ContactForm[]>([]);
  const [newContact, setNewContact] = useState<ContactForm | null>(null);
  const [contactSaving, setContactSaving] = useState<string | null>(null);

  useEffect(() => {
    if (provider) {
      setForm({
        name: provider.name || "",
        officialName: provider.officialName || "",
        type: provider.type || "DIRECT_SUPPLIER",
        category: provider.category || "",
        subcategory: provider.subcategory || "",
        transportType: provider.transportType || "",
        typicalVolume: provider.typicalVolume || "",
        avgLeadDays: provider.avgLeadDays != null ? String(provider.avgLeadDays) : "",
        automated: provider.automated || false,
        specialNotes: provider.specialNotes || "",
        notes: provider.notes || "",
      });
      setContacts(
        (provider.contacts || []).map((c) => ({
          id: c.id,
          name: c.name,
          email: c.email || "",
          phone: c.phone || "",
          role: c.role || "",
        }))
      );
      setNewContact(null);
    }
  }, [provider]);

  const handleSave = async () => {
    if (!provider || readOnly) return;
    setSaving(true);
    try {
      await onSave(provider.id, {
        name: form.name,
        officialName: form.officialName || null,
        type: form.type,
        category: form.category || null,
        subcategory: form.subcategory || null,
        transportType: form.transportType || null,
        typicalVolume: form.typicalVolume || null,
        avgLeadDays: form.avgLeadDays ? parseFloat(form.avgLeadDays) : null,
        automated: form.automated,
        specialNotes: form.specialNotes || null,
        notes: form.notes || null,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleAddContact = async () => {
    if (!provider || !newContact || !newContact.name.trim()) return;
    setContactSaving("new");
    try {
      await onAddContact(provider.id, {
        name: newContact.name,
        email: newContact.email || null,
        phone: newContact.phone || null,
        role: newContact.role || null,
      });
      setNewContact(null);
    } finally {
      setContactSaving(null);
    }
  };

  const handleUpdateContact = async (contact: ContactForm) => {
    if (!provider || !contact.id) return;
    setContactSaving(contact.id);
    try {
      await onUpdateContact(provider.id, contact.id, {
        name: contact.name,
        email: contact.email || null,
        phone: contact.phone || null,
        role: contact.role || null,
      });
    } finally {
      setContactSaving(null);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!provider) return;
    setContactSaving(contactId);
    try {
      await onDeleteContact(provider.id, contactId);
    } finally {
      setContactSaving(null);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="provider-edit-modal">
        <SheetHeader>
          <SheetTitle className="text-lg">{readOnly ? "Detalle del proveedor" : "Editar proveedor"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Basic info */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Información básica</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="prov-name">Nombre *</Label>
                <Input id="prov-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} disabled={readOnly} data-testid="input-provider-name" />
              </div>
              <div>
                <Label htmlFor="prov-official">Nombre oficial</Label>
                <Input id="prov-official" value={form.officialName} onChange={(e) => setForm({ ...form, officialName: e.target.value })} disabled={readOnly} placeholder="Razón social" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })} disabled={readOnly}>
                    <SelectTrigger data-testid="select-provider-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROVIDER_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoría</Label>
                  <Select value={form.category || "__none__"} onValueChange={(v) => setForm({ ...form, category: v === "__none__" ? "" : v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Sin categoría</SelectItem>
                      {CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="prov-subcat">Subcategoría</Label>
                <Input id="prov-subcat" value={form.subcategory} onChange={(e) => setForm({ ...form, subcategory: e.target.value })} disabled={readOnly} placeholder="Opcional" />
              </div>
            </div>
          </section>

          <Separator />

          {/* Logistics */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Logística</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Transporte</Label>
                  <Select value={form.transportType || "__none__"} onValueChange={(v) => setForm({ ...form, transportType: v === "__none__" ? "" : v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue placeholder="No definido" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No definido</SelectItem>
                      {TRANSPORT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Volumen típico</Label>
                  <Select value={form.typicalVolume || "__none__"} onValueChange={(v) => setForm({ ...form, typicalVolume: v === "__none__" ? "" : v })} disabled={readOnly}>
                    <SelectTrigger><SelectValue placeholder="No definido" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No definido</SelectItem>
                      {VOLUME_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="prov-lead">Lead time (días)</Label>
                  <Input id="prov-lead" type="number" step="0.5" value={form.avgLeadDays} onChange={(e) => setForm({ ...form, avgLeadDays: e.target.value })} disabled={readOnly} placeholder="Ej: 3" />
                </div>
                <div className="flex items-end gap-2 pb-1">
                  <Switch id="prov-auto" checked={form.automated} onCheckedChange={(v) => setForm({ ...form, automated: v })} disabled={readOnly} />
                  <Label htmlFor="prov-auto" className="cursor-pointer">Automatizado</Label>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* Notes */}
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Notas</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="prov-notes">Notas generales</Label>
                <Textarea id="prov-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} disabled={readOnly} rows={2} />
              </div>
              <div>
                <Label htmlFor="prov-special">Notas especiales</Label>
                <Textarea id="prov-special" value={form.specialNotes} onChange={(e) => setForm({ ...form, specialNotes: e.target.value })} disabled={readOnly} rows={2} placeholder="Instrucciones especiales de descarga, etc." />
              </div>
            </div>
          </section>

          <Separator />

          {/* Contacts */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Contactos</h3>
              {!readOnly && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewContact({ name: "", email: "", phone: "", role: "", isNew: true })}
                  disabled={!!newContact}
                  data-testid="button-add-contact"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Añadir
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {/* New contact form */}
              {newContact && (
                <div className="border rounded-lg p-3 space-y-2 bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                  <div className="flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Nombre *" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input placeholder="Email" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className="h-8 text-sm" />
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Input placeholder="Teléfono" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className="h-8 text-sm" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                    <Input placeholder="Rol (ej: comercial)" value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })} className="h-8 text-sm" />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" size="sm" onClick={() => setNewContact(null)}>Cancelar</Button>
                    <Button size="sm" onClick={handleAddContact} disabled={!newContact.name.trim() || contactSaving === "new"}>
                      {contactSaving === "new" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                      Guardar
                    </Button>
                  </div>
                </div>
              )}

              {/* Existing contacts */}
              {contacts.length === 0 && !newContact && (
                <p className="text-sm text-muted-foreground text-center py-4">Sin contactos registrados</p>
              )}

              {contacts.map((contact) => (
                <div key={contact.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {contact.isEditing ? (
                        <Input value={contact.name} onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, name: e.target.value } : c))} className="h-8 text-sm w-40" />
                      ) : (
                        <span className="font-medium text-sm">{contact.name}</span>
                      )}
                      {contact.role && !contact.isEditing && (
                        <Badge variant="secondary" className="text-xs">{contact.role}</Badge>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="flex gap-1">
                        {contact.isEditing ? (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setContacts(contacts.map(c => c.id === contact.id ? { ...c, isEditing: false } : c))}>
                              Cancelar
                            </Button>
                            <Button size="sm" className="h-7 px-2" onClick={() => handleUpdateContact(contact)} disabled={contactSaving === contact.id}>
                              {contactSaving === contact.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Guardar"}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setContacts(contacts.map(c => c.id === contact.id ? { ...c, isEditing: true } : c))}>
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-700" onClick={() => contact.id && handleDeleteContact(contact.id)} disabled={contactSaving === contact.id}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  {contact.isEditing ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <Input value={contact.email} onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, email: e.target.value } : c))} className="h-8 text-sm" placeholder="Email" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <Input value={contact.phone} onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, phone: e.target.value } : c))} className="h-8 text-sm" placeholder="Teléfono" />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                        <Input value={contact.role} onChange={(e) => setContacts(contacts.map(c => c.id === contact.id ? { ...c, role: e.target.value } : c))} className="h-8 text-sm" placeholder="Rol" />
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pl-5">
                      {contact.email && (
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{contact.email}</span>
                      )}
                      {contact.phone && (
                        <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{contact.phone}</span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Save button */}
          {!readOnly && (
            <div className="pt-4 pb-2 sticky bottom-0 bg-background">
              <Button className="w-full" onClick={handleSave} disabled={!form.name.trim() || saving} data-testid="button-save-provider">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Guardar proveedor
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
