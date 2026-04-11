import { Sidebar } from "@/components/admin/Sidebar";

export const metadata = {
  title: "Admin | Gjej.al",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="admin-layout min-h-screen bg-slate-50">
      <Sidebar />
      <div className="lg:pl-64 pt-14 lg:pt-0 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
