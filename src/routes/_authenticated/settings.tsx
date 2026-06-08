import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  User, Lock, Building2, Save, KeyRound, 
  Coins, Calendar, Mail, Phone, MapPin, 
  CreditCard, Users, ShieldAlert, CheckCircle2 
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — HRMS" }] }),
  component: SettingsPage,
});

function initials(name?: string) {
  if (!name) return "?";
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function SettingsPage() {
  const qc = useQueryClient();
  const { role: authRole } = useAuth();
  const isAdminOrHr = ["admin", "hr"].includes((authRole ?? "").toLowerCase().trim());

  // --- Queries ---
  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["profile-me"],
    queryFn: () => api<any>("/profile/me"),
  });

  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ["settings-company"],
    queryFn: () => api<any>("/settings/company"),
  });
  const currencySymbol = company?.currency ?? "";

  // --- Form States ---
  const [profileForm, setProfileForm] = useState({
    personal_email: "",
    contact_number: "",
    marital_status: "",
    emergency_contact_name: "",
    emergency_contact_number: "",
    bank_account_number: "",
  });

  const [passwordForm, setPasswordForm] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [companyForm, setCompanyForm] = useState({
    company_name: "",
    office_start_time: "09:00:00",
    office_end_time: "18:00:00",
    weekend_days: "Saturday,Sunday",
    currency: "",
  });

  const [newLeaveTypeName, setNewLeaveTypeName] = useState("");
  const [newLeaveTypeDays, setNewLeaveTypeDays] = useState("");

  // Populate Forms when data loads
  useEffect(() => {
    if (profile) {
      setProfileForm({
        personal_email: profile.personal_email ?? "",
        contact_number: profile.contact_number ?? "",
        marital_status: profile.marital_status ?? "Single",
        emergency_contact_name: profile.emergency_contact_name ?? "",
        emergency_contact_number: profile.emergency_contact_number ?? "",
        bank_account_number: profile.bank_account_number ?? "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (company) {
      setCompanyForm({
        company_name: company.company_name ?? "",
        office_start_time: company.office_start_time ?? "09:00:00",
        office_end_time: company.office_end_time ?? "18:00:00",
        weekend_days: company.weekend_days ?? "Saturday,Sunday",
        currency: company.currency ?? "",
      });
    }
  }, [company]);

  // --- Mutations ---
  const updateProfile = useMutation({
    mutationFn: (data: typeof profileForm) => 
      api("/profile/me", { method: "PUT", body: data }),
    onSuccess: () => {
      toast.success("Personal profile details updated successfully!");
      qc.invalidateQueries({ queryKey: ["profile-me"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update profile details.");
    }
  });

  const changePassword = useMutation({
    mutationFn: (data: typeof passwordForm) => 
      api("/profile/change-password", { method: "POST", body: data }),
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setPasswordForm({ current_password: "", new_password: "", confirm_password: "" });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to change password. Please check your credentials.");
    }
  });

  const updateCompany = useMutation({
    mutationFn: (data: typeof companyForm) => 
      api("/settings/company", { method: "PUT", body: data }),
    onSuccess: () => {
      toast.success("Global company settings updated successfully!");
      qc.invalidateQueries({ queryKey: ["settings-company"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to update company settings.");
    }
  });

  const { data: leaveTypes, isLoading: isLoadingLeaveTypes } = useQuery({
    queryKey: ["leave-types"],
    queryFn: () => api<any[]>("/settings/leave-types"),
  });

  const addLeaveType = useMutation({
    mutationFn: (data: { name: string; default_days: number }) =>
      api("/settings/leave-types", { method: "POST", body: data }),
    onSuccess: () => {
      toast.success("Leave type added successfully!");
      qc.invalidateQueries({ queryKey: ["leave-types"] });
      setNewLeaveTypeName("");
      setNewLeaveTypeDays("");
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to add leave type.");
    }
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(profileForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("New passwords do not match.");
      return;
    }
    changePassword.mutate(passwordForm);
  };

  const handleCompanySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompany.mutate(companyForm);
  };

  const handleLeaveTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeaveTypeName.trim() || !newLeaveTypeDays) return;
    addLeaveType.mutate({
      name: newLeaveTypeName,
      default_days: Number(newLeaveTypeDays)
    });
  };

  if (isLoadingProfile || isLoadingCompany) {
    return (
      <div className="flex flex-col gap-6 animate-pulse">
        <div className="h-10 w-48 bg-muted rounded-md" />
        <div className="h-4 w-72 bg-muted rounded-md" />
        <div className="h-96 w-full bg-muted rounded-xl mt-4" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your personal profile, security credentials, and organization preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="bg-muted/60 p-1 border border-border/20 rounded-xl mb-6 shadow-sm">
          <TabsTrigger value="profile" className="gap-2 px-4 py-2 font-semibold">
            <User className="h-4 w-4" /> Profile Info
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2 px-4 py-2 font-semibold">
            <Lock className="h-4 w-4" /> Security
          </TabsTrigger>
          {isAdminOrHr && (
            <TabsTrigger value="company" className="gap-2 px-4 py-2 font-semibold">
              <Building2 className="h-4 w-4" /> Company Setup
            </TabsTrigger>
          )}
        </TabsList>

        {/* --- Profile Info Tab --- */}
        <TabsContent value="profile">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Card: Summary Badge Card */}
            <div className="space-y-6 lg:col-span-1">
              <Card className="border border-border/50 bg-card shadow-soft overflow-hidden">
                <div className="h-24 bg-gradient-to-r from-primary/80 to-purple-600/80" />
                <CardContent className="pt-0 pb-6 relative">
                  <div className="flex flex-col items-center -mt-12">
                    <div 
                      className="h-24 w-24 rounded-2xl border-4 border-card flex items-center justify-center text-white font-extrabold text-2xl shadow-md bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500"
                    >
                      {initials(profile?.full_name)}
                    </div>
                    <h2 className="text-lg font-bold mt-4 tracking-tight">{profile?.full_name}</h2>
                    <p className="text-xs font-semibold text-primary uppercase bg-primary/10 px-2 py-0.5 rounded-full mt-1.5">
                      {profile?.designation || "Employee"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1.5">{profile?.email}</p>
                  </div>
                  
                  <div className="mt-6 pt-6 border-t border-border/50 space-y-3.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Department</span>
                      <span className="font-bold text-foreground">{profile?.department}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Role Level</span>
                      <span className="font-bold text-foreground capitalize">{profile?.role}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Joined On</span>
                      <span className="font-bold text-foreground">
                        {profile?.joining_date ? new Date(profile.joining_date).toLocaleDateString("en-US", { dateStyle: "medium" }) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground font-medium">Reporting Manager</span>
                      <span className="font-bold text-foreground text-xs truncate max-w-[150px]" title={profile?.manager_email}>
                        {profile?.manager_email || "N/A"}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Read-Only Compensation Info */}
              {profile?.total_salary && (
                <Card className="border border-border/50 bg-card shadow-soft">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-bold flex items-center gap-2">
                      <Coins className="h-4 w-4 text-primary" /> Compensation Details
                    </CardTitle>
                    <CardDescription className="text-xs">Your contracted pay structure (Read-only)</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Basic Salary</span>
                      <span className="font-bold text-foreground">{profile.basic_salary?.toLocaleString()} {currencySymbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">House Allowance (HRA)</span>
                      <span className="font-bold text-foreground">{profile.hra?.toLocaleString()} {currencySymbol}</span>
                    </div>
                    {profile.transportation > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Transportation</span>
                        <span className="font-bold text-foreground">{profile.transportation?.toLocaleString()} {currencySymbol}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-border/50">
                      <span className="font-semibold text-foreground">Total Salary</span>
                      <span className="font-extrabold text-primary text-base">{profile.total_salary?.toLocaleString()} {currencySymbol}</span>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Card: Editable profile details */}
            <div className="lg:col-span-2">
              <form onSubmit={handleProfileSubmit}>
                <Card className="border border-border/50 bg-card shadow-soft">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold">Personal & Contact Settings</CardTitle>
                    <CardDescription>
                      Update your personal contact details below. Keep this information accurate for emergency contacts and notifications.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Personal Email */}
                      <div className="space-y-1.5">
                        <Label htmlFor="personal_email" className="flex items-center gap-1.5">
                          <Mail className="h-3.5 w-3.5 text-muted-foreground" /> Personal Email Address
                        </Label>
                        <Input 
                          id="personal_email" 
                          type="email" 
                          placeholder="e.g. personal@email.com" 
                          value={profileForm.personal_email}
                          onChange={(e) => setProfileForm({ ...profileForm, personal_email: e.target.value })}
                        />
                      </div>

                      {/* Contact Number */}
                      <div className="space-y-1.5">
                        <Label htmlFor="contact_number" className="flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-muted-foreground" /> Contact / Mobile Number
                        </Label>
                        <Input 
                          id="contact_number" 
                          type="tel" 
                          placeholder="e.g. +971 50 123 4567" 
                          value={profileForm.contact_number}
                          onChange={(e) => setProfileForm({ ...profileForm, contact_number: e.target.value })}
                        />
                      </div>

                      {/* Marital Status */}
                      <div className="space-y-1.5">
                        <Label htmlFor="marital_status" className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-muted-foreground" /> Marital Status
                        </Label>
                        <select 
                          id="marital_status"
                          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          value={profileForm.marital_status}
                          onChange={(e) => setProfileForm({ ...profileForm, marital_status: e.target.value })}
                        >
                          <option value="Single">Single</option>
                          <option value="Married">Married</option>
                          <option value="Divorced">Divorced</option>
                          <option value="Widowed">Widowed</option>
                        </select>
                      </div>

                      {/* Bank Account Number */}
                      <div className="space-y-1.5">
                        <Label htmlFor="bank_account_number" className="flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-muted-foreground" /> Bank Account Number
                        </Label>
                        <Input 
                          id="bank_account_number" 
                          placeholder="e.g. 1029384756" 
                          value={profileForm.bank_account_number}
                          onChange={(e) => setProfileForm({ ...profileForm, bank_account_number: e.target.value })}
                        />
                      </div>

                      {/* Emergency Contact Name */}
                      <div className="space-y-1.5">
                        <Label htmlFor="emergency_contact_name" className="flex items-center gap-1.5">
                          Emergency Contact Name
                        </Label>
                        <Input 
                          id="emergency_contact_name" 
                          placeholder="Full Name" 
                          value={profileForm.emergency_contact_name}
                          onChange={(e) => setProfileForm({ ...profileForm, emergency_contact_name: e.target.value })}
                        />
                      </div>

                      {/* Emergency Contact Phone */}
                      <div className="space-y-1.5">
                        <Label htmlFor="emergency_contact_number" className="flex items-center gap-1.5">
                          Emergency Contact Phone
                        </Label>
                        <Input 
                          id="emergency_contact_number" 
                          placeholder="Phone Number" 
                          value={profileForm.emergency_contact_number}
                          onChange={(e) => setProfileForm({ ...profileForm, emergency_contact_number: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={updateProfile.isPending} 
                        className="cursor-pointer font-semibold shadow-sm"
                        style={{ background: "var(--gradient-brand)" }}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateProfile.isPending ? "Saving..." : "Save Details"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>
            </div>
          </div>
        </TabsContent>

        {/* --- Security Tab --- */}
        <TabsContent value="security">
          <div className="max-w-xl mx-auto">
            <form onSubmit={handlePasswordSubmit}>
              <Card className="border border-border/50 bg-card shadow-soft">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <KeyRound className="h-5 w-5 text-primary" /> Credentials & Password
                  </CardTitle>
                  <CardDescription>
                    Update your password regularly to maintain a high level of security for your employee profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="current_password">Current Password</Label>
                    <Input 
                      id="current_password" 
                      type="password" 
                      placeholder="••••••••" 
                      value={passwordForm.current_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="new_password">New Password</Label>
                    <Input 
                      id="new_password" 
                      type="password" 
                      placeholder="At least 6 characters" 
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm_password">Confirm New Password</Label>
                    <Input 
                      id="confirm_password" 
                      type="password" 
                      placeholder="At least 6 characters" 
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      required
                    />
                  </div>

                  <div className="pt-4 flex justify-end">
                    <Button 
                      type="submit" 
                      disabled={changePassword.isPending} 
                      className="cursor-pointer font-semibold shadow-sm"
                      style={{ background: "var(--gradient-brand)" }}
                    >
                      <Lock className="h-4 w-4 mr-2" />
                      {changePassword.isPending ? "Updating Password..." : "Change Password"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </form>
          </div>
        </TabsContent>

        {/* --- Company Setup Tab (Admin/HR Only) --- */}
        {isAdminOrHr && (
          <TabsContent value="company">
            <div className="max-w-2xl mx-auto">
              <form onSubmit={handleCompanySubmit}>
                <Card className="border border-border/50 bg-card shadow-soft">
                  <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" /> Global Organization Settings
                    </CardTitle>
                    <CardDescription>
                      Configure company-wide policies, working hours, active currency, and official workdays. (HR & Admin Roles only)
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Company Name */}
                      <div className="space-y-1.5 md:col-span-2">
                        <Label htmlFor="company_name">Company Name</Label>
                        <Input 
                          id="company_name" 
                          placeholder="e.g. Aimploy Technologies Ltd." 
                          value={companyForm.company_name}
                          onChange={(e) => setCompanyForm({ ...companyForm, company_name: e.target.value })}
                          required
                        />
                      </div>

                      {/* Office Start Time */}
                      <div className="space-y-1.5">
                        <Label htmlFor="office_start_time">Office Start Time</Label>
                        <Input 
                          id="office_start_time" 
                          type="time" 
                          value={companyForm.office_start_time}
                          onChange={(e) => setCompanyForm({ ...companyForm, office_start_time: e.target.value })}
                          required
                        />
                      </div>

                      {/* Office End Time */}
                      <div className="space-y-1.5">
                        <Label htmlFor="office_end_time">Office End Time</Label>
                        <Input 
                          id="office_end_time" 
                          type="time" 
                          value={companyForm.office_end_time}
                          onChange={(e) => setCompanyForm({ ...companyForm, office_end_time: e.target.value })}
                          required
                        />
                      </div>

                      {/* Default Currency */}
                      <div className="space-y-1.5">
                        <Label htmlFor="currency">Default Currency</Label>
                        <Input 
                          id="currency" 
                          placeholder="e.g. USD" 
                          value={companyForm.currency}
                          onChange={(e) => setCompanyForm({ ...companyForm, currency: e.target.value })}
                          required
                        />
                      </div>

                      {/* Weekend Days */}
                      <div className="space-y-1.5">
                        <Label htmlFor="weekend_days">Weekend Days (Comma-separated)</Label>
                        <Input 
                          id="weekend_days" 
                          placeholder="Saturday,Sunday" 
                          value={companyForm.weekend_days}
                          onChange={(e) => setCompanyForm({ ...companyForm, weekend_days: e.target.value })}
                          required
                        />
                      </div>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button 
                        type="submit" 
                        disabled={updateCompany.isPending} 
                        className="cursor-pointer font-semibold shadow-sm"
                        style={{ background: "var(--gradient-brand)" }}
                      >
                        <Save className="h-4 w-4 mr-2" />
                        {updateCompany.isPending ? "Saving configuration..." : "Save Settings"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </form>

              {/* Leave Types Management Card */}
              <Card className="border border-border/50 bg-card shadow-soft mt-6">
                <CardHeader>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Coins className="h-5 w-5 text-primary" /> Leave Types Management
                  </CardTitle>
                  <CardDescription>
                    Add custom leave types and configure their default annual allowances.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Add new leave type form */}
                  <form onSubmit={handleLeaveTypeSubmit} className="space-y-4 border-b pb-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="lt_name">Leave Type Name</Label>
                        <Input
                          id="lt_name"
                          placeholder="e.g. Earned Leave"
                          value={newLeaveTypeName}
                          onChange={(e) => setNewLeaveTypeName(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="lt_days">Default Days</Label>
                        <Input
                          id="lt_days"
                          type="number"
                          min="0"
                          placeholder="e.g. 15"
                          value={newLeaveTypeDays}
                          onChange={(e) => setNewLeaveTypeDays(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button type="submit" disabled={addLeaveType.isPending} className="font-semibold shadow-sm" style={{ background: "var(--gradient-brand)" }}>
                        {addLeaveType.isPending ? "Adding..." : "Add Leave Type"}
                      </Button>
                    </div>
                  </form>

                  {/* Current Leave Types List */}
                  <div className="space-y-3">
                    <Label className="font-semibold text-sm">Active Leave Types</Label>
                    {isLoadingLeaveTypes ? (
                      <p className="text-xs text-muted-foreground animate-pulse py-2 text-center">Loading leave types...</p>
                    ) : leaveTypes?.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2 text-center">No custom leave types defined yet.</p>
                    ) : (
                      <div className="border rounded-md overflow-hidden bg-card">
                        <Table>
                          <TableHeader className="bg-muted/10">
                            <TableRow>
                              <TableHead>Name</TableHead>
                              <TableHead className="text-right pr-6">Default Days</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {leaveTypes?.map((lt: any) => (
                              <TableRow key={lt.id} className="hover:bg-muted/5 transition-colors">
                                <TableCell className="capitalize text-xs font-semibold">{lt.name} Leave</TableCell>
                                <TableCell className="text-right pr-6 text-xs font-mono font-semibold">{lt.default_days} days</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
