"use client";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { useAuthContext } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/useToast";
import { getTheme, setTheme as persistTheme, type Theme } from "@/lib/theme";
import { exportUserData, deleteAccount } from "@/lib/api";
import { Sun, Moon, Monitor, Download, Trash2, LogOut } from "lucide-react";

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export default function SettingsPage() {
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const { toast } = useToast();

  const [theme, setThemeState] = useState<Theme | null>(null);
  const [exporting, setExporting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  const handleThemeChange = useCallback((value: Theme) => {
    persistTheme(value);
    setThemeState(value);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const blob = await exportUserData();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `interviewiq_data_export_${user?.id ?? "account"}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast({ title: "Export ready", description: "Your data export has been downloaded.", variant: "success" });
    } catch (err) {
      toast({
        title: "Export failed",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
    } finally {
      setExporting(false);
    }
  }, [toast, user?.id]);

  const handleDeleteAccount = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      toast({ title: "Account deleted", description: "Sorry to see you go.", variant: "success" });
      await logout();
      router.push("/");
    } catch (err) {
      toast({
        title: "Couldn't delete account",
        description: err instanceof Error ? err.message : "Please try again.",
        variant: "error",
      });
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  }, [logout, router, toast]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  return (
    <div className="min-h-screen bg-night-950">
      <main className="pt-24 pb-16 px-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold">Settings</h1>
          <p className="text-gray-400 mt-1">Manage your account, appearance, and data</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>Your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500">Name</span>
              <span className="font-medium text-neutral-900">{user?.name ?? "—"}</span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span className="text-neutral-500">Email</span>
              <span className="font-medium text-neutral-900">{user?.email ?? "—"}</span>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut size={14} /> Log out
            </Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose how InterviewIQ looks on this device</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2" role="radiogroup" aria-label="Theme">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={theme === value}
                  onClick={() => handleThemeChange(value)}
                  className={`flex-1 flex flex-col items-center gap-1.5 rounded-xl border px-4 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${
                    theme === value
                      ? "border-primary-500 bg-primary-500/10 text-primary-600"
                      : "border-neutral-300 text-neutral-600 hover:bg-neutral-100"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Privacy &amp; data</CardTitle>
            <CardDescription>
              Export a copy of everything associated with your account, or permanently delete it.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-between">
            <Button variant="outline" size="sm" onClick={handleExport} loading={exporting}>
              <Download size={14} /> Export my data
            </Button>
            <Button variant="danger" size="sm" onClick={() => setDeleteDialogOpen(true)}>
              <Trash2 size={14} /> Delete account
            </Button>
          </CardFooter>
        </Card>
      </main>

      <Dialog
        open={deleteDialogOpen}
        onClose={() => !deleting && setDeleteDialogOpen(false)}
        title="Delete your account?"
        description="This permanently deletes your account and all associated interview sessions and reports. This can't be undone."
      >
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>
            Cancel
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteAccount} loading={deleting}>
            Delete permanently
          </Button>
        </div>
      </Dialog>
    </div>
  );
}